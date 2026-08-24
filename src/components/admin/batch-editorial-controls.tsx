"use client";

import { useActionState } from "react";
import { CheckCircle2, Files, Send, ShieldCheck, UserRoundCheck } from "lucide-react";

import {
  approveOriginalQuestionBatchAction,
  claimGeneratedDraftBatchAction,
  type EditorialActionState,
} from "@/app/admin/fabrica-autoral/actions";
import { EDITORIAL_BATCH_LIMIT } from "@/lib/editorial/clean-room";

const initialState: EditorialActionState = { status: "idle", message: "" };

function Feedback({ state }: { state: EditorialActionState }) {
  if (!state.message) return null;

  return (
    <p
      aria-live="polite"
      className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-5 ${
        state.status === "success"
          ? "border-emerald-300/15 bg-emerald-300/[.055] text-emerald-100"
          : "border-rose-300/15 bg-rose-300/[.055] text-rose-100"
      }`}
    >
      {state.message}
    </p>
  );
}

export function BatchEditorialControls({
  claimableCount,
  reviewableCount,
  ownedPendingCount,
}: {
  claimableCount: number;
  reviewableCount: number;
  ownedPendingCount: number;
}) {
  const [claimState, claimAction, claimPending] = useActionState(
    claimGeneratedDraftBatchAction,
    initialState,
  );
  const [reviewState, reviewAction, reviewPending] = useActionState(
    approveOriginalQuestionBatchAction,
    initialState,
  );
  const claimBatchSize = Math.min(claimableCount, EDITORIAL_BATCH_LIMIT);
  const reviewBatchSize = Math.min(reviewableCount, EDITORIAL_BATCH_LIMIT);

  return (
    <section
      className="mt-5 overflow-hidden rounded-[1.5rem] border border-sky-300/15 bg-[linear-gradient(135deg,rgba(56,189,248,.075),rgba(9,19,31,.98)_46%,rgba(52,211,153,.055))]"
      aria-labelledby="batch-editorial-title"
    >
      <div className="border-b border-white/8 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-sky-300">
              <Files aria-hidden="true" className="size-4" />
              Operação em lote
            </span>
            <h2 id="batch-editorial-title" className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Conferir uma vez. Processar o lote inteiro.
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Cada ação revalida fonte, formato, gabarito, originalidade e separação entre responsável e revisor.
              O lote é atômico: se um item falhar, nenhum é alterado.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
            <span className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
              {claimableCount}<small className="mt-1 block font-semibold normal-case tracking-normal">rascunhos</small>
            </span>
            <span className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5 text-amber-200">
              {ownedPendingCount}<small className="mt-1 block font-semibold normal-case tracking-normal text-slate-500">seus envios</small>
            </span>
            <span className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5 text-emerald-200">
              {reviewableCount}<small className="mt-1 block font-semibold normal-case tracking-normal text-slate-500">para revisar</small>
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-white/8 lg:grid-cols-2">
        <form action={claimAction} className="bg-[#09131f]/95 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-300/10 text-sky-300">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.11em] text-sky-300">Etapa do responsável</p>
              <h3 className="mt-1 text-base font-semibold text-white">Assumir e enviar rascunhos</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Processa até {EDITORIAL_BATCH_LIMIT} itens por lote e registra sua responsabilidade em cada um.
              </p>
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-sky-300/12 bg-sky-300/[.035] p-3 text-xs leading-5 text-slate-400">
            <input
              type="checkbox"
              name="cleanRoomAttestation"
              required
              disabled={!claimBatchSize || claimPending}
              className="mt-0.5 size-4 shrink-0 accent-sky-300"
            />
            <span>
              Conferi enunciado, resposta e justificativa dos itens do lote diretamente na fonte oficial, sem
              consultar questões de terceiros, e assumo a responsabilidade editorial pelo envio.
            </span>
          </label>

          <Feedback state={claimState} />
          <button
            type="submit"
            disabled={!claimBatchSize || claimPending}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-300 px-4 text-sm font-extrabold text-sky-950 transition hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Send aria-hidden="true" className="size-4" />
            {claimPending
              ? "Enviando lote..."
              : claimBatchSize
                ? `Assumir e enviar ${claimBatchSize} questões`
                : "Nenhum rascunho elegível"}
          </button>
        </form>

        <form action={reviewAction} className="bg-[#09131f]/95 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300">
              <UserRoundCheck aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[.11em] text-emerald-300">Etapa do revisor</p>
              <h3 className="mt-1 text-base font-semibold text-white">Aprovar todas as elegíveis</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Somente itens enviados por outra pessoa entram neste lote.
              </p>
            </div>
          </div>

          <label htmlFor="batch-review-notes" className="mt-5 block text-xs font-semibold text-slate-400">
            Nota comum do lote <span className="font-normal text-slate-600">(opcional)</span>
          </label>
          <textarea
            id="batch-review-notes"
            name="notes"
            maxLength={1500}
            disabled={!reviewBatchSize || reviewPending}
            className="mt-2 min-h-20 w-full resize-y rounded-xl border border-white/10 bg-[#07111d] px-3 py-2.5 text-xs leading-5 text-slate-200 outline-none transition focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-300/10 disabled:opacity-45"
            placeholder="Ex.: lote conferido contra as fontes oficiais indicadas nos dossiês."
          />
          <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-300/12 bg-emerald-300/[.035] p-3 text-xs leading-5 text-slate-400">
            <input
              type="checkbox"
              name="reviewAttestation"
              required
              disabled={!reviewBatchSize || reviewPending}
              className="mt-0.5 size-4 shrink-0 accent-emerald-300"
            />
            <span>
              Revisei individualmente enunciado, alternativas, gabarito, explicação e fonte oficial dos itens
              elegíveis e assumo esta decisão editorial.
            </span>
          </label>

          <Feedback state={reviewState} />
          <button
            type="submit"
            disabled={!reviewBatchSize || reviewPending}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {reviewPending
              ? "Aprovando lote..."
              : reviewBatchSize
                ? `Aprovar e liberar ${reviewBatchSize} questões`
                : "Nenhuma questão elegível"}
          </button>
        </form>
      </div>

      {ownedPendingCount > 0 && reviewableCount === 0 ? (
        <p className="border-t border-amber-300/10 bg-amber-300/[.035] px-5 py-3 text-xs leading-5 text-amber-100/75 sm:px-6">
          Seus {ownedPendingCount} envios aguardam outra pessoa. Entre com uma conta editorial diferente para
          habilitar a aprovação em lote.
        </p>
      ) : null}
    </section>
  );
}
