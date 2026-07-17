import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',        // Рекомендуется для Vercel
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

export default nextConfig;
