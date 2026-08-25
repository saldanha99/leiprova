"use client";

import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useState } from "react";

import {
  PLANS,
  formatBRL,
  getMonthlyEquivalentCents,
  getPlan,
  type PlanSlug,
} from "@/lib/plans";

type PricingPlansProps = {
  commerceOpen: boolean;
};

export function PricingPlans({ commerceOpen }: PricingPlansProps) {
  const [activeSlug, setActiveSlug] = useState<PlanSlug>("foco");
  const activePlan = getPlan(activeSlug) ?? PLANS[0];

  if (!activePlan) return null;

  const isAnnual = activePlan.slug === "foco";
  const monthlyEquivalent = formatBRL(getMonthlyEquivalentCents(activePlan));

  return (
    <>
      <div className="pricing-switch" role="group" aria-label="Período do plano">
        <button
          type="button"
          aria-pressed={isAnnual}
          onClick={() => setActiveSlug("foco")}
        >
          <span>Anual</span>
          <small>Melhor valor</small>
        </button>
        <button
          type="button"
          aria-pressed={!isAnnual}
          onClick={() => setActiveSlug("ritmo")}
        >
          <span>Mensal</span>
        </button>
      </div>

      <div className="pricing-grid pricing-grid--single">
        <article
          className={`pricing-card${activePlan.featured ? " pricing-card--featured" : ""}`}
          aria-live="polite"
        >
          {activePlan.featured && (
            <span className="pricing-card__badge">
              <Sparkles aria-hidden="true" size={14} />
              Plano recomendado
            </span>
          )}

          <div className="pricing-card__heading">
            <span>{activePlan.eyebrow}</span>
            <h3>{activePlan.name}</h3>
          </div>

          {isAnnual ? (
            <div className="pricing-card__annual-price">
              <span>Equivalente a</span>
              <div>
                <small>12x de</small>
                <strong>{monthlyEquivalent}</strong>
              </div>
              <p>{formatBRL(activePlan.priceCents)} cobrados a cada 12 meses.</p>
            </div>
          ) : (
            <>
              <div className="pricing-card__price">
                <strong>{formatBRL(activePlan.priceCents)}</strong>
                <span>{activePlan.billingLabel}</span>
              </div>
              <p className="pricing-card__equivalent">
                Cobrança mensal recorrente.
              </p>
            </>
          )}

          <ul>
            {activePlan.features.map((feature) => (
              <li key={feature}>
                <span>
                  <Check aria-hidden="true" size={15} />
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <Link
            className={`button button--full ${
              activePlan.featured ? "button--amber" : "button--outline"
            }`}
            href={commerceOpen ? `/cadastro?plano=${activePlan.slug}` : "/demo"}
          >
            {commerceOpen
              ? isAnnual
                ? "Quero o plano anual"
                : "Quero o plano mensal"
              : "Testar a demonstração"}
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </article>
      </div>
    </>
  );
}
