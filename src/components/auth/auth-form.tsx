"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";

import type { AuthActionState } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

type AuthAction = (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group mt-1 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-els-amber px-5 text-sm font-bold text-els-on-amber shadow-[0_14px_40px_color-mix(in_oklch,var(--els-amber)_18%,transparent)] transition hover:bg-els-amber-2 disabled:cursor-wait disabled:opacity-70"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" /> : label}
      {!pending && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  placeholder,
  error,
  icon: Icon,
}: {
  label: string;
  name: "name" | "email" | "password";
  type?: string;
  autoComplete: string;
  placeholder: string;
  error?: string;
  icon: typeof UserRound;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-els-fg-2">
      {label}
      <span className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-els-fg-3" />
        <input
          name={name}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${name}-error` : undefined}
          className={cn(
            "min-h-12 w-full rounded-xl border border-els-line bg-els-bg/70 pl-10 pr-4 text-[15px] text-els-fg outline-none transition placeholder:text-els-fg-4 focus:border-els-amber/60 focus:ring-4 focus:ring-els-amber/5",
            error && "border-els-danger/60 focus:border-els-danger",
          )}
        />
      </span>
      {error && (
        <span id={`${name}-error`} className="text-xs font-normal text-els-danger-ink">
          {error}
        </span>
      )}
    </label>
  );
}

export function AuthForm({
  mode,
  action,
  nextPath,
  accountAccessEnabled = false,
}: {
  mode: "login" | "register";
  action: AuthAction;
  nextPath?: string;
  accountAccessEnabled?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const isRegister = mode === "register";

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input type="hidden" name="next" value={nextPath ?? "/app"} />
      {isRegister && (
        <Field
          label="Seu nome"
          name="name"
          autoComplete="name"
          placeholder="Como podemos chamar você?"
          error={state.fieldErrors?.name}
          icon={UserRound}
        />
      )}
      <Field
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="voce@exemplo.com"
        error={state.fieldErrors?.email}
        icon={Mail}
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete={isRegister ? "new-password" : "current-password"}
        placeholder={isRegister ? "Mínimo de 10 caracteres" : "Sua senha"}
        error={state.fieldErrors?.password}
        icon={LockKeyhole}
      />

      {!isRegister && accountAccessEnabled && (
        <Link
          href="/recuperar-acesso"
          className="-mt-2 w-max text-xs font-semibold text-els-fg-3 transition hover:text-els-amber-ink"
        >
          Primeiro acesso ou esqueci minha senha
        </Link>
      )}

      {isRegister && (
        <label className="flex items-start gap-3 text-xs leading-5 text-els-fg-3">
          <input
            type="checkbox"
            name="terms"
            className="mt-1 size-4 rounded border-els-line-strong bg-els-bg accent-els-amber"
          />
          <span>
            Li e aceito os <Link href="/termos" className="text-els-fg-2 underline">Termos de Uso</Link> e a{" "}
            <Link href="/privacidade" className="text-els-fg-2 underline">Política de Privacidade</Link>.
            {state.fieldErrors?.terms && (
              <span className="mt-1 block text-els-danger-ink">{state.fieldErrors.terms}</span>
            )}
          </span>
        </label>
      )}

      {state.error && (
        <p role="alert" className="rounded-xl border border-els-danger/20 bg-els-danger/8 px-4 py-3 text-sm text-els-danger-ink">
          {state.error}
        </p>
      )}

      <SubmitButton label={isRegister ? "Criar conta gratuita" : "Entrar na plataforma"} />

      <p className="text-center text-sm text-els-fg-3">
        {isRegister ? "Já tem uma conta?" : "Ainda não tem conta?"}{" "}
        <Link
          href={isRegister ? `/entrar?next=${encodeURIComponent(nextPath ?? "/app")}` : `/cadastro?next=${encodeURIComponent(nextPath ?? "/app")}`}
          className="font-semibold text-els-amber-ink transition hover:text-els-amber-ink"
        >
          {isRegister ? "Entrar" : "Começar grátis"}
        </Link>
      </p>
    </form>
  );
}
