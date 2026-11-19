"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { X } from "lucide-react";
import clsx from "clsx";
import { SocialIcon } from "@/components/ui/social-icon";
import { track } from "@/lib/tracking/client";

function BagMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5.5" aria-hidden>
      <path d="M8 8V7a4 4 0 0 1 8 0v1" fill="none" stroke="#0B1530" strokeWidth="2" strokeLinecap="round" />
      <rect x="4.5" y="8" width="15" height="12" rx="3.5" fill="#fff" />
      <path d="M8.5 13.5h7M8.5 16.5h4" stroke="#FF7A1A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Unified Floating Action Button (FAB) for customer support.
 * Shows a single sleek floating button. When clicked, it expands to reveal:
 * 1. Facebook Messenger
 * 2. WhatsApp
 * 3. ShopNear AI Chat Assistant
 */
export function ContactFloat({ whatsapp, messenger }: { whatsapp: string | null; messenger: string | null }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const onCheckout = pathname.startsWith("/checkout");

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("touchstart", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("touchstart", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close when navigating
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (onCheckout) return null;

  const openAiChat = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("sn:open-chat"));
  };

  return (
    <div
      ref={containerRef}
      className="fixed right-4 z-40 flex flex-col items-end"
      style={{
        bottom: "calc(1rem + env(safe-area-inset-bottom) + var(--sticky-bar, 0px) + var(--bottom-nav-offset, 0px))",
      }}
    >
      {/* Expanded Speed-Dial Menu */}
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
            className="mb-3 flex flex-col items-end gap-2.5"
          >
            {/* Messenger Option */}
            {messenger && (
              <a
                href={messenger}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  track("Contact");
                  setOpen(false);
                }}
                className="group flex items-center gap-2.5 rounded-full bg-white/95 py-1.5 pl-3.5 pr-1.5 shadow-[0_10px_25px_-5px_rgba(11,21,48,0.25)] ring-1 ring-ink/5 backdrop-blur-md transition hover:-translate-y-0.5 active:scale-95"
              >
                <span className="text-xs font-bold text-ink">Messenger</span>
                <span className="grid size-10 place-items-center rounded-full text-white shadow-sm" style={{ background: "#0a7cff" }}>
                  <SocialIcon name="messenger" className="size-5.5" />
                </span>
              </a>
            )}

            {/* WhatsApp Option */}
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  track("Contact");
                  setOpen(false);
                }}
                className="group flex items-center gap-2.5 rounded-full bg-white/95 py-1.5 pl-3.5 pr-1.5 shadow-[0_10px_25px_-5px_rgba(11,21,48,0.25)] ring-1 ring-ink/5 backdrop-blur-md transition hover:-translate-y-0.5 active:scale-95"
              >
                <span className="text-xs font-bold text-ink">WhatsApp</span>
                <span className="grid size-10 place-items-center rounded-full text-white shadow-sm" style={{ background: "#1fae54" }}>
                  <SocialIcon name="whatsapp" className="size-5.5" />
                </span>
              </a>
            )}

            {/* AI Assistant Option */}
            <button
              type="button"
              onClick={openAiChat}
              className="group flex items-center gap-2.5 rounded-full bg-white/95 py-1.5 pl-3.5 pr-1.5 shadow-[0_10px_25px_-5px_rgba(11,21,48,0.25)] ring-1 ring-ink/5 backdrop-blur-md transition hover:-translate-y-0.5 active:scale-95"
            >
              <span className="flex flex-col items-end">
                <span className="text-xs font-bold text-ink">Ask ShopNear AI</span>
                <span className="text-[10px] text-slate">Instant help 24/7</span>
              </span>
              <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-tangerine to-flame text-white shadow-sm">
                <BagMark />
              </span>
            </button>
          </m.div>
        )}
      </AnimatePresence>

      {/* Main Single Floating Action Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label={open ? "Close support menu" : "Customer support and chat"}
        className={clsx(
          "group relative flex size-14 items-center justify-center rounded-full bg-ink text-white shadow-[0_18px_40px_-14px_rgba(11,21,48,.7)] ring-2 ring-white/20 transition-all duration-300 hover:scale-105 active:scale-95",
          open && "rotate-90 bg-ink-2",
        )}
      >
        {open ? (
          <X className="size-6 text-white transition-transform" />
        ) : (
          <span className="relative grid size-10 place-items-center rounded-full bg-gradient-to-br from-tangerine to-flame">
            <BagMark />
          </span>
        )}
      </button>
    </div>
  );
}
