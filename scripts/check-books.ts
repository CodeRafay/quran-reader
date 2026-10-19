// Sanity check for the catalog: node scripts/check-books.ts
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { BOOKS } from "../lib/books.ts";

assert.equal(new Set(BOOKS.map((b) => b.id)).size, BOOKS.length, "duplicate book ids");
for (const b of BOOKS) {
  assert.ok(existsSync(`public${b.file}`), `missing ${b.file}`);
  assert.ok(existsSync(`public${b.cover}`), `missing ${b.cover}`);
  if (!b.toc) continue;
  // each manzil starts on a fresh surah page; manzil 1 also carries the 22 front-matter pages
  const first = b.id === "tafseer-manzil-1" ? 23 : 1;
  assert.equal(b.toc[0].page, first, `${b.id}: first surah not on page ${first}`);
  for (let i = 1; i < b.toc.length; i++) assert.ok(b.toc[i].page > b.toc[i - 1].page, `${b.id}: pages not increasing`);
  assert.ok(b.toc.at(-1)!.page <= b.pages, `${b.id}: surah past the last page`);
}
assert.equal(BOOKS.filter((b) => b.group === "tafseer").flatMap((b) => b.toc!).length, 114, "not 114 surahs");
console.log(`ok: ${BOOKS.length} books`);
