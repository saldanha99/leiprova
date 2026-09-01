import { describe, expect, it } from "vitest";

import { quizCareerTracks } from "@/lib/quiz/catalog";
import {
  brazilianFederativeUnits,
  seoGeoEditorialBriefs,
  seoGeoEditorialIntents,
} from "@/lib/seo/editorial-briefs";

describe("fila editorial SEO/GEO", () => {
  it("mantém pelo menos 600 pautas determinísticas de alta intenção", () => {
    expect(seoGeoEditorialBriefs).toHaveLength(
      brazilianFederativeUnits.length *
        quizCareerTracks.length *
        seoGeoEditorialIntents.length,
    );
    expect(seoGeoEditorialBriefs.length).toBeGreaterThanOrEqual(600);
    expect(seoGeoEditorialBriefs.every((brief) => brief.intent.journeyStage === "decision")).toBe(
      true,
    );
  });

  it("gera slugs e identificadores únicos", () => {
    const slugs = seoGeoEditorialBriefs.map((brief) => brief.slug);
    const ids = seoGeoEditorialBriefs.map((brief) => brief.id);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cobre as 27 UFs e todas as carreiras do catálogo atual", () => {
    const coveredUfCodes = new Set(seoGeoEditorialBriefs.map((brief) => brief.uf.code));
    const coveredCareerSlugs = new Set(
      seoGeoEditorialBriefs.map((brief) => brief.career.slug),
    );

    expect(brazilianFederativeUnits).toHaveLength(27);
    expect([...coveredUfCodes].sort()).toEqual(
      brazilianFederativeUnits.map((uf) => uf.code).sort(),
    );
    expect([...coveredCareerSlugs].sort()).toEqual(
      quizCareerTracks.map((career) => career.slug).sort(),
    );
  });

  it("mantém toda pauta planejada, inédita e fora da indexação", () => {
    for (const brief of seoGeoEditorialBriefs) {
      expect(brief.status).toBe("planned");
      expect(brief.indexable).toBe(false);
      expect(brief.publicationStatus).toBe("unpublished");
      expect(brief.blockingReason).toMatch(/revisão humana/i);
    }
  });

  it("exige fonte oficial e confirmação do responsável para a própria edição", () => {
    for (const brief of seoGeoEditorialBriefs) {
      expect(brief.officialEvidenceRequirements.length).toBeGreaterThanOrEqual(4);
      expect(brief.responsibleByEditionRequirement).toMatchObject({
        required: true,
        scope: "edition",
      });
      expect(brief.responsibleByEditionRequirement.rule).toContain(brief.career.name);
      expect(brief.responsibleByEditionRequirement.rule).toContain(brief.uf.code);
      expect(brief.responsibleByEditionRequirement.rejectionRule).toMatch(/não herdar banca/i);
      expect(brief.analysisRequirements.join(" ")).toMatch(/revisão humana/i);
    }
  });
});
