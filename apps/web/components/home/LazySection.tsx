"use client";

import { type ReactNode } from "react";
import useInView from "../../hooks/useInView";

/**
 * Renders children only after the placeholder scrolls into view.
 * Uses a generous rootMargin so content loads slightly before the user reaches it.
 */
export default function LazySection({
  children,
  minHeight = 200,
  rootMargin = "400px",
}: {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ rootMargin });

  return (
    <div ref={ref} style={inView ? undefined : { minHeight }}>
      {inView ? children : null}
    </div>
  );
}
