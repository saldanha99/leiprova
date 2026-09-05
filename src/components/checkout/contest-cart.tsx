"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import {
  CONTEST_ACCESS_OPTIONS,
  contestTitle,
  type CatalogContest,
  type ContestAccessKey,
} from "@/lib/commerce/catalog";
import { formatBRL, PLANS } from "@/lib/plans";
import { contestCartTotal } from "@/lib/commerce/order-policy";

export function ContestCart({
  contest,
  related,
  initialAccess,
  available,
}: {
  contest: CatalogContest;
  related: CatalogContest[];
  initialAccess: ContestAccessKey;
  available: boolean;
}) {
  const [access, setAccess] = useState(initialAccess);
  const [extras, setExtras] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const items = [
    { productSlug: contest.slug, accessKey: access },
    ...extras.map((slug) => ({ productSlug: slug, accessKey: "6m" as const })),
  ];
  const total = contestCartTotal(items);
  async function checkout() {
    setError("");
    setPending(true);
    const signature = JSON.stringify(items);
    if (attempt.current?.signature !== signature)
      attempt.current = { signature, id: crypto.randomUUID() };
    try {
      const response = await fetch("/api/stripe/contest-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.current.id, items }),
      });
      const data: { url?: string; error?: string } = await response.json();
      if (!response.ok || !data.url)
        throw new Error(data.error ?? "Não foi possível abrir o pagamento.");
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
        throw new Error("Endereço de pagamento inválido.");
      window.location.assign(url.href);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao iniciar o pagamento.",
      );
      setPending(false);
    }
  }
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_.8fr]">
      <div>
        <span className="text-xs font-extrabold uppercase tracking-widest text-emerald-300">
          01 / Seu concurso
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          {contestTitle(contest)}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          Escolha o prazo de acesso. Você compra somente esta edição, sem
          renovação automática.
        </p>
        <fieldset disabled={pending} className="mt-7 grid gap-3">
          <legend className="sr-only">Prazo de acesso</legend>
          {CONTEST_ACCESS_OPTIONS.map((option) => (
            <label
              key={option.key}
              className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-5 ${access === option.key ? "border-amber-200/40 bg-amber-200/5" : "border-white/15 bg-white/3"}`}
            >
              <input
                type="radio"
                name="acesso"
                value={option.key}
                checked={access === option.key}
                onChange={() => setAccess(option.key)}
                className="size-5 accent-amber-200"
              />
              <span className="flex-1">
                <strong>
                  {option.label} · {option.months} meses
                </strong>
                <small className="mt-2 block text-slate-400">
                  {option.key === "12m"
                    ? `Mais ${option.months - CONTEST_ACCESS_OPTIONS[0].months} meses por ${formatBRL(option.amountCents - CONTEST_ACCESS_OPTIONS[0].amountCents)} adicionais no total.`
                    : "Um ciclo de estudo dedicado ao seu objetivo."}
                </small>
              </span>
              <strong className="text-xl text-amber-100">
                {formatBRL(option.amountCents)}
              </strong>
            </label>
          ))}
        </fieldset>
        {related.length > 0 && (
          <fieldset disabled={pending} className="mt-10">
            <legend className="text-lg font-semibold">
              02 / Outros objetivos na mesma carreira
            </legend>
            <p className="my-3 text-sm leading-6 text-slate-400">
              Opcional. Cada adicional é outro concurso, com 6 meses de acesso.
              Nenhum vem marcado.
            </p>
            <div className="space-y-3">
              {related.slice(0, 2).map((item) => (
                <label
                  key={item.slug}
                  className="flex cursor-pointer items-center gap-4 rounded-xl border border-white/15 p-5"
                >
                  <input
                    type="checkbox"
                    checked={extras.includes(item.slug)}
                    onChange={(event) =>
                      setExtras(
                        event.target.checked
                          ? [...extras, item.slug]
                          : extras.filter((slug) => slug !== item.slug),
                      )
                    }
                    className="size-5 accent-amber-200"
                  />
                  <span className="flex-1 text-sm">
                    <strong>{contestTitle(item)}</strong>
                    <small className="mt-2 block text-slate-400">
                      Pagamento único · 6 meses
                    </small>
                  </span>
                  <strong className="text-sm text-amber-100">
                    + {formatBRL(CONTEST_ACCESS_OPTIONS[0].amountCents)}
                  </strong>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <aside className="mt-8 rounded-2xl border border-emerald-200/20 bg-emerald-200/5 p-6">
          <h2 className="text-lg font-semibold">
            Vai estudar para vários concursos?
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            O Master inclui os concursos liberados durante a assinatura. Compare
            antes de comprar avulsos:{" "}
            {PLANS.map(
              (plan) => `${formatBRL(plan.priceCents)}${plan.billingLabel}`,
            ).join(" ou ")}
            . A assinatura substitui a seleção avulsa; não é adicionada
            automaticamente.
          </p>
          <Link
            href="/#planos"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-emerald-200"
          >
            Comparar com o Master
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </div>
      <aside className="rounded-[1.5rem] border border-white/15 bg-[#101d2d] p-6 lg:sticky lg:top-8">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Resumo transparente
        </p>
        <h2 className="mt-4 text-2xl font-semibold">Seu próximo passo</h2>
        <ul className="mt-6 space-y-4 text-sm">
          {items.map((item) => (
            <li key={item.productSlug} className="flex gap-3">
              <Check
                size={16}
                className="mt-1 shrink-0 text-emerald-300"
                aria-hidden="true"
              />
              <span>
                {item.productSlug === contest.slug
                  ? contestTitle(contest)
                  : contestTitle(
                      related.find(
                        (candidate) => candidate.slug === item.productSlug,
                      )!,
                    )}
                <small className="mt-1 block text-slate-400">
                  {item.accessKey === "6m" ? "6" : "12"} meses ·{" "}
                  {formatBRL(
                    CONTEST_ACCESS_OPTIONS.find(
                      (option) => option.key === item.accessKey,
                    )!.amountCents,
                  )}
                </small>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-7 border-t border-white/15 pt-5">
          <span className="text-sm text-slate-400">Total, pagamento único</span>
          <strong
            className="mt-2 block text-4xl tracking-tight text-amber-100"
            aria-live="polite"
          >
            {formatBRL(total)}
          </strong>
          <p className="mt-3 text-xs leading-6 text-slate-400">
            Sem assinatura ou cobrança recorrente. A vigência começa na
            confirmação do pagamento. Sem promessa de aprovação ou de cobertura
            integral do edital.
          </p>
        </div>
        {!available && (
          <p className="mt-5 rounded-lg border border-amber-200/20 p-4 text-xs leading-6 text-amber-100">
            Prévia da oferta. Produto ou pagamentos ainda não liberados. Nenhuma
            cobrança pode ser iniciada aqui.
          </p>
        )}
        <button
          disabled={!available || pending}
          onClick={checkout}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-200 p-3 text-sm font-extrabold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LockKeyhole size={16} aria-hidden="true" />
          {pending
            ? "Preparando pagamento…"
            : available
              ? "Continuar para a Stripe"
              : "Compra ainda não disponível"}
        </button>
        {error && (
          <p role="alert" className="mt-4 text-sm text-rose-200">
            {error}
          </p>
        )}
        <p className="mt-5 text-xs leading-6 text-slate-400">
          Confira os{" "}
          <Link href="/termos" className="underline">
            termos
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="underline">
            política de privacidade
          </Link>{" "}
          antes da confirmação.
        </p>
      </aside>
    </div>
  );
}
