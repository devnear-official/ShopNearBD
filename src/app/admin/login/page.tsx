import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/ui/logo";
import { Streaks } from "@/components/ui/streaks";

export default function AdminLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div><Logo tone="dark" className="h-10" /></div>
        <div>
          <Streaks tone="tangerine" className="h-8 w-16" />
          <p className="display mt-6 text-6xl">Run the shop from one place.</p>
          <p className="mt-4 max-w-sm text-white/60">Orders, stock, payments, couriers and customer chats.</p>
        </div>
        <div aria-hidden className="absolute -bottom-32 -right-32 size-96 rounded-full bg-electric/40 blur-[100px]" />
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Logo className="h-9 lg:hidden" />
          <h1 className="display mt-8 text-4xl">Admin sign in</h1>
          <p className="mt-2 text-slate">Authorised staff only. Every sign-in is logged.</p>
          <Suspense><LoginForm next={searchParams.then((s) => s.next ?? "")} /></Suspense>
        </div>
      </div>
    </div>
  );
}
