import { describe, expect, it } from "vitest";

import {
  isPublicStudyLifecycleStatus,
  isOpportunityFreshForPublicCatalog,
  PUBLIC_STUDY_LIFECYCLE_STATUSES,
} from "@/lib/opportunities/catalog-policy";

describe("política do catálogo ativo de oportunidades", () => {
  it("mantém públicas apenas edições que ainda podem orientar uma prova futura", () => {
    expect(PUBLIC_STUDY_LIFECYCLE_STATUSES).toContain("authorized");
    expect(PUBLIC_STUDY_LIFECYCLE_STATUSES).toContain("registration_open");
    expect(PUBLIC_STUDY_LIFECYCLE_STATUSES).toContain("exam_scheduled");

    for (const completedStatus of [
      "exam_held",
      "result_published",
      "homologated",
      "closed",
      "suspended",
      "canceled",
    ]) {
      expect(isPublicStudyLifecycleStatus(completedStatus)).toBe(false);
    }
  });

  it("remove inscrições vencidas, provas passadas e sinais antigos", () => {
    const today = "2026-09-01";

    expect(
      isOpportunityFreshForPublicCatalog(
        {
          lifecycleStatus: "registration_open",
          statusAsOf: "2026-08-31",
          registrationEndsAt: "2026-08-31",
          examDate: "2026-10-01",
        },
        today,
      ),
    ).toBe(false);
    expect(
      isOpportunityFreshForPublicCatalog(
        {
          lifecycleStatus: "exam_scheduled",
          statusAsOf: "2026-08-20",
          registrationEndsAt: null,
          examDate: "2026-08-30",
        },
        today,
      ),
    ).toBe(false);
    expect(
      isOpportunityFreshForPublicCatalog(
        {
          lifecycleStatus: "pre_notice",
          statusAsOf: "2026-08-31",
          registrationEndsAt: null,
          examDate: null,
        },
        today,
      ),
    ).toBe(true);
  });
});
