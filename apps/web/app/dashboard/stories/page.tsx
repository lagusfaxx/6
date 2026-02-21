"use client";

import { useRef, useState } from "react";
import { Upload, Film, Image as ImageIcon, Trash2, Clock } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type OwnStory = {
  id: string;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  expiresAt: string;
  createdAt: string;
};

export default function StoriesPage() {
  const { me } = useMe();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null);
  const [stories, setStories] = useState<OwnStory[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPreview({ url: objectUrl, type: file.type });
    setError(null);
    setSuccess(false);
  };

  const handleUpload = async () => {
    if (!fileRef.current?.files?.[0]) return;
    const file = fileRef.current.files[0];
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    setError(null);
    setSuccess(false);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiBase}/stories/upload`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error("UPLOAD_FAILED");
      setSuccess(true);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      loadMyStories();
    } catch {
      setError("No se pudo subir el story. Intenta nuevamente.");
    } finally {
      setUploading(false);
    }
  };

  const loadMyStories = async () => {
    try {
      // Fetch all active stories, filter by current user
      const data = await apiFetch<{ stories: Array<{ userId: string; stories: OwnStory[] }> }>("/stories/active");
      const userId = me?.user?.id;
      const mine = data.stories.find((g) => g.userId === userId);
      setStories(mine?.stories ?? []);
    } catch {
      setStories([]);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/stories/${id}`, { method: "DELETE" });
      setStories((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("No se pudo eliminar el story.");
    }
  };

  const timeLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expirado";
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${h}h ${m}m restantes`;
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Mis Stories</h1>
        <p className="text-sm text-white/50 mt-1">
          Sube fotos o videos que duran 24 horas. Se muestran en el carrusel de stories de la app.
        </p>
      </div>

      {/* Upload zone */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
        <div
          onClick={() => fileRef.current?.click()}
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] p-8 cursor-pointer hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 transition"
        >
          <div className="flex items-center gap-3 text-white/40">
            <ImageIcon className="h-6 w-6" />
            <span className="text-sm">+</span>
            <Film className="h-6 w-6" />
          </div>
          <p className="text-sm text-white/50 text-center">
            Arrastra aquí o haz clic para subir<br />
            <span className="text-xs text-white/30">Fotos o videos · máx 100 MB</span>
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Preview */}
        {preview && (
          <div className="rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-64 flex items-center justify-center">
            {preview.type.startsWith("video/") ? (
              <video src={preview.url} className="max-h-full max-w-full" controls muted />
            ) : (
              <img src={preview.url} alt="preview" className="max-h-full max-w-full object-contain" />
            )}
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">Story publicado con éxito. Dura 24 horas.</p>}

        <button
          onClick={handleUpload}
          disabled={!preview || uploading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-40 hover:brightness-110 transition"
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Subiendo…" : "Publicar story"}
        </button>
      </div>

      {/* My active stories */}
      {stories.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/70">Stories activos</h2>
          {stories.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="h-14 w-14 rounded-lg overflow-hidden bg-black flex-shrink-0">
                {s.mediaType === "VIDEO" ? (
                  <video src={resolveMediaUrl(s.mediaUrl) ?? undefined} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={resolveMediaUrl(s.mediaUrl) ?? undefined} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{s.mediaType === "VIDEO" ? "Video" : "Foto"}</p>
                <p className="flex items-center gap-1 text-[11px] text-white/40 mt-0.5">
                  <Clock className="h-3 w-3" /> {timeLeft(s.expiresAt)}
                </p>
              </div>
              <button
                onClick={() => handleDelete(s.id)}
                className="flex-shrink-0 rounded-lg p-2 text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
