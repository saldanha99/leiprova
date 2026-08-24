import type { Metadata } from "next";

import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
import { SupplierIdentityBlock } from "@/components/legal/supplier-identity";
import { WITHDRAWAL_PERIOD_DAYS } from "@/lib/legal";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_PATH } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Política de Reembolso",
  description: "Condições previstas para arrependimento, cancelamento e reembolso na LeiProva.",
  alternates: { canonical: "/reembolso" },
  openGraph: {
    url: "/reembolso",
    title: "Política de Reembolso | LeiProva",
    description: "Condições previstas para arrependimento, cancelamento e reembolso na LeiProva.",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Política de Reembolso | LeiProva",
    description: "Condições previstas para arrependimento, cancelamento e reembolso na LeiProva.",
    images: [SOCIAL_IMAGE_PATH],
  },
};

export default function RefundPage() {
  return (
    <LegalDocument title="Política de Reembolso" updatedAt="16 de agosto de 2026" notice="Documento da fase beta, pendente de revisão jurídica final. Não há oferta comercial ativa: o checkout permanece bloqueado enquanto a identificação do fornecedor não estiver completa.">
      <LegalSection title="Direito de arrependimento"><p>O consumidor pode desistir da contratação no prazo de {WITHDRAWAL_PERIOD_DAYS} (sete) dias corridos, contados da contratação ou do recebimento do acesso, o que ocorrer por último. É o art. 49 do Código de Defesa do Consumidor, aplicável por se tratar de contratação fora do estabelecimento comercial.</p><p>Não é preciso justificar o pedido, e o uso da plataforma durante o prazo não afasta o direito. Os valores pagos são devolvidos de imediato e monetariamente atualizados, na forma do parágrafo único do art. 49.</p></LegalSection>
      <LegalSection title="Como solicitar"><p>A solicitação pode ser feita pelo canal de suporte autenticado, pelo formulário de contato ou pelo e-mail de atendimento, informando o e-mail da conta e o plano. Confirmamos o recebimento imediatamente, conforme o art. 5º do Decreto 7.962/2013.</p><p>Nunca solicitaremos senha, código de segurança nem os dados completos do cartão.</p><SupplierIdentityBlock /></LegalSection>
      <LegalSection title="Processamento"><p>Após a validação da titularidade e da elegibilidade, a restituição será iniciada na Stripe. O prazo de visualização depende do método de pagamento e da instituição financeira.</p></LegalSection>
      <LegalSection title="Cancelamento fora do prazo"><p>Passados os {WITHDRAWAL_PERIOD_DAYS} dias, as assinaturas recorrentes podem ser canceladas a qualquer momento para impedir novas renovações, pelo portal de assinatura na área do aluno, sem necessidade de contato com o suporte. O acesso permanece até o fim do ciclo já pago.</p><p>O cancelamento fora do prazo de arrependimento não gera, por si só, devolução do ciclo em curso. Isso não afasta os direitos previstos em lei em caso de vício, falha na prestação ou cobrança indevida.</p></LegalSection>
      <LegalSection title="Falhas ou cobrança indevida"><p>Relatos de duplicidade, cobrança não reconhecida ou indisponibilidade relevante serão analisados individualmente, sem limitar direitos previstos em lei.</p></LegalSection>
    </LegalDocument>
  );
}
