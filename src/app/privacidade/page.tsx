import type { Metadata } from "next";
import { connection } from "next/server";

import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
import { PrivacyRequestForm } from "@/components/legal/privacy-request-form";
import { DataProtectionContact, SupplierIdentityBlock } from "@/components/legal/supplier-identity";
import { isPrivacyRequestsEnabled } from "@/lib/launch";
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

export default async function PrivacyPage() {
  await connection();
  const privacyRequestsEnabled = isPrivacyRequestsEnabled();

  return (
    <LegalDocument title="Política de Privacidade" updatedAt="25 de agosto de 2026" notice="Documento da fase beta, pendente de revisão jurídica final. O canal de direitos do titular já pode funcionar de forma independente; qualquer oferta comercial continua condicionada à identificação completa do fornecedor.">
      <LegalSection title="1. Controlador"><p>O controlador dos dados pessoais tratados nesta plataforma, na forma do art. 5º, VI, da Lei 13.709/2018, é:</p><SupplierIdentityBlock /></LegalSection>
      <LegalSection title="2. Dados tratados"><p>Podemos tratar nome, e-mail, credenciais protegidas, dados de sessão, informações técnicas de segurança, plano contratado e identificadores fornecidos pela Stripe. Durante o estudo, registramos respostas, confiança declarada, tempo, revisões, sequência e progresso por conteúdo.</p></LegalSection>
      <LegalSection title="3. Finalidades"><p>Os dados são usados para criar e proteger a conta, fornecer sessões personalizadas, calcular revisões, processar contratos, oferecer suporte, prevenir fraude, medir a qualidade do conteúdo e cumprir obrigações legais.</p><p>Quando o ranking estiver disponível, a interface usará um identificador pseudônimo em vez do nome informado no cadastro.</p></LegalSection>
      <LegalSection title="4. Bases legais e escolhas"><p>O tratamento pode se apoiar na execução do contrato, em obrigações legais, no legítimo interesse acompanhado de avaliação e, quando necessário, no consentimento. Comunicações promocionais terão mecanismo de cancelamento.</p></LegalSection>
      <LegalSection title="5. Compartilhamento e transferência internacional"><p>Usamos fornecedores estritamente necessários, como hospedagem, banco de dados, segurança e a Stripe para pagamentos. Não vendemos dados pessoais. Compartilhamentos adicionais ocorrerão somente com fundamento válido e transparência adequada.</p><p>O processamento de pagamentos pela Stripe implica <strong>transferência internacional</strong> de dados para os Estados Unidos, na forma do capítulo V da Lei 13.709/2018. A transferência se apoia na necessidade para a execução do contrato do qual o titular é parte (art. 33, VI) e está limitada aos dados indispensáveis à cobrança. A infraestrutura da aplicação e o banco de dados permanecem em servidor localizado no Brasil.</p></LegalSection>
      <LegalSection title="6. Segurança"><p>Aplicamos hash resistente para senhas, cookies de sessão protegidos, separação de credenciais, conexões criptografadas, privilégios mínimos no banco e trilhas de auditoria. Nenhum sistema elimina completamente riscos; incidentes relevantes serão tratados conforme a legislação.</p></LegalSection>
      <LegalSection title="7. Retenção e descarte"><p>Os dados permanecem pelo tempo necessário à prestação do serviço, à defesa de direitos e ao cumprimento de obrigações legais. Os prazos aplicados são:</p><ul><li><strong>Conta e histórico de estudo:</strong> enquanto a conta existir; excluída a conta, são eliminados ou anonimizados em até 30 dias, ressalvado o necessário à defesa de direitos.</li><li><strong>Sessões de autenticação:</strong> expiram automaticamente em 30 dias e o banco guarda apenas o hash do token, nunca o token.</li><li><strong>Registros de acesso à aplicação:</strong> 6 meses, prazo do art. 15 da Lei 12.965/2014 (Marco Civil da Internet).</li><li><strong>Registros fiscais e de pagamento:</strong> pelo prazo exigido pela legislação tributária, contado do encerramento do exercício.</li></ul><p>O contador de limite por janela de tempo e as trilhas de auditoria guardam o mínimo necessário à segurança, com IP submetido a hash quando a chave de anonimização está configurada.</p></LegalSection>
      <LegalSection title="8. Direitos do titular"><p>Na forma do art. 18 da Lei 13.709/2018, o titular pode solicitar confirmação da existência de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação sobre compartilhamentos e revogação do consentimento.</p><DataProtectionContact />{privacyRequestsEnabled ? <PrivacyRequestForm /> : <p className="rounded-xl border border-amber-300/15 bg-amber-300/6 px-4 py-3 text-sm text-amber-100/80">O formulário protegido de privacidade será disponibilizado assim que o canal operacional estiver ativo.</p>}</LegalSection>
      <LegalSection title="9. Menores"><p>O produto é direcionado prioritariamente a maiores de 18 anos. Eventual uso por menores exigirá controles compatíveis com a legislação, o melhor interesse e as regras específicas de consentimento antes de ser habilitado.</p></LegalSection>
      <LegalSection title="10. Cookies"><p>Usamos cookie essencial e protegido para manter a sessão. Métricas não essenciais ou publicidade comportamental não serão ativadas sem a transparência e o mecanismo de escolha aplicáveis.</p></LegalSection>
    </LegalDocument>
  );
}
