import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

const PRIVATE_PATHS = [
  "/app$",
  "/app/",
  "/admin$",
  "/admin/",
  "/api$",
  "/api/",
  "/checkout",
  "/entrar",
  "/cadastro",
  "/ativar-acesso",
  "/recuperar-acesso",
  "/busca",
];

// Busca, assistentes e treino liberados (decisão D2 do Vinícius, 20/11/2026).
const AI_AND_SEARCH_AGENTS = [
  "Googlebot",
  "Bingbot",
  "Google-Extended",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "PerplexityBot",
  "Perplexity-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Applebot",
  "Applebot-Extended",
  "DuckAssistBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_AND_SEARCH_AGENTS, allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl(),
  };
}
