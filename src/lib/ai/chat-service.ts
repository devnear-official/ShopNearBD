import "server-only";
import { system } from "../db";
import { randomToken, sha256 } from "../tokens";
import { rateLimit } from "../rate-limit";
import { getPublicSettings } from "../catalog";
import { classify } from "./intent";
import { retrieve } from "./retrieval";
import { contextBlock, fallbackReply, isBangla, systemPrompt } from "./prompt";
import { generate, geminiConfigured } from "./gemini";

export type AiSettings = { enabled: boolean; model: string; temperature: number; max_output_tokens: number; per_ip_per_minute: number; per_conversation_per_hour: number; retention_days: number; greeting: string };
export type ChatMessage = { id: number; role: "user" | "assistant" | "admin" | "system"; content: string; created_at: string };

const DEFAULT_AI: AiSettings = { enabled: true, model: "gemini-2.5-flash", temperature: 0.3, max_output_tokens: 600, per_ip_per_minute: 8, per_conversation_per_hour: 60, retention_days: 90, greeting: "Hi! How can we help?" };

export async function aiSettings(): Promise<AiSettings> {
  const [row] = await system((tx) => tx<{ value: AiSettings }[]>`select value from public.site_settings where key = 'ai'`);
  return { ...DEFAULT_AI, ...(row?.value ?? {}) };
}

type Conv = { id: string; mode: "ai" | "human"; status: string };

async function findConversation(token: string | undefined): Promise<Conv | null> {
  if (!token || !/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null;
  const [c] = await system((tx) => tx<Conv[]>`select id, mode, status from public.chat_conversations where token_hash = ${sha256(token)}`);
  return c ?? null;
}

export async function loadThread(token: string | undefined, since = 0) {
  const settings = await aiSettings();
  const conv = await findConversation(token);
  if (!conv) return { greeting: settings.greeting, mode: "ai" as const, messages: [] as ChatMessage[] };
  const messages = await system((tx) => tx<ChatMessage[]>`
    select id::int, role, content, created_at from public.chat_messages where conversation_id = ${conv.id} and id > ${since} and role <> 'system' order by id desc limit 60`);
  return { greeting: settings.greeting, mode: conv.mode, messages: messages.reverse().map((m) => ({ ...m, created_at: new Date(m.created_at).toISOString() })) };
}

export type SendResult =
  | { ok: true; token: string; mode: "ai" | "human"; reply: ChatMessage | null }
  | { ok: false; error: string; status: number };

export async function sendMessage(input: { token?: string; message: string; orders: { number: string; token: string }[]; wantHuman?: boolean; ipHash: string; name?: string }): Promise<SendResult> {
  const settings = await aiSettings();
  const text = input.message.trim().slice(0, 1000);
  if (!text && !input.wantHuman) return { ok: false, error: "Type a message.", status: 400 };
  if (!(await rateLimit(`chat:ip:${input.ipHash}`, settings.per_ip_per_minute, 60))) return { ok: false, error: "You're sending messages quickly — please wait a moment.", status: 429 };

  let token = input.token;
  let conv = await findConversation(token);
  if (!conv) {
    token = randomToken(24);
    const [c] = await system((tx) => tx<Conv[]>`insert into public.chat_conversations (token_hash, ip_hash) values (${sha256(token!)}, ${input.ipHash}) returning id, mode, status`);
    conv = c;
    if (Math.random() < 0.02) void purgeOld(settings.retention_days);
  }
  if (!(await rateLimit(`chat:conv:${conv.id}`, settings.per_conversation_per_hour, 3600))) return { ok: false, error: "This chat has reached its hourly limit. A team member can still help — call us or try later.", status: 429 };

  const intent = input.wantHuman ? "human" : classify(text);
  await system(async (tx) => {
    if (text) await tx`insert into public.chat_messages (conversation_id, role, content, meta) values (${conv!.id}, 'user', ${text}, ${tx.json({ intent })})`;
    await tx`update public.chat_conversations set last_message_at = now(), status = case when status = 'resolved' then 'open' else status end,
      admin_unread = ${conv!.mode === "human" || intent === "human"} or admin_unread,
      mode = case when ${intent === "human"} then 'human' else mode end, needs_human = needs_human or ${intent === "human"}
      where id = ${conv!.id}`;
  });

  // Hand-off: the team replies from /admin/chat.
  if (intent === "human" || conv.mode === "human") {
    if (conv.mode === "human" && intent !== "human") return { ok: true, token: token!, mode: "human", reply: null };
    const content = isBangla(text) ? "আমাদের টিমকে জানানো হয়েছে — একজন সদস্য এখানেই উত্তর দেবেন। কাজের সময়: শনি–বৃহস্পতি, সকাল ১০টা–রাত ৮টা।" : "I've let our team know — a person will reply right here. (Support hours are shown on the Help page.)";
    return { ok: true, token: token!, mode: "human", reply: await saveAssistant(conv.id, content, { intent, source: "handoff" }) };
  }

  const ctx = await retrieve(intent, text, input.orders);
  let reply: string;
  let meta: Record<string, unknown> = { intent, source: "fallback", products: ctx.products.map((p) => ({ name: p.name, url: p.url, price: p.price })) };

  if (settings.enabled && geminiConfigured()) {
    const store = (await getPublicSettings()).store;
    const history = await system((tx) => tx<{ role: string; content: string }[]>`
      select role, content from public.chat_messages where conversation_id = ${conv!.id} and role in ('user','assistant','admin') order by id desc limit 9`);
    const contents = history.reverse().map((m) => ({ role: (m.role === "user" ? "user" : "model") as "user" | "model", text: m.role === "admin" ? `(Team member) ${m.content}` : m.content }));
    // Ground the latest turn with retrieved data.
    if (contents.length) contents[contents.length - 1] = { role: "user", text: `${contextBlock(ctx)}\n\nCustomer: ${text}` };
    try {
      const r = await generate(systemPrompt(store.name), contents, settings);
      reply = r.text.slice(0, 3000);
      meta = { ...meta, source: "gemini" };
      await logUsage(conv.id, settings.model, intent, r.inputTokens, r.outputTokens, r.latencyMs, true, null);
    } catch (e) {
      reply = fallbackReply(ctx, isBangla(text));
      await logUsage(conv.id, settings.model, intent, null, null, null, false, (e as Error).message.slice(0, 300));
    }
  } else {
    reply = fallbackReply(ctx, isBangla(text));
  }
  return { ok: true, token: token!, mode: "ai", reply: await saveAssistant(conv.id, reply, meta) };
}

async function saveAssistant(conversationId: string, content: string, meta: Record<string, unknown>): Promise<ChatMessage> {
  const [m] = await system((tx) => tx<ChatMessage[]>`insert into public.chat_messages (conversation_id, role, content, meta) values (${conversationId}, 'assistant', ${content}, ${tx.json(meta as never)}) returning id::int, role, content, created_at`);
  return { ...m, created_at: new Date(m.created_at).toISOString() };
}

async function logUsage(conversationId: string, model: string, intent: string, inTok: number | null, outTok: number | null, ms: number | null, ok: boolean, error: string | null) {
  await system((tx) => tx`insert into public.ai_usage (conversation_id, model, intent, input_tokens, output_tokens, latency_ms, ok, error) values (${conversationId}, ${model}, ${intent}, ${inTok}, ${outTok}, ${ms}, ${ok}, ${error})`).catch(() => {});
}

/** Retention: conversations idle longer than the configured period are deleted. */
export async function purgeOld(days: number) {
  await system((tx) => tx`delete from public.chat_conversations where last_message_at < now() - make_interval(days => ${days})`).catch(() => {});
}
