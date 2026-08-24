import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { AdminSidebar, MobileAdminHeader } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth";
import { PROTECTED_PATH_HEADER } from "@/lib/protected-path";

export const metadata: Metadata = {
  title: "Operação",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const user = await requireAdmin(requestHeaders.get(PROTECTED_PATH_HEADER) ?? "/admin");

  return (
    <div className="min-h-screen bg-[#050b12] text-white lg:flex">
      <AdminSidebar user={user} />
      <div className="min-w-0 flex-1">
        <MobileAdminHeader user={user} />
        {children}
      </div>
    </div>
  );
}
