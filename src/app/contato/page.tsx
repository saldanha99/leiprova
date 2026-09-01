import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MessageSquareText, ShieldCheck } from "lucide-react";

import { ContactForm } from "@/components/contact/contact-form";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import { isContactEnabled } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Contato",
  description: "Canal de suporte e relato de inconsistências de conteúdo da Editalume.",
  alternates: { canonical: "/contato" },
  robots: { index: false, follow: true, noarchive: true },
  openGraph: { url: "/contato", title: "Contato | Editalume" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const sent = (await searchParams).enviado === "1";
  const contactEnabled = isContactEnabled();
  return (
    <main className="min-h-screen bg-[#060b13] text-white">
      <header className="border-b border-white/8 bg-[#07101b]"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><LeiProvaMark /><Link href="/" className="text-sm font-semibold text-slate-400 hover:text-white">Voltar ao site</Link></div></header>
      <section className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[.75fr_1.25fr] lg:py-16">
        <div><span className="grid size-12 place-items-center rounded-2xl bg-amber-300/10 text-amber-300"><MessageSquareText className="size-5" /></span><p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-emerald-300">Suporte Editalume</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em]">Vamos resolver juntos.</h1><p className="mt-4 text-sm leading-7 text-slate-400">Envie sua dúvida, sugestão ou relato de conteúdo. Ao reportar uma questão, inclua a lei, o artigo e o que parece inconsistente.</p><p className="mt-6 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />Não envie senhas, dados completos de cartão ou documentos sensíveis.</p></div>
        <div className="rounded-[1.75rem] border border-white/9 bg-[#0a1420] p-6 sm:p-8">{sent ? <div className="grid min-h-80 place-items-center text-center"><div><CheckCircle2 className="mx-auto size-11 text-emerald-300" /><h2 className="mt-5 text-2xl font-semibold">Mensagem recebida</h2><p className="mt-2 text-sm text-slate-400">Registramos seu contato para acompanhamento.</p><Link href="/" className="mt-6 inline-flex rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950">Voltar ao início</Link></div></div> : contactEnabled ? <ContactForm /> : <div className="grid min-h-80 place-items-center text-center"><div><ShieldCheck className="mx-auto size-10 text-amber-300" /><h2 className="mt-5 text-2xl font-semibold">Canal em configuração</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">O formulário público será aberto quando a identificação formal do controlador e a rotina de atendimento estiverem publicadas.</p><Link href="/demo" className="mt-6 inline-flex rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950">Experimentar o método</Link></div></div>}</div>
      </section>
    </main>
  );
}
