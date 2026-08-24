"use client";

import { useActionState } from "react";
import { Check, RotateCcw } from "lucide-react";

import {
  reviewOriginalQuestionAction,
  type EditorialActionState,
} from "@/app/admin/fabrica-autoral/actions";

const initialEditorialActionState: EditorialActionState = { status: "idle", message: "" };

export function ReviewControls({ publicId }: { publicId: string }) {
  const [state, formAction, pending] = useActionState(
    reviewOriginalQuestionAction,
    initialEditorialActionState,
  );

  return (
    <form action={formAction} className="mt-4 rounded-xl border border-white/8 bg-black/15 p-3">
      <input type="hidden" name="publicId" value={publicId} />
      <label htmlFor={`notes-${publicId}`} className="text-xs font-semibold text-slate-400">
        Nota da revisão
      </label>
      <textarea
        id={`notes-${publicId}`}
        name="notes"
        maxLength={1500}
        className="mt-2 min-h-20 w-full resize-y rounded-lg border border-white/10 bg-[#07111d] px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-amber-300/40"
        placeholder="Registre ajustes ou a justificativa da decisão. Obrigatório para reprovar."
      />
      {state.message ? (
        <p
          aria-live="polite"
          className={`mt-2 text-xs ${state.status === "success" ? "text-emerald-200" : "text-rose-200"}`}
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
          className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-300 px-3 text-xs font-extrabold text-emerald-950 transition hover:bg-emerald-200 disabled:opacity-50"
        >
          <Check aria-hidden="true" className="size-3.5" />
          Aprovar e liberar
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/8 px-3 text-xs font-bold text-rose-100 transition hover:bg-rose-300/12 disabled:opacity-50"
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Reprovar
        </button>
      </div>
    </form>
  );
}
