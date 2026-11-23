import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, MessageSquareText, ShieldCheck } from "lucide-react";

import { ContactForm } from "@/components/contact/contact-form";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import { isContactEnabled } from "@/lib/launch";

export const metadata: Metadata = {
  title: "Contato",
  description: "Canal de suporte e relato de inconsistências de conteúdo da Edital Lei Seca.",
  alternates: { canonical: "/contato" },
  robots: { index: false, follow: true, noarchive: true },
  openGraph: { url: "/contato", title: "Contato | Edital Lei Seca" },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ enviado?: string }> }) {
  const sent = (await searchParams).enviado === "1";
  const contactEnabled = isContactEnabled();
  return (
    <main className="min-h-screen bg-els-bg text-els-fg">
      <header className="border-b border-els-line bg-els-bg"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><LeiProvaMark /><Link href="/" className="text-sm font-semibold text-els-fg-3 hover:text-els-fg min-h-11 inline-flex items-center">Voltar ao site</Link></div></header>
      <section className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[.75fr_1.25fr] lg:py-16">
        <div><span className="grid size-12 place-items-center rounded-2xl bg-els-amber/10 text-els-amber-ink"><MessageSquareText className="size-5" /></span><p className="mt-6 text-xs font-bold uppercase tracking-[.16em] text-els-green-ink">Suporte Edital Lei Seca</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em]">Vamos resolver juntos.</h1><p className="mt-4 text-sm leading-7 text-els-fg-3">Envie sua dúvida, sugestão ou relato de conteúdo. Ao reportar uma questão, inclua a lei, o artigo e o que parece inconsistente.</p><p className="mt-6 flex items-start gap-2 text-xs leading-5 text-els-fg-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-els-green-ink" />Não envie senhas, dados completos de cartão ou documentos sensíveis.</p></div>
        <div className="rounded-[1.75rem] border border-els-line bg-els-surface p-6 sm:p-8">{sent ? <div className="grid min-h-80 place-items-center text-center"><div><CheckCircle2 className="mx-auto size-11 text-els-green-ink" /><h2 className="mt-5 text-2xl font-semibold">Mensagem recebida</h2><p className="mt-2 text-sm text-els-fg-3">Registramos seu contato para acompanhamento.</p><Link href="/" className="mt-6 inline-flex rounded-xl bg-els-amber px-5 py-3 text-sm font-bold text-els-on-amber">Voltar ao início</Link></div></div> : contactEnabled ? <ContactForm /> : <div className="grid min-h-80 place-items-center text-center"><div><ShieldCheck className="mx-auto size-10 text-els-amber-ink" /><h2 className="mt-5 text-2xl font-semibold">Canal em configuração</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-els-fg-3">O formulário público será aberto quando a identificação formal do controlador e a rotina de atendimento estiverem publicadas.</p><Link href="/#planos" className="mt-6 inline-flex rounded-xl bg-els-amber px-5 py-3 text-sm font-bold text-els-on-amber">Ver planos e preço</Link></div></div>}</div>
      </section>
    </main>
  );
}
