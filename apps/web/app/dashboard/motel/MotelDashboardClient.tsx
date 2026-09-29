"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, BadgePercent, BedDouble, CalendarDays, Home, Store } from "lucide-react";
import BusinessShell, { type ShellTab } from "../../../components/business/BusinessShell";
import { Switch, Toast, type ToastState } from "../../../components/business/ui";
import { apiFetch, friendlyErrorMessage } from "../../../lib/api";
import { connectRealtime } from "../../../lib/realtime";
import OverviewSection, { type SectionKey } from "./_components/OverviewSection";
import BookingsSection from "./_components/BookingsSection";
import RoomsSection from "./_components/RoomsSection";
import PromosSection from "./_components/PromosSection";
import ProfileSection from "./_components/ProfileSection";
import type { BookingAction } from "./_components/BookingCard";
import type { Booking, Dashboard } from "./_components/types";

const TAB_ALIASES: Record<string, SectionKey> = {
  home: "home", overview: "home", bookings: "bookings", reservas: "bookings",
  rooms: "rooms", habitaciones: "rooms", promos: "promos", promociones: "promos",
  profile: "profile", ficha: "profile", location: "profile",
};

/**
 * Panel del motel: Inicio, Reservas, Habitaciones, Promociones y Mi ficha.
 * Carga todo con /motel/dashboard y cada sección guarda por su cuenta.
 */
export default function MotelDashboardClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTabState] = useState<SectionKey>("home");
  const [toast, setToast] = useState<ToastState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const notify = useCallback((text: string, tone: "ok" | "error" = "ok") => setToast({ text, tone }), []);

  const load = useCallback(async () => {
    try {
      const next = await apiFetch<Dashboard>("/motel/dashboard");
      setData(next);
      setError(null);
    } catch (e: any) {
      if (e?.status === 401) {
        router.replace("/login?next=/dashboard/motel");
        return;
      }
      setError(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const requested = TAB_ALIASES[String(searchParams.get("tab") || "").toLowerCase()];
    if (requested) setTabState(requested);
  }, [searchParams]);

  /* Reservas en vivo. */
  useEffect(() => {
    return connectRealtime((event) => {
      if (event.type === "booking:new") {
        notify("Llegó una nueva solicitud de reserva.");
        load();
      } else if (event.type === "booking:update") {
        load();
      }
    });
  }, [load, notify]);

  function setTab(k: SectionKey) {
    setTabState(k);
    const url = new URL(window.location.href);
    if (k === "home") url.searchParams.delete("tab");
    else url.searchParams.set("tab", k);
    url.searchParams.delete("bienvenida");
    window.history.replaceState(null, "", url.toString());
    window.scrollTo({ top: 0 });
  }

  async function toggle(key: "isOpen" | "isPublished") {
    if (!data) return;
    const next = !data.profile[key];
    setData({ ...data, profile: { ...data.profile, [key]: next } });
    try {
      await apiFetch("/motel/dashboard/profile", { method: "PUT", body: JSON.stringify({ [key]: next }) });
      notify(
        key === "isOpen"
          ? (next ? "Abierto: ya recibes reservas." : "Cerrado: no recibirás reservas nuevas.")
          : (next ? "Tu motel vuelve a aparecer en el directorio." : "Tu motel quedó oculto del directorio."),
      );
    } catch (e: any) {
      setData((d) => (d ? { ...d, profile: { ...d.profile, [key]: !next } } : d));
      notify(friendlyErrorMessage(e), "error");
    }
  }

  async function bookingAction(b: Booking, action: BookingAction) {
    if (action.type === "DELETE" && !window.confirm("¿Quitar esta reserva del historial?")) return;
    setBusyId(b.id);
    try {
      if (action.type === "DELETE") {
        await apiFetch(`/motel/bookings/${b.id}`, { method: "DELETE" });
        notify("Reserva quitada del historial.");
      } else {
        const body: Record<string, string> = { action: action.type };
        if (action.type === "REJECT") {
          body.rejectReason = action.reason;
          if (action.reason === "OTRO" && action.note) body.rejectNote = action.note;
        }
        await apiFetch(`/motel/bookings/${b.id}/action`, { method: "POST", body: JSON.stringify(body) });
        notify(
          action.type === "ACCEPT" ? "Reserva aceptada. El cliente la confirma por chat."
          : action.type === "REJECT" ? "Reserva rechazada. Le avisamos al cliente."
          : "Reserva finalizada.",
        );
      }
      await load();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="studio-bg flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-fuchsia-500/20 border-t-fuchsia-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="studio-bg flex min-h-screen items-center justify-center px-4">
        <div className="editor-card w-full max-w-md p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-300" />
          <h1 className="mt-3 text-lg font-semibold">No pudimos abrir tu panel</h1>
          <p className="mt-1 text-sm text-white/55">{error || "Intenta de nuevo en un momento."}</p>
          <button onClick={() => { setLoading(true); load(); }} className="btn-primary mt-5 px-5 py-2.5 text-sm">Reintentar</button>
        </div>
      </div>
    );
  }

  const pending = data.bookings.filter((b) => b.status === "PENDIENTE").length;
  const publicPath = `/motel/${data.profile.publicSlug || data.profile.id}`;
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : `https://uzeed.cl${publicPath}`;

  const tabs: ShellTab<SectionKey>[] = [
    { key: "home", label: "Inicio", Icon: Home },
    { key: "bookings", label: "Reservas", Icon: CalendarDays, badge: pending },
    { key: "rooms", label: "Habitaciones", shortLabel: "Habitac.", Icon: BedDouble },
    { key: "promos", label: "Promociones", shortLabel: "Promos", Icon: BadgePercent },
    { key: "profile", label: "Mi ficha", Icon: Store },
  ];

  const status = (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-2 text-sm">
        <span className={`h-2 w-2 rounded-full ${data.profile.isOpen ? "bg-emerald-400 shadow-glow-emerald" : "bg-white/30"}`} />
        {data.profile.isOpen ? "Abierto ahora" : "Cerrado"}
      </div>
      <Switch checked={data.profile.isOpen} onChange={() => toggle("isOpen")} label="Abierto ahora" tone="emerald" />
    </div>
  );

  return (
    <>
      <BusinessShell
        name={data.profile.displayName || data.profile.username}
        avatarUrl={data.profile.avatarUrl || data.profile.coverUrl}
        kindLabel="Panel del motel"
        tabs={tabs}
        tab={tab}
        onTab={setTab}
        publicHref={publicPath}
        statusSlot={status}
        onLogout={logout}
      >
        {tab === "home" && (
          <OverviewSection
            data={data}
            busyId={busyId}
            onBooking={bookingAction}
            onToggle={toggle}
            goTo={setTab}
            publicUrl={publicUrl}
            notifyCopy={() => notify("Enlace copiado.")}
          />
        )}
        {tab === "bookings" && <BookingsSection bookings={data.bookings} busyId={busyId} onAction={bookingAction} />}
        {tab === "rooms" && <RoomsSection rooms={data.rooms} reload={load} notify={notify} />}
        {tab === "promos" && <PromosSection promos={data.promotions} rooms={data.rooms} reload={load} notify={notify} />}
        {tab === "profile" && <ProfileSection profile={data.profile} reload={load} notify={notify} />}
      </BusinessShell>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
