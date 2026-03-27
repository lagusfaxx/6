"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Camera, Check, Loader2 } from "lucide-react";

import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import Avatar from "../../../components/Avatar";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function ClientProfilePage() {
  const router = useRouter();
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentDisplayName = displayName ?? user?.displayName ?? "";
  const currentUsername = username ?? user?.username ?? "";
  const currentAvatarUrl = avatarPreview || resolveMediaUrl(user?.avatarUrl) || null;

  const hasChanges =
    (displayName !== null && displayName !== (user?.displayName ?? "")) ||
    (username !== null && username !== (user?.username ?? ""));

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);

    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiFetch<{ user: any }>("/profile/avatar", {
        method: "POST",
        body: formData,
      });
      setSuccess("Foto de perfil actualizada");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.body?.message || "Error al subir la imagen");
      setAvatarPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!hasChanges) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const body: Record<string, string> = {};
    if (displayName !== null) body.displayName = displayName;
    if (username !== null) body.username = username;

    try {
      await apiFetch("/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setSuccess("Perfil actualizado correctamente");
      setDisplayName(null);
      setUsername(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const msg =
        err?.body?.message ||
        (err?.message === "P2002"
          ? "Ese nombre de usuario ya est\u00e1 en uso"
          : "Error al guardar los cambios");
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 pb-10">
        <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
        <div className="h-32 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 pb-10">
      <motion.div initial="hidden" animate="visible" className="space-y-5">
        {/* Header */}
        <motion.div custom={0} variants={fadeUp} className="flex items-center gap-3">
          <button
            onClick={() => router.push("/cuenta")}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Editar perfil</h1>
            <p className="text-xs text-white/40">Cambia tu foto y nombre de usuario</p>
          </div>
        </motion.div>

        {/* Avatar section */}
        <motion.div
          custom={1}
          variants={fadeUp}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-6"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />

          <h2 className="mb-4 text-sm font-semibold text-white/50">Foto de perfil</h2>

          <div className="flex items-center gap-5">
            <div className="relative group">
              <div
                className="rounded-full p-[3px]"
                style={{
                  background: "linear-gradient(135deg, rgba(139,92,246,0.5), rgba(217,70,239,0.5))",
                  boxShadow: "0 0 20px rgba(139,92,246,0.25)",
                }}
              >
                <Avatar
                  src={currentAvatarUrl}
                  alt={currentDisplayName || currentUsername}
                  size={88}
                  className="border-[3px] border-[#0e0e12]"
                />
              </div>

              <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploading ? (
                  <Loader2 className="h-5 w-5 text-white/80 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white/80" />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            <div>
              <label className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/60 cursor-pointer hover:bg-white/[0.06] transition">
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Camera className="h-3.5 w-3.5" />
                    Cambiar foto
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </label>
              <p className="mt-1.5 text-[11px] text-white/30">JPG o PNG, max 10 MB</p>
            </div>
          </div>
        </motion.div>

        {/* Name & username section */}
        <motion.div
          custom={2}
          variants={fadeUp}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-6"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

          <h2 className="mb-4 text-sm font-semibold text-white/50">Informaci&oacute;n personal</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-xs font-medium text-white/50 mb-1.5">
                Nombre visible
              </label>
              <input
                id="displayName"
                type="text"
                value={currentDisplayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tu nombre"
                maxLength={50}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-fuchsia-500/40 focus:bg-white/[0.05]"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-xs font-medium text-white/50 mb-1.5">
                Nombre de usuario
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/30">@</span>
                <input
                  id="username"
                  type="text"
                  value={currentUsername}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9._-]/g, "")
                    )
                  }
                  placeholder="usuario"
                  maxLength={30}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-8 pr-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-fuchsia-500/40 focus:bg-white/[0.05]"
                />
              </div>
              <p className="mt-1 text-[11px] text-white/30">
                Solo letras min&uacute;sculas, n&uacute;meros, puntos y guiones
              </p>
            </div>
          </div>

          {/* Save button */}
          <div className="mt-5">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-sm font-medium text-white transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </span>
              ) : (
                "Guardar cambios"
              )}
            </button>
          </div>
        </motion.div>

        {/* Feedback messages */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/[0.06] px-4 py-3 text-sm text-green-400"
          >
            <Check className="h-4 w-4 shrink-0" />
            {success}
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-400"
          >
            {error}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
