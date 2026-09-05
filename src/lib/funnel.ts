/**
 * Política de CTA do funil público.
 *
 * O modelo é o mesmo das plataformas de lei seca já consolidadas: a home vende,
 * o CTA primário leva a plano → checkout e a única outra porta é a área do
 * aluno. A demonstração não é porta de entrada — enquanto o portão editorial
 * estiver fechado ela não serve questão nenhuma, e um botão "testar agora"
 * apontando para lá promete o que a página não entrega.
 *
 * Módulo puro de propósito: recebe o estado das feature flags por parâmetro
 * para poder ser usado tanto no servidor quanto em componentes client.
 */

export type Cta = {
  readonly href: string;
  readonly label: string;
};

/** Âncora da seção de planos, usada dentro da própria home. */
export const PLANS_ANCHOR = "#planos";
/** Mesma seção, a partir de qualquer outra rota. */
export const PLANS_HREF = "/#planos";
/** Página que mostra a mecânica do treino. Nunca é o CTA primário. */
export const HOW_IT_WORKS_HREF = "/demo";
/** Área do aluno. */
export const LOGIN_HREF = "/entrar";

/** Destino do CTA primário: cadastro quando o comércio está aberto, planos quando não. */
export function primaryCtaHref(commerceOpen: boolean, fromHome = false) {
  if (commerceOpen) return "/cadastro?plano=foco";
  return fromHome ? PLANS_ANCHOR : PLANS_HREF;
}

/** CTA primário completo, com o rótulo de cada superfície. */
export function primaryCta(
  commerceOpen: boolean,
  openLabel: string,
  options: { fromHome?: boolean; closedLabel?: string } = {},
): Cta {
  return {
    href: primaryCtaHref(commerceOpen, options.fromHome ?? false),
    label: commerceOpen ? openLabel : (options.closedLabel ?? "Ver planos e preço"),
  };
}

/** CTA secundário: entender a mecânica, sem prometer questão. */
export const howItWorksCta: Cta = {
  href: HOW_IT_WORKS_HREF,
  label: "Ver como funciona",
};

/**
 * CTA do card de plano. Com o checkout fechado o caminho honesto é o canal de
 * contato; sem canal de contato aberto não há botão nenhum, só o aviso.
 */
export function planCardCta(commerceOpen: boolean, contactOpen: boolean): Cta | null {
  if (commerceOpen) return null;
  if (!contactOpen) return null;
  return { href: "/contato", label: "Avise-me na abertura" };
}
