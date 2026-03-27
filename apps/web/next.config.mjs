/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const apiHost = new URL(apiUrl).hostname;

const nextConfig = {
  output: "standalone",
  // Enable gzip/brotli compression for all responses
  compress: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["flow.cl", "www.flow.cl"],
    },
    // Tree-shake heavy packages — only imports actually used end up in the bundle
    optimizePackageImports: ["framer-motion", "lucide-react", "@radix-ui/react-icons"],
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
    // Shared security headers applied to every response
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
    ];

    return [
      {
        // Static JS/CSS assets — immutable, cached at CDN edge (Cloudflare) + browser
        source: '/_next/static/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        ],
      },
      {
        // Next.js optimized images — long CDN cache with stale-while-revalidate
        source: '/_next/image:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400',
          },
          { key: 'Vary', value: 'Accept' },
        ],
      },
      {
        // Static brand assets — immutable at both CDN and browser
        source: '/brand/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=2592000, s-maxage=2592000, immutable',
          },
        ],
      },
      {
        // Service worker — short cache so updates propagate quickly
        source: '/sw.js',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
      {
        // Manifest — cache at CDN, short browser cache
        source: '/manifest.webmanifest',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // HTML pages — no browser cache but allow Cloudflare edge cache (120s)
        // with stale-while-revalidate so users get instant loads from CDN
        source: '/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=120, stale-while-revalidate=60',
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
