import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpenCheck,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Target,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PublicContestOpportunity } from "@/lib/db/contest-opportunities";
import { getCareerDirection } from "@/lib/opportunities/landing-presentation";
import {
  formatOpportunityDate,
  getOpportunityLifecycleLabel,
  getResponsibleTypeLabel,
} from "@/lib/opportunities/presentation";

import { ContestPricing } from "./contest-pricing";
import { ContestProductTour } from "./contest-product-tour";
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
        "A compra avulsa é exclusiva para esta edição, pelo prazo escolhido e sem renovação automática. O Master é uma assinatura para todos os concursos efetivamente liberados durante a vigência. Nenhum plano transforma uma edição em preparação em curso pronto.",
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
        "Não há promessa de parcelamento ou período gratuito nesta página. O valor mensal equivalente do Master Anual serve apenas para comparação: o total é cobrado por ciclo de 12 meses quando a contratação estiver aberta. O avulso é pagamento único, sem renovação automática. Confira as condições antes da compra.",
    },
    {
      question: "Onde confiro as informações atualizadas do concurso?",
      answer:
        "Use o link da publicação oficial no panorama desta página e confira a data da última verificação. O catálogo mostra uma situação revisada em determinada data; retificações e publicações do órgão sempre prevalecem sobre o resumo.",
    },
  ];

  return (
    <article className={styles.landing} data-theme={direction.theme}>
      <section className={styles.hero} aria-labelledby="concurso-title">
        <div className={styles.container}>
          <nav aria-label="Navegação estrutural" className={styles.breadcrumb}>
            <ol>
              <li>
                <Link href="/concursos">Concursos</Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={`/concursos#${opportunity.categorySlug}`}>
                  {opportunity.categoryName}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page">
                {opportunity.institutionAcronym} · {opportunity.cycleYear}
              </li>
            </ol>
          </nav>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.heroKicker}>
                <span className={styles.liveDot} />
                {opportunity.categoryName}
                <span className={styles.kickerLine} />
                {jurisdictionName}
              </div>
              <h1 id="concurso-title">
                <span>
                  {`${opportunity.institutionAcronym} ${opportunity.cycleYear}`}
                </span>
                A lei seca no centro da sua <em>preparação.</em>
              </h1>
              <p className={styles.heroLead}>
                {direction.focus} Conheça uma experiência que conecta leitura,
                prática e revisão.
              </p>
              <div className={styles.heroActions}>
                <a
                  href="#planos"
                  className={`${styles.button} ${styles.buttonPrimary}`}
                >
                  Conhecer planos e preços
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a href="#por-dentro" className={styles.textButton}>
                  Ver a plataforma por dentro
                  <ArrowDown size={17} aria-hidden="true" />
                </a>
              </div>
              <p className={styles.heroAvailability}>
                <ShieldCheck size={18} aria-hidden="true" />
                <span>
                  {productAvailable
                    ? "Conteúdo desta edição liberado."
                    : "Plano desta edição em preparação editorial."}
                  <br />
                  Confira o que está disponível antes de contratar.
                </span>
              </p>
            </div>
            <figure className={styles.heroVisual}>
              <div className={styles.heroImageFrame}>
                <Image
                  src="/assets/contests/study-ritual.webp"
                  alt="Cena ilustrativa de uma estudante concentrada na leitura, com livro e tablet sobre a mesa."
                  fill
                  sizes="(max-width: 900px) 100vw, 48vw"
                  loading="eager"
                  fetchPriority="high"
                  className={styles.heroImage}
                />
                <span className={styles.visualCorner}>
                  EDITALUME / ESTUDO COM INTENÇÃO
                </span>
                <div className={styles.visualQuote}>
                  <span>O seu futuro começa</span>
                  <strong>na próxima página.</strong>
                </div>
              </div>
              <div className={styles.heroFloatingCard}>
                <span className={styles.floatingIcon}>
                  <BookOpenCheck size={23} aria-hidden="true" />
                </span>
                <div>
                  <span>O MÉTODO EM UM CICLO</span>
                  <strong>Ler. Praticar. Revisar.</strong>
                </div>
                <ArrowUpRight size={21} aria-hidden="true" />
              </div>
              <figcaption className={styles.imageCaption}>
                Imagem ilustrativa criada com IA.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <nav className={styles.sectionNav} aria-label="Nesta página">
        <div className={styles.container}>
          <a href="#beneficios">O método</a>
          <a href="#por-dentro">Por dentro</a>
          <a href="#edicao">O concurso</a>
          <a href="#planos">Planos e preços</a>
          <a href="#duvidas">Dúvidas</a>
          <Link href="/entrar">
            Área do aluno
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </nav>

      <div className={`${styles.container} ${styles.trustStrip}`}>
        {[
          {
            Icon: Fingerprint,
            title: "Questões autorais",
            detail: "Treino com identidade própria",
          },
          {
            Icon: FileCheck2,
            title: "Fontes verificáveis",
            detail: "O dispositivo como referência",
          },
          {
            Icon: RotateCcw,
            title: "Revisão espaçada",
            detail: "Retomar faz parte do método",
          },
          {
            Icon: Smartphone,
            title: "Do desktop ao celular",
            detail: "Acesso pelo navegador",
          },
        ].map(({ Icon, title, detail }) => (
          <div key={title}>
            <Icon size={22} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small>{detail}</small>
            </span>
          </div>
        ))}
      </div>

      <section
        id="beneficios"
        className={`${styles.section} ${styles.methodSection}`}
        aria-labelledby="metodo-title"
      >
        <div className={styles.container}>
          <div className={styles.methodIntro}>
            <span className={styles.eyebrow}>MENOS LEITURA NO AUTOMÁTICO</span>
            <h2 id="metodo-title">
              Não é só passar os olhos.
              <br />É fazer a lei <em>ficar.</em>
            </h2>
            <p>
              Entre ler um artigo e lembrar dele na hora de responder, existe
              prática. A Editalume organiza esse caminho em três movimentos.
            </p>
          </div>
          <div className={styles.methodGrid}>
            {[
              {
                n: "01",
                Icon: BookOpenCheck,
                title: "Leia com atenção ao detalhe.",
                description:
                  "Prazos, competências e exceções merecem uma leitura consciente. Consulte o dispositivo e sua fonte, não apenas uma resposta solta.",
                tag: "COMPREENDER",
              },
              {
                n: "02",
                Icon: Target,
                title: "Transforme leitura em prática.",
                description:
                  "Teste a literalidade com questões autorais e entenda a explicação. O erro vira um ponto concreto para retomar, não só uma nota.",
                tag: "PRATICAR",
              },
              {
                n: "03",
                Icon: RotateCcw,
                title: "Dê uma segunda chance à memória.",
                description:
                  "Volte aos dispositivos na fila de revisão e acompanhe o histórico. Uma rotina de retomada dá continuidade ao estudo.",
                tag: "CONSOLIDAR",
              },
            ].map(({ n, Icon, title, description, tag }) => (
              <div key={n} className={styles.methodCard}>
                <div>
                  <span>{n}</span>
                  <Icon size={26} aria-hidden="true" />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className={styles.methodTag}>
                  {tag}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </span>
              </div>
            ))}
          </div>
          <p className={styles.methodFootnote}>
            Um método de estudo, não uma promessa de aprovação. A
            disponibilidade de conteúdo depende da revisão editorial.
          </p>
        </div>
      </section>

      <section
        id="por-dentro"
        className={styles.section}
        aria-labelledby="tour-title"
      >
        <div className={styles.container}>
          <div className={styles.splitHeading}>
            <div>
              <span className={styles.eyebrow}>
                ABRA A PORTA. CONHEÇA POR DENTRO.
              </span>
              <h2 id="tour-title">
                Seu estudo,
                <br />
                <em>em um só lugar.</em>
              </h2>
            </div>
            <p>
              Uma visão clara do próximo passo, das revisões e do seu histórico.
              Explore abaixo como a experiência é organizada.
            </p>
          </div>
          <ContestProductTour />
          <div className={styles.tourBottom}>
            <span>
              <Smartphone size={20} aria-hidden="true" />
              No intervalo, à mesa ou no sofá. A rotina acompanha a sua tela.
            </span>
            <Link href="/entrar">
              Já tem acesso? Entre aqui
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

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
                <strong>Em preparação editorial</strong>
                <p>
                  O catálogo do concurso não representa um curso completo
                  liberado. O programa e as questões precisam concluir a
                  validação.
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
