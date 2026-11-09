"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import "pdfjs-dist/web/pdf_viewer.css";
import type { Book, TocEntry } from "../lib/books";
import { saveNight, savePage, savedNight, savedPage } from "../lib/progress";
import s from "./Reader.module.css";

const MAX_PAGE_WIDTH = 960; // CSS px: past this a page is too tall to read comfortably
const PDF_TO_CSS = 96 / 72;

function startPage(book: Book) {
  const q = Number(new URLSearchParams(location.search).get("page"));
  if (Number.isInteger(q) && q >= 1 && q <= book.pages) return q;
  return savedPage(book.id, book.pages) ?? 1;
}

// Flatten the PDF's bookmarks into page numbers so the contents list can show and jump to them.
async function outlineToToc(doc: PDFDocumentProxy): Promise<TocEntry[]> {
  const out: TocEntry[] = [];
  const walk = async (items: Awaited<ReturnType<PDFDocumentProxy["getOutline"]>> | undefined) => {
    for (const item of items ?? []) {
      const dest = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
      const ref = dest?.[0];
      if (ref != null) {
        const index = typeof ref === "number" ? ref : await doc.getPageIndex(ref);
        out.push({ title: item.title.trim(), page: index + 1 });
      }
      await walk(item.items);
    }
  };
  await walk(await doc.getOutline());
  return out;
}

export default function Reader({ book }: { book: Book }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PDFViewer | null>(null);
  const pageWidthRef = useRef(0); // widest of the first pages, in PDF points
  const fitRef = useRef(true); // follow the screen width until the reader zooms by hand
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [toc, setToc] = useState<TocEntry[]>(book.toc ?? []);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [night, setNight] = useState(false);

  // Read after mount: the server render can't see storage or the system theme.
  useEffect(() => {
    setNight(savedNight() ?? matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  const fit = useCallback(() => {
    const viewer = viewerRef.current;
    const container = containerRef.current;
    if (!viewer || !container || !pageWidthRef.current) return;
    const target = Math.min(container.clientWidth - 8, MAX_PAGE_WIDTH);
    viewer.currentScale = target / (pageWidthRef.current * PDF_TO_CSS);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | undefined;
    const container = containerRef.current!;

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      (globalThis as { pdfjsLib?: unknown }).pdfjsLib = pdfjs; // pdf_viewer.mjs looks for it here
      const { EventBus, PDFLinkService, PDFViewer } = await import("pdfjs-dist/web/pdf_viewer.mjs");
      if (cancelled) return;

      const eventBus = new EventBus();
      const linkService = new PDFLinkService({ eventBus });
      const viewer = new PDFViewer({
        container,
        eventBus,
        linkService,
        removePageBorders: true,
        textLayerMode: 0, // scanned pages: no text to select
        supportsPinchToZoom: true,
      });
      linkService.setViewer(viewer);
      viewerRef.current = viewer;

      const start = startPage(book);
      eventBus.on("pagesinit", () => {
        fit();
        if (start > 1) viewer.currentPageNumber = start;
        savePage(book.id, start); // "pagechanging" doesn't fire when the book opens on page 1
        setStatus("ready");
      });
      eventBus.on("pagechanging", ({ pageNumber }: { pageNumber: number }) => {
        setPage(pageNumber);
        setPageInput(String(pageNumber));
        savePage(book.id, pageNumber);
        history.replaceState(history.state, "", `?page=${pageNumber}`);
      });

      // Range requests: only the pages being looked at are downloaded.
      task = pdfjs.getDocument({
        url: book.file,
        disableAutoFetch: true,
        disableStream: true,
        rangeChunkSize: 256 * 1024,
        wasmUrl: "/pdfjs-wasm/", // JBIG2 decoder for the scanned Quran pages
      });
      const doc = await task.promise;
      if (cancelled) return;
      const widths = await Promise.all(
        Array.from({ length: Math.min(5, doc.numPages) }, (_, i) =>
          doc.getPage(i + 1).then((p) => p.getViewport({ scale: 1 }).width),
        ),
      );
      pageWidthRef.current = Math.max(...widths);
      viewer.setDocument(doc);
      linkService.setDocument(doc);
      // book.juz replaces the PDF's own Arabic juz bookmarks
      if (!book.toc) outlineToToc(doc).then((t) => !cancelled && setToc(t.filter((e) => !e.title.startsWith("الجزء"))));
    })().catch((err) => {
      if (cancelled) return;
      console.error(err);
      setStatus("error");
    });

    return () => {
      cancelled = true;
      viewerRef.current = null;
      task?.destroy();
    };
  }, [book, fit]);

  useEffect(() => {
    const ro = new ResizeObserver(() => fitRef.current && fit());
    ro.observe(containerRef.current!);
    return () => ro.disconnect();
  }, [fit]);

  // Keep the screen awake while reading. The browser drops the lock whenever the tab is hidden, so take it again on return.
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    let done = false;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        ?.request("screen")
        .then((l) => {
          if (done) l.release();
          else lock = l;
        })
        .catch(() => {}); // unsupported, low battery, or not https: the screen just dims as before
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      done = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release();
    };
  }, []);

  useEffect(() => {
    if (!contentsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setContentsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contentsOpen]);

  // Right-to-left books: ← and PageDown go forward, → and PageUp go back. ↑/↓ keep scrolling.
  useEffect(() => {
    if (contentsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const viewer = viewerRef.current;
      if (!viewer || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft" || e.key === "PageDown") viewer.nextPage();
      else if (e.key === "ArrowRight" || e.key === "PageUp") viewer.previousPage();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contentsOpen]);

  // Tap the left quarter to go forward, the right quarter to go back (right-to-left).
  const onPagesClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const viewer = viewerRef.current;
    if (!viewer || (e.target as HTMLElement).closest("a, .linkAnnotation")) return;
    if (getSelection()?.toString()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    if (x < 0.25) viewer.nextPage();
    else if (x > 0.75) viewer.previousPage();
  };

  const goTo = (n: number) => {
    const viewer = viewerRef.current;
    if (viewer && Number.isInteger(n) && n >= 1 && n <= viewer.pagesCount) viewer.currentPageNumber = n;
    else setPageInput(String(page));
  };

  const zoom = (factor: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    fitRef.current = false;
    viewer.currentScale = Math.min(4, Math.max(0.3, viewer.currentScale * factor));
  };

  const resetZoom = () => {
    fitRef.current = true;
    fit();
  };

  const current = useMemo(() => toc.findLast((e) => e.page <= page), [toc, page]);
  const currentJuz = useMemo(() => book.juz?.findLast((e) => e.page <= page), [book, page]);
  // stable sort: a juz row stays above a surah starting on the same page
  const entries = useMemo(() => [...(book.juz ?? []), ...toc].sort((a, b) => a.page - b.page), [book, toc]);
  const shown = useMemo(() => {
    const norm = (t: string) => t.toLowerCase().replace(/\bpara\b/g, "juz"); // "para" and "juz" are the same thing
    const q = norm(filter.trim());
    return q ? entries.filter((e) => norm(e.title).includes(q)) : entries;
  }, [entries, filter]);

  return (
    <div className={s.reader}>
      <header className={s.bar}>
        <Link href="/" className={s.back} aria-label="Back to library">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className={s.heading}>
          <span className={s.bookTitle}>
            {book.group === "tafseer" ? `Tafseer, ${book.title}` : book.title}
          </span>
          {(current || currentJuz) && (
            <span className={s.section}>{[current?.title, currentJuz?.title].filter(Boolean).join(" · ")}</span>
          )}
        </div>
        <form
          className={s.pager}
          onSubmit={(e) => {
            e.preventDefault();
            goTo(Number(pageInput));
          }}
        >
          <label htmlFor="page" className={s.srOnly}>
            Page
          </label>
          <input
            id="page"
            className={s.pageInput}
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ""))}
            onBlur={() => goTo(Number(pageInput))}
          />
          <span className={s.total}>of {book.pages}</span>
        </form>
        <div className={s.zoom}>
          <button type="button" onClick={() => zoom(1 / 1.2)} aria-label="Zoom out">
            −
          </button>
          <button type="button" onClick={resetZoom} className={s.fitBtn}>
            Fit
          </button>
          <button type="button" onClick={() => zoom(1.2)} aria-label="Zoom in">
            +
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setNight(!night);
            saveNight(!night);
          }}
          aria-label="Night mode"
          aria-pressed={night}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"
              fill={night ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className={s.contentsBtn}
          onClick={() => setContentsOpen((o) => !o)}
          aria-expanded={contentsOpen}
          aria-controls="contents"
          disabled={!entries.length}
        >
          Contents
        </button>
      </header>

      <div
        ref={containerRef}
        className={[s.pages, night && s.night, book.colourCoded && s.keepHue].filter(Boolean).join(" ")}
        tabIndex={0}
        onClick={onPagesClick}
        aria-label={`${book.title} pages`}
      >
        <div className="pdfViewer" />
      </div>

      {book.colourCoded && (
        // Night mode that flips lightness only, so tajweed colours keep their hue and saturation:
        // each channel c becomes c + 1 − max(r,g,b) − min(r,g,b). Built from additions only, so nothing clamps and alpha stays 1.
        <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
          <filter id="night-keep-hue" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 1 0" result="r" />
            <feColorMatrix in="SourceGraphic" values="0 1 0 0 0  0 1 0 0 0  0 1 0 0 0  0 0 0 1 0" result="g" />
            <feColorMatrix in="SourceGraphic" values="0 0 1 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
            <feBlend in="r" in2="g" mode="lighten" result="rgMax" />
            <feBlend in="rgMax" in2="b" mode="lighten" result="max" />
            <feBlend in="r" in2="g" mode="darken" result="rgMin" />
            <feBlend in="rgMin" in2="b" mode="darken" result="min" />
            <feComponentTransfer in="max" result="invMax">
              <feFuncR type="linear" slope="-1" intercept="1" />
              <feFuncG type="linear" slope="-1" intercept="1" />
              <feFuncB type="linear" slope="-1" intercept="1" />
            </feComponentTransfer>
            {/* A = c + 1 − max */}
            <feComposite in="SourceGraphic" in2="invMax" operator="arithmetic" k2="1" k3="1" result="a" />
            <feComponentTransfer in="a" result="invA">
              <feFuncR type="linear" slope="-1" intercept="1" />
              <feFuncG type="linear" slope="-1" intercept="1" />
              <feFuncB type="linear" slope="-1" intercept="1" />
            </feComponentTransfer>
            {/* B = (1 − A) + min, then 1 − B = c + 1 − max − min */}
            <feComposite in="invA" in2="min" operator="arithmetic" k2="1" k3="1" result="bSum" />
            <feComponentTransfer in="bSum">
              <feFuncR type="linear" slope="-1" intercept="1" />
              <feFuncG type="linear" slope="-1" intercept="1" />
              <feFuncB type="linear" slope="-1" intercept="1" />
            </feComponentTransfer>
          </filter>
        </svg>
      )}

      {status !== "ready" && (
        <div className={s.status} role="status">
          {status === "loading" ? (
            <p>Opening {book.title}…</p>
          ) : (
            <>
              <p>This book didn’t open. Check your connection, then reload the page.</p>
              <button type="button" onClick={() => location.reload()}>
                Reload
              </button>
            </>
          )}
        </div>
      )}

      <div className={s.scrim} hidden={!contentsOpen} onClick={() => setContentsOpen(false)} />
      <aside id="contents" className={s.contents} hidden={!contentsOpen} aria-label="Contents">
        <div className={s.contentsHead}>
          <input
            className={s.filter}
            type="search"
            placeholder={book.juz ? "Find a surah or juz" : book.toc ? "Find a surah" : "Find a section"}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Find in contents"
          />
          <button type="button" onClick={() => setContentsOpen(false)}>
            Close
          </button>
        </div>
        <ol className={s.tocList}>
          {shown.map((e) => (
            <li key={`${e.page}-${e.title}`}>
              <button
                type="button"
                aria-current={e === current || e === currentJuz ? "true" : undefined}
                onClick={() => {
                  goTo(e.page);
                  setContentsOpen(false);
                }}
              >
                <span dir="auto">{e.title}</span>
                <span className={s.tocPage}>{e.page}</span>
              </button>
            </li>
          ))}
          {!shown.length && <li className={s.empty}>Nothing matches “{filter}”.</li>}
        </ol>
      </aside>
    </div>
  );
}
