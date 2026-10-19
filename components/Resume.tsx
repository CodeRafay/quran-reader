"use client";

import { useEffect, useState } from "react";
import { savedPage } from "../lib/progress";

export default function Resume({ id, pages, className }: { id: string; pages: number; className?: string }) {
  const [page, setPage] = useState<number | null>(null);
  useEffect(() => setPage(savedPage(id, pages)), [id, pages]);
  return page && page > 1 ? <span className={className}>Continue from page {page}</span> : null;
}
