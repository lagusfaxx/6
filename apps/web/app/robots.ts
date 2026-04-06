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
        "/videocall",
        "/cuenta",
        "/favoritos",
        "/pago",
        "/ui",
        "/login",
        "/forgot-password",
        "/api/",
        "/_next/",
        "/calificar",
        "/perfil",
        "/live/studio",
        "/*?sort=*",
      ],
    },
    sitemap: "https://uzeed.cl/sitemap.xml",
  };
}
