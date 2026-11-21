import type { Metadata } from "next";

import { BRAND_NAME } from "@/lib/brand";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_PATH, absoluteUrl } from "@/lib/seo";

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

export type BuildMetadataInput = Readonly<{
  path: string;
  /** Title without the brand suffix; the suffix is appended here. */
  title: string;
  description: string;
  index: boolean;
  type?: "website" | "article";
  modifiedAt?: Date | null;
}>;

const SUFFIX = ` | ${BRAND_NAME}`;

/** Cuts at a word boundary and adds an ellipsis when needed. */
export function truncateText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > max * 0.6 ? cut.slice(0, boundary) : cut).replace(/[\s,;:.—-]+$/, "")}…`;
}

/** `{title} | Edital Lei Seca` within 60 characters, shortening the title only. */
export function seoTitle(title: string): string {
  return `${truncateText(title, TITLE_MAX - SUFFIX.length)}${SUFFIX}`;
}

/**
 * Metadata for public SEO pages: absolute self canonical, robots from the gate,
 * Open Graph aligned. `title.absolute` bypasses the layout template so the
 * length rule is enforced here.
 */
export function buildMetadata(input: BuildMetadataInput): Metadata {
  const canonical = absoluteUrl(input.path);
  const title = seoTitle(input.title);
  const description = truncateText(input.description, DESCRIPTION_MAX);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: input.index
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: input.type ?? "website",
      url: canonical,
      siteName: BRAND_NAME,
      locale: "pt_BR",
      title,
      description,
      images: [SOCIAL_IMAGE],
      ...(input.type === "article" && input.modifiedAt
        ? { modifiedTime: input.modifiedAt.toISOString() }
        : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: [SOCIAL_IMAGE_PATH] },
  };
}
