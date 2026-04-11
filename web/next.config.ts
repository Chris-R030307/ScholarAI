import type { NextConfig } from "next";

/**
 * Next.js 15+ (dev only) blocks `/_next/*` when the browser `Origin` host is not
 * localhost — common when you open the app via a LAN IP. HTML loads but scripts
 * return 403, so React never hydrates and clicks do nothing. Hostname patterns
 * only (no port); see `block-cross-site-dev` / `allowedDevOrigins` in Next docs.
 */
const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.*.*.*",
    "192.168.*.*",
    "172.*.*.*",
  ],
};

export default nextConfig;
