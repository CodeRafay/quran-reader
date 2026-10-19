"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import "pdfjs-dist/web/pdf_viewer.css";
import type { Book, TocEntry } from "../lib/books";
import { savePage, savedPage } from "../lib/progress";
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
      if (!book.toc) outlineToToc(doc).then((t) => !cancelled && setToc(t));
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

  useEffect(() => {
    if (!contentsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setContentsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contentsOpen]);

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
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? toc.filter((e) => e.title.toLowerCase().includes(q)) : toc;
  }, [toc, filter]);

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
          {current && <span className={s.section}>{current.title}</span>}
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
          className={s.contentsBtn}
          onClick={() => setContentsOpen((o) => !o)}
          aria-expanded={contentsOpen}
          aria-controls="contents"
          disabled={!toc.length}
        >
          Contents
        </button>
      </header>

      <div ref={containerRef} className={s.pages} tabIndex={0} aria-label={`${book.title} pages`}>
        <div className="pdfViewer" />
      </div>

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
            placeholder={book.group === "quran" || book.toc ? "Find a surah" : "Find a section"}
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
                aria-current={e === current ? "true" : undefined}
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
