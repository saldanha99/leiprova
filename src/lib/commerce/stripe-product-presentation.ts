import type Stripe from "stripe";
import { isAuthorizedProductionOrigin } from "../deployment-origin";
import { catalogContestPath, contestTitle, type CatalogContest } from "./catalog";

const configuredOrigin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
export const STRIPE_CATALOG_ORIGIN = isAuthorizedProductionOrigin(configuredOrigin)
  ? configuredOrigin!
  : "https://leiprova.2b.app.br";
export const STRIPE_CATALOG_STUDY_IMAGE = `${STRIPE_CATALOG_ORIGIN}/assets/contests/editorial-study-v2.webp`;

export type StripeProductPresentation = Required<
  Pick<Stripe.ProductCreateParams, "name" | "description" | "url" | "images">
>;

/** A imagem editorial é compartilhada; não representa uma capa exclusiva nem conteúdo já liberado. */
export function contestStripePresentation(contest: CatalogContest): StripeProductPresentation {
  return {
    name: `Edital Lei Seca · ${contestTitle(contest)} · ${contest.editionLabel}`,
    description: `Assinatura individual para ${contestTitle(contest)} (${contest.editionLabel}). Modalidades mensal e anual. Catálogo em preparação editorial; consulte na página do concurso o conteúdo e a disponibilidade antes de contratar.`,
    url: `${STRIPE_CATALOG_ORIGIN}${catalogContestPath(contest)}`,
    images: [STRIPE_CATALOG_STUDY_IMAGE],
  };
}

export function masterStripePresentation(): StripeProductPresentation {
  return {
    name: "Edital Lei Seca Master · Concursos liberados na plataforma",
    description: "Assinatura Master mensal ou anual, com acesso aos concursos que estiverem liberados na plataforma durante a vigência paga. Catálogo em preparação editorial; consulte a disponibilidade e o escopo antes de contratar.",
    url: `${STRIPE_CATALOG_ORIGIN}/#planos`,
    images: [STRIPE_CATALOG_STUDY_IMAGE],
  };
}
