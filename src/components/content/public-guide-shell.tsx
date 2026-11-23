import { ArrowRight, BookOpenCheck, Home } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ElsLogo } from "@/components/brand/ElsLogo";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import { ContestMegaMenu } from "@/components/contests/contest-mega-menu";
import catalogStyles from "@/components/contests/contest-catalog.module.css";
import { BRAND_NAME } from "@/lib/brand";

/** "els": sistema visual novo (redesenho ELS, opt-in por página); "classic" mantém o layout atual. */
export type GuideTone = "classic" | "els";

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
  tone = "classic",
}: {
  children: ReactNode;
  mobileActionBar?: boolean;
  tone?: GuideTone;
}) {
  const footerPadding = mobileActionBar ? " max-[680px]:pb-[calc(90px+env(safe-area-inset-bottom))]" : "";

  if (tone === "els") {
    return (
      <div className="els-ui">
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
                className="hidden min-h-11 items-center rounded-lg px-3 text-els-fg-2 hover:text-els-fg md:inline-flex"
                href="/metodologia"
              >
                Metodologia
              </Link>
              <Link
                className="hidden min-h-11 items-center rounded-lg px-3 text-els-fg-2 hover:text-els-fg sm:inline-flex"
                href="/fontes-e-atualizacao"
              >
                Fontes
              </Link>
              <Link
                className="hidden min-h-11 items-center gap-2 rounded-xl border border-els-line-strong bg-els-surface px-3 text-els-fg hover:border-els-fg sm:inline-flex"
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
                  className="inline-flex min-h-11 items-center text-els-fg-2 hover:text-els-fg hover:underline"
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
    <div className="min-h-screen bg-els-bg text-els-fg">
      <a
        href="#conteudo"
        className="fixed left-3 top-3 z-50 -translate-y-40 rounded-xl bg-els-amber px-4 py-3 text-sm font-extrabold text-els-on-amber transition-transform focus:translate-y-0"
      >
        Pular para o conteúdo
      </a>
      <header className="border-b border-els-line bg-els-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <LeiProvaMark className={catalogStyles.compactBrand} />
          <nav
            className="flex items-center gap-2 text-sm font-semibold text-els-fg-3"
            aria-label="Navegação pública"
          >
            <ContestMegaMenu />
            <Link
              className="hidden rounded-lg px-3 py-2 hover:bg-els-raise hover:text-els-fg md:inline-flex"
              href="/metodologia"
            >
              Metodologia
            </Link>
            <Link
              className="hidden rounded-lg px-3 py-2 hover:bg-els-raise hover:text-els-fg sm:inline-flex"
              href="/fontes-e-atualizacao"
            >
              Fontes
            </Link>
            <Link
              className="hidden items-center gap-2 rounded-xl border border-els-line px-3 py-2 hover:border-els-line-strong hover:text-els-fg sm:inline-flex"
              href="/"
            >
              <Home aria-hidden="true" className="size-4" />
              Início
            </Link>
          </nav>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className={`border-t border-els-line bg-els-bg${footerPadding}`}>
        <div className="mx-auto grid max-w-6xl gap-7 px-5 py-10 text-sm text-els-fg-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="flex items-center gap-2 font-semibold text-els-fg-2">
              <BookOpenCheck
                aria-hidden="true"
                className="size-4 text-els-amber"
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
              <Link key={item.href} className="hover:text-els-fg" href={item.href}>
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
  tone = "classic",
}: {
  current: string;
  parent?: { label: string; href: string };
  tone?: GuideTone;
}) {
  const light = tone === "els";
  const link = light
    ? "inline-flex min-h-11 items-center hover:text-els-fg hover:underline"
    : "hover:text-els-amber";
  return (
    <nav
      aria-label="Trilha de navegação"
      className={`flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] ${
        light ? "text-els-fg-3" : "text-els-fg-3"
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
      <span aria-current="page" className={light ? "text-els-amber" : "text-els-amber"}>
        {current}
      </span>
    </nav>
  );
}

export function GuideCta({
  title,
  description,
  tone = "classic",
}: {
  title: string;
  description: string;
  tone?: GuideTone;
}) {
  if (tone === "els") {
    return (
      <aside className="rounded-els-xl border border-els-amber/25 bg-[radial-gradient(70%_120%_at_0%_0%,oklch(0.84_0.15_78/0.12),transparent_60%)] bg-els-surface p-6 text-els-fg shadow-[var(--els-shadow)] sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-els-amber">Experimente na prática</p>
        <h2 className="mt-3 text-2xl font-bold leading-tight tracking-[-0.035em] sm:text-3xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-els-fg-2">{description}</p>
        <Link className="button button--amber mt-6" href="/demo">
          Fazer uma sessão gratuita
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </aside>
    );
  }

  return (
    <aside className="rounded-[2rem] border border-els-amber/20 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,.16),transparent_48%),#0b1624] p-6 sm:p-9">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-els-amber">
        Experimente na prática
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-els-fg-3">
        {description}
      </p>
      <Link
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-els-amber px-5 py-3 text-sm font-extrabold text-els-on-amber transition hover:bg-els-amber-2"
        href="/demo"
      >
        Fazer uma sessão gratuita
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </aside>
  );
}
