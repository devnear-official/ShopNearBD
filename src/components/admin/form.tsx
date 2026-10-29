"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import { buttonClass } from "@/components/ui/button";

export type ActionState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> };

// Tiny global toast queue: feedback stays visible even when the form re-renders away.
type Toast = { id: number; text: string; tone: "ok" | "error" };
let toasts: Toast[] = [];
const subs = new Set<(t: Toast[]) => void>();
export function toast(text: string, tone: Toast["tone"] = "ok") {
  const t = { id: Date.now() + Math.random(), text, tone };
  toasts = [...toasts, t].slice(-3);
  subs.forEach((s) => s(toasts));
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); subs.forEach((s) => s(toasts)); }, 4500);
}
export function Toaster() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => { subs.add(setList); return () => { subs.delete(setList); }; }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[80] flex flex-col gap-2">
      {list.map((t) => <p key={t.id} role="status" className={clsx("pointer-events-auto rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg", t.tone === "ok" ? "bg-ink" : "bg-flame")}>{t.text}</p>)}
    </div>
  );
}

export function SubmitButton({ children, variant = "primary", size = "md", className, confirm, name, value }: { children: React.ReactNode; variant?: "primary" | "dark" | "ghost" | "danger" | "tangerine"; size?: "sm" | "md"; className?: string; confirm?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={buttonClass(variant, size, className)}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {pending && <Loader2 className="size-4 animate-spin" />} {children}
    </button>
  );
}

/** Form wired to a server action, with inline success/error feedback. */
export function ActionForm({ action, children, className, resetOnSuccess }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; children: React.ReactNode; className?: string; resetOnSuccess?: boolean }) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
    if (state.ok && state.message) toast(state.message);
    if (state.error) toast(state.error, "error");
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <Feedback state={state} />
    </form>
  );
}

export function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="mt-3 rounded-xl bg-flame/10 px-3 py-2 text-sm font-medium text-[#a3290f]">{state.error}</p>;
  if (state.ok && state.message) return <p role="status" className="mt-3 rounded-xl bg-mint/10 px-3 py-2 text-sm font-medium text-[#0b7a55]">{state.message}</p>;
  return null;
}

export function Field({ label, name, hint, error, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; hint?: string; error?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}{hint && <span className="ml-1 font-normal text-mist">· {hint}</span>}</span>
      <input name={name} className="input" aria-invalid={!!error} {...props} />
      {error && <span className="field-error block">{error}</span>}
    </label>
  );
}

export function TextArea({ label, name, hint, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string; hint?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}{hint && <span className="ml-1 font-normal text-mist">· {hint}</span>}</span>
      <textarea name={name} className="input" {...props} />
    </label>
  );
}

export function Select({ label, name, options, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; name: string; options: { value: string; label: string }[] }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      <select name={name} className="input" {...props}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    </label>
  );
}
