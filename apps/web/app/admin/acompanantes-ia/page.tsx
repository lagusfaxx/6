"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, CheckCircle2, Loader2, Plus, ShieldAlert, Trash2, Upload, X } from "lucide-react";
import useMe from "../../../hooks/useMe";
import { canOpenAdmin, isFullAdmin } from "../../../lib/adminAccess";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import { ACCESS_LABEL, apiErrorMessage, type Access, type Gender } from "../../../lib/aiCompanions";
import CompanionPortrait from "../../../components/ai-companions/CompanionPortrait";

type AdminCompanion = {
  id: string;
  slug: string;
  name: string;
  gender: Gender;
  age: number;
  tagline: string | null;
  bio: string | null;
  appearance: string;
  personality: string;
  personalities: string[];
  communicationStyle: string | null;
  roleplayNotes: string | null;
  interests: string[];
  avatarUrl: string | null;
  galleryUrls: string[];
  access: Access;
  unlockTokens: number;
  unlockDays: number;
  imageSeed: number;
  isActive: boolean;
  sortOrder: number;
  _count?: { chats: number; images: number };
};

type AdminList = {
  companions: AdminCompanion[];
  personalities: { key: string; label: string }[];
  providers: { chat: boolean; images: boolean; maxChatIntensity: string; maxImageIntensity: string };
};

type Flag = {
  id: string;
  source: string;
  reason: string;
  excerpt: string;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; username: string; email: string } | null;
  userFlagCount: number;
  companion: { id: string; name: string } | null;
};

type Prices = Record<string, number>;

const PRICE_LABELS: Record<string, string> = {
  ai_plan_premium_tokens: "Plan Premium (tokens)",
  ai_plan_vip_tokens: "Plan VIP (tokens)",
  ai_plan_days: "Duración de los planes (días)",
  ai_image_tokens: "Imagen (tokens)",
  ai_image_tokens_vip: "Imagen para VIP (tokens)",
};

const REASON_LABEL: Record<string, string> = {
  minors: "Menores",
  real_person: "Persona real",
  non_consent: "Sin consentimiento",
  prohibited: "Prohibido",
};

const EMPTY: Partial<AdminCompanion> = {
  name: "",
  gender: "FEMALE",
  age: 25,
  tagline: "",
  bio: "",
  appearance: "",
  personality: "romantica",
  personalities: ["romantica"],
  communicationStyle: "",
  roleplayNotes: "",
  interests: [],
  access: "FREE",
  unlockTokens: 0,
  unlockDays: 30,
  isActive: true,
  sortOrder: 0,
};

export default function AdminAiCompanionsPage() {
  const { me, loading } = useMe();
  const user = me?.user;
  const [tab, setTab] = useState<"catalog" | "flags" | "prices">("catalog");
  const [list, setList] = useState<AdminList | null>(null);
  const [editing, setEditing] = useState<Partial<AdminCompanion> | null>(null);
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [msg, setMsg] = useState("");

  const loadList = useCallback(() => apiFetch<AdminList>("/admin/ai-companions").then(setList), []);
  const loadFlags = useCallback(() => apiFetch<{ flags: Flag[] }>("/admin/ai-companions-flags").then((r) => setFlags(r.flags)), []);

  useEffect(() => {
    if (!canOpenAdmin(user)) return;
    loadList().catch((e) => setMsg(apiErrorMessage(e)));
  }, [user, loadList]);

  useEffect(() => {
    if (tab === "flags" && flags === null) loadFlags().catch((e) => setMsg(apiErrorMessage(e)));
    if (tab === "prices" && prices === null) {
      apiFetch<{ prices: Prices }>("/admin/ai-companions-settings")
        .then((r) => setPrices(r.prices))
        .catch((e) => setMsg(apiErrorMessage(e)));
    }
  }, [tab, flags, prices, loadFlags]);

  if (loading) return null;
  if (!canOpenAdmin(user)) return <p className="p-8 text-white/60">Sin acceso.</p>;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Panel
      </Link>
      <h1 className="flex items-center gap-2 text-2xl font-black text-white">
        <Bot className="h-6 w-6 text-fuchsia-300" /> Acompañantes IA
      </h1>

      {list && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 ${list.providers.chat ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
            Chat IA: {list.providers.chat ? `configurado (máx. ${list.providers.maxChatIntensity})` : "sin configurar (AI_CHAT_*)"}
          </span>
          <span className={`rounded-full px-3 py-1 ${list.providers.images ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
            Imágenes: {list.providers.images ? `configurado (máx. ${list.providers.maxImageIntensity})` : "sin configurar (AI_IMAGE_*)"}
          </span>
        </div>
      )}

      <div className="mt-5 flex gap-2">
        {(
          [
            ["catalog", "Catálogo"],
            ["flags", "Bloqueos"],
            ...(isFullAdmin(user) ? ([["prices", "Precios"]] as const) : []),
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === key ? "bg-fuchsia-500 text-white" : "bg-white/5 text-white/60"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && <p className="mt-4 rounded-xl bg-amber-500/10 px-4 py-2 text-sm text-amber-200">{msg}</p>}

      {tab === "catalog" && (
        <section className="mt-5">
          <button
            onClick={() => setEditing({ ...EMPTY })}
            className="mb-4 inline-flex items-center gap-1.5 rounded-xl bg-fuchsia-500 px-4 py-2 text-sm font-bold text-white"
          >
            <Plus className="h-4 w-4" /> Nuevo personaje
          </button>
          {!list ? (
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.companions.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setEditing(c)}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${c.isActive ? "border-white/10 bg-[#0d0e1a]" : "border-white/5 bg-white/[0.02] opacity-60"}`}
                >
                  <CompanionPortrait name={c.name} gender={c.gender} src={c.avatarUrl} className="h-16 w-14 shrink-0" rounded="rounded-xl" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">
                      {c.name} <span className="text-white/50">{c.age}</span>
                    </p>
                    <p className="text-xs text-white/50">
                      {c.gender === "FEMALE" ? "Mujer" : "Hombre"} · {ACCESS_LABEL[c.access]} {c.isActive ? "" : "· inactivo"}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {c._count?.chats ?? 0} chats · {c._count?.images ?? 0} imágenes
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "flags" && (
        <section className="mt-5">
          <p className="mb-3 text-xs text-white/50">
            Mensajes y pedidos de imagen bloqueados por los filtros. Un usuario que insiste con menores debe revisarse y
            suspenderse desde Perfiles.
          </p>
          {!flags ? (
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          ) : flags.length === 0 ? (
            <p className="text-sm text-white/50">Sin bloqueos pendientes.</p>
          ) : (
            <ul className="space-y-2">
              {flags.map((f) => (
                <li key={f.id} className="rounded-2xl border border-white/10 bg-[#0d0e1a] p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-bold ${f.reason === "minors" ? "bg-red-500/20 text-red-300" : "bg-amber-500/15 text-amber-200"}`}>
                      <ShieldAlert className="mr-1 inline h-3 w-3" />
                      {REASON_LABEL[f.reason] || f.reason}
                    </span>
                    <span className="text-white/45">{f.source}</span>
                    <span className="text-white/45">{new Date(f.createdAt).toLocaleString("es-CL")}</span>
                    {f.user && (
                      <span className="text-white/70">
                        @{f.user.username} · {f.userFlagCount} bloqueo{f.userFlagCount === 1 ? "" : "s"}
                      </span>
                    )}
                    {f.companion && <span className="text-white/45">con {f.companion.name}</span>}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm text-white/80">{f.excerpt}</p>
                  <button
                    onClick={async () => {
                      await apiFetch(`/admin/ai-companions-flags/${f.id}/review`, { method: "POST" });
                      setFlags((all) => (all || []).filter((x) => x.id !== f.id));
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Revisado
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "prices" && (
        <section className="mt-5 max-w-md">
          {!prices ? (
            <Loader2 className="h-6 w-6 animate-spin text-white/40" />
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const r = await apiFetch<{ prices: Prices }>("/admin/ai-companions-settings", {
                    method: "PUT",
                    body: JSON.stringify({ prices }),
                  });
                  setPrices(r.prices);
                  setMsg("Precios guardados.");
                } catch (err) {
                  setMsg(apiErrorMessage(err));
                }
              }}
              className="space-y-3"
            >
              {Object.keys(PRICE_LABELS).map((k) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-xs font-semibold text-white/60">{PRICE_LABELS[k]}</span>
                  <input
                    type="number"
                    min={0}
                    value={prices[k] ?? 0}
                    onChange={(e) => setPrices({ ...prices, [k]: Number(e.target.value) })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  />
                </label>
              ))}
              <p className="text-[11px] text-white/40">
                Ajusta los precios cuando tengas el costo real por mensaje e imagen del proveedor. Los tokens valen lo que diga
                la tarifa de la billetera.
              </p>
              <button className="rounded-xl bg-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white">Guardar</button>
            </form>
          )}
        </section>
      )}

      {editing && list && (
        <EditCompanion
          value={editing}
          personalities={list.personalities}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await loadList();
          }}
          onUpdated={(c) => setEditing(c)}
        />
      )}
    </div>
  );
}

function EditCompanion({
  value, personalities, onClose, onSaved, onUpdated,
}: {
  value: Partial<AdminCompanion>;
  personalities: { key: string; label: string }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onUpdated: (c: AdminCompanion) => void;
}) {
  const [form, setForm] = useState<Partial<AdminCompanion>>(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isNew = !form.id;

  useEffect(() => setForm(value), [value]);

  const set = <K extends keyof AdminCompanion>(k: K, v: AdminCompanion[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify(form);
      const r = isNew
        ? await apiFetch<{ companion: AdminCompanion }>("/admin/ai-companions", { method: "POST", body })
        : await apiFetch<{ companion: AdminCompanion }>(`/admin/ai-companions/${form.id}`, { method: "PUT", body });
      onUpdated(r.companion);
      await onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(kind: "avatar" | "gallery", file: File) {
    if (!form.id) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await apiFetch<{ companion: AdminCompanion }>(`/admin/ai-companions/${form.id}/${kind}`, { method: "POST", body: fd });
      onUpdated(r.companion);
      await onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function removeGallery(url: string) {
    if (!form.id) return;
    const r = await apiFetch<{ companion: AdminCompanion }>(`/admin/ai-companions/${form.id}/gallery`, {
      method: "DELETE",
      body: JSON.stringify({ url }),
    });
    onUpdated(r.companion);
    await onSaved();
  }

  const input = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400/60";
  const label = "mb-1 block text-xs font-semibold text-white/60";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0d0e1a] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{isNew ? "Nuevo personaje" : form.name}</h3>
          <button onClick={onClose} className="text-white/50" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={label}>Nombre</span>
            <input className={input} value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label>
            <span className={label}>Slug (URL)</span>
            <input className={input} value={form.slug || ""} placeholder="se genera del nombre" onChange={(e) => set("slug", e.target.value)} />
          </label>
          <label>
            <span className={label}>Género</span>
            <select className={input} value={form.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
              <option value="FEMALE">Mujer</option>
              <option value="MALE">Hombre</option>
            </select>
          </label>
          <label>
            <span className={label}>Edad ficticia (18+)</span>
            <input type="number" min={18} max={99} className={input} value={form.age ?? 25} onChange={(e) => set("age", Number(e.target.value))} />
          </label>
          <label className="sm:col-span-2">
            <span className={label}>Presentación corta</span>
            <input className={input} maxLength={140} value={form.tagline || ""} onChange={(e) => set("tagline", e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className={label}>Historia</span>
            <textarea rows={3} className={input} value={form.bio || ""} onChange={(e) => set("bio", e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className={label}>Descripción visual (en inglés, para las imágenes: siempre adulto)</span>
            <textarea
              rows={3}
              className={input}
              placeholder="adult woman, 28 years old, long black hair, green eyes…"
              value={form.appearance || ""}
              onChange={(e) => set("appearance", e.target.value)}
            />
          </label>
          <label>
            <span className={label}>Personalidad por defecto</span>
            <select className={input} value={form.personality} onChange={(e) => set("personality", e.target.value)}>
              {personalities.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className={label}>Personalidades que puede elegir el usuario</span>
            <div className="flex flex-wrap gap-1.5">
              {personalities.map((p) => {
                const on = (form.personalities || []).includes(p.key);
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() =>
                      set("personalities", on ? (form.personalities || []).filter((x) => x !== p.key) : [...(form.personalities || []), p.key])
                    }
                    className={`rounded-full px-2.5 py-1 text-xs ${on ? "bg-fuchsia-500 text-white" : "bg-white/5 text-white/60"}`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="sm:col-span-2">
            <span className={label}>Estilo de comunicación</span>
            <input className={input} value={form.communicationStyle || ""} onChange={(e) => set("communicationStyle", e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className={label}>Preferencias de roleplay</span>
            <textarea rows={2} className={input} value={form.roleplayNotes || ""} onChange={(e) => set("roleplayNotes", e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className={label}>Intereses (separados por coma)</span>
            <input
              className={input}
              value={(form.interests || []).join(", ")}
              onChange={(e) => set("interests", e.target.value.split(",").map((x) => x.trimStart()))}
            />
          </label>
          <label>
            <span className={label}>Acceso</span>
            <select className={input} value={form.access} onChange={(e) => set("access", e.target.value as Access)}>
              {(["FREE", "PREMIUM", "VIP", "EXCLUSIVE"] as Access[]).map((a) => (
                <option key={a} value={a}>
                  {ACCESS_LABEL[a]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={label}>Orden</span>
            <input type="number" className={input} value={form.sortOrder ?? 0} onChange={(e) => set("sortOrder", Number(e.target.value))} />
          </label>
          {form.access === "EXCLUSIVE" && (
            <>
              <label>
                <span className={label}>Desbloqueo (tokens)</span>
                <input type="number" min={0} className={input} value={form.unlockTokens ?? 0} onChange={(e) => set("unlockTokens", Number(e.target.value))} />
              </label>
              <label>
                <span className={label}>Días de acceso</span>
                <input type="number" min={1} className={input} value={form.unlockDays ?? 30} onChange={(e) => set("unlockDays", Number(e.target.value))} />
              </label>
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-white/75 sm:col-span-2">
            <input type="checkbox" checked={Boolean(form.isActive)} onChange={(e) => set("isActive", e.target.checked)} className="accent-fuchsia-500" />
            Visible en el catálogo
          </label>
        </div>

        {!isNew && (
          <div className="mt-5 space-y-3">
            <div>
              <span className={label}>Foto principal y galería (imágenes del personaje ficticio, nunca de personas reales)</span>
              <div className="flex flex-wrap gap-2">
                <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 text-[10px] text-white/50">
                  <Upload className="h-4 w-4" /> Principal
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile("avatar", e.target.files[0])} />
                </label>
                <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 text-[10px] text-white/50">
                  <Plus className="h-4 w-4" /> Galería
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile("gallery", e.target.files[0])} />
                </label>
                {form.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(form.avatarUrl) || ""} alt="" className="h-24 w-20 rounded-xl object-cover ring-2 ring-fuchsia-500" />
                )}
                {(form.galleryUrls || []).map((u) => (
                  <div key={u} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveMediaUrl(u) || ""} alt="" className="h-24 w-20 rounded-xl object-cover" />
                    <button
                      onClick={() => removeGallery(u)}
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1"
                      aria-label="Quitar"
                    >
                      <Trash2 className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isNew ? "Crear" : "Guardar"}
          </button>
          <button onClick={onClose} className="rounded-xl bg-white/5 px-5 py-2.5 text-sm text-white/70">
            Cerrar
          </button>
        </div>
        {isNew && <p className="mt-2 text-[11px] text-white/40">Después de crearlo podrás subir sus fotos.</p>}
      </div>
    </div>
  );
}
