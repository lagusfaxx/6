"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";

type Category = {
  id: string;
  slug: string;
  name?: string;
  displayName?: string;
};

const FALLBACK_CATEGORIES: Array<{ slug: string; label: string }> = [
  { slug: "moteles", label: "Moteles" },
  { slug: "sexshop", label: "Sex Shop" },
  { slug: "escort", label: "Escort" },
  { slug: "masajes", label: "Masajes" },
];

export default function CategoryBar() {
  const [categories, setCategories] = useState<
    Array<{ slug: string; label: string }>
  >([]);

  useEffect(() => {
    apiFetch<Category[]>("/categories")
      .then((res) => {
        const mapped = (res || [])
          .map((item) => ({
            slug: String(item.slug || "")
              .trim()
              .toLowerCase(),
            label: item.displayName || item.name || item.slug,
          }))
          .filter((item) => Boolean(item.slug && item.label));

        setCategories(mapped.length ? mapped : FALLBACK_CATEGORIES);
      })
      .catch(() => setCategories(FALLBACK_CATEGORIES));
  }, []);

  const items = categories.length ? categories : FALLBACK_CATEGORIES;

  return (
    <div className="w-full border-b border-white/10 bg-black/25 backdrop-blur-xl">
      <div className="scrollbar-none mx-auto flex max-w-6xl gap-2 overflow-x-auto px-3 py-2 md:px-5">
        {items.map((category) => (
          <Link
            key={category.slug}
            href={`/explore?category=${encodeURIComponent(category.slug)}`}
            className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/85 transition hover:border-fuchsia-300/50 hover:bg-fuchsia-500/15"
          >
            {category.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
