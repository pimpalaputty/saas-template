import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks cross-origin requests to /_next/* dev resources by
  // default. Multi-tenant local dev hits the server from `*.lvh.me`, so
  // every tenant subdomain needs to be allowed for HMR + RSC payloads.
  allowedDevOrigins: ['*.lvh.me', 'lvh.me'],
};

export default nextConfig;
