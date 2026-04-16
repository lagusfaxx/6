/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const apiHost = new URL(apiUrl).hostname;

const nextConfig = {
  output: "standalone",
  // Enable gzip/brotli compression for all responses
  compress: true,
  experimental: {
    // Tree-shake heavy packages — only imports actually used end up in the bundle
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "@radix-ui/react-icons",
      "@radix-ui/react-tabs",
      "@radix-ui/react-dialog",
      "date-fns",
      "zod",
      "mapbox-gl",
      "livekit-client",
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: apiHost,
      },
      {
        protocol: "http",
        hostname: apiHost,
      },
      {
        protocol: "https",
        hostname: "api.uzeed.cl",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [64, 128, 256, 384],
    minimumCacheTTL: 2592000, // 30 days
  },

  async headers() {
    return [
      {
        // Static JS/CSS assets — immutable with long cache
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Next.js image optimization cache
        source: '/_next/image:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // Static brand assets
        source: '/brand/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, immutable',
          },
        ],
      },
      {
        // Public directory pages — allow Google to cache for better crawl efficiency
        source: '/escorts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=600, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/services',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=600, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/masajistas',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=600, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/foro/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=300, stale-while-revalidate=300',
          },
        ],
      },
      {
        // HTML pages — no cache for dynamic/auth content
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com`,
              "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
              `img-src 'self' data: blob: https://api.uzeed.cl https://${apiHost} https://www.googletagmanager.com`,
              `connect-src 'self' https://api.uzeed.cl https://${apiHost} https://www.google-analytics.com https://api.mapbox.com https://events.mapbox.com wss://*.livekit.cloud`,
              `media-src 'self' blob: https://api.uzeed.cl https://${apiHost}`,
              "font-src 'self' data:",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // Generate unique build ID for cache busting
  generateBuildId: async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `build-${timestamp}`;
  },

  async redirects() {
    return [
      // ── Consolidate duplicate routes → single canonical URL ──
      { source: "/servicios", destination: "/services", permanent: true },
      { source: "/chats", destination: "/chat", permanent: true },
      { source: "/chats/:userId", destination: "/chat/:userId", permanent: true },
      { source: "/perfil/:username", destination: "/profile/:username", permanent: true },
      { source: "/sexshops", destination: "/sexshop", permanent: true },
      { source: "/hospedajes", destination: "/hospedaje", permanent: true },
      { source: "/hot", destination: "/premium", permanent: true },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
