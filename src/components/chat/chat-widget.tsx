"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { ArrowUp, Headset, Loader2, X } from "lucide-react";
import clsx from "clsx";
import { useDialog } from "@/hooks/use-dialog";

type Msg = { id: number; role: "user" | "assistant" | "admin" | "system"; content: string; created_at: string; pending?: boolean };
const TOKEN_KEY = "sn_chat";
const QUICK = ["Delivery charge koto?", "bKash e payment kivabe korbo?", "Where is my order?", "৩০০০ টাকার মধ্যে earbuds"];

const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) ?? undefined; } catch { return undefined; } };
const savedOrders = () => { try { return (JSON.parse(localStorage.getItem("sn_orders") ?? "[]") as { number: string; token: string }[]).slice(0, 5).map(({ number, token }) => ({ number, token })); } catch { return []; } };

export function ChatWidget({ greeting: fallbackGreeting, autoOpen }: { greeting: string; autoOpen?: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [greeting, setGreeting] = useState(fallbackGreeting);
  const [mode, setMode] = useState<"ai" | "human">("ai");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const lastId = useRef(0);
  const list = useRef<HTMLDivElement>(null);
  const ref = useDialog<HTMLDivElement>(open, () => setOpen(false));
  // On the phone checkout the floating button would sit over form fields; checkout offers its own help button instead.
  const onCheckout = usePathname().startsWith("/checkout");

  const merge = useCallback((incoming: Msg[]) => {
    if (!incoming.length) return;
    setMessages((cur) => {
      const ids = new Set(cur.map((x) => x.id));
      const next = [...cur.filter((x) => !x.pending), ...incoming.filter((x) => !ids.has(x.id))];
      lastId.current = Math.max(lastId.current, ...next.map((x) => x.id));
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    const token = getToken();
    if (!token) return null;
    try {
      const r = await fetch(`/api/chat?since=${lastId.current}`, { headers: { "x-chat-token": token }, cache: "no-store" });
      if (!r.ok) return null;
      const d = (await r.json()) as { greeting: string; mode: "ai" | "human"; messages: Msg[] };
      setGreeting(d.greeting);
      setMode(d.mode);
      if (d.messages.some((x) => x.role === "admin" && x.id > lastId.current)) setUnread(true);
      merge(d.messages);
      return d;
    } catch {
      return null;
    }
  }, [merge]);

  const openChatRef = useRef<() => void>(() => {});
  const openChat = () => {
    setOpen(true);
    setUnread(false);
    if (!loaded) {
      // Load history the first time the panel opens.
      setLoaded(true);
      void poll();
    }
  };
  useEffect(() => {
    openChatRef.current = openChat;
  });

  // While a person is handling the chat, check for their replies.
  useEffect(() => {
    if (mode !== "human") return;
    const t = setInterval(() => void poll(), open ? 5000 : 30000);
    return () => clearInterval(t);
  }, [mode, open, poll]);

  useEffect(() => {
    if (autoOpen) openChatRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first mount
  }, []);

  // Other components can open the chat (e.g. the help button on checkout).
  useEffect(() => {
    const onOpen = () => openChatRef.current();
    window.addEventListener("sn:open-chat", onOpen);
    return () => window.removeEventListener("sn:open-chat", onOpen);
  }, []);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  const send = async (content: string, human = false) => {
    const body = content.trim();
    if ((!body && !human) || sending) return;
    setError(null);
    setSending(true);
    setText("");
    if (body) setMessages((cur) => [...cur, { id: Date.now(), role: "user", content: body, created_at: new Date().toISOString(), pending: true }]);
    try {
      const token = getToken();
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-chat-token": token } : {}) },
        body: JSON.stringify({ message: body, human, orders: savedOrders() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Something went wrong.");
      try { localStorage.setItem(TOKEN_KEY, d.token); } catch {}
      setMode(d.mode);
      await poll();
    } catch (e) {
      setError((e as Error).message);
      setMessages((cur) => cur.filter((x) => !x.pending));
      if (body) setText(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <m.button
            type="button"
            onClick={openChat}
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            aria-label={unread ? "Open chat — new reply from our team" : "Chat with us"}
            data-chat-launcher
            className={clsx("group fixed right-4 z-40 h-14 items-center gap-2 rounded-full bg-ink pl-2 pr-2 text-white shadow-[0_18px_40px_-14px_rgba(11,21,48,.7)] sm:flex sm:pr-5", onCheckout ? "hidden" : "flex")}
            style={{ bottom: "calc(1rem + env(safe-area-inset-bottom) + var(--sticky-bar, 0px))" }}
          >
            <span className="relative grid size-10 place-items-center rounded-full bg-gradient-to-br from-tangerine to-flame">
              <BagMark />
              {unread && <span className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full bg-sky ring-2 ring-ink" />}
            </span>
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-sm font-bold">Ask ShopNear</span>
              <span className="text-[0.68rem] text-white/60">বাংলা · Banglish · English</span>
            </span>
            <span aria-hidden className="absolute -left-6 top-1/2 hidden -translate-y-1/2 flex-col gap-1 opacity-0 transition group-hover:-left-8 group-hover:opacity-100 sm:flex">
              <span className="h-1 w-5 rounded bg-electric" /><span className="h-1 w-3 rounded bg-sky" />
            </span>
          </m.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <m.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label="ShopNear support chat"
            initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed inset-0 z-[60] flex flex-col bg-paper sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(40rem,calc(100dvh-2rem))] sm:w-[24rem] sm:overflow-hidden sm:rounded-[2rem] sm:shadow-[0_40px_80px_-30px_rgba(11,21,48,.55)] sm:ring-1 sm:ring-ink/10"
            style={{ transformOrigin: "bottom right" }}
          >
            <header className="flex items-center gap-3 bg-ink px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] text-white">
              <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-tangerine to-flame"><BagMark /></span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold leading-tight">ShopNear help</p>
                <p className="flex items-center gap-1.5 text-xs text-white/60">
                  <span className={clsx("size-2 rounded-full", mode === "human" ? "bg-tangerine" : "bg-mint")} />
                  {mode === "human" ? "A team member will reply here" : "Assistant · answers from our live catalogue"}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close chat"><X className="size-5" /></button>
            </header>

            <div ref={list} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
              <Bubble role="assistant" content={greeting} />
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK.map((q) => <button key={q} type="button" onClick={() => send(q)} className="rounded-full bg-white px-3 py-2 text-sm font-medium shadow-[var(--shadow-card)] hover:bg-cloud">{q}</button>)}
                </div>
              )}
              {messages.map((msg) => <Bubble key={msg.id} role={msg.role} content={msg.content} onNavigate={() => setOpen(false)} />)}
              {sending && <div className="flex w-16 items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-[var(--shadow-card)]" aria-label="Assistant is typing">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-mist" style={{ animationDelay: `${i * 120}ms` }} />)}</div>}
              {error && <p role="alert" className="rounded-xl bg-flame/10 p-3 text-sm text-[#a3290f]">{error}</p>}
            </div>

            <div className="pb-safe border-t border-line bg-white px-3 pt-3">
              {mode === "ai" && (
                <button type="button" onClick={() => send("", true)} disabled={sending} className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate hover:text-ink">
                  <Headset className="size-3.5" /> Talk to a person
                </button>
              )}
              <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex items-end gap-2">
                <label htmlFor="chat-input" className="sr-only">Your message</label>
                <textarea id="chat-input" data-autofocus value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={1000}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
                  placeholder="প্রশ্ন লিখুন / Type your question…" className="max-h-28 min-h-12 flex-1 resize-none rounded-2xl bg-paper px-4 py-3 outline-none ring-electric focus:ring-2" />
                <button type="submit" disabled={sending || !text.trim()} className="grid size-12 shrink-0 place-items-center rounded-full bg-electric text-white disabled:opacity-40" aria-label="Send message">
                  {sending ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
                </button>
              </form>
              <p className="pb-1 pt-2 text-center text-[0.65rem] text-mist">Never share your bKash/Nagad PIN or OTP — we will never ask for it.</p>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}

function BagMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <path d="M8 8V7a4 4 0 0 1 8 0v1" fill="none" stroke="#0B1530" strokeWidth="2" strokeLinecap="round" />
      <rect x="4.5" y="8" width="15" height="12" rx="3.5" fill="#fff" />
      <path d="M8.5 13.5h7M8.5 16.5h4" stroke="#FF7A1A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Minimal, safe rendering: **bold**, [text](link) and line breaks. No HTML is ever injected. */
function Rich({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {line.split(/(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*)/g).map((part, i) => {
            const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
            if (link) {
              const href = link[2];
              if (href.startsWith("/")) return <Link key={i} href={href} onClick={onNavigate} className="font-semibold text-electric underline underline-offset-2">{link[1]}</Link>;
              if (/^https:\/\//.test(href)) return <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-electric underline">{link[1]}</a>;
              return <span key={i}>{link[1]}</span>;
            }
            const bold = /^\*\*([^*]+)\*\*$/.exec(part);
            if (bold) return <b key={i}>{bold[1]}</b>;
            return <Fragment key={i}>{part}</Fragment>;
          })}
          {li < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </>
  );
}

function Bubble({ role, content, onNavigate }: { role: Msg["role"]; content: string; onNavigate?: () => void }) {
  const mine = role === "user";
  return (
    <div className={clsx("flex", mine ? "justify-end" : "justify-start")}>
      <div className={clsx("max-w-[85%] rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed", mine ? "rounded-br-md bg-electric text-white" : role === "admin" ? "rounded-bl-md bg-tangerine/15 text-ink ring-1 ring-tangerine/30" : "rounded-bl-md bg-white text-ink shadow-[var(--shadow-card)]")}>
        {role === "admin" && <p className="mb-0.5 text-[0.7rem] font-bold uppercase tracking-wider text-[#b8510b]">ShopNear team</p>}
        <Rich text={content} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
