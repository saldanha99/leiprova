import { isOpportunityFreshForPublicCatalog } from "@/lib/opportunities/catalog-policy";
import type { InternalOpportunityCandidate } from "@/lib/opportunities/official-candidates";
import { parseOfficialOpportunitySourceUrl } from "@/lib/opportunities/source-monitor-policy";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const STAGES_REQUIRING_NOTICE_DATE = new Set([
  "notice_published",
  "registration_open",
  "registration_closed",
]);

const STAGES_REQUIRING_PRIMARY = new Set([
  "notice_published",
  "registration_open",
  "registration_closed",
]);

export type OpportunityApprovalValidation = Readonly<{
  candidateSlug: string;
  catalogEligible: boolean;
  sourceUrls: readonly string[];
  organizerCount: number;
}>;

function fail(candidate: InternalOpportunityCandidate, message: string): never {
  throw new Error(`[${candidate.slug}] ${message}`);
}

function requireCondition(
  candidate: InternalOpportunityCandidate,
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) fail(candidate, message);
}

function parseIsoDate(candidate: InternalOpportunityCandidate, label: string, value: string) {
  requireCondition(candidate, ISO_DATE_PATTERN.test(value), `${label} precisa usar AAAA-MM-DD.`);

  const parsed = new Date(`${value}T12:00:00.000Z`);
  requireCondition(
    candidate,
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value,
    `${label} é inválida.`,
  );
  return value;
}

function validateOptionalDate(
  candidate: InternalOpportunityCandidate,
  label: string,
  value: string | null,
) {
  return value === null ? null : parseIsoDate(candidate, label, value);
}

function validateCandidateDates(candidate: InternalOpportunityCandidate, todayIso: string) {
  const statusAsOf = parseIsoDate(candidate, "statusAsOf", candidate.statusAsOf);
  const noticePublishedAt = validateOptionalDate(
    candidate,
    "noticePublishedAt",
    candidate.noticePublishedAt,
  );
  const registrationStartsAt = validateOptionalDate(
    candidate,
    "registrationStartsAt",
    candidate.registrationStartsAt,
  );
  const registrationEndsAt = validateOptionalDate(
    candidate,
    "registrationEndsAt",
    candidate.registrationEndsAt,
  );
  const examDate = validateOptionalDate(candidate, "examDate", candidate.examDate);

  requireCondition(candidate, statusAsOf <= todayIso, "statusAsOf não pode estar no futuro.");
  requireCondition(
    candidate,
    Number(statusAsOf.slice(0, 4)) === candidate.cycleYear,
    "statusAsOf precisa pertencer ao ciclo informado.",
  );

  if (STAGES_REQUIRING_NOTICE_DATE.has(candidate.lifecycleStatus)) {
    requireCondition(
      candidate,
      noticePublishedAt,
      "a etapa atual exige a data oficial de publicação do edital.",
    );
  }

  if (noticePublishedAt) {
    requireCondition(
      candidate,
      noticePublishedAt <= statusAsOf,
      "a publicação do edital não pode ser posterior ao statusAsOf.",
    );
  }

  requireCondition(
    candidate,
    Boolean(registrationStartsAt) === Boolean(registrationEndsAt),
    "o período de inscrição precisa ter início e fim juntos.",
  );

  if (registrationStartsAt && registrationEndsAt) {
    requireCondition(
      candidate,
      registrationStartsAt <= registrationEndsAt,
      "o fim das inscrições não pode anteceder o início.",
    );
    if (noticePublishedAt) {
      requireCondition(
        candidate,
        noticePublishedAt <= registrationStartsAt,
        "o edital não pode ser publicado depois do início das inscrições.",
      );
    }
  }

  if (candidate.lifecycleStatus === "registration_open") {
    requireCondition(
      candidate,
      registrationStartsAt && registrationEndsAt,
      "inscrições abertas exigem o período oficial completo.",
    );
    requireCondition(
      candidate,
      registrationStartsAt <= statusAsOf && statusAsOf <= registrationEndsAt,
      "statusAsOf precisa estar dentro do período de inscrição aberto.",
    );
  }

  if (candidate.lifecycleStatus === "registration_closed") {
    requireCondition(
      candidate,
      registrationEndsAt,
      "inscrições encerradas exigem a data oficial de encerramento.",
    );
    requireCondition(
      candidate,
      registrationEndsAt < statusAsOf,
      "statusAsOf precisa ser posterior ao encerramento das inscrições.",
    );
  }

  if (examDate) {
    if (registrationEndsAt) {
      requireCondition(
        candidate,
        examDate >= registrationEndsAt,
        "a prova não pode anteceder o fim das inscrições.",
      );
    }
    requireCondition(
      candidate,
      examDate >= statusAsOf,
      "uma oportunidade ativa não pode apontar prova anterior ao statusAsOf.",
    );
  }
}

export function validateOfficialOpportunityCandidateForApproval(
  candidate: InternalOpportunityCandidate,
  todayIso: string,
): OpportunityApprovalValidation {
  parseIsoDate(candidate, "todayIso", todayIso);
  requireCondition(candidate, SLUG_PATTERN.test(candidate.slug), "slug inválido.");
  requireCondition(candidate, SLUG_PATTERN.test(candidate.categorySlug), "categoria inválida.");
  requireCondition(candidate, SLUG_PATTERN.test(candidate.careerSlug), "carreira inválida.");
  requireCondition(
    candidate,
    candidate.editorialStatus === "pending_review" && candidate.indexable === false,
    "o candidato de descoberta precisa permanecer pendente e não indexável.",
  );
  requireCondition(
    candidate,
    candidate.sourcePolicy === "metadata_only" && candidate.sourceContentStored === false,
    "a oportunidade deve operar estritamente em metadata_only.",
  );
  requireCondition(candidate, candidate.officialSources.length > 0, "ao menos uma fonte é obrigatória.");

  validateCandidateDates(candidate, todayIso);

  const sourceUrls = candidate.officialSources.map((source) => {
    requireCondition(
      candidate,
      source.status === "pending_review" &&
        source.sourcePolicy === "metadata_only" &&
        source.sourceContentStored === false,
      `a fonte ${source.url} precisa permanecer pendente e metadata_only no catálogo de descoberta.`,
    );
    return parseOfficialOpportunitySourceUrl(source.url, source.sourceId).url;
  });

  requireCondition(
    candidate,
    new Set(sourceUrls).size === sourceUrls.length,
    "a mesma URL oficial não pode aparecer duas vezes.",
  );

  const officialUrl = parseOfficialOpportunitySourceUrl(candidate.officialUrl).url;
  requireCondition(
    candidate,
    sourceUrls.includes(officialUrl),
    "officialUrl precisa corresponder exatamente a uma fonte oficial registrada.",
  );

  for (const signal of candidate.organizerSignals) {
    requireCondition(
      candidate,
      signal.status === "pending_review",
      `o responsável ${signal.organizationName} precisa partir de pending_review.`,
    );
    const sourceUrl = parseOfficialOpportunitySourceUrl(signal.sourceUrl).url;
    requireCondition(
      candidate,
      sourceUrls.includes(sourceUrl),
      `o responsável ${signal.organizationName} não possui fonte da mesma oportunidade.`,
    );
    requireCondition(
      candidate,
      !(
        (signal.responsibleType === "institutional_commission" ||
          signal.role === "logistics_provider") &&
        signal.quizBankSlug
      ),
      `o responsável ${signal.organizationName} não pode receber perfil de banca.`,
    );
  }

  for (const role of ["primary_responsible", "examination_provider"] as const) {
    requireCondition(
      candidate,
      candidate.organizerSignals.filter((signal) => signal.role === role).length <= 1,
      `a edição possui mais de um ${role} vigente.`,
    );
  }

  const currentPrimaryCount = candidate.organizerSignals.filter(
    (signal) => signal.role === "primary_responsible",
  ).length;
  if (STAGES_REQUIRING_PRIMARY.has(candidate.lifecycleStatus)) {
    requireCondition(
      candidate,
      currentPrimaryCount === 1,
      "a etapa atual exige exatamente um responsável primário.",
    );
  }

  const quizBanks = new Set(
    candidate.organizerSignals.flatMap((signal) =>
      signal.quizBankSlug ? [signal.quizBankSlug] : [],
    ),
  );
  requireCondition(
    candidate,
    quizBanks.size <= 1,
    "a edição não pode possuir perfis de banca conflitantes.",
  );

  return Object.freeze({
    candidateSlug: candidate.slug,
    catalogEligible: isOpportunityFreshForPublicCatalog(candidate, todayIso),
    sourceUrls: Object.freeze(sourceUrls),
    organizerCount: candidate.organizerSignals.length,
  });
}

export function validateOfficialOpportunityApprovalBatch(
  candidates: readonly InternalOpportunityCandidate[],
  todayIso: string,
) {
  if (!candidates.length) throw new Error("A fila de aprovação está vazia.");

  const slugs = candidates.map((candidate) => candidate.slug);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error("A fila de aprovação possui slugs duplicados.");
  }

  return Object.freeze(
    candidates.map((candidate) =>
      validateOfficialOpportunityCandidateForApproval(candidate, todayIso),
    ),
  );
}
