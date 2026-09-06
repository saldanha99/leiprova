import type { Metadata } from "next";
import { Manrope, Geist_Mono } from "next/font/google";

import { JsonLd } from "@/components/seo/json-ld";
import { QaEnvironmentNotice } from "@/components/qa-environment-notice";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
import { SITE_URL, SOCIAL_IMAGE, SOCIAL_IMAGE_PATH, siteIdentityGraph } from "@/lib/seo";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    template: `%s | ${BRAND_NAME}`,
  },
  description:
    "Treine a literalidade da lei com questões originais, feedback imediato, fonte oficial e revisão espaçada para concursos públicos.",
  applicationName: BRAND_NAME,
  category: "education",
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  referrer: "origin-when-cross-origin",
  icons: {
    icon: [
      { url: "/brand/editalume-icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/editalume-icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/brand/editalume-icon-180.png", type: "image/png", sizes: "180x180" },
    ],
  },
  keywords: ["lei seca", "concursos públicos", "literalidade", "questões de direito", "revisão espaçada"],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    description: "Treinos curtos para memorizar prazos, exceções e competências cobrados em concursos.",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
    description: "Treinos curtos para memorizar prazos, exceções e competências cobrados em concursos.",
    images: [SOCIAL_IMAGE_PATH],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060b13",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${manrope.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <QaEnvironmentNotice />
        <JsonLd data={siteIdentityGraph} />
        {children}
      </body>
    </html>
  );
}
