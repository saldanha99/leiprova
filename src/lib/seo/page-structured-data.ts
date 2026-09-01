import { ORGANIZATION_ID, WEBSITE_ID, absoluteUrl } from "@/lib/seo";

type Breadcrumb = Readonly<{
  name: string;
  path: string;
}>;

type PublicWebPageStructuredDataInput = Readonly<{
  path: string;
  name: string;
  description: string;
  breadcrumbs: readonly Breadcrumb[];
  about?: readonly string[];
}>;

export function createPublicWebPageStructuredData({
  path,
  name,
  description,
  breadcrumbs,
  about = [],
}: PublicWebPageStructuredDataInput) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${absoluteUrl(path)}#webpage`,
        url: absoluteUrl(path),
        name,
        description,
        inLanguage: "pt-BR",
        isPartOf: { "@id": WEBSITE_ID },
        publisher: { "@id": ORGANIZATION_ID },
        ...(about.length > 0
          ? { about: about.map((subject) => ({ "@type": "Thing", name: subject })) }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${absoluteUrl(path)}#breadcrumb`,
        itemListElement: breadcrumbs.map((breadcrumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: breadcrumb.name,
          item: absoluteUrl(breadcrumb.path),
        })),
      },
    ],
  } as const;
}
