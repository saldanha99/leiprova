"use client";

import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileQuestion,
  Landmark,
  LoaderCircle,
  Scale,
  ShieldCheck,
  Sparkles,
  Star,
  TimerOff,
} from "lucide-react";

import {
  getCareerBySlug,
  getSubjectsForCareer,
  quizBanks,
  quizCareerTracks,
  quizModes,
  quizSubjects,
} from "@/lib/quiz/catalog";
import { cn } from "@/lib/utils";

import {
  isQuizConfigReady,
  type QuizConfig,
  type QuizExamScope,
  type QuizExperienceMode,
  type QuizPath,
} from "./types";

type QuizBuilderProps = {
  config: QuizConfig;
  error: string | null;
  loading: boolean;
  onChange: (config: QuizConfig) => void;
  onStart: () => void;
};

const countOptions = [5, 10, 20] as const;

const pathOptions: Array<{
  id: QuizPath;
  title: string;
  description: string;
  icon: typeof BriefcaseBusiness;
}> = [
  {
    id: "career",
    title: "Por cargo ou concurso",
    description: "Defina sua carreira, especialização, banca e matéria.",
    icon: BriefcaseBusiness,
  },
  {
    id: "bank",
    title: "Por banca e matéria",
    description: "Treine o padrão de cobrança da organizadora escolhida.",
    icon: Building2,
  },
];

const experienceOptions: Array<{
  id: QuizExperienceMode;
  title: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "training",
    title: "Modo treino",
    description: "Correção, fundamento e explicação logo após cada resposta.",
    icon: Sparkles,
  },
  {
    id: "exam",
    title: "Modo prova",
    description: "Sem pistas durante a resolução; gabarito somente ao entregar.",
    icon: FileCheck2,
  },
];

export function QuizBuilder({ config, error, loading, onChange, onStart }: QuizBuilderProps) {
  const availableSubjects = config.path === "career" && config.careerSlug
    ? getSubjectsForCareer(config.careerSlug)
    : quizSubjects;
  const subject = availableSubjects.find((item) => item.slug === config.subjectSlug);
  const canStart = isQuizConfigReady(config);

  function update(patch: Partial<QuizConfig>) {
    onChange({ ...config, ...patch });
  }

  function choosePath(path: QuizPath) {
    onChange({
      path,
      count: config.count,
      experience: config.experience,
      timed: config.timed,
      examScope: config.examScope,
    });
  }

  function chooseCareer(careerSlug: string) {
    onChange({
      ...config,
      careerSlug,
      specializationSlug: undefined,
      subjectSlug: undefined,
      topicSlug: undefined,
      bankSlug: undefined,
      mode: undefined,
      examScope: "latest",
    });
  }

  function chooseSubject(subjectSlug: string) {
    update({ subjectSlug, topicSlug: undefined });
  }

  return (
    <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid min-w-0 gap-5">
        <section className="rounded-[1.75rem] border border-white/8 bg-[#09131f] p-4 sm:p-6">
          <StepHeading number="01" title="Como você quer montar o quiz?" description="Escolha o ponto de partida da sua sessão." />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {pathOptions.map(({ id, title, description, icon: Icon }) => {
              const selected = config.path === id;
              return (
                <button
                  key={id}
                  aria-pressed={selected}
                  className={cn(
                    "group flex min-h-28 items-start gap-4 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
                    selected
                      ? "border-amber-300/40 bg-amber-300/8"
                      : "border-white/8 bg-slate-950/25 hover:border-white/16 hover:bg-white/[.035]",
                  )}
                  onClick={() => choosePath(id)}
                  type="button"
                >
                  <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", selected ? "bg-amber-300 text-slate-950" : "bg-white/5 text-slate-400")}>
                    <Icon className="size-5" />
                  </span>
                  <span>
                    <strong className="flex items-center gap-2 text-sm text-slate-100">{title}{selected && <Check className="size-4 text-amber-300" />}</strong>
                    <span className="mt-1.5 block text-xs leading-5 text-slate-500">{description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {config.path === "career" ? (
          <CareerPathSection
            config={config}
            onCareerChange={chooseCareer}
            onChange={update}
          />
        ) : (
          <BankPathSection config={config} onChange={update} />
        )}

        <section className="rounded-[1.75rem] border border-white/8 bg-[#09131f] p-4 sm:p-6">
          <StepHeading number={config.path === "career" ? "04" : "03"} title="Matéria e recorte" description="Estude a disciplina completa ou concentre a sessão em um tópico." />
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableSubjects.map((item) => (
              <SelectionButton
                key={item.slug}
                label={item.name}
                helper={item.shortName}
                selected={config.subjectSlug === item.slug}
                onClick={() => chooseSubject(item.slug)}
              />
            ))}
          </div>
          {subject && (
            <div className="mt-5 border-t border-white/8 pt-5">
              <p className="text-xs font-bold uppercase tracking-[.13em] text-slate-500">Qual parte de {subject.name}?</p>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Tópicos de ${subject.name}`}>
                <TopicButton
                  label={`${subject.shortName} completo`}
                  selected={!config.topicSlug}
                  onClick={() => update({ topicSlug: undefined })}
                />
                {subject.topics.map((topic) => (
                  <TopicButton
                    key={topic.slug}
                    label={topic.name}
                    selected={config.topicSlug === topic.slug}
                    onClick={() => update({ topicSlug: topic.slug })}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-white/8 bg-[#09131f] p-4 sm:p-6">
          <StepHeading number={config.path === "career" ? "05" : "04"} title="Tipo de questão" description="Cada formato treina uma habilidade diferente, sem misturar a origem dos itens." />
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {quizModes.map((mode) => {
              const Icon = mode.slug === "dry_law" ? BookOpenCheck : mode.slug === "previous_exam" ? FileQuestion : Sparkles;
              const selected = config.mode === mode.slug;
              return (
                <button
                  key={mode.slug}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
                    selected ? "border-emerald-300/35 bg-emerald-300/7" : "border-white/8 bg-slate-950/25 hover:border-white/16",
                  )}
                  onClick={() => update({ mode: mode.slug })}
                  type="button"
                >
                  <span className={cn("grid size-10 place-items-center rounded-xl", selected ? "bg-emerald-300 text-slate-950" : "bg-white/5 text-slate-500")}><Icon className="size-5" /></span>
                  <strong className="mt-4 block text-sm text-slate-100">{mode.name}</strong>
                  <span className="mt-1.5 block text-xs leading-5 text-slate-500">{mode.description}</span>
                  {mode.slug === "previous_exam" && (
                    <span className="mt-3 block rounded-lg border border-sky-300/10 bg-sky-300/5 px-2.5 py-2 text-[11px] leading-4 text-sky-200/70">Somente provas com uso autorizado e revisão editorial.</span>
                  )}
                  {mode.slug === "original_style" && (
                    <span className="mt-3 block text-[11px] font-semibold text-emerald-300">Conteúdo original, sem reprodução da banca</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/8 bg-[#09131f] p-4 sm:p-6">
          <StepHeading number={config.path === "career" ? "06" : "05"} title="Experiência e ritmo" description="Pratique com apoio imediato ou simule as condições de prova." />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {experienceOptions.map(({ id, title, description, icon: Icon }) => (
              <button
                key={id}
                aria-pressed={config.experience === id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
                  config.experience === id ? "border-amber-300/35 bg-amber-300/7" : "border-white/8 bg-slate-950/25 hover:border-white/16",
                )}
                onClick={() => update({ experience: id })}
                type="button"
              >
                <Icon className={cn("mt-0.5 size-5 shrink-0", config.experience === id ? "text-amber-300" : "text-slate-600")} />
                <span><strong className="block text-sm text-slate-100">{title}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-6 border-t border-white/8 pt-5 md:grid-cols-2">
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-[.13em] text-slate-500">Quantidade</legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {countOptions.map((count) => (
                  <label key={count} className={cn("cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-bold transition focus-within:ring-2 focus-within:ring-amber-300", config.count === count ? "border-amber-300/35 bg-amber-300/8 text-amber-200" : "border-white/8 bg-slate-950/25 text-slate-400")}>
                    <input className="sr-only" type="radio" name="question-count" checked={config.count === count} onChange={() => update({ count })} />
                    {count}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-[.13em] text-slate-500">Tempo</legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <TimingOption icon={TimerOff} label="Tempo livre" selected={!config.timed} onClick={() => update({ timed: false })} />
                <TimingOption
                  icon={Clock3}
                  label="Cronometrado"
                  helper={config.mode === "previous_exam" ? "Usa a duração oficial, quando disponível" : "1min30 por item"}
                  selected={config.timed}
                  onClick={() => update({ timed: true })}
                />
              </div>
            </fieldset>
          </div>
        </section>
      </div>

      <QuizSummary config={config} canStart={canStart} error={error} loading={loading} onStart={onStart} />
    </div>
  );
}

function CareerPathSection({
  config,
  onCareerChange,
  onChange,
}: {
  config: QuizConfig;
  onCareerChange: (slug: string) => void;
  onChange: (patch: Partial<QuizConfig>) => void;
}) {
  const career = config.careerSlug ? getCareerBySlug(config.careerSlug) : undefined;

  return (
    <>
      <section className="rounded-[1.75rem] border border-white/8 bg-[#09131f] p-4 sm:p-6">
        <StepHeading number="02" title="Cargo ou carreira" description="O recorte orienta as matérias e a linguagem do treino." />
        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {[...quizCareerTracks].sort((a, b) => Number(b.featured) - Number(a.featured)).map((item) => {
            const selected = config.careerSlug === item.slug;
            return (
              <button
                key={item.slug}
                aria-pressed={selected}
                className={cn(
                  "relative min-h-28 overflow-hidden rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
                  selected ? "border-amber-300/40 bg-amber-300/8" : item.featured ? "border-emerald-300/25 bg-emerald-300/[.055] hover:border-emerald-300/45" : "border-white/8 bg-slate-950/25 hover:border-white/16",
                )}
                onClick={() => onCareerChange(item.slug)}
                type="button"
              >
                {item.featured && <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-300 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-950"><Star className="size-2.5 fill-current" /> Destaque</span>}
                <strong className="block text-sm text-slate-100">{item.name}</strong>
                <span className="mt-1 block text-[11px] leading-4 text-slate-500">{item.description}</span>
                {selected && <Check className="absolute right-3 top-3 size-4 text-amber-300" />}
              </button>
            );
          })}
        </div>

        {career?.specializations.length ? (
          <fieldset className="mt-5 border-t border-white/8 pt-5">
            <legend className="text-xs font-bold uppercase tracking-[.13em] text-slate-500">Especialização obrigatória</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {career.specializations.map((specialization) => (
                <label key={specialization.slug} className={cn("cursor-pointer rounded-xl border p-3 text-sm transition focus-within:ring-2 focus-within:ring-amber-300", config.specializationSlug === specialization.slug ? "border-amber-300/35 bg-amber-300/8 text-amber-200" : "border-white/8 bg-slate-950/25 text-slate-400 hover:border-white/16")}>
                  <input className="sr-only" type="radio" name="specialization" checked={config.specializationSlug === specialization.slug} onChange={() => onChange({ specializationSlug: specialization.slug })} />
                  <span className="flex items-center gap-2"><Landmark className="size-4" />{specialization.name}</span>
                </label>
              ))}
            </div>
            {career.slug === "magistratura" && <p className="mt-3 text-[11px] leading-5 text-slate-600">A banca pode variar entre editais. O filtro não presume que toda magistratura estadual seja organizada pela mesma instituição.</p>}
          </fieldset>
        ) : null}
      </section>

      {career && (
        <section className="rounded-[1.75rem] border border-white/8 bg-[#09131f] p-4 sm:p-6">
          <StepHeading number="03" title="Prova e banca" description="A edição exata só é identificada quando existir material licenciado compatível." />
          <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-[.13em] text-slate-500">Recorte das provas</legend>
              <div className="mt-3 grid gap-2">
                <ExamScopeOption id="latest" selected={config.examScope === "latest"} onChange={(examScope) => onChange({ examScope })} />
                <ExamScopeOption id="all" selected={config.examScope === "all"} onChange={(examScope) => onChange({ examScope })} />
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-[.13em] text-slate-500">Banca organizadora</legend>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className={cn("cursor-pointer rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-amber-300", !config.bankSlug ? "border-emerald-300/35 bg-emerald-300/7" : "border-white/8 bg-slate-950/25 hover:border-white/16")}>
                  <input className="sr-only" type="radio" name="career-bank" checked={!config.bankSlug} onChange={() => onChange({ bankSlug: undefined })} />
                  <strong className="block text-xs text-slate-200">Sem fixar banca</strong>
                  <span className="mt-1 block text-[9px] leading-4 text-slate-600">A edição encontrada informa a organizadora real.</span>
                </label>
                {quizBanks.map((bank) => (
                  <label key={bank.slug} className={cn("cursor-pointer rounded-xl border p-3 transition focus-within:ring-2 focus-within:ring-amber-300", config.bankSlug === bank.slug ? "border-emerald-300/35 bg-emerald-300/7" : "border-white/8 bg-slate-950/25 hover:border-white/16")}>
                    <input className="sr-only" type="radio" name="career-bank" checked={config.bankSlug === bank.slug} onChange={() => onChange({ bankSlug: bank.slug })} />
                    <strong className="block text-xs text-slate-200">{bank.name}</strong>
                    <span className="mt-1 block truncate text-[9px] text-slate-600" title={bank.fullName}>{bank.fullName}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>
      )}
    </>
  );
}

function BankPathSection({ config, onChange }: { config: QuizConfig; onChange: (patch: Partial<QuizConfig>) => void }) {
  return (
    <section className="rounded-[1.75rem] border border-white/8 bg-[#09131f] p-4 sm:p-6">
      <StepHeading number="02" title="Banca organizadora" description="Selecione a instituição cujo padrão deseja praticar." />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quizBanks.map((bank) => (
          <button
            key={bank.slug}
            aria-pressed={config.bankSlug === bank.slug}
            className={cn("rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300", config.bankSlug === bank.slug ? "border-amber-300/40 bg-amber-300/8" : "border-white/8 bg-slate-950/25 hover:border-white/16")}
            onClick={() => onChange({ bankSlug: bank.slug })}
            type="button"
          >
            <span className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-100">{bank.name}</strong>{config.bankSlug === bank.slug && <BadgeCheck className="size-4 text-amber-300" />}</span>
            <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">{bank.fullName}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-300/12 bg-emerald-300/5 p-4">
        <Scale className="mt-0.5 size-4 shrink-0 text-emerald-300" />
        <div>
          <p className="text-xs font-semibold text-emerald-100">Exemplo de trilha disponível</p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] leading-5 text-slate-400">
            <span>VUNESP</span><ChevronRight className="size-3 text-slate-600" /><span>Direito Civil</span><ChevronRight className="size-3 text-slate-600" /><span>Obrigações</span><ChevronRight className="size-3 text-slate-600" /><span>Literalidade, anteriores licenciadas ou inéditas autorais</span>
          </p>
        </div>
      </div>
    </section>
  );
}

function QuizSummary({ config, canStart, error, loading, onStart }: { config: QuizConfig; canStart: boolean; error: string | null; loading: boolean; onStart: () => void }) {
  const career = config.careerSlug ? getCareerBySlug(config.careerSlug) : undefined;
  const bank = quizBanks.find((item) => item.slug === config.bankSlug);
  const subjects = config.path === "career" && config.careerSlug ? getSubjectsForCareer(config.careerSlug) : quizSubjects;
  const subject = subjects.find((item) => item.slug === config.subjectSlug);
  const topic = subject?.topics.find((item) => item.slug === config.topicSlug);
  const mode = quizModes.find((item) => item.slug === config.mode);

  return (
    <aside className="h-fit rounded-[1.75rem] border border-amber-300/15 bg-[linear-gradient(145deg,#0d1925,#0b171c)] p-5 shadow-2xl xl:sticky xl:top-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-amber-300 text-slate-950"><ShieldCheck className="size-5" /></span>
        <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-300">Sua sessão</p><h2 className="text-lg font-semibold">Resumo do quiz</h2></div>
      </div>
      <dl className="mt-5 grid gap-3 border-y border-white/8 py-5 text-xs">
        <SummaryRow label="Caminho" value={config.path === "career" ? career?.name : "Por banca e matéria"} />
        {config.specializationSlug && <SummaryRow label="Especialização" value={career?.specializations.find((item) => item.slug === config.specializationSlug)?.name} />}
        <SummaryRow label="Banca" value={bank?.name ?? (config.path === "career" && config.mode !== "original_style" ? "Automática / não fixada" : undefined)} />
        <SummaryRow label="Matéria" value={subject?.name ?? (config.path === "career" && config.mode === "previous_exam" && config.examScope === "latest" ? "Sem filtro de matéria" : undefined)} />
        <SummaryRow label="Recorte" value={topic?.name ?? (subject ? "Matéria completa" : config.path === "career" && config.mode === "previous_exam" && config.examScope === "latest" ? "Edição mais recente" : undefined)} />
        <SummaryRow label="Questões" value={mode?.name} />
        {config.mode === "previous_exam" && <SummaryRow label="Edições" value={config.examScope === "latest" ? "Questões da última edição" : "Questões de todas as edições"} />}
        <SummaryRow label="Experiência" value={config.experience === "training" ? "Modo treino" : "Modo prova"} />
        <SummaryRow
          label="Ritmo"
          value={`${config.count} itens · ${config.timed ? (config.mode === "previous_exam" ? "cronômetro da edição/recorte" : `${formatDuration(config.count * 90)} cronometrados`) : "tempo livre"}`}
        />
      </dl>
      <div className="mt-5 rounded-xl border border-white/8 bg-black/15 p-3 text-[11px] leading-5 text-slate-500">
        <p className="flex items-start gap-2"><Banknote className="mt-0.5 size-3.5 shrink-0 text-slate-600" />Questões anteriores aparecem apenas quando houver licença e revisão editorial para o recorte.</p>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-300/15 bg-rose-300/6 p-3 text-xs leading-5 text-rose-200">{error}</p>}
      <button
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-black text-slate-950 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b171c] disabled:cursor-not-allowed disabled:opacity-35"
        disabled={!canStart || loading}
        onClick={onStart}
        type="button"
      >
        {loading ? <><LoaderCircle className="size-4 animate-spin" />Montando sessão…</> : <>Começar agora <ArrowRight className="size-4" /></>}
      </button>
      {!canStart && <p className="mt-2 text-center text-[10px] text-slate-600">Complete as escolhas acima para liberar.</p>}
    </aside>
  );
}

function StepHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-amber-300/15 bg-amber-300/8 text-[10px] font-black text-amber-300">{number}</span>
      <div><h2 className="text-base font-semibold text-slate-100 sm:text-lg">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
    </div>
  );
}

function SelectionButton({ label, helper, selected, onClick }: { label: string; helper: string; selected: boolean; onClick: () => void }) {
  return (
    <button aria-pressed={selected} className={cn("flex min-h-16 items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300", selected ? "border-amber-300/35 bg-amber-300/8" : "border-white/8 bg-slate-950/25 hover:border-white/16")} onClick={onClick} type="button">
      <span><strong className="block text-sm text-slate-200">{label}</strong><span className="mt-0.5 block text-[10px] text-slate-600">{helper}</span></span>
      {selected ? <Check className="size-4 shrink-0 text-amber-300" /> : <ChevronRight className="size-4 shrink-0 text-slate-700" />}
    </button>
  );
}

function TopicButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button aria-pressed={selected} className={cn("min-h-10 rounded-full border px-4 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300", selected ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-200" : "border-white/8 bg-slate-950/25 text-slate-500 hover:border-white/16 hover:text-slate-300")} onClick={onClick} type="button">{label}</button>
  );
}

function TimingOption({ icon: Icon, label, helper, selected, onClick }: { icon: typeof Clock3; label: string; helper?: string; selected: boolean; onClick: () => void }) {
  return (
    <label className={cn("cursor-pointer rounded-xl border p-3 text-left transition focus-within:ring-2 focus-within:ring-amber-300", selected ? "border-amber-300/35 bg-amber-300/8" : "border-white/8 bg-slate-950/25")}>
      <input className="sr-only" type="radio" name="timing" checked={selected} onChange={onClick} />
      <span className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Icon className={cn("size-4", selected ? "text-amber-300" : "text-slate-600")} />{label}</span>
      {helper && <span className="mt-1 block pl-6 text-[9px] text-slate-600">{helper}</span>}
    </label>
  );
}

function ExamScopeOption({ id, selected, onChange }: { id: QuizExamScope; selected: boolean; onChange: (value: QuizExamScope) => void }) {
  const latest = id === "latest";
  return (
    <label className={cn("cursor-pointer rounded-xl border p-3.5 transition focus-within:ring-2 focus-within:ring-amber-300", selected ? "border-sky-300/30 bg-sky-300/7" : "border-white/8 bg-slate-950/25")}>
      <input className="sr-only" type="radio" name="exam-scope" checked={selected} onChange={() => onChange(id)} />
      <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">{latest ? "Questões da última edição" : "Questões de todas as edições"}{latest && <span className="rounded-full bg-amber-300 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-950">Preferido</span>}</span>
      <span className="mt-1.5 block text-[10px] leading-4 text-slate-600">{latest ? "Usa a edição licenciada mais recente, quando existir." : "Mistura somente edições licenciadas no acervo."}</span>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value?: string }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-slate-600">{label}</dt><dd className={cn("max-w-[170px] text-right font-semibold", value ? "text-slate-300" : "text-slate-700")}>{value ?? "Escolha acima"}</dd></div>;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}min${String(remainder).padStart(2, "0")}` : `${minutes}min`;
}
