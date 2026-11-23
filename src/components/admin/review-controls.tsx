"use client";

import { useActionState } from "react";
import { Check, RotateCcw } from "lucide-react";

import {
  reviewOriginalQuestionAction,
  type EditorialActionState,
} from "@/app/admin/fabrica-autoral/actions";

const initialEditorialActionState: EditorialActionState = { status: "idle", message: "" };

/**
 * Decisão individual sobre uma questão autoral.
 *
 * `dossierFingerprint` é a impressão do dossiê exibido nesta página, calculada
 * no servidor. Ela viaja junto da decisão para que a aprovação recuse conteúdo
 * que tenha mudado depois da leitura do revisor. O componente não a calcula nem
 * a deriva: apenas devolve o que recebeu.
 */
export function ReviewControls({
  publicId,
  dossierFingerprint,
}: {
  publicId: string;
  dossierFingerprint: string;
}) {
  const [state, formAction, pending] = useActionState(
    reviewOriginalQuestionAction,
    initialEditorialActionState,
  );

  return (
    <form action={formAction} className="mt-4 rounded-xl border border-els-line bg-els-sink p-3">
      <input type="hidden" name="publicId" value={publicId} />
      <input type="hidden" name="dossierFingerprint" value={dossierFingerprint} />
      <label htmlFor={`notes-${publicId}`} className="text-xs font-semibold text-els-fg-3">
        Nota da revisão
      </label>
      <textarea
        id={`notes-${publicId}`}
        name="notes"
        maxLength={1500}
        className="mt-2 min-h-20 w-full resize-y rounded-lg border border-els-line bg-els-bg px-3 py-2 text-xs leading-5 text-els-fg-2 outline-none focus:border-els-amber/40"
        placeholder="Registre ajustes ou a justificativa da decisão. Obrigatório para reprovar."
      />
      {state.message ? (
        <p
          aria-live="polite"
          className={`mt-2 text-xs ${state.status === "success" ? "text-els-green-ink" : "text-els-danger-ink"}`}
        >
          {state.message}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-els-green px-3 text-xs font-extrabold text-els-on-amber transition hover:bg-els-green-2 disabled:opacity-50"
        >
          <Check aria-hidden="true" className="size-3.5" />
          Aprovar e liberar
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-els-danger/20 bg-els-danger/8 px-3 text-xs font-bold text-els-fg transition hover:bg-els-danger/12 disabled:opacity-50"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reprovar
        </button>
      </div>
    </form>
  );
}
