import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BanknoteArrowUp,
  Building2,
  Check,
  CircleDollarSign,
  Clock3,
  DatabaseZap,
  FileLock2,
  GitBranch,
  LockKeyhole,
  Percent,
  ShieldAlert,
  UsersRound,
  X,
} from "lucide-react";

import type { StripeConnectAdminSnapshot } from "@/lib/db/connect-admin";
import { cn } from "@/lib/utils";
import {
  ConnectPartnerOnboardingButton,
  NewConnectPartnerButton,
} from "@/components/admin/stripe-connect-onboarding";

export type ConnectPanelReadiness = {
  ready: boolean;
  enabled: boolean;
  onboardingReady: boolean;
  apiConfigured: boolean;
  brApproved: boolean;
  recipientsReady: boolean;
  activeRuleReady: boolean;
  liveMode: boolean | null;
  requirements: string[];
};

const numberFormatter = new Intl.NumberFormat("pt-BR");
const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatBps(value: number) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100)}%`;
}

function formatMoney(cents: number) {
  return currencyFormatter.format(cents / 100);
}

function StatusBadge({ status }: { status: string }) {
  const positive = ["enabled", "active", "completed", "succeeded"].includes(status);
  const warning = ["onboarding", "restricted", "pending_approval", "processing", "planned"].includes(status);
  const labels: Record<string, string> = {
    active: "Ativa",
    archived: "Arquivada",
    completed: "Concluído",
    draft: "Rascunho",
    enabled: "Habilitado",
    failed: "Falhou",
    onboarding: "Em cadastro",
    partially_reversed: "Estorno parcial",
    paused: "Pausado",
    pending_approval: "Aguardando aprovação",
    planned: "Planejado",
    processing: "Processando",
    restricted: "Com pendências",
    reversed: "Estornado",
    succeeded: "Transferido",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em]",
        positive && "border-emerald-300/15 bg-emerald-300/8 text-emerald-200",
        warning && "border-amber-300/15 bg-amber-300/8 text-amber-200",
        !positive && !warning && "border-white/10 bg-white/5 text-slate-400",
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof UsersRound;
}) {
  return (
    <article className="rounded-2xl border border-white/8 bg-[#09131f] p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-amber-300/10 text-amber-300">
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>
      <p className="mt-5 text-2xl font-semibold tracking-[-.04em] text-white">{value}</p>
      <h2 className="mt-1 text-sm font-semibold text-slate-200">{label}</h2>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  );
}

function ReadinessItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-6 text-slate-300">
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
          ok ? "bg-emerald-300/12 text-emerald-300" : "bg-slate-700/50 text-slate-500",
        )}
      >
        {ok ? <Check aria-hidden="true" className="size-3" /> : <X aria-hidden="true" className="size-3" />}
      </span>
      {children}
    </li>
  );
}

export function StripeConnectPanel({
  readiness,
  snapshot,
}: {
  readiness: ConnectPanelReadiness;
  snapshot: StripeConnectAdminSnapshot;
}) {
  const transferredCents = Number(snapshot.summary.transfers.transferredCents ?? 0);

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-7 lg:px-9 lg:py-9">
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.17em] text-amber-300">
            <GitBranch aria-hidden="true" className="size-3.5" />
            Financeiro · Stripe Connect
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">
            Divisão auditável de pagamentos
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Estrutura preparada para contas Express e cobranças e transferências separadas. O executor financeiro ainda não está conectado ao checkout e continuará ausente até todas as travas abaixo serem liberadas.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold",
            readiness.ready
              ? "border-emerald-300/20 bg-emerald-300/8 text-emerald-200"
              : "border-amber-300/20 bg-amber-300/8 text-amber-200",
          )}
        >
          {readiness.ready ? <BadgeCheck className="size-4" /> : <LockKeyhole className="size-4" />}
          {readiness.ready ? "Pré-configuração completa" : "Repasses bloqueados"}
        </span>
      </header>

      <section className="mt-7 rounded-[1.5rem] border border-amber-300/18 bg-[linear-gradient(135deg,rgba(251,191,36,.08),rgba(14,116,144,.05))] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-300/10 text-amber-300">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-amber-100">Brasil ainda exige confirmação da Stripe</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              A documentação atual lista contas conectadas no Brasil como disponibilidade em preview. O modelo de cobranças e transferências separadas aceita Brasil, mas só será ativado depois da habilitação do Connect para a conta, validação de KYC dos recebedores e revisão contábil/jurídica da sociedade.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
              <a
                href="https://docs.stripe.com/connect/how-connect-works"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-amber-200 hover:text-amber-100"
              >
                Disponibilidade oficial <ArrowUpRight className="size-3.5" />
              </a>
              <a
                href="https://docs.stripe.com/connect/separate-charges-and-transfers?locale=pt-BR"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sky-200 hover:text-sky-100"
              >
                Modelo de cobrança <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4" aria-label="Resumo do Stripe Connect">
        <SummaryCard
          icon={UsersRound}
          label="Parceiros cadastrados"
          value={numberFormatter.format(snapshot.summary.partners.total)}
          detail={`${numberFormatter.format(snapshot.summary.partners.payoutReady)} com repasses habilitados pela Stripe.`}
        />
        <SummaryCard
          icon={Percent}
          label="Regras ativas"
          value={numberFormatter.format(snapshot.rules.filter((rule) => rule.status === "active").length)}
          detail={`${numberFormatter.format(snapshot.rules.length)} versões registradas no total.`}
        />
        <SummaryCard
          icon={BanknoteArrowUp}
          label="Lotes concluídos"
          value={numberFormatter.format(snapshot.summary.transfers.completedBatches)}
          detail={`${numberFormatter.format(snapshot.summary.transfers.totalBatches)} lotes auditáveis registrados.`}
        />
        <SummaryCard
          icon={CircleDollarSign}
          label="Transferido"
          value={formatMoney(transferredCents)}
          detail="Soma somente de transferências com status concluído."
        />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
        <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-white">Travas de ativação</h2>
              <p className="mt-1 text-xs text-slate-500">Todas precisam estar liberadas simultaneamente.</p>
            </div>
            <ShieldAlert aria-hidden="true" className="size-5 text-amber-300" />
          </div>
          <ul className="mt-6 grid gap-4">
            <ReadinessItem ok={readiness.apiConfigured}>Nova chave restrita do servidor configurada</ReadinessItem>
            <ReadinessItem ok={readiness.brApproved}>Connect Brasil aprovado para esta conta</ReadinessItem>
            <ReadinessItem ok={readiness.recipientsReady}>Todos os recebedores da regra com KYC, conta e payout ativos</ReadinessItem>
            <ReadinessItem ok={readiness.activeRuleReady}>Regra vigente, compatível e somando exatamente 100%</ReadinessItem>
            <ReadinessItem ok={readiness.enabled}>Chave geral STRIPE_CONNECT_ENABLED liberada</ReadinessItem>
          </ul>
          {readiness.requirements.length > 0 && (
            <div className="mt-6 rounded-xl border border-white/8 bg-black/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">Pendências técnicas</p>
              <ul className="mt-2 grid gap-1 text-xs leading-5 text-slate-400">
                {readiness.requirements.map((requirement) => <li key={requirement}>• {requirement}</li>)}
              </ul>
            </div>
          )}
          <div
            className={cn(
              "mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-center text-sm font-bold",
              readiness.ready ? "bg-emerald-300/12 text-emerald-200" : "bg-slate-800 text-slate-500",
            )}
          >
            <LockKeyhole className="size-4" />
            {readiness.ready ? "Pré-requisitos conferidos; executor ainda não instalado" : "Ativação bloqueada com segurança"}
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-white">Arquitetura preparada</h2>
              <p className="mt-1 text-xs text-slate-500">Cada etapa deixa rastros próprios no PostgreSQL.</p>
            </div>
            <DatabaseZap aria-hidden="true" className="size-5 text-emerald-300" />
          </div>
          <ol className="mt-7 grid gap-3 sm:grid-cols-2">
            {[
              [Building2, "Conta conectada", "ID da Stripe e estados de KYC; nenhum dado bancário sensível é salvo aqui."],
              [Percent, "Regra versionada", "Percentual da plataforma e de cada parceiro em basis points."],
              [GitBranch, "Lote por cobrança", "Vínculo único com a tentativa de checkout e o transfer group."],
              [FileLock2, "Ledger de repasses", "Idempotência, valor, falha e reversão de cada transferência."],
            ].map(([Icon, title, detail], index) => {
              const StepIcon = Icon as typeof Building2;
              return (
                <li key={String(title)} className="rounded-2xl border border-white/7 bg-white/[.025] p-4">
                  <span className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-lg bg-emerald-300/9 text-xs font-bold text-emerald-300">{index + 1}</span>
                    <StepIcon aria-hidden="true" className="size-4 text-slate-500" />
                  </span>
                  <strong className="mt-4 block text-sm text-slate-200">{String(title)}</strong>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{String(detail)}</p>
                </li>
              );
            })}
          </ol>
        </article>
      </section>

      <section className="mt-4 rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-white">Parceiros e contas conectadas</h2>
            <p className="mt-1 text-xs text-slate-500">Cadastro local, onboarding Express e requisitos retornados pela Stripe.</p>
          </div>
          <NewConnectPartnerButton enabled={readiness.onboardingReady} />
        </div>
        {snapshot.partners.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <Building2 aria-hidden="true" className="mx-auto size-7 text-slate-700" />
            <p className="mt-3 text-sm font-semibold text-slate-300">Nenhum parceiro cadastrado</p>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-600">O primeiro cadastro será liberado somente depois da aprovação do Connect e da definição jurídica de quem efetivamente receberá os valores.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[.12em] text-slate-600"><tr><th className="pb-3">Parceiro</th><th className="pb-3">Conta</th><th className="pb-3">KYC</th><th className="pb-3">Cobranças</th><th className="pb-3">Repasses</th><th className="pb-3">Status</th><th className="pb-3">Onboarding</th></tr></thead>
              <tbody className="divide-y divide-white/7">
                {snapshot.partners.map((partner) => (
                  <tr key={partner.publicId}>
                    <td className="py-4 pr-5"><strong className="block text-slate-200">{partner.displayName}</strong><span className="mt-1 block text-slate-600">{partner.email}</span></td>
                    <td className="py-4 pr-5 font-mono text-slate-500">{partner.stripeAccountId ?? "Não criada"}</td>
                    <td className="py-4 pr-5 text-slate-400">{partner.detailsSubmitted ? "Enviado" : "Pendente"}</td>
                    <td className="py-4 pr-5 text-slate-400">{partner.chargesEnabled ? "Ativas" : "Bloqueadas"}</td>
                    <td className="py-4 pr-5 text-slate-400">{partner.payoutsEnabled ? "Ativos" : "Bloqueados"}</td>
                    <td className="py-4 pr-5"><StatusBadge status={partner.status} /></td>
                    <td className="py-4"><ConnectPartnerOnboardingButton partnerPublicId={partner.publicId} enabled={readiness.onboardingReady && partner.status !== "enabled" && partner.status !== "archived"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
        <div>
          <h2 className="font-semibold text-white">Regras de divisão</h2>
          <p className="mt-1 text-xs text-slate-500">A soma da plataforma e dos parceiros precisa fechar em 10.000 bps = 100%.</p>
        </div>
        {snapshot.rules.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center">
            <Percent aria-hidden="true" className="mx-auto size-7 text-slate-700" />
            <p className="mt-3 text-sm font-semibold text-slate-300">Nenhuma regra criada</p>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-600">Os percentuais serão versionados; uma alteração futura não reescreve o histórico de pagamentos anteriores.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {snapshot.rules.map((rule) => {
              const allocatedBps = rule.allocations.reduce((sum, item) => sum + item.shareBps, 0);
              const totalBps = rule.platformShareBps + allocatedBps;
              return (
                <article key={rule.publicId} className="rounded-2xl border border-white/7 bg-white/[.025] p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-200">{rule.name}</strong><StatusBadge status={rule.status} /></div><p className="mt-1 text-xs text-slate-600">Versão {rule.version} · Separate charges and transfers</p></div><strong className={cn("text-sm", totalBps === 10000 ? "text-emerald-300" : "text-rose-300")}>{formatBps(totalBps)} alocado</strong></div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-lg border border-amber-300/10 bg-amber-300/5 px-3 py-2 text-amber-100">Plataforma: {formatBps(rule.platformShareBps)}</span>{rule.allocations.map((allocation) => <span key={allocation.partnerId} className="rounded-lg border border-sky-300/10 bg-sky-300/5 px-3 py-2 text-sky-100">{allocation.partnerName}: {formatBps(allocation.shareBps)}</span>)}</div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-white">Histórico de lotes</h2><p className="mt-1 text-xs text-slate-500">Últimos 20 lotes; vazio enquanto o Connect estiver desligado.</p></div><Clock3 aria-hidden="true" className="size-5 text-slate-600" /></div>
        {snapshot.batches.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center"><BanknoteArrowUp aria-hidden="true" className="mx-auto size-7 text-slate-700" /><p className="mt-3 text-sm font-semibold text-slate-300">Nenhum repasse executado</p><p className="mt-1 text-xs text-slate-600">Este é o estado esperado antes da ativação.</p></div>
        ) : (
          <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="text-[10px] uppercase tracking-[.12em] text-slate-600"><tr><th className="pb-3">Criado</th><th className="pb-3">Ambiente</th><th className="pb-3">Bruto</th><th className="pb-3">Plataforma</th><th className="pb-3">Parceiros</th><th className="pb-3">Status</th></tr></thead><tbody className="divide-y divide-white/7">{snapshot.batches.map((batch) => <tr key={batch.id}><td className="py-4 pr-4 text-slate-500">{dateFormatter.format(batch.createdAt)}</td><td className="py-4 pr-4 text-slate-500">{batch.livemode ? "Live" : "Teste"}</td><td className="py-4 pr-4 text-slate-300">{formatMoney(batch.grossAmountCents)}</td><td className="py-4 pr-4 text-slate-400">{formatMoney(batch.platformAmountCents)}</td><td className="py-4 pr-4 text-slate-400">{formatMoney(batch.partnerAmountCents)}</td><td className="py-4"><StatusBadge status={batch.status} /></td></tr>)}</tbody></table></div>
        )}
      </section>

      <footer className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/7 bg-white/[.025] p-4 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2"><FileLock2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-300" />As chaves ficam somente no servidor; esta tela nunca recebe segredos nem dados bancários.</p>
        <Link href="/admin" className="font-semibold text-slate-300 hover:text-white">Voltar à visão geral</Link>
      </footer>
    </main>
  );
}
