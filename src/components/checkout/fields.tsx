"use client";
import { useState } from "react";
import { Loader2, ShieldAlert, Upload } from "lucide-react";
import clsx from "clsx";
import type { PaymentSettings } from "@/lib/catalog";
import { formatTaka } from "@/lib/format";
import { uploadPaymentProof } from "@/actions/checkout";

export type Method = "cod" | "bkash_manual" | "nagad_manual";
export const METHODS: Method[] = ["cod", "bkash_manual", "nagad_manual"];
export type Keys = { idempotencyKey: string; accessToken: string };

/** Idempotency key + the customer's private order secret (only its hash is stored server-side). */
export function newKeys(): Keys {
  const b = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { idempotencyKey: crypto.randomUUID() + "-" + Date.now().toString(36), accessToken: token };
}

/** Saves the order link on this device for "Track my order". */
export function rememberOrder(o: { orderNumber: string; token: string; total: number }) {
  try {
    const saved = JSON.parse(localStorage.getItem("sn_orders") ?? "[]");
    localStorage.setItem("sn_orders", JSON.stringify([{ number: o.orderNumber, token: o.token, total: o.total, at: new Date().toISOString() }, ...saved].slice(0, 20)));
  } catch {}
}

export function validateManual(method: Method | null, payLater: boolean, sender: string, txid: string) {
  const errs: Record<string, string> = {};
  if (!method) errs.method = "Choose a payment method";
  if (method && method !== "cod" && !payLater) {
    if (!/^(\+?88)?01[3-9]\d{8}$/.test(sender.replace(/[\s-]/g, ""))) errs.sender = "Enter the number you paid from";
    if (!/^[A-Za-z0-9]{6,20}$/.test(txid.trim())) errs.txid = "Enter the Transaction ID from the SMS";
  }
  return errs;
}

export const METHOD_TITLE: Record<Method, string> = { cod: "Cash on Delivery", bkash_manual: "bKash (Send Money)", nagad_manual: "Nagad (Send Money)" };

export function ManualPayment(props: {
  cfg: PaymentSettings["bkash_manual"]; label: string; total: number | null;
  payLater: boolean; setPayLater: (v: boolean) => void; sender: string; setSender: (v: string) => void; txid: string; setTxid: (v: string) => void;
  proof: { path: string; name: string } | null; setProof: (v: { path: string; name: string } | null) => void; errors: Record<string, string>;
}) {
  const { cfg, label, total, payLater, setPayLater, sender, setSender, txid, setTxid, proof, setProof, errors } = props;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  return (
    <div className="mt-6 rounded-[1.5rem] bg-paper p-5">
      <p className="flex items-start gap-2 rounded-xl bg-sun/20 p-3 text-sm font-medium text-[#7a4d05]">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" /> We will never ask for your {label} PIN or OTP. Never share them with anyone, including us.
      </p>
      <ol className="mt-4 space-y-2 text-sm">
        <li>1. {cfg.instructions}</li>
        <li>2. Our {label} number ({cfg.account_type}): <b className="font-mono text-base tracking-wide">{cfg.number}</b></li>
        <li>3. Amount: <b>{total !== null ? formatTaka(total) : "shown after you choose your district"}</b></li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="When will you pay?">
        <button type="button" role="radio" aria-checked={!payLater} onClick={() => setPayLater(false)} className={clsx("h-10 rounded-full px-4 text-sm font-semibold", !payLater ? "bg-ink text-white" : "bg-white ring-1 ring-line")}>I&apos;ve paid — enter details</button>
        <button type="button" role="radio" aria-checked={payLater} onClick={() => setPayLater(true)} className={clsx("h-10 rounded-full px-4 text-sm font-semibold", payLater ? "bg-ink text-white" : "bg-white ring-1 ring-line")}>I&apos;ll pay after ordering</button>
      </div>
      {!payLater && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={`Your ${label} number`} error={errors.sender}>
            <input value={sender} onChange={(e) => setSender(e.target.value)} type="tel" inputMode="tel" placeholder="01XXXXXXXXX" className="input" aria-invalid={!!errors.sender} />
          </Field>
          <Field label="Transaction ID (TrxID)" error={errors.txid}>
            <input value={txid} onChange={(e) => setTxid(e.target.value.replace(/\s/g, ""))} placeholder="e.g. 9JK4L2M8QA" className="input font-mono uppercase" autoCapitalize="characters" aria-invalid={!!errors.txid} />
          </Field>
          <div className="sm:col-span-2">
            <label className="flex w-max cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold ring-1 ring-line">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {proof ? `Screenshot: ${proof.name}` : "Attach screenshot (optional)"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploading(true);
                setUploadError(null);
                const fd = new FormData();
                fd.set("file", f);
                const r = await uploadPaymentProof(fd);
                setUploading(false);
                if (r.ok) setProof({ path: r.path, name: f.name });
                else setUploadError(r.error);
              }} />
            </label>
            {uploadError && <p className="field-error">{uploadError}</p>}
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-slate">A Transaction ID or screenshot is not proof of payment on its own — our team checks it against our {label} account and then confirms your order.</p>
    </div>
  );
}

export function Field({ label, hint, error, className, children }: { label: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className="label">
        {label}
        {hint && <span className="ml-1 font-normal text-mist">· {hint}</span>}
        <span className="mt-1.5 block font-normal">{children}</span>
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}


export function couponMessage(code: string) {
  const m: Record<string, string> = {
    COUPON_INVALID: "That coupon code isn't valid.", COUPON_EXPIRED: "That coupon has expired.", COUPON_NOT_STARTED: "That coupon isn't active yet.",
    COUPON_EXHAUSTED: "That coupon has been fully used.", COUPON_MIN_SUBTOTAL: "Your subtotal is below this coupon's minimum.", COUPON_PHONE_LIMIT: "This coupon was already used with this phone number.",
  };
  return m[code] ?? "This coupon can't be applied.";
}
