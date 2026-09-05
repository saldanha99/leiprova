import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db/client";
import { contestOrders, contestPurchases } from "@/lib/db/schema";
import { getCatalogContest, contestTitle } from "@/lib/commerce/catalog";
import { formatBRL } from "@/lib/plans";
import { getStudyEntitlement } from "@/lib/study/entitlement";
import { CancelContestOrder } from "@/components/checkout/cancel-contest-order";
import { PortalButton } from "@/components/checkout/portal-button";
import { CancelContestRenewal } from "@/components/checkout/cancel-contest-renewal";

export default async function PurchasesPage() {
  const user = await requireUser("/app/compras");
  const [orders, purchases, entitlement] = await Promise.all([
    getDb()
      .select()
      .from(contestOrders)
      .where(eq(contestOrders.userId, user.id))
      .orderBy(desc(contestOrders.createdAt))
      .limit(50),
    getDb()
      .select()
      .from(contestPurchases)
      .where(eq(contestPurchases.userId, user.id)),
    getStudyEntitlement(user.id),
  ]);
  const labels: Record<string, string> = {
    created: "Aguardando pagamento",
    pending: "Aguardando confirmação da Stripe",
    paid: "Pagamento confirmado",
    failed: "Pagamento não confirmado",
    expired: "Sessão expirada",
    refunded: "Pedido reembolsado — acesso revogado",
    disputed: "Contestação em análise — acesso suspenso",
  };
  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
        SEUS OBJETIVOS, ORGANIZADOS
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">
        Meus concursos e compras
      </h1>
      <p className="mt-5 text-sm leading-7 text-slate-400">
        {entitlement.hasFullAccess
          ? "Seu Master está ativo. Os concursos liberados estão incluídos durante a vigência da assinatura."
          : "Cada assinatura individual libera somente a edição indicada, durante o período pago."}{" "}
        O retorno da Stripe sozinho não libera acesso: aguardamos a confirmação
        autenticada do pagamento.
      </p>
      <div className="mt-8 flex flex-wrap gap-5 text-sm font-bold text-amber-200">
        <Link href="/app/quiz">Ir para os treinos</Link>
        <Link href="/app/assinatura">Gerenciar Master</Link>
        <Link href="/concursos">Explorar concursos</Link>
      </div>
      {user.stripeCustomerId && (
        <div className="mt-6">
          <PortalButton />
          <p className="mt-2 text-xs text-slate-400">
            Gerencie pagamentos e cancele a renovação. O cancelamento ao fim do
            período mantém o acesso já pago.
          </p>
        </div>
      )}
      <div className="mt-10 space-y-5">
        {orders.map((order) => (
          <section
            key={order.id}
            className="rounded-2xl border border-white/15 bg-white/3 p-6"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <h2 className="font-semibold">
                {labels[order.status] ?? order.status}
              </h2>
              <strong>
                {formatBRL(order.amountCents)}
                {order.lines[0]?.accessKey === "monthly"
                  ? "/mês"
                  : order.lines[0]?.accessKey === "annual"
                    ? "/ano"
                    : ""}
              </strong>
            </div>
            {order.lines.map((line) => {
              const contest = getCatalogContest(line.productSlug);
              const purchase = purchases.find(
                (item) =>
                  item.orderId === order.id &&
                  item.productSlug === line.productSlug,
              );
              return (
                <p
                  key={line.productSlug}
                  className="mt-4 text-sm leading-7 text-slate-300"
                >
                  {contest ? contestTitle(contest) : line.productSlug}
                  <span className="block text-xs text-slate-500">
                    {purchase
                      ? `${purchase.status === "active" && purchase.accessEndsAt > new Date() ? "Válido até" : "Acesso encerrado / suspenso"} ${purchase.accessEndsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`
                      : `${line.months} ${line.months === 1 ? "mês" : "meses"} após confirmação`}{" "}
                    ·{" "}
                    {order.stripeMode === "test"
                      ? "Ambiente de teste, sem cobrança real"
                      : order.stripeSubscriptionId
                        ? "Assinatura por concurso"
                        : "Acesso individual"}
                  </span>
                </p>
              );
            })}
            {order.subscriptionStatus && (
              <p className="mt-4 text-xs text-slate-400">
                {order.cancelAtPeriodEnd
                  ? "Renovação cancelada; acesso até o fim do período pago."
                  : ((
                      {
                        active: "Assinatura ativa · renovação automática",
                        past_due: "Renovação pendente de pagamento",
                        canceled: "Assinatura cancelada",
                        unpaid: "Pagamento não regularizado",
                        paused: "Assinatura pausada",
                        incomplete: "Aguardando primeiro pagamento",
                        incomplete_expired: "Assinatura não concluída",
                      } as Record<string, string>
                    )[order.subscriptionStatus] ??
                    "Confira o estado da assinatura na Stripe.")}
              </p>
            )}
            {order.stripeSessionId &&
              ["created", "pending"].includes(order.status) && (
                <CancelContestOrder orderId={order.id} />
              )}
            {order.stripeSubscriptionId &&
              !order.cancelAtPeriodEnd &&
              !["canceled", "incomplete_expired"].includes(
                order.subscriptionStatus ?? "",
              ) && <CancelContestRenewal orderId={order.id} />}
          </section>
        ))}
        {!orders.length && (
          <p className="rounded-2xl border border-white/15 p-7 text-sm text-slate-400">
            Você ainda não tem compras avulsas neste ambiente.
          </p>
        )}
      </div>
    </main>
  );
}
