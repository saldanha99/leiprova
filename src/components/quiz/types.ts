import {
  getCareerBySlug,
  getSubjectsForCareer,
  quizBanks,
  quizModes,
  quizSubjects,
} from "@/lib/quiz/catalog";
import type { QuizQuestionSource, QuizSessionQuestion } from "@/lib/quiz/session-contract";
import type { QuizExamEditionOption } from "@/lib/quiz/exam-edition-catalog";

export type QuizPath = "career" | "bank";
export type QuizExperienceMode = "training" | "exam";
export type QuizExamScope = "latest" | "all";

export type QuizConfig = {
  path: QuizPath;
  careerSlug?: string;
  specializationSlug?: string;
  examYear?: number;
  examEditionId?: string;
  bankSlug?: string;
  subjectSlug?: string;
  topicSlug?: string;
  mode?: string;
  count: 5 | 10 | 20;
  experience: QuizExperienceMode;
  timed: boolean;
  examScope: QuizExamScope;
};

export type QuizOption = {
  id: string;
  text: string;
};

export type QuizSource = QuizQuestionSource;

export type QuizQuestion = QuizSessionQuestion;

export type QuizTrainingFeedback = {
  isCorrect: boolean;
  correctOptionId: string;
  explanation: string;
  source: QuizSource;
};

export type QuizFinishAnswer = {
  questionId: string;
  selectedOptionId: string | null;
  correctOptionId: string;
  isCorrect: boolean;
  explanation: string;
  source: QuizSource;
};

export type QuizFinishPayload = {
  sessionId: string;
  status: "completed";
  result: {
    total: number;
    answered: number;
    correct: number;
    scorePercent: number;
  };
  answers: QuizFinishAnswer[];
};

export type QuizAvailability = {
  status: "ready" | "empty";
  reason?: string;
  message?: string;
};

export type QuizSessionSelection = {
  path: QuizPath;
  career?: unknown;
  specialization?: unknown;
  bank?: unknown;
  subject?: unknown;
  topic?: unknown;
  mode?: unknown;
  experience: QuizExperienceMode;
  timed: boolean;
  examScope: QuizExamScope;
  deadlineAt?: string | null;
  expiresAt?: string;
  examEdition?: unknown;
  availability: QuizAvailability;
};

export type QuizSessionPayload = {
  sessionId: string;
  deadlineAt?: string | null;
  expiresAt?: string;
  selection: QuizSessionSelection;
  questions: QuizQuestion[];
};

export type QuizAnswerMap = Record<string, string>;

export function isQuizConfigReady(
  config: QuizConfig,
  examEditions: readonly QuizExamEditionOption[] = [],
) {
  const modeExists = quizModes.some((mode) => mode.slug === config.mode);
  const bankExists = !config.bankSlug || quizBanks.some((bank) => bank.slug === config.bankSlug);
  const subjectExists = !config.subjectSlug || quizSubjects.some((subject) => subject.slug === config.subjectSlug);
  if (!modeExists || !bankExists || !subjectExists || (config.topicSlug && !config.subjectSlug)) return false;

  const subject = config.subjectSlug
    ? quizSubjects.find((item) => item.slug === config.subjectSlug)
    : undefined;
  if (config.topicSlug && !subject?.topics.some((topic) => topic.slug === config.topicSlug)) return false;

  if (config.path === "bank") {
    return Boolean(config.bankSlug && config.subjectSlug && !config.examEditionId && !config.examYear);
  }

  if (config.bankSlug) return false;

  const career = config.careerSlug ? getCareerBySlug(config.careerSlug) : undefined;
  if (!career) return false;
  if (config.subjectSlug && !getSubjectsForCareer(career.slug).some((item) => item.slug === config.subjectSlug)) {
    return false;
  }
  if (career.specializations.length) {
    if (!config.specializationSlug) return false;
    if (!career.specializations.some((item) => item.slug === config.specializationSlug)) return false;
  }

  const selectedEdition = config.examEditionId
    ? examEditions.find((edition) => edition.publicId === config.examEditionId)
    : undefined;
  if (config.examEditionId && !selectedEdition) return false;
  if (
    selectedEdition &&
    (selectedEdition.careerSlug !== career.slug ||
      selectedEdition.examYear !== config.examYear ||
      (selectedEdition.specializationSlug ?? undefined) !== (config.specializationSlug ?? undefined))
  ) {
    return false;
  }

  if (config.mode === "previous_exam") return Boolean(selectedEdition);
  if (config.mode === "original_style") return Boolean(selectedEdition && config.subjectSlug);
  return Boolean(config.subjectSlug);
}
