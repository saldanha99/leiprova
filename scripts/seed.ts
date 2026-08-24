import { createHash } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { DEMO_CONTENT_PROVENANCE, DEMO_QUESTIONS } from "../src/lib/demo-content";
import {
  examSourcePortals,
  legalActs,
  legalArticles,
  legalVersions,
  plans,
  questionOptions,
  questionStyleProfiles,
  questions,
  quizBanks,
  quizCareerSpecializations,
  quizCareerSubjects,
  quizCareerTracks,
  quizSubjects,
  quizTopics,
} from "../src/lib/db/schema";
import { STYLE_PROFILE_SEEDS } from "../src/lib/editorial/style-profiles";
import { OFFICIAL_EXAM_PORTALS } from "../src/lib/official-sources/exam-registry";
import { OFFICIAL_LEGAL_SOURCES } from "../src/lib/official-sources/legal-registry";
import { PLANS } from "../src/lib/plans";
import {
  quizBanks as quizBankCatalog,
  quizCareerTracks as quizCareerCatalog,
  quizSubjects as quizSubjectCatalog,
} from "../src/lib/quiz/catalog";

const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Defina MIGRATION_DATABASE_URL ou DATABASE_URL antes de executar o seed.");
}

const client = postgres(databaseUrl, { max: 1, prepare: false });
const db = drizzle(client);

function billingType(slug: string) {
  if (slug === "ritmo") return "month";
  if (slug === "foco") return "year";
  return "lifetime";
}

async function seedPlans() {
  for (const [sortOrder, plan] of PLANS.entries()) {
    await db
      .insert(plans)
      .values({
        slug: plan.slug,
        name: plan.name,
        description: plan.eyebrow,
        billingType: billingType(plan.slug),
        amountCents: plan.priceCents,
        features: [...plan.features],
        sortOrder,
      })
      .onConflictDoUpdate({
        target: plans.slug,
        set: {
          name: plan.name,
          description: plan.eyebrow,
          billingType: billingType(plan.slug),
          amountCents: plan.priceCents,
          features: [...plan.features],
          sortOrder,
          isActive: true,
          updatedAt: new Date(),
        },
      });
  }
}

async function seedQuizCatalog() {
  const now = new Date();

  await db
    .insert(quizBanks)
    .values(
      quizBankCatalog.map((bank) => ({
        slug: bank.slug,
        name: bank.name,
        fullName: bank.fullName,
      })),
    )
    .onConflictDoUpdate({
      target: quizBanks.slug,
      set: {
        name: sql`excluded.name`,
        fullName: sql`excluded.full_name`,
        isActive: true,
        updatedAt: now,
      },
    });

  const bankRows = await db.select({ id: quizBanks.id, slug: quizBanks.slug }).from(quizBanks);
  const bankIds = new Map(bankRows.map((row) => [row.slug, row.id]));

  await db
    .insert(questionStyleProfiles)
    .values(
      STYLE_PROFILE_SEEDS.map((profile) => {
        const quizBankId = bankIds.get(profile.bankSlug);
        if (!quizBankId) throw new Error(`Banca ausente no catálogo persistido: ${profile.bankSlug}`);

        return {
          quizBankId,
          version: 1,
          format: profile.format,
          commandStyle: profile.commandStyle,
          reasoningDemand: profile.reasoningDemand,
          authoringGuidelines: [...profile.authoringGuidelines],
          distractorGuidance: [...profile.distractorGuidance],
          prohibitedPatterns: [...profile.prohibitedPatterns],
          disclaimer: profile.disclaimer,
          isActive: true,
        };
      }),
    )
    .onConflictDoUpdate({
      target: questionStyleProfiles.quizBankId,
      set: {
        version: sql`excluded.version`,
        format: sql`excluded.format`,
        commandStyle: sql`excluded.command_style`,
        reasoningDemand: sql`excluded.reasoning_demand`,
        authoringGuidelines: sql`excluded.authoring_guidelines`,
        distractorGuidance: sql`excluded.distractor_guidance`,
        prohibitedPatterns: sql`excluded.prohibited_patterns`,
        disclaimer: sql`excluded.disclaimer`,
        isActive: true,
        updatedAt: now,
      },
    });

  await db
    .insert(quizCareerTracks)
    .values(
      quizCareerCatalog.map((career) => ({
        slug: career.slug,
        name: career.name,
        shortName: career.shortName,
        description: career.description,
        featured: career.featured,
      })),
    )
    .onConflictDoUpdate({
      target: quizCareerTracks.slug,
      set: {
        name: sql`excluded.name`,
        shortName: sql`excluded.short_name`,
        description: sql`excluded.description`,
        featured: sql`excluded.featured`,
        isActive: true,
        updatedAt: now,
      },
    });

  await db
    .insert(quizSubjects)
    .values(
      quizSubjectCatalog.map((subject) => ({
        slug: subject.slug,
        name: subject.name,
        shortName: subject.shortName,
      })),
    )
    .onConflictDoUpdate({
      target: quizSubjects.slug,
      set: {
        name: sql`excluded.name`,
        shortName: sql`excluded.short_name`,
        isActive: true,
        updatedAt: now,
      },
    });

  const careerRows = await db.select({ id: quizCareerTracks.id, slug: quizCareerTracks.slug }).from(quizCareerTracks);
  const subjectRows = await db.select({ id: quizSubjects.id, slug: quizSubjects.slug }).from(quizSubjects);
  const careerIds = new Map(careerRows.map((row) => [row.slug, row.id]));
  const subjectIds = new Map(subjectRows.map((row) => [row.slug, row.id]));

  const specializations = quizCareerCatalog.flatMap((career) => {
    const careerTrackId = careerIds.get(career.slug);
    if (!careerTrackId) throw new Error(`Carreira ausente no catálogo persistido: ${career.slug}`);
    return career.specializations.map((specialization) => ({
      careerTrackId,
      slug: specialization.slug,
      name: specialization.name,
    }));
  });

  if (specializations.length) {
    await db
      .insert(quizCareerSpecializations)
      .values(specializations)
      .onConflictDoUpdate({
        target: [quizCareerSpecializations.careerTrackId, quizCareerSpecializations.slug],
        set: {
          name: sql`excluded.name`,
          isActive: true,
          updatedAt: now,
        },
      });
  }

  const topics = quizSubjectCatalog.flatMap((subject) => {
    const subjectId = subjectIds.get(subject.slug);
    if (!subjectId) throw new Error(`Matéria ausente no catálogo persistido: ${subject.slug}`);
    return subject.topics.map((topic) => ({ subjectId, slug: topic.slug, name: topic.name }));
  });

  await db
    .insert(quizTopics)
    .values(topics)
    .onConflictDoUpdate({
      target: [quizTopics.subjectId, quizTopics.slug],
      set: {
        name: sql`excluded.name`,
        isActive: true,
        updatedAt: now,
      },
    });

  const careerSubjectRows = quizCareerCatalog.flatMap((career) => {
    const careerTrackId = careerIds.get(career.slug);
    if (!careerTrackId) throw new Error(`Carreira ausente no catálogo persistido: ${career.slug}`);
    return career.subjectSlugs.map((subjectSlug) => {
      const subjectId = subjectIds.get(subjectSlug);
      if (!subjectId) throw new Error(`Matéria inválida em ${career.slug}: ${subjectSlug}`);
      return { careerTrackId, subjectId };
    });
  });

  await db.insert(quizCareerSubjects).values(careerSubjectRows).onConflictDoNothing();

  const topicRows = await db
    .select({ id: quizTopics.id, slug: quizTopics.slug, subjectId: quizTopics.subjectId })
    .from(quizTopics);

  return {
    subjectIds,
    constitutionalTopicIds: new Map(
      topicRows
        .filter((row) => row.subjectId === subjectIds.get("direito-constitucional"))
        .map((row) => [row.slug, row.id]),
    ),
  };
}

async function seedOfficialSourceRegistries() {
  const now = new Date();

  await db
    .insert(legalActs)
    .values(
      OFFICIAL_LEGAL_SOURCES.map((source) => ({
        slug: source.slug,
        title: source.title,
        shortTitle: source.shortTitle,
        actType: source.actType,
        actNumber: source.actNumber,
        actYear: source.actYear,
        jurisdiction: "federal",
        officialUrl: source.officialUrl,
      })),
    )
    .onConflictDoUpdate({
      target: legalActs.slug,
      set: {
        title: sql`excluded.title`,
        shortTitle: sql`excluded.short_title`,
        actType: sql`excluded.act_type`,
        actNumber: sql`excluded.act_number`,
        actYear: sql`excluded.act_year`,
        jurisdiction: "federal",
        officialUrl: sql`excluded.official_url`,
        isActive: true,
        updatedAt: now,
      },
    });

  const bankRows = await db.select({ id: quizBanks.id, slug: quizBanks.slug }).from(quizBanks);
  const bankIds = new Map(bankRows.map((row) => [row.slug, row.id]));

  await db
    .insert(examSourcePortals)
    .values(
      OFFICIAL_EXAM_PORTALS.map((portal) => {
        const quizBankId = bankIds.get(portal.bankSlug);
        if (!quizBankId) throw new Error(`Banca ausente para portal oficial: ${portal.bankSlug}`);
        return { quizBankId, officialUrl: portal.officialUrl, sourcePolicy: "metadata_only" };
      }),
    )
    .onConflictDoUpdate({
      target: examSourcePortals.quizBankId,
      set: { officialUrl: sql`excluded.official_url`, sourcePolicy: "metadata_only", isActive: true, updatedAt: now },
    });
}

const DEMO_TOPIC_SLUGS: Readonly<Record<string, string>> = {
  "Direitos e garantias fundamentais": "direitos-e-garantias-fundamentais",
  "Princípios da administração pública": "administracao-publica",
  "Concurso público e investidura": "administracao-publica",
  "Concurso público e validade": "administracao-publica",
  "Estabilidade do servidor público": "administracao-publica",
  "Perda do cargo do servidor estável": "administracao-publica",
  "Atribuições do Presidente da República": "poder-executivo",
  "Segurança pública": "seguranca-publica",
  "Órgãos e atribuições da segurança pública": "seguranca-publica",
};

async function seedConstitution(catalog: Awaited<ReturnType<typeof seedQuizCatalog>>) {
  const [act] = await db
    .insert(legalActs)
    .values({
      slug: "constituicao-federal-1988",
      title: "Constituição da República Federativa do Brasil de 1988",
      shortTitle: "Constituição Federal",
      actType: "constituicao",
      actYear: 1988,
      jurisdiction: "federal",
      urn: "urn:lex:br:federal:constituicao:1988-10-05;1988",
      officialUrl: DEMO_QUESTIONS[0].officialUrl,
    })
    .onConflictDoUpdate({
      target: legalActs.slug,
      set: {
        officialUrl: DEMO_QUESTIONS[0].officialUrl,
        updatedAt: new Date(),
        isActive: true,
      },
    })
    .returning({ id: legalActs.id });

  const checksum = createHash("sha256")
    .update(JSON.stringify(DEMO_QUESTIONS.map(({ slug, literalText, verifiedAt }) => ({ slug, literalText, verifiedAt }))))
    .digest("hex");

  await db
    .insert(legalVersions)
    .values({
      legalActId: act.id,
      sourceUrl: DEMO_QUESTIONS[0].officialUrl,
      checksumSha256: checksum,
      validFrom: "1988-10-05",
      verifiedAt: new Date(`${DEMO_QUESTIONS[0].verifiedAt}T12:00:00Z`),
      status: "current",
    })
    .onConflictDoNothing({
      target: [legalVersions.legalActId, legalVersions.checksumSha256],
    });

  const [version] = await db
    .select({ id: legalVersions.id })
    .from(legalVersions)
    .where(eq(legalVersions.checksumSha256, checksum))
    .limit(1);

  const constitutionalSubjectId = catalog.subjectIds.get("direito-constitucional");
  if (!constitutionalSubjectId) throw new Error("Direito Constitucional ausente no catálogo persistido.");

  for (const [questionOrder, item] of DEMO_QUESTIONS.entries()) {
    const [article] = await db
      .insert(legalArticles)
      .values({
        legalVersionId: version.id,
        articleRef: item.articleRef,
        articleOrder: questionOrder + 1,
        heading: item.topic,
        path: item.articleRef.toLowerCase().replaceAll(" ", "-").replaceAll("º", "").replaceAll(",", ""),
        literalText: item.literalText,
        editorialStatus: "reviewed",
        sourceRights: "official_text",
      })
      .onConflictDoUpdate({
        target: [legalArticles.legalVersionId, legalArticles.path],
        set: {
          literalText: item.literalText,
          heading: item.topic,
          updatedAt: new Date(),
          editorialStatus: "reviewed",
        },
      })
      .returning({ id: legalArticles.id });
    const difficulty = item.difficulty === "easy" ? 1 : item.difficulty === "medium" ? 2 : 3;
    const topicSlug = DEMO_TOPIC_SLUGS[item.topic];
    const topicId = topicSlug ? catalog.constitutionalTopicIds.get(topicSlug) : undefined;
    if (!topicId) throw new Error(`Tópico constitucional não mapeado: ${item.topic}`);
    const [question] = await db
      .insert(questions)
      .values({
        publicId: item.slug,
        legalArticleId: article.id,
        subjectId: constitutionalSubjectId,
        topicId,
        quizMode: "dry_law",
        type: "literal_exact",
        prompt: item.prompt,
        explanation: item.explanation,
        topic: item.topic,
        difficulty,
        editorialStatus: "reviewed",
        sourceRights: "original_authorial",
        sourceTitle: "Questão original LeiProva assistida por IA e baseada em texto oficial",
        sourceUrl: item.officialUrl,
        authorshipMethod: DEMO_CONTENT_PROVENANCE.authorshipMethod,
        generatorModel: DEMO_CONTENT_PROVENANCE.generatorModel,
        promptVersion: DEMO_CONTENT_PROVENANCE.promptVersion,
        verifiedAt: new Date(`${item.verifiedAt}T12:00:00Z`),
      })
      .onConflictDoUpdate({
        target: questions.publicId,
        set: {
          legalArticleId: article.id,
          subjectId: constitutionalSubjectId,
          topicId,
          quizMode: "dry_law",
          prompt: item.prompt,
          explanation: item.explanation,
          topic: item.topic,
          difficulty,
          verifiedAt: new Date(`${item.verifiedAt}T12:00:00Z`),
          editorialStatus: "reviewed",
          sourceRights: "original_authorial",
          sourceTitle: "Questão original LeiProva assistida por IA e baseada em texto oficial",
          sourceUrl: item.officialUrl,
          authorshipMethod: DEMO_CONTENT_PROVENANCE.authorshipMethod,
          generatorModel: DEMO_CONTENT_PROVENANCE.generatorModel,
          promptVersion: DEMO_CONTENT_PROVENANCE.promptVersion,
          updatedAt: new Date(),
        },
      })
      .returning({ id: questions.id });

    for (const [sortOrder, option] of item.options.entries()) {
      await db
        .insert(questionOptions)
        .values({
          questionId: question.id,
          optionKey: option.id,
          text: option.text,
          isCorrect: option.id === item.correctOptionId,
          mutationKind: option.mutationKind,
          rationale: option.id === item.correctOptionId ? "Redação literal verificada na fonte oficial." : `Distrator por ${option.mutationKind}.`,
          sortOrder,
        })
        .onConflictDoUpdate({
          target: [questionOptions.questionId, questionOptions.optionKey],
          set: {
            text: option.text,
            isCorrect: option.id === item.correctOptionId,
            mutationKind: option.mutationKind,
            sortOrder,
          },
        });
    }
  }
}

async function main() {
  try {
    await seedPlans();
    const catalog = await seedQuizCatalog();
    await seedOfficialSourceRegistries();
    await seedConstitution(catalog);
    console.log(
      `Seed concluído: ${PLANS.length} planos, ${quizCareerCatalog.length} carreiras, ${quizSubjectCatalog.length} matérias e ${DEMO_QUESTIONS.length} questões originais assistidas por IA.`,
    );
  } finally {
    await client.end();
  }
}

void main().catch((error: unknown) => {
  console.error("Falha ao executar o seed.", error instanceof Error ? error.message : "Erro desconhecido.");
  process.exitCode = 1;
});
