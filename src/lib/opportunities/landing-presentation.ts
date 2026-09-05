import type { Cta } from "@/lib/funnel";
import type { PlanDefinition } from "@/lib/plans";

const CAREER_DIRECTIONS: Record<string, { theme: string; focus: string }> = {
  "carreiras-policiais": {
    theme: "emerald",
    focus: "Uma rotina de lei seca para quem escolheu a carreira policial.",
  },
  "carreiras-juridicas": {
    theme: "gold",
    focus: "Precisão na leitura para construir sua trajetória jurídica.",
  },
  cartorios: {
    theme: "gold",
    focus:
      "Atenção aos dispositivos que fazem parte da sua preparação notarial e registral.",
  },
  tribunais: {
    theme: "blue",
    focus:
      "Mais organização para a sua preparação nas carreiras dos tribunais.",
  },
  procuradorias: {
    theme: "emerald",
    focus: "Leitura e revisão para a sua jornada na advocacia pública.",
  },
  "fiscal-e-controle": {
    theme: "blue",
    focus: "Consistência no estudo da legislação para fiscal e controle.",
  },
  "area-legislativa": {
    theme: "gold",
    focus: "A lei como ponto de partida para a sua carreira legislativa.",
  },
  trabalhistas: {
    theme: "blue",
    focus: "Uma rotina de estudo para sua trajetória na área trabalhista.",
  },
};

export function getCareerDirection(categorySlug: string) {
  return (
    CAREER_DIRECTIONS[categorySlug] ?? {
      theme: "emerald",
      focus: "Leitura, prática e revisão para dar ritmo à sua preparação.",
    }
  );
}

/** A assinatura geral não equivale à liberação do curso de uma edição. */
export function contestPlanCta(
  plan: PlanDefinition,
  commerceOpen: boolean,
  contactOpen: boolean,
): Cta {
  if (commerceOpen)
    return {
      href: `/cadastro?plano=${plan.slug}`,
      label: "Escolher assinatura da plataforma",
    };
  if (contactOpen) return { href: "/contato", label: "Consultar a abertura" };
  return { href: "#por-dentro", label: "Conhecer a plataforma" };
}
