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
  Map,
  Medal,
  Route,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import type { AuthUser } from "@/lib/auth";

const navItems = [
  { href: "/app", label: "Visão geral", icon: Gauge },
  { href: "/app/compras", label: "Meus concursos", icon: CreditCard },
  { href: "/app/plano-diario", label: "Plano diário", icon: Route },
  { href: "/app/treinar", label: "Treinar agora", icon: BrainCircuit },
  { href: "/app/quiz", label: "Montar quiz", icon: ListChecks },
  { href: "/app/simulados", label: "Simulados", icon: FileStack },
  { href: "/app/revisoes", label: "Revisões", icon: FileStack },
  { href: "/app/leis", label: "Leis e normas", icon: LibraryBig },
  { href: "/app/mapas", label: "Mapas de revisão", icon: Map },
  { href: "/app/raio-x", label: "Raio-X", icon: BarChart3 },
  { href: "/app/materiais", label: "Materiais", icon: BookOpenText },
  { href: "/app/ranking", label: "Ranking", icon: Medal },
];

export function AppSidebar({ user }: { user: AuthUser }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 border-r border-els-line bg-els-bg px-4 py-5 lg:flex lg:flex-col">
      <div className="px-2">
        <LeiProvaMark href="/app" />
      </div>
      <nav className="mt-9 grid gap-1.5" aria-label="Navegação principal">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-els-fg-3 transition hover:bg-els-raise hover:text-els-fg"
          >
            <Icon className="size-[18px] text-els-fg-3 transition group-hover:text-els-amber" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto border-t border-els-line pt-4">
        {user.role === "admin" && (
          <Link
            href="/admin"
            className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-els-amber-2 transition hover:bg-els-raise hover:text-els-amber-2"
          >
            <ShieldCheck className="size-[18px]" /> Super admin
          </Link>
        )}
        <Link
          href="/app/assinatura"
          className="mb-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-els-fg-3 transition hover:bg-els-raise hover:text-els-fg"
        >
          <CreditCard className="size-[18px]" /> Assinatura
        </Link>
        <div className="rounded-2xl border border-els-line bg-els-raise p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-els-green/12 text-sm font-bold text-els-green-2">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm text-els-fg">
                {user.name}
              </strong>
              <span className="block truncate text-[11px] text-els-fg-3">
                {user.email}
              </span>
            </span>
          </div>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-els-line px-3 py-2 text-xs font-semibold text-els-fg-3 transition hover:border-els-line-strong hover:text-els-fg"
            >
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
    <header className="sticky top-0 z-40 border-b border-els-line bg-els-bg/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between">
        <LeiProvaMark href="/app" />
        <details className="relative">
          <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-xl border border-els-line bg-els-raise font-bold text-els-green-2">
            {user.name.slice(0, 1).toUpperCase()}
          </summary>
          <nav className="absolute right-0 top-12 grid w-64 gap-1 rounded-2xl border border-els-line bg-els-surface p-2 shadow-2xl">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-els-fg-2 hover:bg-els-raise"
              >
                <Icon className="size-4 text-els-amber" /> {label}
              </Link>
            ))}
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-els-amber-2 hover:bg-els-raise"
              >
                <ShieldCheck className="size-4 text-els-amber" /> Super admin
              </Link>
            )}
            <Link
              href="/app/assinatura"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-els-fg-2 hover:bg-els-raise"
            >
              <CreditCard className="size-4 text-els-amber" /> Assinatura
            </Link>
            <form action={logoutAction}>
              <button className="w-full rounded-xl px-3 py-2.5 text-left text-sm text-els-danger hover:bg-els-raise">
                Sair
              </button>
            </form>
          </nav>
        </details>
      </div>
    </header>
  );
}
