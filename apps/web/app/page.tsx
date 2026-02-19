"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Download, MapPin, Menu, Navigation, X } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../lib/api";
import UserLevelBadge from "../components/UserLevelBadge";
import MapboxMap from "../components/MapboxMap";
import { useMapLocation } from "../hooks/useMapLocation";
import useMe from "../hooks/useMe";

type UserLevel = "SILVER" | "GOLD" | "DIAMOND";
type Profile = {
  id: string;
  username: string;
  displayName: string | null;
  coverUrl: string | null;
  avatarUrl: string | null;
  city: string | null;
  latitude?: number | null;
  longitude?: number | null;
  serviceCategory: string | null;
  serviceDescription: string | null;
  servicesTags?: string[] | null;
  comuna?: string | null;
  region?: string | null;
  availableNow?: boolean;
  isActive: boolean;
  userLevel?: UserLevel;
};

const FEATURED_SERVICES = ["Packs", "Videollamadas", "Tríos", "Anal", "Discapacitados", "Masajes", "Despedidas"];
const DEFAULT_LOCATION: [number, number] = [-33.45, -70.66];
const HOME_CATEGORIES = ["Moteles", "Sex Shop", "Escort", "Masajes", "Trans", "Maduras"];

function installPwa() {
  const evt = (window as any).deferredPrompt;
  if (evt && typeof evt.prompt === "function") {
    evt.prompt();
    return;
  }
  window.location.href = "/manifest.webmanifest";
}

export default function HomePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [availableNow, setAvailableNow] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const { location } = useMapLocation(DEFAULT_LOCATION);
  const { me } = useMe();
  const profileType = String(me?.user?.profileType || "").toUpperCase();
  const canUploadStory = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(profileType);

  useEffect(() => {
    const qp = new URLSearchParams();
    if (location) {
      qp.set("lat", String(location[0]));
      qp.set("lng", String(location[1]));
    }

    apiFetch<{ profiles: Profile[] }>(`/services?${qp.toString()}`)
      .then((res) => setProfiles(res?.profiles || []))
      .catch(() => setProfiles([]));

    apiFetch<{ total: number }>("/stats/available-now")
      .then((res) => setAvailableNow(Number(res?.total || 0)))
      .catch(() => setAvailableNow(0));
  }, [location]);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const stories = useMemo(() => profiles.slice(0, 16), [profiles]);
  const compactNow = useMemo(() => profiles.filter((p) => p.availableNow).slice(0, 6), [profiles]);
  const rest = useMemo(() => profiles.slice(0, 15), [profiles]);
  const highlighted = useMemo(() => profiles.filter((p) => ["GOLD", "DIAMOND"].includes(String(p.userLevel || ""))).slice(0, 8), [profiles]);
  const highlightedIds = useMemo(() => new Set(highlighted.map((p) => p.id)), [highlighted]);
  const gold = useMemo(() => profiles.filter((p) => p.userLevel === "GOLD" && !highlightedIds.has(p.id)).slice(0, 8), [profiles, highlightedIds]);
  const silver = useMemo(() => profiles.filter((p) => (p.userLevel || "SILVER") === "SILVER" && !highlightedIds.has(p.id)).slice(0, 8), [profiles, highlightedIds]);
  const platinum = useMemo(() => profiles.filter((p) => p.userLevel === "DIAMOND" && !highlightedIds.has(p.id)).slice(0, 8), [profiles, highlightedIds]);
  const regions = useMemo(() => Array.from(new Set(profiles.map((p) => (p.comuna || p.region || p.city || "").trim()).filter(Boolean))).slice(0, 18), [profiles]);

  const mapMarkers = useMemo(
    () =>
      profiles
        .filter((p) => Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)))
        .map((p) => ({
          id: p.id,
          name: p.displayName || p.username,
          lat: Number(p.latitude),
          lng: Number(p.longitude),
          subtitle: p.comuna || p.region || p.city || p.serviceCategory || "Perfil",
          href: `/profesional/${p.id}`,
          username: p.username,
          avatarUrl: p.avatarUrl,
          coverUrl: p.coverUrl,
          tier: p.availableNow ? "online" : "offline",
          areaRadiusM: 500,
        })),
    [profiles],
  );

  return (
    <div className="mx-auto grid max-w-[1460px] grid-cols-1 gap-6 px-4 pb-24 xl:grid-cols-[1fr_250px]">
      <section className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#120a24] via-[#0c1020] to-[#131428] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">Portal Uzeed</h1>
            <div className="flex flex-wrap gap-2">
              <button onClick={installPwa} className="inline-flex items-center gap-2 rounded-xl bg-[#ff4b4b] px-4 py-2 text-sm font-semibold"><Download className="h-4 w-4" />Descargar App</button>
              <Link href="/services?near=1&radiusKm=4" className="inline-flex items-center gap-2 rounded-xl border border-[#8b5cf6]/40 bg-[#8b5cf6]/15 px-4 py-2 text-sm text-white hover:bg-[#8b5cf6]/25"><Navigation className="h-4 w-4" />Cerca tuyo</Link>
              <button type="button" onClick={() => setMenuOpen((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border border-[#8b5cf6]/40 bg-[#8b5cf6]/15 px-4 py-2 text-sm text-white hover:bg-[#8b5cf6]/25">
                {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />} Menú
              </button>
            </div>
          </div>

          {menuOpen ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 text-xs text-white/60">Navegación rápida</div>
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <a href="#resto" className="rounded-lg border border-white/10 px-3 py-2">Resto perfiles</a>
                <a href="#destacadas" className="rounded-lg border border-white/10 px-3 py-2">Destacadas</a>
                <a href="#tiers" className="rounded-lg border border-white/10 px-3 py-2">Tiers</a>
                <a href="#regiones" className="rounded-lg border border-white/10 px-3 py-2">Regiones</a>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            {HOME_CATEGORIES.map((c) => (
              <Link key={c} href={`/services?category=${encodeURIComponent(c.toLowerCase().replace(/\s+/g, "-"))}`} className="rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/15 px-3 py-1 text-xs text-white hover:bg-[#8b5cf6]/25">{c}</Link>
            ))}
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {stories.map((p) => (
              <Link key={p.id} href={`/profesional/${p.id}`} className="shrink-0 text-center">
                <div className="rounded-full bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 p-[2px]"><div className="h-16 w-16 overflow-hidden rounded-full bg-black"><img src={resolveMediaUrl(p.avatarUrl) || resolveMediaUrl(p.coverUrl) || "/brand/isotipo-new.png"} alt={p.displayName || p.username} className="h-full w-full object-cover" /></div></div>
                <p className="mt-1 w-16 truncate text-[11px] text-white/70">{p.displayName || p.username}</p>
              </Link>
            ))}
          </div>
        </div>

        <section className="grid gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-[#101730] to-[#0b1227] p-4 lg:grid-cols-[330px_1fr]">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-[#ff4b4b] px-3 py-2 text-sm font-semibold text-white"><span>Disponibles ahora</span><span>{availableNow}</span></div>
            {compactNow.map((p) => <Link key={`now-${p.id}`} href={`/profesional/${p.id}`} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs hover:bg-white/[0.06]"><span className="truncate">{p.displayName || p.username}</span><span className="text-white/60">{p.comuna || p.region || p.city || "Chile"}</span></Link>)}
          </div>
          <div id="resto">
            <h2 className="mb-3 text-xl font-semibold">Resto de perfiles</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{rest.map((p) => <ProfileCard key={`rest-${p.id}`} profile={p} />)}</div>
          </div>
        </section>

        <section id="destacadas" className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#12112a] to-[#0d1222] p-4">
          <h3 className="mb-3 text-lg font-semibold text-[#ff8a8a]">Destacadas</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{highlighted.map((p) => <ProfileCard key={`hl-${p.id}`} profile={p} />)}</div>
        </section>

        <section id="tiers" className="space-y-6">
          {[{ title: "Platinum", items: platinum }, { title: "Gold", items: gold }, { title: "Silver", items: silver }].filter((block) => block.items.length > 0).map((block) => (
            <section key={block.title} className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#12112a] to-[#0d1222] p-4">
              <h3 className="mb-3 text-lg font-semibold">{block.title}</h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{block.items.map((p) => <ProfileCard key={`${block.title}-${p.id}`} profile={p} />)}</div>
            </section>
          ))}
        </section>

        <section id="regiones" className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#121632] to-[#0b1425] p-4">
          <h3 className="mb-3 text-lg font-semibold">Regiones y comunas (Chile)</h3>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {regions.map((z) => <Link key={z} href={`/services?region=${encodeURIComponent(z)}`} className="rounded-full border border-[#8b5cf6]/35 bg-[#8b5cf6]/12 px-3 py-1 hover:bg-[#8b5cf6]/20">{z}</Link>)}
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <MapboxMap userLocation={location} markers={mapMarkers} height={360} showMarkersForArea renderHtmlMarkers autoCenterOnDataChange />
          </div>
        </section>

        <footer className="grid gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-[#120a24] to-[#0b1425] p-5 text-sm text-white/70 md:grid-cols-4">
          <FooterCol title="Legal" links={[{ label: "Términos y condiciones", href: "/legal/terminos-uzeed.txt" }, { label: "Privacidad", href: "/cuenta" }, { label: "Normas de publicación", href: "/register?type=business" }, { label: "18+", href: "/" }]} />
          <FooterCol title="Categorías" links={[{ label: "Escorts", href: "/services?category=escorts" }, { label: "Masajes", href: "/services?category=masajes" }, { label: "Moteles", href: "/services?category=moteles" }, { label: "Sex Shop", href: "/services?category=sex-shop" }, { label: "Trans", href: "/services?category=trans" }, { label: "Maduras", href: "/services?category=maduras" }]} />
          <FooterCol title="Regiones" links={regions.slice(0, 8).map((regionName) => ({ label: regionName, href: `/services?region=${encodeURIComponent(regionName)}` }))} />
          <FooterCol title="Ayuda" links={[{ label: "Centro de ayuda", href: "/cuenta" }, { label: "Publicar", href: "/register?type=business" }, { label: "Contacto", href: "/chat" }, { label: "Seguridad", href: "/cuenta" }, { label: "Soporte chat", href: "/chats" }]} />
        </footer>
      </section>

      <aside className="hidden xl:block">
        <div className="sticky top-24 space-y-4">
          <div className="h-[600px] rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/50">Banner vertical publicidad</div>
          <div className="h-24 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/50">Banner horizontal publicidad</div>
          <Link href="/chats" className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">Mensajería directa</Link>
          {canUploadStory ? <Link href="/dashboard/services" className="flex items-center justify-center gap-2 rounded-xl bg-[#ff4b4b] px-3 py-2 text-sm font-semibold">Subir Historia</Link> : null}
        </div>
      </aside>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<{ label: string; href: string }> }) {
  return <div><h4 className="mb-2 text-sm font-semibold text-white">{title}</h4><ul className="space-y-1">{links.map((item) => <li key={`${title}-${item.label}`}><Link href={item.href} className="hover:text-white">{item.label}</Link></li>)}</ul></div>;
}

function ProfileCard({ profile }: { profile: Profile }) {
  const image = resolveMediaUrl(profile.coverUrl) || resolveMediaUrl(profile.avatarUrl) || "/brand/isotipo-new.png";
  const highlightedServices = FEATURED_SERVICES.filter((s) => `${profile.serviceCategory || ""} ${profile.serviceDescription || ""} ${profile.servicesTags?.join(" ") || ""}`.toLowerCase().includes(s.toLowerCase())).slice(0, 3);

  return (
    <Link href={`/profesional/${profile.id}`} className="group relative overflow-hidden rounded-2xl border border-white/10">
      <div className="aspect-[3/4]"><img src={image} alt={profile.displayName || profile.username} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /></div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3">
        <div className="flex items-center justify-between gap-2"><div className="truncate text-sm font-semibold">{profile.displayName || profile.username}</div><UserLevelBadge level={profile.userLevel || "SILVER"} /></div>
        <div className="mt-1 flex items-center gap-1 text-xs text-white/70"><MapPin className="h-3 w-3" /> {profile.comuna || profile.region || profile.city || "Chile"}</div>
        <div className="mt-2 flex flex-wrap gap-1">{highlightedServices.length ? highlightedServices.map((s) => <span key={s} className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">{s}</span>) : <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px]">Perfil activo</span>}</div>
      </div>
    </Link>
  );
}
