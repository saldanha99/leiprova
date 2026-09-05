import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  ExternalLink,
  MapPin,
  ShieldCheck,
  Target,
} from "lucide-react";
import Link from "next/link";

import type { PublicContestOpportunity } from "@/lib/db/contest-opportunities";
import { getCareerDirection } from "@/lib/opportunities/landing-presentation";
import {
  formatOpportunityDate,
  getOpportunityLifecycleLabel,
  getResponsibleTypeLabel,
} from "@/lib/opportunities/presentation";

import { ContestPricing } from "./contest-pricing";
import {
  CourseHero,
  CourseMethod,
  CourseNavigation,
  CoursePrinciples,
  CourseTourSection,
} from "./course-experience";
import premium from "./course-experience.module.css";
import styles from "./contest-landing.module.css";

type ContestLandingProps = {
  opportunity: PublicContestOpportunity;
  jurisdictionName: string;
  commerceOpen: boolean;
  contactOpen: boolean;
  productSlug?: string;
  productAvailable?: boolean;
};

export function ContestLanding({
  opportunity,
  jurisdictionName,
  commerceOpen,
  contactOpen,
  productSlug,
  productAvailable = false,
}: ContestLandingProps) {
  const direction = getCareerDirection(opportunity.categorySlug);
  const status = getOpportunityLifecycleLabel(opportunity.lifecycleStatus);
  const registrationStart = formatOpportunityDate(
    opportunity.registrationStartsAt,
  );
  const registrationEnd = formatOpportunityDate(opportunity.registrationEndsAt);
  const registration = registrationStart
    ? `${registrationStart}${registrationEnd ? ` a ${registrationEnd}` : " · término ainda não informado"}`
    : registrationEnd
      ? `Até ${registrationEnd} · início ainda não informado`
      : "Ainda não informadas";
  const faqs = [
    {
      question: "O plano deste concurso já está pronto?",
      answer: productAvailable
        ? "Há conteúdo próprio liberado para esta edição. O acesso inclui o recorte efetivamente disponível, sem promessa de cobertura integral do edital. Confira o período e as condições da oferta antes de comprar."
        : "Ainda não. O plano específico desta edição está em preparação editorial. Esta página reúne as informações oficiais revisadas e apresenta a experiência da plataforma. A liberação depende da validação do programa, das fontes e das questões; não há promessa de cobertura integral do edital.",
    },
    {
      question: "A assinatura é exclusiva para este concurso?",
      answer:
        "A assinatura individual é exclusiva para esta edição, com cobrança mensal de R$ 67 ou anual de R$ 347. O Master é uma assinatura separada para todos os concursos efetivamente liberados durante a vigência. Nenhum plano transforma uma edição em preparação em curso pronto.",
    },
    {
      question: "Consigo estudar pelo celular ou tablet?",
      answer:
        "A plataforma é acessada pelo navegador, com interfaces adaptadas a computador, celular e tablet. É necessária conexão com a internet. O tour desta página permite alternar a apresentação entre computador e celular; não é um aplicativo nativo ou uma demonstração de acesso offline.",
    },
    {
      question: "Como as questões e a banca são tratadas?",
      answer: opportunity.responsibleName
        ? `O responsável registrado para esta edição é ${opportunity.responsibleName}. As questões de treino são autorais e precisam de revisão editorial. A indicação de um perfil de banca não significa parceria, endosso ou reprodução de questões oficiais.`
        : "O responsável desta edição ainda não está confirmado no nosso registro oficial revisado. Não atribuímos uma banca por suposição nem usamos a banca de outra edição. As questões de treino são autorais, com revisão editorial, e não representam conteúdo oficial da organizadora.",
    },
    {
      question: "É só ler a lei ou também praticar?",
      answer:
        "A proposta combina leitura do dispositivo, prática de literalidade, explicação da resposta e revisão. O progresso ajuda a identificar pontos de atenção. Lei seca é parte da preparação: não substitui outras disciplinas, doutrina, jurisprudência ou etapas exigidas pelo edital.",
    },
    {
      question: "Os valores incluem parcelamento ou teste gratuito?",
      answer:
        "Não há promessa de parcelamento ou período gratuito. O valor mensal equivalente do Anual serve apenas para comparação: R$ 347 são cobrados de uma vez por ano. Os planos individuais têm renovação automática mensal ou anual. Cancele a renovação na sua conta e mantenha o acesso até o fim do período pago. O Master tem preços próprios.",
    },
    {
      question: "Onde confiro as informações atualizadas do concurso?",
      answer:
        "Use o link da publicação oficial no panorama desta página e confira a data da última verificação. O catálogo mostra uma situação revisada em determinada data; retificações e publicações do órgão sempre prevalecem sobre o resumo.",
    },
  ];

  return (
    <article
      className={`${styles.landing} ${premium.page}`}
      data-theme={direction.theme}
    >
      <CourseHero
        acronym={`${opportunity.institutionAcronym} ${opportunity.cycleYear}`}
        role={opportunity.roleName}
        category={opportunity.categoryName}
        categorySlug={opportunity.categorySlug}
        location={jurisdictionName}
        edition={status}
        available={productAvailable}
      />
      <CourseNavigation />
      <CourseMethod />
      <CourseTourSection />
      <CoursePrinciples />

      <section
        id="edicao"
        className={`${styles.section} ${styles.editionSection}`}
        aria-labelledby="edicao-title"
      >
        <div className={styles.container}>
          <div className={styles.splitHeading}>
            <div>
              <span className={styles.eyebrow}>
                O SEU OBJETIVO, COM CONTEXTO
              </span>
              <h2 id="edicao-title">Conheça esta edição.</h2>
            </div>
            <p>
              Informação oficial de um lado. Preparação editorial do outro. Cada
              etapa tem seu lugar.
            </p>
          </div>
          <div className={styles.editionGrid}>
            <div className={styles.editionMain}>
              <div className={styles.editionStatus}>
                <span>{status}</span>
                <span>
                  Situação em {formatOpportunityDate(opportunity.statusAsOf)}
                </span>
              </div>
              <h3>{opportunity.title}</h3>
              <p className={styles.editionSummary}>{opportunity.summary}</p>
              <dl className={styles.facts}>
                {[
                  {
                    label: "Órgão",
                    value: opportunity.institutionName,
                    Icon: ShieldCheck,
                  },
                  {
                    label: "Cargo / objetivo",
                    value: opportunity.roleName,
                    Icon: Target,
                  },
                  {
                    label: "Localidade",
                    value: jurisdictionName,
                    Icon: MapPin,
                  },
                  {
                    label: "Inscrições",
                    value: registration,
                    Icon: ClipboardList,
                  },
                  {
                    label: "Data da prova",
                    value:
                      formatOpportunityDate(opportunity.examDate) ??
                      "Ainda não informada",
                    Icon: CalendarDays,
                  },
                ].map(({ label, value, Icon }) => (
                  <div key={label}>
                    <Icon size={17} aria-hidden="true" />
                    <div>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>
              {opportunity.officialUrl && (
                <a
                  href={opportunity.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.sourceLink}
                >
                  Conferir publicação oficial
                  <ExternalLink size={16} aria-hidden="true" />
                  <span className="sr-only"> (abre em outra aba)</span>
                </a>
              )}
              <p className={styles.sourceDate}>
                Fonte conferida em{" "}
                {formatOpportunityDate(opportunity.sourceCheckedAt) ??
                  "data não informada"}
                . A publicação oficial e suas retificações prevalecem sobre este
                resumo.
              </p>
            </div>
            <aside
              className={styles.editionAside}
              aria-label="Banca e disponibilidade do plano"
            >
              <ShieldCheck size={28} aria-hidden="true" />
              <span className={styles.eyebrow}>RESPONSÁVEL DA EDIÇÃO</span>
              <h3>{opportunity.responsibleName ?? "Aguardando confirmação"}</h3>
              <p>
                {opportunity.responsibleName
                  ? getResponsibleTypeLabel(opportunity.responsibleType)
                  : "Ainda não há responsável confirmado no nosso registro oficial revisado. Nenhum perfil de banca é atribuído por suposição."}
              </p>
              {opportunity.examinationProviderName &&
                opportunity.examinationProviderName !==
                  opportunity.responsibleName && (
                  <p>
                    Elaboração da prova:{" "}
                    <strong>{opportunity.examinationProviderName}</strong>.
                  </p>
                )}
              {opportunity.bankName && (
                <p>
                  Perfil de estudo vinculado:{" "}
                  <strong>{opportunity.bankName}</strong>. Sem vínculo ou
                  endosso da organizadora.
                </p>
              )}
              <div className={styles.editorialStatus}>
                <span>PLANO DESTA EDIÇÃO</span>
                <strong>
                  {productAvailable
                    ? "Conteúdo liberado"
                    : "Em preparação editorial"}
                </strong>
                <p>
                  {productAvailable
                    ? "O acesso cobre o conteúdo efetivamente liberado desta edição, sem promessa de cobertura integral."
                    : "O catálogo do concurso não representa um curso completo liberado. O programa e as questões precisam concluir a validação."}
                </p>
                <a href="#duvidas">
                  Entender a disponibilidade
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <ContestPricing
        commerceOpen={commerceOpen}
        contactOpen={contactOpen}
        contestName={opportunity.title}
        productSlug={productSlug}
        productAvailable={productAvailable}
      />

      <section
        id="duvidas"
        className={styles.section}
        aria-labelledby="faq-title"
      >
        <div className={`${styles.container} ${styles.faqGrid}`}>
          <div className={styles.faqIntro}>
            <span className={styles.eyebrow}>DECIDA COM CLAREZA</span>
            <h2 id="faq-title">
              Antes de <br />
              <em>começar.</em>
            </h2>
            <p>O que você precisa saber sobre acesso, conteúdo e preparação.</p>
            {contactOpen && (
              <Link href="/contato" className={styles.textButton}>
                Falar com a equipe
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            )}
          </div>
          <div className={styles.faqList}>
            {faqs.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.finalSection} aria-labelledby="final-title">
        <div className={`${styles.container} ${styles.finalCard}`}>
          <div>
            <span className={styles.eyebrow}>
              SEU OBJETIVO MERECE CONSTÂNCIA
            </span>
            <h2 id="final-title">
              O próximo capítulo
              <br />
              começa com <em>você.</em>
            </h2>
            <p>
              Conheça a plataforma, entenda a disponibilidade do seu concurso e
              escolha o seu próximo passo com clareza.
            </p>
          </div>
          <div className={styles.finalActions}>
            <a
              href="#planos"
              className={`${styles.button} ${styles.buttonPrimary}`}
            >
              Ver planos e preços
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <Link href="/concursos" className={styles.textButton}>
              Explorar outros concursos
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <span>
              <CircleCheck size={15} aria-hidden="true" />
              {commerceOpen
                ? "Confira as condições antes de contratar"
                : "Sem cobrança nesta etapa"}
            </span>
          </div>
        </div>
      </section>
      <div className={styles.mobileDock}>
        <span>
          <strong>
            {`${opportunity.institutionAcronym} ${opportunity.cycleYear}`}
          </strong>
          <small>Conheça a plataforma</small>
        </span>
        <a
          href="#planos"
          className={`${styles.button} ${styles.buttonPrimary}`}
        >
          Ver planos
          <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
