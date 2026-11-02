import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  serverExternalPackages: ["postgres", "pdfkit"],
  // The invoice route reads fonts and the logo from disk; make sure they ship with the function.
  outputFileTracingIncludes: { "/order/[number]/invoice": ["./src/lib/invoice-fonts/**", "./public/brand/logo-640.png"] },
  // Payment screenshots (checkout) still go through a server action; the 1 MB default rejects most phone photos.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [70, 80],
    // Product photos get a new URL when replaced, so optimised copies can be cached for a month.
    minimumCacheTTL: 2592000,
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1600],
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      ...(supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: "/storage/v1/object/public/**",
          } as const,
        ]
      : []),
    ],
    // Local development stack serves storage from 127.0.0.1.
    dangerouslyAllowLocalIP: supabaseUrl?.hostname === "127.0.0.1" || supabaseUrl?.hostname === "localhost",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/order/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
