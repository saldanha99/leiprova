import type { Metadata } from "next";

import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
import { SOCIAL_IMAGE, SOCIAL_IMAGE_PATH } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Dados tratados, finalidades, segurança e direitos dos titulares na LeiProva.",
  alternates: { canonical: "/privacidade" },
  openGraph: {
    url: "/privacidade",
    title: "Política de Privacidade | LeiProva",
    description: "Dados tratados, finalidades, segurança e direitos dos titulares na LeiProva.",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Política de Privacidade | LeiProva",
    description: "Dados tratados, finalidades, segurança e direitos dos titulares na LeiProva.",
    images: [SOCIAL_IMAGE_PATH],
  },
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Política de Privacidade" updatedAt="16 de agosto de 2026" notice="Minuta da fase beta. A identidade e o canal formal do controlador serão completados antes da abertura comercial.">
      <LegalSection title="1. Dados tratados"><p>Podemos tratar nome, e-mail, credenciais protegidas, dados de sessão, informações técnicas de segurança, plano contratado e identificadores fornecidos pela Stripe. Durante o estudo, registramos respostas, confiança declarada, tempo, revisões, sequência e progresso por conteúdo.</p></LegalSection>
      <LegalSection title="2. Finalidades"><p>Os dados são usados para criar e proteger a conta, fornecer sessões personalizadas, calcular revisões, processar contratos, oferecer suporte, prevenir fraude, medir a qualidade do conteúdo e cumprir obrigações legais.</p><p>Quando o ranking estiver disponível, a interface usará um identificador pseudônimo em vez do nome informado no cadastro.</p></LegalSection>
      <LegalSection title="3. Bases e escolhas"><p>O tratamento pode se apoiar na execução do contrato, em obrigações legais, no legítimo interesse acompanhado de avaliação e, quando necessário, no consentimento. Comunicações promocionais terão mecanismo de cancelamento.</p></LegalSection>
      <LegalSection title="4. Compartilhamento"><p>Usamos fornecedores estritamente necessários, como hospedagem, banco de dados, segurança e a Stripe para pagamentos. Não vendemos dados pessoais. Compartilhamentos adicionais ocorrerão somente com fundamento válido e transparência adequada.</p></LegalSection>
      <LegalSection title="5. Segurança"><p>Aplicamos hash resistente para senhas, cookies de sessão protegidos, separação de credenciais, conexões criptografadas, privilégios mínimos no banco e trilhas de auditoria. Nenhum sistema elimina completamente riscos; incidentes relevantes serão tratados conforme a legislação.</p></LegalSection>
      <LegalSection title="6. Retenção"><p>Os dados permanecem pelo tempo necessário à prestação do serviço, defesa de direitos e cumprimento de obrigações. Sessões expiram automaticamente. Prazos detalhados de retenção e descarte serão publicados antes da abertura comercial.</p></LegalSection>
      <LegalSection title="7. Direitos do titular"><p>O titular pode solicitar confirmação, acesso, correção, portabilidade quando aplicável, anonimização, bloqueio, eliminação, informação sobre compartilhamentos e revisão das escolhas de consentimento. O canal formal será informado nesta página antes do lançamento.</p></LegalSection>
      <LegalSection title="8. Menores"><p>O produto é direcionado prioritariamente a maiores de 18 anos. Eventual uso por menores exigirá controles compatíveis com a legislação, o melhor interesse e as regras específicas de consentimento antes de ser habilitado.</p></LegalSection>
      <LegalSection title="9. Cookies"><p>Usamos cookie essencial e protegido para manter a sessão. Métricas não essenciais ou publicidade comportamental não serão ativadas sem a transparência e o mecanismo de escolha aplicáveis.</p></LegalSection>
    </LegalDocument>
  );
}
