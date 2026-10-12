import { BRAND_NAME } from "@/lib/brand";

export const SITE_NAME = BRAND_NAME;
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://leiprova.2b.app.br"
).replace(/\/$/, "");

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOCIAL_IMAGE_PATH = "/brand/edital-lei-seca-social.png";
export const SOCIAL_IMAGE = {
  url: SOCIAL_IMAGE_PATH,
  width: 1200,
  height: 630,
  alt: `${BRAND_NAME} — lei seca guiada pelo edital`,
} as const;

export function absoluteUrl(path = "/") {
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const siteIdentityGraph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORGANIZATION_ID,
      name: SITE_NAME,
      url: absoluteUrl(),
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl("/brand/edital-lei-seca-logo.png"),
        width: 1200,
        height: 400,
      },
      description:
        "Plataforma educacional de treino ativo da literalidade de normas para concursos públicos.",
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: absoluteUrl(),
      name: SITE_NAME,
      inLanguage: "pt-BR",
      publisher: { "@id": ORGANIZATION_ID },
    },
  ],
} as const;
