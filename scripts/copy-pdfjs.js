// pdf.js parses PDFs in a web worker and decodes JBIG2/JPEG 2000 images with WebAssembly;
// serve both from our own origin.
import { cpSync, copyFileSync } from "node:fs";

copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
cpSync("node_modules/pdfjs-dist/wasm", "public/pdfjs-wasm", {
  recursive: true,
  filter: (src) => !src.includes("quickjs") && !src.includes("LICENSE"), // no PDF scripting
});
