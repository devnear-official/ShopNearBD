import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { accountsAvailable, currentCustomer } from "@/lib/customer/auth";
import { LoginForm } from "@/components/account/login-form";
import { Streaks } from "@/components/ui/streaks";

export const metadata: Metadata = { title: "Log in", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ next?: string; phone?: string }> };

export default function LoginPage(props: Props) {
  return (
    <div className="mx-auto max-w-md px-4 pt-10 sm:px-8">
      <div className="rounded-[2rem] bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
        <span className="grid size-12 place-items-center rounded-2xl bg-electric/10 text-electric"><UserRound className="size-6" /></span>
        <h1 className="display mt-4 t-section">My account</h1>
        <p className="bn mt-1 text-slate" lang="bn">ফোন নম্বর দিয়ে লগইন করুন — পাসওয়ার্ড লাগবে না।</p>
        <p className="mt-2 text-sm text-slate">See every order on your number, track deliveries and check how much you&apos;ve ordered.</p>
        <div className="mt-6"><Suspense fallback={<div className="skeleton h-40 rounded-2xl" />}><Login {...props} /></Suspense></div>
      </div>
      <Streaks className="mx-auto mt-8 h-6 w-12 opacity-60" />
    </div>
  );
}

async function Login({ searchParams }: Props) {
  const { next, phone } = await searchParams;
  if (await currentCustomer()) redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
  return <LoginForm next={next} initialPhone={phone && /^01\d{9}$/.test(phone) ? phone : undefined} available={accountsAvailable()} />;
}
