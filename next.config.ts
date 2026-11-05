import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.LABNOTE_E2E === "1" ? ".next-e2e" : ".next",
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
};

export default nextConfig;
