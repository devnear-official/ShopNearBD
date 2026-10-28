"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { m, useReducedMotion } from "motion/react";
import { Loader2, ShieldAlert, Star } from "lucide-react";
import { submitPaymentLater, submitReview } from "@/actions/order";
import { formatDate, formatTaka } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Saved = { number: string; token: string; total: number; at: string };
const readSaved = (): Saved[] => {
  try { return JSON.parse(localStorage.getItem("sn_orders") ?? "[]"); } catch { return []; }
};

/** /order/<number> without a token: use the one saved on this device, if any. */
export function TokenResolver({ number }: { number: string }) {
  const router = useRouter();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const hit = readSaved().find((o) => o.number === number);
    if (hit) router.replace(`/order/${number}?t=${encodeURIComponent(hit.token)}`);
    else setMissing(true);
  }, [number, router]);
  if (!missing) return <div className="skeleton h-72 rounded-[2rem]" />;
  return (
    <div className="rounded-[2rem] bg-white p-8 text-center shadow-[var(--shadow-card)]">
      <h1 className="display text-4xl">Private order link needed</h1>
      <p className="mx-auto mt-3 max-w-md text-slate">For your privacy we only show an order through the private link created when it was placed. It isn&apos;t saved on this device. Contact us with your order number and phone and we&apos;ll help.</p>
      <Link href="/order" className="mt-6 inline-block font-semibold text-electric underline">Orders saved on this device</Link>
    </div>
  );
}

export function SavedOrders() {
  const [orders, setOrders] = useState<Saved[] | null>(null);
  useEffect(() => setOrders(readSaved()), []);
  if (orders === null) return <div className="skeleton h-40 rounded-[2rem]" />;
  if (!orders.length) return <p className="rounded-[2rem] bg-white p-6 text-slate shadow-[var(--shadow-card)]">No orders are saved on this device yet. Orders appear here automatically after you check out in this browser.</p>;
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.number}>
          <Link href={`/order/${o.number}?t=${encodeURIComponent(o.token)}`} className="flex items-center justify-between rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5">
            <span><span className="block font-display text-xl font-bold">{o.number}</span><span className="text-sm text-slate">Placed {formatDate(o.at)}</span></span>
            <span className="font-semibold">{formatTaka(o.total)} →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PayLaterForm({ orderNumber, token, label, number, accountType, instructions, amount }: { orderNumber: string; token: string; label: string; number: string; accountType: string; instructions: string; amount: number }) {
  const router = useRouter();
  const [sender, setSender] = useState("");
  const [txid, setTxid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="mt-4 space-y-3 rounded-2xl bg-paper p-4" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const r = await submitPaymentLater({ orderNumber, token, sender, txid });
        if (r.ok) router.refresh();
        else setError(r.error ?? "Couldn't submit.");
      });
    }}>
      <p className="flex gap-2 text-xs font-medium text-[#7a4d05]"><ShieldAlert className="size-4 shrink-0" /> Never share your PIN or OTP.</p>
      <p className="text-sm">{instructions}</p>
      <p className="text-sm">Send <b>{formatTaka(amount)}</b> to <b className="font-mono">{number}</b> ({label} {accountType}).</p>
      <label className="label">Your {label} number<input value={sender} onChange={(e) => setSender(e.target.value)} type="tel" inputMode="tel" className="input mt-1.5" placeholder="01XXXXXXXXX" required /></label>
      <label className="label">Transaction ID<input value={txid} onChange={(e) => setTxid(e.target.value.replace(/\s/g, ""))} className="input mt-1.5 font-mono uppercase" required /></label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">{pending ? <Loader2 className="size-4 animate-spin" /> : null} Submit for verification</Button>
    </form>
  );
}

export function ReviewForms({ orderNumber, token, items, reviewed }: { orderNumber: string; token: string; items: { id: string; name: string }[]; reviewed: string[] }) {
  return (
    <section aria-labelledby="rev" className="mt-8 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] sm:p-7">
      <h2 id="rev" className="display text-2xl">How was it?</h2>
      <p className="mt-1 text-sm text-slate">Reviews from delivered orders help other shoppers. They are checked before they appear.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {items.map((i) => <ReviewForm key={i.id} orderNumber={orderNumber} token={token} productId={i.id} name={i.name} done={reviewed.includes(i.id)} />)}
      </div>
    </section>
  );
}

function ReviewForm({ orderNumber, token, productId, name, done }: { orderNumber: string; token: string; productId: string; name: string; done: boolean }) {
  const [rating, setRating] = useState(0);
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sent">(done ? "sent" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (state === "sent") return <p className="rounded-2xl bg-mint/10 p-4 text-sm font-medium text-[#0b7a55]">Thanks — your review of {name} is waiting for approval.</p>;
  return (
    <form className="rounded-2xl bg-paper p-4" onSubmit={(e) => {
      e.preventDefault();
      if (!rating) return setError("Choose a star rating");
      start(async () => {
        const r = await submitReview({ orderNumber, token, productId, author, rating, body });
        if (r.ok) setState("sent");
        else setError(r.error ?? "Couldn't submit");
      });
    }}>
      <p className="font-semibold">{name}</p>
      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className="grid size-10 place-items-center">
            <Star className={`size-6 ${n <= rating ? "fill-sun text-sun" : "text-line"}`} />
          </button>
        ))}
      </div>
      <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name" className="input mt-2" required minLength={2} maxLength={60} aria-label="Your name" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What did you like? (optional)" rows={2} maxLength={1500} className="input mt-2" aria-label="Review" />
      {error && <p className="field-error">{error}</p>}
      <Button type="submit" size="sm" className="mt-3" disabled={pending}>Submit review</Button>
    </form>
  );
}

/** A short burst of speed streaks — the only celebratory motion, skipped for reduced motion. */
export function Celebrate() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {Array.from({ length: 14 }, (_, i) => (
        <m.span key={i} className="absolute h-2 rounded-full"
          style={{ top: `${8 + i * 6.5}%`, left: "-30%", width: `${80 + (i % 4) * 50}px`, background: ["#1E6BFF", "#2FC6FF", "#FF7A1A", "#FFB020"][i % 4] }}
          initial={{ x: 0, opacity: 0.9 }} animate={{ x: "160vw", opacity: 0 }} transition={{ duration: 1.1 + (i % 3) * 0.2, delay: i * 0.04, ease: [0.2, 0.9, 0.1, 1] }} />
      ))}
    </div>
  );
}
