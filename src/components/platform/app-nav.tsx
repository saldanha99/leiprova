import Link from "next/link";
import {
  BarChart3,
  BookOpenText,
  BrainCircuit,
  CreditCard,
  FileStack,
  Gauge,
  LibraryBig,
  ListChecks,
  Medal,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import type { AuthUser } from "@/lib/auth";

const navItems = [
  { href: "/app", label: "Visão geral", icon: Gauge },
  { href: "/app/treinar", label: "Treinar agora", icon: BrainCircuit },
  { href: "/app/quiz", label: "Quiz e simulados", icon: ListChecks },
  { href: "/app/revisoes", label: "Revisões", icon: FileStack },
  { href: "/app/leis", label: "Leis e normas", icon: LibraryBig },
  { href: "/app/raio-x", label: "Raio-X", icon: BarChart3 },
  { href: "/app/materiais", label: "Materiais", icon: BookOpenText },
  { href: "/app/ranking", label: "Ranking", icon: Medal },
];

export function AppSidebar({ user }: { user: AuthUser }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 border-r border-white/8 bg-[#07101b] px-4 py-5 lg:flex lg:flex-col">
      <div className="px-2"><LeiProvaMark href="/app" /></div>
      <nav className="mt-9 grid gap-1.5" aria-label="Navegação principal">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/[.055] hover:text-white"
          >
            <Icon className="size-[18px] text-slate-500 transition group-hover:text-amber-300" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t border-white/8 pt-4">
        {user.role === "admin" && (
          <Link href="/admin" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-amber-200 transition hover:bg-white/[.055] hover:text-amber-100">
            <ShieldCheck className="size-[18px]" /> Super admin
          </Link>
        )}
        <Link href="/app/assinatura" className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/[.055] hover:text-white">
          <CreditCard className="size-[18px]" /> Assinatura
        </Link>
        <div className="rounded-2xl border border-white/8 bg-white/[.035] p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-emerald-300/12 text-sm font-bold text-emerald-200">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-slate-100">{user.name}</strong>
              <span className="block truncate text-[11px] text-slate-500">{user.email}</span>
            </span>
          </div>
          <form action={logoutAction} className="mt-3">
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/8 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-white/15 hover:text-white">
              <Settings2 className="size-3.5" /> Sair da conta
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileAppHeader({ user }: { user: AuthUser }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#07101b]/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between">
        <LeiProvaMark href="/app" />
        <details className="relative">
          <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-xl border border-white/10 bg-white/5 font-bold text-emerald-200">
            {user.name.slice(0, 1).toUpperCase()}
          </summary>
          <nav className="absolute right-0 top-12 grid w-64 gap-1 rounded-2xl border border-white/10 bg-[#0a1522] p-2 shadow-2xl">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5">
                <Icon className="size-4 text-amber-300" /> {label}
              </Link>
            ))}
            {user.role === "admin" && (
              <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-amber-200 hover:bg-white/5">
                <ShieldCheck className="size-4 text-amber-300" /> Super admin
              </Link>
            )}
            <Link href="/app/assinatura" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5">
              <CreditCard className="size-4 text-amber-300" /> Assinatura
            </Link>
            <form action={logoutAction}>
              <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose-200 hover:bg-white/5">Sair</button>
            </form>
          </nav>
        </details>
      </div>
    </header>
  );
}
