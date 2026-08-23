import type { Metadata } from "next";

import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
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
    <LegalDocument title="Política de Reembolso" updatedAt="16 de agosto de 2026" notice="Abertura comercial ainda desativada. Esta política será revisada junto à identificação do fornecedor antes do primeiro pagamento.">
      <LegalSection title="Direito de arrependimento"><p>Para contratações online sujeitas às regras de consumo brasileiras, o titular poderá solicitar arrependimento no prazo legal aplicável, contado da contratação, com devolução pelos meios previstos na oferta e na legislação.</p></LegalSection>
      <LegalSection title="Como solicitar"><p>A solicitação será feita pelo canal de suporte autenticado ou pelo formulário de contato, informando o e-mail da conta e o plano. Nunca solicitaremos senha ou dados completos do cartão.</p></LegalSection>
      <LegalSection title="Processamento"><p>Após a validação da titularidade e da elegibilidade, a restituição será iniciada na Stripe. O prazo de visualização depende do método de pagamento e da instituição financeira.</p></LegalSection>
      <LegalSection title="Cancelamento fora do prazo"><p>Assinaturas recorrentes poderão ser canceladas para impedir novas renovações. O acesso e eventual restituição do ciclo vigente seguirão as condições mostradas antes da compra e os direitos legais aplicáveis.</p></LegalSection>
      <LegalSection title="Falhas ou cobrança indevida"><p>Relatos de duplicidade, cobrança não reconhecida ou indisponibilidade relevante serão analisados individualmente, sem limitar direitos previstos em lei.</p></LegalSection>
    </LegalDocument>
  );
}
