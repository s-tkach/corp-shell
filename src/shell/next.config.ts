import type { NextConfig } from "next";

const CHILD_APP_ORIGINS = (process.env.CHILD_APP_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// CloudWatch RUM injects a script from this origin
const RUM_SCRIPT_ORIGIN = "https://client.rum.us-east-1.amazonaws.com";
const RUM_DATA_ORIGIN = "https://dataplane.rum.us-east-1.amazonaws.com";

const hasRum = !!process.env.NEXT_PUBLIC_RUM_APP_MONITOR_ID;

const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
const hasS3 = !!process.env.AWS_S3_BUCKET;
const S3_ORIGINS = hasS3
  ? [
      "https://*.s3.amazonaws.com",
      `https://*.s3.${AWS_REGION}.amazonaws.com`,
      "https://*.cloudfront.net",
    ]
  : [];

const isDev = process.env.NODE_ENV === "development";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${hasRum ? ` ${RUM_SCRIPT_ORIGIN}` : ""} ${CHILD_APP_ORIGINS.join(" ")}`.trimEnd(),
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:${S3_ORIGINS.length ? ` ${S3_ORIGINS.join(" ")}` : ""}`,
  `connect-src 'self'${hasRum ? ` ${RUM_DATA_ORIGIN}` : ""}${S3_ORIGINS.length ? ` ${S3_ORIGINS.join(" ")}` : ""} ${CHILD_APP_ORIGINS.join(" ")}`.trimEnd(),
  `font-src 'self'`,
  `frame-src 'none'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'${isDev ? " https:" : ""}`,
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
    remotePatterns: hasS3
      ? [
          { protocol: "https", hostname: "**.amazonaws.com" },
          { protocol: "https", hostname: "**.cloudfront.net" },
        ]
      : [],
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
