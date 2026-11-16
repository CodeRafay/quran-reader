"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBook, type Book } from "../lib/books";
import { savedLast, savedPage } from "../lib/progress";

export default function ContinueReading({ className }: { className?: string }) {
  const [last, setLast] = useState<{ book: Book; page: number } | null>(null);
  // Read after mount: the server render can't see storage.
  useEffect(() => {
    const book = getBook(savedLast() ?? ""); // a stale or hand-edited id finds nothing
    const page = book && savedPage(book.id, book.pages);
    if (book && page) setLast({ book, page });
  }, []);
  if (!last) return null;
  const { book, page } = last;
  return (
    // the reader opens on the saved page by itself
    <Link href={`/read/${book.id}`} className={className}>
      Continue {book.group === "tafseer" ? `Tafseer, ${book.title}` : book.title} · page {page}
    </Link>
  );
}
