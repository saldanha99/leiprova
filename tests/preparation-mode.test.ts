import { describe, expect, it } from "vitest";
import { preparationEligibilityBlocker, preparationModeDescriptions } from "@/lib/commerce/preparation-mode";
import { parsePreparationModeArgs } from "../scripts/review-preparation-mode";
import { releaseBlockers } from "../scripts/release-contest-product";
import { buildContestShowcase } from "@/lib/commerce/contest-showcase";
import { CONTEST_CATALOG, catalogContestPath } from "@/lib/commerce/catalog";

const reference = {
  preparationMode: "historical_training", preparationReviewedAt: "2026-10-11T12:00:00Z",
  preparationReviewedByUserId: 1, preparationApprovalReference: "owner:program-exact-edition",
  preparationOpportunityUpdatedAt: "2026-10-10T12:00:00Z", opportunityUpdatedAt: "2026-10-10T12:00:00Z",
  lifecycleStatus: "exam_held", statusAsOf: "2026-10-10", registrationEndsAt: "2026-08-01",
  examDate: "2026-09-01", noticePublishedAt: "2026-01-01",
};
const today = "2026-10-11";
const contest = CONTEST_CATALOG[0];

describe("modos explícitos de preparação", () => {
  it("não converte automaticamente edital vencido em produto histórico", () => {
    expect(preparationEligibilityBlocker({ ...reference, preparationMode: undefined }, today)).toMatch(/fora do catálogo/);
    expect(preparationEligibilityBlocker(reference, today)).toBeNull();
    expect(preparationEligibilityBlocker({ ...reference, preparationMode: "pre_notice" }, today)).toBeNull();
  });
  it("requer revisão própria e da versão exata da edição", () => {
    expect(preparationEligibilityBlocker({ ...reference, preparationReviewedByUserId: null }, today)).toMatch(/revisão explícita/);
    expect(preparationEligibilityBlocker({ ...reference, preparationApprovalReference: null }, today)).toMatch(/revisão explícita/);
    expect(preparationEligibilityBlocker({ ...reference, opportunityUpdatedAt: "2026-10-10T12:00:01Z" }, today)).toMatch(/alterado/);
    expect(preparationEligibilityBlocker({ ...reference, preparationOpportunityUpdatedAt: null }, today)).toMatch(/alterado/);
  });
  it("não chama edital futuro, cancelado ou sem programa oficial de histórico", () => {
    for (const override of [{ examDate: "2026-10-11" }, { examDate: null }, { noticePublishedAt: null }, { lifecycleStatus: "canceled" }, { lifecycleStatus: "suspended" }]) {
      expect(preparationEligibilityBlocker({ ...reference, ...override }, today)).toMatch(/edição já realizada/);
    }
    expect(preparationEligibilityBlocker({ ...reference, preparationMode: "fake" }, today)).toMatch(/inválido/);
  });
  it("preserva questões mínimas, fonte revisada e PDF/dispensa na liberação histórica", () => {
    const state = { ...reference, status: "draft", stripeMode: "live", stripeProductId: "prod_fixture",
      monthlyPrice: "price_monthly", annualPrice: "price_annual", opportunityId: "1", editorialStatus: "reviewed",
      categorySlug: contest.categorySlug, questionCount: 68, previousExamLinked: true };
    expect(releaseBlockers(contest.slug, state, today)).toEqual([]);
    expect(releaseBlockers(contest.slug, { ...state, questionCount: 67 }, today)).toContain("67 de 68 questões aprovadas");
    expect(releaseBlockers(contest.slug, { ...state, previousExamLinked: false }, today)).toContain("sem prova anterior oficial aprovada nem dispensa registrada");
    expect(releaseBlockers(contest.slug, { ...state, editorialStatus: "draft" }, today)).toContain("sem edital oficial revisado");
  });
  it("separa oferta histórica da fase encerrada e pré-edital da banca futura", () => {
    const historical = buildContestShowcase([], [contest.slug], today, { [contest.slug]: "historical_training" }).find((card) => card.slug === contest.slug)!;
    expect(historical).toMatchObject({ available: true, phase: "closed", isNew: false, href: catalogContestPath(contest) });
    const pre = buildContestShowcase([], [contest.slug], today, { [contest.slug]: "pre_notice" }).find((card) => card.slug === contest.slug)!;
    expect(pre).toMatchObject({ available: true, phase: "planning", isNew: false, bankName: null });
    expect(preparationModeDescriptions.pre_notice).toContain("banca ainda precisam de confirmação");
    expect(preparationModeDescriptions.historical_training).toContain("legislação vigente");
  });
  it("comando exige declaração específica de conferência, sem liberar ou alterar oferta vendida", () => {
    const args = [`--product=${contest.slug}`, "--mode=pre_notice", "--program-confirmation=reviewed-official-baseline"];
    expect(parsePreparationModeArgs(args)).toEqual({ apply: false, productSlug: contest.slug, mode: "pre_notice" });
    expect(parsePreparationModeArgs([...args, "--apply"]).apply).toBe(true);
    expect(() => parsePreparationModeArgs(args.slice(0, 2))).toThrow(/Confirme/);
    expect(() => parsePreparationModeArgs([...args, "--mode=historical_training"])).toThrow(/repetidos/);
    expect(() => parsePreparationModeArgs([args[0], "--mode=current_notice", args[2]])).toThrow(/Use/);
  });
});
