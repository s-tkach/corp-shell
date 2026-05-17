import type { NextConfig } from "next";

const CHILD_APP_ORIGINS = (process.env.CHILD_APP_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// CloudWatch RUM injects a script from this origin
const RUM_SCRIPT_ORIGIN = "https://client.rum.us-east-1.amazonaws.com";
const RUM_DATA_ORIGIN = "https://dataplane.rum.us-east-1.amazonaws.com";

const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${RUM_SCRIPT_ORIGIN} ${CHILD_APP_ORIGINS.join(" ")}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: https://*.amazonaws.com`,
  `connect-src 'self' ${RUM_DATA_ORIGIN} ${CHILD_APP_ORIGINS.join(" ")}`,
  `font-src 'self'`,
  `frame-src 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  ...(!isDev ? [`upgrade-insecure-requests`] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=()" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@corp/shell-sdk"],
  cacheComponents: true,
  experimental: {
    // Tree-shake large icon/component libraries to reduce initial bundle size
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
