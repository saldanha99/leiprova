import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Editalume",
    short_name: "Editalume",
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
