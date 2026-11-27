/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_URL || "http://localhost:8000";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Browser calls /api/* on the same origin; Next proxies them to FastAPI.
    // Large uploads can go straight to the backend by setting NEXT_PUBLIC_API_URL.
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
