import clsx from "clsx";
import { formatTaka, percentOff } from "@/lib/format";

export function Price({ value, compareAt, size = "md", className }: { value: number; compareAt?: number | null; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const off = compareAt ? percentOff(compareAt, value) : null;
  return (
    <span className={clsx("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={clsx("font-display font-bold tabular-nums tracking-tight text-ink", { sm: "text-base", md: "text-lg", lg: "text-2xl", xl: "text-4xl" }[size])}>
        {formatTaka(value)}
      </span>
      {compareAt && off ? (
        <>
          <s className={clsx("tabular-nums text-mist", size === "sm" ? "text-xs" : "text-sm")}>{formatTaka(compareAt)}</s>
          <span className="rounded-full bg-tangerine/15 px-2 py-0.5 text-[0.7rem] font-bold text-[#b8510b]">−{off}%</span>
        </>
      ) : null}
    </span>
  );
}
