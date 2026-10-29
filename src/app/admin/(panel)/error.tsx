"use client";
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-[var(--shadow-card)]">
      <h1 className="display t-sub">This admin page failed to load</h1>
      <p className="mt-2 text-slate">{error.message === "FORBIDDEN" ? "Your session doesn't have admin access. Sign in again." : "A database or network error occurred. Nothing was changed."}</p>
      <button type="button" onClick={reset} className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">Retry</button>
      {error.digest && <p className="mt-4 text-xs text-mist">Reference: {error.digest}</p>}
    </div>
  );
}
