import { Streaks } from "@/components/ui/streaks";

export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="overflow-x-clip py-3">
    <div className="relative -rotate-1 overflow-hidden bg-ink py-4 text-white shadow-[var(--shadow-float)]">
      <div className="flex w-max animate-marquee items-center gap-10 pr-10 motion-reduce:animate-none">
        {[...row, ...row].map((t, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap font-display text-xl font-semibold sm:text-2xl" aria-hidden={i >= items.length}>
            {t}
            <Streaks tone={i % 2 ? "tangerine" : "light"} className="h-4 w-8" />
          </span>
        ))}
      </div>
    </div>
    </div>
  );
}
