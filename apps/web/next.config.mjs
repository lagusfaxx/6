/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const apiHost = new URL(apiUrl).hostname;

const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      allowedOrigins: ["flow.cl", "www.flow.cl"],
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
        // HTML pages — revalidate on navigation
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
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
    return [];
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
