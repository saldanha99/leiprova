import Link from "next/link";
import type { ReactNode } from "react";

import { EDITORIAL_AUTHOR_NAME, type Crumb } from "@/lib/seo/graph";
import { brDate, sourceLabel } from "@/lib/seo/legal-format";

export function Breadcrumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-xs font-bold uppercase tracking-[0.12em] text-els-fg-3">
      <ol className="flex flex-wrap items-center gap-2">
        {crumbs.map((crumb, index) => (
          <li key={crumb.path} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {index === crumbs.length - 1 ? (
              <span aria-current="page" className="text-els-amber-ink">
                {crumb.name}
              </span>
            ) : (
              <Link className="inline-flex min-h-11 items-center hover:text-els-amber-ink" href={crumb.path}>
                {crumb.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SourceSeal({
  versionSourceUrl,
  officialUrl,
  verifiedAt,
  contentChangedAt,
}: {
  versionSourceUrl: string;
  officialUrl: string;
  verifiedAt: Date;
  contentChangedAt: Date;
}) {
  return (
    <p className="mt-5 rounded-xl border border-els-line bg-els-raise px-4 py-3 text-sm leading-6 text-els-fg-2">
      Texto oficial: {sourceLabel(versionSourceUrl)} · versão verificada em{" "}
      <time dateTime={verifiedAt.toISOString()}>{brDate(verifiedAt)}</time> · última alteração do conteúdo em{" "}
      <time dateTime={contentChangedAt.toISOString()}>{brDate(contentChangedAt)}</time> ·{" "}
      <a className="inline-flex min-h-11 items-center font-semibold text-els-amber-ink underline-offset-4 hover:underline" href={officialUrl} rel="noopener">
        ver publicação no {sourceLabel(officialUrl)}
      </a>
    </p>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="mt-12" id={id}>
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-els-fg sm:text-2xl" id={`${id}-titulo`}>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export type FaqItem = Readonly<{ question: string; answer: string }>;

export function FaqBlock({ items }: { items: readonly FaqItem[] }) {
  return (
    <Section id="perguntas-frequentes" title="Perguntas frequentes">
      <dl className="space-y-5">
        {items.map((item) => (
          <div key={item.question}>
            <dt className="font-semibold text-els-fg">{item.question}</dt>
            <dd className="mt-1 text-sm leading-7 text-els-fg-3">{item.answer}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/** D3: the editorial team, with an explicit AI-use notice; no invented person. */
export function AuthorNotice({ withQuestions }: { withQuestions: boolean }) {
  return (
    <Section id="autoria" title="Autoria e revisão">
      <div className="rounded-2xl border border-els-line bg-els-raise p-5 text-sm leading-7 text-els-fg-3">
        <p>
          <strong className="text-els-fg-2">{EDITORIAL_AUTHOR_NAME}</strong>.{" "}
          {withQuestions
            ? "As questões e os comentários desta página são inéditos, produzidos com auxílio de IA a partir do texto oficial e liberados pela linha automática de validação autorizada pelo responsável pelo projeto. Essa aprovação não equivale a revisão humana independente de cada questão; itens com erro são suspensos."
            : "Os dados desta página saem do texto oficial da norma e da base de questões do Edital Lei Seca."}{" "}
          O texto da lei é reproduzido da fonte oficial indicada e não substitui o Diário Oficial nem o edital.
        </p>
        <p className="mt-3">
          <Link className="font-semibold text-els-amber-ink underline-offset-4 hover:underline" href="/metodologia">
            Como produzimos e revisamos o conteúdo
          </Link>
          {" · "}
          <Link className="font-semibold text-els-amber-ink underline-offset-4 hover:underline" href="/fontes-e-atualizacao">
            Fontes e atualização
          </Link>
        </p>
      </div>
    </Section>
  );
}

/** CTA as a plain <a> with a unique id and no target=_blank (LEI 10 tracking). */
export function TrainCta({ id, href, title, description }: { id: string; href: string; title: string; description: string }) {
  return (
    <aside className="mt-12 rounded-[2rem] border border-els-amber/20 bg-els-surface p-6 sm:p-9">
      <h2 className="text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-els-fg-3">{description}</p>
      <a
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-els-amber px-5 py-3 text-sm font-extrabold text-els-on-amber transition hover:bg-els-amber-2"
        data-cta="train"
        href={href}
        id={id}
      >
        {title}
      </a>
    </aside>
  );
}
