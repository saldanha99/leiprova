import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, RotateCcw, Target } from "lucide-react";
import { type CatalogContest, contestTitle } from "@/lib/commerce/catalog";
import { contestCategories } from "@/lib/opportunities/categories";
import { getOpportunityJurisdictionByCode } from "@/lib/opportunities/jurisdictions";
import { ContestProductTour } from "./contest-product-tour";
import { ContestPricing } from "./contest-pricing";
import styles from "./contest-catalog.module.css";

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
  return (
    <article>
      <section className="relative overflow-hidden border-b border-white/10 bg-[radial-gradient(ellipse_at_top_left,#12392f80,transparent_55%)]">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <nav
              aria-label="Navegação estrutural"
              className="mb-8 text-xs text-slate-400"
            >
              <Link href="/concursos">Concursos</Link>
              <span aria-hidden="true"> / </span>
              <Link href={`/concursos#catalogo-${contest.categorySlug}`}>
                {category?.name}
              </Link>
            </nav>
            <span className="inline-block max-w-full rounded-2xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[10px] font-extrabold uppercase leading-5 tracking-widest text-amber-200">
              Em preparação · vendas ainda não abertas
            </span>
            <h1 className="mt-8 text-5xl font-semibold tracking-[-.055em] sm:text-6xl">
              {contest.acronym}
              <span className="mt-3 block font-serif text-3xl font-normal italic leading-tight text-[#e6d2a5] sm:text-4xl">
                Seu próximo capítulo começa na lei.
              </span>
            </h1>
            <p className="mt-6 text-xl text-slate-200">{contest.role}</p>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-400">
              Uma proposta de preparação dedicada a este objetivo: conectar
              leitura, questões autorais e revisões em uma rotina de estudo que
              acompanha você.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#planos"
                className={`${styles.offerPrimary} inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#dfbf7b] px-6 py-3 text-sm font-extrabold`}
              >
                Ver proposta de acesso
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a
                href="#por-dentro"
                className="inline-flex min-h-12 items-center rounded-xl border border-white/15 px-6 py-3 text-sm font-bold"
              >
                Conheça por dentro
              </a>
            </div>
            <p className="mt-6 text-xs leading-6 text-slate-500">
              {contest.jurisdictionCodes
                .map(
                  (code) =>
                    getOpportunityJurisdictionByCode(code)?.name ?? code,
                )
                .join(" · ")}
              <br />
              Recorte observado no catálogo de referência:{" "}
              {contest.editionLabel}. Datas e banca não estão confirmadas nesta
              página.
            </p>
          </div>
          <figure className="relative overflow-hidden rounded-[2rem] border border-white/15">
            <Image
              src="/assets/contests/study-ritual.webp"
              alt="Uma rotina concentrada de estudo de lei seca"
              width={1536}
              height={1024}
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
              className="aspect-[4/5] w-full object-cover"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#030914] to-transparent px-6 pb-6 pt-16 text-xs leading-6 text-slate-200">
              Constância para construir o seu próximo passo.
              <br />
              <span className="text-[10px] text-slate-400">
                Imagem ilustrativa criada com IA.
              </span>
            </figcaption>
          </figure>
        </div>
      </section>
      <section className="bg-[#f1eee5] px-5 py-16 text-[#14251f]">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#527064]">
            MÉTODO, NÃO APENAS MATERIAL
          </p>
          <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-tight">
            Ler é o começo.
            <br />
            <span className="font-serif font-normal italic">
              Lembrar é o objetivo.
            </span>
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: BookOpenCheck,
                title: "Leia com direção",
                text: "Uma proposta de organização da legislação pertinente à edição, respeitando o recorte que for validado editorialmente.",
              },
              {
                icon: Target,
                title: "Pratique de forma ativa",
                text: "Questões autorais com explicações ajudam a transformar a leitura dos dispositivos em treino de memória.",
              },
              {
                icon: RotateCcw,
                title: "Volte ao que precisa",
                text: "Revisões e progresso para concentrar sua rotina nos assuntos que merecem mais atenção.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="border-t border-[#1a3a2725] pt-6">
                <Icon size={25} aria-hidden="true" />
                <h3 className="mt-5 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#4b6256]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <ContestProductTour />
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="rounded-2xl border border-amber-200/20 bg-amber-200/5 p-6">
          <h2 className="text-xl font-semibold text-amber-100">
            O que está pronto — e o que ainda falta
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
            Esta é uma página de planejamento comercial, não um edital oficial
            nem um curso disponível. Antes da venda, precisamos vincular a
            edição à fonte oficial, conferir o programa e liberar conteúdo
            próprio revisado. Não há cobrança, promessa de quantidade de
            questões ou de cobertura integral nesta etapa.
          </p>
        </div>
      </section>
      <ContestPricing
        contestName={contestTitle(contest)}
        productSlug={contest.slug}
        commerceOpen={commerceOpen}
        contactOpen={contactOpen}
      />
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-3xl font-semibold tracking-tight">
          Antes do seu próximo passo.
        </h2>
        <div className="mt-7 space-y-3">
          {[
            [
              "Este concurso já está à venda?",
              "Não. Esta oferta está em preparação. Os valores representam a configuração comercial prevista; a compra só será aberta após validação editorial e operacional.",
            ],
            [
              "Um produto inclui outros concursos?",
              "Não. O avulso vale somente para o concurso identificado na oferta e pelo período escolhido. Para ter acesso aos concursos liberados durante a assinatura, escolha o Master.",
            ],
            [
              "Posso usar no celular?",
              "Sim, a experiência da plataforma foi desenhada para navegador em celular, tablet e computador. O tour é ilustrativo, com dados fictícios; não representa material já liberado desta edição.",
            ],
            [
              "Como funcionam as ofertas adicionais?",
              "A escolha de um prazo maior ou de outro concurso deve ser explícita. Nenhum adicional pago será incluído automaticamente. O total e o prazo devem aparecer antes da confirmação.",
            ],
          ].map(([title, text]) => (
            <details
              key={title}
              className="rounded-xl border border-white/10 p-5"
            >
              <summary className="cursor-pointer text-sm font-bold">
                {title}
              </summary>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400">
                {text}
              </p>
            </details>
          ))}
        </div>
      </section>
    </article>
  );
}
