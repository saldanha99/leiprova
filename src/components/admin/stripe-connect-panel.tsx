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
        positive && "border-els-green/15 bg-els-green/8 text-els-green-ink",
        warning && "border-els-amber/15 bg-els-amber/8 text-els-amber-ink",
        !positive && !warning && "border-els-line bg-els-raise text-els-fg-3",
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
    <article className="rounded-2xl border border-els-line bg-els-surface p-5">
      <span className="grid size-10 place-items-center rounded-xl bg-els-amber/10 text-els-amber-ink">
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>
      <p className="mt-5 text-2xl font-semibold tracking-[-.04em] text-els-fg">{value}</p>
      <h2 className="mt-1 text-sm font-semibold text-els-fg-2">{label}</h2>
      <p className="mt-2 text-xs leading-5 text-els-fg-3">{detail}</p>
    </article>
  );
}

function ReadinessItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-6 text-els-fg-2">
      <span
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
          ok ? "bg-els-green/12 text-els-green-ink" : "bg-els-fg-4/50 text-els-fg-3",
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
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.17em] text-els-amber-ink">
            <GitBranch aria-hidden="true" className="size-3.5" />
            Financeiro · Stripe Connect
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">
            Divisão auditável de pagamentos
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-els-fg-3">
            Estrutura preparada para contas Express e cobranças e transferências separadas. O executor financeiro ainda não está conectado ao checkout e continuará ausente até todas as travas abaixo serem liberadas.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold",
            readiness.ready
              ? "border-els-green/20 bg-els-green/8 text-els-green-ink"
              : "border-els-amber/20 bg-els-amber/8 text-els-amber-ink",
          )}
        >
          {readiness.ready ? <BadgeCheck className="size-4" /> : <LockKeyhole className="size-4" />}
          {readiness.ready ? "Pré-configuração completa" : "Repasses bloqueados"}
        </span>
      </header>

      <section className="mt-7 rounded-[1.5rem] border border-els-amber/18 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--els-amber)_8%,transparent),color-mix(in_oklch,var(--els-surface-2)_5%,transparent))] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-els-amber/10 text-els-amber-ink">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-els-amber-ink">Brasil ainda exige confirmação da Stripe</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-els-fg-3">
              A documentação atual lista contas conectadas no Brasil como disponibilidade em preview. O modelo de cobranças e transferências separadas aceita Brasil, mas só será ativado depois da habilitação do Connect para a conta, validação de KYC dos recebedores e revisão contábil/jurídica da sociedade.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
              <a
                href="https://docs.stripe.com/connect/how-connect-works"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-els-amber-ink hover:text-els-amber-ink min-h-11"
              >
                Disponibilidade oficial <ArrowUpRight className="size-3.5" />
              </a>
              <a
                href="https://docs.stripe.com/connect/separate-charges-and-transfers?locale=pt-BR"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-els-info-ink hover:text-els-fg min-h-11"
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
        <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-els-fg">Travas de ativação</h2>
              <p className="mt-1 text-xs text-els-fg-3">Todas precisam estar liberadas simultaneamente.</p>
            </div>
            <ShieldAlert aria-hidden="true" className="size-5 text-els-amber-ink" />
          </div>
          <ul className="mt-6 grid gap-4">
            <ReadinessItem ok={readiness.apiConfigured}>Nova chave restrita do servidor configurada</ReadinessItem>
            <ReadinessItem ok={readiness.brApproved}>Connect Brasil aprovado para esta conta</ReadinessItem>
            <ReadinessItem ok={readiness.recipientsReady}>Todos os recebedores da regra com KYC, conta e payout ativos</ReadinessItem>
            <ReadinessItem ok={readiness.activeRuleReady}>Regra vigente, compatível e somando exatamente 100%</ReadinessItem>
            <ReadinessItem ok={readiness.enabled}>Chave geral STRIPE_CONNECT_ENABLED liberada</ReadinessItem>
          </ul>
          {readiness.requirements.length > 0 && (
            <div className="mt-6 rounded-xl border border-els-line bg-els-sink p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-els-fg-3">Pendências técnicas</p>
              <ul className="mt-2 grid gap-1 text-xs leading-5 text-els-fg-3">
                {readiness.requirements.map((requirement) => <li key={requirement}>• {requirement}</li>)}
              </ul>
            </div>
          )}
          <div
            className={cn(
              "mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-center text-sm font-bold",
              readiness.ready ? "bg-els-green/12 text-els-green-ink" : "bg-els-surface-2 text-els-fg-3",
            )}
          >
            <LockKeyhole className="size-4" />
            {readiness.ready ? "Pré-requisitos conferidos; executor ainda não instalado" : "Ativação bloqueada com segurança"}
          </div>
        </article>

        <article className="rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-els-fg">Arquitetura preparada</h2>
              <p className="mt-1 text-xs text-els-fg-3">Cada etapa deixa rastros próprios no PostgreSQL.</p>
            </div>
            <DatabaseZap aria-hidden="true" className="size-5 text-els-green-ink" />
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
                <li key={String(title)} className="rounded-2xl border border-els-line bg-els-raise p-4">
                  <span className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-lg bg-els-green/9 text-xs font-bold text-els-green-ink">{index + 1}</span>
                    <StepIcon aria-hidden="true" className="size-4 text-els-fg-3" />
                  </span>
                  <strong className="mt-4 block text-sm text-els-fg-2">{String(title)}</strong>
                  <p className="mt-1 text-xs leading-5 text-els-fg-3">{String(detail)}</p>
                </li>
              );
            })}
          </ol>
        </article>
      </section>

      <section className="mt-4 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-els-fg">Parceiros e contas conectadas</h2>
            <p className="mt-1 text-xs text-els-fg-3">Cadastro local, onboarding Express e requisitos retornados pela Stripe.</p>
          </div>
          <NewConnectPartnerButton enabled={readiness.onboardingReady} />
        </div>
        {snapshot.partners.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-els-line p-8 text-center">
            <Building2 aria-hidden="true" className="mx-auto size-7 text-els-fg-4" />
            <p className="mt-3 text-sm font-semibold text-els-fg-2">Nenhum parceiro cadastrado</p>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-els-fg-4">O primeiro cadastro será liberado somente depois da aprovação do Connect e da definição jurídica de quem efetivamente receberá os valores.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[.12em] text-els-fg-4"><tr><th className="pb-3">Parceiro</th><th className="pb-3">Conta</th><th className="pb-3">KYC</th><th className="pb-3">Cobranças</th><th className="pb-3">Repasses</th><th className="pb-3">Status</th><th className="pb-3">Onboarding</th></tr></thead>
              <tbody className="divide-y divide-els-line">
                {snapshot.partners.map((partner) => (
                  <tr key={partner.publicId}>
                    <td className="py-4 pr-5"><strong className="block text-els-fg-2">{partner.displayName}</strong><span className="mt-1 block text-els-fg-4">{partner.email}</span></td>
                    <td className="py-4 pr-5 font-mono text-els-fg-3">{partner.stripeAccountId ?? "Não criada"}</td>
                    <td className="py-4 pr-5 text-els-fg-3">{partner.detailsSubmitted ? "Enviado" : "Pendente"}</td>
                    <td className="py-4 pr-5 text-els-fg-3">{partner.chargesEnabled ? "Ativas" : "Bloqueadas"}</td>
                    <td className="py-4 pr-5 text-els-fg-3">{partner.payoutsEnabled ? "Ativos" : "Bloqueados"}</td>
                    <td className="py-4 pr-5"><StatusBadge status={partner.status} /></td>
                    <td className="py-4"><ConnectPartnerOnboardingButton partnerPublicId={partner.publicId} enabled={readiness.onboardingReady && partner.status !== "enabled" && partner.status !== "archived"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
        <div>
          <h2 className="font-semibold text-els-fg">Regras de divisão</h2>
          <p className="mt-1 text-xs text-els-fg-3">A soma da plataforma e dos parceiros precisa fechar em 10.000 bps = 100%.</p>
        </div>
        {snapshot.rules.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-els-line p-8 text-center">
            <Percent aria-hidden="true" className="mx-auto size-7 text-els-fg-4" />
            <p className="mt-3 text-sm font-semibold text-els-fg-2">Nenhuma regra criada</p>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-els-fg-4">Os percentuais serão versionados; uma alteração futura não reescreve o histórico de pagamentos anteriores.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {snapshot.rules.map((rule) => {
              const allocatedBps = rule.allocations.reduce((sum, item) => sum + item.shareBps, 0);
              const totalBps = rule.platformShareBps + allocatedBps;
              return (
                <article key={rule.publicId} className="rounded-2xl border border-els-line bg-els-raise p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-els-fg-2">{rule.name}</strong><StatusBadge status={rule.status} /></div><p className="mt-1 text-xs text-els-fg-4">Versão {rule.version} · Separate charges and transfers</p></div><strong className={cn("text-sm", totalBps === 10000 ? "text-els-green-ink" : "text-els-danger-ink")}>{formatBps(totalBps)} alocado</strong></div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-lg border border-els-amber/10 bg-els-amber/5 px-3 py-2 text-els-amber-ink">Plataforma: {formatBps(rule.platformShareBps)}</span>{rule.allocations.map((allocation) => <span key={allocation.partnerId} className="rounded-lg border border-els-info/10 bg-els-info/5 px-3 py-2 text-els-fg">{allocation.partnerName}: {formatBps(allocation.shareBps)}</span>)}</div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[1.5rem] border border-els-line bg-els-surface p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-els-fg">Histórico de lotes</h2><p className="mt-1 text-xs text-els-fg-3">Últimos 20 lotes; vazio enquanto o Connect estiver desligado.</p></div><Clock3 aria-hidden="true" className="size-5 text-els-fg-4" /></div>
        {snapshot.batches.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-els-line p-8 text-center"><BanknoteArrowUp aria-hidden="true" className="mx-auto size-7 text-els-fg-4" /><p className="mt-3 text-sm font-semibold text-els-fg-2">Nenhum repasse executado</p><p className="mt-1 text-xs text-els-fg-4">Este é o estado esperado antes da ativação.</p></div>
        ) : (
          <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="text-[10px] uppercase tracking-[.12em] text-els-fg-4"><tr><th className="pb-3">Criado</th><th className="pb-3">Ambiente</th><th className="pb-3">Bruto</th><th className="pb-3">Plataforma</th><th className="pb-3">Parceiros</th><th className="pb-3">Status</th></tr></thead><tbody className="divide-y divide-els-line">{snapshot.batches.map((batch) => <tr key={batch.id}><td className="py-4 pr-4 text-els-fg-3">{dateFormatter.format(batch.createdAt)}</td><td className="py-4 pr-4 text-els-fg-3">{batch.livemode ? "Live" : "Teste"}</td><td className="py-4 pr-4 text-els-fg-2">{formatMoney(batch.grossAmountCents)}</td><td className="py-4 pr-4 text-els-fg-3">{formatMoney(batch.platformAmountCents)}</td><td className="py-4 pr-4 text-els-fg-3">{formatMoney(batch.partnerAmountCents)}</td><td className="py-4"><StatusBadge status={batch.status} /></td></tr>)}</tbody></table></div>
        )}
      </section>

      <footer className="mt-5 flex flex-col gap-3 rounded-2xl border border-els-line bg-els-raise p-4 text-xs leading-5 text-els-fg-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2"><FileLock2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-els-green-ink" />As chaves ficam somente no servidor; esta tela nunca recebe segredos nem dados bancários.</p>
        <Link href="/admin" className="font-semibold text-els-fg-2 hover:text-els-fg min-h-11 inline-flex items-center">Voltar à visão geral</Link>
      </footer>
    </main>
  );
}
