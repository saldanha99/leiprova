"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  BookOpenCheck,
  CreditCard,
  FileSearch,
  LayoutDashboard,
  LogOut,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import { logoutAction } from "@/app/actions/auth";
import { LeiProvaMark } from "@/components/ui/leiprova-mark";
import type { AuthUser } from "@/lib/auth";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const adminNavItems = [
  {
    href: "/admin/motores",
    label: "Motores e agentes",
    icon: RefreshCcw,
    adminOnly: false,
  },
  {
    href: "/admin",
    label: "Visão geral",
    icon: LayoutDashboard,
    adminOnly: true,
  },
  {
    href: "/admin/catalogo-produtos",
    label: "Produtos e preços",
    icon: CreditCard,
    adminOnly: true,
  },
  {
    href: "/admin/fabrica-autoral",
    label: "Fábrica autoral",
    icon: BookOpenCheck,
    adminOnly: false,
  },
  {
    href: "/admin/fontes-oficiais",
    label: "Fontes oficiais",
    icon: RefreshCcw,
    adminOnly: false,
  },
  {
    href: "/admin/motor-editais",
    label: "Motor de editais",
    icon: FileSearch,
    adminOnly: false,
  },
  {
    href: "/admin/stripe-connect",
    label: "Stripe Connect",
    icon: CreditCard,
    adminOnly: true,
  },
] as const;

function isCurrentPath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

function NavigationLinks({
  user,
  mobile = false,
}: {
  user: AuthUser;
  mobile?: boolean;
}) {
  const pathname = usePathname();
  const items = adminNavItems.filter(
    (item) => !item.adminOnly || user.role === "admin",
  );

  return (
    <nav className="grid gap-1.5" aria-label="Navegação da operação">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isCurrentPath(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition",
              active
                ? "border border-amber-300/15 bg-amber-300/10 text-amber-100"
                : "border border-transparent text-slate-400 hover:bg-white/[.055] hover:text-white",
              mobile && "min-h-12",
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "size-[18px] transition",
                active
                  ? "text-amber-300"
                  : "text-slate-500 group-hover:text-amber-300",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminIdentity({ user }: { user: AuthUser }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[.035] p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-300/12 text-sm font-bold text-amber-200">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm text-slate-100">
            {user.name}
          </strong>
          <span className="block truncate text-[11px] text-slate-500">
            {user.email}
          </span>
        </span>
      </div>
      <form action={logoutAction} className="mt-3">
        <button
          type="submit"
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/8 px-3 text-xs font-semibold text-slate-400 transition hover:border-white/15 hover:text-white"
        >
          <LogOut aria-hidden="true" className="size-3.5" />
          Sair da conta
        </button>
      </form>
    </div>
  );
}

export function AdminSidebar({ user }: { user: AuthUser }) {
  const homeHref = user.role === "admin" ? "/admin" : "/admin/fabrica-autoral";
  const roleLabel = user.role === "admin" ? "Super admin" : "Editor";

  return (
    <aside className="sticky top-0 hidden h-screen w-[276px] shrink-0 border-r border-white/8 bg-[#07101b] px-4 py-5 lg:flex lg:flex-col">
      <div className="px-2">
        <LeiProvaMark href={homeHref} />
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-emerald-200">
          <ShieldCheck aria-hidden="true" className="size-3" />
          {roleLabel}
        </span>
      </div>

      <div className="mt-8">
        <NavigationLinks user={user} />
      </div>

      <div className="mt-auto space-y-3 border-t border-white/8 pt-4">
        <Link
          href="/app"
          className="flex min-h-10 items-center justify-between rounded-xl px-3 text-xs font-semibold text-slate-500 transition hover:bg-white/[.045] hover:text-slate-200"
        >
          Ver plataforma
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
        <AdminIdentity user={user} />
      </div>
    </aside>
  );
}

export function MobileAdminHeader({ user }: { user: AuthUser }) {
  const homeHref = user.role === "admin" ? "/admin" : "/admin/fabrica-autoral";
  const roleLabel = user.role === "admin" ? "Super admin" : "Editor";

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-[#07101b]/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <LeiProvaMark href={homeHref} compact />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {BRAND_NAME}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[.13em] text-emerald-300">
              {roleLabel}
            </p>
          </div>
        </div>

        <details className="relative">
          <summary
            aria-label="Abrir menu da operação"
            className="grid size-10 cursor-pointer list-none place-items-center rounded-xl border border-white/10 bg-white/5 font-bold text-amber-200"
          >
            {user.name.slice(0, 1).toUpperCase()}
          </summary>
          <div className="absolute right-0 top-12 w-[min(19rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#0a1522] p-2 shadow-2xl">
            <NavigationLinks user={user} mobile />
            <div className="mt-2 border-t border-white/8 pt-2">
              <Link
                href="/app"
                className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-white"
              >
                Ver plataforma
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-rose-200 hover:bg-white/5"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  Sair
                </button>
              </form>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
