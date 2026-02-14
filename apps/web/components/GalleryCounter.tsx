import { Image } from "lucide-react";

export default function GalleryCounter({ count }: { count: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm">
      <Image size={14} />
      <span>{count} {count === 1 ? "foto" : "fotos"}</span>
    </div>
  );
}
