import { describe, expect, it } from "vitest";

import { siteIdentityGraph } from "@/lib/seo";
import {
  ALLOWED_SCHEMA_TYPES,
  breadcrumbNode,
  collectTypes,
  faqPageNode,
  graph,
  itemListNode,
  legislationNode,
  organizationNode,
  quizNode,
  webPageNode,
  websiteNode,
  collectionPageNode,
} from "@/lib/seo/graph";
import { buildMetadata, seoTitle, truncateText } from "@/lib/seo/metadata";
import { caputExcerpt, parseLiteralText } from "@/lib/seo/literal-text";
import {
  canonicalLawSlug,
  canonicalLegalRequestPath,
  lawShortLabel,
  lawSlugAliases,
  normalizeArticleSegment,
} from "@/lib/seo/slugs";
import { lawDateFromTitle, ofLaw, sourceLabel } from "@/lib/seo/legal-format";

const servidores = { slug: "regime-juridico-servidores-federais", actType: "lei", actNumber: "8.112", actYear: 1990, shortTitle: "Regime dos Servidores Federais" };
const penal = { slug: "codigo-penal", actType: "decreto-lei", actNumber: "2.848", actYear: 1940, shortTitle: "Código Penal" };
const cf = { slug: "constituicao-federal-1988", actType: "constituicao", actNumber: null, actYear: 1988, shortTitle: "Constituição Federal" };

describe("slugs de lei e artigo (spec 2.3)", () => {
  it("normaliza a lei para tipo-numero-ano e os códigos para o nome popular", () => {
    expect(canonicalLawSlug(servidores)).toBe("lei-8112-1990");
    expect(canonicalLawSlug(penal)).toBe("codigo-penal");
    expect(canonicalLawSlug(cf)).toBe("constituicao-federal");
    expect(canonicalLawSlug({ slug: "lrf", actType: "lei-complementar", actNumber: "101", actYear: 2000 })).toBe(
      "lei-complementar-101-2000",
    );
    expect(lawSlugAliases(penal)).toEqual(["decreto-lei-2848-1940"]);
    expect(lawSlugAliases(cf)).toEqual(expect.arrayContaining(["constituicao-federal-1988", "cf-1988", "cf"]));
    expect(lawSlugAliases(servidores)).toEqual(["regime-juridico-servidores-federais"]);
    expect(lawShortLabel(servidores)).toBe("Lei 8.112/1990");
    expect(lawShortLabel(penal)).toBe("Código Penal");
  });

  it.each([
    ["art-5", "art-5"],
    ["art-5o", "art-5"],
    ["art-5º", "art-5"],
    ["Art-5", "art-5"],
    ["artigo-5", "art-5"],
    ["art.5", "art-5"],
    ["art-1a", "art-1-a"],
    ["art-1-A", "art-1-a"],
    ["art-359-m-a", "art-359-m-a"],
    ["adct-art-10", "adct-art-10"],
    ["art-05", "art-5"],
  ])("artigo %s vira %s", (raw, expected) => {
    expect(normalizeArticleSegment(raw)).toBe(expected);
  });

  it("recusa o que não é artigo", () => {
    expect(normalizeArticleSegment("artigos-mais-cobrados")).toBeNull();
    expect(normalizeArticleSegment("%E0%A4%A")).toBeNull();
  });

  it("decide o 301 do proxy sem banco", () => {
    expect(canonicalLegalRequestPath("/lei/constituicao-federal/art-5o")).toBe("/lei/constituicao-federal/art-5");
    expect(canonicalLegalRequestPath("/lei/decreto-lei-2848-1940")).toBe("/lei/codigo-penal");
    expect(canonicalLegalRequestPath("/lei/cf-1988/Art-5")).toBe("/lei/constituicao-federal/art-5");
    expect(canonicalLegalRequestPath("/Lei/codigo-penal")).toBe("/lei/codigo-penal");
    expect(canonicalLegalRequestPath("/lei/constituicao-federal/art-5")).toBeNull();
    expect(canonicalLegalRequestPath("/lei/lei-8112-1990")).toBeNull();
    expect(canonicalLegalRequestPath("/leis")).toBeNull();
  });
});

describe("texto literal com âncoras", () => {
  const art116 = [
    "Art. 116. São deveres do servidor:",
    "I - exercer com zelo e dedicação as atribuições do cargo;",
    "V - atender com presteza:",
    "a) ao público em geral;",
    "b) à expedição de certidões;",
    "Parágrafo único. A representação de que trata o inciso XII será encaminhada pela via hierárquica.",
  ].join("\n");

  it("gera ids estáveis e únicos para caput, inciso, alínea e parágrafo", () => {
    const blocks = parseLiteralText(art116);
    expect(blocks.map((block) => block.id)).toEqual(["caput", "inc-i", "inc-v", "inc-v-al-a", "inc-v-al-b", "par-unico"]);
    const cf37 = parseLiteralText("Art. 37. A administração...\nI - os cargos;\n§ 3º A lei disciplinará:\nI - as reclamações;\n§ 10. É vedada");
    expect(cf37.map((block) => block.id)).toEqual(["caput", "inc-i", "par-3", "par-3-inc-i", "par-10"]);
    expect(cf37[2].label).toBe("§ 3º");
  });

  it("resume o caput sem o marcador do artigo", () => {
    expect(caputExcerpt(art116)).toBe("São deveres do servidor:");
  });
});

describe("buildMetadata", () => {
  it("canonical absoluto, robots do gate e título até 60 caracteres", () => {
    const metadata = buildMetadata({
      path: "/lei/lei-8112-1990/art-116",
      title: "Art. 116 da Lei 8.112/1990: dos deveres do servidor público civil federal",
      description: "x ".repeat(200),
      index: false,
    });
    expect(metadata.alternates?.canonical).toBe("https://leiprova.2b.app.br/lei/lei-8112-1990/art-116");
    expect(metadata.robots).toEqual({ index: false, follow: true });
    const title = (metadata.title as { absolute: string }).absolute;
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith(" | Edital Lei Seca")).toBe(true);
    expect(String(metadata.description).length).toBeLessThanOrEqual(155);
    expect(buildMetadata({ path: "/leis", title: "Leis", description: "d", index: true }).robots).toEqual({ index: true, follow: true });
  });

  it("não corta título curto", () => {
    expect(seoTitle("Art. 5º da Constituição Federal")).toBe("Art. 5º da Constituição Federal | Edital Lei Seca");
    expect(truncateText("um dois três", 50)).toBe("um dois três");
  });
});

describe("geradores de JSON-LD", () => {
  const path = "/lei/lei-8112-1990/art-116";
  const nodes = [
    organizationNode(),
    websiteNode(),
    webPageNode({ path, name: "Art. 116", description: "d", dateModified: new Date("2026-11-20T00:00:00Z"), mainEntityId: "x", withEditorialAuthor: true }),
    collectionPageNode({ path: "/leis", name: "Leis", description: "d" }),
    breadcrumbNode(path, [
      { name: "Início", path: "/" },
      { name: "Leis", path: "/leis" },
    ]),
    legislationNode({ path, name: "Art. 116", identifier: "Lei 8.112/1990, art. 116", legislationType: "Lei", officialUrl: "https://www.planalto.gov.br/x", inForce: true, partOfId: "https://x/#legislation", date: "1990-12-11" }),
    quizNode({
      path,
      name: "Questões",
      aboutId: "a",
      questions: [{ anchorId: "questao-1", text: "Q?", kind: "true_false", correctAnswer: "Errado", comment: "Porque", wrongAnswers: ["Certo"] }],
    }),
    faqPageNode(path, [{ question: "O que diz?", answer: "Diz." }]),
    itemListNode("/leis", "Leis", [{ name: "Lei 8.112/1990", path: "/lei/lei-8112-1990" }]),
  ];

  it("usa só tipos do schema.org em inglês", () => {
    const types = collectTypes(graph(nodes));
    for (const type of types) expect(ALLOWED_SCHEMA_TYPES.has(type)).toBe(true);
    expect(types).toEqual(new Set(["Organization", "ImageObject", "WebSite", "WebPage", "CollectionPage", "BreadcrumbList", "ListItem", "Legislation", "Quiz", "Question", "Answer", "Comment", "FAQPage", "ItemList"]));
  });

  it("reaproveita a identidade do site e liga tudo por @id", () => {
    expect(organizationNode()).toEqual(siteIdentityGraph["@graph"][0]);
    const page = nodes[2];
    expect(page).toMatchObject({ "@id": `https://leiprova.2b.app.br${path}#webpage`, author: { "@id": "https://leiprova.2b.app.br/#organization" }, dateModified: "2026-11-20T00:00:00.000Z" });
    expect(nodes[5]).toMatchObject({ legislationJurisdiction: "BR", legislationLegalForce: "https://schema.org/InForce", legislationDate: "1990-12-11", isPartOf: { "@id": "https://x/#legislation" } });
    expect(nodes[6]).toMatchObject({ hasPart: [{ "@type": "Question", acceptedAnswer: { "@type": "Answer", text: "Errado" } }] });
    expect(graph(nodes)["@context"]).toBe("https://schema.org");
  });
});

describe("formatação", () => {
  it("lê a data da norma do título e nomeia a fonte", () => {
    expect(lawDateFromTitle("Lei nº 10.406, de 10 de janeiro de 2002 — Código Civil")).toBe("2002-01-10");
    expect(lawDateFromTitle("Lei nº 8.112, de 11 de dezembro de 1990")).toBe("1990-12-11");
    expect(lawDateFromTitle("Constituição da República Federativa do Brasil de 1988")).toBeNull();
    expect(sourceLabel("https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm")).toBe("Planalto");
    expect(sourceLabel("https://legis.senado.leg.br/norma/1")).toBe("Senado Federal");
    expect(ofLaw("Código Penal")).toBe("do Código Penal");
    expect(ofLaw("Lei 8.112/1990")).toBe("da Lei 8.112/1990");
  });
});
