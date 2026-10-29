"use client";
import { use, useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminSignIn, requestPasswordReset, type AuthState } from "@/actions/admin-auth";
import { Button } from "@/components/ui/button";

export function LoginForm({ next }: { next: Promise<string> }) {
  const nextPath = use(next);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [state, action, pending] = useActionState<AuthState, FormData>(adminSignIn, {});
  const [resetState, resetAction, resetPending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  if (mode === "reset") {
    return (
      <form action={resetAction} className="mt-8 space-y-4">
        <label className="label">Email<input name="email" type="email" required autoComplete="email" className="input mt-1.5" /></label>
        {resetState.error && <p className="field-error" role="alert">{resetState.error}</p>}
        {resetState.message && <p className="rounded-xl bg-mint/10 p-3 text-sm text-[#0b7a55]" role="status">{resetState.message}</p>}
        <Button type="submit" className="w-full" disabled={resetPending}>{resetPending && <Loader2 className="size-4 animate-spin" />} Send reset link</Button>
        <button type="button" onClick={() => setMode("login")} className="w-full text-sm font-semibold text-electric">Back to sign in</button>
      </form>
    );
  }
  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <label className="label">Email<input name="email" type="email" required autoComplete="username" className="input mt-1.5" /></label>
      <label className="label">Password<input name="password" type="password" required autoComplete="current-password" className="input mt-1.5" /></label>
      {state.error && <p className="field-error" role="alert">{state.error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Sign in</Button>
      <button type="button" onClick={() => setMode("reset")} className="w-full text-sm font-semibold text-slate hover:text-ink">Forgot password?</button>
    </form>
  );
}
