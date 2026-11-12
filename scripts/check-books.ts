// Sanity check for the catalog: node scripts/check-books.ts
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { BOOKS, SPECIAL_LINKS, findSurahs } from "../lib/books.ts";

assert.equal(new Set(BOOKS.map((b) => b.id)).size, BOOKS.length, "duplicate book ids");
for (const b of BOOKS) {
  assert.ok(existsSync(`public${b.file}`), `missing ${b.file}`);
  assert.ok(existsSync(`public${b.cover}`), `missing ${b.cover}`);
  if (b.juz) {
    assert.equal(b.juz.length, 30, `${b.id}: not 30 juz`);
    for (let i = 1; i < 30; i++) assert.ok(b.juz[i].page > b.juz[i - 1].page, `${b.id}: juz pages not increasing`);
    assert.ok(b.juz[29].page <= b.pages, `${b.id}: juz past the last page`);
  }
  for (const e of b.special ?? []) assert.ok(e.page >= 1 && e.page <= b.pages, `${b.id}: ${e.title} off the book`);
  if (!b.toc) continue;
  // each manzil starts on a fresh surah page; manzil 1 also carries the 22 front-matter pages
  const first = b.id === "tafseer-manzil-1" ? 23 : 1;
  assert.equal(b.toc[0].page, first, `${b.id}: first surah not on page ${first}`);
  for (let i = 1; i < b.toc.length; i++) assert.ok(b.toc[i].page > b.toc[i - 1].page, `${b.id}: pages not increasing`);
  assert.ok(b.toc.at(-1)!.page <= b.pages, `${b.id}: surah past the last page`);
}
assert.equal(BOOKS.filter((b) => b.group === "tafseer").flatMap((b) => b.toc!).length, 114, "not 114 surahs");
assert.equal(SPECIAL_LINKS.length, 8);
assert.deepEqual(
  BOOKS.filter((b) => b.group === "tafseer").flatMap((b) => b.special!.map((e) => e.title)),
  SPECIAL_LINKS.map((l) => l.title),
  "tafseer must carry each special surah once, in order",
);
// tafseer special pages are the surah's own toc page
const kahf = BOOKS.find((b) => b.id === "tafseer-manzil-4")!.special![0];
assert.equal(`/read/tafseer-manzil-4?page=${kahf.page}`, findSurahs("18")[0].href);
assert.equal(findSurahs("yasin")[0].href, "/read/tafseer-manzil-5?page=222");
assert.deepEqual(findSurahs("36"), findSurahs("Ya-Sin"));
assert.equal(findSurahs("al imran")[0].href, "/read/tafseer-manzil-1?page=145");
assert.equal(findSurahs("114")[0].title, "114. An-Nas");
for (const q of ["", " ", "zzz", "0", "115"]) assert.deepEqual(findSurahs(q), [], `"${q}" should find nothing`);
console.log(`ok: ${BOOKS.length} books`);
