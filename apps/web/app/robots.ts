import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
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
          "/register",
          "/forgot-password",
        ],
      },
      {
        userAgent: "Googlebot",
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
          "/register",
          "/forgot-password",
        ],
      },
    ],
    sitemap: "https://uzeed.cl/sitemap.xml",
    host: "https://uzeed.cl",
  };
}
