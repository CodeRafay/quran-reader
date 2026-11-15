// Books saved for offline reading. public/sw.js answers the reader's PDF range requests from this cache.
const CACHE = "books";

// Kept at module level so a download keeps going, and keeps showing, while the reader moves between pages.
const progress = new Map<string, number>(); // file -> whole percent
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export const supported = () => "serviceWorker" in navigator && "caches" in window;

export function onChange(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export const progressOf = (file: string) => progress.get(file);

export const isSaved = async (file: string) => !!(await (await caches.open(CACHE)).match(file));

export async function remove(file: string) {
  await (await caches.open(CACHE)).delete(file);
  changed();
}

export async function save(file: string, bytes: number) {
  if (progress.has(file)) return;
  progress.set(file, 0);
  changed();
  try {
    navigator.storage?.persist?.(); // ask the browser not to clear saved books when space runs low
    const res = await fetch(file);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    let got = 0;
    const counted = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, out) {
          got += chunk.length;
          const p = Math.floor((got * 100) / bytes);
          if (p !== progress.get(file)) {
            progress.set(file, p);
            changed();
          }
          out.enqueue(chunk);
        },
      }),
    );
    // streamed to disk as it arrives; a dropped connection rejects the put and stores nothing
    const cache = await caches.open(CACHE);
    await cache.put(file, new Response(counted, { headers: { "Content-Type": "application/pdf" } }));
    if (got !== bytes) {
      await cache.delete(file);
      throw new Error(`got ${got} of ${bytes} bytes`);
    }
  } finally {
    progress.delete(file);
    changed();
  }
}
