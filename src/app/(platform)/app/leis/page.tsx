import Link from "next/link";
import { ArrowRight, ExternalLink, FileCheck2, LibraryBig } from "lucide-react";

import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { listLegalLibrary } from "@/lib/db/queries";
import { getStudyEntitlement } from "@/lib/study/entitlement";

export default async function LawsPage() {
  const user = await requireUser("/app/leis");
  const entitlement = await getStudyEntitlement(user.id);
  const acts = await listLegalLibrary(entitlement);

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <PageHeader eyebrow="Acervo rastreável" title="Leis e normas" description="Literalidade vinculada à fonte oficial, versão verificada e questões originais associadas a cada dispositivo." icon={LibraryBig} />

      <section className="mt-8 grid gap-4">
        {acts.length ? acts.map((act) => (
          <article key={act.id} className="grid gap-5 rounded-2xl border border-els-line bg-els-surface p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-els-green/10 text-els-green-ink"><FileCheck2 className="size-5" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-els-fg">{act.title}</h2><span className="rounded-full bg-els-raise px-2 py-0.5 text-[10px] uppercase tracking-wider text-els-fg-3">{act.jurisdiction}</span></div>
                <p className="mt-2 text-xs text-els-fg-3">{act.articleCount} dispositivos no recorte • {act.questionCount} questões originais</p>
                <p className="mt-1 text-[11px] text-els-fg-4">Verificado em {act.verifiedAt ? new Intl.DateTimeFormat("pt-BR").format(new Date(act.verifiedAt)) : "revisão editorial"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={act.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-els-line px-4 py-2.5 text-xs font-semibold text-els-fg-2 transition hover:border-els-green/20 hover:text-els-fg min-h-11">Fonte oficial <ExternalLink className="size-3.5" /></a>
              <Link href={`/app/leis/${act.slug}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-els-amber px-4 py-2.5 text-xs font-bold text-els-on-amber transition hover:bg-els-amber min-h-11">Estudar por artigo <ArrowRight className="size-3.5" /></Link>
            </div>
          </article>
        )) : (
          <article className="rounded-[1.75rem] border border-dashed border-els-line bg-els-surface p-10 text-center">
            <LibraryBig className="mx-auto size-8 text-els-fg-4" />
            <h2 className="mt-4 font-semibold">Acervo em preparação</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-els-fg-3">A Constituição Federal será o primeiro conjunto publicado após migração e verificação editorial.</p>
          </article>
        )}
      </section>
    </main>
  );
}
