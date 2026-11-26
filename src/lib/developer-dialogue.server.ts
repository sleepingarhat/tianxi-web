import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

import {
  DIALOGUE_PAGE_SIZE,
  dialogueErrorMessage,
  toDialoguePost,
  type DialogueDb,
  type DialogueModeration,
  type DialoguePost,
  type DialogueRow,
} from "./developer-dialogue";

const TABLE = "developer_dialogue";
const COLUMNS =
  "id,root_id,parent_id,author_id,author_label,staff,body,created_at,hidden_at,closed_at";

type QueryError = { message: string; code?: string } | null;

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function envClient(token?: string): SupabaseClient {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("對話服務暫時未能連接");
  return createClient(url, key, {
    global: {
      fetch: createSupabaseFetch(key),
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function dialogueReader(): Promise<{ db: DialogueDb; userId: string | null }> {
  const header = getRequest()?.headers?.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token || token.split(".").length !== 3)
    return { db: envClient() as unknown as DialogueDb, userId: null };
  const client = envClient(token);
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub)
    return { db: envClient() as unknown as DialogueDb, userId: null };
  return { db: client as unknown as DialogueDb, userId: data.claims.sub };
}

function fail(error: QueryError): void {
  if (error) throw new Error(dialogueErrorMessage(`${error.code ?? ""} ${error.message}`));
}

function rowsOf(data: unknown): DialogueRow[] {
  return Array.isArray(data) ? (data as DialogueRow[]) : [];
}

export async function listDialogueFeed(
  db: DialogueDb,
  userId: string | null,
  before?: string,
): Promise<{ posts: DialoguePost[]; hasMore: boolean }> {
  let query = db.from(TABLE).select(COLUMNS).is("parent_id", null);
  if (before) query = query.lt("created_at", before);
  const listed = await query
    .order("created_at", { ascending: false })
    .limit(DIALOGUE_PAGE_SIZE + 1);
  fail(listed.error);
  const raw = rowsOf(listed.data);
  const hasMore = raw.length > DIALOGUE_PAGE_SIZE;
  const page = raw.slice(0, DIALOGUE_PAGE_SIZE);
  const ids = page.map((row) => row.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const replies = await db
      .from(TABLE)
      .select("root_id")
      .in("root_id", ids)
      .not("parent_id", "is", null);
    fail(replies.error);
    for (const row of rowsOf(replies.data)) {
      counts.set(row.root_id, (counts.get(row.root_id) ?? 0) + 1);
    }
  }
  return {
    posts: page.map((row) => toDialoguePost(row, userId, counts.get(row.id) ?? 0)),
    hasMore,
  };
}

export async function readDialogueThread(
  db: DialogueDb,
  userId: string | null,
  postId: string,
): Promise<{ root: DialoguePost; replies: DialoguePost[] }> {
  const found = await db.from(TABLE).select(COLUMNS).eq("id", postId).maybeSingle();
  fail(found.error);
  const target = found.data as DialogueRow | null;
  if (!target?.root_id) throw new Error(dialogueErrorMessage("NOT_FOUND"));
  let rootRow: DialogueRow | null = target;
  if (target.parent_id || target.root_id !== target.id) {
    const root = await db.from(TABLE).select(COLUMNS).eq("id", target.root_id).maybeSingle();
    fail(root.error);
    rootRow = root.data as DialogueRow | null;
  }
  if (!rootRow || rootRow.parent_id) throw new Error(dialogueErrorMessage("NOT_FOUND"));
  const rootId = rootRow.id;
  const replies = await db
    .from(TABLE)
    .select(COLUMNS)
    .eq("root_id", rootId)
    .neq("id", rootId)
    .order("created_at", { ascending: true });
  fail(replies.error);
  return {
    root: toDialoguePost(rootRow, userId),
    replies: rowsOf(replies.data).map((row) => toDialoguePost(row, userId)),
  };
}

export async function insertDialoguePost(
  db: DialogueDb,
  userId: string,
  body: string,
  parentId?: string,
): Promise<DialoguePost> {
  const inserted = await db
    .from(TABLE)
    .insert({ body, author_id: userId, ...(parentId ? { parent_id: parentId } : {}) })
    .select(COLUMNS)
    .single();
  fail(inserted.error);
  return toDialoguePost(inserted.data as DialogueRow, userId);
}

export async function moderateDialoguePost(
  db: DialogueDb,
  userId: string,
  postId: string,
  action: DialogueModeration,
): Promise<{ ok: true }> {
  if (action === "close" || action === "open") {
    const row = await db.from(TABLE).select("id,parent_id").eq("id", postId).maybeSingle();
    fail(row.error);
    const target = row.data as { id: string; parent_id: string | null } | null;
    if (!target) throw new Error(dialogueErrorMessage("NOT_FOUND"));
    if (target.parent_id) throw new Error(dialogueErrorMessage("NOT_ROOT"));
  }
  const patch =
    action === "hide"
      ? { hidden_at: new Date().toISOString(), hidden_by: userId }
      : action === "unhide"
        ? { hidden_at: null, hidden_by: null }
        : action === "close"
          ? { closed_at: new Date().toISOString(), closed_by: userId }
          : { closed_at: null, closed_by: null };
  const updated = await db.from(TABLE).update(patch).eq("id", postId).select("id");
  fail(updated.error);
  if (!updated.data || (Array.isArray(updated.data) && updated.data.length !== 1)) {
    throw new Error(dialogueErrorMessage("NOT_FOUND"));
  }
  return { ok: true };
}
