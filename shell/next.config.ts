import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@corp/shell-sdk"],
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
