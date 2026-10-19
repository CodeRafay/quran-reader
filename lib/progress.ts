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
