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
import { howItWorksCta, primaryCtaHref } from "@/lib/funnel";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LiteralLab } from "@/components/landing/LiteralLab";
import { PricingPlans } from "@/components/landing/PricingPlans";
import { JsonLd } from "@/components/seo/json-ld";
import { isMasterCommerceOpen } from "@/lib/commerce/master-gate";
import { isContactEnabled } from "@/lib/launch";
import { elsFontVariables } from "@/lib/els-fonts";
import { getAnnualDiscountPercentage } from "@/lib/plans";
import {
  ORGANIZATION_ID,
  SOCIAL_IMAGE,
  SOCIAL_IMAGE_PATH,
  WEBSITE_ID,
  absoluteUrl,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Edital Lei Seca | Lei seca guiada pelo edital" },
  description:
    "Transforme a literalidade da lei em treinos de múltipla escolha, revisão espaçada e um roteiro de estudos que mostra o que revisar agora.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: "Edital Lei Seca | Lei seca guiada pelo edital",
    description:
      "Treine a literalidade da lei com questões originais, fonte oficial e revisão distribuída para concursos públicos.",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Edital Lei Seca | Lei seca guiada pelo edital",
    description:
      "Treine a literalidade da lei com questões originais, fonte oficial e revisão distribuída para concursos públicos.",
    images: [SOCIAL_IMAGE_PATH],
  },
};

export const viewport = { themeColor: "#fbfaf6" };

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
      "As inéditas são assistidas por IA, vinculadas a fontes oficiais e liberadas por aprovação automática autorizada pelo proprietário, com conferência posterior. Isso não equivale a revisão humana independente de cada item.",
  },
] as const;

const FAQS = [
  {
    question: "A Edital Lei Seca substitui a leitura da lei seca?",
    answer:
      "Não. A plataforma organiza a leitura e cria recuperação ativa logo depois dela. A proposta é fazer você voltar ao texto legal com direção e testar se a redação realmente permaneceu na memória.",
  },
  {
    question: "As alternativas são questões oficiais de concurso?",
    answer:
      "O treino usa questões originais assistidas por IA, com perfil próprio de banca e cargo. Elas não são questões oficiais da organizadora. Cadernos e gabaritos anteriores têm links para as fontes oficiais quando conferidos; incorporar suas questões ao treino exige autorização ou licença documentada.",
  },
  {
    question: "Como acompanho atualizações na legislação?",
    answer:
      "Consulte a fonte, a versão e a data de verificação do item. Alterações legislativas entram no fluxo editorial e podem exigir suspensão temporária de questões. A plataforma não substitui a conferência do Diário Oficial e do edital.",
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
      name: "Edital Lei Seca | Lei seca guiada pelo edital",
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

const XRAY_ROWS = [
  ["Direitos e garantias fundamentais", "Prioridade alta", 88],
  ["Administração pública", "Prioridade alta", 76],
  ["Organização do Estado", "Prioridade média", 58],
  ["Controle de constitucionalidade", "Reforçar", 43],
] as const;

export default async function Home() {
  // O funil da home leva ao Master; com ele fechado, a home segue no modo prévio.
  const commerceOpen = await isMasterCommerceOpen();
  const contactOpen = isContactEnabled();
  const annualDiscountPercentage = getAnnualDiscountPercentage();
  const primaryHref = primaryCtaHref(commerceOpen, true);

  return (
    <div className={`els-light ${elsFontVariables}`} id="inicio" lang="pt-BR">
      <JsonLd data={homeStructuredData} />
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>

      <LandingHeader commerceOpen={commerceOpen} brandVariant="els" />

      <main id="conteudo">
        <section className="els-hero" aria-labelledby="hero-title">
          <div className="els-container els-hero__grid">
            <div>
              <span className="els-eyebrow">
                <Sparkles aria-hidden="true" size={15} />
                Treino de lei seca que conversa com a sua memória
              </span>
              <h1 className="els-h1" id="hero-title">
                <span>Pare de só reconhecer.</span>
                <span>
                  Comece a <mark className="els-mark">lembrar.</mark>
                </span>
              </h1>
              <p className="els-lead">
                A Edital Lei Seca transforma artigos, prazos e exceções em rodadas de múltipla escolha que
                revelam onde a sua atenção falhou — e trazem o ponto de volta antes que você esqueça.
              </p>

              <div className="els-actions">
                <Link className="button button--amber button--large" href={primaryHref}>
                  {commerceOpen ? "Quero treinar a lei" : "Ver planos e preço"}
                  <ArrowCta />
                </Link>
                <Link className="button button--glass button--large" href={howItWorksCta.href}>
                  {howItWorksCta.label}
                </Link>
              </div>

              <ul className="els-assure" aria-label="Diferenciais do produto">
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

            <div className="els-sheet" aria-label="Exemplo de treino de literalidade">
              <div className="els-sheet__top">
                <span className="els-sheet__ref">Constituição Federal · art. 5º, LIV</span>
                <span className="els-pill">
                  <ShieldCheck aria-hidden="true" size={13} />
                  Fonte oficial
                </span>
              </div>
              <p className="els-sheet__text els-serif">
                Ninguém será privado da liberdade ou de seus{" "}
                <span className="els-blank" aria-label="lacuna">
                  bens
                </span>{" "}
                sem o devido processo legal.
              </p>
              <div className="els-sheet__options">
                {["bens", "direitos", "recursos"].map((option, index) => (
                  <a key={option} href="#laboratorio" aria-label={`Testar a alternativa ${option} no laboratório`}>
                    <b aria-hidden="true">{String.fromCharCode(65 + index)}</b>
                    {option}
                  </a>
                ))}
              </div>
              <div className="els-sheet__foot">
                <span>
                  Próxima ação: <strong>6 artigos para revisar</strong>
                </span>
                <span className="els-meter" aria-hidden="true">
                  <i />
                </span>
              </div>
            </div>
          </div>

          <div className="els-container els-features" aria-label="Recursos em destaque">
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

        <section className="els-section els-section--alt" id="metodo" aria-labelledby="method-title">
          <div className="els-container">
            <div className="els-head--center">
              <span className="els-kicker">Um ciclo que faz sentido</span>
              <h2 className="els-h2" id="method-title">
                Ler é o começo. <em>Recuperar é o que fixa.</em>
              </h2>
              <p className="els-sub">
                O método coloca direção, prática e revisão na mesma sequência. Cada sessão termina com uma
                próxima ação clara.
              </p>
            </div>

            <div className="els-grid els-grid--3">
              {METHOD_STEPS.map((step) => (
                <article className="els-card" key={step.number}>
                  <span className="els-step__num" aria-hidden="true">
                    {step.number}
                  </span>
                  <span className="els-step__eyebrow">{step.eyebrow}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <div className="els-step__detail">
                    <CheckCircle2 aria-hidden="true" size={16} />
                    {step.detail}
                  </div>
                </article>
              ))}
            </div>
            <div className="els-more">
              <Link className="button button--outline" href="/como-memorizar-lei-seca">
                Entender recuperação e revisão espaçada
                <ArrowCta />
              </Link>
            </div>
          </div>
        </section>

        <section className="els-section" id="laboratorio" aria-labelledby="lab-title">
          <div className="els-container">
            <span className="els-kicker">Laboratório de literalidade</span>
            <h2 className="els-h2" id="lab-title">
              A pegadinha aparece. <em>Você enxerga.</em>
            </h2>
            <p className="els-sub">
              Teste uma demonstração real da interação: escolha a palavra que completa a redação e veja por
              que o distrator parecia correto.
            </p>
            <LiteralLab />
          </div>
        </section>

        <section className="els-section els-section--alt" id="recursos" aria-labelledby="showcase-title">
          <div className="els-container">
            <span className="els-kicker">Uma preparação que acompanha você</span>
            <h2 className="els-h2" id="showcase-title">
              Um só progresso. <em>Três telas.</em>
            </h2>
            <p className="els-sub">
              Planeje no notebook, revise no tablet e resolva uma rodada curta no celular. A experiência se
              adapta sem perder contexto.
            </p>

            <div className="els-showcase">
              <figure className="els-frame">
                <Image
                  src="/assets/leiprova-ecosystem.png"
                  alt="Edital Lei Seca em notebook, celular e tablet com questões, texto legal e painel de desempenho"
                  width={1586}
                  height={992}
                  loading="lazy"
                  quality={80}
                  sizes="(max-width: 960px) 100vw, 720px"
                />
                <figcaption>Interface ilustrativa</figcaption>
              </figure>

              <div className="els-benefits">
                <article className="els-benefit">
                  <span className="els-icon-box">
                    <Target aria-hidden="true" size={19} />
                  </span>
                  <div>
                    <h3>Roteiro de hoje</h3>
                    <p>Abra a plataforma sabendo qual é a próxima tarefa.</p>
                  </div>
                </article>
                <article className="els-benefit">
                  <span className="els-icon-box">
                    <BrainCircuit aria-hidden="true" size={19} />
                  </span>
                  <div>
                    <h3>Fila adaptativa</h3>
                    <p>Artigos retornam conforme dificuldade e histórico de resposta.</p>
                  </div>
                </article>
                <article className="els-benefit">
                  <span className="els-icon-box">
                    <LibraryBig aria-hidden="true" size={19} />
                  </span>
                  <div>
                    <h3>Acervo organizado</h3>
                    <p>Leis, cadernos e simulados reunidos por disciplina e carreira.</p>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="els-section" aria-labelledby="xray-title">
          <div className="els-container els-split">
            <div>
              <span className="els-kicker">Raio-X de estudo</span>
              <h2 className="els-h2" id="xray-title">
                Nem todo artigo pede a <em>mesma energia.</em>
              </h2>
              <p className="els-sub">
                Cruze o perfil da banca, os tópicos do seu edital e o seu histórico de erros para decidir onde
                insistir primeiro.
              </p>
              <ul className="els-checks">
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

            <div className="els-panel" aria-label="Exemplo ilustrativo do Raio-X">
              <div className="els-panel__top">
                <div>
                  <small>Visão ilustrativa</small>
                  <h3>Prioridade por banca</h3>
                </div>
                <span className="els-pill">Acervo conectado</span>
              </div>
              <div className="els-chips" aria-label="Exemplos de bancas">
                <span className="is-active">CEBRASPE</span>
                <span>FGV</span>
                <span>FCC</span>
                <span>VUNESP</span>
              </div>
              <div className="els-bars">
                {XRAY_ROWS.map(([label, status, width]) => (
                  <div key={label}>
                    <div>
                      <strong>{label}</strong>
                      <span>{status}</span>
                    </div>
                    <span className="els-bar">
                      <i style={{ width: `${width}%` }} />
                    </span>
                  </div>
                ))}
              </div>
              <p className="els-panel__note">
                Exemplo de interface. A disponibilidade varia conforme o acervo da carreira.
              </p>
            </div>
          </div>
        </section>

        <section className="els-section els-section--alt" aria-labelledby="trust-title">
          <div className="els-container">
            <div className="els-split">
              <div>
                <span className="els-kicker">Confiança antes da decoreba</span>
                <h2 className="els-h2" id="trust-title">
                  Estude a redação sabendo <em>de onde ela veio.</em>
                </h2>
                <p className="els-sub">
                  Literalidade exige cuidado editorial. Por isso, a interface foi pensada para deixar fonte,
                  versão e contexto ao alcance — sem transformar a plataforma em parecer jurídico.
                </p>
              </div>

              <div className="els-source">
                <div className="els-source__head">
                  <span>
                    <LockKeyhole aria-hidden="true" size={16} />
                    Registro de fonte
                  </span>
                  <span className="els-pill">Identificada</span>
                </div>
                <div className="els-source__doc">
                  <span className="els-icon-box">
                    <FileCheck2 aria-hidden="true" size={20} />
                  </span>
                  <div>
                    <small>Norma</small>
                    <strong>Constituição da República Federativa do Brasil</strong>
                    <p>Artigo, referência editorial e acesso à publicação utilizada.</p>
                  </div>
                </div>
                <ol className="els-timeline">
                  <li className="is-complete">Fonte vinculada</li>
                  <li className="is-complete">Revisão editorial</li>
                  <li>Disponível para treino</li>
                </ol>
              </div>
            </div>

            <div className="els-grid els-grid--3">
              {TRUST_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <article className="els-card" key={item.title}>
                    <span className="els-icon-box">
                      <Icon aria-hidden="true" size={20} />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </article>
                );
              })}
            </div>
            <div className="els-more els-more--left">
              <Link className="button button--outline" href="/fontes-e-atualizacao">
                Ver o acervo atual e a política de fontes
                <ArrowCta />
              </Link>
            </div>
          </div>
        </section>

        <section className="els-section els-pricing" id="planos" aria-labelledby="pricing-title">
          <div className="els-container">
            <div className="els-head--center">
              <span className="els-kicker">{annualDiscountPercentage}% de desconto no anual</span>
              <h2 className="els-h2" id="pricing-title">
                Doze meses de método. <em>Um valor que cabe no mês.</em>
              </h2>
              <p className="els-sub">
                {commerceOpen
                  ? "Comece pelo anual para ter o ciclo completo de estudo por um valor equivalente a R$ 74,75 por mês. Se preferir, o plano mensal continua disponível."
                  : "Conheça primeiro o plano anual, equivalente a R$ 74,75 por mês. Esta é uma prévia: o checkout ainda não está aberto e nenhuma cobrança pode ser feita agora."}
              </p>
            </div>

            <PricingPlans commerceOpen={commerceOpen} contactOpen={contactOpen} />

            <p className="els-note">
              <LockKeyhole aria-hidden="true" size={17} />
              <span>
                {commerceOpen
                  ? "Checkout seguro. Você revisa plano, preço e condições antes de confirmar qualquer pagamento."
                  : "Valores de referência para validação. A abertura comercial depende da revisão final dos planos e documentos."}
              </span>
            </p>
          </div>
        </section>

        <section className="els-section els-section--alt" aria-labelledby="guarantee-title">
          <div className="els-container els-guarantee">
            <div className="els-seal" aria-hidden="true">
              <div>
                <strong>7</strong>
                <small>dias</small>
              </div>
            </div>
            <div>
              <span className="els-kicker">
                {commerceOpen ? "Conheça sem pressa" : "Política prevista para o lançamento"}
              </span>
              <h2 className="els-serif" id="guarantee-title">
                Sete dias para sentir se o método cabe na sua rotina.
              </h2>
              <p>
                Use o laboratório, monte seu roteiro e acompanhe as primeiras revisões. Se a experiência não
                fizer sentido para você, solicite o cancelamento e eventual reembolso dentro do prazo, conforme
                as condições apresentadas na oferta.
              </p>
            </div>
            <Link className="button button--amber" href={primaryHref}>
              {commerceOpen ? "Começar com o plano Foco" : "Ver planos e preço"}
              <ArrowCta />
            </Link>
          </div>
        </section>

        <section className="els-section" aria-labelledby="faq-title">
          <div className="els-container els-faq">
            <div>
              <span className="els-kicker">Perguntas frequentes</span>
              <h2 className="els-h2" id="faq-title">
                Antes de começar, <em>vale saber.</em>
              </h2>
              <p className="els-sub">Respostas diretas sobre conteúdo, dispositivos e formas de acesso.</p>
              <div className="els-support">
                <span className="els-icon-box">
                  <MessagesSquare aria-hidden="true" size={19} />
                </span>
                <div>
                  <strong>Ainda ficou com dúvida?</strong>
                  <p>Converse com o suporte antes de escolher um plano.</p>
                </div>
                <Link href="/contato">Falar com suporte</Link>
              </div>
            </div>

            <div className="els-faq__list">
              {FAQS.map((item, index) => (
                <details key={item.question} open={index === 0}>
                  <summary>
                    {item.question}
                    <ChevronDown aria-hidden="true" size={18} />
                  </summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="els-final" aria-labelledby="final-cta-title">
          <div className="els-container">
            <span className="els-kicker">Seu próximo artigo pode virar memória hoje</span>
            <h2 className="els-serif" id="final-cta-title">
              Leia. Escolha. Erre melhor. <span>Acerte quando valer ponto.</span>
            </h2>
            <p>
              {commerceOpen
                ? "Escolha o plano e monte seu primeiro roteiro de literalidade na Edital Lei Seca."
                : "Veja o plano, o preço e a mecânica do treino antes da abertura do checkout."}
            </p>
            <div className="els-actions">
              <Link className="button button--amber button--large" href={primaryHref}>
                {commerceOpen ? "Criar meu roteiro" : "Ver planos e preço"}
                <ArrowCta />
              </Link>
              <Link className="button button--glass button--large" href={howItWorksCta.href}>
                {howItWorksCta.label}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="els-footer">
        <div className="els-container els-footer__top">
          <div className="els-footer__brand">
            <BrandMark variant="els" />
            <p>
              Uma plataforma de treino ativo para quem precisa lembrar da redação legal quando a prova
              apertar.
            </p>
          </div>

          <div className="els-footer__links">
            <div>
              <strong>Produto</strong>
              <Link href="/como-memorizar-lei-seca">Como memorizar lei seca</Link>
              <Link href="/leis">Leis e artigos</Link>
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

        <div className="els-container els-footer__bottom">
          <p>© {new Date().getFullYear()} Edital Lei Seca. Todos os direitos reservados.</p>
          <p>
            Conteúdo meramente informativo e não oficial. A plataforma não presta consultoria jurídica nem
            substitui a publicação vigente no diário oficial.
          </p>
        </div>
      </footer>
    </div>
  );
}
