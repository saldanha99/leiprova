import "server-only";

import { isDatabaseConfigured } from "@/lib/db/client";
import { listLawSnapshots } from "@/lib/seo/legal-data";
import type { LlmsLaw } from "@/lib/seo/llms";
import { lawInWave, seoWave } from "@/lib/seo/wave";

/** Gate-passing laws of the active wave, already ranked by contest products. */
export async function llmsLaws(): Promise<LlmsLaw[]> {
  const wave = seoWave();
  if (wave === "off" || !isDatabaseConfigured()) return [];
  const snapshots = await listLawSnapshots();
  return snapshots
    .filter((snapshot) => snapshot.gate.status === "index" && lawInWave(snapshot.path, wave))
    .map((snapshot) => ({
      label: snapshot.label,
      title: snapshot.law.title,
      shortTitle: snapshot.law.shortTitle,
      path: snapshot.path,
      officialUrl: snapshot.law.officialUrl,
      verifiedAt: snapshot.law.versionVerifiedAt,
      reviewedQuestions: snapshot.reviewedQuestionCount,
      topArticles: snapshot.topArticles
        .filter((article) => article.gate.status === "index")
        .map((article) => ({
          label: article.label,
          heading: article.heading,
          path: article.path,
          questions: article.reviewedQuestionCount,
          directAnswer: article.directAnswer,
        })),
    }));
}
