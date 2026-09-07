import { describe, expect, it } from "vitest";
import { COURSE_DISCOVERY_SOURCES, isVerifiedCourseDiscoveryUrl } from "@/lib/editorial/course-discovery-sources";
import { validateDiscoveryUrl } from "@/lib/editorial/agent-work-contract";
import { parseOfficialOpportunitySourceUrl } from "@/lib/opportunities/source-monitor-policy";
import { buildCourseIntakeOrders } from "@/lib/editorial/course-intake";
import research from "@/lib/editorial/course-source-research.json";

describe("fontes conferidas para pesquisa individual", () => {
  it("admite só as páginas oficiais verificadas, sem ampliar autorização de captura", () => {
    for (const source of COURSE_DISCOVERY_SOURCES) for (const path of source.paths) {
      const url = `https://${source.host}${path}`;
      expect(isVerifiedCourseDiscoveryUrl(url)).toBe(true);
      expect(validateDiscoveryUrl(`${url}#edital`)).toBe(url);
      expect(() => parseOfficialOpportunitySourceUrl(url)).toThrow();
    }
  });
  it("aceita andamentos numéricos da edição exata do MPMS", () => {
    expect(isVerifiedCourseDiscoveryUrl("https://www.mpms.mp.br/concursos/49/andamentos/4448")).toBe(true);
    expect(isVerifiedCourseDiscoveryUrl("https://www.mpms.mp.br/concursos/50/andamentos/4448")).toBe(false);
  });
  it.each([
    "http://www.mpms.mp.br/concursos/49", "https://www.mpms.mp.br:8443/concursos/49",
    "https://user:secret@www.mpms.mp.br/concursos/49", "https://www.mpms.mp.br.example.org/concursos/49",
    "https://sub.www.mpms.mp.br/concursos/49", "https://www.mpms.mp.br/concursos/490",
    "https://www.mpms.mp.br/concursos/49?token=private", "https://www.mpms.mp.br/concursos/49/andamentos/login",
    "https://www.mpms.mp.br/concursos/49/andamentos/4448/caderno.pdf",
    "https://www.mpms.mp.br/concursos/49/andamentos/%34%34%34%38",
    "https://www.mpms.mp.br/concursos/49/andamentos/4448%2Flogin", "https://www.tjce.jus.br/wp-content/uploads/dje/edital.pdf",
    "https://www.tce.sp.gov.br/user/login", "https://www2.camara.leg.br/transparencia/recursos-humanos/concursos/provas-anteriores",
    "https://www.concursosfcc.com.br/concursos/edital.pdf", "https://www.vunesp.com.br/",
  ])("não amplia a pesquisa para %s", url => expect(isVerifiedCourseDiscoveryUrl(url)).toBe(false));
  it("desbloqueia cinco entradas sem confirmar identidade, banca ou publicação", () => {
    const slugs = ["tce-sp-auditor-dipe-direito-2026", "tj-ce-cartorios-reta-final",
      "tj-ce-analista-e-tecnico-2026", "mpe-ms-promotor-de-justica-2026", "camara-camara-dos-deputados-2026"];
    const orders = buildCourseIntakeOrders(research.items.map(item => ({ slug: item.productSlug, opportunityId: null })));
    for (const slug of slugs) {
      const order = orders.find(item => item.payload.context.productSlug === slug)!;
      expect(order.blockedReason).toBeNull();
      expect(order.payload.bank).toBeUndefined();
      expect(order.payload.opportunityId).toBeUndefined();
      expect(order.payload.context.humanReviewRequired).toBe(true);
      expect(order.payload.context.minimumQuestionCount).toBe(68);
    }
    expect(orders.filter(item => item.blockedReason)).toHaveLength(32);
  });
});
