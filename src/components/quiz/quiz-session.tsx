"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  ExternalLink,
  FileQuestion,
  Flag,
  LoaderCircle,
  Medal,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from "lucide-react";

import { normalizeQuizDurationMs } from "@/lib/quiz/response";
import { LiteralHighlightView } from "@/components/study/literal-highlight-view";
import { QuestionActionBar } from "@/components/study/question-action-bar";
import { cn } from "@/lib/utils";

import type {
  QuizAnswerMap,
  QuizConfig,
  QuizFinishAnswer,
  QuizFinishPayload,
  QuizNotebookOption,
  QuizQuestion,
  QuizSessionPayload,
  QuizTrainingFeedback,
} from "./types";

type QuizSessionProps = {
  config: QuizConfig;
  payload: QuizSessionPayload;
  onBackToBuilder: () => void;
  onRestart: () => void;
  onSwitchMode: (mode: "dry_law" | "original_style") => void;
  notebooks?: QuizNotebookOption[];
};

export function QuizSession({ config, payload, onBackToBuilder, onRestart, onSwitchMode, notebooks = [] }: QuizSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswerMap>({});
  const [trainingFeedback, setTrainingFeedback] = useState<Record<string, QuizTrainingFeedback>>({});
  const [finishPayload, setFinishPayload] = useState<QuizFinishPayload | null>(null);
  const [finishReason, setFinishReason] = useState<"submitted" | "time">("submitted");
  const [remainingSeconds, setRemainingSeconds] = useState(config.timed ? payload.questions.length * 90 : null);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questionStartedAt = useRef(0);
  const timeCompletionStarted = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const questions = payload.questions;
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const confirmedCount = Object.keys(trainingFeedback).length;
  const progressCount = config.experience === "training" ? confirmedCount : answeredCount;
  const progress = questions.length ? Math.round((progressCount / questions.length) * 100) : 0;
  const timeExpired = remainingSeconds === 0;

  const finishSession = useCallback(async (reason: "submitted" | "time") => {
    setFinishing(true);
    setError(null);
    try {
      const response = await fetch("/api/quiz/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: payload.sessionId }),
      });
      if (!response.ok) throw new Error("finish_failed");
      const result = (await response.json()) as QuizFinishPayload;
      setFinishReason(reason);
      setFinishPayload(result);
    } catch {
      setError("Não foi possível concluir a sessão agora. Suas respostas continuam preservadas; tente novamente.");
    } finally {
      setFinishing(false);
    }
  }, [payload.sessionId]);

  useEffect(() => {
    questionStartedAt.current = window.performance.now();
  }, [currentIndex]);

  useEffect(() => {
    if (!config.timed || finishPayload) return;
    const deadlineAt = payload.deadlineAt ?? payload.selection.deadlineAt;
    const absoluteDeadline = deadlineAt ? Date.parse(deadlineAt) : Number.NaN;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (Number.isFinite(absoluteDeadline)) {
          return Math.max(0, Math.ceil((absoluteDeadline - Date.now()) / 1000));
        }
        return current === null ? null : Math.max(0, current - 1);
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [config.timed, finishPayload, payload.deadlineAt, payload.selection.deadlineAt]);

  useEffect(() => {
    if (!timeExpired || timeCompletionStarted.current || finishPayload || savingAnswer) return;
    timeCompletionStarted.current = true;
    void finishSession("time");
  }, [finishPayload, finishSession, savingAnswer, timeExpired]);

  if (!questions.length || payload.selection.availability.status === "empty") {
    return <EmptyQuizState availability={payload.selection.availability} mode={config.mode} onBack={onBackToBuilder} onSwitchMode={onSwitchMode} />;
  }

  if (finishPayload) {
    return (
      <QuizResult
        config={config}
        finishReason={finishReason}
        notebooks={notebooks}
        onBackToBuilder={onBackToBuilder}
        onRestart={onRestart}
        questions={questions}
        result={finishPayload}
      />
    );
  }

  if (!currentQuestion) return null;

  const selectedOptionId = answers[currentQuestion.id];
  const feedback = trainingFeedback[currentQuestion.id];
  const showFeedback = config.experience === "training" && Boolean(feedback);
  const interactionLocked = Boolean(showFeedback || savingAnswer || finishing || timeExpired);

  async function chooseAnswer(optionId: string, eventTimeStamp: number) {
    if (interactionLocked) return;
    if (config.experience === "training") {
      setAnswers((current) => ({ ...current, [currentQuestion.id]: optionId }));
      return;
    }

    const previousOptionId = answers[currentQuestion.id];
    setAnswers((current) => ({ ...current, [currentQuestion.id]: optionId }));
    setSavingAnswer(true);
    setError(null);
    try {
      const response = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: payload.sessionId,
          questionId: currentQuestion.id,
          optionId,
          durationMs: normalizeQuizDurationMs(questionStartedAt.current, eventTimeStamp),
        }),
      });
      if (!response.ok) throw new Error("answer_failed");
      const result = (await response.json()) as { accepted?: boolean };
      if (!result.accepted) throw new Error("answer_rejected");
    } catch {
      setAnswers((current) => restoreAnswer(current, currentQuestion.id, optionId, previousOptionId));
      setError("A resposta não foi salva. Verifique sua conexão e marque novamente.");
    } finally {
      setSavingAnswer(false);
    }
  }

  async function confirmTrainingAnswer(eventTimeStamp: number) {
    if (!selectedOptionId || showFeedback || savingAnswer || timeExpired) return;
    setSavingAnswer(true);
    setError(null);
    try {
      const response = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: payload.sessionId,
          questionId: currentQuestion.id,
          optionId: selectedOptionId,
          durationMs: normalizeQuizDurationMs(questionStartedAt.current, eventTimeStamp),
        }),
      });
      if (!response.ok) throw new Error("answer_failed");
      const result = (await response.json()) as QuizTrainingFeedback;
      setTrainingFeedback((current) => ({ ...current, [currentQuestion.id]: result }));
      window.requestAnimationFrame(() => feedbackRef.current?.focus());
    } catch {
      setError("Não foi possível corrigir sua resposta. Tente novamente sem sair desta questão.");
    } finally {
      setSavingAnswer(false);
    }
  }

  function nextTrainingQuestion() {
    if (currentIndex === questions.length - 1) {
      void finishSession("submitted");
      return;
    }
    setCurrentIndex((index) => index + 1);
    setError(null);
  }

  return (
    <div className="mt-8">
      <section className="rounded-[1.75rem] border border-els-line bg-els-surface p-4 shadow-2xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-xs font-semibold text-els-fg-3 transition hover:text-els-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-els-amber" onClick={onBackToBuilder} type="button"><ArrowLeft className="size-4" />Sair da sessão</button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <SessionTag>{selectionLabel(payload.selection.bank)}</SessionTag>
            <SessionTag>{selectionLabel(payload.selection.subject)}</SessionTag>
            <SessionTag>{selectionLabel(payload.selection.examEdition)}</SessionTag>
            <SessionTag accent>{config.experience === "training" ? "Modo treino" : "Modo prova"}</SessionTag>
            {remainingSeconds !== null && <Timer seconds={remainingSeconds} />}
          </div>
        </div>
        <div aria-label="Progresso do quiz" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} aria-valuetext={`${progressCount} de ${questions.length} questões respondidas`} className="mt-5 h-1.5 overflow-hidden rounded-full bg-els-raise" role="progressbar">
          <div className="h-full rounded-full bg-gradient-to-r from-els-amber to-els-green transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs"><span className="font-semibold text-els-fg-2">Questão {currentIndex + 1} de {questions.length}</span><span aria-live="polite" className="text-els-fg-4">{answeredCount} {answeredCount === 1 ? "respondida" : "respondidas"}{savingAnswer ? " · salvando…" : ""}</span></div>
        {config.experience === "exam" && <QuestionNavigator answers={answers} currentIndex={currentIndex} questions={questions} onSelect={setCurrentIndex} />}
      </section>

      <section className="mt-4 overflow-hidden rounded-[1.75rem] border border-els-line bg-els-surface shadow-2xl shadow-black/20">
        <header className="border-b border-els-line px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">{currentQuestion.articleRef && <span className="rounded-full bg-els-amber/10 px-2.5 py-1 text-els-amber-ink">{currentQuestion.articleRef}</span>}{currentQuestion.legalAct && <span className="text-els-fg-4">{currentQuestion.legalAct}</span>}<span className="ml-auto text-els-fg-4">Dificuldade {Math.max(1, Math.min(5, currentQuestion.difficulty))}/5</span></div>
          <h2 className="mt-5 text-balance text-lg font-semibold leading-8 text-els-fg sm:text-xl">{currentQuestion.prompt}</h2>
        </header>

        <div className="grid gap-5 p-5 sm:p-7">
          <fieldset disabled={interactionLocked}>
            <legend className="sr-only">Escolha uma alternativa</legend>
            <div className="grid gap-3">
              {currentQuestion.options.map((option, optionIndex) => {
                const selected = selectedOptionId === option.id;
                const correct = Boolean(showFeedback && feedback?.correctOptionId === option.id);
                const wrong = Boolean(showFeedback && selected && !correct);
                return (
                  <label key={option.id} className={cn("relative flex cursor-pointer items-start gap-3 rounded-xl border bg-els-bg/35 p-4 text-left text-sm leading-6 text-els-fg-2 transition focus-within:ring-2 focus-within:ring-els-amber focus-within:ring-offset-2 focus-within:ring-offset-els-surface", selected && !showFeedback ? "border-els-amber/45 bg-els-amber/7" : "border-els-line hover:border-els-line-strong", correct && "border-els-green/45 bg-els-green/8", wrong && "border-els-danger/45 bg-els-danger/8")}>
                    <input checked={selected} className="sr-only" name={`answer-${currentQuestion.id}`} onChange={(event) => void chooseAnswer(option.id, event.timeStamp)} type="radio" value={option.id} />
                    <span aria-hidden="true" className={cn("grid size-7 shrink-0 place-items-center rounded-full border border-els-line text-xs font-bold", correct && "border-els-green bg-els-green text-els-on-amber", wrong && "border-els-danger bg-els-danger text-els-on-amber")}>{correct ? <Check className="size-4" /> : wrong ? <X className="size-4" /> : optionLetter(optionIndex)}</span>
                    <span>{option.text}</span>{correct && <span className="sr-only">Alternativa correta.</span>}{wrong && <span className="sr-only">Sua alternativa está incorreta.</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-els-danger/15 bg-els-danger/6 px-4 py-3" role="alert"><p className="text-xs leading-5 text-els-danger-ink">{error}</p>{timeExpired && <button className="text-xs font-bold text-els-fg underline underline-offset-4" onClick={() => void finishSession("time")} type="button">Tentar concluir</button>}</div>}
          {showFeedback && feedback && <QuestionFeedback feedback={feedback} question={currentQuestion} selectedOptionId={selectedOptionId} feedbackRef={feedbackRef} />}
          {showFeedback && feedback && <QuestionActionBar key={currentQuestion.id} notebooks={notebooks} optionLabels={optionLabels(currentQuestion)} questionPublicId={currentQuestion.id} />}

          {config.experience === "training" ? (
            showFeedback ? <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-els-amber px-5 text-sm font-bold text-els-on-amber transition hover:bg-els-amber disabled:opacity-40" disabled={finishing} onClick={nextTrainingQuestion} type="button">{finishing ? <><LoaderCircle className="size-4 animate-spin" />Concluindo…</> : <>{currentIndex === questions.length - 1 ? "Ver resultado" : "Próxima questão"}<ArrowRight className="size-4" /></>}</button> : <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-els-amber px-5 text-sm font-bold text-els-on-amber transition hover:bg-els-amber disabled:cursor-not-allowed disabled:opacity-35" disabled={!selectedOptionId || savingAnswer || timeExpired} onClick={(event) => void confirmTrainingAnswer(event.timeStamp)} type="button">{savingAnswer ? <><LoaderCircle className="size-4 animate-spin" />Corrigindo…</> : <>Confirmar resposta <ArrowRight className="size-4" /></>}</button>
          ) : <ExamControls answeredCount={answeredCount} currentIndex={currentIndex} disabled={savingAnswer || finishing || timeExpired} finishing={finishing} questionCount={questions.length} onFinish={() => void finishSession("submitted")} onNavigate={setCurrentIndex} />}
        </div>
      </section>
    </div>
  );
}

function QuestionFeedback({ feedback, question, selectedOptionId, feedbackRef }: { feedback: QuizTrainingFeedback; question: QuizQuestion; selectedOptionId?: string; feedbackRef: React.RefObject<HTMLDivElement | null> }) {
  const sourceUrl = safeSourceUrl(feedback.source.url);
  return (
    <div ref={feedbackRef} aria-atomic="true" aria-live="polite" className={cn("rounded-2xl border p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-els-amber", feedback.isCorrect ? "border-els-green/15 bg-els-green/5" : "border-els-amber/15 bg-els-amber/5")} role="status" tabIndex={-1}>
      <div className="flex items-center gap-3"><span className={cn("grid size-9 place-items-center rounded-full text-els-on-amber", feedback.isCorrect ? "bg-els-green" : "bg-els-amber")}>{feedback.isCorrect ? <Check className="size-4" /> : <BookOpenCheck className="size-4" />}</span><div><strong className="block text-sm text-els-fg">{feedback.isCorrect ? "Resposta correta" : "Revise o fundamento"}</strong><span className="text-[11px] text-els-fg-3">Gabarito: alternativa {optionLetter(question.options.findIndex((option) => option.id === feedback.correctOptionId))}</span></div></div>
      {feedback.literal && <LiteralHighlightView literal={feedback.literal} className="mt-4" />}
      <p className="mt-4 text-sm leading-6 text-els-fg-2">{feedback.explanation}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-els-line pt-4 text-xs"><span className="text-els-fg-3">Fonte: {feedback.source.label}</span>{sourceUrl && <a className="inline-flex items-center gap-2 font-semibold text-els-green-ink transition hover:text-els-green-ink" href={sourceUrl} rel="noopener noreferrer" target="_blank">Abrir fonte <ExternalLink className="size-3.5" /></a>}</div>
      {feedback.source.kind === "official_law" && <p className="mt-3 text-[10px] leading-4 text-els-fg-4">Trecho meramente informativo e não oficial; não substitui a publicação no diário oficial.</p>}
      {selectedOptionId && <span className="sr-only">Resposta registrada: {selectedOptionId}.</span>}
    </div>
  );
}

function ExamControls({ answeredCount, currentIndex, disabled, finishing, questionCount, onFinish, onNavigate }: { answeredCount: number; currentIndex: number; disabled: boolean; finishing: boolean; questionCount: number; onFinish: () => void; onNavigate: (index: number) => void }) {
  const unanswered = questionCount - answeredCount;
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-els-line pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-els-line px-4 text-xs font-semibold text-els-fg-2 transition hover:border-els-line-strong disabled:opacity-30" disabled={disabled || currentIndex === 0} onClick={() => onNavigate(currentIndex - 1)} type="button"><ChevronLeft className="size-4" />Anterior</button>
      <div className="flex flex-col gap-2 sm:flex-row">{currentIndex < questionCount - 1 && <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-els-line px-4 text-xs font-semibold text-els-fg-2 transition hover:border-els-line-strong disabled:opacity-30" disabled={disabled} onClick={() => onNavigate(currentIndex + 1)} type="button">Próxima <ArrowRight className="size-4" /></button>}<button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-els-amber px-4 text-xs font-black text-els-on-amber transition hover:bg-els-amber disabled:opacity-40" disabled={disabled} onClick={onFinish} type="button">{finishing ? <><LoaderCircle className="size-4 animate-spin" />Corrigindo…</> : <><Flag className="size-4" />Entregar prova{unanswered ? ` · ${unanswered} em branco` : ""}</>}</button></div>
    </div>
  );
}

function QuestionNavigator({ answers, currentIndex, questions, onSelect }: { answers: QuizAnswerMap; currentIndex: number; questions: QuizQuestion[]; onSelect: (index: number) => void }) {
  return <nav aria-label="Navegação entre questões" className="mt-5 border-t border-els-line pt-4"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-els-fg-4">Mapa da prova</p><div className="mt-3 flex flex-wrap gap-2">{questions.map((question, index) => <button key={question.id} aria-current={currentIndex === index ? "step" : undefined} aria-label={`Questão ${index + 1}${answers[question.id] ? ", respondida" : ", em branco"}`} className={cn("grid size-9 place-items-center rounded-lg border text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-els-amber", currentIndex === index ? "border-els-amber bg-els-amber text-els-on-amber" : answers[question.id] ? "border-els-green/30 bg-els-green/8 text-els-green-ink" : "border-els-line bg-black/15 text-els-fg-4 hover:border-els-line-strong")} onClick={() => onSelect(index)} type="button">{index + 1}</button>)}</div></nav>;
}

function QuizResult({ config, finishReason, notebooks, onBackToBuilder, onRestart, questions, result }: { config: QuizConfig; finishReason: "submitted" | "time"; notebooks: QuizNotebookOption[]; onBackToBuilder: () => void; onRestart: () => void; questions: QuizQuestion[]; result: QuizFinishPayload }) {
  const answerMap = new Map(result.answers.map((answer) => [answer.questionId, answer]));
  return (
    <div className="mt-8">
      <section className="overflow-hidden rounded-[2rem] border border-els-green/15 bg-[linear-gradient(145deg,var(--els-bg-2),var(--els-bg-2))] shadow-2xl"><div className="p-6 text-center sm:p-10"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-els-amber/12 text-els-amber-ink"><Medal className="size-8" /></span><p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-els-green-ink">{finishReason === "time" ? "Tempo encerrado" : config.experience === "exam" ? "Prova entregue" : "Treino concluído"}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{result.result.correct} de {result.result.total} acertos</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-els-fg-3">Agora o gabarito, a explicação editorial e a fonte de cada item estão liberados para revisão.</p><div className="mx-auto mt-7 grid max-w-2xl gap-3 sm:grid-cols-3"><ResultMetric icon={Target} label="Aproveitamento" value={`${result.result.scorePercent}%`} accent="emerald" /><ResultMetric icon={CheckCircle2} label="Respondidas" value={`${result.result.answered}/${result.result.total}`} accent="sky" /><ResultMetric icon={Clock3} label="Ritmo" value={config.timed ? "Cronometrado" : "Tempo livre"} accent="amber" /></div><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-els-amber px-5 text-sm font-bold text-els-on-amber transition hover:bg-els-amber" onClick={onRestart} type="button"><RotateCcw className="size-4" />Refazer este recorte</button><button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-els-line px-5 text-sm font-semibold text-els-fg transition hover:border-els-line-strong" onClick={onBackToBuilder} type="button">Montar outro quiz <ArrowRight className="size-4" /></button></div></div></section>
      <section className="mt-5 rounded-[1.75rem] border border-els-line bg-els-surface p-4 sm:p-6"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-els-green-ink">Gabarito comentado</p><h2 className="mt-1 text-xl font-semibold">Revise questão por questão</h2></div><FileQuestion className="size-6 text-els-amber-ink" /></div><div className="mt-5 grid gap-3">{questions.map((question, index) => <ResultQuestion key={question.id} answer={answerMap.get(question.id)} index={index} notebooks={notebooks} question={question} />)}</div></section>
    </div>
  );
}

function ResultQuestion({ answer, index, notebooks, question }: { answer?: QuizFinishAnswer; index: number; notebooks: QuizNotebookOption[]; question: QuizQuestion }) {
  const selectedOption = question.options.find((option) => option.id === answer?.selectedOptionId);
  const correctOption = question.options.find((option) => option.id === answer?.correctOptionId);
  const sourceUrl = safeSourceUrl(answer?.source.url);
  const correct = Boolean(answer?.isCorrect);
  return (
    <details className="group min-w-0 [overflow-wrap:anywhere] rounded-2xl border border-els-line bg-els-bg/25 open:border-els-line-strong"><summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-els-amber"><span className={cn("grid size-9 shrink-0 place-items-center rounded-full", correct ? "bg-els-green text-els-on-amber" : "bg-els-danger/12 text-els-danger-ink")}>{correct ? <Check className="size-4" /> : <X className="size-4" />}</span><span className="min-w-0 flex-1"><strong className="block text-xs text-els-fg-2">Questão {index + 1} · {correct ? "Correta" : answer?.selectedOptionId ? "Incorreta" : "Em branco"}</strong><span className="mt-1 block truncate text-[11px] text-els-fg-4">{question.prompt}</span></span><span className="shrink-0 text-xs font-bold text-els-fg-4 group-open:text-els-amber-ink">Ver análise</span></summary><div className="border-t border-els-line p-4 sm:p-5"><p className="text-sm font-semibold leading-6 text-els-fg-2">{question.prompt}</p><div className="mt-4 grid gap-2 text-xs leading-5"><p className={cn("rounded-xl border p-3", correct ? "border-els-green/15 bg-els-green/5 text-els-green-ink" : "border-els-danger/15 bg-els-danger/5 text-els-fg")}>Sua resposta: {selectedOption?.text ?? "Em branco"}</p><p className="rounded-xl border border-els-green/15 bg-els-green/5 p-3 text-els-green-ink">Gabarito: {correctOption?.text ?? "Gabarito editorial indisponível"}</p></div>{answer?.literal && <LiteralHighlightView literal={answer.literal} className="mt-4" />}{answer?.explanation && <p className="mt-4 text-sm leading-6 text-els-fg-3">{answer.explanation}</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-els-line pt-4 text-xs"><span className="text-els-fg-4">Fonte: {answer?.source.label ?? "Fonte editorial indisponível"}</span>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-semibold text-els-green-ink">Abrir fonte <ExternalLink className="size-3.5" /></a>}</div>{answer?.source.kind === "official_law" && <p className="mt-3 text-[10px] leading-4 text-els-fg-4">Trecho meramente informativo e não oficial; não substitui a publicação no diário oficial.</p>}<QuestionActionBar className="mt-4" notebooks={notebooks} optionLabels={optionLabels(question)} questionPublicId={question.id} /></div></details>
  );
}

function EmptyQuizState({ availability, mode, onBack, onSwitchMode }: { availability: { reason?: string; message?: string }; mode?: string; onBack: () => void; onSwitchMode: (mode: "dry_law" | "original_style") => void }) {
  const isPreviousExam = mode === "previous_exam";
  const isOriginal = mode === "original_style";
  const isUpgrade = availability.reason === "upgrade_required" || availability.reason === "available_but_locked";
  const eyebrow = isUpgrade ? "Conteúdo do plano" : isPreviousExam ? "Acervo protegido" : isOriginal ? "Revisão editorial" : "Acervo em expansão";
  const title = isUpgrade
    ? "Este modo faz parte do acesso completo"
    : isPreviousExam
      ? "Ainda não há prova anterior licenciada neste recorte"
      : isOriginal
        ? "As questões inéditas deste recorte ainda estão em revisão"
        : "Ainda não há questões de literalidade neste recorte";
  const fallbackMessage = isPreviousExam
    ? "Questões anteriores só são publicadas após autorização de uso, identificação da edição e revisão do gabarito. Nenhuma prova foi inventada ou reproduzida sem licença."
    : isOriginal
      ? "Questões inéditas entram no acervo somente após autoria, conferência jurídica e revisão editorial."
      : "A literalidade deste assunto ainda está sendo vinculada à fonte oficial e revisada antes da publicação.";
  return <section className="mt-8 rounded-[2rem] border border-els-info/15 bg-[linear-gradient(145deg,var(--els-bg-2),var(--els-bg-2))] p-6 text-center shadow-2xl sm:p-10"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-els-info/10 text-els-info-ink"><ShieldAlert className="size-8" /></span><p className="mt-6 text-xs font-bold uppercase tracking-[.17em] text-els-info-ink">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">{title}</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-els-fg-3">{availability.message ?? fallbackMessage}</p><div className="mx-auto mt-7 flex max-w-2xl flex-col justify-center gap-3 sm:flex-row">{!isUpgrade && mode !== "original_style" && <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-els-amber px-5 text-sm font-black text-els-on-amber transition hover:bg-els-amber" onClick={() => onSwitchMode("original_style")} type="button"><Sparkles className="size-4" />Treinar inéditas autorais</button>}{mode !== "dry_law" && <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-els-line px-5 text-sm font-semibold text-els-fg transition hover:border-els-line-strong" onClick={() => onSwitchMode("dry_law")} type="button"><BookOpenCheck className="size-4" />Praticar literalidade</button>}</div><button className="mt-5 inline-flex min-h-10 items-center gap-2 px-3 text-xs font-semibold text-els-fg-3 transition hover:text-els-fg" onClick={onBack} type="button"><ArrowLeft className="size-4" />Alterar filtros</button></section>;
}

function ResultMetric({ icon: Icon, label, value, accent }: { icon: typeof Target; label: string; value: string; accent: "emerald" | "sky" | "amber" }) { const color = accent === "emerald" ? "text-els-green-ink" : accent === "sky" ? "text-els-info-ink" : "text-els-amber-ink"; return <div className="rounded-xl border border-els-line bg-els-raise p-4"><Icon className={cn("mx-auto size-5", color)} /><strong className="mt-3 block text-xl text-els-fg">{value}</strong><span className="mt-1 block text-[10px] uppercase tracking-wider text-els-fg-4">{label}</span></div>; }
function SessionTag({ children, accent = false }: { children?: string; accent?: boolean }) { if (!children) return null; return <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", accent ? "border-els-green/15 bg-els-green/7 text-els-green-ink" : "border-els-line bg-els-raise text-els-fg-3")}>{children}</span>; }
function Timer({ seconds }: { seconds: number }) { const urgent = seconds <= 60; return <span aria-label={`${formatClock(seconds)} restantes`} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold", urgent ? "border-els-danger/25 bg-els-danger/8 text-els-danger-ink" : "border-els-amber/15 bg-els-amber/7 text-els-amber-ink")} role="timer"><Clock3 className="size-3" />{formatClock(seconds)}</span>; }
function selectionLabel(value: unknown): string | undefined { if (typeof value === "string") return value; if (!value || typeof value !== "object") return undefined; const record = value as Record<string, unknown>; for (const key of ["name", "label", "title", "shortName"]) if (typeof record[key] === "string") return record[key]; return undefined; }
function safeSourceUrl(value?: string | null) { if (!value) return undefined; try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined; } catch { return undefined; } }
function optionLabels(question: QuizQuestion) { return Object.fromEntries(question.options.map((option, index) => [option.id, optionLetter(index)])); }
function optionLetter(index: number) { return index >= 0 && index < 26 ? String.fromCharCode(65 + index) : "—"; }
function formatClock(seconds: number) { const minutes = Math.floor(seconds / 60); return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function restoreAnswer(current: QuizAnswerMap, questionId: string, attemptedOptionId: string, previousOptionId?: string) { if (current[questionId] !== attemptedOptionId) return current; const next = { ...current }; if (previousOptionId) next[questionId] = previousOptionId; else delete next[questionId]; return next; }
