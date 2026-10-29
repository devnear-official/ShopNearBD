"use client";
import { useActionState } from "react";
import { changePassword, type AuthState } from "@/actions/admin-auth";
import { Button } from "@/components/ui/button";

export function PasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(changePassword, {});
  return (
    <form action={action} className="grid max-w-md gap-3">
      <label className="label">New password<input name="password" type="password" minLength={10} required autoComplete="new-password" className="input mt-1.5" /></label>
      <label className="label">Confirm<input name="confirm" type="password" minLength={10} required autoComplete="new-password" className="input mt-1.5" /></label>
      {state.error && <p className="field-error" role="alert">{state.error}</p>}
      {state.message && <p className="rounded-xl bg-mint/10 p-2 text-sm text-[#0b7a55]" role="status">{state.message}</p>}
      <Button type="submit" size="sm" disabled={pending} className="w-max">Update password</Button>
    </form>
  );
}
