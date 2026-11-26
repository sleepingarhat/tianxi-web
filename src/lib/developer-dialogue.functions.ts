import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import {
  dialogueErrorMessage,
  parseDialogueModeration,
  parseDialoguePost,
  type DialogueDb,
} from "./developer-dialogue";

/** 公開讀取。已登入嘅管理帳號先睇到已隱藏嘅帖；訪客同一般會員只見公開帖。 */
export const listDialoguePosts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const record = typeof data === "object" && data !== null ? (data as { before?: unknown }) : {};
    const before = record.before;
    if (
      before !== undefined &&
      (typeof before !== "string" || !Number.isFinite(Date.parse(before)))
    ) {
      throw new Error(dialogueErrorMessage("BAD_INPUT"));
    }
    return { ...(typeof before === "string" ? { before } : {}) };
  })
  .handler(async ({ data }) => {
    const { dialogueReader, listDialogueFeed } = await import("./developer-dialogue.server");
    const { db, userId } = await dialogueReader();
    return listDialogueFeed(db, userId, data.before);
  });

/** 打開一篇帖同佢嘅回覆樹。傳回覆 id 都會回到開場嗰篇。 */
export const getDialogueThread = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const record = typeof data === "object" && data !== null ? (data as { postId?: unknown }) : {};
    if (typeof record.postId !== "string") throw new Error(dialogueErrorMessage("NOT_FOUND"));
    return { postId: record.postId };
  })
  .handler(async ({ data }) => {
    const { dialogueReader, readDialogueThread } = await import("./developer-dialogue.server");
    const { db, userId } = await dialogueReader();
    return readDialogueThread(db, userId, data.postId);
  });

/** 已登入先可以發帖或回覆。唔檢查 Pro。 */
export const createDialoguePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseDialoguePost(data))
  .handler(async ({ data, context }) => {
    const parsed = parseDialoguePost(data);
    const { insertDialoguePost } = await import("./developer-dialogue.server");
    try {
      return await insertDialoguePost(
        context.supabase as unknown as DialogueDb,
        context.userId,
        parsed.body,
        parsed.parentId,
      );
    } catch (error) {
      throw new Error(dialogueErrorMessage(error));
    }
  });

/** 管理帳號隱藏、取消隱藏、關閉或重開整串對話。 */
export const moderateDialogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseDialogueModeration(data))
  .handler(async ({ data, context }) => {
    const parsed = parseDialogueModeration(data);
    const role = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (role.error || role.data !== true) throw new Error("此操作只限管理員");
    const { moderateDialoguePost } = await import("./developer-dialogue.server");
    try {
      return await moderateDialoguePost(
        context.supabase as unknown as DialogueDb,
        context.userId,
        parsed.postId,
        parsed.action,
      );
    } catch (error) {
      throw new Error(dialogueErrorMessage(error));
    }
  });
