import { z } from "zod";

import { CONTEST_CATALOG, type CatalogContest } from "../commerce/catalog";
import { MINIMUM_COURSE_QUESTION_COUNT } from "../commerce/minimum-course-content";

// Lista exata das origens públicas presentes na pesquisa. Novas origens exigem
// conferência explícita; sufixos parecidos e subdomínios arbitrários não entram.
const officialHosts = new Set([
  "agencia.ac.gov.br", "app1.sefaz.mt.gov.br", "cdn.cebraspe.org.br",
  "cdnsite.institutoconsulplan.org.br", "concursos-serventias.cloud.cnj.jus.br",
  "conhecimento.fgv.br", "defensoria.ma.def.br", "dje-api.tjmt.jus.br",
  "hdl.handle.net", "mpt.mp.br", "noticias.institutoaocp.org.br", "pc.sc.gov.br",
  "pge.rj.gov.br", "portal-hml.tjmg.jus.br", "portal.fazenda.sp.gov.br",
  "portal.tjce.jus.br", "portalfadesp.org.br", "prt3.mpt.mp.br",
  "sistemas.institutoverbena.ufg.br", "social.avalia.org.br",
  "webdisk.diariooficial.rn.gov.br", "www.al.es.gov.br", "www.ba.gov.br",
  "www.cebraspe.org.br", "www.cnj.jus.br", "www.concursosfcc.com.br",
  "www.defensoria.mt.def.br", "www.diariooficial.rs.gov.br", "www.enfam.jus.br",
  "www.fundatec.org.br", "www.gov.br", "www.institutoaocp.org.br",
  "www.manaus.am.gov.br", "www.mpms.mp.br", "www.mpsc.mp.br", "www.mpsp.mp.br",
  "www.policiacivil.rj.gov.br", "www.policiapenal.rs.gov.br",
  "www.recursoshumanos.al.ms.gov.br", "www.tce.sp.gov.br", "www.tjce.jus.br",
  "www.tjdft.jus.br", "www.tjgo.jus.br", "www.tjmt.jus.br", "www.tjrj.jus.br",
  "www.trt6.jus.br", "www2.camara.leg.br",
]);
const publicQueryNames = new Set(["page", "page_id", "id", "concurso"]);
const privatePath = /(?:^|\/)(?:login|signin|sign-in|auth|oauth|admin|dashboard|account|accounts|api-keys|apikeys|senha|password|reset-password|minha-conta|area-do-candidato|candidato)(?:\/|\.|$)/iu;

/** Valida somente uma referência pública; não autentica nem acessa a URL. */
export function isOfficialCourseResearchUrl(value: string): boolean {
  try {
    if (value !== value.trim() || /[\s\\]/u.test(value)) return false;
    const url = new URL(value);
    if (url.protocol !== "https:" || !officialHosts.has(url.hostname) ||
        url.username || url.password || url.port) return false;
    const path = decodeURIComponent(url.pathname);
    if (path.includes("%") || privatePath.test(path) || /(?:sk|rk|pk)_(?:live|test)_/iu.test(path)) return false;
    // Handle é compartilhado por muitas instituições: aceitar só a coleção ENFAM.
    if (url.hostname === "hdl.handle.net" && !/^\/20\.500\.14782\/\d+$/u.test(path)) return false;
    for (const [key, queryValue] of url.searchParams) {
      if (!publicQueryNames.has(key) || !/^\d+$/u.test(queryValue) ||
          url.searchParams.getAll(key).length !== 1) return false;
    }
    return !url.hash || /^#page=\d+$/u.test(url.hash);
  } catch {
    return false;
  }
}

const text = z.string().trim().min(1).max(8_000);
const officialUrl = z.string().max(2_000).refine(isOfficialCourseResearchUrl, {
  message: "Use uma URL HTTPS pública de origem oficial autorizada, sem login ou credenciais.",
});
const timestamp = z.iso.datetime({ offset: true });
export const courseResearchStatusSchema = z.enum([
  "official_edition_found", "pre_notice_only", "needs_identity_review",
  "not_confirmed", "historical_edition",
]);
const evidenceSchema = z.object({
  url: officialUrl,
  title: text,
  kind: z.enum(["organ", "organizer", "notice", "amendment"]),
  observedFacts: text,
  checkedAt: timestamp,
}).strict();
export const courseResearchItemSchema = z.object({
  productSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u).max(200),
  status: courseResearchStatusSchema,
  editionDescription: text,
  examStage: text,
  bankNames: z.array(text).max(20),
  officialUrls: z.array(officialUrl).max(100),
  syllabusNotes: text,
  requirementLocator: text.nullable(),
  constraints: z.array(text).max(100),
  evidence: z.array(evidenceSchema).max(100),
  humanReview: z.literal("pending"),
  publicationAllowed: z.literal(false),
}).strict().superRefine((item, context) => {
  if (new Set(item.officialUrls).size !== item.officialUrls.length) {
    context.addIssue({ code: "custom", path: ["officialUrls"], message: "Fontes oficiais duplicadas." });
  }
  item.evidence.forEach((evidence, index) => {
    if (!item.officialUrls.includes(evidence.url)) {
      context.addIssue({ code: "custom", path: ["evidence", index, "url"], message: "Evidência fora das fontes do produto." });
    }
  });
});
export const courseResearchSchema = z.object({
  schemaVersion: z.literal(1),
  checkedAt: timestamp,
  items: z.array(courseResearchItemSchema).min(1).max(CONTEST_CATALOG.length),
}).strict();

export type CourseResearch = z.infer<typeof courseResearchSchema>;
export type CourseResearchItem = CourseResearch["items"][number];
export type CourseResearchStatus = CourseResearchItem["status"];
type ResearchCatalog = readonly Pick<CatalogContest, "slug">[];

/** A cobertura é exata por produto, nunca por órgão, cargo aproximado ou banca. */
export function parseCourseResearch(raw: unknown, catalog: ResearchCatalog = CONTEST_CATALOG): CourseResearch {
  const research = courseResearchSchema.parse(raw);
  const expected = new Set(catalog.map((contest) => contest.slug));
  const received = new Set(research.items.map((item) => item.productSlug));
  if (!expected.size || expected.size !== catalog.length || received.size !== research.items.length ||
      received.size !== expected.size || [...received].some((slug) => !expected.has(slug))) {
    throw new Error("Pesquisa deve conter exatamente um registro de cada produto do catálogo, sem omissões ou substituições.");
  }
  if (research.items.some((item) => item.evidence.some((evidence) =>
    Date.parse(evidence.checkedAt) > Date.parse(research.checkedAt)))) {
    throw new Error("A consolidação da pesquisa não pode anteceder a conferência de uma evidência.");
  }
  return research;
}

export const COURSE_PRODUCTION_NEXT_STEP_LABELS = {
  verify_official_source: "Conferir a fonte oficial",
  resolve_identity: "Resolver cargo e edição",
  wait_official_notice: "Confirmar publicação do edital",
  review_historical_edition: "Reavaliar edição histórica e oferta",
  verify_syllabus: "Conferir programa e retificações",
  review_draft_scope: "Revisar escopo antes de redigir inéditas",
} as const;
export type CourseProductionNextStep = keyof typeof COURSE_PRODUCTION_NEXT_STEP_LABELS;
export type CourseProductionWorkOrder = {
  productSlug: string;
  status: CourseResearchStatus;
  nextStep: CourseProductionNextStep;
  minimum68: typeof MINIMUM_COURSE_QUESTION_COUNT;
  research: CourseResearchItem;
  humanReview: "pending";
  publicationAllowed: false;
};

const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// O contrato v1 tem notas de conferência em texto, não uma atestação estruturada.
// Sinais afirmativos servem só para triagem conservadora; jamais para aprovação.
function hasInspectedEvidence(item: CourseResearchItem, noticeOnly = false) {
  return item.evidence.some((evidence) => {
    if (noticeOnly && evidence.kind !== "notice" && evidence.kind !== "amendment") return false;
    // Não consultar questões de prova é uma restrição correta, não falha de
    // leitura do edital. O restante das negações permanece conservador.
    const facts = normalize(evidence.observedFacts).replace(
      /nao foram (?:consultadas|abertas|reproduzidas) questoes de prova/gu, "",
    );
    const affirmative = /\b(?:conferid[oa]s?|consultad[oa]s?|lid[oa]s?|navegad[oa]s?)\b/u.test(facts) ||
      /\bnavegacao (?:confirmou|confirma)\b/u.test(facts);
    const blocked = /\b(?:waf|captcha|403|402|503|504|bloquei\w*|desafio)\b/u.test(facts);
    const unverified = /(?:nao (?:foi |foram |foi possivel )?(?:conferid|lid|consultad|acessad|valid|confirm)|(?:leitura|conferencia|texto integral|programa integral)[^.;]{0,45}pendente)/u.test(facts);
    return affirmative && !blocked && !unverified;
  });
}

function nextStepFor(item: CourseResearchItem): CourseProductionNextStep {
  if (item.status === "needs_identity_review") return "resolve_identity";
  if (item.status === "historical_edition") return "review_historical_edition";
  if (item.status === "pre_notice_only") return "wait_official_notice";
  if (item.status === "not_confirmed" || !hasInspectedEvidence(item)) return "verify_official_source";
  const locator = item.requirementLocator && normalize(item.requirementLocator);
  if (!locator || /(?:pendente|nao (?:foi |foram )?(?:localiz|conferid)|ainda nao)/u.test(locator) ||
      !hasInspectedEvidence(item, true)) return "verify_syllabus";
  return "review_draft_scope";
}

/** Plano puro e determinístico: não escreve, agenda, gera questões ou aprova nada. */
export function buildCourseProductionPlan(raw: unknown, catalog: ResearchCatalog = CONTEST_CATALOG): CourseProductionWorkOrder[] {
  const research = parseCourseResearch(raw, catalog);
  const bySlug = new Map(research.items.map((item) => [item.productSlug, item]));
  return catalog.map(({ slug }) => {
    const item = bySlug.get(slug)!;
    return {
      productSlug: slug,
      status: item.status,
      nextStep: nextStepFor(item),
      minimum68: MINIMUM_COURSE_QUESTION_COUNT,
      research: item,
      humanReview: "pending",
      publicationAllowed: false,
    };
  });
}
