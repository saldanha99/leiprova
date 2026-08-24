import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, BookOpenCheck, Layers3 } from "lucide-react";

import { removeQuestionFromNotebookAction } from "@/app/actions/study-library";
import { ConfirmDeleteButton } from "@/components/materials/study-library-forms";
import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { getQuestionNotebook } from "@/lib/db/legal-library";
import { getStudyEntitlement } from "@/lib/study/entitlement";

export default async function QuestionNotebookPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const user = await requireUser(`/app/materiais/cadernos/${publicId}`);
  const entitlement = await getStudyEntitlement(user.id);
  const notebook = await getQuestionNotebook(user.id, publicId, entitlement);
  if (!notebook) notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <Link href="/app/materiais#meus-cadernos" className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 transition hover:text-white">
        <ArrowLeft className="size-3.5" /> Meus cadernos
      </Link>
      <PageHeader
        eyebrow="Caderno pessoal"
        title={notebook.name}
        description={notebook.description || "Questões escolhidas por você para recuperação ativa."}
        icon={Bookmark}
      />

      <section className="mt-8 rounded-[1.75rem] border border-white/8 bg-[#09131f] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-sky-300">Conteúdo disponível</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">{notebook.items.length} {notebook.items.length === 1 ? "questão guardada" : "questões guardadas"}</h2>
            <p className="mt-2 text-xs text-slate-600">Itens indisponíveis para seu nível atual de acesso não são carregados.</p>
          </div>
          <Link
            href={`/app/treinar?caderno=${notebook.publicId}&ordem=sequencial`}
            aria-disabled={!notebook.items.length}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold ${notebook.items.length ? "bg-sky-300 text-slate-950 hover:bg-sky-200" : "pointer-events-none bg-white/5 text-slate-600"}`}
          >
            Treinar caderno <ArrowRight className="size-4" />
          </Link>
        </div>

        {notebook.items.length ? (
          <div className="mt-6 grid gap-3">
            {notebook.items.map((item) => (
              <article key={item.questionPublicId} className="rounded-2xl border border-white/7 bg-slate-950/25 p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-300/10 text-sky-300"><BookOpenCheck className="size-4.5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full bg-amber-300/10 px-2 py-0.5 font-bold text-amber-200">{item.articleRef}</span>
                      <span className="text-slate-600">{item.actTitle}</span>
                      <span className="text-slate-700">dificuldade {item.difficulty}/5</span>
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-slate-200">{item.topic}</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.prompt}</p>
                  </div>
                  <form action={removeQuestionFromNotebookAction} className="shrink-0">
                    <input name="notebookPublicId" type="hidden" value={notebook.publicId} />
                    <input name="questionPublicId" type="hidden" value={item.questionPublicId} />
                    <ConfirmDeleteButton
                      label={`Remover questão sobre ${item.topic}`}
                      message="Remover esta questão do caderno?"
                    />
                  </form>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-10 text-center">
            <Layers3 className="mx-auto size-8 text-slate-600" />
            <h2 className="mt-4 font-semibold">Este caderno ainda está vazio</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Durante um treino, use “Guardar” na correção para adicionar a questão aqui.</p>
            <Link href="/app/treinar" className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white">Começar um treino <ArrowRight className="size-3.5" /></Link>
          </div>
        )}
      </section>
    </main>
  );
}
