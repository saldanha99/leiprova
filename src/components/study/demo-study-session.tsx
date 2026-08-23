"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  CircleHelp,
  Dice5,
  ExternalLink,
  Flag,
  Lightbulb,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import type { DemoQuestion, DemoQuestionOptionId } from "@/lib/demo-content";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "leiprova:demo-progress:v1";

const CONFIDENCE_OPTIONS = [
  {
    id: "guess",
    label: "Chute",
    helper: "Ainda não lembro",
    icon: Dice5,
    selectedClass: "border-slate-300/45 bg-slate-300/10 text-white",
  },
  {
    id: "almost",
    label: "Quase",
    helper: "Estou entre duas",
    icon: CircleHelp,
    selectedClass: "border-amber-300/55 bg-amber-300/10 text-amber-100",
  },
  {
    id: "sure",
    label: "Certo",
    helper: "Lembro a redação",
    icon: ShieldCheck,
    selectedClass: "border-emerald-300/55 bg-emerald-300/10 text-emerald-100",
  },
] as const;

type Confidence = (typeof CONFIDENCE_OPTIONS)[number]["id"];

type DemoResponse = {
  slug: string;
  selectedOptionId: DemoQuestionOptionId;
  confidence: Confidence;
  isCorrect: boolean;
};

type StoredProgress = {
  currentIndex: number;
  responses: DemoResponse[];
  completed: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConfidence(value: unknown): value is Confidence {
  return CONFIDENCE_OPTIONS.some((option) => option.id === value);
}

function readProgress(questions: readonly DemoQuestion[]): StoredProgress | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.responses)) {
      return null;
    }

    const responses: DemoResponse[] = [];

    for (const candidate of parsed.responses) {
      if (!isRecord(candidate)) continue;

      const slug = typeof candidate.slug === "string" ? candidate.slug : "";
      const question = questions.find((item) => item.slug === slug);
      if (!question || responses.some((item) => item.slug === slug)) continue;

      const selectedOptionId = candidate.selectedOptionId;
      const selectedOption = question.options.find((option) => option.id === selectedOptionId);
      if (!selectedOption || !isConfidence(candidate.confidence)) continue;

      responses.push({
        slug,
        selectedOptionId: selectedOption.id,
        confidence: candidate.confidence,
        isCorrect: selectedOption.id === question.correctOptionId,
      });
    }

    const storedIndex =
      typeof parsed.currentIndex === "number" && Number.isInteger(parsed.currentIndex)
        ? parsed.currentIndex
        : 0;
    const currentIndex = Math.min(Math.max(storedIndex, 0), questions.length - 1);

    return {
      currentIndex,
      responses,
      completed: parsed.completed === true && responses.length === questions.length,
    };
  } catch {
    return null;
  }
}

function confidenceLabel(confidence: Confidence) {
  return CONFIDENCE_OPTIONS.find((option) => option.id === confidence)?.label ?? "Não informado";
}

function calibrationMessage(response: DemoResponse) {
  if (response.isCorrect && response.confidence === "sure") {
    return "Sua confiança encontrou a literalidade. Ótimo sinal de recuperação.";
  }

  if (!response.isCorrect && response.confidence === "sure") {
    return "Você estava confiante: este artigo merece voltar mais cedo na revisão.";
  }

  if (response.isCorrect && response.confidence === "guess") {
    return "Você acertou no chute. Considere o artigo ainda em fase de fixação.";
  }

  if (!response.isCorrect && response.confidence === "guess") {
    return "O erro era esperado. Leia a redação abaixo e procure a palavra decisiva.";
  }

  return response.isCorrect
    ? "A dúvida foi resolvida corretamente. Mais uma repetição ajuda a consolidar."
    : "Você estava perto. Compare a alternativa escolhida com o texto literal.";
}

function difficultyLabel(difficulty: DemoQuestion["difficulty"]) {
  if (difficulty === "hard") return "Difícil";
  if (difficulty === "medium") return "Intermediária";
  return "Essencial";
}

function LoadingSession() {
  return (
    <div
      className="mx-auto grid min-h-[64vh] w-full max-w-6xl place-items-center px-5 py-12"
      role="status"
      aria-label="Carregando a sessão demonstrativa"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-12 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-300 shadow-[0_16px_45px_rgba(251,191,36,.12)] motion-safe:animate-pulse">
          <BookOpenCheck className="size-6" aria-hidden="true" />
        </span>
        <div>
          <p className="font-semibold text-white">Preparando seus artigos</p>
          <p className="mt-1 text-sm text-slate-500">Recuperando o progresso deste navegador…</p>
        </div>
      </div>
    </div>
  );
}

function SessionProgress({
  currentIndex,
  answeredCurrent,
  total,
}: {
  currentIndex: number;
  answeredCurrent: boolean;
  total: number;
}) {
  const completedSteps = currentIndex + (answeredCurrent ? 1 : 0);
  const percentage = Math.round((completedSteps / total) * 100);

  return (
    <section
      className="rounded-2xl border border-white/8 bg-white/[.035] p-4 shadow-[0_18px_60px_rgba(0,0,0,.18)] backdrop-blur-xl sm:p-5"
      aria-label="Progresso da sessão"
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-300">
            Rodada constitucional
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Questão <strong className="font-semibold text-slate-100">{currentIndex + 1}</strong> de {total}
          </p>
        </div>
        <span className="rounded-full border border-white/8 bg-slate-950/70 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-300">
          {percentage}% concluído
        </span>
      </div>

      <div
        className="grid h-1.5 gap-1.5"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completedSteps}
        aria-label={`${completedSteps} de ${total} questões concluídas`}
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn(
              "rounded-full bg-white/10 transition-colors duration-500",
              index < completedSteps && "bg-emerald-400",
              index === currentIndex && !answeredCurrent && "bg-amber-300",
            )}
            aria-hidden="true"
          />
        ))}
      </div>
    </section>
  );
}

function ConfidencePicker({
  value,
  disabled,
  onChange,
}: {
  value: Confidence | null;
  disabled: boolean;
  onChange: (value: Confidence) => void;
}) {
  return (
    <fieldset>
      <legend className="flex w-full items-center justify-between gap-3 text-sm font-semibold text-slate-200">
        <span>Antes de responder, qual é sua confiança?</span>
        <span className="hidden text-xs font-normal text-slate-500 sm:inline">Isso melhora sua revisão</span>
      </legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {CONFIDENCE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.id;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={cn(
                "flex min-h-16 items-center gap-3 rounded-xl border border-white/8 bg-slate-950/45 px-3.5 py-3 text-left text-slate-300 outline-none transition hover:border-white/20 hover:bg-white/[.045] focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09111d] disabled:cursor-default",
                isSelected && option.selectedClass,
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg bg-white/5 text-slate-400",
                  isSelected && "bg-white/10 text-current",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span>
                <strong className="block text-sm font-semibold text-current">{option.label}</strong>
                <small className="mt-0.5 block text-[11px] text-slate-500">{option.helper}</small>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function AnswerOptions({
  question,
  confidence,
  response,
  onAnswer,
}: {
  question: DemoQuestion;
  confidence: Confidence | null;
  response?: DemoResponse;
  onAnswer: (optionId: DemoQuestionOptionId) => void;
}) {
  return (
    <fieldset className="mt-7 border-t border-white/8 pt-6">
      <legend className="px-1 text-sm font-semibold text-slate-200">Escolha a redação exata</legend>
      {!confidence && !response && (
        <p id="confidence-hint" className="mt-1 text-xs leading-5 text-amber-200/75">
          Registre sua confiança acima para liberar as alternativas.
        </p>
      )}
      <div className="mt-4 grid gap-3">
        {question.options.map((option) => {
          const isSelected = response?.selectedOptionId === option.id;
          const isCorrect = option.id === question.correctOptionId;
          const revealCorrect = Boolean(response) && isCorrect;
          const revealWrong = Boolean(response) && isSelected && !isCorrect;

          return (
            <button
              key={option.id}
              type="button"
              disabled={!confidence || Boolean(response)}
              aria-pressed={isSelected}
              aria-describedby={!confidence && !response ? "confidence-hint" : undefined}
              onClick={() => onAnswer(option.id)}
              className={cn(
                "group flex min-h-16 w-full items-start gap-3 rounded-2xl border border-white/8 bg-slate-950/55 p-3.5 text-left text-sm leading-6 text-slate-300 outline-none transition sm:gap-4 sm:p-4 sm:text-[15px]",
                confidence && !response &&
                  "cursor-pointer hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-amber-300/[.035] focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09111d]",
                !confidence && !response && "cursor-not-allowed opacity-55",
                revealCorrect && "border-emerald-300/50 bg-emerald-300/[.08] text-emerald-50",
                revealWrong && "border-rose-300/45 bg-rose-300/[.07] text-rose-50",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold uppercase text-slate-400 transition",
                  confidence && !response && "group-hover:border-amber-300/30 group-hover:text-amber-200",
                  revealCorrect && "border-emerald-300/40 bg-emerald-300/15 text-emerald-200",
                  revealWrong && "border-rose-300/35 bg-rose-300/15 text-rose-200",
                )}
                aria-hidden="true"
              >
                {option.id}
              </span>
              <span className="flex-1">{option.text}</span>
              {revealCorrect && (
                <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-400 text-slate-950">
                  <Check className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">Alternativa correta</span>
                </span>
              )}
              {revealWrong && (
                <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-rose-400 text-slate-950">
                  <X className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">Alternativa incorreta selecionada</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SessionGuide() {
  const steps = [
    [Target, "Declare sua confiança", "Diferencie memória real de reconhecimento."],
    [Lightbulb, "Compare as palavras", "Procure prazo, agente, negação e alcance."],
    [BookOpenCheck, "Leia a literalidade", "A fonte oficial aparece após cada resposta."],
  ] as const;

  return (
    <aside className="rounded-[1.5rem] border border-white/8 bg-white/[.035] p-5 shadow-[0_22px_70px_rgba(0,0,0,.2)] backdrop-blur-xl sm:p-6">
      <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-amber-300">
        <Sparkles className="size-3.5" aria-hidden="true" />
        Método em ação
      </span>
      <h2 className="mt-3 text-xl font-semibold tracking-[-.03em] text-white">
        Uma questão, três decisões de memória.
      </h2>
      <div className="mt-6 grid gap-5">
        {steps.map(([Icon, title, description], index) => (
          <div className="flex gap-3.5" key={title}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/8 bg-slate-950/65 text-emerald-300">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                <span className="mr-2 text-xs text-slate-600">0{index + 1}</span>
                {title}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-7 flex gap-3 rounded-xl border border-emerald-300/10 bg-emerald-300/[.045] p-3.5 text-xs leading-5 text-emerald-100/75">
        <LockKeyhole className="mt-0.5 size-4 shrink-0 text-emerald-300" aria-hidden="true" />
        <p>Seu avanço desta demonstração fica salvo somente neste navegador.</p>
      </div>
    </aside>
  );
}

function AnswerFeedback({
  question,
  response,
  isLast,
  onAdvance,
}: {
  question: DemoQuestion;
  response: DemoResponse;
  isLast: boolean;
  onAdvance: () => void;
}) {
  return (
    <aside
      className={cn(
        "rounded-[1.5rem] border p-5 shadow-[0_22px_70px_rgba(0,0,0,.22)] backdrop-blur-xl sm:p-6",
        response.isCorrect
          ? "border-emerald-300/20 bg-emerald-300/[.055]"
          : "border-rose-300/20 bg-rose-300/[.045]",
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            response.isCorrect
              ? "bg-emerald-400 text-slate-950"
              : "bg-rose-400 text-slate-950",
          )}
        >
          {response.isCorrect ? (
            <Check className="size-5" aria-hidden="true" />
          ) : (
            <X className="size-5" aria-hidden="true" />
          )}
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-slate-400">
            Feedback imediato
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-white">
            {response.isCorrect ? "Literalidade preservada." : "Uma mutação passou."}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">{calibrationMessage(response)}</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-300/20 bg-[#0a111c]/80 p-4 shadow-inner shadow-black/20">
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-amber-300">
          <BookOpenCheck className="size-3.5" aria-hidden="true" />
          Redação literal
        </span>
        <blockquote className="mt-3 border-l-2 border-amber-300/55 pl-3.5 text-sm font-medium leading-6 text-slate-100">
          {question.literalText}
        </blockquote>
      </div>

      <div className="mt-5">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">Por que?</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{question.explanation}</p>
      </div>

      <div className="mt-5 rounded-xl border border-white/8 bg-slate-950/45 p-3.5">
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-600">
          Fonte oficial · verificada em 16/08/2026
        </p>
        <p className="mt-1.5 text-xs font-semibold text-slate-300">
          {question.legalAct} · {question.articleRef}
        </p>
        <a
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 outline-none transition hover:text-emerald-200 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-emerald-300"
          href={question.officialUrl}
          target="_blank"
          rel="noreferrer"
        >
          Conferir no Planalto
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
        <p className="mt-3 text-[10px] leading-4 text-slate-600">
          Trecho meramente informativo e não oficial; não substitui a publicação no Diário Oficial da União.
        </p>
      </div>

      <button
        type="button"
        onClick={onAdvance}
        className="group mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 shadow-[0_15px_45px_rgba(251,191,36,.16)] outline-none transition hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09111d]"
      >
        {isLast ? "Ver meu resultado" : "Próxima questão"}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    </aside>
  );
}

function CompletionScreen({
  questions,
  responses,
  headingRef,
  onReset,
}: {
  questions: readonly DemoQuestion[];
  responses: readonly DemoResponse[];
  headingRef: RefObject<HTMLHeadingElement | null>;
  onReset: () => void;
}) {
  const correctCount = responses.filter((response) => response.isCorrect).length;
  const confidentMisses = responses.filter(
    (response) => !response.isCorrect && response.confidence === "sure",
  ).length;
  const score = Math.round((correctCount / questions.length) * 100);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a121e]/90 shadow-[0_35px_120px_rgba(0,0,0,.38)] backdrop-blur-2xl">
        <div className="relative border-b border-white/8 px-6 py-10 text-center sm:px-10 sm:py-12">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,.16),transparent_48%),radial-gradient(circle_at_85%_100%,rgba(251,191,36,.1),transparent_34%)]"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid size-16 place-items-center rounded-2xl border border-amber-200/25 bg-amber-300/10 text-amber-300 shadow-[0_20px_60px_rgba(251,191,36,.14)]">
            <Trophy className="size-8" aria-hidden="true" />
          </div>
          <p className="relative mt-6 text-[11px] font-bold uppercase tracking-[.22em] text-emerald-300">
            Sessão concluída
          </p>
          <h2
            ref={headingRef}
            className="relative mx-auto mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-[-.045em] text-white sm:text-4xl"
            tabIndex={-1}
          >
            Você não só respondeu. Você comparou a lei palavra por palavra.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
            Este foi um recorte da experiência LeiProva. Seu resultado mostra acerto e também onde a confiança merece calibração.
          </p>
        </div>

        <div className="p-5 sm:p-8 lg:p-10">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.055] p-5">
              <p className="text-xs font-semibold text-emerald-200/70">Acertos</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-.04em] text-white">
                {correctCount}<span className="text-base text-slate-500">/{questions.length}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.05] p-5">
              <p className="text-xs font-semibold text-amber-200/70">Aproveitamento</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-.04em] text-white">{score}%</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[.035] p-5">
              <p className="text-xs font-semibold text-slate-500">Confiança para revisar</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-.04em] text-white">
                {confidentMisses}
                <span className="ml-1.5 text-sm font-normal text-slate-500">
                  {confidentMisses === 1 ? "alerta" : "alertas"}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[.18em] text-slate-500">
                    Seu percurso
                  </p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-white">
                    Cinco artigos revisitados
                  </h2>
                </div>
                <Flag className="size-5 text-emerald-300" aria-hidden="true" />
              </div>

              <ol className="mt-5 grid gap-2.5">
                {questions.map((question, index) => {
                  const response = responses.find((item) => item.slug === question.slug);
                  return (
                    <li
                      key={question.slug}
                      className="flex items-center gap-3 rounded-xl border border-white/8 bg-slate-950/45 p-3.5"
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg",
                          response?.isCorrect
                            ? "bg-emerald-300/12 text-emerald-300"
                            : "bg-rose-300/10 text-rose-300",
                        )}
                      >
                        {response?.isCorrect ? (
                          <Check className="size-4" aria-hidden="true" />
                        ) : (
                          <X className="size-4" aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-semibold text-slate-200">
                          {question.articleRef} · {question.topic}
                        </strong>
                        <small className="mt-0.5 block text-xs text-slate-500">
                          Confiança: {response ? confidenceLabel(response.confidence) : "—"}
                        </small>
                      </span>
                      <span className="text-xs tabular-nums text-slate-600">0{index + 1}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            <aside className="relative overflow-hidden rounded-2xl border border-amber-300/20 bg-amber-300/[.065] p-6">
              <div
                className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-amber-300/10 blur-3xl"
                aria-hidden="true"
              />
              <CheckCircle2 className="relative size-7 text-amber-300" aria-hidden="true" />
              <h2 className="relative mt-5 text-2xl font-semibold tracking-[-.04em] text-white">
                Faça cada artigo voltar no momento certo.
              </h2>
              <p className="relative mt-3 text-sm leading-6 text-slate-400">
                Crie sua conta para liberar trilhas, histórico e revisão espaçada por desempenho.
              </p>
              <Link
                href="/cadastro"
                className="group relative mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-center text-sm font-bold text-slate-950 shadow-[0_15px_45px_rgba(251,191,36,.16)] outline-none transition hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101722]"
              >
                Criar minha conta grátis
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <button
                type="button"
                onClick={onReset}
                className="relative mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-slate-400 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Refazer demonstração
              </button>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

export function DemoStudySession({ questions }: { questions: readonly DemoQuestion[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<DemoResponse[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [completed, setCompleted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const questionCardRef = useRef<HTMLElement>(null);
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      const restored = readProgress(questions);

      if (restored) {
        const restoredQuestion = questions[restored.currentIndex];
        const restoredResponse = restoredQuestion
          ? restored.responses.find((response) => response.slug === restoredQuestion.slug)
          : undefined;

        setCurrentIndex(restored.currentIndex);
        setResponses(restored.responses);
        setConfidence(restoredResponse?.confidence ?? null);
        setCompleted(restored.completed);
      }

      setIsReady(true);
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [questions]);

  useEffect(() => {
    if (!isReady) return;

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          currentIndex,
          responses,
          completed,
        }),
      );
    } catch {
      // A sessão continua funcional mesmo quando o navegador bloqueia o armazenamento local.
    }
  }, [completed, currentIndex, isReady, responses]);

  if (!isReady) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#050a12] text-slate-100">
        <LoadingSession />
      </div>
    );
  }

  function selectAnswer(optionId: DemoQuestionOptionId) {
    const question = questions[currentIndex];
    if (!question || !confidence || responses.some((response) => response.slug === question.slug)) {
      return;
    }

    setResponses((current) => [
      ...current,
      {
        slug: question.slug,
        selectedOptionId: optionId,
        confidence,
        isCorrect: optionId === question.correctOptionId,
      },
    ]);
  }

  function advance() {
    const question = questions[currentIndex];
    const response = question
      ? responses.find((item) => item.slug === question.slug)
      : undefined;
    if (!response) return;

    if (currentIndex === questions.length - 1) {
      setCompleted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.setTimeout(() => completionHeadingRef.current?.focus(), 0);
      return;
    }

    const nextIndex = currentIndex + 1;
    const nextQuestion = questions[nextIndex];
    const nextResponse = nextQuestion
      ? responses.find((item) => item.slug === nextQuestion.slug)
      : undefined;

    setCurrentIndex(nextIndex);
    setConfidence(nextResponse?.confidence ?? null);
    window.setTimeout(() => {
      questionCardRef.current?.focus();
      questionCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function resetSession() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // O estado em memória ainda pode ser reiniciado normalmente.
    }

    setCurrentIndex(0);
    setResponses([]);
    setConfidence(null);
    setCompleted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => questionCardRef.current?.focus(), 0);
  }

  const question = questions[currentIndex];
  const response = question
    ? responses.find((item) => item.slug === question.slug)
    : undefined;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050a12] text-slate-100 selection:bg-amber-300/25">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(16,185,129,.11),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(251,191,36,.09),transparent_26%),linear-gradient(180deg,#07101b_0%,#050a12_55%,#060c15_100%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-[8%] top-48 size-72 rounded-full border border-emerald-300/[.04]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[6%] top-32 size-44 rounded-full border border-amber-300/[.05]"
        aria-hidden="true"
      />

      <a
        href="#demo-conteudo"
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950 outline-none transition focus:translate-y-0"
      >
        Pular para a questão
      </a>

      <header className="relative z-10 border-b border-white/[.07] bg-[#050a12]/72 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <LeiProvaMark href="/" />
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[.055] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.17em] text-emerald-300 sm:inline-flex">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Demonstração pública
            </span>
            <Link
              href="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-slate-400 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300 sm:px-3 sm:text-sm"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Voltar ao início</span>
              <span className="sm:hidden">Início</span>
            </Link>
          </div>
        </div>
      </header>

      <section
        id="demo-conteudo"
        aria-label="Sessão interativa de demonstração"
        className="relative z-[1]"
      >
        {completed ? (
          <CompletionScreen
            questions={questions}
            responses={responses}
            headingRef={completionHeadingRef}
            onReset={resetSession}
          />
        ) : question ? (
          <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <SessionProgress
              currentIndex={currentIndex}
              answeredCurrent={Boolean(response)}
              total={questions.length}
            />

            <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <section
                ref={questionCardRef}
                tabIndex={-1}
                aria-labelledby="question-title"
                className="rounded-[1.5rem] border border-white/10 bg-[#0a121e]/88 p-5 shadow-[0_28px_90px_rgba(0,0,0,.3)] outline-none backdrop-blur-xl sm:p-7 lg:p-8"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[.055] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-emerald-300">
                    <BookOpenCheck className="size-3.5" aria-hidden="true" />
                    Direito Constitucional
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[.035] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">
                    {difficultyLabel(question.difficulty)}
                  </span>
                </div>

                <div className="mt-6 flex items-start gap-4">
                  <span className="hidden size-11 shrink-0 place-items-center rounded-xl border border-amber-300/15 bg-amber-300/[.06] text-amber-300 sm:grid">
                    <span className="text-sm font-bold tabular-nums">0{currentIndex + 1}</span>
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-amber-300">
                      {question.articleRef} · {question.topic}
                    </p>
                    <h2
                      id="question-title"
                      className="mt-2 text-balance text-xl font-semibold leading-8 tracking-[-.025em] text-white sm:text-2xl sm:leading-9"
                    >
                      {question.prompt}
                    </h2>
                  </div>
                </div>

                <div className="mt-7 rounded-2xl border border-white/8 bg-slate-950/35 p-4 sm:p-5">
                  <ConfidencePicker
                    value={confidence}
                    disabled={Boolean(response)}
                    onChange={setConfidence}
                  />
                </div>

                <AnswerOptions
                  question={question}
                  confidence={confidence}
                  response={response}
                  onAnswer={selectAnswer}
                />
              </section>

              {response ? (
                <AnswerFeedback
                  question={question}
                  response={response}
                  isLast={currentIndex === questions.length - 1}
                  onAdvance={advance}
                />
              ) : (
                <SessionGuide />
              )}
            </div>
          </div>
        ) : (
          <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-5 text-center">
            <div>
              <p className="text-lg font-semibold text-white">A sessão não pôde ser carregada.</p>
              <Link className="mt-4 inline-flex text-sm font-semibold text-amber-300" href="/">
                Voltar ao início
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
