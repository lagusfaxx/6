"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type HeaderCategory = "all" | "moteles" | "sex-shop" | "escorts" | "masajes" | "trans" | "maduras";

type CategoryFilterContextValue = {
  selectedCategory: HeaderCategory;
  setSelectedCategory: (category: HeaderCategory) => void;
};

const CategoryFilterContext = createContext<CategoryFilterContextValue | null>(null);

export function CategoryFilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState<HeaderCategory>("all");

  const value = useMemo(
    () => ({ selectedCategory, setSelectedCategory }),
    [selectedCategory],
  );

  return <CategoryFilterContext.Provider value={value}>{children}</CategoryFilterContext.Provider>;
}

export function useCategoryFilter() {
  const ctx = useContext(CategoryFilterContext);
  if (!ctx) {
    throw new Error("useCategoryFilter must be used within CategoryFilterProvider");
  }
  return ctx;
}
