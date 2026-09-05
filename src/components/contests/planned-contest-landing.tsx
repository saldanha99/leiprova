import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { type CatalogContest, contestTitle } from "@/lib/commerce/catalog";
import { contestCategories } from "@/lib/opportunities/categories";
import { getOpportunityJurisdictionByCode } from "@/lib/opportunities/jurisdictions";
import { getCareerDirection } from "@/lib/opportunities/landing-presentation";
import { ContestPricing } from "./contest-pricing";
import {
  CourseHero,
  CourseMethod,
  CourseNavigation,
  CoursePrinciples,
  CourseTourSection,
} from "./course-experience";
import base from "./contest-landing.module.css";
import styles from "./course-experience.module.css";

export function PlannedContestLanding({
  contest,
  commerceOpen,
  contactOpen,
}: {
  contest: CatalogContest;
  commerceOpen: boolean;
  contactOpen: boolean;
}) {
  const category = contestCategories.find(
    (item) => item.slug === contest.categorySlug,
  );
  const direction = getCareerDirection(contest.categorySlug);
  const location = contest.jurisdictionCodes
    .map((code) => getOpportunityJurisdictionByCode(code)?.name ?? code)
    .join(" · ");
  const faqs = [
    [
      "Este concurso já está à venda?",
      "Ainda não. Esta oferta está em preparação editorial. Os preços são os valores previstos, e a compra só será aberta após a validação do conteúdo e da operação.",
    ],
    [
      "O que o acesso individual inclui?",
      "O avulso é exclusivo para a edição e o cargo identificados na oferta, pelo período escolhido. Não inclui automaticamente outros concursos, nem promete cobertura integral do edital.",
    ],
    [
      "Qual a diferença para o Master?",
      "O Master é uma assinatura para os concursos efetivamente liberados durante sua vigência. As novas edições só entram após liberação editorial. Cursos em preparação não se tornam disponíveis por causa da assinatura.",
    ],
    [
      "Posso estudar no celular ou tablet?",
      "Sim. A experiência é acessada pelo navegador em computador, tablet e celular, com conexão à internet. O tour usa dados fictícios para apresentar a organização da plataforma; não representa o acervo desta edição.",
    ],
    [
      "O acesso tem renovação automática?",
      "Sim. O plano individual Mensal custa R$ 67 por mês e o Anual, R$ 347 cobrados de uma vez a cada ano. Ambos têm renovação automática. Você pode cancelar a renovação na sua conta e mantém acesso até o fim do período pago. O Master é uma assinatura separada, com seus próprios valores.",
    ],
    [
      "As questões são da banca do concurso?",
      "As questões de treino são autorais. A banca e o programa desta edição ainda precisam de validação em fonte oficial. Não reproduzimos questões de terceiros nem sugerimos parceria com a organizadora.",
    ],
    [
      "Como funcionam os adicionais?",
      "Um prazo maior ou outro concurso precisa ser escolhido por você. Nenhum adicional pago entra automaticamente. O total é atualizado antes da confirmação da compra.",
    ],
  ];
  return (
    <article
      className={`${base.landing} ${styles.page}`}
      data-theme={direction.theme}
    >
      <CourseHero
        acronym={contest.acronym}
        role={contest.role}
        category={category?.name ?? "Concursos"}
        categorySlug={contest.categorySlug}
        location={location}
        edition={contest.editionLabel}
      />
      <CourseNavigation />
      <CourseMethod />
      <CourseTourSection />
      <CoursePrinciples />
      <section
        id="edicao"
        className={styles.editionSection}
        aria-labelledby="edicao-title"
      >
        <div className={`${base.container} ${styles.editionGrid}`}>
          <div>
            <span className={styles.label}>03 / UM OBJETIVO BEM DEFINIDO</span>
            <h2 id="edicao-title">
              O seu concurso.
              <br />
              <em>Sem misturar caminhos.</em>
            </h2>
            <p>
              {direction.focus} Cada edição tem sua própria página, conteúdo e
              acesso. O catálogo não substitui o edital oficial.
            </p>
          </div>
          <div className={styles.editionFacts}>
            <dl>
              <div>
                <dt>Órgão / objetivo</dt>
                <dd>{contest.acronym}</dd>
              </div>
              <div>
                <dt>Localidade</dt>
                <dd>{location}</dd>
              </div>
              <div>
                <dt>Cargo</dt>
                <dd>{contest.role}</dd>
              </div>
              <div>
                <dt>Recorte de referência</dt>
                <dd>{contest.editionLabel}</dd>
              </div>
              <div>
                <dt>Banca e datas</dt>
                <dd>Aguardando confirmação oficial</dd>
              </div>
              <div>
                <dt>Disponibilidade</dt>
                <dd>Em preparação editorial</dd>
              </div>
            </dl>
            <p>
              Esta página não representa um curso completo liberado. Antes da
              venda, a edição, as fontes e o conteúdo pertinente precisam ser
              validados. Não há cobrança nesta etapa.
            </p>
          </div>
        </div>
      </section>
      <ContestPricing
        contestName={contestTitle(contest)}
        productSlug={contest.slug}
        commerceOpen={commerceOpen}
        contactOpen={contactOpen}
      />
      <section id="duvidas" className={styles.faq} aria-labelledby="faq-title">
        <div className={`${base.container} ${base.faqGrid}`}>
          <div className={base.faqIntro}>
            <span className={styles.label}>ESCOLHA COM CLAREZA</span>
            <h2 id="faq-title">
              Antes do seu
              <br />
              <em>próximo passo.</em>
            </h2>
            <p>
              Sobre conteúdo, acesso e tudo o que vale saber antes de começar.
            </p>
            {contactOpen && (
              <Link href="/contato" className={base.textButton}>
                Falar com a equipe <ArrowRight size={17} aria-hidden="true" />
              </Link>
            )}
          </div>
          <div className={base.faqList}>
            {faqs.map(([question, answer]) => (
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
      <section className={styles.closing} aria-labelledby="final-title">
        <div className={`${base.container} ${styles.closingCard}`}>
          <div>
            <span className={styles.label}>
              UM NOVO CAPÍTULO NA SUA PREPARAÇÃO
            </span>
            <h2 id="final-title">
              A próxima página
              <br />
              <em>começa com você.</em>
            </h2>
            <p>
              Conheça a proposta para {contest.acronym} e escolha seu caminho
              com clareza.
            </p>
          </div>
          <a href="#planos" className={`${base.button} ${base.buttonPrimary}`}>
            Ver acessos e preços <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </section>
      <div className={base.mobileDock}>
        <span>
          <strong>{contest.acronym}</strong>
          <small>Oferta em preparação</small>
        </span>
        <a href="#planos" className={`${base.button} ${base.buttonPrimary}`}>
          Ver acessos <ArrowRight size={16} aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}
