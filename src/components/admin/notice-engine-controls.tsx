"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Download, FilePlus2, LoaderCircle, RotateCcw, Search, Sparkles } from "lucide-react";

import {
  captureNoticeDocumentAction,
  discoverNoticeDocumentsAction,
  extractSnapshotSyllabusAction,
  generateRequirementDraftAction,
  importSyllabusRequirementsAction,
  mapExtractedRequirementAction,
  registerNoticeSourceAction,
  reviewNoticeDocumentAction,
  reviewNoticeSourceAction,
  reviewRequirementAction,
  type NoticeEngineActionState,
} from "@/app/admin/motor-editais/actions";

const initialState: NoticeEngineActionState = { status: "idle", message: "" };
const fieldClass =
  "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-[#07111d] px-3 text-sm text-slate-200 outline-none transition focus:border-amber-300/45 focus:ring-2 focus:ring-amber-300/10";

function Feedback({ state }: { state: NoticeEngineActionState }) {
  if (!state.message) return null;
  return (
    <p
      aria-live="polite"
      className={`mt-3 text-xs leading-5 ${state.status === "success" ? "text-emerald-200" : "text-rose-200"}`}
    >
      {state.message}
    </p>
  );
}

export function NoticeSourceForm({
  opportunities,
}: {
  opportunities: readonly { publicId: string; title: string; editorialStatus: string }[];
}) {
  const [state, action, pending] = useActionState(registerNoticeSourceAction, initialState);
  return (
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-400 sm:col-span-2">
        Concurso
        <select name="opportunityPublicId" required className={fieldClass}>
          <option value="">Selecione</option>
          {opportunities.map((item) => (
            <option key={item.publicId} value={item.publicId}>
              {item.title} {item.editorialStatus === "reviewed" ? "· revisado" : "· em revisão"}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400">
        Tipo de documento
        <select name="documentType" required className={fieldClass} defaultValue="notice">
          <option value="notice">Edital</option>
          <option value="official_announcement">Comunicado oficial</option>
          <option value="organizer_contract">Contrato da organizadora</option>
          <option value="authorization">Autorização</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400">
        Data de publicação
        <input type="date" name="publishedAt" className={fieldClass} />
      </label>
      <label className="text-xs font-semibold text-slate-400 sm:col-span-2">
        Título oficial
        <input name="title" required minLength={5} maxLength={300} className={fieldClass} />
      </label>
      <label className="text-xs font-semibold text-slate-400 sm:col-span-2">
        Link no órgão ou banca oficial
        <input
          type="url"
          name="sourceUrl"
          required
          maxLength={1000}
          placeholder="https://…"
          className={fieldClass}
        />
      </label>
      <label className="text-xs font-semibold text-slate-400 sm:col-span-2">
        Identificador do documento (opcional)
        <input name="sourceExternalId" maxLength={180} placeholder="Ex.: Edital 02/2026" className={fieldClass} />
      </label>
      <div className="sm:col-span-2">
        <button
          disabled={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-extrabold text-amber-950 disabled:opacity-50"
        >
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <FilePlus2 aria-hidden="true" className="size-4" />}
          {pending ? "Verificando origem…" : "Verificar e registrar fonte"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function NoticeSourceReviewControls({ publicId }: { publicId: string }) {
  const [state, action, pending] = useActionState(reviewNoticeSourceAction, initialState);
  return (
    <form action={action} className="mt-4 rounded-xl border border-white/8 bg-black/15 p-3">
      <input type="hidden" name="publicId" value={publicId} />
      <textarea
        name="notes"
        maxLength={2000}
        className={`${fieldClass} min-h-16 resize-y py-2`}
        placeholder="Nota de revisão; obrigatória ao rejeitar."
      />
      <Feedback state={state} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          name="decision"
          value="approve"
          disabled={pending}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-300 px-3 text-xs font-extrabold text-emerald-950 disabled:opacity-50"
        >
          <Check aria-hidden="true" className="size-3.5" /> Aprovar fonte
        </button>
        <button
          name="decision"
          value="reject"
          disabled={pending}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/8 px-3 text-xs font-bold text-rose-100 disabled:opacity-50"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" /> Rejeitar
        </button>
      </div>
    </form>
  );
}

function CaptureCandidateButton({
  sourceDocumentPublicId,
  candidate,
}: {
  sourceDocumentPublicId: string;
  candidate: NonNullable<NoticeEngineActionState["candidates"]>[number];
}) {
  const [state, action, pending] = useActionState(captureNoticeDocumentAction, initialState);
  return (
    <form action={action} className="rounded-xl border border-sky-300/10 bg-sky-300/[.035] p-3">
      <input type="hidden" name="sourceDocumentPublicId" value={sourceDocumentPublicId} />
      <input type="hidden" name="documentUrl" value={candidate.url} />
      <p className="text-xs font-bold leading-5 text-slate-200">{candidate.label}</p>
      <p className="mt-1 truncate text-[10px] text-slate-600" title={candidate.url}>{candidate.url}</p>
      <button
        disabled={pending}
        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-sky-300 px-3 text-xs font-extrabold text-sky-950 disabled:opacity-50"
      >
        {pending ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <Download aria-hidden="true" className="size-3.5" />}
        {pending ? "Capturando e lendo…" : "Capturar este PDF"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function OfficialDocumentDiscoveryControls({
  sourceDocumentPublicId,
}: {
  sourceDocumentPublicId: string;
}) {
  const [state, action, pending] = useActionState(discoverNoticeDocumentsAction, initialState);
  return (
    <div className="mt-4 rounded-xl border border-sky-300/10 bg-[#07111d] p-3">
      <form action={action}>
        <input type="hidden" name="sourceDocumentPublicId" value={sourceDocumentPublicId} />
        <button
          disabled={pending}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-sky-300/20 bg-sky-300/8 px-3 text-xs font-bold text-sky-100 disabled:opacity-50"
        >
          {pending ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <Search aria-hidden="true" className="size-3.5" />}
          {pending ? "Procurando anexos…" : "Procurar PDF do edital"}
        </button>
      </form>
      <Feedback state={state} />
      {state.candidates?.length ? (
        <div className="mt-3 grid gap-2">
          {state.candidates.map((candidate) => (
            <CaptureCandidateButton
              key={candidate.url}
              sourceDocumentPublicId={sourceDocumentPublicId}
              candidate={candidate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function NoticeDocumentReviewControls({ snapshotPublicId }: { snapshotPublicId: string }) {
  const [state, action, pending] = useActionState(reviewNoticeDocumentAction, initialState);
  return (
    <form action={action} className="mt-4 rounded-xl border border-white/8 bg-black/15 p-3">
      <input type="hidden" name="snapshotPublicId" value={snapshotPublicId} />
      <textarea
        name="notes"
        maxLength={2000}
        className={`${fieldClass} min-h-16 resize-y py-2`}
        placeholder="Nota da conferência; obrigatória ao rejeitar."
      />
      <Feedback state={state} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button name="decision" value="approve" disabled={pending} className="min-h-9 rounded-lg bg-emerald-300 px-3 text-xs font-extrabold text-emerald-950 disabled:opacity-50">
          Aprovar captura
        </button>
        <button name="decision" value="reject" disabled={pending} className="min-h-9 rounded-lg border border-rose-300/20 bg-rose-300/8 px-3 text-xs font-bold text-rose-100 disabled:opacity-50">
          Rejeitar
        </button>
      </div>
    </form>
  );
}

export function ExtractSnapshotButton({ snapshotPublicId }: { snapshotPublicId: string }) {
  const [state, action, pending] = useActionState(extractSnapshotSyllabusAction, initialState);
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="snapshotPublicId" value={snapshotPublicId} />
      <button disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-300 px-4 text-xs font-extrabold text-amber-950 disabled:opacity-50">
        {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
        {pending ? "Extraindo programa…" : "Extrair conteúdo programático"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

type SourceOption = Readonly<{
  publicId: string;
  title: string;
  opportunityTitle: string;
}>;

type SubjectOption = Readonly<{ id: number; name: string }>;
type TopicOption = Readonly<{ id: number; subjectId: number; name: string }>;
type ArticleOption = Readonly<{
  id: number;
  actTitle: string;
  articleRef: string;
  heading: string | null;
}>;

export function SyllabusImportForm({
  sources,
  subjects,
  topics,
  articles,
}: {
  sources: readonly SourceOption[];
  subjects: readonly SubjectOption[];
  topics: readonly TopicOption[];
  articles: readonly ArticleOption[];
}) {
  const [state, action, pending] = useActionState(importSyllabusRequirementsAction, initialState);
  const [subjectId, setSubjectId] = useState("");
  const availableTopics = useMemo(
    () => topics.filter((topic) => String(topic.subjectId) === subjectId),
    [subjectId, topics],
  );
  return (
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-400 sm:col-span-2">
        Fonte aprovada do edital
        <select name="sourceDocumentPublicId" required className={fieldClass}>
          <option value="">Selecione</option>
          {sources.map((source) => (
            <option key={source.publicId} value={source.publicId}>
              {source.opportunityTitle} · {source.title}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400">
        Matéria
        <select
          name="subjectId"
          required
          className={fieldClass}
          value={subjectId}
          onChange={(event) => setSubjectId(event.target.value)}
        >
          <option value="">Selecione</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>{subject.name}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400">
        Assunto
        <select name="topicId" required className={fieldClass} disabled={!subjectId}>
          <option value="">Selecione</option>
          {availableTopics.map((topic) => (
            <option key={topic.id} value={topic.id}>{topic.name}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400 sm:col-span-2">
        Dispositivo legal oficial usado para elaborar
        <select name="legalArticleId" required className={fieldClass}>
          <option value="">Selecione</option>
          {articles.map((article) => (
            <option key={article.id} value={article.id}>
              {article.actTitle} · {article.articleRef}{article.heading ? ` · ${article.heading}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400 sm:col-span-2">
        Localização no edital
        <input
          name="sourceLocator"
          required
          minLength={3}
          maxLength={300}
          placeholder="Ex.: Anexo II, Direito Constitucional, p. 34"
          className={fieldClass}
        />
      </label>
      <label className="text-xs font-semibold text-slate-400 sm:col-span-2">
        Itens do conteúdo programático — um por linha
        <textarea
          name="syllabusText"
          required
          minLength={8}
          maxLength={20000}
          className={`${fieldClass} min-h-44 resize-y py-3 leading-6`}
          placeholder={"1. Direitos e garantias fundamentais\n2. Controle de constitucionalidade\n3. Organização do Estado"}
        />
      </label>
      <div className="sm:col-span-2">
        <button
          disabled={pending || !sources.length}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-300 px-5 text-sm font-extrabold text-sky-950 disabled:opacity-50"
        >
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <FilePlus2 aria-hidden="true" className="size-4" />}
          {pending ? "Separando itens…" : "Importar para revisão"}
        </button>
        {!sources.length ? <p className="mt-3 text-xs text-amber-200">Aprove ao menos uma fonte antes de importar.</p> : null}
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function RequirementMappingControls({
  requirementId,
  suggestedSubjectId,
  subjects,
  topics,
  articles,
}: {
  requirementId: number;
  suggestedSubjectId: number | null;
  subjects: readonly SubjectOption[];
  topics: readonly TopicOption[];
  articles: readonly ArticleOption[];
}) {
  const [state, action, pending] = useActionState(mapExtractedRequirementAction, initialState);
  const [subjectId, setSubjectId] = useState(suggestedSubjectId ? String(suggestedSubjectId) : "");
  const availableTopics = useMemo(
    () => topics.filter((topic) => String(topic.subjectId) === subjectId),
    [subjectId, topics],
  );
  return (
    <form action={action} className="mt-4 grid gap-3 rounded-xl border border-amber-300/10 bg-amber-300/[.025] p-3 sm:grid-cols-2">
      <input type="hidden" name="requirementId" value={requirementId} />
      <label className="text-xs font-semibold text-slate-400">
        Matéria sugerida
        <select name="subjectId" required className={fieldClass} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
          <option value="">Selecione</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400">
        Assunto
        <select name="topicId" required className={fieldClass} disabled={!subjectId}>
          <option value="">Selecione</option>
          {availableTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-slate-400 sm:col-span-2">
        Dispositivo legal oficial
        <select name="legalArticleId" required className={fieldClass}>
          <option value="">Selecione</option>
          {articles.map((article) => (
            <option key={article.id} value={article.id}>{article.actTitle} · {article.articleRef}{article.heading ? ` · ${article.heading}` : ""}</option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        <button disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-300 px-4 text-xs font-extrabold text-amber-950 disabled:opacity-50">
          {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
          {pending ? "Mapeando…" : "Enviar para revisão"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function RequirementReviewControls({ requirementId }: { requirementId: number }) {
  const [state, action, pending] = useActionState(reviewRequirementAction, initialState);
  return (
    <form action={action} className="mt-4 rounded-xl border border-white/8 bg-[#07111d] p-3">
      <input type="hidden" name="requirementId" value={requirementId} />
      <textarea
        name="notes"
        maxLength={1500}
        className={`${fieldClass} min-h-16 resize-y py-2`}
        placeholder="Nota de revisão; obrigatória ao rejeitar."
      />
      <Feedback state={state} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button name="decision" value="approve" disabled={pending} className="min-h-9 rounded-lg bg-emerald-300 px-3 text-xs font-extrabold text-emerald-950 disabled:opacity-50">
          Aprovar requisito
        </button>
        <button name="decision" value="reject" disabled={pending} className="min-h-9 rounded-lg border border-rose-300/20 bg-rose-300/8 px-3 text-xs font-bold text-rose-100 disabled:opacity-50">
          Suspender
        </button>
      </div>
    </form>
  );
}

export function GenerateRequirementButton({ requirementId }: { requirementId: number }) {
  const [state, action, pending] = useActionState(generateRequirementDraftAction, initialState);
  return (
    <form action={action} className="mt-4">
      <input type="hidden" name="requirementId" value={requirementId} />
      <button
        disabled={pending}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-300 px-4 text-xs font-extrabold text-violet-950 disabled:opacity-50"
      >
        {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
        {pending ? "Gerando…" : "Gerar rascunho inédito"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
