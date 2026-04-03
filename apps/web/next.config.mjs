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

  // Modular imports — reduces bundle size by only including used modules
  modularizeImports: {
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{ kebabCase member }}",
    },
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
        // HTML pages — allow edge caching with stale-while-revalidate for faster TTFB
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
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
