"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Layers3,
  LockKeyhole,
  Minus,
  ShieldCheck,
} from "lucide-react";
import {
  CONTEST_ACCESS_OPTIONS,
  CONTEST_ANNUAL_COMPARISON,
  contestTitle,
  type CatalogContest,
  type ContestAccessKey,
} from "@/lib/commerce/catalog";
import { formatBRL, PLANS } from "@/lib/plans";
import { contestCartTotal } from "@/lib/commerce/order-policy";
import styles from "./contest-cart.module.css";

export function ContestCart({
  contest,
  related,
  initialAccess,
  available,
  supplierIdentity,
}: {
  contest: CatalogContest;
  related: CatalogContest[];
  initialAccess: ContestAccessKey;
  available: boolean;
  supplierIdentity?: ReactNode;
}) {
  const [access, setAccess] = useState(initialAccess);
  const [extras, setExtras] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const selectedContests = [
    contest,
    ...related.filter((item) => extras.includes(item.slug)),
  ];
  const items = selectedContests.map((item) => ({
    productSlug: item.slug,
    accessKey: access,
  }));
  const selectedOption = CONTEST_ACCESS_OPTIONS.find(
    (option) => option.key === access,
  )!;
  const total = contestCartTotal(items);
  const annualSavings =
    CONTEST_ANNUAL_COMPARISON.savingsCents * selectedContests.length;
  const comparableMaster = PLANS.find(
    (plan) => plan.billingMonths === selectedOption.months,
  );
  const masterSavings = comparableMaster
    ? Math.max(0, total - comparableMaster.priceCents)
    : 0;

  function chooseAccess(next: ContestAccessKey) {
    setAccess(next);
    setError("");
  }
  function removeExtra(slug: string) {
    setExtras((current) => current.filter((item) => item !== slug));
    setError("");
  }

  async function checkout() {
    if (!available || pending) return;
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
    <div className={styles.checkout}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>Seu estudo. Do seu jeito.</p>
        <h1>
          Um objetivo claro.
          <br />
          <em>Uma escolha sua.</em>
        </h1>
        <p>
          Personalize sua assinatura, confira cada valor e só então continue
          para o pagamento.
        </p>
      </div>
      <div className={styles.layout}>
        <div className={styles.configuration}>
          <section
            className={styles.courseIdentity}
            aria-labelledby="checkout-course-title"
          >
            <span className={styles.courseIcon}>
              <Layers3 size={22} aria-hidden="true" />
            </span>
            <div>
              <p className={styles.eyebrow}>Concurso escolhido</p>
              <h2 id="checkout-course-title">{contestTitle(contest)}</h2>
              <p>Uma assinatura individual para esta edição.</p>
            </div>
          </section>
          <fieldset disabled={pending} className={styles.planSection}>
            <legend className={styles.sectionTitle}>
              <span>01</span> Escolha seu ritmo
            </legend>
            <p className={styles.sectionDescription}>
              O mesmo concurso, duas formas de assinar. Sem taxa de adesão.
            </p>
            <div className={styles.planGrid}>
              {CONTEST_ACCESS_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className={`${styles.plan} ${option.key === "annual" ? styles.annualPlan : styles.monthlyPlan}`}
                  data-checkout-plan={option.key}
                  data-selected={access === option.key}
                >
                  <div className={styles.planTop}>
                    <input
                      type="radio"
                      name="acesso"
                      value={option.key}
                      aria-label={`Plano ${option.label.toLowerCase()}`}
                      aria-describedby={`checkout-plan-price-${option.key} checkout-plan-terms-${option.key}`}
                      checked={access === option.key}
                      onChange={() => chooseAccess(option.key)}
                    />
                    <span className={styles.planBadge}>
                      {option.key === "annual"
                        ? `≈${CONTEST_ANNUAL_COMPARISON.approximateDiscountPercent}% de economia`
                        : "Mais flexibilidade"}
                    </span>
                  </div>
                  <strong className={styles.planName}>{option.label}</strong>
                  <span
                    id={`checkout-plan-price-${option.key}`}
                    className={styles.planPrice}
                  >
                    {formatBRL(option.amountCents)}
                    <small>{option.billingLabel}</small>
                  </span>
                  {option.key === "annual" ? (
                    <>
                      <p className={styles.comparison}>
                        <s>
                          {formatBRL(
                            CONTEST_ANNUAL_COMPARISON.monthlyYearCents,
                          )}
                        </s>{" "}
                        em 12 mensalidades
                      </p>
                      <p className={styles.planBenefit}>
                        Economize{" "}
                        {formatBRL(CONTEST_ANNUAL_COMPARISON.savingsCents)} por
                        concurso em um ano.
                      </p>
                      <small
                        id={`checkout-plan-terms-${option.key}`}
                        className={styles.planFinePrint}
                      >
                        Equivale a{" "}
                        {formatBRL(
                          CONTEST_ANNUAL_COMPARISON.monthlyEquivalentCents,
                        )}
                        /mês. Cobrança anual integral, não parcelada. Renovação
                        anual automática.
                      </small>
                    </>
                  ) : (
                    <>
                      <p className={styles.comparison}>Um mês de cada vez.</p>
                      <p className={styles.planBenefit}>
                        Um compromisso menor para o seu momento de estudo.
                      </p>
                      <small
                        id={`checkout-plan-terms-${option.key}`}
                        className={styles.planFinePrint}
                      >
                        Cobrança e renovação mensal automática. Cancele a
                        próxima renovação na sua conta.
                      </small>
                    </>
                  )}
                  <span className={styles.planSelection}>
                    <Check size={15} aria-hidden="true" />
                    {access === option.key
                      ? "Plano selecionado"
                      : `Escolher ${option.label.toLowerCase()}`}
                  </span>
                </label>
              ))}
            </div>
            <p id="checkout-renewal-note" className={styles.renewalNote}>
              Renovação automática {access === "annual" ? "anual" : "mensal"}.
              Ao cancelar a renovação, você mantém o acesso até o fim do período
              já pago.
            </p>
          </fieldset>
          {related.length > 0 && (
            <fieldset disabled={pending} className={styles.extrasSection}>
              <legend className={styles.sectionTitle}>
                <span>02</span> Amplie seus objetivos <small>Opcional</small>
              </legend>
              <p className={styles.sectionDescription}>
                Outros concursos da mesma carreira. Nada é incluído sem sua
                escolha; os adicionais acompanham a periodicidade acima.
              </p>
              <div className={styles.extrasList}>
                {related.slice(0, 2).map((item) => (
                  <label
                    key={item.slug}
                    className={styles.extra}
                    data-selected={extras.includes(item.slug)}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Adicionar ${contestTitle(item)}`}
                      aria-describedby={`checkout-extra-price-${item.slug} checkout-extra-terms-${item.slug} checkout-renewal-note`}
                      checked={extras.includes(item.slug)}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setExtras((current) =>
                          checked
                            ? [...current, item.slug]
                            : current.filter((slug) => slug !== item.slug),
                        );
                        setError("");
                      }}
                    />
                    <span>
                      <strong>{contestTitle(item)}</strong>
                      <small id={`checkout-extra-terms-${item.slug}`}>
                        Concurso adicional · assinatura{" "}
                        {selectedOption.label.toLowerCase()}
                      </small>
                    </span>
                    <span
                      id={`checkout-extra-price-${item.slug}`}
                      className={styles.extraPrice}
                    >
                      + {formatBRL(selectedOption.amountCents)}
                      <small>{selectedOption.billingLabel}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <section
            className={styles.master}
            aria-labelledby="checkout-master-title"
          >
            <p className={styles.eyebrow}>Uma alternativa, não um adicional</p>
            <h2 id="checkout-master-title">
              Mais de um destino?
              <br />
              Conheça o Master.
            </h2>
            <p>
              Uma assinatura para acessar todos os concursos liberados durante
              sua vigência. Edições em preparação só entram quando forem
              liberadas.
            </p>
            {masterSavings > 0 && (
              <p className={styles.masterComparison}>
                Com sua seleção atual, o {comparableMaster!.name} custa{" "}
                {formatBRL(masterSavings)} a menos{" "}
                {access === "annual" ? "por ano" : "por mês"}. Compare antes de
                decidir.
              </p>
            )}
            <div className={styles.masterPlans}>
              {PLANS.map((plan) => (
                <Link
                  key={plan.slug}
                  href={`/checkout/${plan.slug}`}
                  aria-label={`Comparar ${plan.name} por ${formatBRL(plan.priceCents)}${plan.billingLabel}`}
                >
                  <span>
                    <small>{plan.name}</small>
                    <strong>
                      {formatBRL(plan.priceCents)}
                      <small>{plan.billingLabel}</small>
                    </strong>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              ))}
            </div>
            <small>
              Abre uma contratação separada para você conferir. Seu carrinho de
              concursos não é cobrado nem convertido automaticamente.
            </small>
          </section>
        </div>
        <aside
          className={styles.summary}
          aria-labelledby="checkout-summary-title"
        >
          <div className={styles.summaryHeader}>
            <span className={styles.eyebrow}>Tudo às claras</span>
            <LockKeyhole size={18} aria-hidden="true" />
          </div>
          <h2 id="checkout-summary-title">
            Sua escolha,
            <br />
            <em>sem surpresas.</em>
          </h2>
          <p className={styles.summaryCount}>
            {selectedContests.length}{" "}
            {selectedContests.length === 1
              ? "concurso selecionado"
              : "concursos selecionados"}{" "}
            · plano {selectedOption.label.toLowerCase()}
          </p>
          <ul className={styles.summaryItems}>
            {selectedContests.map((item, index) => (
              <li key={item.slug}>
                <span className={styles.itemIndex}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{contestTitle(item)}</strong>
                  <small>
                    {formatBRL(selectedOption.amountCents)}
                    {selectedOption.billingLabel}
                  </small>
                  {index > 0 && (
                    <button
                      disabled={pending}
                      type="button"
                      onClick={() => removeExtra(item.slug)}
                      aria-label={`Remover ${contestTitle(item)}`}
                      className={styles.removeExtra}
                    >
                      <Minus size={12} aria-hidden="true" /> Remover adicional
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.total} aria-live="polite" aria-atomic="true">
            <span>Total {selectedOption.label.toLowerCase()}</span>
            <strong data-checkout-total>
              {formatBRL(total)}
              <small>{selectedOption.billingLabel}</small>
            </strong>
            <p>
              {access === "annual"
                ? "Cobrança integral a cada ano. Não é parcelamento."
                : "Cobrança a cada mês."}{" "}
              Renovação automática até o cancelamento.
            </p>
            {access === "annual" && (
              <span className={styles.savings}>
                Você economiza {formatBRL(annualSavings)} por ano em relação aos
                mesmos concursos em 12 mensalidades.
              </span>
            )}
          </div>
          <div className={styles.adjustments}>
            {access === "monthly" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => chooseAccess("annual")}
              >
                <ArrowRight size={15} aria-hidden="true" />
                <span>
                  Preferir o anual e economizar {formatBRL(annualSavings)} por
                  ano
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => chooseAccess("monthly")}
              >
                <span>Prefere um compromisso menor? Trocar para mensal.</span>
              </button>
            )}
            {extras.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setExtras([]);
                  setError("");
                }}
              >
                <Minus size={15} aria-hidden="true" />
                <span>Ficar somente com meu concurso principal</span>
              </button>
            )}
          </div>
          {!available && (
            <p className={styles.unavailable}>
              Prévia da oferta. Produto ou pagamentos ainda não liberados.
              Nenhuma cobrança pode ser iniciada aqui.
            </p>
          )}
          <button
            disabled={!available || pending}
            onClick={checkout}
            type="button"
            className={styles.payButton}
          >
            <LockKeyhole size={17} aria-hidden="true" />
            {pending
              ? "Preparando pagamento…"
              : available
                ? "Continuar para pagamento seguro"
                : "Compra ainda não disponível"}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.paymentTrust}>
            <ShieldCheck size={22} aria-hidden="true" />
            <p>
              <strong>Pagamento processado pela Stripe</strong>Na próxima etapa,
              confirme o valor e informe os dados de pagamento no ambiente da
              Stripe. A Editalume não recebe os dados completos do seu cartão.
            </p>
          </div>
          <p className={styles.terms}>
            Leia os <Link href="/termos">termos de uso e cancelamento</Link> e a{" "}
            <Link href="/privacidade">política de privacidade</Link> antes de
            confirmar. Acesso somente aos períodos pagos. Não há promessa de
            aprovação ou cobertura integral do edital.
          </p>
          <Link href="/contato" className={styles.support}>
            Precisa de ajuda antes de assinar?{" "}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </aside>
      </div>
      <section
        className={styles.clarity}
        aria-labelledby="checkout-clarity-title"
      >
        <div>
          <p className={styles.eyebrow}>Antes de continuar</p>
          <h2 id="checkout-clarity-title">
            Comprar com clareza
            <br />
            também faz parte.
          </h2>
        </div>
        <div className={styles.questions}>
          <details>
            <summary>
              Quando começa o acesso?
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <p>
              Depois da confirmação do pagamento pela Stripe. A assinatura
              individual libera os concursos escolhidos, com o conteúdo revisado
              e vinculado a cada edição. Ela não é uma assinatura Master.
            </p>
          </details>
          <details>
            <summary>
              Como funciona a renovação?
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <p>
              O mensal renova a cada mês; o anual, a cada ano. Você pode
              cancelar a próxima renovação na sua conta e manter o período já
              pago. Consulte as condições de cancelamento e reembolso nos{" "}
              <Link href="/termos">termos</Link>.
            </p>
          </details>
          <details>
            <summary>
              Posso escolher só um concurso?
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <p>
              Sim. Os adicionais são opcionais e começam desmarcados. Você
              também pode removê-los no resumo, antes de continuar. Escolher o
              Master abre outra contratação; nada é acrescentado
              automaticamente.
            </p>
          </details>
        </div>
      </section>
      {supplierIdentity && (
        <footer className={styles.supplier}>
          <p className={styles.eyebrow}>Quem está por trás da sua assinatura</p>
          <h2>Identificação e atendimento</h2>
          {supplierIdentity}
        </footer>
      )}
    </div>
  );
}
