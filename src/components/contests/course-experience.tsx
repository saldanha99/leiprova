import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  Fingerprint,
  Layers3,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Target,
} from "lucide-react";
import { CONTEST_ACCESS_OPTIONS } from "@/lib/commerce/catalog";
import { formatBRL } from "@/lib/plans";
import { ContestProductTour } from "./contest-product-tour";
import base from "./contest-landing.module.css";
import styles from "./course-experience.module.css";

export function CourseHero({
  acronym,
  role,
  category,
  categorySlug,
  location,
  edition,
  available = false,
}: {
  acronym: string;
  role: string;
  category: string;
  categorySlug: string;
  location: string;
  edition: string;
  available?: boolean;
}) {
  return (
    <section className={styles.hero} aria-labelledby="concurso-title">
      <div className={base.container}>
        <nav className={styles.breadcrumb} aria-label="Navegação estrutural">
          <Link href="/concursos">Concursos</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <Link href={`/concursos#catalogo-${categorySlug}`}>{category}</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <span aria-current="page">{acronym}</span>
        </nav>
        <div className={styles.heroGrid}>
          <div className={styles.copy}>
            <p className={styles.kicker}>
              <span /> LEI SECA, COM DIREÇÃO{" "}
              <span className={styles.edition}>{edition}</span>
            </p>
            <h1 id="concurso-title">
              {acronym}
              <span>{role}</span>
            </h1>
            <p className={styles.headline}>
              O seu objetivo é grande.
              <br />
              <em>O próximo passo é claro.</em>
            </p>
            <p className={styles.lead}>
              Da leitura do artigo à revisão do que você errou. Uma experiência
              de estudo para transformar a lei seca em uma rotina com sentido.
            </p>
            <div className={styles.heroActions}>
              <a
                href="#planos"
                className={`${base.button} ${base.buttonPrimary}`}
              >
                Explorar meu acesso{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
              <a href="#por-dentro" className={base.textButton}>
                Ver por dentro <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
            <div className={styles.heroOffer}>
              <span>ACESSO INDIVIDUAL {available ? "" : "PREVISTO"}</span>
              <strong>
                A partir de {formatBRL(CONTEST_ACCESS_OPTIONS[0].amountCents)}
              </strong>
              <small>Pagamento único · sem renovação automática</small>
            </div>
            <p className={styles.availability}>
              <ShieldCheck size={15} aria-hidden="true" />
              {available
                ? "Conteúdo desta edição liberado. Confira o escopo da oferta."
                : "Em preparação editorial · vendas ainda não abertas"}
            </p>
          </div>
          <CourseArtwork
            acronym={acronym}
            role={role}
            category={category}
            location={location}
          />
        </div>
      </div>
    </section>
  );
}

function CourseArtwork({
  acronym,
  role,
  category,
  location,
}: {
  acronym: string;
  role: string;
  category: string;
  location: string;
}) {
  return (
    <figure className={styles.artwork}>
      <div className={styles.artGlow} aria-hidden="true" />
      <div className={styles.editionCard}>
        <Image
          src="/assets/contests/editorial-study-v2.webp"
          alt="Livro aberto e materiais de estudo, com luz natural sobre as páginas."
          fill
          sizes="(max-width: 680px) 85vw, 380px"
          loading="eager"
          fetchPriority="high"
          className={styles.artPhoto}
        />
        <div className={styles.cardOverlay} />
        <div className={styles.bookTop}>
          <span>
            edita<b>lume</b>
          </span>
          <ArrowUpRight size={23} aria-hidden="true" />
        </div>
        <div className={styles.bookTitle}>
          <span>{category}</span>
          <strong>{acronym}</strong>
          <p>{role}</p>
          <i />
        </div>
        <div className={styles.bookFoot}>
          <span>LEITURA. PRÁTICA. REVISÃO.</span>
          <span>
            UMA NOVA FORMA
            <br />
            DE ESTUDAR A LEI.
          </span>
        </div>
      </div>
      <div
        className={styles.studyCard}
        aria-label="Representação ilustrativa do ciclo de estudo"
      >
        <div className={styles.studyCardTop}>
          <span className={styles.studyIcon}>
            <BookOpen size={17} aria-hidden="true" />
          </span>
          <span>
            Seu espaço de estudo<small>Prévia ilustrativa</small>
          </span>
          <span className={styles.studyDot} />
        </div>
        <p>
          Um artigo.
          <br />
          <strong>Três formas de aprender.</strong>
        </p>
        <div className={styles.studySteps}>
          {[
            { Icon: BookOpen, text: "Leia com intenção" },
            { Icon: Target, text: "Teste sua memória" },
            { Icon: RotateCcw, text: "Retome o essencial" },
          ].map(({ Icon, text }, i) => (
            <div key={text}>
              <Icon size={14} aria-hidden="true" />
              <span>{text}</span>
              <small>0{i + 1}</small>
            </div>
          ))}
        </div>
        <div className={styles.studyEnd}>
          <Smartphone size={14} aria-hidden="true" /> Seu ritmo. Na sua tela.
        </div>
      </div>
      <div className={styles.location}>
        <MapPin size={14} aria-hidden="true" />
        {location}
      </div>
      <figcaption className={styles.artCaption}>
        Composição ilustrativa do produto digital. Imagem ilustrativa criada com
        IA.
      </figcaption>
    </figure>
  );
}

export function CourseNavigation() {
  return (
    <nav className={styles.navigation} aria-label="Nesta página">
      <div className={base.container}>
        <span>EXPLORE A EXPERIÊNCIA</span>
        <a href="#beneficios">O método</a>
        <a href="#por-dentro">Por dentro</a>
        <a href="#edicao">Esta edição</a>
        <a href="#planos">Seu acesso</a>
        <a href="#duvidas">Dúvidas</a>
      </div>
    </nav>
  );
}

export function CourseMethod() {
  return (
    <section
      id="beneficios"
      className={styles.method}
      aria-labelledby="metodo-title"
    >
      <div className={base.container}>
        <div className={styles.methodHeading}>
          <div>
            <span className={styles.label}>
              01 / UM MÉTODO, NÃO UMA PILHA DE PDFs
            </span>
            <h2 id="metodo-title">
              Menos leitura no automático.
              <br />
              <em>Mais intenção em cada artigo.</em>
            </h2>
          </div>
          <p>
            Não basta chegar à última página. O estudo ganha continuidade quando
            leitura, prática e revisão conversam entre si.
          </p>
        </div>
        <div className={styles.methodCards}>
          <div className={styles.methodCard}>
            <div className={styles.stepHead}>
              <span>01</span>
              <BookOpen size={25} aria-hidden="true" />
            </div>
            <div className={styles.readingVisual} aria-hidden="true">
              <span>LEITURA ATIVA</span>
              <i />
              <i />
              <div>
                <mark>Prazo</mark>
                <mark>Competência</mark>
              </div>
              <i />
              <i />
              <div>
                <mark>Exceção</mark>
              </div>
            </div>
            <h3>
              Leia o que importa.
              <br />
              Perceba o detalhe.
            </h3>
            <p>
              Uma palavra pode mudar uma resposta. Estude o dispositivo com
              atenção e consulte sua fonte.
            </p>
            <span className={styles.methodTag}>
              DA LEI À COMPREENSÃO <ArrowRight size={15} aria-hidden="true" />
            </span>
          </div>
          <div className={styles.methodCard}>
            <div className={styles.stepHead}>
              <span>02</span>
              <Target size={25} aria-hidden="true" />
            </div>
            <div className={styles.practiceVisual} aria-hidden="true">
              <span>TREINO DE MEMÓRIA</span>
              <div>
                <i>A</i> Ler sem se testar
              </div>
              <div>
                <i>B</i> Praticar e entender <Check size={15} />
              </div>
              <small>O feedback mostra o próximo passo.</small>
            </div>
            <h3>
              Responda com intenção.
              <br />
              Entenda sua resposta.
            </h3>
            <p>
              Questões autorais, explicações e referência legal. O erro vira um
              ponto de estudo, não só uma nota.
            </p>
            <span className={styles.methodTag}>
              DA COMPREENSÃO À PRÁTICA{" "}
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </div>
          <div className={styles.methodCard}>
            <div className={styles.stepHead}>
              <span>03</span>
              <RotateCcw size={25} aria-hidden="true" />
            </div>
            <div className={styles.reviewVisual} aria-hidden="true">
              <span>O CICLO CONTINUA</span>
              <div>
                <i>
                  <BookOpen size={20} />
                </i>
                <b />
                <i>
                  <Target size={20} />
                </i>
                <b />
                <i>
                  <RotateCcw size={20} />
                </i>
              </div>
              <small>
                Leitura <span>Prática</span> Revisão
              </small>
              <p>Retome. Reforce. Siga em frente.</p>
            </div>
            <h3>
              Volte ao ponto certo.
              <br />
              Dê tempo à memória.
            </h3>
            <p>
              A fila de revisão e o histórico ajudam a retomar os dispositivos
              que ainda precisam de atenção.
            </p>
            <span className={styles.methodTag}>
              DA PRÁTICA À CONSTÂNCIA{" "}
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </div>
        </div>
        <p className={styles.methodNote}>
          Representações visuais do método. Um método de estudo, não uma
          promessa de aprovação. Conteúdo por edição sujeito à revisão
          editorial.
        </p>
      </div>
    </section>
  );
}

export function CourseTourSection() {
  return (
    <section
      id="por-dentro"
      className={styles.tourSection}
      aria-labelledby="tour-title"
    >
      <div className={base.container}>
        <div className={styles.tourHeading}>
          <span className={styles.label}>
            02 / ENTRE. EXPLORE. IMAGINE SUA ROTINA.
          </span>
          <h2 id="tour-title">
            O seu estudo merece
            <br />
            <em>um lugar assim.</em>
          </h2>
          <p>
            Troque as visões, experimente os formatos e descubra como leitura,
            revisões e progresso se encontram.
          </p>
        </div>
        <ContestProductTour />
        <div className={styles.tourFoot}>
          <span>
            <Smartphone size={18} aria-hidden="true" /> Computador, tablet ou
            celular. Acesso pelo navegador.
          </span>
          <Link href="/entrar">
            Já é aluno? Acesse seu espaço{" "}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function CoursePrinciples() {
  return (
    <section className={styles.principles} aria-labelledby="principles-title">
      <div className={`${base.container} ${styles.principlesGrid}`}>
        <div>
          <span className={styles.label}>NÃO É SOBRE ACUMULAR MATERIAL</span>
          <h2 id="principles-title">
            É sobre saber
            <br />
            <em>como continuar.</em>
          </h2>
          <p>
            Uma experiência pensada para dar clareza ao estudo, com
            responsabilidade sobre o que é oferecido.
          </p>
          <Link href="/metodologia" className={base.textButton}>
            Conheça nossa metodologia{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className={styles.principlesList}>
          {[
            {
              Icon: Fingerprint,
              title: "Autoria, não reprodução",
              text: "Questões próprias. Sem copiar o banco de questões de outros cursos.",
            },
            {
              Icon: ShieldCheck,
              title: "A lei como referência",
              text: "Fontes oficiais e revisão editorial antes da liberação do conteúdo.",
            },
            {
              Icon: Layers3,
              title: "Cada edição tem seu espaço",
              text: "Órgão, cargo e programa tratados separadamente. Seu acesso tem um escopo claro.",
            },
            {
              Icon: CheckCheck,
              title: "Uma escolha consciente",
              text: "Preço, prazo e adicionais explícitos. Nada pago entra sem a sua escolha.",
            },
          ].map(({ Icon, title, text }) => (
            <div key={title}>
              <Icon size={23} aria-hidden="true" />
              <span>
                <h3>{title}</h3>
                <p>{text}</p>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
