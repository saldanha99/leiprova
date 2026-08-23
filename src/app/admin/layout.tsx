import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminSidebar, MobileAdminHeader } from "@/components/admin/admin-nav";
import { requireSuperAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Super admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireSuperAdmin();

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
