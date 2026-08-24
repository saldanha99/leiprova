"use client";

import { useActionState } from "react";
import { CheckCircle2, Files, Send, UserRoundCheck } from "lucide-react";

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
  const hasAction = claimBatchSize > 0 || reviewBatchSize > 0;

  return (
    <section
      className="mt-5 overflow-hidden rounded-[1.5rem] border border-sky-300/15 bg-[linear-gradient(135deg,rgba(56,189,248,.075),rgba(9,19,31,.98)_46%,rgba(52,211,153,.055))]"
      aria-labelledby="batch-editorial-title"
    >
      <div className="border-b border-white/8 p-5 sm:p-6">
        <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-sky-300">
          <Files aria-hidden="true" className="size-4" />
          Publicação rápida em lote
        </span>
        <h2 id="batch-editorial-title" className="mt-2 text-xl font-semibold text-white sm:text-2xl">
          Uma confirmação. O restante é automático.
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          A plataforma verifica fonte, formato, gabarito, originalidade, permissões e auditoria antes de concluir
          cada lote.
        </p>
      </div>

      {hasAction ? (
        <div className={`grid gap-px bg-white/8 ${claimBatchSize && reviewBatchSize ? "lg:grid-cols-2" : ""}`}>
          {claimBatchSize ? (
            <form action={claimAction} className="bg-[#09131f]/95 p-5 sm:p-6">
              <input type="hidden" name="cleanRoomAttestation" value="on" />
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-300/10 text-sky-300">
                  <Send aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[.11em] text-sky-300">Enviar</p>
                  <h3 className="mt-1 text-base font-semibold text-white">
                    Mandar {claimBatchSize} questões para revisão
                  </h3>
                  <p id="quick-claim-confirmation" className="mt-1 text-xs leading-5 text-slate-500">
                    Ao clicar, você confirma a conferência do lote com base nas fontes oficiais indicadas.
                  </p>
                </div>
              </div>

              <Feedback state={claimState} />
              <button
                type="submit"
                aria-describedby="quick-claim-confirmation"
                disabled={claimPending}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-300 px-4 text-sm font-extrabold text-sky-950 transition hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Send aria-hidden="true" className="size-4" />
                {claimPending ? "Enviando lote..." : `Confirmar e enviar ${claimBatchSize}`}
              </button>
            </form>
          ) : null}

          {reviewBatchSize ? (
            <form action={reviewAction} className="bg-[#09131f]/95 p-5 sm:p-6">
              <input type="hidden" name="reviewAttestation" value="on" />
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300">
                  <UserRoundCheck aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[.11em] text-emerald-300">Publicar</p>
                  <h3 className="mt-1 text-base font-semibold text-white">
                    Liberar {reviewBatchSize} questões no catálogo
                  </h3>
                  <p id="quick-review-confirmation" className="mt-1 text-xs leading-5 text-slate-500">
                    Ao clicar, você confirma a revisão humana dos itens enviados por outra pessoa.
                  </p>
                </div>
              </div>

              <Feedback state={reviewState} />
              <button
                type="submit"
                aria-describedby="quick-review-confirmation"
                disabled={reviewPending}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <CheckCircle2 aria-hidden="true" className="size-4" />
                {reviewPending ? "Publicando lote..." : `Confirmar e publicar ${reviewBatchSize}`}
              </button>
            </form>
          ) : null}
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-[#09131f]/95 p-5 sm:p-6">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-300/10 text-emerald-300">
            <CheckCircle2 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-white">
              {ownedPendingCount ? `${ownedPendingCount} questões já foram enviadas` : "Nenhuma ação pendente"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {ownedPendingCount
                ? "Agora basta entrar com a outra conta editorial e clicar uma vez para publicar o lote."
                : "Os lotes disponíveis aparecerão aqui com uma única ação."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
