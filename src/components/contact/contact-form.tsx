"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { sendContactAction, type ContactState } from "@/app/actions/contact";

function Submit() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : "Enviar mensagem"}<ArrowRight className="size-4" /></button>;
}

export function ContactForm() {
  const [state, action] = useActionState<ContactState, FormData>(sendContactAction, {});
  const fieldClass = "min-h-12 w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-300/45";
  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-slate-300">Nome<input name="name" autoComplete="name" className={fieldClass} placeholder="Seu nome" />{state.fieldErrors?.name && <span className="text-xs font-normal text-rose-300">{state.fieldErrors.name}</span>}</label>
        <label className="grid gap-2 text-sm font-semibold text-slate-300">E-mail<input name="email" type="email" autoComplete="email" className={fieldClass} placeholder="voce@exemplo.com" />{state.fieldErrors?.email && <span className="text-xs font-normal text-rose-300">{state.fieldErrors.email}</span>}</label>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-slate-300">Assunto<input name="subject" className={fieldClass} placeholder="Como podemos ajudar?" />{state.fieldErrors?.subject && <span className="text-xs font-normal text-rose-300">{state.fieldErrors.subject}</span>}</label>
      <label className="grid gap-2 text-sm font-semibold text-slate-300">Mensagem<textarea name="message" rows={6} className={`${fieldClass} py-3`} placeholder="Descreva sua dúvida, sugestão ou problema." />{state.fieldErrors?.message && <span className="text-xs font-normal text-rose-300">{state.fieldErrors.message}</span>}</label>
      <label className="sr-only" aria-hidden="true">Empresa<input name="company" tabIndex={-1} autoComplete="off" /></label>
      {state.error && <p role="alert" className="rounded-xl border border-rose-300/15 bg-rose-300/6 px-4 py-3 text-sm text-rose-200">{state.error}</p>}
      <Submit />
    </form>
  );
}
