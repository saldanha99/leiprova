import { ArrowRight, BookOpenCheck, Home } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ElsLogo } from "@/components/brand/ElsLogo";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import { ContestMegaMenu } from "@/components/contests/contest-mega-menu";
import catalogStyles from "@/components/contests/contest-catalog.module.css";
import { BRAND_NAME } from "@/lib/brand";
import { elsFontVariables } from "@/lib/els-fonts";

/** "light": tema claro do redesenho (opt-in por página); "dark" mantém o visual atual. */
export type GuideTone = "dark" | "light";

const FOOTER_LINKS = [
  { href: "/concursos", label: "Concursos" },
  { href: "/leis", label: "Leis" },
  { href: "/metodologia", label: "Metodologia" },
  { href: "/demo", label: "Demonstração" },
  { href: "/fontes-e-atualizacao", label: "Fontes" },
  { href: "/termos", label: "Termos" },
  { href: "/privacidade", label: "Privacidade" },
] as const;

export function PublicGuideShell({
  children,
  mobileActionBar = false,
  tone = "dark",
}: {
  children: ReactNode;
  mobileActionBar?: boolean;
  tone?: GuideTone;
}) {
  const footerPadding = mobileActionBar ? " max-[680px]:pb-[calc(90px+env(safe-area-inset-bottom))]" : "";

  if (tone === "light") {
    return (
      <div className={`els-light ${elsFontVariables}`}>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <header className="landing-header">
          <div className="landing-header__inner mx-auto flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex items-center" aria-label={`${BRAND_NAME} — página inicial`}>
              <ElsLogo />
            </Link>
            <nav className="flex items-center gap-1 text-sm font-semibold" aria-label="Navegação pública">
              <ContestMegaMenu />
              <Link
                className="hidden min-h-11 items-center rounded-lg px-3 text-[var(--ink-2)] hover:text-[var(--ink)] md:inline-flex"
                href="/metodologia"
              >
                Metodologia
              </Link>
              <Link
                className="hidden min-h-11 items-center rounded-lg px-3 text-[var(--ink-2)] hover:text-[var(--ink)] sm:inline-flex"
                href="/fontes-e-atualizacao"
              >
                Fontes
              </Link>
              <Link
                className="hidden min-h-11 items-center gap-2 rounded-xl border border-[var(--line-2)] bg-white px-3 text-[var(--ink)] hover:border-[var(--ink)] sm:inline-flex"
                href="/"
              >
                <Home aria-hidden="true" className="size-4" />
                Início
              </Link>
            </nav>
          </div>
        </header>
        <main id="conteudo">{children}</main>
        <footer className={`els-footer${footerPadding}`}>
          <div className="els-container grid gap-7 py-10 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <ElsLogo />
              <p className="mt-3 max-w-xl leading-6">
                Conteúdo meramente informativo e não oficial. Consulte a publicação vigente no diário oficial e o
                edital do seu concurso.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 font-semibold">
              {FOOTER_LINKS.map((item) => (
                <Link
                  key={item.href}
                  className="inline-flex min-h-11 items-center text-[var(--ink-2)] hover:text-[var(--ink)] hover:underline"
                  href={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060b13] text-slate-100">
      <a
        href="#conteudo"
        className="fixed left-3 top-3 z-50 -translate-y-40 rounded-xl bg-amber-300 px-4 py-3 text-sm font-extrabold text-slate-950 transition-transform focus:translate-y-0"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b border-white/8 bg-[#07101b]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <LeiProvaMark className={catalogStyles.compactBrand} />
          <nav
            className="flex items-center gap-2 text-sm font-semibold text-slate-400"
            aria-label="Navegação pública"
          >
            <ContestMegaMenu />
            <Link
              className="hidden rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white md:inline-flex"
              href="/metodologia"
            >
              Metodologia
            </Link>
            <Link
              className="hidden rounded-lg px-3 py-2 hover:bg-white/5 hover:text-white sm:inline-flex"
              href="/fontes-e-atualizacao"
            >
              Fontes
            </Link>
            <Link
              className="hidden items-center gap-2 rounded-xl border border-white/10 px-3 py-2 hover:border-white/20 hover:text-white sm:inline-flex"
              href="/"
            >
              <Home aria-hidden="true" className="size-4" />
              Início
            </Link>
          </nav>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className={`border-t border-white/8 bg-[#050a11]${footerPadding}`}>
        <div className="mx-auto grid max-w-6xl gap-7 px-5 py-10 text-sm text-slate-500 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="flex items-center gap-2 font-semibold text-slate-300">
              <BookOpenCheck
                aria-hidden="true"
                className="size-4 text-amber-300"
              />
              Edital Lei Seca
            </p>
            <p className="mt-2 max-w-xl leading-6">
              Conteúdo meramente informativo e não oficial. Consulte a
              publicação vigente no diário oficial e o edital do seu concurso.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
            {FOOTER_LINKS.map((item) => (
              <Link key={item.href} className="hover:text-white" href={item.href}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

export function GuideBreadcrumbs({
  current,
  parent,
  tone = "dark",
}: {
  current: string;
  parent?: { label: string; href: string };
  tone?: GuideTone;
}) {
  const light = tone === "light";
  const link = light
    ? "inline-flex min-h-11 items-center hover:text-[var(--ink)] hover:underline"
    : "hover:text-amber-300";
  return (
    <nav
      aria-label="Trilha de navegação"
      className={`flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] ${
        light ? "text-[var(--ink-3)]" : "text-slate-500"
      }`}
    >
      <Link className={link} href="/">
        Início
      </Link>
      <span aria-hidden="true">/</span>
      {parent ? (
        <>
          <Link className={link} href={parent.href}>
            {parent.label}
          </Link>
          <span aria-hidden="true">/</span>
        </>
      ) : null}
      <span aria-current="page" className={light ? "text-[var(--amber-ink)]" : "text-amber-300"}>
        {current}
      </span>
    </nav>
  );
}

export function GuideCta({
  title,
  description,
  tone = "dark",
}: {
  title: string;
  description: string;
  tone?: GuideTone;
}) {
  if (tone === "light") {
    return (
      <aside className="rounded-[1.5rem] bg-[var(--ink)] p-6 text-white sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#f6c15f]">Experimente na prática</p>
        <h2 className="els-serif mt-3 text-2xl font-semibold leading-tight sm:text-3xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#c9d2df]">{description}</p>
        <Link className="button button--amber mt-6" href="/demo">
          Fazer uma sessão gratuita
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </aside>
    );
  }

  return (
    <aside className="rounded-[2rem] border border-amber-300/20 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,.16),transparent_48%),#0b1624] p-6 sm:p-9">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-300">
        Experimente na prática
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
        {description}
      </p>
      <Link
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-amber-200"
        href="/demo"
      >
        Fazer uma sessão gratuita
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </aside>
  );
}
