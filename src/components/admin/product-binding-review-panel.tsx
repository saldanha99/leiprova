"use client";

import { useActionState } from "react";
import { reviewBindingAction } from "@/app/admin/catalogo-produtos/[slug]/vinculos/actions";
import type { BindingAdminRow, BindingReviewState } from "@/lib/commerce/product-binding-admin";

const initial: BindingReviewState = { status: "idle", message: "" };
const inputClass = "mt-2 w-full rounded-lg border border-els-line-strong bg-els-bg px-3 py-3 text-sm text-els-fg focus-visible:outline-2 focus-visible:outline-els-amber-2";
const buttonClass = "min-h-11 rounded-lg border border-els-amber-2/40 px-4 py-3 text-sm font-semibold text-els-amber-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-els-amber-2";

export function BindingDecisionPreview({ state, pending, action }: { state: BindingReviewState; pending: boolean; action: (form: FormData) => void }) {
  const preview = state.preview;
  if (!preview) return null;
  const { dossier, selection } = preview;
  const blocked = dossier.status !== "pending_review" || (selection.decision === "approve" && !dossier.eligible);
  return <section aria-label="Dossiê para decisão humana" className="mt-6 space-y-5 border-t border-els-amber-2/25 pt-6">
    <p className="text-xs font-semibold uppercase tracking-widest text-els-amber-ink">02 · Conferência final</p>
    <p className="whitespace-pre-wrap text-base leading-7 text-els-fg">{dossier.prompt}</p>
    <ol className="space-y-3">{dossier.options.map((option) => <li key={option.key} className="rounded-lg border border-els-line p-4 text-sm leading-6">
      <p>{option.key}. {option.text} {option.correct && <strong className="text-els-green-ink"> · Gabarito registrado</strong>}</p>
      <p className="mt-2 text-els-fg-3">{option.rationale}</p>
    </li>)}</ol>
    <p className="whitespace-pre-wrap text-sm leading-7 text-els-fg-2">{dossier.explanation}</p>
    <dl className="space-y-4">{dossier.fields.map((field) => <div key={field.label}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-els-fg-3">{field.label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-els-fg-2">{field.value}</dd>
    </div>)}</dl>
    <ul className="space-y-2">{dossier.links.map((link) => <li key={link.label}><a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all text-sm text-els-green-ink underline">{link.label} ↗</a></li>)}</ul>
    {dossier.blockers.length > 0 && <div className="rounded-xl border border-els-amber/25 bg-els-amber-2/5 p-4">
      <h3 className="font-semibold text-els-amber-ink">Bloqueios de aprovação</h3>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-els-amber-ink/90">{dossier.blockers.map((message) => <li key={message}>{message}</li>)}</ul>
      <p className="mt-3 text-xs leading-6 text-els-fg-2">Rejeitar a proposta não aprova estes requisitos e não invalida a questão globalmente.</p>
    </div>}
    <form action={action} className="space-y-4 rounded-xl border border-els-line-strong p-5">
      {Object.entries(selection).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <input type="hidden" name="mode" value="apply" />
      <input type="hidden" name="fingerprint" value={preview.fingerprint} />
      <h3 className="font-serif text-xl text-els-fg">Decisão: {selection.decision === "approve" ? "aprovar vínculo" : "rejeitar vínculo"}</h3>
      <p className="whitespace-pre-wrap text-sm leading-6 text-els-fg-2">Nota que será registrada: {selection.notes}</p>
      <p className="break-all text-xs leading-5 text-els-fg-3">Dossiê SHA-256: {preview.fingerprint}</p>
      <p className="text-xs leading-6 text-els-fg-3">Alterar nota, decisão ou conteúdo exige nova prévia. Esta decisão não substitui revisão jurídica, não publica produto e não abre checkout.</p>
      {[["edition", "Conferi a identidade do produto, cargo e edição deste dossiê."],
        ["program", "Conferi o programa e as fontes apresentados."],
        ["adherence", "Examinei a aderência desta questão e assumo a decisão indicada acima."]].map(([name, label]) =>
        <label key={name} className="flex min-h-11 items-start gap-3 py-2 text-sm leading-6"><input type="checkbox" name={name} required className="mt-1 size-4 shrink-0" />{label}</label>)}
      <button type="submit" disabled={pending || blocked} className={buttonClass}>{pending ? "Conferindo…" : "Registrar decisão deste vínculo"}</button>
    </form>
  </section>;
}

export function ProductBindingReviewPanel({ productSlug, row }: { productSlug: string; row: BindingAdminRow }) {
  const [state, action, pending] = useActionState(reviewBindingAction, initial);
  return <article className="rounded-2xl border border-els-line-strong bg-els-surface-2 p-5 md:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="max-w-2xl font-serif text-xl leading-7 text-els-fg">{row.prompt}</h2><span className="rounded-full border border-els-line-strong px-3 py-1 text-xs text-els-amber-ink">{row.status}</span></div>
    <p className="mt-3 text-sm leading-6 text-els-fg-2">{row.roleName} · {row.bankName ?? "Banca pendente"} · {row.editionTitle ?? "Edição não vinculada"}</p>
    <p className="mt-2 text-xs leading-6 text-els-fg-3">Questão: {row.questionStatus} · {row.sourceLocator}</p>
    <p className="mt-2 break-all text-[11px] leading-5 text-els-fg-3">Vínculo: {row.bindingId}</p>
    {!row.productAssociated && <p className="mt-3 text-sm text-els-amber-ink">Produto ainda sem associação a esta oportunidade. Aprovação bloqueada.</p>}
    {!row.examEditionPublicId && <p className="mt-3 text-sm text-els-amber-ink">Vincule a edição oficial no motor de editais antes de revisar. Não será usada uma edição presumida.</p>}
    {row.status === "pending_review" && row.examEditionPublicId && <form action={action} className="mt-5 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-els-amber-ink">01 · Preparar decisão</p>
      <input type="hidden" name="mode" value="preview" /><input type="hidden" name="productSlug" value={productSlug} />
      <input type="hidden" name="bindingId" value={row.bindingId} /><input type="hidden" name="opportunityPublicId" value={row.opportunityPublicId} />
      <input type="hidden" name="examEditionPublicId" value={row.examEditionPublicId} />
      <label className="block text-sm text-els-fg-2">Decisão proposta<select name="decision" className={inputClass} defaultValue="approve"><option value="approve">Aprovar vínculo</option><option value="reject">Rejeitar vínculo</option></select></label>
      <label className="block text-sm text-els-fg-2">Nota de revisão — ao menos 20 caracteres<textarea name="notes" required minLength={20} maxLength={2000} rows={3} className={inputClass} /></label>
      <button disabled={pending} className={buttonClass}>Abrir dossiê e conferir decisão</button>
    </form>}
    {state.message && <p role={state.status === "error" ? "alert" : "status"} className="mt-4 text-sm leading-6 text-els-amber-ink">{state.message}</p>}
    <BindingDecisionPreview state={state} pending={pending} action={action} />
  </article>;
}
