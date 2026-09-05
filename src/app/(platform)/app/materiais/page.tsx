import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  BookOpenText,
  CheckCircle2,
  FileText,
  Layers3,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { deleteQuestionNotebookAction } from "@/app/actions/study-library";
import { FlashcardDeck } from "@/components/materials/flashcard-deck";
import {
  ConfirmDeleteButton,
  NotebookCreateForm,
} from "@/components/materials/study-library-forms";
import { PageHeader } from "@/components/platform/page-header";
import { requireUser } from "@/lib/auth";
import { getMaterialsSnapshot } from "@/lib/db/materials";
import { listQuestionNotebooks } from "@/lib/db/legal-library";
import { FREE_STUDY_QUESTION_IDS } from "@/lib/study/access-policy";
import { getStudyEntitlement } from "@/lib/study/entitlement";

export const metadata: Metadata = {
  title: "Materiais",
  description:
    "Caderno de erros, flashcards e treinos temáticos conectados ao acervo verificado.",
};

export default async function MaterialsPage() {
  const user = await requireUser("/app/materiais");
  const entitlement = await getStudyEntitlement(user.id);
  const [{ recentErrors, flashcards, notebooks }, personalNotebooks] =
    await Promise.all([
      getMaterialsSnapshot(user.id, entitlement),
      listQuestionNotebooks(user.id),
    ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-9 lg:py-10">
      <PageHeader
        eyebrow="Biblioteca ativa"
        title="Materiais"
        description="Ferramentas de recuperação construídas com seus resultados e com a literalidade vinculada à fonte oficial."
        icon={BookOpenText}
      />

      <section className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/8 bg-[#09131f] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl ${entitlement.hasFullAccess ? "bg-emerald-300/10 text-emerald-300" : "bg-amber-300/10 text-amber-300"}`}
          >
            {entitlement.hasFullAccess ? (
              <ShieldCheck className="size-5" />
            ) : (
              <LockKeyhole className="size-5" />
            )}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-200">
              {entitlement.hasFullAccess
                ? "Biblioteca completa liberada"
                : "Biblioteca essencial"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {entitlement.hasFullAccess
                ? "Os materiais abaixo usam todo o acervo atualmente publicado."
                : entitlement.questionPublicIds?.length
                  ? "Os materiais abaixo respeitam os concursos comprados e o acesso gratuito da sua conta."
                  : `Os materiais abaixo usam somente as ${FREE_STUDY_QUESTION_IDS.length} questões do acesso gratuito; nenhuma literalidade premium é carregada nesta página.`}
            </p>
          </div>
        </div>
        {!entitlement.hasFullAccess && (
          <Link
            href="/app/assinatura"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/8 px-4 text-xs font-bold text-amber-200"
          >
            Ver planos <ArrowRight className="size-3.5" />
          </Link>
        )}
      </section>

      <section
        id="meus-cadernos"
        className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"
      >
        <article className="rounded-[1.75rem] border border-sky-300/12 bg-[radial-gradient(circle_at_top_right,rgba(125,211,252,.07),transparent_38%),#09131f] p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-sky-300">
                <Bookmark className="size-4" />
                Meus cadernos
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">
                Guarde as questões que merecem voltar
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Crie recortes pessoais para prazos, exceções ou qualquer padrão
                que você queira reforçar.
              </p>
            </div>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-500">
              {personalNotebooks.length}/30 cadernos
            </span>
          </div>

          {personalNotebooks.length ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {personalNotebooks.map((notebook) => (
                <article
                  key={notebook.id}
                  className="flex min-h-48 flex-col rounded-2xl border border-white/8 bg-slate-950/30 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-sky-300/10 text-sky-300">
                      <Bookmark className="size-4.5" />
                    </span>
                    <form action={deleteQuestionNotebookAction}>
                      <input
                        name="notebookId"
                        type="hidden"
                        value={notebook.id}
                      />
                      <ConfirmDeleteButton
                        label={`Excluir caderno ${notebook.name}`}
                        message={`Excluir o caderno “${notebook.name}” e suas associações?`}
                      />
                    </form>
                  </div>
                  <Link
                    href={`/app/materiais/cadernos/${notebook.publicId}`}
                    className="mt-4 font-semibold text-slate-100 transition hover:text-sky-200"
                  >
                    {notebook.name}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                    {notebook.description ||
                      "Caderno pessoal de recuperação ativa."}
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                    <span className="text-[11px] text-slate-600">
                      {notebook.questionCount}{" "}
                      {notebook.questionCount === 1 ? "questão" : "questões"}
                    </span>
                    <Link
                      href={`/app/materiais/cadernos/${notebook.publicId}`}
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-sky-300 px-3 text-xs font-bold text-slate-950"
                    >
                      Abrir <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center">
              <Bookmark className="mx-auto size-7 text-slate-600" />
              <h3 className="mt-3 text-sm font-semibold text-slate-300">
                Crie seu primeiro caderno
              </h3>
              <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-600">
                Depois, você poderá guardar uma questão diretamente na correção
                do treino.
              </p>
            </div>
          )}
        </article>

        <aside className="rounded-[1.5rem] border border-white/8 bg-[#09131f] p-5">
          <h2 className="font-semibold">Novo caderno</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Use nomes objetivos para encontrar o recorte rapidamente.
          </p>
          <div className="mt-5">
            <NotebookCreateForm />
          </div>
        </aside>
      </section>

      <section className="mt-5 rounded-[1.75rem] border border-white/8 bg-[#09131f] p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-rose-300">
              <AlertCircle className="size-4" />
              Caderno de erros
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">
              Últimos pontos que pediram reforço
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Cada questão aparece uma vez, pela ocorrência errada mais recente.
              Acertos posteriores não apagam o histórico.
            </p>
          </div>
          {recentErrors.length > 0 && (
            <Link
              href="/app/treinar?modo=revisao"
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-slate-950"
            >
              Abrir revisões <RotateCcw className="size-3.5" />
            </Link>
          )}
        </div>

        {recentErrors.length ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {recentErrors.map((error) => (
              <article
                key={error.publicId}
                className="rounded-2xl border border-white/7 bg-slate-950/30 p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded-full bg-rose-300/8 px-2.5 py-1 font-bold text-rose-200">
                    {error.articleRef}
                  </span>
                  <span className="text-slate-600">{error.actTitle}</span>
                  <time
                    dateTime={error.answeredAt.toISOString()}
                    className="ml-auto text-slate-600"
                  >
                    {formatErrorDate(error.answeredAt)}
                  </time>
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-6 text-slate-200">
                  {error.topic}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                  {error.prompt}
                </p>
                <Link
                  href={`/app/treinar?tema=${encodeURIComponent(error.topic)}`}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-amber-300"
                >
                  Revisar este tema <ArrowRight className="size-3.5" />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-950/20 p-8 text-center">
            <CheckCircle2 className="mx-auto size-7 text-emerald-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-200">
              Seu caderno ainda está vazio
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">
              Ao errar uma questão em um treino, ela entra aqui automaticamente
              com artigo, tema e data.
            </p>
            <Link
              href="/app/treinar"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-semibold text-white"
            >
              Começar um treino <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-[1.75rem] border border-white/8 bg-[#09131f] p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300">
            <Layers3 className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-300">
              Flashcards autorais
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-.03em]">
              Tente lembrar antes de revelar
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              O comando de recuperação é original da Editalume; a resposta
              reproduz o dispositivo oficial verificado e oferece acesso à
              fonte.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <FlashcardDeck cards={flashcards} />
        </div>
      </section>

      <section className="mt-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-sky-300">
            <FileText className="size-4" />
            Cadernos temáticos
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">
            Treinos recortados por assunto
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            As contagens refletem apenas questões publicadas e liberadas para
            sua conta.
          </p>
        </div>

        {notebooks.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {notebooks.map((notebook) => (
              <article
                key={notebook.topic}
                className="flex min-h-56 flex-col rounded-2xl border border-white/8 bg-[#09131f] p-5 transition hover:-translate-y-0.5 hover:border-sky-300/20"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-sky-300/8 text-sky-300">
                  <FileText className="size-4.5" />
                </span>
                <h3 className="mt-5 font-semibold leading-6 text-slate-100">
                  {notebook.topic}
                </h3>
                <p className="mt-2 text-xs text-slate-500">
                  {notebook.questionCount}{" "}
                  {notebook.questionCount === 1
                    ? "questão original"
                    : "questões originais"}{" "}
                  • {notebook.articleCount}{" "}
                  {notebook.articleCount === 1 ? "dispositivo" : "dispositivos"}
                </p>
                <Link
                  href={`/app/treinar?tema=${encodeURIComponent(notebook.topic)}`}
                  className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.025] px-4 text-xs font-semibold text-white transition hover:border-sky-300/20"
                >
                  Treinar caderno <ArrowRight className="size-3.5" />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-[#09131f] p-8 text-center">
            <FileText className="mx-auto size-7 text-slate-600" />
            <p className="mt-3 text-sm text-slate-500">
              Nenhum caderno foi publicado para o seu nível de acesso.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function formatErrorDate(date: Date) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return `erro em ${formatter.format(date)}`;
}
