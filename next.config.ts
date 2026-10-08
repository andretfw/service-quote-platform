import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Netlify preview metadata exists at build time, not in the function runtime.
  // Embed only the public deployment URL so requests and redirects use that exact origin.
  env: {
    SERVICE_QUOTE_DEPLOYMENT_ORIGIN: ["deploy-preview", "branch-deploy"].includes(
      process.env.CONTEXT ?? "",
    )
      ? (process.env.DEPLOY_PRIME_URL?.trim() ?? "")
      : "",
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: securityHeaders,
    },
  ],
};

export default nextConfig;
