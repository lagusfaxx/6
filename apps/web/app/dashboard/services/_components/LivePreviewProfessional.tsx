"use client";

import { memo } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { resolveMediaUrl } from "../../../../lib/api";
import { hasVerifiedBadge } from "../../../../lib/systemBadges";
import VerifiedBand from "../../../../components/VerifiedBand";
import type { DashboardFormState } from "../../../../hooks/useDashboardForm";

/* Lo mismo que la ficha pública: la lista se recorta para no comerse la
   pantalla. Acá van menos porque la vista previa es angosta. */
const PREVIEW_SERVICES = 8;

type Props = {
  state: DashboardFormState;
  user: any;
};

/**
 * Vista previa del perfil público.
 *
 * Antes esto mostraba una tarjeta que no existe en ninguna parte del sitio:
 * portada apaisada, avatar redondo encima y un botón "Solicitar / reservar".
 * La profesional completaba su perfil mirando algo que el cliente nunca iba a
 * ver, así que la vista previa no servía para decidir nada.
 *
 * Ahora es la misma ficha de /profesional/[id] en una columna: la foto con la
 * banda de verificación, la lista de datos, las líneas de confianza, la
 * biografía, la tarifa, el contacto y la grilla de fotos. Lo que falta se marca
 * en su sitio, que es donde de verdad ayuda: se ve el hueco que va a ver el
 * cliente, no una lista de tareas aparte.
 */
function LivePreviewProfessional({ state, user }: Props) {
  const photoUrl =
    resolveMediaUrl(state.coverPreview || user?.coverUrl) ??
    resolveMediaUrl(state.avatarPreview || user?.avatarUrl) ??
    null;
  const displayName = state.displayName || user?.displayName || "Tu nombre";
  const bio = state.bio.trim();
  const serviceDesc = state.serviceDescription.trim();
  const age = state.birthdate ? calculateAge(state.birthdate) : null;
  const isVerified = hasVerifiedBadge(user?.profileTags);
  const hasExams = (user?.profileTags || []).some((t: string) => {
    const n = String(t).toLowerCase().trim();
    return n === "profesional con examenes" || n === "profesional con exámenes";
  });

  const levelLabel = user?.userLevel ? `Escort ${user.userLevel}` : "Escort";

  const specs = [
    { label: "Edad", value: age ? `${age} años` : null },
    { label: "Estatura", value: state.heightCm ? `${state.heightCm} cm` : null },
    { label: "Peso", value: state.weightKg ? `${state.weightKg} kg` : null },
    { label: "Medidas", value: state.measurements || null },
    { label: "Cabello", value: state.hairColor || null },
    { label: "Piel", value: state.skinTone || null },
    { label: "Idiomas", value: splitCsv(state.languages).join(", ") || null },
  ].filter((item) => Boolean(item.value)) as { label: string; value: string }[];

  const rate = Number(state.baseRate);
  const priceLabel = Number.isFinite(rate) && rate > 0
    ? `$${rate.toLocaleString("es-CL")}`
    : null;
  const durationLabel = state.minDurationMinutes
    ? `${state.minDurationMinutes} min`
    : "Sin duración mínima";

  const dondeChips = [
    state.acceptsIncalls ? "Recibe" : null,
    state.acceptsOutcalls ? "Se desplaza" : null,
  ].filter(Boolean) as string[];

  const services = Array.from(
    new Set(
      [...state.serviceTags, ...splitCsv(state.serviceStyleTags)]
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "es"));

  const photos = state.gallery.filter((g) => String(g.type).toUpperCase() !== "VIDEO");
  const videos = state.gallery.length - photos.length;

  const publicHref = user?.id ? `/profesional/${user.id}` : null;

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] uppercase tracking-wide text-white/35">
            Así te ve el cliente
          </span>
        </div>
        {publicHref && (
          <Link
            href={publicHref}
            target="_blank"
            className="text-[11px] text-white/35 underline underline-offset-4 transition hover:text-white/70"
          >
            Abrir perfil real
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#0b0b12]">
        {/* Foto principal */}
        <div className="relative aspect-[4/5] w-full bg-white/[0.03]">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                objectPosition: `${state.coverPositionX}% ${state.coverPositionY}%`,
              }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center px-6 text-center">
              <p className="text-[13px] text-amber-200/70">
                Sin foto principal. Es lo primero que mira el cliente: sube una
                desde Fotos.
              </p>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-9">
            <p className="text-[26px] font-semibold leading-none tracking-tight">
              {displayName}
              {age ? (
                <span className="ml-1.5 text-lg font-normal text-white/60">{age}</span>
              ) : null}
            </p>
            <p className="mt-1 text-[13px] text-white/55">
              {levelLabel}
              {state.city ? ` · ${state.city}` : ""}
            </p>
          </div>
          {isVerified && photoUrl && <VerifiedBand size="sm" />}
        </div>

        <div className="px-4 pb-5 pt-4">
          {/* Ficha técnica */}
          {specs.length > 0 ? (
            <dl className="grid grid-cols-2 gap-x-6 border-t border-white/[0.08]">
              {specs.map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] py-2"
                >
                  <dt className="text-[12px] text-white/40">{label}</dt>
                  <dd className="text-right text-[13px] font-medium text-white/90">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="border-y border-white/[0.06] py-3 text-[13px] text-amber-200/70">
              Sin datos físicos. Edad, estatura y medidas son lo que más se
              consulta: complétalos en Perfil.
            </p>
          )}

          {/* Confianza */}
          <div className="mt-4 space-y-1.5 border-l border-white/[0.1] pl-3.5">
            <p className="text-[12.5px] leading-relaxed text-white/60">
              <span
                className={
                  isVerified ? "font-medium text-emerald-300" : "font-medium text-white/80"
                }
              >
                {isVerified ? "Perfil verificado. " : "Perfil sin verificar. "}
              </span>
              {isVerified
                ? "El equipo comprobó que las fotos corresponden a este perfil."
                : "Pide la verificación al equipo: los perfiles verificados reciben más contactos."}
            </p>
            <p className="text-[12.5px] leading-relaxed text-white/60">
              <span className="font-medium text-white/80">
                {hasExams ? "Exámenes al día. " : "Sin exámenes vigentes. "}
              </span>
              {hasExams
                ? "Presentaste exámenes médicos vigentes."
                : "Súbelos para que aparezca el sello de exámenes."}
            </p>
          </div>

          {/* Sobre mí */}
          <p
            className={`mt-4 whitespace-pre-line text-[14px] leading-[1.7] ${
              bio ? "text-white/75" : "text-amber-200/70"
            }`}
          >
            {bio ||
              "Sin descripción. Cuenta en dos o tres líneas cómo atiendes: es lo que se lee antes de escribirte."}
          </p>

          {/* Tarifa y contacto */}
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            {priceLabel ? (
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-xl font-semibold tracking-tight">{priceLabel}</span>
                <span className="text-[12px] text-white/45">{durationLabel}</span>
              </div>
            ) : (
              <p className="text-[13px] text-amber-200/70">
                Sin tarifa. El perfil aparece como "Tarifa a consultar" y pierde
                contactos frente a los que la muestran.
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-lg bg-fuchsia-600/80 px-4 py-2 text-[13px] font-semibold text-white/90">
                Enviar mensaje
              </span>
              <span className="rounded-lg border border-white/15 px-4 py-2 text-[13px] font-semibold text-white/70">
                WhatsApp
              </span>
              <span
                className={`rounded-lg border px-4 py-2 text-[13px] font-semibold ${
                  state.phone
                    ? "border-white/15 text-white/70"
                    : "border-amber-400/25 text-amber-200/70"
                }`}
              >
                {state.phone || "Falta tu número"}
              </span>
            </div>

            <dl className="mt-4 space-y-1.5 text-[13px]">
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-white/40">Dónde</dt>
                <dd className={state.city ? "text-white/80" : "text-amber-200/70"}>
                  {state.city || "Falta la comuna"}
                  {dondeChips.length > 0 && (
                    <span className="text-white/45"> · {dondeChips.join(" · ")}</span>
                  )}
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-white/40">Cuándo</dt>
                <dd className={state.availabilityNote ? "text-white/80" : "text-white/45"}>
                  {state.availabilityNote || "Sin horario declarado"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Fotos */}
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[15px] font-semibold tracking-tight">Fotos</h3>
              <span className="text-[12px] text-white/40">
                {photos.length} foto{photos.length === 1 ? "" : "s"}
                {videos > 0 ? ` · ${videos} video${videos === 1 ? "" : "s"}` : ""}
              </span>
            </div>
            {state.gallery.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {state.gallery.slice(0, 9).map((g) => (
                  <div
                    key={g.id}
                    className="relative aspect-[3/4] overflow-hidden rounded-md bg-white/[0.04]"
                  >
                    {String(g.type).toUpperCase() === "VIDEO" ? (
                      <video
                        src={`${resolveMediaUrl(g.url) ?? g.url}#t=0.1`}
                        muted
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={resolveMediaUrl(g.url) ?? undefined}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-amber-200/70">
                Sin fotos en la galería. Los perfiles con seis o más fotos son
                los que más se abren.
              </p>
            )}
          </div>

          {/* Servicios */}
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <h3 className="text-[15px] font-semibold tracking-tight">Servicios</h3>
            {services.length > 0 ? (
              /* La misma lista con vistos que la ficha pública: si acá se
                 vieran como un párrafo, la profesional no sabría cómo se
                 muestran de verdad sus servicios. */
              <>
                <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
                  {services.slice(0, PREVIEW_SERVICES).map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 border-b border-white/[0.06] py-1.5 text-[13.5px] text-white/85"
                    >
                      <Check className="mt-[3px] h-3 w-3 shrink-0 text-emerald-400" />
                      <span className="first-letter:uppercase">{item}</span>
                    </li>
                  ))}
                </ul>
                {services.length > PREVIEW_SERVICES && (
                  <p className="mt-2 text-[12px] text-white/35">
                    y {services.length - PREVIEW_SERVICES} más — en tu perfil se
                    ven con un botón para desplegarlos.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-[13px] text-amber-200/70">
                Sin servicios marcados. Sin ellos el perfil no sale en los
                filtros que usa el cliente.
              </p>
            )}
            {serviceDesc && (
              <p className="mt-3 whitespace-pre-line text-[14px] leading-[1.75] text-white/60">
                {serviceDesc}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function splitCsv(value?: string | null) {
  return (value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function calculateAge(birthdate: string): number {
  const birth = new Date(birthdate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export default memo(LivePreviewProfessional);
