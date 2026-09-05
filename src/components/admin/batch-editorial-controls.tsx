"use client";

import { useActionState } from "react";
import { CheckCircle2, Files, Send, UserRoundCheck } from "lucide-react";

import {
  approveOriginalQuestionBatchAction,
  claimGeneratedDraftBatchAction,
  type EditorialActionState,
} from "@/app/admin/fabrica-autoral/actions";

const initialState: EditorialActionState = { status: "idle", message: "" };

/** Id compartilhado: as caixas de cada dossiê se ligam a este formulário pelo
 * atributo `form`, sem aninhar `<form>` dentro dos cards da fila. É o que
 * permite ter uma única interface de aprovação em vez de duas divergentes. */
export const BATCH_APPROVAL_FORM_ID = "batch-approval-form";

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

/**
 * Envio em lote para revisão.
 *
 * A atestação deixou de ser um campo oculto com valor fixo: quem envia precisa
 * marcar a caixa.
 */
export function BatchClaimControls({ claimableCount }: { claimableCount: number }) {
  const [state, action, pending] = useActionState(claimGeneratedDraftBatchAction, initialState);

  if (claimableCount <= 0) return null;

  return (
    <section
      className="mt-5 overflow-hidden rounded-[1.5rem] border border-sky-300/15 bg-[#09131f]/95"
      aria-labelledby="batch-claim-title"
    >
      <form action={action} className="p-5 sm:p-6">
        <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-sky-300">
          <Files aria-hidden="true" className="size-4" />
          Enviar rascunhos à revisão
        </span>
        <h2 id="batch-claim-title" className="mt-2 text-lg font-semibold text-white">
          {claimableCount} {claimableCount === 1 ? "rascunho disponível" : "rascunhos disponíveis"}
        </h2>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3.5">
          <input
            type="checkbox"
            name="cleanRoomAttestation"
            value="on"
            required
            className="mt-0.5 size-5 shrink-0 accent-sky-300"
          />
          <span className="text-xs leading-5 text-slate-300">
            Confiro que estes rascunhos nasceram apenas da fonte oficial indicada e do perfil editorial abstrato,
            sem consultar questão de terceiros.
          </span>
        </label>

        <Feedback state={state} />
        <button
          type="submit"
          disabled={pending}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-300 px-4 text-sm font-extrabold text-sky-950 transition hover:bg-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Send aria-hidden="true" className="size-4" />
          {pending ? "Enviando..." : `Enviar ${claimableCount} à revisão`}
        </button>
      </form>
    </section>
  );
}

/**
 * Aprovação em lote.
 *
 * O botão não aprova mais "os pendentes" de forma cega. O servidor recebe
 * exatamente os itens marcados na fila, cada um acompanhado da impressão digital
 * do dossiê exibido, e recusa qualquer divergência.
 */
export function BatchApprovalControls({ reviewableCount }: { reviewableCount: number }) {
  const [state, action, pending] = useActionState(approveOriginalQuestionBatchAction, initialState);

  return (
    <form
      id={BATCH_APPROVAL_FORM_ID}
      action={action}
      className="mt-5 rounded-[1.5rem] border border-emerald-300/15 bg-[#09131f]/95 p-5 sm:p-6"
      aria-labelledby="batch-approval-title"
    >
      <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-emerald-300">
        <UserRoundCheck aria-hidden="true" className="size-4" />
        Aprovar o que você conferiu
      </span>
      <h2 id="batch-approval-title" className="mt-2 text-lg font-semibold text-white">
        Publicar as questões marcadas na fila
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        {reviewableCount > 0
          ? `Há ${reviewableCount} ${reviewableCount === 1 ? "questão pendente" : "questões pendentes"}. Abra o dossiê de cada uma, confira enunciado, alternativas, gabarito, justificativas e fonte, e marque “Conferi este item”. Só os itens marcados são aprovados.`
          : "Nenhuma questão pendente de revisão no momento."}
      </p>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3.5">
        <input
          type="checkbox"
          name="reviewAttestation"
          value="on"
          required
          disabled={reviewableCount <= 0}
          className="mt-0.5 size-5 shrink-0 accent-emerald-300"
        />
        <span className="text-xs leading-5 text-slate-300">
          Declaro que revisei pessoalmente cada item marcado acima, conferindo o texto contra a fonte oficial, e
          respondo pela publicação.
        </span>
      </label>

      <label className="mt-3 block">
        <span className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">
          Nota da revisão (opcional)
        </span>
        <textarea
          name="notes"
          rows={2}
          maxLength={1500}
          disabled={reviewableCount <= 0}
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50"
        />
      </label>

      <Feedback state={state} />
      <button
        type="submit"
        disabled={pending || reviewableCount <= 0}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <CheckCircle2 aria-hidden="true" className="size-4" />
        {pending ? "Publicando..." : "Aprovar as questões marcadas"}
      </button>
    </form>
  );
}
