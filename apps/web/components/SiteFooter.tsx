import Link from "next/link";

const columns = [
  {
    title: "Secciones escorts",
    links: [
      { href: "/explore?type=experience", label: "Cerca tuyo" },
      { href: "/profesionales", label: "Profesionales" },
      { href: "/servicios", label: "Servicios" },
    ],
  },
  {
    title: "Otras secciones",
    links: [
      { href: "/hospedajes", label: "Hospedajes" },
      { href: "/sexshops", label: "Sex Shop" },
      { href: "/establecimientos", label: "Establecimientos" },
    ],
  },
  {
    title: "Otros enlaces",
    links: [
      { href: "/register", label: "Crear cuenta" },
      { href: "/login", label: "Iniciar sesión" },
      { href: "/cuenta", label: "Mi cuenta" },
    ],
  },
  {
    title: "Comunícate con nosotros",
    links: [
      { href: "mailto:hola@uzeed.cl", label: "hola@uzeed.cl" },
      { href: "https://www.instagram.com/", label: "Instagram" },
      { href: "https://wa.me/56900000000", label: "WhatsApp" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-white/10 bg-[#080916]/90">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="text-sm font-semibold text-white">
                {column.title}
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="transition hover:text-fuchsia-300"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-white/10 pt-4 text-xs text-white/50">
          <p>
            Sitio exclusivo para mayores de 18 años. Usa UZEED de forma
            responsable y respetuosa.
          </p>
          <p className="mt-1">
            © {new Date().getFullYear()} UZEED. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
