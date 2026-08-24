import { prisma } from "../db";

export type MarketSettingsRow = Awaited<ReturnType<typeof getMarketSettings>>;

const SETTINGS_ID = "default";

/** Configuración del marketplace. La fila se crea sola la primera vez. */
export async function getMarketSettings() {
  const existing = await prisma.marketSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;
  return prisma.marketSettings.create({ data: { id: SETTINGS_ID } });
}

/** Datos bancarios de UZEED que ve la clienta al pagar por transferencia. */
export function publicTransferData(settings: {
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankHolderName: string | null;
  bankHolderRut: string | null;
  bankEmail: string | null;
  transferNote: string | null;
}) {
  return {
    bankName: settings.bankName,
    accountType: settings.bankAccountType,
    accountNumber: settings.bankAccountNumber,
    holderName: settings.bankHolderName,
    holderRut: settings.bankHolderRut,
    email: settings.bankEmail,
    note: settings.transferNote,
  };
}

/** ¿Están cargados los datos para poder pagar por transferencia? */
export function transferDataComplete(settings: {
  bankName: string | null;
  bankAccountNumber: string | null;
  bankHolderName: string | null;
}) {
  return Boolean(settings.bankName && settings.bankAccountNumber && settings.bankHolderName);
}

/** Comisión de UZEED y neto de la vendedora sobre el valor del artículo.
 *  El envío no paga comisión: es costo del despacho, no ganancia de la venta. */
export function splitAmounts(itemTotalClp: number, shippingClp: number, commissionPercent: number) {
  const commissionClp = Math.round((itemTotalClp * commissionPercent) / 100);
  return {
    commissionClp,
    sellerNetClp: itemTotalClp - commissionClp + shippingClp,
    totalClp: itemTotalClp + shippingClp,
  };
}
