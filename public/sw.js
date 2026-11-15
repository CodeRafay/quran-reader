const VERSION = "dev", FILES = []; // replaced in out/sw.js by scripts/build-sw.ts
// Offline reading. The app shell is saved at install; books only when the reader taps Download (lib/offline.ts).
const SHELL = `shell-${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL).then((cache) =>
      Promise.all(
        FILES.map(async (url) => {
          if (await cache.match(url)) return; // a retried install keeps what already arrived
          // hashed file names never change content: reuse the copy from the previous build
          const old = url.startsWith("/_next/static/") && (await caches.match(url));
          return old ? cache.put(url, old) : cache.add(new Request(url, { cache: "no-cache" }));
        }),
      ),
    ),
  );
});

// No skipWaiting: a new build takes over once the app is closed, so an open page never mixes two builds.
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("shell-") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/pdfs/")) return e.respondWith(pdf(e.request, url.pathname));
  // ignoreSearch: ?page=N, the router's ?_rsc= and the icons' hash queries all map to one saved file
  e.respondWith(caches.match(e.request, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit || fetch(e.request)));
});

// The Cache API can't store partial responses and pdf.js only asks for byte ranges, so slice the saved book.
async function pdf(request, path) {
  const hit = await (await caches.open("books")).match(path);
  if (!hit) return fetch(request);
  const blob = await hit.blob();
  const size = blob.size;
  const m = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get("range") || "");
  // pdf.js reads Accept-Ranges and Content-Length off the first, whole-file request before it switches to ranges
  if (!m) return new Response(blob, { headers: { "Content-Type": "application/pdf", "Content-Length": `${size}`, "Accept-Ranges": "bytes" } });
  const start = Number(m[1]);
  const end = Math.min(m[2] ? Number(m[2]) : size - 1, size - 1);
  if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": `${end - start + 1}`,
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  });
}
