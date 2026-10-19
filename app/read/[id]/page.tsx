import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BOOKS, getBook } from "../../../lib/books";
import Reader from "../../../components/Reader";

type Props = { params: Promise<{ id: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return BOOKS.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const book = getBook((await params).id);
  return { title: book ? `${book.group === "tafseer" ? "Tafseer " : ""}${book.title} – Quran Reader` : "Quran Reader" };
}

export default async function ReadPage({ params }: Props) {
  const book = getBook((await params).id);
  if (!book) notFound();
  return <Reader book={book} />;
}
