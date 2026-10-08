import type { NextConfig } from "next";

// Where the FastAPI backend lives. Read when the Next server starts (dev) or at
// `next build` time (prod), so set it before building for deployment.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Off on purpose: Cloudscape's Button calls Date.now() during render (internal
  // analytics id), which Cache Components rejects at `next build`. Our data is all
  // fetched client-side behind auth, so server component caching gains us nothing.
  cacheComponents: false,

  // Proxy /api/* to FastAPI so the browser only ever talks to this origin:
  // the session cookie stays same-origin and no CORS preflight is needed.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
