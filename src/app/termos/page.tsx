import type { Metadata } from "next";

import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_PATH } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos de uso da plataforma educacional LeiProva durante a fase beta.",
  alternates: { canonical: "/termos" },
  openGraph: {
    url: "/termos",
    title: "Termos de Uso | LeiProva",
    description: "Termos de uso da plataforma educacional LeiProva durante a fase beta.",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Termos de Uso | LeiProva",
    description: "Termos de uso da plataforma educacional LeiProva durante a fase beta.",
    images: [SOCIAL_IMAGE_PATH],
  },
};

export default function TermsPage() {
  return (
    <LegalDocument title="Termos de Uso" updatedAt="16 de agosto de 2026" notice="Minuta operacional da fase beta. O checkout comercial permanece desativado até a inclusão da identificação completa do fornecedor e a revisão jurídica final.">
      <LegalSection title="1. Objeto e aceitação"><p>A LeiProva é uma ferramenta educacional para treino de literalidade de normas, revisão espaçada e acompanhamento de desempenho voltada à preparação para concursos públicos. Ao criar uma conta, o usuário concorda com estes termos e com a Política de Privacidade.</p><p>O serviço não presta consultoria jurídica e não substitui a consulta às fontes oficiais, aos editais nem a orientação de profissionais qualificados.</p></LegalSection>
      <LegalSection title="2. Conteúdo e fontes"><p>Os textos de normas são vinculados a fontes oficiais e recebem data de verificação. Questões, explicações, mapas e arranjos editoriais são produzidos pela LeiProva ou usados sob licença. A plataforma não afirma afiliação com bancas examinadoras.</p><p>Alterações legislativas podem exigir revisão e suspensão temporária de itens. A data e a versão exibidas devem sempre ser consideradas pelo usuário.</p></LegalSection>
      <LegalSection title="3. Conta e segurança"><p>O usuário deve fornecer dados verdadeiros, manter sua senha em sigilo e comunicar uso não autorizado. A conta é pessoal e não pode ser revendida, compartilhada em massa ou usada para extração automatizada do acervo.</p></LegalSection>
      <LegalSection title="4. Planos e cobrança"><p>Antes da contratação serão informados preço total, periodicidade, forma de renovação, recursos incluídos e regras de cancelamento. Assinaturas recorrentes permanecem ativas até o cancelamento, respeitado o período já contratado e as condições apresentadas no checkout.</p><p>Pagamentos são processados pela Stripe. A LeiProva não recebe nem armazena os dados completos do cartão.</p></LegalSection>
      <LegalSection title="5. Arrependimento e reembolso"><p>Nas contratações online destinadas a consumidores, o pedido de arrependimento pode ser exercido no prazo legal aplicável, contado da contratação, sem prejuízo de outros direitos previstos em lei. Os canais e o procedimento serão apresentados no checkout e na área da assinatura.</p></LegalSection>
      <LegalSection title="6. Uso permitido"><p>É permitido usar o serviço para estudo individual. É vedado copiar ou comercializar a organização editorial, contornar controles de acesso, realizar scraping, testar vulnerabilidades sem autorização, interferir no serviço ou usar marcas da LeiProva de forma que sugira parceria.</p></LegalSection>
      <LegalSection title="7. Disponibilidade e alterações"><p>Podemos realizar manutenção, corrigir erros e evoluir recursos. Mudanças materiais nos planos contratados ou nestes termos serão informadas de modo claro e com antecedência razoável quando aplicável.</p></LegalSection>
      <LegalSection title="8. Responsabilidade"><p>A preparação e o resultado em concursos dependem de múltiplos fatores. A LeiProva não promete aprovação, posição, nota mínima nem ausência absoluta de erro. Relatos de inconsistência serão avaliados e itens sob dúvida poderão ser suspensos.</p></LegalSection>
      <LegalSection title="9. Identificação e contato"><p>A identificação completa do fornecedor, endereço e canal de atendimento serão inseridos neste documento antes da abertura do checkout comercial. Durante a fase beta, não há oferta comercial ativa.</p></LegalSection>
    </LegalDocument>
  );
}
