import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel builds its own output; `standalone` is for self-hosted containers.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
