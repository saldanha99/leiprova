import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { THEME_COOKIE, THEME_ROOT_ATTR, parseTheme, themeBootScript } from "@/lib/theme";

/**
 * Contêiner com o tema do usuário (app do aluno e /admin). O servidor lê o cookie e já
 * renderiza no tema certo; sem cookie (1ª visita), o script aplica a escolha guardada no
 * aparelho ou o prefers-color-scheme antes de pintar.
 */
export async function ThemeRoot({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const savedTheme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const themeRoot = { [THEME_ROOT_ATTR]: "" };

  return (
    <div
      id={id}
      data-theme={savedTheme ?? "dark"}
      {...themeRoot}
      // o script de 1ª visita pode trocar data-theme antes da hidratação
      suppressHydrationWarning
      className={className}
    >
      {savedTheme ? null : <script dangerouslySetInnerHTML={{ __html: themeBootScript(id) }} />}
      {children}
    </div>
  );
}
