import type { MetadataRoute } from "next";

import { BRAND_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: "Treino de literalidade da lei para concursos públicos.",
    start_url: "/app",
    display: "standalone",
    background_color: "#060b13",
    theme_color: "#060b13",
    lang: "pt-BR",
    icons: [
      { src: "/brand/editalume-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/editalume-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
