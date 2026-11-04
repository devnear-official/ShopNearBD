import { Suspense } from "react";
import { AdminNav } from "@/components/admin/nav";
import { getAdmin } from "@/lib/auth";
import { MotionProvider } from "@/components/ui/motion-provider";
import { Toaster } from "@/components/admin/form";

async function NavWithUser() {
  const admin = await getAdmin();
  return <AdminNav email={admin?.email ?? null} />;
}

/**
 * Admin chrome. Authorization is NOT decided here — every page and server
 * action calls requireAdminPage()/requireAdmin() itself.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      <Suspense fallback={<div className="fixed inset-y-0 left-0 hidden w-64 bg-ink lg:block" />}>
        <NavWithUser />
      </Suspense>
      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Suspense fallback={<div className="space-y-4"><div className="skeleton admin-skeleton h-10 w-64 rounded-xl" /><div className="skeleton admin-skeleton h-64 rounded-3xl" /></div>}>
            {children}
          </Suspense>
        </main>
      </div>
      <Toaster />
    </MotionProvider>
  );
}
