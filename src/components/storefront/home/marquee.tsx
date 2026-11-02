import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { Streaks } from "@/components/ui/streaks";
import { resolveLink, TICKER_KIND_LABEL, type TickerKind } from "@/lib/promo";
import type { TickerItem } from "@/lib/catalog";

type Entry = { key: string; text: string; href: string | null; image: string | null; kind: TickerKind | null };

function Chip({ e, i, hidden }: { e: Entry; i: number; hidden: boolean }) {
  const inner = (
    <>
      {e.image && (
        <span className="relative size-9 shrink-0 overflow-hidden rounded-full bg-white/10">
          <Image src={e.image} alt="" fill sizes="36px" className="object-cover" />
        </span>
      )}
      {e.kind && <span className="rounded-full bg-tangerine px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-white">{TICKER_KIND_LABEL[e.kind]}</span>}
      <span>{e.text}</span>
      <Streaks tone={i % 2 ? "tangerine" : "light"} className="h-4 w-8 shrink-0" />
    </>
  );
  const cls = "flex items-center gap-3 whitespace-nowrap rounded-full px-3 py-1 font-display text-lg font-semibold sm:text-2xl";
  if (!e.href) return <span className={cls}>{inner}</span>;
  const hover = clsx(cls, "hover:bg-white/10 focus-visible:bg-white/10");
  return /^https?:\/\//.test(e.href) ? (
    <a href={e.href} target="_blank" rel="noopener noreferrer" tabIndex={hidden ? -1 : undefined} className={hover}>{inner}</a>
  ) : (
    <Link href={e.href} tabIndex={hidden ? -1 : undefined} className={hover}>{inner}</Link>
  );
}

/**
 * Promotional ticker. The list is rendered twice inside one track that slides by exactly half its width,
 * so the loop is seamless at any screen width. It pauses on hover, keyboard focus and finger press,
 * stops for reduced-motion users (the strip then scrolls by hand), and never widens the page.
 * The second copy is hidden from assistive tech and the tab order.
 */
export function Marquee({ items, fallback }: { items: TickerItem[]; fallback: string[] }) {
  const entries: Entry[] = items.length
    ? items.map((t) => ({ key: t.id, text: t.text, href: resolveLink(t.link_type, t.link_target), image: t.image_url, kind: (t.kind in TICKER_KIND_LABEL ? t.kind : null) as TickerKind | null }))
    : fallback.map((text, k) => ({ key: `f${k}`, text, href: null, image: null, kind: null }));
  if (!entries.length) return null;
  // Short lists are repeated so one half is always wider than the widest screen.
  const reps = Math.max(1, Math.ceil(8 / entries.length));
  const half = Array.from({ length: reps }, (_, r) => entries.map((e) => ({ ...e, key: `${e.key}-${r}` }))).flat();
  return (
    <div className="overflow-x-clip py-3">
      <div role="region" aria-label="Offers and announcements" className="relative overflow-hidden bg-ink py-3 text-white shadow-[var(--shadow-float)] motion-reduce:overflow-x-auto">
        <div className="flex w-max animate-marquee items-center hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] active:[animation-play-state:paused] motion-reduce:animate-none">
          {[0, 1].map((copy) => (
            <div key={copy} aria-hidden={copy === 1 || undefined} className="flex shrink-0 items-center gap-6 pr-6">
              {half.map((e, i) => <Chip key={e.key} e={e} i={i} hidden={copy === 1} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
