"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  Check,
  CircleHelp,
  Dice5,
  ExternalLink,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Confidence = "guess" | "almost" | "sure";
type StudyMode = "normal" | "revisao";

type StudyQuestion = {
  publicId: string;
  prompt: string;
  topic: string;
  difficulty: number;
  articleRef: string;
  actTitle: string;
  verifiedAt: string;
  options: Array<{ id: string; text: string }>;
};

type Feedback = {
  isCorrect: boolean;
  correctOptionId: string;
  literalText: string;
  explanation: string;
  articleRef: string;
  officialUrl: string;
  xp: number;
  nextReviewAt: string;
};

const confidenceOptions: Array<{
  id: Confidence;
  label: string;
  helper: string;
  icon: typeof Dice5;
}> = [
  { id: "guess", label: "Chute", helper: "ainda não lembro", icon: Dice5 },
  { id: "almost", label: "Quase", helper: "estou entre duas", icon: CircleHelp },
  { id: "sure", label: "Certo", helper: "lembro a redação", icon: ShieldCheck },
];

export function LiveStudySession({
  mode = "normal",
  topic,
}: {
  mode?: StudyMode;
  topic?: string;
}) {
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Array<{ correct: boolean; xp: number }>>([]);
  const [completed, setCompleted] = useState(false);
  const startedAt = useRef(0);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    startedAt.current = Date.now();
    const sessionParams = new URLSearchParams();
    if (mode === "revisao") sessionParams.set("modo", "revisao");
    if (topic) sessionParams.set("tema", topic);
    const sessionUrl = `/api/study/session${sessionParams.size ? `?${sessionParams.toString()}` : ""}`;
    fetch(sessionUrl, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("session_failed");
        return response.json() as Promise<{ questions: StudyQuestion[] }>;
      })
      .then((data) => {
        if (active) setQuestions(data.questions);
      })
      .catch(() => {
        if (active) setError("Não foi possível preparar o treino. Tente novamente.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, topic]);

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  const question = questions[index];
  const progress = questions.length ? Math.round(((index + (feedback ? 1 : 0)) / questions.length) * 100) : 0;

  async function submitAnswer() {
    if (!question || !selected || !confidence || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/study/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: question.publicId,
          optionId: selected,
          confidence,
          durationMs: Math.min(10 * 60 * 1000, Date.now() - startedAt.current),
        }),
      });
      if (!response.ok) throw new Error("attempt_failed");
      const data = (await response.json()) as Feedback;
      setFeedback(data);
      setResults((current) => [...current, { correct: data.isCorrect, xp: data.xp }]);
    } catch {
      setError("Sua resposta não foi registrada. Verifique a conexão e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    if (index >= questions.length - 1) {
      setCompleted(true);
      return;
    }
    setIndex((current) => current + 1);
    setSelected(null);
    setConfidence(null);
    setFeedback(null);
    setError(null);
    startedAt.current = Date.now();
  }

  if (loading) {
    return <div className="grid min-h-[70vh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-amber-300" /><p className="mt-3 text-sm text-slate-500">Montando sua sessão…</p></div></div>;
  }

  if (completed) {
    const correct = results.filter((result) => result.correct).length;
    const xp = results.reduce((total, result) => total + result.xp, 0);
    return (
      <section className="mx-auto flex min-h-[78vh] max-w-3xl items-center px-4 py-10">
        <div className="w-full rounded-[2rem] border border-emerald-300/15 bg-[linear-gradient(145deg,#0c1925,#0b1b1b)] p-7 text-center shadow-2xl sm:p-11">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-amber-300/12 text-amber-300"><Trophy className="size-8" /></span>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-emerald-300">Sessão concluída</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Você recuperou {correct} de {questions.length} redações</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400">Os itens já entraram na sua fila de revisão conforme acerto e confiança.</p>
          <div className="mx-auto mt-7 grid max-w-md grid-cols-2 gap-3"><div className="rounded-xl bg-white/5 p-4"><strong className="text-2xl text-emerald-300">{correct}</strong><p className="text-xs text-slate-500">acertos</p></div><div className="rounded-xl bg-white/5 p-4"><strong className="text-2xl text-amber-300">+{xp}</strong><p className="text-xs text-slate-500">XP</p></div></div>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><button onClick={() => window.location.reload()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950"><RefreshCcw className="size-4" />Nova sessão</button><Link href="/app" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-5 text-sm font-semibold text-white">Voltar ao painel <ArrowRight className="size-4" /></Link></div>
        </div>
      </section>
    );
  }

  if (!question && mode === "revisao" && !error) {
    return (
      <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-5 py-10 text-center">
        <div className="w-full rounded-[1.75rem] border border-emerald-300/15 bg-[#09131f] p-7 shadow-2xl sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-300/10 text-emerald-300"><CalendarCheck2 className="size-6" /></span>
          <h1 className="mt-5 text-2xl font-semibold">Nenhuma revisão pendente</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Sua fila está em dia. Um novo treino alimenta as próximas revisões conforme seu desempenho.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/app/treinar" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950">Treinar novo conteúdo <ArrowRight className="size-4" /></Link>
            <Link href="/app/revisoes" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-5 text-sm font-semibold text-white">Voltar às revisões</Link>
          </div>
        </div>
      </section>
    );
  }

  if (!question) {
    return <div className="grid min-h-[70vh] place-items-center px-5 text-center"><div><BookOpenCheck className="mx-auto size-8 text-slate-600" /><h1 className="mt-4 text-xl font-semibold">Treino indisponível</h1><p className="mt-2 text-sm text-slate-500">{error ?? (topic ? `Não há questões liberadas no caderno “${topic}”.` : "O acervo ainda não foi publicado.")}</p>{topic && <Link href="/app/materiais" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white"><ArrowLeft className="size-3.5" />Voltar aos materiais</Link>}</div></div>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <div className="flex items-center justify-between gap-4">
        <Link href={mode === "revisao" ? "/app/revisoes" : topic ? "/app/materiais" : "/app"} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-white"><ArrowLeft className="size-4" />{mode === "revisao" ? "Revisões" : topic ? "Materiais" : "Painel"}</Link>
        <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs text-slate-400">{index + 1} de {questions.length}</span>
      </div>
      <div
        aria-label="Progresso da sessão"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progress}
        aria-valuetext={`${index + (feedback ? 1 : 0)} de ${questions.length} questões respondidas`}
        className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/7"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-300 transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <section className="mt-5 overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#09131f] shadow-2xl shadow-black/20">
        <header className="border-b border-white/7 px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-center gap-2 text-[11px]"><span className="rounded-full bg-amber-300/10 px-2.5 py-1 font-bold text-amber-200">{question.articleRef}</span><span className="text-slate-600">{question.actTitle}</span><span className="ml-auto text-slate-600">verificado em {new Intl.DateTimeFormat("pt-BR").format(new Date(`${question.verifiedAt}T12:00:00`))}</span></div>
          <h1 className="mt-5 text-balance text-lg font-semibold leading-8 text-slate-100 sm:text-xl">{question.prompt}</h1>
        </header>

        <div className="grid gap-7 p-5 sm:p-7">
          <fieldset disabled={Boolean(feedback)}>
            <legend className="text-sm font-semibold text-slate-300">Qual é sua confiança antes de ver as alternativas?</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {confidenceOptions.map(({ id, label, helper, icon: Icon }) => (
                <label
                  key={id}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-white/[.025] p-3 text-left transition hover:border-white/15 focus-within:ring-2 focus-within:ring-amber-300 focus-within:ring-offset-2 focus-within:ring-offset-[#09131f]",
                    confidence === id && "border-amber-300/40 bg-amber-300/8",
                  )}
                >
                  <input
                    checked={confidence === id}
                    className="sr-only"
                    name="confidence"
                    onChange={() => setConfidence(id)}
                    type="radio"
                    value={id}
                  />
                  <Icon aria-hidden="true" className={cn("size-4 text-slate-500", confidence === id && "text-amber-300")} />
                  <span><strong className="block text-xs text-slate-200">{label}</strong><span className="text-[10px] text-slate-600">{helper}</span></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset disabled={Boolean(feedback)}>
            <legend className="sr-only">Alternativas</legend>
            <div className="grid gap-3">
              {question.options.map((option) => {
                const isSelected = selected === option.id;
                const isCorrect = feedback?.correctOptionId === option.id;
                const isWrongSelected = Boolean(feedback && isSelected && !feedback.isCorrect);
                return (
                  <label key={option.id} className={cn("relative flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-slate-950/35 p-4 text-left text-sm leading-6 text-slate-300 transition hover:border-white/15 focus-within:ring-2 focus-within:ring-amber-300 focus-within:ring-offset-2 focus-within:ring-offset-[#09131f]", isSelected && !feedback && "border-amber-300/45 bg-amber-300/7", isCorrect && "border-emerald-300/45 bg-emerald-300/8", isWrongSelected && "border-rose-300/45 bg-rose-300/8")}>
                    <input
                      checked={isSelected}
                      className="sr-only"
                      name={`answer-${question.publicId}`}
                      onChange={() => setSelected(option.id)}
                      type="radio"
                      value={option.id}
                    />
                    <span aria-hidden="true" className={cn("grid size-7 shrink-0 place-items-center rounded-full border border-white/10 text-xs font-bold uppercase", isCorrect && "border-emerald-300/30 bg-emerald-300 text-slate-950", isWrongSelected && "border-rose-300/30 bg-rose-300 text-slate-950")}>{isCorrect ? <Check className="size-4" /> : isWrongSelected ? <X className="size-4" /> : option.id}</span>
                    <span>{option.text}</span>
                    {isCorrect && <span className="sr-only">Alternativa correta.</span>}
                    {isWrongSelected && <span className="sr-only">Sua alternativa está incorreta.</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {error && <p role="alert" className="rounded-xl border border-rose-300/15 bg-rose-300/6 px-4 py-3 text-sm text-rose-200">{error}</p>}

          {feedback ? (
            <div
              ref={feedbackRef}
              aria-atomic="true"
              aria-live="polite"
              className={cn("rounded-2xl border p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300", feedback.isCorrect ? "border-emerald-300/15 bg-emerald-300/5" : "border-amber-300/15 bg-amber-300/5")}
              role="status"
              tabIndex={-1}
            >
              <div className="flex items-center gap-2"><span className={cn("grid size-8 place-items-center rounded-full", feedback.isCorrect ? "bg-emerald-300 text-slate-950" : "bg-amber-300 text-slate-950")}>{feedback.isCorrect ? <Check className="size-4" /> : <Sparkles className="size-4" />}</span><strong>{feedback.isCorrect ? "Redação recuperada" : "Compare a palavra decisiva"}</strong><span className="ml-auto text-xs font-bold text-amber-300">+{feedback.xp} XP</span></div>
              <blockquote className="mt-4 border-l-2 border-emerald-300/40 pl-4 text-sm leading-7 text-slate-200">{feedback.literalText}</blockquote>
              <p className="mt-4 text-sm leading-6 text-slate-400">{feedback.explanation}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs"><a href={feedback.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-emerald-300">Conferir no Planalto <ExternalLink className="size-3.5" /></a><span className="text-slate-600">revisão agendada para {new Intl.DateTimeFormat("pt-BR").format(new Date(feedback.nextReviewAt))}</span></div>
              <p className="mt-3 text-[10px] leading-4 text-slate-600">Trecho meramente informativo e não oficial; não substitui a publicação no Diário Oficial da União.</p>
            </div>
          ) : (
            <button onClick={submitAnswer} disabled={!selected || !confidence || submitting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-35">{submitting ? <LoaderCircle className="size-4 animate-spin" /> : "Confirmar resposta"}<ArrowRight className="size-4" /></button>
          )}

          {feedback && <button onClick={nextQuestion} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-amber-300">{index === questions.length - 1 ? "Ver resultado" : "Próxima questão"}<ArrowRight className="size-4" /></button>}
        </div>
      </section>
    </main>
  );
}
