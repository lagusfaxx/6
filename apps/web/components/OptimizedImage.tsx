"use client";

import Image from "next/image";
import { resolveMediaUrl } from "../lib/api";

type OptimizedImageProps = {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
  sizes?: string;
  quality?: number;
  onError?: () => void;
};

/**
 * Optimized image component using next/image.
 * Automatically resolves media URLs and applies WebP/AVIF conversion.
 * Falls back to a placeholder when src is missing.
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill,
  priority = false,
  className,
  style,
  sizes,
  quality = 75,
  onError,
}: OptimizedImageProps) {
  const resolved = resolveMediaUrl(src);

  if (!resolved) {
    return (
      <div
        className={`bg-gradient-to-br from-fuchsia-900/20 to-violet-900/20 flex items-center justify-center ${className || ""}`}
        style={style}
      >
        <img src="/brand/isotipo-new.png" alt="" className="h-12 w-12 opacity-20" />
      </div>
    );
  }

  // External URLs (from API uploads) go through next/image optimization
  const isExternal = resolved.startsWith("http");

  if (!isExternal) {
    // Local static assets — use next/image with local path
    return (
      <Image
        src={resolved}
        alt={alt}
        width={fill ? undefined : (width || 400)}
        height={fill ? undefined : (height || 400)}
        fill={fill}
        priority={priority}
        className={className}
        style={style}
        sizes={sizes}
        quality={quality}
        onError={onError}
      />
    );
  }

  return (
    <Image
      src={resolved}
      alt={alt}
      width={fill ? undefined : (width || 400)}
      height={fill ? undefined : (height || 400)}
      fill={fill}
      priority={priority}
      className={className}
      style={style}
      sizes={sizes}
      quality={quality}
      unoptimized={false}
      onError={onError}
    />
  );
}
