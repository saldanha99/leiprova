"use client";

import { useActionState, useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";

import {
  submitPrivacyRequestAction,
  type PrivacyRequestState,
} from "@/app/actions/privacy";
import { PRIVACY_REQUEST_TYPES } from "@/lib/privacy-request-core";

const fieldClass =
  "min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/55 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/10";

export function PrivacyRequestForm() {
  const [state, action, pending] = useActionState<PrivacyRequestState, FormData>(
    submitPrivacyRequestAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "recorded") formRef.current?.reset();
  }, [state.protocol, state.status]);

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#09131f] shadow-[0_24px_70px_rgba(0,0,0,.24)]">
      <div className="border-b border-white/8 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-amber-300/10 text-amber-300">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-white">Exerça seus direitos de privacidade</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">
              O pedido fica registrado e você recebe um protocolo por e-mail.
            </p>
          </div>
        </div>
      </div>

      <form ref={formRef} action={action} className="grid gap-5 px-5 py-6 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            Nome completo
            <input
              name="name"
              autoComplete="name"
              required
              maxLength={80}
              className={fieldClass}
              placeholder="Seu nome"
              aria-invalid={Boolean(state.fieldErrors?.name)}
            />
            {state.fieldErrors?.name && (
              <span className="text-xs font-normal text-rose-300">{state.fieldErrors.name}</span>
            )}
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-300">
            E-mail para confirmação
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className={fieldClass}
              placeholder="voce@exemplo.com"
              aria-invalid={Boolean(state.fieldErrors?.email)}
            />
            {state.fieldErrors?.email && (
              <span className="text-xs font-normal text-rose-300">{state.fieldErrors.email}</span>
            )}
          </label>
        </div>

        <label className="grid gap-2 text-sm font-semibold text-slate-300">
          Direito que deseja exercer
          <select
            name="requestType"
            required
            defaultValue=""
            className={fieldClass}
            aria-invalid={Boolean(state.fieldErrors?.requestType)}
          >
            <option value="" disabled>
              Selecione uma opção
            </option>
            {PRIVACY_REQUEST_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.requestType && (
            <span className="text-xs font-normal text-rose-300">
              {state.fieldErrors.requestType}
            </span>
          )}
        </label>

        <label className="grid gap-2 text-sm font-semibold text-slate-300">
          Detalhes da solicitação
          <textarea
            name="details"
            rows={5}
            required
            minLength={10}
            maxLength={2_000}
            className={`${fieldClass} py-3`}
            placeholder="Explique o que você precisa para que possamos localizar e atender o pedido."
            aria-invalid={Boolean(state.fieldErrors?.details)}
          />
          {state.fieldErrors?.details && (
            <span className="text-xs font-normal text-rose-300">{state.fieldErrors.details}</span>
          )}
        </label>

        <label className="sr-only" aria-hidden="true">
          Empresa
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>

        <p className="text-xs leading-5 text-slate-500">
          Não envie senhas, documentos completos ou dados bancários. Se precisarmos confirmar sua
          identidade, pediremos apenas o mínimo necessário em uma etapa segura.
        </p>

        {state.error && (
          <p
            role="alert"
            className="rounded-xl border border-rose-300/15 bg-rose-300/6 px-4 py-3 text-sm text-rose-200"
          >
            {state.error}
          </p>
        )}

        {state.status === "recorded" && state.protocol && (
          <div
            role="status"
            aria-live="polite"
            className="flex gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/6 px-4 py-4 text-sm text-emerald-100"
          >
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-300" aria-hidden="true" />
            <div>
              <p className="font-semibold">Solicitação registrada.</p>
              <p className="mt-1 leading-6 text-emerald-100/75">
                Protocolo <strong className="text-emerald-100">{state.protocol}</strong>.{" "}
                {state.emailStatus === "sent"
                  ? "A confirmação foi enviada ao e-mail informado."
                  : "Guarde este protocolo; o registro foi concluído mesmo sem a confirmação por e-mail."}
              </p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60 sm:justify-self-start"
        >
          {pending ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Registrando...
            </>
          ) : (
            <>
              Enviar solicitação
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
