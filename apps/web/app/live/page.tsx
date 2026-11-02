"use client";

import { Flame, Radio } from "lucide-react";
import { LiveIframe } from "../../components/live/LiveIframe";

/*
 * En Vivo: las cámaras de live.uzeed.cl. Las transmisiones propias de las
 * profesionales (Live Studio) ya no existen.
 */
export default function LivePage() {
  return (
    <div className="min-h-screen bg-[#070816] text-white">
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-600/25 to-rose-600/25">
            <Radio className="h-5 w-5 text-fuchsia-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">En Vivo</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45">
              <Flame className="h-3.5 w-3.5 text-fuchsia-400" />
              Miles de modelos en vivo ahora mismo
            </p>
          </div>
        </div>
      </div>

      {/* Whitelabel iframe — live.uzeed.cl (same-site subdomain, no third-party blocking) */}
      <section className="border-t border-fuchsia-500/15 bg-black">
        <div className="relative w-full min-h-[calc(100vh-10rem)] bg-black">
          <LiveIframe />
        </div>
      </section>
    </div>
  );
}
