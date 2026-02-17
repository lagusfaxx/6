"use client";

import { Star } from "lucide-react";
import { motion } from "framer-motion";

type StarRatingProps = {
  rating: number | null;
  maxStars?: number;
  size?: number;
  showNumber?: boolean;
  animated?: boolean;
  className?: string;
};

export default function StarRating({
  rating,
  maxStars = 5,
  size = 16,
  showNumber = true,
  animated = false,
  className = ""
}: StarRatingProps) {
  const validRating = rating ?? 0;
  const fullStars = Math.floor(validRating);
  const hasHalfStar = validRating % 1 >= 0.5;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxStars }).map((_, i) => {
          const StarIcon = animated ? motion(Star) : Star;
          const isFilled = i < fullStars;
          const isHalf = i === fullStars && hasHalfStar;

          return (
            <StarIcon
              key={i}
              size={size}
              className={`${
                isFilled || isHalf
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-white/20"
              } ${animated ? "transition-all" : ""}`}
              {...(animated && {
                initial: { scale: 0, rotate: -180 },
                animate: { scale: 1, rotate: 0 },
                transition: { delay: i * 0.05, duration: 0.3 }
              })}
            />
          );
        })}
      </div>
      {showNumber && (
        <span className="text-sm font-medium text-white/80">
          {rating?.toFixed(1) ?? "N/A"}
        </span>
      )}
    </div>
  );
}
