import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { contestPlanCta } from "@/lib/opportunities/landing-presentation";
import { PLANS, formatBRL, getMonthlyEquivalentCents } from "@/lib/plans";
import {
  CONTEST_ACCESS_OPTIONS,
  CONTEST_ANNUAL_COMPARISON,
} from "@/lib/commerce/catalog";

import styles from "./contest-landing.module.css";
import offer from "./contest-subscription-pricing.module.css";

export function ContestPricing({
  commerceOpen,
  contactOpen,
  contestName = "este concurso",
  productSlug,
  productAvailable = false,
}: {
  commerceOpen: boolean;
  contactOpen: boolean;
  contestName?: string;
  productSlug?: string;
  productAvailable?: boolean;
}) {
  return (
    <section
      id="planos"
      className={`${styles.section} ${styles.pricingSection}`}
      aria-labelledby="planos-title"
    >
      <div className={styles.container}>
        <div className={styles.sectionHeading}>
          <span className={styles.eyebrow}>
            UM CONCURSO OU TODOS OS SEUS OBJETIVOS
          </span>
          <h2 id="planos-title">
            Um objetivo. Um acesso.
            <br />
            <em>O próximo passo é seu.</em>
          </h2>
          <p>
            Escolha a assinatura de {contestName} ou o Master para explorar os
            concursos liberados da plataforma durante a assinatura. Cada edição
            é um produto independente.
          </p>
        </div>
        {!commerceOpen && (
          <p className={styles.commerceNotice}>
            <LockKeyhole size={16} aria-hidden="true" /> Contratações ainda não
            abertas. Nenhuma cobrança é realizada nesta página.
          </p>
        )}
        <div className={styles.priceGrid}>
          {CONTEST_ACCESS_OPTIONS.map((option) => (
            <article
              key={option.key}
              className={`${offer.card} ${option.key === "annual" ? offer.annual : ""}`}
              data-contest-plan={option.key}
            >
              <div className={offer.top}>
                <span className={offer.eyebrow}>ASSINATURA · UM CONCURSO</span>
                <span className={offer.badge}>
                  {option.key === "annual"
                    ? `≈${CONTEST_ANNUAL_COMPARISON.approximateDiscountPercent}% de economia`
                    : "Flexibilidade mensal"}
                </span>
              </div>
              <h3>{option.label}</h3>
              <p className={offer.intro}>
                {option.key === "annual"
                  ? "Um ano para construir sua rotina, com o melhor custo."
                  : "Um mês de cada vez, no ritmo do seu próximo objetivo."}
              </p>
              <p className={offer.price}>
                <strong>{formatBRL(option.amountCents)}</strong>
                <span>{option.billingLabel}</span>
              </p>
              <div className={offer.comparison}>
                {option.key === "annual" ? (
                  <>
                    <span>
                      12 mensalidades:{" "}
                      <s>
                        {formatBRL(CONTEST_ANNUAL_COMPARISON.monthlyYearCents)}
                      </s>
                    </span>
                    <strong>
                      Economize{" "}
                      {formatBRL(CONTEST_ANNUAL_COMPARISON.savingsCents)} por
                      ano
                    </strong>
                    <small>
                      Equivale a{" "}
                      {formatBRL(
                        CONTEST_ANNUAL_COMPARISON.monthlyEquivalentCents,
                      )}
                      /mês. Não é parcelamento.
                    </small>
                  </>
                ) : (
                  <>
                    <strong>Renovação a cada mês</strong>
                    <span>
                      12 mensalidades totalizam{" "}
                      {formatBRL(CONTEST_ANNUAL_COMPARISON.monthlyYearCents)}.
                    </span>
                    <small>
                      Prefere planejar o ano? Compare a economia ao lado.
                    </small>
                  </>
                )}
              </div>
              <p className={offer.billing}>
                {option.key === "annual"
                  ? `${formatBRL(option.amountCents)} cobrados de uma vez por ano, com renovação anual automática.`
                  : `${formatBRL(option.amountCents)} cobrados a cada mês, com renovação mensal automática.`}{" "}
                Cancele a renovação na sua conta. Acesso até o fim do período
                pago.
              </p>
              <ul className={offer.features}>
                {[
                  `Acesso exclusivo a ${contestName}`,
                  "Questões autorais liberadas desta edição",
                  "Explicações e revisão do conteúdo incluído",
                  "Progresso do seu treino",
                  "Acesso pelo navegador no celular, tablet e computador",
                ].map((feature) => (
                  <li key={feature}>
                    <Check size={17} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                className={offer.action}
                href={
                  commerceOpen && productAvailable && productSlug
                    ? `/checkout/concurso/${productSlug}?acesso=${option.key}`
                    : contactOpen
                      ? "/contato"
                      : "#por-dentro"
                }
              >
                {commerceOpen && productAvailable
                  ? `Escolher plano ${option.label.toLowerCase()}`
                  : contactOpen
                    ? "Consultar a abertura"
                    : "Conhecer a experiência"}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              {!productAvailable && (
                <p className={offer.availability}>
                  Oferta em preparação editorial · vendas ainda não abertas
                </p>
              )}
            </article>
          ))}
        </div>
        <div className={`${styles.sectionHeading} mt-12`}>
          <span className={styles.eyebrow}>
            MASTER · AMPLIE SUAS POSSIBILIDADES
          </span>
          <h2>
            Seu horizonte vai além?
            <br />
            <em>Conheça o Master.</em>
          </h2>
          <p>
            Uma assinatura para os concursos efetivamente liberados durante a
            vigência. Novas edições entram após liberação editorial, sem compra
            avulsa adicional. Não inclui cursos ainda em preparação.
          </p>
        </div>
        <div className={styles.priceGrid}>
          {PLANS.map((plan) => {
            const cta = contestPlanCta(plan, commerceOpen, contactOpen);
            return (
              <article
                key={plan.slug}
                className={`${styles.priceCard} ${plan.featured ? styles.priceFeatured : ""}`}
              >
                <div className={styles.priceTop}>
                  <span>
                    {plan.billingMonths === 12
                      ? "PARA O CICLO DE ESTUDOS"
                      : "PARA UM MÊS DE CADA VEZ"}
                  </span>
                  {plan.featured && (
                    <span className={styles.priceBadge}>
                      Menor custo mensal
                    </span>
                  )}
                </div>
                <h3>{plan.name}</h3>
                <p className={styles.priceEyebrow}>{plan.eyebrow}</p>
                <p className={styles.priceAmount}>
                  <strong>{formatBRL(plan.priceCents)}</strong>
                  <span>{plan.billingLabel}</span>
                </p>
                <p className={styles.priceBilling}>
                  {plan.billingMonths === 12
                    ? `Equivalente a ${formatBRL(getMonthlyEquivalentCents(plan))}/mês. Cobrança única por ciclo de 12 meses; não é parcelamento.`
                    : "Cobrança recorrente a cada mês, quando a contratação estiver disponível."}
                </p>
                <div className={styles.priceDivider} />
                <p className={styles.priceIncludes}>
                  {commerceOpen
                    ? "Recursos do plano"
                    : "Recursos previstos no plano"}
                </p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={17} aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={cta.href}
                  className={`${styles.button} ${plan.featured ? styles.buttonPrimary : styles.buttonSecondary}`}
                >
                  {cta.label}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
        <p className={styles.pricingFootnote}>
          O acesso depende do catálogo e dos conteúdos liberados após revisão
          editorial. Não inclui promessa de cobertura integral do edital ou de
          aprovação. Consulte os <Link href="/termos">termos de uso</Link>.
        </p>
      </div>
    </section>
  );
}
