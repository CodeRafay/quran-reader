"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { findSurahs } from "../lib/books";
import s from "./SurahSearch.module.css";

export default function SurahSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const hits = findSurahs(q);
  return (
    <form
      role="search"
      className={s.search}
      onSubmit={(e) => {
        e.preventDefault();
        if (hits[0]) router.push(hits[0].href);
      }}
    >
      <label htmlFor="surah-search" className={s.label}>
        Find a surah
      </label>
      <input
        id="surah-search"
        type="search"
        className={s.input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Name or number, e.g. Ya-Sin or 36"
        autoComplete="off"
      />
      {hits.length > 0 && (
        <ul className={s.hits}>
          {hits.map((h) => (
            <li key={h.href}>
              <Link href={h.href} className={s.hit}>
                <span>{h.title}</span>
                <span className={s.manzil}>{h.manzil}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {/* always mounted so screen readers announce the change */}
      <p role="status" className={s.none}>
        {q.trim() && !hits.length ? "No surah found. Try its number (1 to 114)." : ""}
      </p>
    </form>
  );
}
