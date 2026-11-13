import type { TocEntry } from "./books";

// Last page read per book, kept in this browser only.
const key = (id: string) => `page:${id}`;

export function savedPage(id: string, pages: number): number | null {
  try {
    const p = Number(localStorage.getItem(key(id)));
    return Number.isInteger(p) && p >= 1 && p <= pages ? p : null;
  } catch {
    return null; // storage blocked (private mode etc.)
  }
}

export function savePage(id: string, page: number) {
  try {
    localStorage.setItem(key(id), String(page));
  } catch {}
}

// Night mode, one setting for every book. null = never chosen.
export function savedNight(): boolean | null {
  try {
    const v = localStorage.getItem("night");
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

export function saveNight(on: boolean) {
  try {
    localStorage.setItem("night", on ? "1" : "0");
  } catch {}
}

// One page at a time vs continuous scroll, one setting for every book. null = never chosen.
export function savedSingle(): boolean | null {
  try {
    const v = localStorage.getItem("single");
    return v === null ? null : v === "1";
  } catch {
    return null;
  }
}

export function saveSingle(on: boolean) {
  try {
    localStorage.setItem("single", on ? "1" : "0");
  } catch {}
}

// Named bookmarks per book, sorted by page. Stored data is checked: it may be stale or hand-edited.
const bmKey = (id: string) => `bookmarks:${id}`;

export function savedBookmarks(id: string, pages: number): TocEntry[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(bmKey(id)) ?? "[]");
    return Array.isArray(list)
      ? list.filter((b) => typeof b?.title === "string" && Number.isInteger(b.page) && b.page >= 1 && b.page <= pages)
      : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(id: string, list: TocEntry[]) {
  try {
    localStorage.setItem(bmKey(id), JSON.stringify(list));
  } catch {}
}
