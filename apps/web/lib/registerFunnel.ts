"use client";

/**
 * Embudo del registro: marca hasta dónde llega cada visita y en qué campo se
 * queda quien no termina. Los eventos van a `/analytics/register-funnel`
 * (tabla UserAction, acciones `reg_*`) y los lee /admin/embudo-registro.
 *
 * Nunca debe interferir con el registro: todo es "dispara y olvida", sin
 * esperar respuesta y tragándose cualquier error. Tampoco se envía el valor
 * de ningún campo, sólo su nombre.
 */

import { apiFetch } from "./api";
import { analyticsIds } from "../hooks/useAnalytics";

export type RegisterFunnelEvent =
  | "reg_view" // abrió /register
  | "reg_type" // eligió tipo de cuenta y siguió al formulario
  | "reg_step" // llegó a un paso del formulario
  | "reg_field" // tocó un campo (primera vez en la visita)
  | "reg_error" // vio un aviso de validación o un error
  | "reg_submit" // envió el formulario completo
  | "reg_verify" // llegó a la pantalla del código
  | "reg_verified" // código correcto
  | "reg_done" // cuenta creada
  | "reg_fail"; // la API rechazó la creación de la cuenta

type FunnelData = {
  flow?: string | null;
  step?: string | number;
  field?: string;
  message?: string;
  google?: boolean;
};

/* Un mismo campo o paso se cuenta una vez por carga de página: volver atrás
   y pasar de nuevo no infla el embudo. */
const sentOnce = new Set<string>();

export function trackRegister(event: RegisterFunnelEvent, data: FunnelData = {}) {
  if (typeof window === "undefined") return;
  try {
    const onceKey =
      event === "reg_field" || event === "reg_step" || event === "reg_view"
        ? `${event}:${data.flow ?? ""}:${data.step ?? ""}:${data.field ?? ""}`
        : null;
    if (onceKey) {
      if (sentOnce.has(onceKey)) return;
      sentOnce.add(onceKey);
    }
    const { sid, vid } = analyticsIds();
    const metadata: Record<string, unknown> = { ...data };
    if (typeof data.message === "string") metadata.message = data.message.slice(0, 160);
    apiFetch("/analytics/register-funnel", {
      method: "POST",
      // keepalive: el evento de "cuenta creada" sale justo antes de navegar
      // al estudio y sin esto el navegador lo cancela.
      keepalive: true,
      body: JSON.stringify({ action: event, metadata, sessionId: sid, visitorId: vid }),
    }).catch(() => {});
  } catch {
    /* nunca romper el registro por la analítica */
  }
}

/**
 * Handlers para el <form>: detectan qué campo tocó la persona buscando el
 * `data-funnel` más cercano al elemento enfocado o pulsado. Así no hay que
 * tocar el onChange de cada input.
 */
export function funnelFieldHandlers(flow: string | null | undefined) {
  const handle = (e: { target: EventTarget | null }) => {
    if (!flow) return;
    const el = e.target as Element | null;
    const holder = el && typeof el.closest === "function" ? el.closest("[data-funnel]") : null;
    const field = holder?.getAttribute("data-funnel");
    if (field) trackRegister("reg_field", { flow, field });
  };
  /* Formularios con validación del navegador (required, type=email…): el
     submit ni llega a dispararse, pero el evento "invalid" sí. */
  const invalid = (e: { target: EventTarget | null }) => {
    if (!flow) return;
    const el = e.target as (Element & { validationMessage?: string }) | null;
    const holder = el && typeof el.closest === "function" ? el.closest("[data-funnel]") : null;
    trackRegister("reg_error", {
      flow,
      step: "form",
      field: holder?.getAttribute("data-funnel") ?? undefined,
      message: el?.validationMessage || "Campo inválido",
    });
  };
  // onChange cubre el autocompletado del navegador, que llena sin enfocar.
  return {
    onFocusCapture: handle,
    onPointerDownCapture: handle,
    onChangeCapture: handle,
    onInvalidCapture: invalid,
  };
}
