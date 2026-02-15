/** @type {import('next').NextConfig} */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const nextConfig = {
  output: "standalone",
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
