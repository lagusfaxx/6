"use client";

import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06] bg-[#08081a] px-4 py-10 text-white/50">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2">
              <img
                src="/brand/isotipo-new.png"
                alt="Uzeed"
                className="h-8 w-8 object-contain"
              />
              <span className="text-lg font-semibold text-white">Uzeed</span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-white/40">
              Plataforma premium de experiencias para adultos. Discreción, elegancia y seguridad.
            </p>
          </div>

          {/* Explorar */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">
              Explorar
            </h3>
            <div className="grid gap-1.5">
              <Link href="/catalog" className="text-xs hover:text-white transition">
                Catálogo
              </Link>
              <Link href="/catalog?services=masajes" className="text-xs hover:text-white transition">
                Masajes
              </Link>
              <Link href="/catalog?services=videoLlamadas" className="text-xs hover:text-white transition">
                Videollamadas
              </Link>
              <Link href="/hospedajes" className="text-xs hover:text-white transition">
                Moteles
              </Link>
              <Link href="/sexshops" className="text-xs hover:text-white transition">
                Sex Shop
              </Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">
              Legal
            </h3>
            <div className="grid gap-1.5">
              <Link href="/terminos" className="text-xs hover:text-white transition">
                Términos y Condiciones
              </Link>
              <Link href="/privacidad" className="text-xs hover:text-white transition">
                Política de Privacidad
              </Link>
              <Link href="/cookies" className="text-xs hover:text-white transition">
                Política de Cookies
              </Link>
            </div>
          </div>

          {/* Cuenta */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/60">
              Cuenta
            </h3>
            <div className="grid gap-1.5">
              <Link href="/register" className="text-xs hover:text-white transition">
                Crear cuenta
              </Link>
              <Link href="/login" className="text-xs hover:text-white transition">
                Iniciar sesión
              </Link>
              <Link href="/cuenta" className="text-xs hover:text-white transition">
                Mi perfil
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 sm:flex-row">
          <p className="text-[11px] text-white/30">
            © {year} Uzeed. Todos los derechos reservados. Solo para mayores de 18 años.
          </p>
          <div className="flex gap-4">
            <Link href="/terminos" className="text-[11px] text-white/30 hover:text-white/50 transition">
              T&C
            </Link>
            <Link href="/privacidad" className="text-[11px] text-white/30 hover:text-white/50 transition">
              Privacidad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
