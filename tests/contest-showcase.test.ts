import { describe, expect, it } from "vitest";
import { buildContestShowcase, type ShowcaseOpportunity } from "@/lib/commerce/contest-showcase";
import { CONTEST_CATALOG } from "@/lib/commerce/catalog";

const product = CONTEST_CATALOG[0];
const edition: ShowcaseOpportunity = {
  publicId: "edition-a", slug: "official-edition", productSlug: product.slug,
  categorySlug: product.categorySlug, institutionAcronym: product.acronym,
  roleName: product.role, cycleYear: 2026, jurisdictionCode: "SC",
  bankSlug: "fgv", bankName: "FGV", lifecycleStatus: "registration_open",
  statusAsOf: "2026-10-10", registrationStartsAt: "2026-10-01",
  registrationEndsAt: "2026-10-20", examDate: "2026-11-22",
  publishedAt: new Date("2026-10-01T12:00:00Z"),
};
const card = (item = edition, released = [product.slug]) => buildContestShowcase([item], released, "2026-10-11").find((row) => row.slug === product.slug)!;

describe("vitrine: fatos do edital separados da disponibilidade", () => {
  it("não atribui banca, novidade ou pré-edital a pesquisa de mercado", () => {
    const rows = buildContestShowcase([], [], "2026-10-11");
    expect(rows).toHaveLength(84);
    expect(rows.every((row) => row.phase === "planning" && !row.isNew && !row.available && row.bankSlug === null)).toBe(true);
  });
  it("inscrições abertas e novidade não implicam material pronto", () => {
    expect(card(edition, [])).toMatchObject({ phase: "open", isNew: true, available: false, bankName: "FGV" });
    expect(card()).toMatchObject({ phase: "open", available: true });
  });
  it("prova passada vira histórico mesmo com fase antiga e produto liberado", () => {
    expect(card({ ...edition, examDate: "2026-10-10" })).toMatchObject({ phase: "closed", phaseLabel: "Prova realizada", isNew: false, available: false, href: "/concursos/calendario#calendario-closed" });
  });
  it("cancelamento não anuncia prova realizada", () => {
    expect(card({ ...edition, lifecycleStatus: "canceled", examDate: "2026-10-10" })).toMatchObject({ phase: "closed", phaseLabel: "Encerrado" });
  });
  it("encerramento da inscrição não mantém selo de inscrição aberta", () => {
    expect(card({ ...edition, registrationEndsAt: "2026-10-10", lifecycleStatus: "registration_closed" }).phase).toBe("upcoming");
  });
  it("não transfere evidência de edição sem associação exata de produto", () => {
    const rows = buildContestShowcase([{ ...edition, productSlug: null }], [], "2026-10-11");
    expect(rows.find((row) => row.slug === product.slug)?.phase).toBe("planning");
    expect(rows.find((row) => row.slug === edition.publicId)).toMatchObject({ phase: "open", bankName: "FGV" });
  });
  it("novo tem janela de 30 dias em São Paulo, sem considerar atualização de cadastro", () => {
    expect(card({ ...edition, publishedAt: new Date("2026-09-11T02:00:00Z") }).isNew).toBe(false);
    expect(card({ ...edition, publishedAt: new Date("2026-09-11T12:00:00Z") }).isNew).toBe(true);
    expect(card({ ...edition, publishedAt: new Date("2026-10-12T12:00:00Z") }).isNew).toBe(false);
  });
});
