import { describe, expect, it } from "vitest";
import { CONTEST_CATALOG } from "@/lib/commerce/catalog";
import { buildCourseIntakeOrders } from "@/lib/editorial/course-intake";
import { agentInputHash, validateDiscoveryUrl } from "@/lib/editorial/agent-work-contract";
import research from "@/lib/editorial/course-source-research.json";

const products = CONTEST_CATALOG.map(({ slug }) => ({ slug, opportunityId: null }));
describe("entrada editorial de todos os cursos", () => {
  it("cria exatamente uma ordem por cada um dos 75 produtos, com meta individual de 68", () => {
    const orders = buildCourseIntakeOrders(products);
    expect(orders).toHaveLength(75);
    expect(new Set(orders.map(order => order.key)).size).toBe(75);
    for (const order of orders) {
      expect(order.payload.context.minimumQuestionCount).toBe(68);
      expect(order.payload.context.humanReviewRequired).toBe(true);
      expect(order.payload.context.researchIsApproval).toBe(false);
      expect(order.payload.articles).toEqual([]);
      expect(order.payload.bank).toBeUndefined();
      expect(order.payload.opportunityId).toBeUndefined();
      expect(JSON.stringify(order.payload)).not.toContain("decorandoaleiseca.com.br");
    }
  });
  it("não mistura identidade, fontes ou escopo entre cursos da mesma banca", () => {
    const orders = buildCourseIntakeOrders(products);
    for (const [index, order] of orders.entries()) {
      const course = CONTEST_CATALOG[index];
      expect(order.payload.context.productSlug).toBe(course.slug);
      expect(order.payload.role).toBe(course.role);
      expect(order.payload.context.identity).toMatchObject({ edition: course.editionLabel, jurisdictions: course.jurisdictionCodes });
      const reference = research.items.find(item => item.productSlug === course.slug)!;
      for (const url of order.payload.sourceUrls) {
        expect(reference.officialUrls.map(value => value.split("#")[0])).toContain(url);
        expect(validateDiscoveryUrl(url)).toBe(url);
      }
    }
  });
  it("não transforma hipótese de banca ou edição histórica em edital aprovado", () => {
    const orders = buildCourseIntakeOrders(products);
    expect(orders.filter(order => order.payload.context.researchStatus === "historical_edition")).toHaveLength(13);
    expect(orders.filter(order => order.payload.context.researchStatus === "pre_notice_only")).toHaveLength(3);
    for (const order of orders) expect(order.payload.instructions).toContain("sem mudar a oferta");
  });
  it("não burla política da FCC nem substitui uma origem bloqueada por concorrente", () => {
    const orders = buildCourseIntakeOrders(products);
    for (const order of orders) {
      expect(order.payload.sourceUrls.some(url => /concursosfcc\.com\.br\/concursos\//.test(url))).toBe(false);
      if (!order.payload.sourceUrls.length) expect(order.blockedReason).toBe("course_official_source_unavailable");
    }
    expect(orders.some(order => order.blockedReason)).toBe(true);
    expect(orders.some(order => !order.blockedReason)).toBe(true);
  });
  it("inclui automaticamente produto novo com pendência explícita, sem inventar pesquisa", () => {
    const newCourse = { ...CONTEST_CATALOG[0], slug: "novo-cargo-2027", role: "Novo cargo", editionLabel: "2027" };
    const orders = buildCourseIntakeOrders([...products, { slug: newCourse.slug, opportunityId: null }], [...CONTEST_CATALOG, newCourse]);
    expect(orders).toHaveLength(76);
    expect(orders.at(-1)).toMatchObject({ key: "course-intake:novo-cargo-2027", blockedReason: "course_research_missing" });
    expect(orders.at(-1)?.payload.sourceUrls).toEqual([]);
  });
  it("produto fora do catálogo não recebe identidade de outro curso", () => {
    const [order] = buildCourseIntakeOrders([{ slug: "fora-do-catalogo", opportunityId: null }]);
    expect(order.blockedReason).toBe("course_identity_missing");
    expect(order.payload.role).toBeUndefined();
  });
  it("produto já associado segue o fluxo do edital, sem nova descoberta genérica", () => {
    expect(buildCourseIntakeOrders([{ ...products[0], opportunityId: 123 }])).toEqual([]);
  });
  it("mantém chave e hash estáveis entre ciclos, mas invalida se a identidade mudar", () => {
    const first = buildCourseIntakeOrders(products);
    expect(buildCourseIntakeOrders(products).map(order => agentInputHash(order.payload))).toEqual(first.map(order => agentInputHash(order.payload)));
    const changed = CONTEST_CATALOG.map((course, index) => index === 0 ? { ...course, role: "Cargo diferente" } : course);
    const second = buildCourseIntakeOrders(products, changed);
    expect(second[0].key).toBe(first[0].key);
    expect(agentInputHash(second[0].payload)).not.toBe(agentInputHash(first[0].payload));
  });
  it("recusa registros duplicados e referências contendo origem não autorizada", () => {
    expect(() => buildCourseIntakeOrders([products[0], products[0]])).toThrow("duplicada");
    expect(() => buildCourseIntakeOrders(products, CONTEST_CATALOG, [research.items[0], research.items[0]])).toThrow("duplicada");
    expect(() => buildCourseIntakeOrders(products, CONTEST_CATALOG, [{ ...research.items[0], officialUrls: ["https://example.invalid/edital"] }])).toThrow();
  });
});
