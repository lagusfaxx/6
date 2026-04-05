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
      ],
    },
    sitemap: "https://uzeed.cl/sitemap.xml",
  };
}
