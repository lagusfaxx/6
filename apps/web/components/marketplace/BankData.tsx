"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import type { MarketTransferData } from "../../lib/marketplace";

/** Datos bancarios de UZEED para pagar por transferencia. Cada fila se copia
 *  con un toque: en el móvil, escribir un número de cuenta a mano es donde se
 *  pierden los pagos. */
export default function BankData({ data, code }: { data: MarketTransferData; code: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  const rows = [
    ["Banco", data.bankName],
    ["Tipo de cuenta", data.accountType],
    ["N° de cuenta", data.accountNumber],
    ["Titular", data.holderName],
    ["RUT", data.holderRut],
    ["Correo", data.email],
    ["Comentario", code],
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // El portapapeles puede estar bloqueado; los datos igual quedan a la vista.
    }
  };

  return (
    <div className="mt-3 space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      {rows.map(([label, value]) => (
        <button
          key={label}
          type="button"
          onClick={() => copy(value)}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-white/[0.04]"
        >
          <span className="text-xs text-white/45">{label}</span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-white">
            {value}
            <Copy className={`h-3 w-3 ${copied === value ? "text-emerald-300" : "text-white/25"}`} />
          </span>
        </button>
      ))}
      {data.note && <p className="pt-1 text-[11px] text-white/40">{data.note}</p>}
    </div>
  );
}
