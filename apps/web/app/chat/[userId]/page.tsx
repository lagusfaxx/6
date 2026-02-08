"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, API_URL, isAuthError, resolveMediaUrl } from "../../../lib/api";
import { connectRealtime } from "../../../lib/realtime";
import Avatar from "../../../components/Avatar";
import { Paperclip, X } from "lucide-react";

type Message = {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  createdAt: string;
};

type ChatUser = {
  id: string;
  displayName: string | null;
  username: string;
  avatarUrl: string | null;
  profileType: string;
  city: string | null;
};

type MeResponse = {
  user: { id: string; displayName: string | null; username: string; profileType: string | null } | null;
};

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || "/chats";
  const userId = String(params.userId || "");
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [other, setOther] = useState<ChatUser | null>(null);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [activeRequest, setActiveRequest] = useState<{ id: string; status: string } | null>(null);
  const [incomingNotice, setIncomingNotice] = useState<string | null>(null);

  async function load() {
    const [meResp, msgResp] = await Promise.all([
      apiFetch<MeResponse>("/auth/me"),
      apiFetch<{ messages: Message[]; other: ChatUser }>(`/messages/${userId}`)
    ]);
    setMe(meResp.user);
    setMessages(msgResp.messages);
    setOther(msgResp.other);
    if (meResp.user?.profileType === "CLIENT") {
      apiFetch<{ services: { id: string; status: string; professional: { id: string } }[] }>("/services/active")
        .then((res) => {
          const match = res.services.find((s) => s.professional.id === userId);
          setActiveRequest(match ? { id: match.id, status: match.status } : null);
        })
        .catch(() => setActiveRequest(null));
    } else if (meResp.user?.profileType === "PROFESSIONAL") {
      apiFetch<{ request: { id: string; status: string } | null }>(`/services/requests/with/${userId}`)
        .then((res) => setActiveRequest(res.request ? { id: res.request.id, status: res.request.status } : null))
        .catch(() => setActiveRequest(null));
    }
  }

  useEffect(() => {
    load()
      .catch((e: any) => {
        if (isAuthError(e)) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        if (e?.status === 403) {
          setError("No puedes iniciar chat con este perfil. Suscríbete o espera a que habilite mensajes.");
        } else {
          setError(e?.message || "Error");
        }
      })
      .finally(() => setLoading(false));
  }, [pathname, router, userId]);


  useEffect(() => {
    const draft = searchParams.get("draft");
    if (draft && !body) setBody(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !attachment) return;
    try {
      if (attachment) {
        const form = new FormData();
        form.append("file", attachment);
        const res = await fetch(`${API_URL}/messages/${userId}/attachment`, {
          method: "POST",
          credentials: "include",
          body: form
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(`ATTACHMENT_FAILED ${res.status}: ${t}`);
        }
        const payload = (await res.json()) as { message: Message };
        setMessages((prev) => [...prev, payload.message]);
        setAttachment(null);
        setAttachmentPreview(null);
      }
      if (body.trim()) {
        const msg = await apiFetch<{ message: Message }>(`/messages/${userId}`, {
          method: "POST",
          body: JSON.stringify({ body })
        });
        setMessages((prev) => [...prev, msg.message]);
        setBody("");
      }
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar el mensaje");
    }
  }

  async function requestService() {
    setRequesting(true);
    try {
      const res = await apiFetch<{ request: { id: string; status: string } }>("/services/request", {
        method: "POST",
        body: JSON.stringify({ professionalId: userId })
      });
      setActiveRequest(res.request ? { id: res.request.id, status: res.request.status } : { id: "pending", status: "PENDIENTE_APROBACION" });
    } catch (e: any) {
      setError(e?.message || "No se pudo solicitar el servicio");
    } finally {
      setRequesting(false);
    }
  }

  async function approveRequest() {
    if (!activeRequest) return;
    try {
      await apiFetch(`/services/${activeRequest.id}/approve`, { method: "POST" });
      setActiveRequest({ ...activeRequest, status: "ACTIVO" });
    } catch (e: any) {
      setError(e?.message || "No se pudo aprobar la solicitud");
    }
  }

  async function rejectRequest() {
    if (!activeRequest) return;
    try {
      await apiFetch(`/services/${activeRequest.id}/reject`, { method: "POST" });
      setActiveRequest({ ...activeRequest, status: "RECHAZADO" });
    } catch (e: any) {
      setError(e?.message || "No se pudo rechazar la solicitud");
    }
  }

  if (loading) return <div className="text-white/70">Cargando chat...</div>;
  if (error) return <div className="text-red-200">{error}</div>;

  const canRequest = me?.profileType === "CLIENT" && !activeRequest;
  const canManageRequest = me?.profileType === "PROFESSIONAL" && activeRequest?.status === "PENDIENTE_APROBACION";

  return (
    <div className="grid gap-6">
      <div className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar src={other?.avatarUrl} alt={other?.username} size={48} />
            <div>
              <h1 className="text-lg font-semibold">{other?.displayName || other?.username || "Chat"}</h1>
              {other ? (
                <p className="text-xs text-white/60">
                  @{other.username} • {other.profileType === "SHOP" ? "Tienda" : other.profileType === "ESTABLISHMENT" ? "Lugar" : other.profileType === "PROFESSIONAL" ? "Experiencia" : "Perfil"}
                  {other.city ? ` • ${other.city}` : ""}
                </p>
              ) : (
                <p className="text-xs text-white/60">Conversación segura para coordinar.</p>
              )}
            </div>
          </div>
          {canRequest ? (
            <button onClick={requestService} className="btn-primary" disabled={requesting}>
              {requesting ? "Solicitando..." : "Solicitar servicio"}
            </button>
          ) : canManageRequest ? (
            <div className="flex flex-wrap gap-2">
              <button onClick={approveRequest} className="btn-primary">Aceptar solicitud</button>
              <button onClick={rejectRequest} className="btn-secondary">Rechazar</button>
            </div>
          ) : activeRequest ? (
            <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs text-white/70">
              Solicitud {activeRequest.status === "ACTIVO" ? "activa" : activeRequest.status === "RECHAZADO" ? "rechazada" : "pendiente"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="card p-6">
        <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-2">
          {messages.map((m) => {
            const isImage = m.body.startsWith("ATTACHMENT_IMAGE:");
            const imageUrl = isImage ? resolveMediaUrl(m.body.replace("ATTACHMENT_IMAGE:", "")) : null;
            return (
              <div
                key={m.id}
                className={`rounded-xl px-4 py-3 text-sm ${
                  m.fromId === me?.id ? "bg-purple-500/20 text-white ml-auto" : "bg-white/5 text-white/80"
                }`}
              >
                {isImage && imageUrl ? (
                  <img src={imageUrl} alt="Adjunto" className="max-w-[220px] rounded-lg border border-white/10" />
                ) : (
                  <div>{m.body}</div>
                )}
                <div className="mt-1 text-[10px] text-white/40">
                  {new Date(m.createdAt).toLocaleString("es-CL")}
                </div>
              </div>
            );
          })}
          {!messages.length ? <div className="text-white/50">Aún no hay mensajes.</div> : null}
        </div>

        {attachmentPreview ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <img src={attachmentPreview} alt="Adjunto" className="h-16 w-16 rounded-xl object-cover" />
            <div className="flex-1 text-xs text-white/70">{attachment?.name}</div>
            <button
              type="button"
              onClick={() => {
                setAttachment(null);
                setAttachmentPreview(null);
              }}
              className="rounded-full border border-white/15 bg-white/5 p-2 text-white/70 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <form onSubmit={send} className="mt-4 flex flex-wrap gap-3 items-center">
          <input
            className="input flex-1"
            placeholder="Escribe tu mensaje..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <label className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
            <Paperclip className="h-4 w-4" />
            Adjuntar
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setAttachment(file);
                if (!file) {
                  setAttachmentPreview(null);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => setAttachmentPreview(String(reader.result || ""));
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <button className="btn-primary">Enviar</button>
        </form>
      </div>
    </div>
  );
}
