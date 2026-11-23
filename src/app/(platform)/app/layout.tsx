import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";

import { AppSidebar, MobileAppHeader } from "@/components/platform/app-nav";
import { ThemeRoot } from "@/components/platform/theme-root";
import { requireUser } from "@/lib/auth";
import { PROTECTED_PATH_HEADER } from "@/lib/protected-path";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const user = await requireUser(requestHeaders.get(PROTECTED_PATH_HEADER) ?? "/app");

  return (
    <ThemeRoot id="els-app" className="min-h-screen bg-els-bg text-els-fg lg:flex">
      <AppSidebar user={user} />
      <div className="min-w-0 flex-1">
        <MobileAppHeader user={user} />
        {children}
      </div>
    </ThemeRoot>
  );
}
