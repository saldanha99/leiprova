"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, Mail } from "lucide-react";

import type { AccountAccessActionState } from "@/app/actions/account-access";
import { cn } from "@/lib/utils";

type AccessAction = (
  state: AccountAccessActionState,
  formData: FormData,
) => Promise<AccountAccessActionState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 shadow-[0_14px_40px_rgba(251,191,36,.18)] transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : label}
      {!pending && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
    </button>
  );
}
function PasswordField({
  name,
  label,
  autoComplete,
  error,
}: {
  name: "password" | "passwordConfirmation";
  label: string;
  autoComplete: string;
  error?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-200">
      {label}
      <span className="relative">
        <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input
          name={name}
          type="password"
          autoComplete={autoComplete}
          placeholder="Mínimo de 10 caracteres"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          className={cn(
            "min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/70 pl-10 pr-4 text-[15px] text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/5",
            error && "border-rose-400/60 focus:border-rose-400",
          )}
        />
      </span>
      {error && <span id={`${name}-error`} className="text-xs font-normal text-rose-300">{error}</span>}
    </label>
  );
}

export function RequestAccountAccessForm({ action }: { action: AccessAction }) {
  const [state, formAction] = useActionState(action, {});

  if (state.status === "sent") {
    return (
      <div className="grid gap-5">
        <div role="status" className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.06] p-5 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-300" aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-white">Confira seu e-mail</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Se existir uma conta com esse endereço, enviaremos um link pessoal com validade de 24 horas.
          </p>
        </div>
        <Link href="/entrar" className="text-center text-sm font-semibold text-amber-300 transition hover:text-amber-200">
          Voltar para entrar
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <label className="grid gap-2 text-sm font-medium text-slate-200">
        E-mail da compra ou da conta
        <span className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            aria-invalid={Boolean(state.fieldErrors?.email)}
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
            className={cn(
              "min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/70 pl-10 pr-4 text-[15px] text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/60 focus:ring-4 focus:ring-amber-300/5",
              state.fieldErrors?.email && "border-rose-400/60 focus:border-rose-400",
            )}
          />
        </span>
        {state.fieldErrors?.email && <span id="email-error" className="text-xs font-normal text-rose-300">{state.fieldErrors.email}</span>}
      </label>
      {state.error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">{state.error}</p>}
      <SubmitButton label="Enviar link de acesso" />
      <p className="text-center text-xs leading-5 text-slate-500">
        Por segurança, a resposta é a mesma mesmo quando o endereço não está cadastrado.
      </p>
    </form>
  );
}

export function ActivateAccountAccessForm({ token, action }: { token: string; action: AccessAction }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input type="hidden" name="token" value={token} />
      <PasswordField name="password" label="Crie sua senha" autoComplete="new-password" error={state.fieldErrors?.password} />
      <PasswordField name="passwordConfirmation" label="Repita a nova senha" autoComplete="new-password" error={state.fieldErrors?.passwordConfirmation} />
      <p className="-mt-1 text-xs leading-5 text-slate-500">Use de 10 a 128 caracteres, com pelo menos uma letra e um número.</p>
      {state.error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">{state.error}</p>}
      <SubmitButton label="Criar senha e entrar" />
    </form>
  );
}
