export type TocEntry = { title: string; page: number };

export type Book = {
  id: string;
  title: string;
  titleAr: string;
  note: string;
  group: "quran" | "tafseer";
  file: string;
  cover: string;
  pages: number;
  toc?: TocEntry[]; // only for books whose PDF has no bookmarks
};

// [name, start page in the printed tafseer] from its surah index (book pp. 1762–1765)
const SURAHS: [string, number][] = [
  ["Al-Fatiha", 1], ["Al-Baqarah", 7], ["Al-Imran", 123], ["An-Nisa", 193], ["Al-Ma'idah", 270],
  ["Al-An'am", 326], ["Al-A'raf", 389], ["Al-Anfal", 458], ["At-Tawbah", 484], ["Yunus", 538],
  ["Hud", 575], ["Yusuf", 616], ["Ar-Ra'd", 654], ["Ibrahim", 672], ["Al-Hijr", 690],
  ["An-Nahl", 706], ["Al-Isra", 744], ["Al-Kahf", 777], ["Maryam", 811], ["Ta-Ha", 832],
  ["Al-Anbiya", 861], ["Al-Hajj", 889], ["Al-Mu'minun", 918], ["An-Nur", 942], ["Al-Furqan", 971],
  ["Ash-Shu'ara", 992], ["An-Naml", 1024], ["Al-Qasas", 1049], ["Al-Ankabut", 1080], ["Ar-Rum", 1104],
  ["Luqman", 1123], ["As-Sajdah", 1136], ["Al-Ahzab", 1145], ["Saba", 1177], ["Fatir", 1197],
  ["Ya-Sin", 1213], ["As-Saffat", 1231], ["Sad", 1254], ["Az-Zumar", 1272], ["Ghafir", 1297],
  ["Fussilat", 1324], ["Ash-Shura", 1342], ["Az-Zukhruf", 1360], ["Ad-Dukhan", 1379], ["Al-Jathiyah", 1388],
  ["Al-Ahqaf", 1398], ["Muhammad", 1412], ["Al-Fath", 1425], ["Al-Hujurat", 1438], ["Qaf", 1446],
  ["Adh-Dhariyat", 1456], ["At-Tur", 1466], ["An-Najm", 1475], ["Al-Qamar", 1485], ["Ar-Rahman", 1494],
  ["Al-Waqi'ah", 1505], ["Al-Hadid", 1516], ["Al-Mujadilah", 1528], ["Al-Hashr", 1538], ["Al-Mumtahanah", 1548],
  ["As-Saff", 1556], ["Al-Jumu'ah", 1561], ["Al-Munafiqun", 1565], ["At-Taghabun", 1569], ["At-Talaq", 1575],
  ["At-Tahrim", 1582], ["Al-Mulk", 1588], ["Al-Qalam", 1596], ["Al-Haqqah", 1605], ["Al-Ma'arij", 1612],
  ["Nuh", 1618], ["Al-Jinn", 1624], ["Al-Muzzammil", 1631], ["Al-Muddaththir", 1636], ["Al-Qiyamah", 1643],
  ["Al-Insan", 1648], ["Al-Mursalat", 1655], ["An-Naba", 1661], ["An-Nazi'at", 1667], ["Abasa", 1673],
  ["At-Takwir", 1678], ["Al-Infitar", 1682], ["Al-Mutaffifin", 1685], ["Al-Inshiqaq", 1690], ["Al-Buruj", 1694],
  ["At-Tariq", 1698], ["Al-A'la", 1701], ["Al-Ghashiyah", 1704], ["Al-Fajr", 1707], ["Al-Balad", 1712],
  ["Ash-Shams", 1715], ["Al-Layl", 1717], ["Ad-Duha", 1720], ["Ash-Sharh", 1722], ["At-Tin", 1724],
  ["Al-Alaq", 1726], ["Al-Qadr", 1729], ["Al-Bayyinah", 1731], ["Az-Zalzalah", 1734], ["Al-Adiyat", 1736],
  ["Al-Qari'ah", 1738], ["At-Takathur", 1740], ["Al-Asr", 1741], ["Al-Humazah", 1742], ["Al-Fil", 1744],
  ["Quraysh", 1746], ["Al-Ma'un", 1747], ["Al-Kawthar", 1749], ["Al-Kafirun", 1750], ["An-Nasr", 1751],
  ["Al-Masad", 1752], ["Al-Ikhlas", 1754], ["Al-Falaq", 1755], ["An-Nas", 1757],
];
const BOOK_TO_PDF = 22; // printed page 1 is PDF page 23 of the full tafseer

// [first surah, last surah, first PDF page of the full tafseer, pages in this manzil]
const MANZILS: [number, number, number, number][] = [
  [1, 4, 1, 291], [5, 9, 292, 268], [10, 16, 560, 206], [17, 25, 766, 248],
  [26, 36, 1014, 239], [37, 49, 1253, 215], [50, 114, 1468, 325],
];

const tafseer: Book[] = MANZILS.map(([from, to, start, pages], i) => ({
  id: `tafseer-manzil-${i + 1}`,
  title: `Manzil ${i + 1}`,
  titleAr: `منزل ${i + 1}`,
  note: `${SURAHS[from - 1][0]} to ${SURAHS[to - 1][0]}`,
  group: "tafseer",
  file: `/pdfs/tafseer-manzil-${i + 1}.pdf`,
  cover: `/covers/tafseer-manzil-${i + 1}.webp`,
  pages,
  toc: SURAHS.slice(from - 1, to).map(([name, bookPage], j) => ({
    title: `${from + j}. ${name}`,
    page: bookPage + BOOK_TO_PDF - start + 1,
  })),
}));

export const BOOKS: Book[] = [
  {
    id: "digital-quran",
    title: "Digital Quran",
    titleAr: "القرآن الكريم",
    note: "Madinah mushaf, tap a surah on page 1 to jump to it",
    group: "quran",
    file: "/pdfs/digital-quran.pdf",
    cover: "/covers/digital-quran.webp",
    pages: 620,
  },
  {
    id: "13-line-tajweed",
    title: "13-Line Quran with Tajweed",
    titleAr: "قرآن مجید",
    note: "Colour-coded tajweed rules, South Asian script",
    group: "quran",
    file: "/pdfs/13-line-tajweed.pdf",
    cover: "/covers/13-line-tajweed.webp",
    pages: 850,
  },
  ...tafseer,
];

export const getBook = (id: string) => BOOKS.find((b) => b.id === id);
