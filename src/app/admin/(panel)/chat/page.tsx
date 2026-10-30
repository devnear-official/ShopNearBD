import Link from "next/link";
import clsx from "clsx";
import { requireAdminPage } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, Empty, PageHeader } from "@/components/admin/ui";
import { ActionForm, Field, SubmitButton, TextArea } from "@/components/admin/form";
import { replyToChat, updateConversation } from "@/actions/admin-chat";
import { saveFaq } from "@/actions/admin-catalog";

type Conv = { id: string; status: string; mode: string; needs_human: boolean; admin_unread: boolean; last_message_at: Date; preview: string | null; messages: number };
type Faq = { id: string; question: string; answer: string; tags: string[]; sort_order: number; is_active: boolean };
type Msg = { id: number; role: string; content: string; created_at: Date; meta: { intent?: string; source?: string } };

export default async function ChatAdmin({ searchParams }: { searchParams: Promise<{ c?: string; filter?: string; tab?: string }> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const tab = sp.tab === "faq" ? "faq" : sp.tab === "ai" ? "ai" : "inbox";
  const filter = ["human", "open", "resolved"].includes(sp.filter ?? "") ? sp.filter : undefined;
  const selected = sp.c && /^[0-9a-f-]{36}$/i.test(sp.c) ? sp.c : null;

  const tabs = (
    <nav className="mb-4 flex gap-2" aria-label="Chat sections">
      {[["inbox", "Inbox"], ["faq", "FAQs & knowledge"], ["ai", "AI usage & failures"]].map(([k, l]) => <Link key={k} href={`/admin/chat?tab=${k}`} className={clsx("rounded-full px-4 py-2 text-sm font-semibold", tab === k ? "bg-ink text-white" : "bg-white shadow-[var(--shadow-card)]")}>{l}</Link>)}
    </nav>
  );

  if (tab === "faq") {
    const faqs = await admin.db((tx) => tx<Faq[]>`select id, question, answer, tags, sort_order, is_active from public.support_faqs order by sort_order, created_at`);
    return (
      <>
        <PageHeader title="Support chat" description="The assistant answers only from these FAQs, the live catalogue and your settings." />
        {tabs}
        <Card title="New FAQ" className="mb-4"><FaqForm /></Card>
        <div className="space-y-3">{faqs.map((f) => <details key={f.id} className="rounded-3xl bg-white shadow-[var(--shadow-card)]"><summary className="cursor-pointer list-none p-5 font-semibold">{f.question} {!f.is_active && <Badge>off</Badge>}</summary><div className="border-t border-line p-5"><FaqForm f={f} /></div></details>)}</div>
      </>
    );
  }

  if (tab === "ai") {
    const [stats, failures] = await admin.db((tx) => Promise.all([
      tx<{ day: string; calls: number; failed: number; tokens: number; avg_ms: number }[]>`select to_char(created_at at time zone 'Asia/Dhaka', 'YYYY-MM-DD') as day, count(*)::int as calls, count(*) filter (where not ok)::int as failed, coalesce(sum(coalesce(input_tokens,0) + coalesce(output_tokens,0)), 0)::int as tokens, coalesce(avg(latency_ms), 0)::int as avg_ms from public.ai_usage where created_at > now() - interval '14 days' group by 1 order by 1 desc`,
      tx<{ id: number; model: string; intent: string | null; error: string | null; created_at: Date; conversation_id: string | null }[]>`select id, model, intent, error, created_at, conversation_id from public.ai_usage where not ok order by id desc limit 30`,
    ]));
    return (
      <>
        <PageHeader title="Support chat" description="When Gemini fails or isn't configured, customers get a reply built from the same data and can ask for a person." />
        {tabs}
        <Card title="Last 14 days" className="mb-4">
          {stats.length ? <ul className="divide-y divide-line text-sm">{stats.map((s) => <li key={s.day} className="flex justify-between py-2"><span>{s.day}</span><span>{s.calls} replies · {s.failed} failed · {s.tokens.toLocaleString()} tokens · {s.avg_ms} ms avg</span></li>)}</ul> : <Empty>No AI calls yet.</Empty>}
        </Card>
        <Card title="Recent failures">
          {failures.length ? <ul className="divide-y divide-line text-sm">{failures.map((f) => <li key={f.id} className="py-2"><span className="text-xs text-slate">{formatDateTime(f.created_at)} · {f.model} · {f.intent}</span><p className="text-[#a3290f]">{f.error}</p>{f.conversation_id && <Link href={`/admin/chat?c=${f.conversation_id}`} className="text-xs font-semibold text-electric">Open conversation</Link>}</li>)}</ul> : <Empty>No failures.</Empty>}
        </Card>
      </>
    );
  }

  const [convs, thread, conv] = await admin.db(async (tx) => {
    if (selected) await tx`update public.chat_conversations set admin_unread = false where id = ${selected}`;
    return Promise.all([
      tx<Conv[]>`select c.id, c.status, c.mode, c.needs_human, c.admin_unread, c.last_message_at,
          (select content from public.chat_messages m where m.conversation_id = c.id and m.role = 'user' order by id desc limit 1) as preview,
          (select count(*)::int from public.chat_messages m where m.conversation_id = c.id) as messages
        from public.chat_conversations c
        ${filter === "human" ? tx`where c.needs_human and c.status <> 'resolved'` : filter ? tx`where c.status = ${filter}` : tx``}
        order by c.needs_human desc, c.last_message_at desc limit 50`,
      selected ? tx<Msg[]>`select id::int, role, content, created_at, meta from public.chat_messages where conversation_id = ${selected} order by id` : Promise.resolve([] as Msg[]),
      selected ? tx<Conv[]>`select id, status, mode, needs_human, admin_unread, last_message_at, null as preview, 0 as messages from public.chat_conversations where id = ${selected}`.then((r) => r[0] ?? null) : Promise.resolve(null),
    ]);
  });

  return (
    <>
      <PageHeader title="Support chat" description="Conversations needing a person are listed first. Replying switches the chat to human mode." />
      {tabs}
      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <Card pad={false} className={clsx(selected && "hidden lg:block")}>
          <div className="flex gap-1 p-3 text-xs">{[["", "All"], ["human", "Needs person"], ["open", "Open"], ["resolved", "Resolved"]].map(([k, l]) => <Link key={k} href={`/admin/chat${k ? `?filter=${k}` : ""}`} className={clsx("rounded-full px-3 py-1.5 font-semibold", (filter ?? "") === k ? "bg-ink text-white" : "bg-paper")}>{l}</Link>)}</div>
          {convs.length ? (
            <ul className="divide-y divide-line">
              {convs.map((c) => (
                <li key={c.id}><Link href={`/admin/chat?c=${c.id}${filter ? `&filter=${filter}` : ""}`} className={clsx("block px-4 py-3 hover:bg-paper", c.id === selected && "bg-electric/5")}>
                  <span className="flex items-center gap-2 text-sm">{c.admin_unread && <span className="size-2 rounded-full bg-electric" />}<b>Visitor {c.id.slice(0, 4)}</b>{c.needs_human && c.status !== "resolved" && <Badge tone="red">Needs person</Badge>}<Badge tone={c.mode === "human" ? "amber" : "blue"}>{c.mode}</Badge><span className="ml-auto text-xs text-slate">{formatDateTime(c.last_message_at)}</span></span>
                  <span className="mt-1 line-clamp-1 block text-sm text-slate">{c.preview ?? "—"}</span>
                </Link></li>
              ))}
            </ul>
          ) : <div className="p-4"><Empty>No conversations.</Empty></div>}
        </Card>

        {conv ? (
          <Card pad={false} className="flex min-h-[32rem] flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
              <Link href="/admin/chat" className="text-sm font-semibold text-slate lg:hidden">← All</Link>
              <b>Visitor {conv.id.slice(0, 4)}</b><Badge tone={conv.mode === "human" ? "amber" : "blue"}>{conv.mode === "human" ? "Team handling" : "Assistant"}</Badge><Badge>{conv.status}</Badge>
              <div className="ml-auto flex flex-wrap gap-2">
                <ActionForm action={updateConversation}><input type="hidden" name="conversationId" value={conv.id} /><input type="hidden" name="mode" value={conv.mode === "human" ? "ai" : "human"} /><SubmitButton size="sm" variant="ghost">{conv.mode === "human" ? "Hand back to assistant" : "Take over"}</SubmitButton></ActionForm>
                <ActionForm action={updateConversation}><input type="hidden" name="conversationId" value={conv.id} /><input type="hidden" name="status" value={conv.status === "resolved" ? "open" : "resolved"} /><SubmitButton size="sm" variant="dark">{conv.status === "resolved" ? "Reopen" : "Mark resolved"}</SubmitButton></ActionForm>
              </div>
            </div>
            <ol className="flex-1 space-y-3 overflow-y-auto p-4">
              {thread.map((m) => (
                <li key={m.id} className={clsx("flex", m.role === "user" ? "justify-start" : "justify-end")}>
                  {m.role === "system" ? <p className="mx-auto text-xs text-slate">— {m.content} —</p> : (
                    <div className={clsx("max-w-[80%] rounded-2xl px-4 py-2 text-sm", m.role === "user" ? "bg-paper" : m.role === "admin" ? "bg-tangerine/15" : "bg-electric/10")}>
                      <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-wider text-slate">{m.role === "user" ? "Customer" : m.role === "admin" ? "Team" : `Assistant${m.meta?.source ? ` · ${m.meta.source}` : ""}`} · {formatDateTime(m.created_at)}</p>
                      <p className="whitespace-pre-line">{m.content}</p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
            <ActionForm action={replyToChat} resetOnSuccess className="border-t border-line p-4">
              <input type="hidden" name="conversationId" value={conv.id} />
              <textarea name="body" rows={2} required placeholder="Reply as the ShopNear team…" className="input" />
              <div className="mt-2 flex items-center justify-between gap-2"><p className="text-xs text-slate">Don&apos;t ask for PINs/OTPs. Verify identity with the private order link before sharing order details.</p><SubmitButton size="sm">Send reply</SubmitButton></div>
            </ActionForm>
          </Card>
        ) : <Card className="hidden lg:block"><Empty>Select a conversation.</Empty></Card>}
      </div>
    </>
  );
}

function FaqForm({ f }: { f?: Faq }) {
return (
    <ActionForm action={saveFaq} className="space-y-2" resetOnSuccess={!f}>
      {f && <input type="hidden" name="id" value={f.id} />}
      <Field label="Question" name="question" defaultValue={f?.question} required />
      <TextArea label="Answer" name="answer" defaultValue={f?.answer} rows={3} required />
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Keywords" hint="comma separated, any language" name="tags" defaultValue={f?.tags.join(", ")} className="sm:col-span-2" />
        <Field label="Order" name="sort_order" type="number" min={0} defaultValue={f?.sort_order ?? 0} />
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="is_active" defaultChecked={f?.is_active ?? true} className="size-4 accent-electric" /> Active (used by the assistant and the Help page)</label>
      <div className="flex gap-2"><SubmitButton size="sm">{f ? "Save" : "Add FAQ"}</SubmitButton>{f && <SubmitButton size="sm" variant="ghost" name="delete" value="1" confirm="Delete this FAQ?">Delete</SubmitButton>}</div>
    </ActionForm>
  );
}
