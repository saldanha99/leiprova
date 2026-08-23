import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

const PUBLIC_PAGES = [
  { path: "/", lastModified: "2026-08-17", changeFrequency: "weekly", priority: 1 },
  {
    path: "/como-memorizar-lei-seca",
    lastModified: "2026-08-17",
    changeFrequency: "monthly",
    priority: 0.9,
  },
  {
    path: "/fontes-e-atualizacao",
    lastModified: "2026-08-17",
    changeFrequency: "monthly",
    priority: 0.9,
  },
  { path: "/demo", lastModified: "2026-08-17", changeFrequency: "monthly", priority: 0.8 },
  { path: "/termos", lastModified: "2026-08-16", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacidade", lastModified: "2026-08-16", changeFrequency: "yearly", priority: 0.2 },
  { path: "/reembolso", lastModified: "2026-08-16", changeFrequency: "yearly", priority: 0.2 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: new Date(`${page.lastModified}T00:00:00-03:00`),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
