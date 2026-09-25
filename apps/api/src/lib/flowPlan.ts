import { config } from "../config";
import { createFlowPlan, getFlowPlan } from "../khipu/client";
import { getBillingSettings, updateBillingSettings } from "./billingSettings";

/**
 * Plan de Flow para el cobro automático (PAC) con la tarifa vigente.
 *
 * Flow no permite cambiar el monto de un plan que ya tiene suscriptores, así
 * que cada precio tiene su propio plan (`UZEED_PRO_MENSUAL_9990`, …). Las
 * suscripciones nuevas usan el plan del precio actual; las que ya existían
 * siguen cobrándose con el precio con el que se suscribieron.
 *
 * Los planes se crean sin días de prueba: la prueba se pasa en cada
 * suscripción según lo que le quede a esa persona (ver /billing/subscription/start).
 */
export async function ensureFlowPlanForPrice(priceClp: number): Promise<string> {
  const settings = await getBillingSettings(true);
  if (settings.flowPlanPriceClp === priceClp && settings.flowPlanId) return settings.flowPlanId;

  const candidates = [config.flowPlanId, `${config.flowPlanId}_${priceClp}`];
  for (const planId of candidates) {
    try {
      const plan = await getFlowPlan(planId);
      if (
        plan &&
        Number(plan.amount) === priceClp &&
        Number(plan.status ?? 1) === 1 &&
        !Number(plan.trial_period_days || 0)
      ) {
        await updateBillingSettings({ flowPlanId: planId, flowPlanPriceClp: priceClp });
        return planId;
      }
    } catch {
      // No existe: se prueba el siguiente o se crea.
    }
  }

  const planId = `${config.flowPlanId}_${priceClp}`;
  const apiUrl = config.apiUrl.replace(/\/$/, "");
  await createFlowPlan({
    planId,
    name: `Plan Profesional UZEED ($${priceClp.toLocaleString("es-CL")})`,
    currency: "CLP",
    amount: priceClp,
    interval: 3, // mensual
    interval_count: 1,
    trial_period_days: 0,
    days_until_due: 3,
    urlCallback: `${apiUrl}/webhooks/flow/subscription`,
  });
  console.log("[billing] plan de Flow creado para la tarifa", { planId, priceClp });
  await updateBillingSettings({ flowPlanId: planId, flowPlanPriceClp: priceClp });
  return planId;
}
