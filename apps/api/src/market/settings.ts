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

/** Pedidos que cuentan como venta (pagados, en curso o cerrados). */
export const SALE_STATUSES = ["PAYMENT_REVIEW", "PAID", "PREPARING", "DELIVERED", "COMPLETED", "DISPUTED"] as const;

/** Ventas que le quedan sin comisión a una vendedora. */
export async function freeSalesLeft(sellerUserId: string, freeSalesCount: number) {
  if (freeSalesCount <= 0) return 0;
  const sold = await prisma.marketOrder.count({
    where: { sellerId: sellerUserId, status: { in: [...SALE_STATUSES] } },
  });
  return Math.max(0, freeSalesCount - sold);
}

/** Parte del precio que es IVA, como porcentaje del total (19% → 15,97%). */
export function ivaShareOfPrice(ivaPercent: number) {
  return ivaPercent > 0 ? Math.round(((ivaPercent / (100 + ivaPercent)) * 100) * 100) / 100 : 0;
}
