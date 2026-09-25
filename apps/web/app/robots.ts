import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/dashboard",
        "/chat",
        "/chats",
        "/wallet",
        "/marketplace/compras",
        "/marketplace/vender",
        "/videocall",
        "/cuenta",
        "/favoritos",
        "/pago",
        "/ui",
        "/login",
        "/forgot-password",
        "/api/",
        // /_next/ NO se bloquea: ahí están el JS y el CSS que Google necesita
        // para renderizar ("Google Search won't render JavaScript from blocked files").
        "/calificar",
        "/perfil",
        "/live/studio",
        "/*?sort=*",
      ],
    },
    sitemap: "https://uzeed.cl/sitemap.xml",
  };
}
