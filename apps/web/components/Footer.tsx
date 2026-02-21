"use client";

import Link from "next/link";

const footerLinks = {
  "Explorar": [
    { label: "Escort", href: "/servicios?category=escort" },
    { label: "Masajes", href: "/servicios?category=masajes" },
    { label: "Trans", href: "/servicios?category=trans" },
    { label: "Moteles", href: "/servicios?type=space" },
    { label: "Sex Shop", href: "/sexshops" },
    { label: "Videollamadas", href: "/servicios?category=videollamadas" },
  ],
  "Ciudades": [
    { label: "Santiago", href: "/servicios?city=santiago" },
    { label: "Viña del Mar", href: "/servicios?city=vina-del-mar" },
    { label: "Valparaíso", href: "/servicios?city=valparaiso" },
    { label: "Concepción", href: "/servicios?city=concepcion" },
    { label: "Antofagasta", href: "/servicios?city=antofagasta" },
    { label: "Temuco", href: "/servicios?city=temuco" },
  ],
  "Cuenta": [
    { label: "Iniciar sesión", href: "/login" },
    { label: "Registro cliente", href: "/register?type=CLIENT" },
    { label: "Registro profesional", href: "/register?type=PROFESSIONAL" },
    { label: "Registro comercio", href: "/register?type=ESTABLISHMENT" },
    { label: "Mi cuenta", href: "/cuenta" },
  ],
  "Legal": [
    { label: "Términos y condiciones", href: "/terminos" },
    { label: "Política de privacidad", href: "/privacidad" },
    { label: "Contacto", href: "/contacto" },
  ],
};

export default function Footer() {
  return (
    <footer className="hidden border-t border-white/[0.06] bg-black/30 md:block">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">{title}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-white/40 transition hover:text-white/70"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 md:flex-row">
          <div className="flex items-center gap-3">
            <img src="/brand/isotipo-new.png" alt="UZEED" className="h-10 w-10 object-contain" />
            <div>
              <div className="text-lg font-semibold text-white/80">Uzeed</div>
              <div className="text-[11px] text-white/30">Plataforma #1 de experiencias en Chile</div>
            </div>
          </div>

          <div className="text-xs text-white/25">
            &copy; {new Date().getFullYear()} UZEED. Todos los derechos reservados. Solo mayores de 18 años.
          </div>
        </div>
      </div>
    </footer>
  );
}
