"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageSquareText, ShieldCheck } from "lucide-react";
import { requestLoginCode, verifyLoginCode } from "@/actions/account";
import { Button } from "@/components/ui/button";

/** Two steps: phone number → 6-digit code from SMS. */
export function LoginForm({ next, initialPhone, available }: { next?: string; initialPhone?: string; available: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [normalized, setNormalized] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    setBusy(true);
    setError(null);
    const r = await requestLoginCode({ phone });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      if (r.retryIn) setWait(r.retryIn);
      return;
    }
    setNormalized(r.phone);
    setStep("code");
    setCode("");
    setWait(r.resendIn);
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  const verify = async (value = code) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await verifyLoginCode({ phone: normalized, code: value, next });
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      return;
    }
    router.replace(r.next);
    router.refresh();
  };

  if (!available) {
    return <p className="rounded-2xl bg-sun/20 p-4 text-sm font-medium text-[#7a4d05]">Login by SMS isn&apos;t switched on yet. You can still open your orders from the private link we gave you after ordering, or from “Track my order” on the device you ordered from.</p>;
  }

  return step === "phone" ? (
    <form onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate className="space-y-4">
      <label className="label">
        Mobile number
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" className="input mt-1.5 text-lg" aria-invalid={!!error} autoFocus />
      </label>
      {error && <p role="alert" className="field-error">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy || wait > 0}>
        {busy ? <Loader2 className="size-5 animate-spin" /> : <MessageSquareText className="size-5" />} {wait > 0 ? `Send code again in ${wait}s` : "Send login code"}
      </Button>
      <p className="flex items-start gap-2 text-xs text-slate"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-mint" /> We&apos;ll text a 6-digit code to this number. Use the number you order with — your past orders on it appear automatically.</p>
    </form>
  ) : (
    <form onSubmit={(e) => { e.preventDefault(); void verify(); }} noValidate className="space-y-4">
      <button type="button" onClick={() => { setStep("phone"); setError(null); }} className="flex min-h-10 items-center gap-1 text-sm font-semibold text-electric"><ArrowLeft className="size-4" /> Change number</button>
      <p className="text-slate">We sent a code to <b className="text-ink">{normalized}</b>.</p>
      <label className="label">
        6-digit code
        <input ref={codeRef} value={code} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setCode(v); if (v.length === 6) void verify(v); }}
          inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="••••••" className="input mt-1.5 text-center font-mono text-2xl tracking-[0.5em]" aria-invalid={!!error} />
      </label>
      {error && <p role="alert" className="field-error">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
        {busy ? <><Loader2 className="size-5 animate-spin" /> Checking…</> : "Log in"}
      </Button>
      <button type="button" onClick={() => void send()} disabled={busy || wait > 0} className="min-h-10 w-full text-sm font-semibold text-electric disabled:text-mist">
        {wait > 0 ? `Didn't get it? Resend in ${wait}s` : "Resend code"}
      </button>
    </form>
  );
}
