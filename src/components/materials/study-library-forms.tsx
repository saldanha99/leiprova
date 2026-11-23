"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { BookmarkPlus, FolderPlus, LoaderCircle, Save, Trash2 } from "lucide-react";

import {
  addQuestionToNotebookAction,
  createQuestionNotebookAction,
  saveStudyFilterAction,
  type StudyLibraryActionState,
} from "@/app/actions/study-library";
import { cn } from "@/lib/utils";

const initialState: StudyLibraryActionState = {};

type ArticleOption = {
  articleOrder: number;
  articleRef: string;
  questionCount: number;
};

export function SavedFilterForm({
  legalActSlug,
  articles,
  defaultStart,
  defaultEnd,
}: {
  legalActSlug: string;
  articles: ArticleOption[];
  defaultStart: number;
  defaultEnd: number;
}) {
  const [state, action, pending] = useActionState(saveStudyFilterAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4" aria-label="Salvar filtro de artigos">
      <input name="legalActSlug" type="hidden" value={legalActSlug} />
      <label className="grid min-w-0 gap-2 text-xs font-semibold text-els-fg-2">
        Nome do filtro
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Ex.: CF — direitos fundamentais"
          className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-els-line bg-els-bg/45 px-3 text-sm text-els-fg outline-none placeholder:text-els-fg-4 focus:border-els-amber/50 focus:ring-4 focus:ring-els-amber/5"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <ArticleSelect label="Do artigo" name="articleStartOrder" articles={articles} defaultValue={defaultStart} />
        <ArticleSelect label="Até o artigo" name="articleEndOrder" articles={articles} defaultValue={defaultEnd} />
      </div>
      {state.message && (
        <p className={cn("text-xs", state.status === "success" ? "text-els-green-ink" : "text-els-danger-ink")} role="status">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-els-amber px-4 text-sm font-bold text-els-on-amber transition hover:bg-els-amber disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
        Salvar este recorte
      </button>
    </form>
  );
}

function ArticleSelect({
  label,
  name,
  articles,
  defaultValue,
}: {
  label: string;
  name: string;
  articles: ArticleOption[];
  defaultValue: number;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-xs font-semibold text-els-fg-2">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-els-line bg-els-bg/45 px-3 text-sm text-els-fg outline-none focus:border-els-amber/50 focus:ring-4 focus:ring-els-amber/5"
      >
        {articles.map((article) => (
          <option key={article.articleOrder} value={article.articleOrder}>
            {article.articleRef} · {article.questionCount} {article.questionCount === 1 ? "questão" : "questões"}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NotebookCreateForm() {
  const [state, action, pending] = useActionState(createQuestionNotebookAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <label className="grid min-w-0 gap-2 text-xs font-semibold text-els-fg-2">
        Nome do caderno
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Ex.: Prazos que eu confundo"
          className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-els-line bg-els-bg/45 px-3 text-sm text-els-fg outline-none placeholder:text-els-fg-4 focus:border-els-info/50 focus:ring-4 focus:ring-els-info/5"
        />
      </label>
      <label className="grid min-w-0 gap-2 text-xs font-semibold text-els-fg-2">
        Descrição <span className="font-normal text-els-fg-4">opcional</span>
        <input
          name="description"
          maxLength={240}
          placeholder="O que você quer reforçar neste caderno?"
          className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-els-line bg-els-bg/45 px-3 text-sm text-els-fg outline-none placeholder:text-els-fg-4 focus:border-els-info/50 focus:ring-4 focus:ring-els-info/5"
        />
      </label>
      {state.message && (
        <p className={cn("text-xs", state.status === "success" ? "text-els-green-ink" : "text-els-danger-ink")} role="status">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-els-info px-4 text-sm font-bold text-els-on-amber transition hover:bg-els-info disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <FolderPlus className="size-4" />}
        Criar caderno
      </button>
    </form>
  );
}

export function NotebookPicker({
  questionPublicId,
  notebooks,
}: {
  questionPublicId: string;
  notebooks: Array<{ publicId: string; name: string; questionCount: number }>;
}) {
  const [state, action, pending] = useActionState(addQuestionToNotebookAction, initialState);

  if (!notebooks.length) {
    return (
      <Link href="/app/materiais#meus-cadernos" className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-els-info-ink">
        <FolderPlus className="size-3.5" /> Criar meu primeiro caderno
      </Link>
    );
  }

  return (
    <form action={action} className="rounded-xl border border-els-info/10 bg-els-info/[.035] p-3">
      <input name="questionPublicId" type="hidden" value={questionPublicId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={`notebook-${questionPublicId}`}>Escolher caderno</label>
        <select
          id={`notebook-${questionPublicId}`}
          name="notebookPublicId"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-els-line bg-els-bg/55 px-3 text-xs text-els-fg outline-none focus:border-els-info/50"
        >
          {notebooks.map((notebook) => (
            <option key={notebook.publicId} value={notebook.publicId}>
              {notebook.name} · {notebook.questionCount}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-els-info/20 bg-els-info/10 px-3 text-xs font-bold text-els-info-ink transition hover:bg-els-info/15 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <BookmarkPlus className="size-3.5" />}
          Guardar
        </button>
      </div>
      {state.message && (
        <p className={cn("mt-2 text-[11px]", state.status === "success" ? "text-els-green-ink" : "text-els-danger-ink")} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ConfirmDeleteButton({
  label,
  message,
}: {
  label: string;
  message: string;
}) {
  return (
    <button
      type="submit"
      aria-label={label}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className="grid size-9 place-items-center rounded-lg text-els-fg-4 transition hover:bg-els-danger/8 hover:text-els-danger-ink"
    >
      <Trash2 className="size-3.5" aria-hidden="true" />
    </button>
  );
}
