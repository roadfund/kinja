import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep pages you have visited in the browser for 30 seconds, so going back to a tab is
    // instant. Saving anything still refreshes the page (router.refresh).
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
