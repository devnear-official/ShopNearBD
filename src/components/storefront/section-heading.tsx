import { Streaks } from "@/components/ui/streaks";

export function SectionHeading({ eyebrow, title, bn, id, children }: { eyebrow: string; title: React.ReactNode; bn?: string; id?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div>
        <p className="eyebrow flex items-center gap-3 text-electric"><Streaks className="h-3.5 w-7" />{eyebrow}</p>
        <h2 id={id} className="display mt-3 text-[clamp(2rem,6vw,4.5rem)]">{title}</h2>
        {bn && <p className="bn mt-1 text-lg text-slate" lang="bn">{bn}</p>}
      </div>
      {children}
    </div>
  );
}
