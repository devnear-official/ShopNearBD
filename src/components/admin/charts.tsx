import { formatTaka } from "@/lib/format";

/** Daily bars (order value) with an accessible table fallback. */
export function DailyBars({ data, days }: { data: { day: string; orders: number; value: number }[]; days: number }) {
  const map = new Map(data.map((d) => [d.day, d]));
  const end = new Date();
  const series = Array.from({ length: days }, (_, i) => {
    const d = new Date(end.getTime() - (days - 1 - i) * 86400000);
    const key = d.toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
    return { day: key, orders: map.get(key)?.orders ?? 0, value: Number(map.get(key)?.value ?? 0) };
  });
  const max = Math.max(1, ...series.map((s) => s.value));
  const w = 100 / series.length;
  return (
    <figure>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label={`Order value per day for the last ${days} days`}>
        {series.map((s, i) => {
          const h = (s.value / max) * 36;
          return <rect key={s.day} x={i * w + w * 0.15} y={40 - h} width={w * 0.7} height={Math.max(h, 0.4)} rx={0.6} fill={s.value ? "#1E6BFF" : "#DFE5F0"}><title>{`${s.day}: ${s.orders} orders, ${formatTaka(s.value)}`}</title></rect>;
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-slate"><span>{series[0]?.day}</span><span>Peak {formatTaka(max)}</span><span>{series.at(-1)?.day}</span></figcaption>
      <table className="sr-only"><tbody>{series.map((s) => <tr key={s.day}><td>{s.day}</td><td>{s.orders}</td><td>{s.value}</td></tr>)}</tbody></table>
    </figure>
  );
}

export function StatusBar({ dist }: { dist: Record<string, number> }) {
  const colors: Record<string, string> = { pending: "#FFB020", confirmed: "#1E6BFF", packed: "#7C3AED", shipped: "#2FC6FF", delivered: "#10B981", cancelled: "#FF4D2E", returned: "#8D97B0" };
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (!total) return <p className="text-sm text-slate">No orders in this period.</p>;
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label="Order status distribution">
        {Object.entries(dist).map(([k, v]) => <span key={k} style={{ width: `${(v / total) * 100}%`, background: colors[k] }} title={`${k}: ${v}`} />)}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {Object.entries(dist).map(([k, v]) => (
          <li key={k} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: colors[k] }} /> <span className="capitalize">{k}</span> <b className="ml-auto tabular-nums">{v}</b></li>
        ))}
      </ul>
    </div>
  );
}
