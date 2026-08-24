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
          <article key={act.id} className="grid gap-5 rounded-2xl border border-white/8 bg-[#09131f] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300"><FileCheck2 className="size-5" /></span>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-100">{act.title}</h2><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">{act.jurisdiction}</span></div>
                <p className="mt-2 text-xs text-slate-500">{act.articleCount} dispositivos no recorte • {act.questionCount} questões originais</p>
                <p className="mt-1 text-[11px] text-slate-600">Verificado em {act.verifiedAt ? new Intl.DateTimeFormat("pt-BR").format(new Date(act.verifiedAt)) : "revisão editorial"}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={act.officialUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-emerald-300/20 hover:text-white">Fonte oficial <ExternalLink className="size-3.5" /></a>
              <Link href={`/app/leis/${act.slug}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-amber-300">Estudar por artigo <ArrowRight className="size-3.5" /></Link>
            </div>
          </article>
        )) : (
          <article className="rounded-[1.75rem] border border-dashed border-white/10 bg-[#09131f] p-10 text-center">
            <LibraryBig className="mx-auto size-8 text-slate-600" />
            <h2 className="mt-4 font-semibold">Acervo em preparação</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">A Constituição Federal será o primeiro conjunto publicado após migração e verificação editorial.</p>
          </article>
        )}
      </section>
    </main>
  );
}
