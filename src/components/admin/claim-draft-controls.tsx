"use client";

import { useActionState } from "react";
import { Send, ShieldCheck } from "lucide-react";

import {
  claimGeneratedDraftAction,
  type EditorialActionState,
} from "@/app/admin/fabrica-autoral/actions";

const initialEditorialActionState: EditorialActionState = { status: "idle", message: "" };

export function ClaimDraftControls({ publicId }: { publicId: string }) {
  const [state, formAction, pending] = useActionState(
    claimGeneratedDraftAction,
    initialEditorialActionState,
  );

  return (
    <form action={formAction} className="mt-4 rounded-xl border border-sky-300/12 bg-sky-300/[.035] p-3">
      <input type="hidden" name="publicId" value={publicId} />
      <div className="flex items-start gap-2.5">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sky-300" />
        <div>
          <p className="text-xs font-bold text-sky-100">Assunção editorial obrigatória</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Confira enunciado, resposta e justificativa diretamente na fonte oficial antes de enviar.
          </p>
        </div>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/8 bg-black/10 p-2.5 text-[11px] leading-5 text-slate-400">
        <input
          type="checkbox"
          name="cleanRoomAttestation"
          required
          className="mt-1 size-4 shrink-0 accent-sky-300"
        />
        <span>
          Revisei este rascunho somente contra a fonte oficial, sem consultar questões de terceiros, e assumo a
          responsabilidade editorial pelo envio.
        </span>
      </label>

      {state.message ? (
        <p
          aria-live="polite"
          className={`mt-2 text-xs ${state.status === "success" ? "text-emerald-200" : "text-rose-200"}`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-sky-300 px-3 text-xs font-extrabold text-sky-950 transition hover:bg-sky-200 disabled:cursor-wait disabled:opacity-50"
      >
        <Send aria-hidden="true" className="size-3.5" />
        {pending ? "Enviando..." : "Assumir e enviar à revisão"}
      </button>
      <p className="mt-2 text-[10px] leading-4 text-slate-600">
        Você não poderá aprovar o próprio envio; a liberação exige outro administrador.
      </p>
    </form>
  );
}
