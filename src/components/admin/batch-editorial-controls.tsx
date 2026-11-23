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
          ? "border-els-green/15 bg-els-green/[.055] text-els-green-ink"
          : "border-els-danger/15 bg-els-danger/[.055] text-els-fg"
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
export function BatchClaimControls({
  claimableCount,
  opportunitySlug,
}: {
  claimableCount: number;
  opportunitySlug?: string;
}) {
  const [state, action, pending] = useActionState(claimGeneratedDraftBatchAction, initialState);

  if (claimableCount <= 0) return null;

  return (
    <section
      className="mt-5 overflow-hidden rounded-[1.5rem] border border-els-info/15 bg-els-surface/95"
      aria-labelledby="batch-claim-title"
    >
      <form action={action} className="p-5 sm:p-6">
        {opportunitySlug ? <input type="hidden" name="opportunitySlug" value={opportunitySlug} /> : null}
        <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-els-info-ink">
          <Files aria-hidden="true" className="size-4" />
          Enviar rascunhos à revisão
        </span>
        <h2 id="batch-claim-title" className="mt-2 text-lg font-semibold text-els-fg">
          {claimableCount} {claimableCount === 1 ? "rascunho disponível" : "rascunhos disponíveis"}
        </h2>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-els-line bg-els-sink p-3.5">
          <input
            type="checkbox"
            name="cleanRoomAttestation"
            value="on"
            required
            className="mt-0.5 size-5 shrink-0 accent-els-info"
          />
          <span className="text-xs leading-5 text-els-fg-2">
            Confiro que estes rascunhos nasceram apenas da fonte oficial indicada e do perfil editorial abstrato,
            sem consultar questão de terceiros.
          </span>
        </label>

        <Feedback state={state} />
        <button
          type="submit"
          disabled={pending}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-els-info px-4 text-sm font-extrabold text-els-on-amber transition hover:bg-els-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-els-info disabled:cursor-not-allowed disabled:opacity-45"
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
      className="mt-5 rounded-[1.5rem] border border-els-green/15 bg-els-surface/95 p-5 sm:p-6"
      aria-labelledby="batch-approval-title"
    >
      <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.14em] text-els-green-ink">
        <UserRoundCheck aria-hidden="true" className="size-4" />
        Aprovar o que você conferiu
      </span>
      <h2 id="batch-approval-title" className="mt-2 text-lg font-semibold text-els-fg">
        Publicar as questões marcadas na fila
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-els-fg-3">
        {reviewableCount > 0
          ? `Há ${reviewableCount} ${reviewableCount === 1 ? "questão pendente" : "questões pendentes"}. Abra o dossiê de cada uma, confira enunciado, alternativas, gabarito, justificativas e fonte, e marque “Conferi este item”. Só os itens marcados são aprovados.`
          : "Nenhuma questão pendente de revisão no momento."}
      </p>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-els-line bg-els-sink p-3.5">
        <input
          type="checkbox"
          name="reviewAttestation"
          value="on"
          required
          disabled={reviewableCount <= 0}
          className="mt-0.5 size-5 shrink-0 accent-els-green"
        />
        <span className="text-xs leading-5 text-els-fg-2">
          Declaro que revisei pessoalmente cada item marcado acima, conferindo o texto contra a fonte oficial, e
          respondo pela publicação.
        </span>
      </label>

      <label className="mt-3 block">
        <span className="text-[11px] font-bold uppercase tracking-[.1em] text-els-fg-3">
          Nota da revisão (opcional)
        </span>
        <textarea
          name="notes"
          rows={2}
          maxLength={1500}
          disabled={reviewableCount <= 0}
          className="mt-1.5 w-full rounded-xl border border-els-line bg-els-sink p-3 text-xs leading-5 text-els-fg-2 outline-none focus-visible:ring-2 focus-visible:ring-els-green/50"
        />
      </label>

      <Feedback state={state} />
      <button
        type="submit"
        disabled={pending || reviewableCount <= 0}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-els-green px-4 text-sm font-extrabold text-els-on-amber transition hover:bg-els-green-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-els-green-2 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <CheckCircle2 aria-hidden="true" className="size-4" />
        {pending ? "Publicando..." : "Aprovar as questões marcadas"}
      </button>
    </form>
  );
}
