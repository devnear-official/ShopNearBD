"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ChatWidget = dynamic(() => import("./chat-widget").then((m) => m.ChatWidget), { ssr: false });

/**
 * The support chat is loaded after the page has finished its important work
 * (browser idle, at most 4 s after load), or immediately if something asks
 * to open it. Its code never delays the first screen.
 */
export function LazyChat({ greeting }: { greeting: string }) {
  const [ready, setReady] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  useEffect(() => {
    if (ready) return;
    const go = () => setReady(true);
    const onOpen = () => { setOpenNow(true); go(); };
    window.addEventListener("sn:open-chat", onOpen);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const start = () => (w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 4000 }) : window.setTimeout(go, 2500));
    let id: number | undefined;
    if (document.readyState === "complete") id = start();
    else window.addEventListener("load", () => { id = start(); }, { once: true });
    return () => {
      window.removeEventListener("sn:open-chat", onOpen);
      if (id !== undefined) (w.cancelIdleCallback ?? clearTimeout)(id);
    };
  }, [ready]);
  // An "open chat" request that arrived before the widget loaded opens it on arrival.
  return ready ? <ChatWidget greeting={greeting} autoOpen={openNow} /> : null;
}
