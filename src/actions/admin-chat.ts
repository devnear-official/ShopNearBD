"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/components/admin/form";

export async function replyToChat(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ conversationId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Write a reply first." };
  try {
    const admin = await requireAdmin();
    await admin.db(async (tx) => {
      await tx`insert into public.chat_messages (conversation_id, role, content, author_id) values (${p.data.conversationId}, 'admin', ${p.data.body}, ${admin.id})`;
      await tx`update public.chat_conversations set mode = 'human', status = 'pending', admin_unread = false, last_message_at = now() where id = ${p.data.conversationId}`;
    });
    revalidatePath("/admin/chat");
    return { ok: true, message: "Reply sent." };
  } catch {
    return { ok: false, error: "Couldn't send the reply." };
  }
}

export async function updateConversation(_: ActionState, form: FormData): Promise<ActionState> {
  const p = z.object({ conversationId: z.string().uuid(), status: z.enum(["open", "pending", "resolved"]).optional(), mode: z.enum(["ai", "human"]).optional() }).safeParse(Object.fromEntries(form));
  if (!p.success) return { ok: false, error: "Invalid." };
  try {
    const admin = await requireAdmin();
    await admin.db(async (tx) => {
      if (p.data.status) await tx`update public.chat_conversations set status = ${p.data.status}, needs_human = case when ${p.data.status} = 'resolved' then false else needs_human end where id = ${p.data.conversationId}`;
      if (p.data.mode) {
        await tx`update public.chat_conversations set mode = ${p.data.mode}, needs_human = ${p.data.mode === "human"} where id = ${p.data.conversationId}`;
        await tx`insert into public.chat_messages (conversation_id, role, content) values (${p.data.conversationId}, 'system', ${p.data.mode === "ai" ? "Handed back to the assistant" : "A team member took over"})`;
      }
    });
    revalidatePath("/admin/chat");
    return { ok: true, message: "Conversation updated." };
  } catch {
    return { ok: false, error: "Couldn't update." };
  }
}
