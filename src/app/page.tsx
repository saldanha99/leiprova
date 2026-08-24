import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  Crosshair,
  DatabaseZap,
  FileCheck2,
  Fingerprint,
  Layers3,
  LibraryBig,
  LockKeyhole,
  MessagesSquare,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  TimerReset,
} from "lucide-react";

import { BrandMark } from "@/components/brand/BrandMark";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LiteralLab } from "@/components/landing/LiteralLab";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { SectionHeading } from "@/components/landing/SectionHeading";
import { JsonLd } from "@/components/seo/json-ld";
import { isCommerceOpen } from "@/lib/launch";
import { formatBRL, PLANS } from "@/lib/plans";
import {
  ORGANIZATION_ID,
  SOCIAL_IMAGE,
  SOCIAL_IMAGE_PATH,
  WEBSITE_ID,
  absoluteUrl,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "LeiProva | Treino inteligente de lei seca para concursos" },
  description:
    "Transforme a literalidade da lei em treinos de múltipla escolha, revisão espaçada e um roteiro de estudos que mostra o que revisar agora.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "LeiProva | Treino inteligente de lei seca para concursos",
    description:
      "Treine a literalidade da lei com questões originais, fonte oficial e revisão distribuída para concursos públicos.",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "LeiProva | Treino inteligente de lei seca para concursos",
    description:
      "Treine a literalidade da lei com questões originais, fonte oficial e revisão distribuída para concursos públicos.",
    images: [SOCIAL_IMAGE_PATH],
  },
};

export const dynamic = "force-dynamic";

const FEATURE_STRIP = [
  { icon: BookOpenCheck, label: "Lei por artigo" },
  { icon: BrainCircuit, label: "Revisão espaçada" },
  { icon: TimerReset, label: "Prazos e exceções" },
  { icon: Crosshair, label: "Foco por banca" },
  { icon: Layers3, label: "Cadernos e simulados" },
  { icon: ScanSearch, label: "Mutação literal" },
] as const;

const METHOD_STEPS = [
  {
    number: "01",
    icon: Target,
    eyebrow: "Direção",
    title: "Comece pelo que importa hoje.",
    description:
      "Escolha carreira, banca e tempo disponível. O roteiro organiza artigos, prazos e pontos sensíveis em uma sessão possível de cumprir.",
    detail: "Menos indecisão antes de estudar",
  },
  {
    number: "02",
    icon: ScanSearch,
    eyebrow: "Atenção",
    title: "Encontre a palavra que mudou.",
    description:
      "Alternativas próximas obrigam seu cérebro a recuperar a redação, em vez de apenas reconhecer um texto que parece familiar.",
    detail: "Treino ativo da literalidade",
  },
  {
    number: "03",
    icon: RefreshCw,
    eyebrow: "Retenção",
    title: "Revise antes de esquecer.",
    description:
      "Seus acertos, erros e tempo de resposta alimentam uma fila de revisão para cada artigo voltar no momento certo.",
    detail: "Memória construída por recorrência",
  },
] as const;

const TRUST_ITEMS = [
  {
    icon: Fingerprint,
    title: "Origem sempre visível",
    description:
      "Cada treino pode mostrar norma, artigo e acesso à fonte utilizada. Você sabe exatamente de onde veio o conteúdo.",
  },
  {
    icon: DatabaseZap,
    title: "Versão identificada",
    description:
      "O acervo organiza vigência e histórico editorial para que uma atualização não passe despercebida na sua preparação.",
  },
  {
    icon: FileCheck2,
    title: "Questões originais rastreáveis",
    description:
      "Os 12 itens do beta foram assistidos por IA e conferidos contra a fonte; a revisão humana independente ainda está pendente.",
  },
] as const;

const FAQS = [
  {
    question: "O LeiProva substitui a leitura da lei seca?",
    answer:
      "Não. A plataforma organiza a leitura e cria recuperação ativa logo depois dela. A proposta é fazer você voltar ao texto legal com direção e testar se a redação realmente permaneceu na memória.",
  },
  {
    question: "As alternativas são questões oficiais de concurso?",
    answer:
      "Não no acervo atual. Hoje estão publicadas 12 questões originais de lei seca assistidas por IA, baseadas na Constituição Federal e ainda pendentes de revisão humana independente. Questões anteriores só serão exibidas com licença ou autorização documentada e procedência identificada.",
  },
  {
    question: "Como acompanho atualizações na legislação?",
    answer:
      "Cada item pode mostrar fonte e data de verificação. O banco registra versões e status editorial; o monitoramento automático periódico ainda não está ativo, por isso alterações precisam de conferência e revisão antes de uma nova publicação.",
  },
  {
    question: "Serve para concursos de nível médio e superior?",
    answer:
      "Sim, desde que as leis da sua carreira estejam disponíveis no acervo. Você personaliza disciplinas, banca e intensidade do roteiro em vez de receber uma trilha genérica.",
  },
  {
    question: "Consigo estudar pelo celular?",
    answer:
      "Sim. A proposta é manter o mesmo progresso entre notebook, tablet e celular, com sessões curtas para aproveitar intervalos e revisões mais longas quando houver tempo.",
  },
] as const;

const homeStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": `${absoluteUrl()}#webpage`,
      url: absoluteUrl(),
      name: "LeiProva | Treino inteligente de lei seca para concursos",
      description:
        "Plataforma de treino ativo da literalidade da lei com questões originais, fonte oficial e revisão distribuída.",
      inLanguage: "pt-BR",
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": ORGANIZATION_ID },
      dateModified: "2026-08-24",
    },
    {
      "@type": "FAQPage",
      "@id": `${absoluteUrl()}#perguntas-frequentes`,
      mainEntity: FAQS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

function ArrowCta() {
  return (
    <span className="button__icon" aria-hidden="true">
      <ArrowRight size={18} />
    </span>
  );
}

export default function Home() {
  const commerceOpen = isCommerceOpen();
  const primaryHref = commerceOpen ? "/cadastro?plano=foco" : "/demo";

  return (
    <div className="site-shell" id="inicio" lang="pt-BR">
      <JsonLd data={homeStructuredData} />
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      <LandingHeader commerceOpen={commerceOpen} />

      <main id="conteudo">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-ambient hero-ambient--one" aria-hidden="true" />
          <div className="hero-ambient hero-ambient--two" aria-hidden="true" />
          <div className="hero-orbit" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>

          <div className="site-container hero-grid">
            <div className="hero-copy">
              <span className="hero-eyebrow">
                <Sparkles aria-hidden="true" size={15} />
                Treino de lei seca que conversa com a sua memória
              </span>
              <h1 id="hero-title">
                Pare de só reconhecer.
                <span>Comece a lembrar.</span>
              </h1>
              <p className="hero-lead">
                O LeiProva transforma artigos, prazos e exceções em rodadas de múltipla escolha que
                revelam onde a sua atenção falhou — e trazem o ponto de volta antes que você esqueça.
              </p>

              <div className="hero-actions">
                <Link className="button button--amber button--large" href={primaryHref}>
                  {commerceOpen ? "Quero treinar a lei" : "Testar o método agora"}
                  <ArrowCta />
                </Link>
                <Link className="button button--glass button--large" href="/demo">
                  Experimentar uma questão
                </Link>
              </div>

              <ul className="hero-assurances" aria-label="Diferenciais do produto">
                <li>
                  <ShieldCheck aria-hidden="true" size={17} />
                  Fonte identificada
                </li>
                <li>
                  <Clock3 aria-hidden="true" size={17} />
                  Sessões que cabem na rotina
                </li>
                <li>
                  <BadgeCheck aria-hidden="true" size={17} />
                  Feito para concursos públicos
                </li>
              </ul>
            </div>

            <div className="hero-visual" aria-label="Prévia visual do ecossistema LeiProva">
              <div className="hero-visual__halo" aria-hidden="true" />
              <Image
                className="hero-visual__image"
                src="/assets/leiprova-ecosystem.png"
                alt="LeiProva em notebook, celular e tablet com questões, texto legal e painel de desempenho"
                width={1586}
                height={992}
                priority
                sizes="(max-width: 900px) 100vw, 58vw"
              />
              <span className="hero-visual__caption">Interface ilustrativa</span>
              <div className="hero-float-card hero-float-card--top">
                <span className="hero-float-card__icon">
                  <CircleDot aria-hidden="true" size={17} />
                </span>
                <span>
                  <small>Foco de agora</small>
                  <strong>Direito Constitucional</strong>
                </span>
              </div>
              <div className="hero-float-card hero-float-card--bottom">
                <span className="hero-float-card__icon hero-float-card__icon--green">
                  <RefreshCw aria-hidden="true" size={17} />
                </span>
                <span>
                  <small>Próxima ação</small>
                  <strong>6 artigos para revisar</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="site-container feature-strip" aria-label="Recursos em destaque">
            {FEATURE_STRIP.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.label}>
                  <Icon aria-hidden="true" size={18} />
                  <span>{feature.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="method-section section-space" id="metodo" aria-labelledby="method-title">
          <div className="site-container">
            <SectionHeading
              eyebrow="Um ciclo que faz sentido"
              title={
                <span id="method-title">
                  Ler é o começo. <em>Recuperar é o que fixa.</em>
                </span>
              }
              description="O método coloca direção, prática e revisão na mesma sequência. Cada sessão termina com uma próxima ação clara."
              align="center"
            />

            <div className="method-grid">
              {METHOD_STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <article className="method-card" key={step.number}>
                    <div className="method-card__topline">
                      <span className="method-card__icon">
                        <Icon aria-hidden="true" size={22} />
                      </span>
                      <span className="method-card__number">{step.number}</span>
                    </div>
                    <span className="method-card__eyebrow">{step.eyebrow}</span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                    <div className="method-card__detail">
                      <CheckCircle2 aria-hidden="true" size={16} />
                      {step.detail}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="mt-10 flex justify-center">
              <Link className="button button--outline" href="/como-memorizar-lei-seca">
                Entender recuperação e revisão espaçada
                <ArrowCta />
              </Link>
            </div>
          </div>
        </section>

        <section
          className="lab-section section-space"
          id="laboratorio"
          aria-labelledby="lab-title"
        >
          <div className="site-container">
            <div className="lab-section__heading-row">
              <SectionHeading
                eyebrow="Laboratório de literalidade"
                title={
                  <span id="lab-title">
                    A pegadinha aparece. <em>Você enxerga.</em>
                  </span>
                }
                description="Teste uma demonstração real da interação: escolha a palavra que completa a redação e veja por que o distrator parecia correto."
              />
              <div className="lab-section__hint">
                <span>Experimente agora</span>
                <ChevronDown aria-hidden="true" size={20} />
              </div>
            </div>
            <LiteralLab />
          </div>
        </section>

        <section className="showcase-section section-space" id="recursos" aria-labelledby="showcase-title">
          <div className="site-container">
            <SectionHeading
              eyebrow="Uma preparação que acompanha você"
              title={
                <span id="showcase-title">
                  Um só progresso. <em>Três telas.</em>
                </span>
              }
              description="Planeje no notebook, revise no tablet e resolva uma rodada curta no celular. A experiência se adapta sem perder contexto."
              align="center"
            />

            <ProductShowcase />

            <div className="showcase-benefits">
              <article>
                <span>
                  <Target aria-hidden="true" size={19} />
                </span>
                <div>
                  <h3>Roteiro de hoje</h3>
                  <p>Abra a plataforma sabendo qual é a próxima tarefa.</p>
                </div>
              </article>
              <article>
                <span>
                  <BrainCircuit aria-hidden="true" size={19} />
                </span>
                <div>
                  <h3>Fila adaptativa</h3>
                  <p>Artigos retornam conforme dificuldade e histórico de resposta.</p>
                </div>
              </article>
              <article>
                <span>
                  <LibraryBig aria-hidden="true" size={19} />
                </span>
                <div>
                  <h3>Acervo organizado</h3>
                  <p>Leis, cadernos e simulados reunidos por disciplina e carreira.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="xray-section section-space" aria-labelledby="xray-title">
          <div className="site-container xray-grid">
            <div className="xray-copy">
              <SectionHeading
                eyebrow="Raio-X de estudo"
                title={
                  <span id="xray-title">
                    Nem todo artigo pede a <em>mesma energia.</em>
                  </span>
                }
                description="Cruze o perfil da banca, os tópicos do seu edital e o seu histórico de erros para decidir onde insistir primeiro."
                inverse
              />

              <ul className="xray-list">
                <li>
                  <Check aria-hidden="true" size={17} />
                  Filtre por carreira, banca e disciplina
                </li>
                <li>
                  <Check aria-hidden="true" size={17} />
                  Veja artigos que merecem prioridade editorial
                </li>
                <li>
                  <Check aria-hidden="true" size={17} />
                  Combine incidência com o seu desempenho
                </li>
              </ul>

              <Link className="button button--amber" href="/demo">
                Ver uma demonstração
                <ArrowCta />
              </Link>
            </div>

            <div className="xray-panel" aria-label="Exemplo ilustrativo do Raio-X">
              <div className="xray-panel__topline">
                <div>
                  <span className="app-mini-label">Visão ilustrativa</span>
                  <h3>Prioridade por banca</h3>
                </div>
                <span className="xray-panel__signal">
                  <i aria-hidden="true" />
                  Acervo conectado
                </span>
              </div>

              <div className="bank-chips" aria-label="Exemplos de bancas">
                <span className="is-active">CEBRASPE</span>
                <span>FGV</span>
                <span>FCC</span>
                <span>VUNESP</span>
              </div>

              <div className="xray-chart">
                {[
                  ["Direitos e garantias fundamentais", "Prioridade alta", 88],
                  ["Administração pública", "Prioridade alta", 76],
                  ["Organização do Estado", "Prioridade média", 58],
                  ["Controle de constitucionalidade", "Reforçar", 43],
                ].map(([label, status, width]) => (
                  <div className="xray-chart__row" key={label as string}>
                    <div>
                      <strong>{label}</strong>
                      <span>{status}</span>
                    </div>
                    <span className="xray-chart__bar">
                      <i style={{ width: `${width}%` }} />
                    </span>
                  </div>
                ))}
              </div>

              <p className="xray-panel__disclaimer">
                Exemplo de interface. A disponibilidade varia conforme o acervo da carreira.
              </p>
            </div>
          </div>
        </section>

        <section className="trust-section section-space" aria-labelledby="trust-title">
          <div className="site-container">
            <div className="trust-intro">
              <SectionHeading
                eyebrow="Confiança antes da decoreba"
                title={
                  <span id="trust-title">
                    Estude a redação sabendo <em>de onde ela veio.</em>
                  </span>
                }
                description="Literalidade exige cuidado editorial. Por isso, a interface foi pensada para deixar fonte, versão e contexto ao alcance — sem transformar a plataforma em parecer jurídico."
              />

              <div className="trust-source-card">
                <div className="trust-source-card__header">
                  <span>
                    <LockKeyhole aria-hidden="true" size={16} />
                    Registro de fonte
                  </span>
                  <span className="trust-source-card__status">Identificada</span>
                </div>
                <div className="trust-source-card__document">
                  <span className="trust-source-card__seal">
                    <FileCheck2 aria-hidden="true" size={22} />
                  </span>
                  <div>
                    <small>Norma</small>
                    <strong>Constituição da República Federativa do Brasil</strong>
                    <p>Artigo, referência editorial e acesso à publicação utilizada.</p>
                  </div>
                </div>
                <div className="trust-source-card__timeline">
                  <span className="is-complete">Fonte vinculada</span>
                  <span className="is-complete">Revisão editorial</span>
                  <span>Disponível para treino</span>
                </div>
              </div>
            </div>

            <div className="trust-grid">
              {TRUST_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title}>
                    <span>
                      <Icon aria-hidden="true" size={20} />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                );
              })}
            </div>
            <div className="mt-9">
              <Link className="button button--outline" href="/fontes-e-atualizacao">
                Ver o acervo atual e a política de fontes
                <ArrowCta />
              </Link>
            </div>
          </div>
        </section>

        <section className="pricing-section section-space" id="planos" aria-labelledby="pricing-title">
          <div className="pricing-glow" aria-hidden="true" />
          <div className="site-container">
            <SectionHeading
              eyebrow="Escolha o seu ritmo"
              title={
                <span id="pricing-title">
                  Um plano para começar. <em>Um método para continuar.</em>
                </span>
              }
              description={commerceOpen
                ? "Todos os planos colocam o laboratório de literalidade no centro. A diferença está no horizonte, nas ferramentas e na profundidade do roteiro."
                : "Prévia dos planos planejados para o lançamento. O checkout ainda não está aberto e nenhuma cobrança pode ser feita agora."}
              align="center"
            />

            <div className="pricing-grid">
              {PLANS.map((plan) => (
                <article
                  className={`pricing-card${plan.featured ? " pricing-card--featured" : ""}`}
                  key={plan.slug}
                >
                  {plan.featured && (
                    <span className="pricing-card__badge">
                      <Sparkles aria-hidden="true" size={14} />
                      Melhor equilíbrio
                    </span>
                  )}
                  <div className="pricing-card__heading">
                    <span>{plan.eyebrow}</span>
                    <h3>{plan.name}</h3>
                  </div>
                  <div className="pricing-card__price">
                    <strong>{formatBRL(plan.priceCents)}</strong>
                    <span>{plan.billingLabel}</span>
                  </div>
                  <p className="pricing-card__equivalent">
                    {plan.equivalentMonthly ?? "cobrança recorrente conforme o ciclo"}
                  </p>

                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <span>
                          <Check aria-hidden="true" size={15} />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    className={`button button--full ${
                      plan.featured ? "button--amber" : "button--outline"
                    }`}
                    href={commerceOpen ? `/cadastro?plano=${plan.slug}` : "/demo"}
                  >
                    {commerceOpen
                      ? plan.slug === "ritmo"
                        ? "Começar no Ritmo"
                        : "Escolher o Foco"
                      : "Testar a demonstração"}
                    <ArrowCta />
                  </Link>
                </article>
              ))}
            </div>

            <div className="pricing-note">
              <LockKeyhole aria-hidden="true" size={17} />
              <span>
                {commerceOpen
                  ? "Checkout seguro. Você revisa plano, preço e condições antes de confirmar qualquer pagamento."
                  : "Valores de referência para validação. A abertura comercial depende da revisão final dos planos e documentos."}
              </span>
            </div>
          </div>
        </section>

        <section className="guarantee-section section-space" aria-labelledby="guarantee-title">
          <div className="site-container guarantee-card">
            <div className="guarantee-card__seal" aria-hidden="true">
              <ShieldCheck size={38} />
              <span>7</span>
            </div>
            <div>
              <span className="section-eyebrow">{commerceOpen ? "Conheça sem pressa" : "Política prevista para o lançamento"}</span>
              <h2 id="guarantee-title">Sete dias para sentir se o método cabe na sua rotina.</h2>
              <p>
                Use o laboratório, monte seu roteiro e acompanhe as primeiras revisões. Se a
                experiência não fizer sentido para você, solicite o cancelamento e eventual reembolso
                dentro do prazo, conforme as condições apresentadas na oferta.
              </p>
            </div>
            <Link className="button button--amber" href={primaryHref}>
              {commerceOpen ? "Começar com o plano Foco" : "Experimentar a demonstração"}
              <ArrowCta />
            </Link>
          </div>
        </section>

        <section className="faq-section section-space" aria-labelledby="faq-title">
          <div className="site-container faq-grid">
            <div className="faq-intro">
              <SectionHeading
                eyebrow="Perguntas frequentes"
                title={
                  <span id="faq-title">
                    Antes de começar, <em>vale saber.</em>
                  </span>
                }
                description="Respostas diretas sobre conteúdo, dispositivos e formas de acesso."
              />
              <div className="faq-support">
                <span>
                  <MessagesSquare aria-hidden="true" size={19} />
                </span>
                <div>
                  <strong>Ainda ficou com dúvida?</strong>
                  <p>Converse com o suporte antes de escolher um plano.</p>
                </div>
                <Link href="/contato">Falar com suporte</Link>
              </div>
            </div>

            <div className="faq-list">
              {FAQS.map((item, index) => (
                <details key={item.question} open={index === 0}>
                  <summary>
                    {item.question}
                    <span aria-hidden="true">
                      <ChevronDown size={18} />
                    </span>
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta-section" aria-labelledby="final-cta-title">
          <div className="final-cta-section__grid" aria-hidden="true" />
          <div className="site-container final-cta-card">
            <span className="final-cta-card__eyebrow">
              <Sparkles aria-hidden="true" size={15} />
              Seu próximo artigo pode virar memória hoje
            </span>
            <h2 id="final-cta-title">
              Leia. Escolha. Erre melhor. <span>Acerte quando valer ponto.</span>
            </h2>
            <p>
              Comece com uma demonstração ou monte seu primeiro roteiro de literalidade no LeiProva.
            </p>
            <div>
              <Link className="button button--amber button--large" href={primaryHref}>
                {commerceOpen ? "Criar meu roteiro" : "Testar o método"}
                <ArrowCta />
              </Link>
              <Link className="button button--glass button--large" href="/demo">
                Fazer uma questão grátis
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-container site-footer__top">
          <div className="site-footer__brand">
            <BrandMark />
            <p>
              Uma plataforma de treino ativo para quem precisa lembrar da redação legal quando a prova
              apertar.
            </p>
          </div>

          <div className="site-footer__links">
            <div>
              <strong>Produto</strong>
              <Link href="/como-memorizar-lei-seca">Como memorizar lei seca</Link>
              <Link href="/fontes-e-atualizacao">Fontes e atualização</Link>
              <a href="#laboratorio">Laboratório</a>
              <a href="#recursos">Recursos</a>
              <a href="#planos">Planos</a>
            </div>
            <div>
              <strong>Conta</strong>
              <Link href="/entrar">Entrar</Link>
              <Link href="/demo">Demonstração</Link>
              <Link href="/contato">Suporte</Link>
            </div>
            <div>
              <strong>Legal</strong>
              <Link href="/termos">Termos de uso</Link>
              <Link href="/privacidade">Privacidade</Link>
              <Link href="/reembolso">Política de reembolso</Link>
            </div>
          </div>
        </div>

        <div className="site-container site-footer__bottom">
          <p>© {new Date().getFullYear()} LeiProva. Todos os direitos reservados.</p>
          <p>
            Conteúdo meramente informativo e não oficial. A plataforma não presta consultoria jurídica nem substitui a publicação vigente no diário oficial.
          </p>
        </div>
      </footer>
    </div>
  );
}
