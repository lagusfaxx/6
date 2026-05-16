"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch, getApiBase } from "../../../lib/api";
import {
  ArrowLeft,
  Loader2,
  Send,
  Mail,
  CheckCircle,
  AlertTriangle,
  Users,
  Briefcase,
  UserCheck,
  Image as ImageIcon,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Trash2,
  Copy,
  X,
  Megaphone,
} from "lucide-react";

type AudienceCounts = {
  professionals: number;
  clients: number;
  all: number;
};

type Audience = "professionals" | "clients" | "all";

type SendResult = {
  ok: boolean;
  mode: "test" | "campaign";
  sentTo?: string;
  total?: number;
  sent?: number;
  failed?: number;
};

type UploadedImage = {
  url: string;
  uploadedAt: number;
};

const DEFAULT_BODY = `<p>Hola,</p>
<p>Tenemos novedades para compartir contigo. Te invitamos a revisar las nuevas funciones y a aprovechar las oportunidades activas en UZEED.</p>
<p>Si tienes dudas, escribenos a soporte@uzeed.cl.</p>`;

export default function EmailCampaignPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(
    () => (user?.role ?? "").toUpperCase() === "ADMIN",
    [user?.role],
  );

  const [subject, setSubject] = useState("Novedades en UZEED");
  const [title, setTitle] = useState("Novedades en UZEED");
  const [bodyHtml, setBodyHtml] = useState(DEFAULT_BODY);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [headerImageUrl, setHeaderImageUrl] = useState("");
  const [audience, setAudience] = useState<Audience>("professionals");
  const [testEmail, setTestEmail] = useState("");

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingHeader, setUploadingHeader] = useState(false);

  const [counts, setCounts] = useState<AudienceCounts | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  const loadCounts = async () => {
    try {
      const res = await apiFetch<AudienceCounts>(
        "/admin/email-campaign/audience-counts",
      );
      setCounts(res);
    } catch (err: any) {
      setError(err?.message || "Error al cargar audiencia");
    }
  };

  useEffect(() => {
    if (isAdmin) loadCounts();
  }, [isAdmin]);

  // Reset preview whenever the message changes
  useEffect(() => {
    setPreviewHtml(null);
  }, [title, bodyHtml, ctaLabel, ctaUrl, headerImageUrl]);

  const uploadImage = async (
    file: File,
    target: "body" | "header",
  ): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imagenes");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("La imagen supera el limite de 10MB");
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);

    if (target === "header") setUploadingHeader(true);
    else setUploading(true);
    setError(null);

    try {
      const res = await fetch(
        `${getApiBase()}/admin/email-campaign/upload-image`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP_${res.status}`);
      }
      const data = (await res.json()) as { url: string };
      return data.url;
    } catch (err: any) {
      setError(err?.message || "Error al subir imagen");
      return null;
    } finally {
      if (target === "header") setUploadingHeader(false);
      else setUploading(false);
    }
  };

  const onSelectBodyImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadImage(file, "body");
    if (!url) return;

    setUploadedImages((prev) => [{ url, uploadedAt: Date.now() }, ...prev]);
    insertAtCursor(
      `\n<img src="${url}" alt="" style="display:block;max-width:100%;height:auto;margin:12px auto;border-radius:12px;" />\n`,
    );
  };

  const onSelectHeaderImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadImage(file, "header");
    if (!url) return;
    setHeaderImageUrl(url);
  };

  const insertAtCursor = (text: string) => {
    const el = bodyRef.current;
    if (!el) {
      setBodyHtml((b) => b + text);
      return;
    }
    const start = el.selectionStart ?? bodyHtml.length;
    const end = el.selectionEnd ?? bodyHtml.length;
    const next = bodyHtml.slice(0, start) + text + bodyHtml.slice(end);
    setBodyHtml(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  };

  const insertSnippet = (snippet: string) => insertAtCursor(snippet);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const generatePreview = async () => {
    if (!title.trim() || !bodyHtml.trim()) {
      setError("Completa titulo y contenido");
      return;
    }
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await apiFetch<{ html: string }>(
        "/admin/email-campaign/preview",
        {
          method: "POST",
          body: JSON.stringify({
            title,
            bodyHtml,
            ctaLabel: ctaLabel || undefined,
            ctaUrl: ctaUrl || undefined,
            headerImageUrl: headerImageUrl || undefined,
          }),
        },
      );
      setPreviewHtml(res.html);
      setShowPreview(true);
    } catch (err: any) {
      setError(err?.message || "Error al generar preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const sendTest = async () => {
    const trimmed = testEmail.trim();
    if (!trimmed) {
      setError("Ingresa un correo para la prueba");
      return;
    }
    if (!title.trim() || !bodyHtml.trim() || !subject.trim()) {
      setError("Completa asunto, titulo y contenido");
      return;
    }
    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const res = await apiFetch<SendResult>("/admin/email-campaign/send", {
        method: "POST",
        body: JSON.stringify({
          subject,
          title,
          bodyHtml,
          ctaLabel: ctaLabel || undefined,
          ctaUrl: ctaUrl || undefined,
          headerImageUrl: headerImageUrl || undefined,
          testEmail: trimmed,
        }),
      });
      setSendResult(res);
    } catch (err: any) {
      setError(err?.message || "Error al enviar prueba");
    } finally {
      setSending(false);
    }
  };

  const sendCampaign = async () => {
    if (!title.trim() || !bodyHtml.trim() || !subject.trim()) {
      setError("Completa asunto, titulo y contenido");
      return;
    }
    const audienceLabel =
      audience === "professionals"
        ? "profesionales"
        : audience === "clients"
          ? "clientes"
          : "todos los usuarios";
    const count =
      audience === "professionals"
        ? counts?.professionals
        : audience === "clients"
          ? counts?.clients
          : counts?.all;
    if (
      !confirm(
        `Vas a enviar este correo a ${count ?? "?"} ${audienceLabel}. Esta accion no se puede deshacer. Continuar?`,
      )
    )
      return;

    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const res = await apiFetch<SendResult>("/admin/email-campaign/send", {
        method: "POST",
        body: JSON.stringify({
          subject,
          title,
          bodyHtml,
          ctaLabel: ctaLabel || undefined,
          ctaUrl: ctaUrl || undefined,
          headerImageUrl: headerImageUrl || undefined,
          audience,
        }),
      });
      setSendResult(res);
    } catch (err: any) {
      setError(err?.message || "Error al enviar campana");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">
        Cargando...
      </div>
    );
  }
  if (!user || !isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">
        Acceso restringido.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white pb-12">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-[#0a0b14]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
        <Link
          href="/admin"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-white/50" />
        </Link>
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-fuchsia-400" />
            Campanas de correo
          </h1>
          <p className="text-[11px] text-white/30">
            Envia correos masivos con imagenes a profesionales o clientes
          </p>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-5 max-w-6xl mx-auto space-y-5">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400/60 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {sendResult && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm text-emerald-300 flex-1">
              {sendResult.mode === "test" ? (
                <>
                  Correo de prueba enviado a{" "}
                  <strong>{sendResult.sentTo}</strong>.
                </>
              ) : (
                <>
                  Campana enviada: <strong>{sendResult.sent ?? 0}</strong> ok
                  {typeof sendResult.failed === "number" &&
                    sendResult.failed > 0 && (
                      <>
                        {", "}
                        <span className="text-red-300">
                          {sendResult.failed} fallidos
                        </span>
                      </>
                    )}
                  {" "}de {sendResult.total ?? 0} destinatarios.
                </>
              )}
            </div>
            <button
              onClick={() => setSendResult(null)}
              className="text-emerald-400/60 hover:text-emerald-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          {/* ─── LEFT: Editor ─── */}
          <div className="space-y-5">
            {/* Subject + title */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">
                  Asunto (lo que se ve en la bandeja)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                  placeholder="Asunto del correo"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-fuchsia-500/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">
                  Titulo grande (header del correo)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="Titulo que aparece dentro del correo"
                  className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-fuchsia-500/30 transition-colors"
                />
              </div>
            </div>

            {/* Header image */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">
                Imagen destacada (opcional)
              </label>
              <p className="text-[12px] text-white/40 mb-3">
                Banner que se muestra arriba del contenido.
              </p>

              {headerImageUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={headerImageUrl}
                    alt="Header"
                    className="w-full max-h-48 object-cover rounded-lg border border-white/10"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHeaderImageUrl("")}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Quitar
                    </button>
                    <button
                      onClick={() => copyToClipboard(headerImageUrl)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copiedUrl === headerImageUrl ? "Copiado" : "Copiar URL"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => headerInputRef.current?.click()}
                  disabled={uploadingHeader}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-white/[0.02] px-4 py-6 text-sm text-white/50 hover:bg-white/[0.04] hover:text-white/80 transition-colors disabled:opacity-50"
                >
                  {uploadingHeader ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  Subir imagen destacada
                </button>
              )}
              <input
                ref={headerInputRef}
                type="file"
                accept="image/*"
                onChange={onSelectHeaderImage}
                className="hidden"
              />
            </div>

            {/* Body */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30">
                  Contenido HTML
                </label>
                <span className="text-[10px] text-white/30">
                  {bodyHtml.length}/100000
                </span>
              </div>
              <p className="text-[12px] text-white/40 mb-3">
                Acepta etiquetas HTML basicas como{" "}
                <code className="text-fuchsia-300/80">&lt;p&gt;</code>,{" "}
                <code className="text-fuchsia-300/80">&lt;strong&gt;</code>,{" "}
                <code className="text-fuchsia-300/80">&lt;a&gt;</code>,{" "}
                <code className="text-fuchsia-300/80">&lt;img&gt;</code>,{" "}
                <code className="text-fuchsia-300/80">&lt;br&gt;</code>.
              </p>

              {/* Toolbar */}
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-200 hover:bg-fuchsia-500/15 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                  Insertar imagen
                </button>
                <button
                  onClick={() => insertSnippet("<p></p>")}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08]"
                >
                  Parrafo
                </button>
                <button
                  onClick={() => insertSnippet("<strong></strong>")}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08]"
                >
                  Negrita
                </button>
                <button
                  onClick={() => insertSnippet("<br />")}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08]"
                >
                  Salto linea
                </button>
                <button
                  onClick={() =>
                    insertSnippet(
                      '<a href="https://uzeed.cl" style="color:#a855f7;">Texto del enlace</a>',
                    )
                  }
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.08]"
                >
                  Enlace
                </button>
              </div>

              <textarea
                ref={bodyRef}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={14}
                spellCheck={false}
                className="w-full rounded-lg border border-white/[0.08] bg-[#0d0e1a] px-3 py-2.5 text-[13px] text-white font-mono leading-relaxed placeholder:text-white/20 outline-none focus:border-fuchsia-500/30 transition-colors resize-y"
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={onSelectBodyImage}
                className="hidden"
              />

              {/* Uploaded images library */}
              {uploadedImages.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] text-white/40 mb-2">
                    Imagenes subidas (clic para copiar URL o re-insertar)
                  </p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {uploadedImages.map((img) => (
                      <div
                        key={img.url}
                        className="group relative rounded-lg overflow-hidden border border-white/[0.08] aspect-square bg-black/40"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-1">
                          <button
                            onClick={() =>
                              insertAtCursor(
                                `\n<img src="${img.url}" alt="" style="display:block;max-width:100%;height:auto;margin:12px auto;border-radius:12px;" />\n`,
                              )
                            }
                            className="rounded bg-fuchsia-500/80 text-white px-2 py-0.5 text-[10px] font-bold"
                          >
                            Insertar
                          </button>
                          <button
                            onClick={() => copyToClipboard(img.url)}
                            className="rounded bg-white/10 text-white px-2 py-0.5 text-[10px]"
                          >
                            {copiedUrl === img.url ? "Copiado" : "Copiar URL"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CTA Button */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">
                Boton de accion (opcional)
              </label>
              <div className="grid gap-2 sm:grid-cols-[1fr_1.5fr]">
                <input
                  type="text"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Texto del boton"
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-fuchsia-500/30 transition-colors"
                />
                <input
                  type="url"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="https://uzeed.cl/..."
                  className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-fuchsia-500/30 transition-colors"
                />
              </div>
              <p className="text-[11px] text-white/30 mt-2">
                <LinkIcon className="inline h-3 w-3 mr-1" />
                Si dejas alguno vacio, no se mostrara boton.
              </p>
            </div>

            {/* Test send */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-2">
                Enviar prueba antes del blast
              </label>
              <p className="text-[12px] text-white/40 mb-3">
                Recibe una copia para revisar el diseno en tu propio buzon.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="tu@correo.cl"
                  className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-fuchsia-500/30 transition-colors"
                />
                <button
                  onClick={sendTest}
                  disabled={sending || !testEmail.trim()}
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/[0.08] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Enviar prueba
                </button>
              </div>
            </div>

            {/* Audience + Send */}
            <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/[0.04] p-5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-fuchsia-300/70 mb-3">
                Destinatarios
              </label>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(
                  [
                    {
                      value: "professionals" as const,
                      label: "Profesionales",
                      icon: Briefcase,
                      count: counts?.professionals,
                    },
                    {
                      value: "clients" as const,
                      label: "Clientes",
                      icon: Users,
                      count: counts?.clients,
                    },
                    {
                      value: "all" as const,
                      label: "Todos",
                      icon: UserCheck,
                      count: counts?.all,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAudience(opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                      audience === opt.value
                        ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200"
                        : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.04] hover:text-white/60"
                    }`}
                  >
                    <opt.icon className="h-5 w-5" />
                    <span className="text-[12px] font-semibold">
                      {opt.label}
                    </span>
                    <span className="text-[10px] opacity-70">
                      {opt.count === undefined
                        ? "..."
                        : `${opt.count.toLocaleString()} activos`}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={sendCampaign}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-bold text-white hover:from-fuchsia-500 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Enviar campana ahora
              </button>
            </div>
          </div>

          {/* ─── RIGHT: Preview ─── */}
          <div className="lg:sticky lg:top-20 self-start">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-fuchsia-400/60" />
                  <h3 className="text-sm font-semibold">Preview del correo</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={generatePreview}
                    disabled={loadingPreview}
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
                  >
                    {loadingPreview ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                    Refrescar
                  </button>
                  {previewHtml && (
                    <button
                      onClick={() => setShowPreview((s) => !s)}
                      className="text-white/40 hover:text-white/70"
                    >
                      {showPreview ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {previewHtml && showPreview ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full border-0 bg-[#070816]"
                  style={{ minHeight: "640px" }}
                  title="Preview campana"
                  sandbox=""
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <Mail className="h-12 w-12 text-white/[0.06] mb-3" />
                  <p className="text-[13px] text-white/25 max-w-[260px]">
                    Pulsa Refrescar para ver como se vera el correo final.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 text-[11px] text-white/30 leading-relaxed">
              <p className="mb-1">
                Las imagenes se suben al CDN publico de UZEED para que los
                clientes de correo puedan mostrarlas sin restricciones.
              </p>
              <p>
                Los correos se envian uno por uno via Resend; al terminar veras
                el total enviado y fallidos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
