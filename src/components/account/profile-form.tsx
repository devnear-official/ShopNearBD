"use client";
import { useActionState } from "react";
import { updateProfile } from "@/actions/account";
import { Button } from "@/components/ui/button";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, {});
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="label">Name<input name="name" defaultValue={name} autoComplete="name" className="input mt-1.5" required /></label>
      <label className="label">Email (optional)<input name="email" type="email" defaultValue={email} autoComplete="email" className="input mt-1.5" /></label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        {state.error && <p role="alert" className="text-sm font-medium text-flame">{state.error}</p>}
        {state.ok && <p role="status" className="text-sm font-medium text-mint">{state.message}</p>}
      </div>
    </form>
  );
}
