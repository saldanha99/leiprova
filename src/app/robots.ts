import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

const PRIVATE_PATHS = [
  "/app/",
  "/admin/",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "OAI-SearchBot", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "Googlebot", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl(),
  };
}
