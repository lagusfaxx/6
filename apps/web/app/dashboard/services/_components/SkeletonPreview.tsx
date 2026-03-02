"use client";

export default function SkeletonPreview() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Cover */}
      <div className="h-40 rounded-2xl bg-white/[0.04]" />

      {/* Avatar + name */}
      <div className="flex items-center gap-3 px-4 -mt-6">
        <div className="h-16 w-16 rounded-full bg-white/[0.06] border-2 border-white/[0.08] shrink-0" />
        <div className="space-y-2 pt-6">
          <div className="h-4 w-32 rounded bg-white/[0.05]" />
          <div className="h-3 w-24 rounded bg-white/[0.04]" />
        </div>
      </div>

      {/* Bio */}
      <div className="mx-4 space-y-2">
        <div className="h-3 w-full rounded bg-white/[0.04]" />
        <div className="h-3 w-3/4 rounded bg-white/[0.04]" />
      </div>

      {/* Gallery */}
      <div className="mx-4 grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}
