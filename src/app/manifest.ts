import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeiProva",
    short_name: "LeiProva",
    description: "Treino de literalidade da lei para concursos públicos.",
    start_url: "/app",
    display: "standalone",
    background_color: "#060b13",
    theme_color: "#060b13",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
