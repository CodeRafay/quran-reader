// After next build: write the app-shell file list and a version into out/sw.js. node scripts/build-sw.ts
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { BOOKS } from "../lib/books.ts";

// books are saved one by one on request; the no-wasm decoders are only for browsers without WebAssembly
const SKIP = /^(pdfs\/|sw\.js$|404\.html$|_not-found)|_nowasm_fallback\.js$/;
const PLACEHOLDER = 'const VERSION = "dev", FILES = [];';

const files = readdirSync("out", { recursive: true, encoding: "utf8" })
  .map((f) => f.replaceAll("\\", "/"))
  .filter((f) => !SKIP.test(f) && statSync(`out/${f}`).isFile())
  .sort();
// pages are served at clean URLs (/read/x, not /read/x.html); the router's .txt files at their own paths
const urls = files.map((f) => "/" + f.replace(/\.html$/, "").replace(/(^|\/)index$/, "$1"));

const hash = createHash("sha1");
for (const f of files) hash.update(f).update(readFileSync(`out/${f}`));
const version = hash.digest("hex").slice(0, 8);

for (const u of ["/", "/index.txt", "/pdf.worker.min.mjs", "/manifest.webmanifest"]) assert.ok(urls.includes(u), `shell misses ${u}`);
for (const b of BOOKS)
  for (const u of [`/read/${b.id}`, `/read/${b.id}.txt`, b.cover]) assert.ok(urls.includes(u), `shell misses ${u}`);
assert.ok(!urls.some((u) => u.startsWith("/pdfs/")), "a PDF slipped into the shell");

const sw = readFileSync("out/sw.js", "utf8");
assert.ok(sw.startsWith(PLACEHOLDER), "out/sw.js doesn't start with the placeholder line");
writeFileSync("out/sw.js", `const VERSION = "${version}", FILES = ${JSON.stringify(urls)};` + sw.slice(PLACEHOLDER.length));
console.log(`sw: ${urls.length} files, version ${version}`);
