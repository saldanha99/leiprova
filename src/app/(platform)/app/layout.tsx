import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";

import { AppSidebar, MobileAppHeader } from "@/components/platform/app-nav";
import { requireUser } from "@/lib/auth";
import { PROTECTED_PATH_HEADER } from "@/lib/protected-path";
import { THEME_COOKIE, THEME_ROOT_ATTR, parseTheme, themeBootScript } from "@/lib/theme";

const THEME_ROOT_ID = "els-app";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const user = await requireUser(requestHeaders.get(PROTECTED_PATH_HEADER) ?? "/app");

  // Tema salvo no cookie: o servidor já renderiza certo. Sem cookie (1ª visita), o script
  // abaixo aplica a escolha do aparelho ou o prefers-color-scheme antes de pintar.
  const savedTheme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const themeRoot = { [THEME_ROOT_ATTR]: "" };

  return (
    <div
      id={THEME_ROOT_ID}
      data-theme={savedTheme ?? "dark"}
      {...themeRoot}
      // o script de 1ª visita pode trocar data-theme antes da hidratação
      suppressHydrationWarning
      className="min-h-screen bg-els-bg text-els-fg lg:flex"
    >
      {savedTheme ? null : <script dangerouslySetInnerHTML={{ __html: themeBootScript(THEME_ROOT_ID) }} />}
      <AppSidebar user={user} />
      <div className="min-w-0 flex-1">
        <MobileAppHeader user={user} />
        {children}
      </div>
    </div>
  );
}
