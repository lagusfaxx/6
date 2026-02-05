import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Servicios | UZEED",
  description: "Explora y reserva servicios en UZEED.",
};

export default function ServicesPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <h1 className="text-3xl font-semibold tracking-tight">Servicios</h1>
        <p className="mt-3 max-w-3xl text-sm text-white/80">
          Estamos preparando la experiencia para que puedas explorar y reservar servicios. Muy pronto
          tendremos novedades por aquí.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-white/80">
            Mientras tanto puedes explorar el directorio en{" "}
            <a className="underline hover:text-white" href="/inicio">
              Inicio
            </a>{" "}
            o revisar categorías disponibles.
          </p>
        </div>
      </div>
    </main>
  );
}
