"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import {
  ArrowLeft,
  Search,
  X,
  Loader2,
  Send,
  Eye,
  Users,
  UserCheck,
  Briefcase,
  Star,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Mail,
  GripVertical,
} from "lucide-react";

type ProfileResult = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  city: string | null;
  primaryCategory: string | null;
  profileType: string;
  tier: string | null;
  isVerified: boolean;
};

type SendResult = {
  sent: number;
  failed: number;
  total: number;
};

export default function WeeklyHighlightsPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(
    () => (user?.role ?? "").toUpperCase() === "ADMIN",
    [user?.role],
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<ProfileResult[]>([]);
  const [audience, setAudience] = useState<"clients" | "professionals" | "both">("both");
  const [subject, setSubject] = useState("Destacadas de la semana — UZEED");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const searchProfiles = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await apiFetch<{ profiles: ProfileResult[] }>(
          `/admin/weekly-highlights/search-profiles?q=${encodeURIComponent(q)}`,
        );
        setSearchResults(
          res.profiles.filter(
            (p) => !selectedProfiles.some((s) => s.id === p.id),
          ),
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [selectedProfiles],
  );

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchProfiles(searchQuery), 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, searchProfiles]);

  const addProfile = (profile: ProfileResult) => {
    if (selectedProfiles.length >= 4) return;
    if (selectedProfiles.some((p) => p.id === profile.id)) return;
    setSelectedProfiles((prev) => [...prev, profile]);
    setSearchResults((prev) => prev.filter((p) => p.id !== profile.id));
    setSearchQuery("");
    setPreviewHtml(null);
    setSendResult(null);
  };

  const removeProfile = (id: string) => {
    setSelectedProfiles((prev) => prev.filter((p) => p.id !== id));
    setPreviewHtml(null);
    setSendResult(null);
  };

  const moveProfile = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= selectedProfiles.length) return;
    setSelectedProfiles((prev) => {
      const copy = [...prev];
      [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
      return copy;
    });
    setPreviewHtml(null);
  };

  const generatePreview = async () => {
    if (selectedProfiles.length === 0) return;
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await apiFetch<{ html: string }>("/admin/weekly-highlights/preview", {
        method: "POST",
        body: JSON.stringify({
          profileIds: selectedProfiles.map((p) => p.id),
          subject: subject || undefined,
        }),
      });
      setPreviewHtml(res.html);
      setShowPreview(true);
    } catch (err: any) {
      setError(err?.message || "Error al generar preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const sendEmail = async () => {
    if (selectedProfiles.length === 0) return;
    if (!confirm(`¿Enviar correo a ${audience === "clients" ? "clientes" : audience === "professionals" ? "profesionales" : "todos"}?`)) return;
    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const res = await apiFetch<SendResult>("/admin/weekly-highlights/send", {
        method: "POST",
        body: JSON.stringify({
          profileIds: selectedProfiles.map((p) => p.id),
          subject: subject || undefined,
          audience,
        }),
      });
      setSendResult(res);
    } catch (err: any) {
      setError(err?.message || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">
        Cargando...
      </div>
    );
  if (!user || !isAdmin)
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">
        Acceso restringido.
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-[#0a0b14]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
        <Link
          href="/admin"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-white/50" />
        </Link>
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-5 w-5 text-fuchsia-400" />
            Correo Semanal
          </h1>
          <p className="text-[11px] text-white/30">
            Destacadas de la semana
          </p>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-5 max-w-5xl mx-auto space-y-6">
        {/* Error/Success Messages */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {sendResult && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-300">
              Correo enviado: <strong>{sendResult.sent}</strong> exitosos
              {sendResult.failed > 0 && (
                <>, <span className="text-red-300">{sendResult.failed} fallidos</span></>
              )}
              {" "}de {sendResult.total} destinatarios.
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Left Column: Configuration ── */}
          <div className="space-y-5">
            {/* Subject */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">
                Asunto del correo
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setPreviewHtml(null);
                }}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-fuchsia-500/30 transition-colors"
                placeholder="Destacadas de la semana — UZEED"
              />
            </div>

            {/* Audience Selector */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-3">
                Audiencia
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "clients" as const, label: "Clientes", icon: Users, desc: "Solo clientes" },
                  { value: "professionals" as const, label: "Profesionales", icon: Briefcase, desc: "Solo profesionales" },
                  { value: "both" as const, label: "Todos", icon: UserCheck, desc: "Ambos grupos" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAudience(opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                      audience === opt.value
                        ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300"
                        : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04] hover:text-white/60"
                    }`}
                  >
                    <opt.icon className="h-5 w-5" />
                    <span className="text-[12px] font-semibold">{opt.label}</span>
                    <span className="text-[10px] opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Profile Search */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">
                Seleccionar perfiles ({selectedProfiles.length}/4)
              </label>

              {selectedProfiles.length < 4 && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-fuchsia-500/30 transition-colors"
                    placeholder="Buscar por nombre, usuario o ciudad..."
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fuchsia-400 animate-spin" />
                  )}
                </div>
              )}

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="mb-3 max-h-[240px] overflow-y-auto rounded-lg border border-white/[0.08] bg-[#0d0e1a] divide-y divide-white/[0.04]">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProfile(p)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <img
                        src={resolveMediaUrl(p.avatarUrl) || "/brand/isotipo-new.png"}
                        alt=""
                        className="h-9 w-9 rounded-lg object-cover border border-white/10 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-white/80 truncate">
                          {p.displayName || p.username}
                          {p.isVerified && (
                            <CheckCircle className="inline h-3 w-3 ml-1 text-fuchsia-400" />
                          )}
                        </p>
                        <p className="text-[11px] text-white/30 truncate">
                          @{p.username}
                          {p.city && ` · ${p.city}`}
                          {p.primaryCategory && ` · ${p.primaryCategory}`}
                        </p>
                      </div>
                      {p.tier && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                            p.tier === "PREMIUM"
                              ? "bg-fuchsia-500/20 text-fuchsia-300"
                              : p.tier === "GOLD"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-white/[0.06] text-white/40"
                          }`}
                        >
                          {p.tier}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Profiles */}
              {selectedProfiles.length > 0 && (
                <div className="space-y-2">
                  {selectedProfiles.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-fuchsia-500/15 bg-fuchsia-500/[0.04] px-3 py-2.5"
                    >
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => moveProfile(idx, -1)}
                          disabled={idx === 0}
                          className="text-white/20 hover:text-white/50 disabled:opacity-20 transition-colors"
                        >
                          <GripVertical className="h-3 w-3 rotate-180" />
                        </button>
                        <button
                          onClick={() => moveProfile(idx, 1)}
                          disabled={idx === selectedProfiles.length - 1}
                          className="text-white/20 hover:text-white/50 disabled:opacity-20 transition-colors"
                        >
                          <GripVertical className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-500/20 text-[11px] font-bold text-fuchsia-300 shrink-0">
                        {idx + 1}
                      </span>
                      <img
                        src={resolveMediaUrl(p.avatarUrl) || "/brand/isotipo-new.png"}
                        alt=""
                        className="h-9 w-9 rounded-lg object-cover border border-fuchsia-500/20 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-white/80 truncate">
                          {p.displayName || p.username}
                        </p>
                        <p className="text-[11px] text-white/30 truncate">
                          {p.city && (
                            <span className="inline-flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {p.city}
                            </span>
                          )}
                          {p.primaryCategory && ` · ${p.primaryCategory}`}
                        </p>
                      </div>
                      <button
                        onClick={() => removeProfile(p.id)}
                        className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedProfiles.length === 0 && searchResults.length === 0 && (
                <div className="text-center py-8">
                  <Star className="h-8 w-8 text-white/10 mx-auto mb-2" />
                  <p className="text-[13px] text-white/25">
                    Busca y selecciona hasta 4 perfiles destacados
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={generatePreview}
                disabled={selectedProfiles.length === 0 || loadingPreview}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {loadingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Previsualizar
              </button>
              <button
                onClick={sendEmail}
                disabled={selectedProfiles.length === 0 || sending}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 py-3 text-sm font-bold text-white hover:from-fuchsia-500 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar correo
              </button>
            </div>
          </div>

          {/* ── Right Column: Preview ── */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-fuchsia-400/60" />
                <h3 className="text-sm font-semibold">Preview del correo</h3>
              </div>
              {previewHtml && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-[11px] text-fuchsia-400/60 hover:text-fuchsia-400 transition-colors"
                >
                  {showPreview ? "Ocultar" : "Mostrar"}
                </button>
              )}
            </div>

            {previewHtml && showPreview ? (
              <div className="p-4">
                <div className="rounded-lg overflow-hidden border border-white/[0.06]">
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full border-0"
                    style={{ minHeight: "600px", background: "#070816" }}
                    title="Preview del correo semanal"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <Mail className="h-12 w-12 text-white/[0.06] mb-3" />
                <p className="text-[13px] text-white/25 max-w-[240px]">
                  {selectedProfiles.length === 0
                    ? "Selecciona perfiles y haz clic en Previsualizar para ver el correo"
                    : "Haz clic en Previsualizar para generar el correo"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
