import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react";
import { sql } from "drizzle-orm";

import { requireSuperAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import {
  contactMessages,
  examEditions,
  questions,
  quizSessions,
  subscriptions,
  users,
} from "@/lib/db/schema";

const numberFormatter = new Intl.NumberFormat("pt-BR");

async function getAdminOverview() {
  const db = getDb();

  const [userRows, subscriptionRows, questionRows, examRows, sessionRows, contactRows] =
    await Promise.all([
      db
        // Contas de teste (domínio reservado .invalid) não contam como clientes.
        .select({ total: sql<number>`count(*) filter (where ${users.email} not ilike '%@example.invalid')::int` })
        .from(users),
      db
        .select({
          // Assinantes = só Stripe. Concessão manual/sintética (QA, cortesia) aparece à parte.
          total: sql<number>`count(*) filter (where ${subscriptions.provider} = 'stripe')::int`,
          entitled: sql<number>`count(*) filter (where ${subscriptions.provider} = 'stripe' and ${subscriptions.status} in ('active', 'trialing') and (${subscriptions.accessEndsAt} is null or ${subscriptions.accessEndsAt} > now()))::int`,
          trialing: sql<number>`count(*) filter (where ${subscriptions.provider} = 'stripe' and ${subscriptions.status} = 'trialing' and (${subscriptions.accessEndsAt} is null or ${subscriptions.accessEndsAt} > now()))::int`,
          granted: sql<number>`count(*) filter (where ${subscriptions.provider} <> 'stripe' and ${subscriptions.status} in ('active', 'trialing') and ${subscriptions.accessEndsAt} > now())::int`,
        })
        .from(subscriptions),
      db
        .select({
          total: sql<number>`count(*)::int`,
          reviewed: sql<number>`count(*) filter (where ${questions.editorialStatus} = 'reviewed')::int`,
          humanReviewed: sql<number>`count(*) filter (where ${questions.editorialStatus} = 'reviewed' and ${questions.reviewedByUserId} is not null)::int`,
          aiAssisted: sql<number>`count(*) filter (where ${questions.authorshipMethod} = 'ai_assisted')::int`,
          pending: sql<number>`count(*) filter (where ${questions.editorialStatus} in ('draft', 'pending_review'))::int`,
        })
        .from(questions),
      db
        .select({
          total: sql<number>`count(*)::int`,
          published: sql<number>`count(*) filter (where ${examEditions.status} = 'published')::int`,
        })
        .from(examEditions),
      db
        .select({
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${quizSessions.status} = 'completed')::int`,
        })
        .from(quizSessions),
      db
        .select({
          total: sql<number>`count(*)::int`,
          awaiting: sql<number>`count(*) filter (where ${contactMessages.status} in ('open', 'reviewing'))::int`,
        })
        .from(contactMessages),
    ]);

  return {
    users: userRows[0]?.total ?? 0,
    subscriptions: subscriptionRows[0] ?? { total: 0, entitled: 0, trialing: 0, granted: 0 },
    questions: questionRows[0] ?? { total: 0, reviewed: 0, humanReviewed: 0, aiAssisted: 0, pending: 0 },
    exams: examRows[0] ?? { total: 0, published: 0 },
    sessions: sessionRows[0] ?? { total: 0, completed: 0 },
    contacts: contactRows[0] ?? { total: 0, awaiting: 0 },
  };
}

type MetricCardProps = {
  label: string;
  value: number;
  detail: string;
  icon: typeof Users;
  tone: "amber" | "emerald" | "sky" | "violet";
};

const metricTones = {
  amber: "bg-els-amber/10 text-els-amber-ink",
  emerald: "bg-els-green/10 text-els-green-ink",
  sky: "bg-els-info/10 text-els-info-ink",
  violet: "bg-violet-300/10 text-violet-300",
} as const;

function MetricCard({ label, value, detail, icon: Icon, tone }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-els-line bg-els-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <span className={`grid size-10 place-items-center rounded-xl ${metricTones[tone]}`}>
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <span className="rounded-full border border-els-line bg-els-raise px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-els-fg-4">
          Banco real
        </span>
      </div>
      <p className="mt-6 text-3xl font-semibold tracking-[-.045em] text-els-fg">
        {numberFormatter.format(value)}
      </p>
      <h2 className="mt-1 text-sm font-semibold text-els-fg-2">{label}</h2>
      <p className="mt-2 text-xs leading-5 text-els-fg-3">{detail}</p>
    </article>
  );
}

function RatioBar({ label, value, total }: { label: string; value: number; total: number }) {
  const percentage = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-els-raise"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-els-amber to-els-green"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export default async function AdminOverviewPage() {
  await requireSuperAdmin();
  const overview = await getAdminOverview();

  const metricCards: MetricCardProps[] = [
    {
      label: "Usuários cadastrados",
      value: overview.users,
      detail: "Total de contas registradas na plataforma.",
      icon: Users,
      tone: "sky",
    },
    {
      label: "Assinaturas com acesso",
      value: overview.subscriptions.entitled,
      detail: `${numberFormatter.format(overview.subscriptions.trialing)} em período de teste; ${numberFormatter.format(overview.subscriptions.total)} registros no histórico; ${numberFormatter.format(overview.subscriptions.granted)} acessos de cortesia/QA fora da contagem.`,
      icon: CreditCard,
      tone: "emerald",
    },
    {
      label: "Questões liberadas no beta",
      value: overview.questions.reviewed,
      detail: `${numberFormatter.format(overview.questions.aiAssisted)} assistidas por IA; ${numberFormatter.format(overview.questions.humanReviewed)} com revisor humano registrado; ${numberFormatter.format(overview.questions.pending)} em rascunho ou revisão.`,
      icon: BookOpenCheck,
      tone: "amber",
    },
    {
      label: "Edições de prova",
      value: overview.exams.total,
      detail: `${numberFormatter.format(overview.exams.published)} com status publicado.`,
      icon: FileCheck2,
      tone: "violet",
    },
    {
      label: "Sessões de quiz",
      value: overview.sessions.total,
      detail: `${numberFormatter.format(overview.sessions.completed)} sessões concluídas.`,
      icon: ListChecks,
      tone: "sky",
    },
    {
      label: "Contatos recebidos",
      value: overview.contacts.total,
      detail: `${numberFormatter.format(overview.contacts.awaiting)} abertos ou em atendimento.`,
      icon: CircleHelp,
      tone: "amber",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.17em] text-els-amber-ink">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Super admin
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">
            Visão geral da operação
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-els-fg-3">
            Indicadores consolidados diretamente do PostgreSQL, sem dados demonstrativos.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-els-green/15 bg-els-green/8 px-3 py-1.5 text-xs font-semibold text-els-green-ink">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-els-green" />
          Atualizado nesta visita
        </span>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3" aria-label="Indicadores da operação">
        {metricCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-els-fg">Leitura operacional</h2>
              <p className="mt-1 text-xs text-els-fg-3">Proporções calculadas com o catálogo atual.</p>
            </div>
            <ClipboardCheck aria-hidden="true" className="size-5 text-els-green-ink" />
          </div>

          <div className="mt-7 grid gap-6">
            <div>
              <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                <span className="font-semibold text-els-fg-2">Revisor humano registrado</span>
                <span className="text-els-fg-3">
                  {numberFormatter.format(overview.questions.humanReviewed)} de {numberFormatter.format(overview.questions.reviewed)}
                </span>
              </div>
              <RatioBar
                label="Proporção de questões liberadas com revisor humano registrado"
                value={overview.questions.humanReviewed}
                total={overview.questions.reviewed}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                <span className="font-semibold text-els-fg-2">Provas publicadas</span>
                <span className="text-els-fg-3">
                  {numberFormatter.format(overview.exams.published)} de {numberFormatter.format(overview.exams.total)}
                </span>
              </div>
              <RatioBar
                label="Proporção de edições de prova publicadas"
                value={overview.exams.published}
                total={overview.exams.total}
              />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-4 text-xs">
                <span className="font-semibold text-els-fg-2">Quizzes concluídos</span>
                <span className="text-els-fg-3">
                  {numberFormatter.format(overview.sessions.completed)} de {numberFormatter.format(overview.sessions.total)}
                </span>
              </div>
              <RatioBar
                label="Proporção de sessões de quiz concluídas"
                value={overview.sessions.completed}
                total={overview.sessions.total}
              />
            </div>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[1.5rem] border border-els-amber/15 bg-[linear-gradient(145deg,var(--els-surface)_0%,var(--els-bg-2)_64%,var(--els-bg-2)_100%)] p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-els-amber/8 blur-3xl" />
          <div className="relative">
            <span className="grid size-11 place-items-center rounded-2xl bg-els-amber/10 text-els-amber-ink">
              <CreditCard aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-6 text-xl font-semibold tracking-[-.025em] text-els-fg">
              Stripe Connect
            </h2>
            <p className="mt-2 text-sm leading-6 text-els-fg-3">
              Área reservada para preparar parceiros, regras de divisão e a ativação controlada dos repasses.
            </p>
            <Link
              href="/admin/stripe-connect"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-els-amber px-4 text-sm font-bold text-els-on-amber transition hover:bg-els-amber"
            >
              Abrir configuração
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
