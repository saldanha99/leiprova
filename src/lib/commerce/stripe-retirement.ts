import { createStripeRetirementOperator } from "./stripe-retirement-core";

// Autorização fixa do snapshot privado de 06/09/2026. Não expor os IDs/nomes do catálogo no Git.
export const AUTHORIZED_STRIPE_UI_SHA256 = "5ac3cdb91f133f9a96741b9fc0a4cafd9878f207636e0cbdecacb171ab910a77";
const operator = createStripeRetirementOperator(AUTHORIZED_STRIPE_UI_SHA256);

// Nenhum argumento, variável de ambiente ou opção CLI pode substituir esse hash.
export const verifyAuthorizedUiBytes = operator.verifyAuthorizedUiBytes;
export const buildStripeRetirementPlan = operator.buildStripeRetirementPlan;
export const retireStripeCatalog = operator.retireStripeCatalog;
export type { StripeRetirementClient, StripeRetirementPlan, RetirementEvent } from "./stripe-retirement-core";
