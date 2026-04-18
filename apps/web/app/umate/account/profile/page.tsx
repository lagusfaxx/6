"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  ImageIcon,
  Loader2,
  Save,
} from "lucide-react";
import { apiFetch, getApiBase, resolveMediaUrl } from "../../../../lib/api";
import useMe from "../../../../hooks/useMe";

type CreatorFull = {
  id: string;
  status: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
};

export default function UmateProfileEditPage() {
  const { me } = useMe();
  const [creator, setCreator] = useState<CreatorFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<{ creator: CreatorFull }>("/umate/creator/me")
      .then((d) => {
        const cr = d?.creator || null;
        setCreator(cr);
        if (cr) {
          setDisplayName(cr.displayName || "");
          setBio(cr.bio || "");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${getApiBase()}/umate/creator/avatar`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.url) setCreator((prev) => (prev ? { ...prev, avatarUrl: json.url } : prev));
      }
    } catch {}
    setUploadingAvatar(false);
    if (avatarRef.current) avatarRef.current.value = "";
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${getApiBase()}/umate/creator/cover`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.url) setCreator((prev) => (prev ? { ...prev, coverUrl: json.url } : prev));
      }
    } catch {}
    setUploadingCover(false);
    if (coverRef.current) coverRef.current.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg(null);
    const res = await apiFetch<{ creator: CreatorFull }>("/umate/creator/profile", {
      method: "PUT",
      body: JSON.stringify({ displayName, bio }),
    }).catch(() => null);
    if (res?.creator) {
      setCreator((prev) => (prev ? { ...prev, ...res.creator } : res.creator));
      setSavedMsg("Cambios guardados.");
    } else {
      setSavedMsg("No se pudo guardar. Intenta de nuevo.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Perfil público</h1>
        <p className="mt-1 text-sm text-white/30">Cómo te ven tus fans en UZEED U-Mate.</p>
      </div>

      {/* Cover + avatar card */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.04] bg-white/[0.015]">
        <div className="relative h-36 bg-gradient-to-br from-[#00aff0]/10 via-purple-600/[0.05] to-transparent sm:h-44">
          {creator?.coverUrl && (
            <img
              src={resolveMediaUrl(creator.coverUrl) || ""}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a12]/80 to-transparent" />
          <button
            onClick={() => coverRef.current?.click()}
            disabled={uploadingCover}
            className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-xl bg-black/40 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-xl transition hover:bg-black/60 disabled:opacity-50"
          >
            {uploadingCover ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5" />
            )}
            {creator?.coverUrl ? "Cambiar portada" : "Agregar portada"}
          </button>
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleUploadCover} />
        </div>

        <div className="p-5">
          <div className="-mt-14 flex items-end gap-4">
            <div className="relative">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-[#0a0a12] bg-[#0a0a12] shadow-lg">
                {creator?.avatarUrl ? (
                  <img
                    src={resolveMediaUrl(creator.avatarUrl) || ""}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-white/[0.06] text-xl font-bold text-white/40">
                    {(creator?.displayName || "?")[0]}
                  </div>
                )}
              </div>
              <button
                onClick={() => avatarRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-r from-[#00aff0] to-[#0090d0] text-white shadow-md transition hover:shadow-lg disabled:opacity-50"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleUploadAvatar} />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h3 className="truncate text-base font-bold text-white">
                {creator?.displayName || "Tu nombre de creadora"}
              </h3>
              <p className="text-xs text-white/30">@{me?.user?.username || "—"}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Edit form */}
      <section className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5 space-y-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
            Nombre público
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tu nombre de creadora"
            className="mt-1 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/30"
          />
          <p className="mt-1 text-[10px] text-white/25">
            Es el nombre que ven tus fans. Puedes cambiarlo cuando quieras.
          </p>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/30">
            Descripción / Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Cuéntale a tus fans sobre ti..."
            rows={4}
            className="mt-1 w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none transition focus:border-[#00aff0]/30"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.25)] transition disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Guardar cambios
          </button>
          {savedMsg && <span className="text-xs text-white/50">{savedMsg}</span>}
        </div>
      </section>
    </div>
  );
}
