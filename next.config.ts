import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * `upgrade-insecure-requests` e o HSTS não têm função no dev, que roda em
 * http://localhost, e quebram pré-visualização em navegadores WebKit: eles
 * reescrevem os assets para https://localhost e a página carrega sem CSS nem
 * JS. Em produção continuam valendo.
 */
/**
 * Rastreamento (LEI 10): só libera GTM/Stape e Meta quando o GTM estiver configurado
 * no build (NEXT_PUBLIC_GTM_ID). Sem ele, a política continua só com a Stripe.
 */
const gtmServerOrigin = (() => {
  const raw = process.env.NEXT_PUBLIC_GTM_SERVER_URL?.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.origin : "";
  } catch {
    return "";
  }
})();
const trackingOrigins = process.env.NEXT_PUBLIC_GTM_ID?.trim()
  ? [gtmServerOrigin, "https://www.googletagmanager.com", "https://connect.facebook.net", "https://www.facebook.com",
    "https://www.google-analytics.com"].filter(Boolean).join(" ")
  : "";
const withTracking = (directive: string) => (trackingOrigins ? `${directive} ${trackingOrigins}` : directive);

const contentSecurityPolicy = [
  "default-src 'self'",
  withTracking(`script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://js.stripe.com https://checkout.stripe.com`),
  "style-src 'self' 'unsafe-inline'",
  withTracking("img-src 'self' data: blob: https://*.stripe.com"),
  "font-src 'self' data:",
  withTracking("connect-src 'self' https://api.stripe.com https://checkout.stripe.com https://*.stripe.com https://*.stripe.network"),
  withTracking("frame-src https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://*.stripe.com"),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 80, 90],
  },
  outputFileTracingIncludes: {
    "/*": ["node_modules/@swc/helpers/**/*"],
  },
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
          ...(isDevelopment
            ? []
            : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      },
    ];
  },
};

export default nextConfig;
