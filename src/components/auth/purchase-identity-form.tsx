"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle, Mail, UserRound } from "lucide-react";

import type { AuthActionState } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

type PurchaseAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group mt-1 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 shadow-[0_14px_40px_rgba(251,191,36,.18)] transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : "Continuar para o pagamento"}
      {!pending && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
    </button>
  );
}

function IdentityField({
  name,
  label,
  type = "text",
  autoComplete,
  placeholder,
  error,
  icon: Icon,
}: {
  name: "name" | "email";
  label: string;
  type?: string;
  autoComplete: string;
  placeholder: string;
  error?: string;
  icon: typeof UserRound;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-200">
      {label}
      <span className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
        <input
          name={name}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
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

export function PurchaseIdentityForm({
  action,
  planSlug,
}: {
  action: PurchaseAction;
  planSlug: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input type="hidden" name="planSlug" value={planSlug} />
      <IdentityField name="name" label="Seu nome" autoComplete="name" placeholder="Como podemos chamar você?" error={state.fieldErrors?.name} icon={UserRound} />
      <IdentityField name="email" label="E-mail para receber o acesso" type="email" autoComplete="email" placeholder="voce@exemplo.com" error={state.fieldErrors?.email} icon={Mail} />
      <label className="flex items-start gap-3 text-xs leading-5 text-slate-400">
        <input type="checkbox" name="terms" className="mt-1 size-4 rounded border-white/20 bg-slate-950 accent-amber-400" />
        <span>
          Li e aceito os <Link href="/termos" className="text-slate-200 underline">Termos de Uso</Link> e a{" "}
          <Link href="/privacidade" className="text-slate-200 underline">Política de Privacidade</Link>.
          {state.fieldErrors?.terms && <span className="mt-1 block text-rose-300">{state.fieldErrors.terms}</span>}
        </span>
      </label>
      {state.error && <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm text-rose-200">{state.error}</p>}
      <SubmitButton />
      <p className="text-center text-sm text-slate-500">
        Já tem uma conta?{" "}
        <Link href={`/entrar?next=${encodeURIComponent(`/checkout/${planSlug}`)}`} className="font-semibold text-amber-300 transition hover:text-amber-200">Entrar</Link>
      </p>
    </form>
  );
}
