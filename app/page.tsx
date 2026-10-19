import Link from "next/link";
import { BOOKS, type Book } from "../lib/books";
import Resume from "../components/Resume";
import s from "./page.module.css";

function Shelf({ id, title, intro, books }: { id: string; title: string; intro?: string; books: Book[] }) {
  return (
    <section className={s.shelf} aria-labelledby={id}>
      <h2 id={id} className={s.shelfTitle}>
        {title}
      </h2>
      {intro && <p className={s.intro}>{intro}</p>}
      <ul className={s.grid}>
        {books.map((b) => (
          <li key={b.id}>
            <Link href={`/read/${b.id}`} className={s.card}>
              <span className={s.frame}>
                <img src={b.cover} alt="" loading="lazy" decoding="async" />
              </span>
              <span className={s.titleAr} lang="ar" dir="rtl">
                {b.titleAr}
              </span>
              <span className={s.title}>{b.title}</span>
              <span className={s.note}>{b.note}</span>
              <Resume id={b.id} pages={b.pages} className={s.resume} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Library() {
  return (
    <>
      <header className={s.hero}>
        <p className={s.basmala} lang="ar" dir="rtl">
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>
        <h1 className={s.name}>Quran Reader</h1>
        <p className={s.lede}>Read the Quran and its Urdu tafseer page by page, on any device.</p>
      </header>
      <main className={s.main}>
        <Shelf id="quran" title="Quran" books={BOOKS.filter((b) => b.group === "quran")} />
        <Shelf
          id="tafseer"
          title="Tafseer in Urdu"
          intro="Urdu translation by Maulana Muhammad Junagarhi with tafseer notes by Maulana Salahuddin Yusuf, printed by the King Fahd Complex. Divided into the seven manzils."
          books={BOOKS.filter((b) => b.group === "tafseer")}
        />
      </main>
    </>
  );
}
