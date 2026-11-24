import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Required for OpenNext on Cloudflare
  output: "standalone",
};

export default nextConfig;

// Initialize OpenNext Cloudflare bindings in local next dev when available.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
