"use client";

import { useActionState } from "react";
import { Check, RefreshCcw, RotateCcw } from "lucide-react";

import {
  createExamMetadataAction,
  reviewLegalSnapshotAction,
  syncLegalSourceAction,
  verifyExamPortalAction,
  type SourceActionState,
} from "@/app/admin/fontes-oficiais/actions";

const initialState: SourceActionState = { status: "idle", message: "" };

function Feedback({ state }: { state: SourceActionState }) {
  return state.message ? <p aria-live="polite" className={`mt-2 text-xs leading-5 ${state.status === "success" ? "text-emerald-200" : "text-rose-200"}`}>{state.message}</p> : null;
}

export function LegalSyncButton({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(syncLegalSourceAction, initialState);
  return <form action={action} className="mt-3"><input type="hidden" name="slug" value={slug} /><button disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/8 px-3 text-xs font-bold text-amber-100 disabled:opacity-50"><RefreshCcw className={`size-3.5 ${pending ? "animate-spin" : ""}`} />{pending ? "Consultando…" : "Conferir agora"}</button><Feedback state={state} /></form>;
}

export function PortalVerifyButton({ portalId }: { portalId: number }) {
  const [state, action, pending] = useActionState(verifyExamPortalAction, initialState);
  return <form action={action} className="mt-3"><input type="hidden" name="portalId" value={portalId} /><button disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-sky-300/20 bg-sky-300/8 px-3 text-xs font-bold text-sky-100 disabled:opacity-50"><RefreshCcw className={`size-3.5 ${pending ? "animate-spin" : ""}`} />{pending ? "Verificando…" : "Verificar portal"}</button><Feedback state={state} /></form>;
}

export function SnapshotReviewControls({ publicId }: { publicId: string }) {
  const [state, action, pending] = useActionState(reviewLegalSnapshotAction, initialState);
  return <form action={action} className="mt-4 rounded-xl border border-white/8 bg-black/15 p-3"><input type="hidden" name="publicId" value={publicId} /><textarea name="notes" maxLength={1500} className="min-h-16 w-full resize-y rounded-lg border border-white/10 bg-[#07111d] px-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-300/40" placeholder="Nota da revisão; obrigatória ao rejeitar." /><Feedback state={state} /><div className="mt-2 flex flex-wrap gap-2"><button name="decision" value="approve" disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-300 px-3 text-xs font-extrabold text-emerald-950 disabled:opacity-50"><Check className="size-3.5" />Aprovar referência</button><button name="decision" value="reject" disabled={pending} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/8 px-3 text-xs font-bold text-rose-100 disabled:opacity-50"><RotateCcw className="size-3.5" />Rejeitar</button></div></form>;
}

export function ExamMetadataForm({ banks, careers }: { banks: readonly { bankId: number; bankName: string }[]; careers: readonly { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(createExamMetadataAction, initialState);
  const field = "min-h-11 w-full rounded-xl border border-white/10 bg-[#07111d] px-3 text-sm text-slate-200 outline-none focus:border-amber-300/40";
  return <form action={action} className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-400">Banca<select name="bankId" required className={`${field} mt-2`}><option value="">Selecione</option>{banks.map((bank) => <option key={bank.bankId} value={bank.bankId}>{bank.bankName}</option>)}</select></label><label className="text-xs font-semibold text-slate-400">Carreira<select name="careerTrackId" required className={`${field} mt-2`}><option value="">Selecione</option>{careers.map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-400 sm:col-span-2">Título oficial da prova<input name="title" required minLength={5} maxLength={220} className={`${field} mt-2`} /></label><label className="text-xs font-semibold text-slate-400">Data da prova<input type="date" name="examDate" required className={`${field} mt-2`} /></label><label className="text-xs font-semibold text-slate-400">Jurisdição<input name="jurisdiction" maxLength={120} placeholder="Federal, SP, municipal…" className={`${field} mt-2`} /></label><label className="text-xs font-semibold text-slate-400 sm:col-span-2">Link no portal oficial<input type="url" name="officialUrl" required maxLength={1000} placeholder="https://…" className={`${field} mt-2`} /></label><div className="sm:col-span-2"><button disabled={pending} className="min-h-11 rounded-xl bg-amber-300 px-5 text-sm font-extrabold text-amber-950 disabled:opacity-50">{pending ? "Validando fonte…" : "Registrar somente metadados"}</button><Feedback state={state} /></div></form>;
}
