import { describe, expect, it } from "vitest";

import {
  getOfficialOpportunityCandidate,
  OFFICIAL_OPPORTUNITY_CANDIDATES,
} from "@/lib/opportunities/official-candidates";
import { parseOfficialOpportunitySourceUrl } from "@/lib/opportunities/source-monitor-policy";

describe("candidatos oficiais internos de oportunidades", () => {
  it("mantém todos os candidatos pendentes, metadata-only e fora de indexação", () => {
    expect(OFFICIAL_OPPORTUNITY_CANDIDATES.length).toBeGreaterThanOrEqual(6);

    for (const candidate of OFFICIAL_OPPORTUNITY_CANDIDATES) {
      expect(candidate.editorialStatus).toBe("pending_review");
      expect(candidate.indexable).toBe(false);
      expect(candidate.sourcePolicy).toBe("metadata_only");
      expect(candidate.sourceContentStored).toBe(false);
      expect(candidate.statusAsOf).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(candidate.officialSources.length).toBeGreaterThan(0);
      expect(Object.isFrozen(candidate)).toBe(true);
      expect(Object.isFrozen(candidate.officialSources)).toBe(true);

      for (const source of candidate.officialSources) {
        expect(source.status).toBe("pending_review");
        expect(source.sourcePolicy).toBe("metadata_only");
        expect(source.sourceContentStored).toBe(false);
        expect(() => parseOfficialOpportunitySourceUrl(source.url, source.sourceId)).not.toThrow();
      }

      for (const signal of candidate.organizerSignals) {
        expect(signal.status).toBe("pending_review");
        expect(candidate.officialSources.some((source) => source.url === signal.sourceUrl)).toBe(true);
      }

      if (
        ["notice_published", "registration_open", "registration_closed"].includes(
          candidate.lifecycleStatus,
        )
      ) {
        expect(
          candidate.organizerSignals.filter(
            (signal) => signal.role === "primary_responsible",
          ),
        ).toHaveLength(1);
      }
    }
  });

  it("inclui os recortes nacionais, policiais e municipal pesquisados", () => {
    expect(OFFICIAL_OPPORTUNITY_CANDIDATES.map((candidate) => candidate.slug)).toEqual([
      "enam-2026-2",
      "enac-2026-2",
      "pc-ba-2026",
      "pc-ma-2026",
      "pc-pr-2026",
      "pgm-manaus-2026",
    ]);
    expect(getOfficialOpportunityCandidate("enam-2026-2")?.lifecycleStatus).toBe(
      "registration_open",
    );
    expect(getOfficialOpportunityCandidate("pc-ma-2026")?.lifecycleStatus).toBe(
      "pre_notice",
    );
    expect(getOfficialOpportunityCandidate("inexistente")).toBeNull();
  });

  it("não herda banca para os pré-editais sem organizadora confirmada", () => {
    expect(getOfficialOpportunityCandidate("pc-ba-2026")?.organizerSignals).toEqual([]);
    expect(getOfficialOpportunityCandidate("pc-ma-2026")?.organizerSignals).toEqual([]);
    expect(getOfficialOpportunityCandidate("pc-pr-2026")?.organizerSignals).toMatchObject([
      {
        role: "primary_responsible",
        quizBankSlug: "fgv",
        status: "pending_review",
      },
    ]);
  });
});
