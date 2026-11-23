"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { THEME_COOKIE, THEME_ROOT_ATTR, THEME_STORAGE_KEY, type ElsTheme } from "@/lib/theme";

/** Evento para manter sincronizados os botões montados na mesma página (menu e cabeçalho móvel). */
const THEME_EVENT = "els-theme-change";

function rootOf(node: HTMLElement | null) {
  return node?.closest<HTMLElement>(`[${THEME_ROOT_ATTR}]`) ?? null;
}

/** Botão sol/lua: troca o tema do contêiner do app e guarda a escolha (cookie + aparelho). */
export function ThemeToggle({ className }: { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<ElsTheme | null>(null);

  useEffect(() => {
    const current = rootOf(ref.current)?.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
    const sync = (event: Event) => setTheme((event as CustomEvent<ElsTheme>).detail);
    window.addEventListener(THEME_EVENT, sync);
    return () => window.removeEventListener(THEME_EVENT, sync);
  }, []);

  function toggle() {
    const next: ElsTheme = theme === "light" ? "dark" : "light";
    // Todos os contêineres do app na página (menu lateral e cabeçalho móvel usam o mesmo).
    document.querySelectorAll<HTMLElement>(`[${THEME_ROOT_ATTR}]`).forEach((el) => el.setAttribute("data-theme", next));
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // modo privado: o cookie basta
    }
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
    window.dispatchEvent(new CustomEvent<ElsTheme>(THEME_EVENT, { detail: next }));
  }

  const isLight = theme === "light";
  const label = isLight ? "Usar tema escuro" : "Usar tema claro";

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-els-line text-els-fg-2 transition hover:border-els-line-strong hover:bg-els-raise-hover hover:text-els-fg",
        className,
      )}
    >
      {isLight ? <Moon aria-hidden="true" className="size-[18px]" /> : <Sun aria-hidden="true" className="size-[18px]" />}
    </button>
  );
}
