/** 與開發者對話：公開帖同分支回覆嘅純規則。資料表係 Supabase developer_dialogue。 */

export const DIALOGUE_BODY_MAX = 500;
export const DIALOGUE_PAGE_SIZE = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DialoguePost = {
  id: string;
  rootId: string;
  parentId: string | null;
  authorLabel: string;
  staff: boolean;
  mine: boolean;
  body: string;
  createdAt: string;
  hidden: boolean;
  closed: boolean;
  replyCount?: number;
};

export type DialogueRow = {
  id: string;
  root_id: string;
  parent_id: string | null;
  author_id: string;
  author_label: string;
  staff: boolean;
  body: string;
  created_at: string;
  hidden_at: string | null;
  closed_at: string | null;
};

export type DialogueNode = {
  post: DialoguePost;
  children: DialogueNode[];
};

const ERRORS: [string, string][] = [
  ["SIGN_IN_REQUIRED", "請先登入先可以留言"],
  ["Unauthorized", "請先登入先可以留言"],
  ["THREAD_CLOSED", "此對話已關閉，暫時不能回覆"],
  ["RATE_LIMIT", "留言太密，請一小時後再試"],
  ["BODY_LENGTH", "留言請寫 1 至 500 字"],
  ["PARENT_MISSING", "找不到要回覆嘅留言"],
  ["PARENT_HIDDEN", "這則留言已隱藏，不能再回覆"],
  ["THREAD_HIDDEN", "這串對話已隱藏"],
  ["THREAD_TOO_DEEP", "回覆層數已到上限"],
  ["ROOT_MISSING", "找不到原來嗰篇帖"],
  ["ADMIN_ONLY", "此操作只限管理員"],
  ["NOT_ROOT", "只可以關閉整串對話"],
  ["NOT_FOUND", "找不到這篇帖"],
  ["PGRST205", "對話區尚未啟用，資料表套用後先可以讀寫"],
  ["42P01", "對話區尚未啟用，資料表套用後先可以讀寫"],
  ["schema cache", "對話區尚未啟用，資料表套用後先可以讀寫"],
  ["BAD_INPUT", "暫時未能完成，請再試一次"],
];

export function dialogueErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  for (const [code, message] of ERRORS) {
    if (raw.includes(code) || raw.includes(message)) return message;
  }
  return "暫時未能完成，請再試一次";
}

export type DialogueResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

/** 未入生成類型嘅 developer_dialogue 查詢。migration 0047 套用後先有呢張表。 */
export interface DialogueQuery extends PromiseLike<DialogueResult> {
  select(columns: string): DialogueQuery;
  insert(row: Record<string, unknown>): DialogueQuery;
  update(patch: Record<string, unknown>): DialogueQuery;
  eq(column: string, value: string): DialogueQuery;
  neq(column: string, value: string): DialogueQuery;
  is(column: string, value: null): DialogueQuery;
  in(column: string, values: string[]): DialogueQuery;
  not(column: string, operator: string, value: null): DialogueQuery;
  lt(column: string, value: string): DialogueQuery;
  order(column: string, options: { ascending: boolean }): DialogueQuery;
  limit(count: number): DialogueQuery;
  maybeSingle(): Promise<DialogueResult>;
  single(): Promise<DialogueResult>;
}

export type DialogueDb = { from: (table: string) => DialogueQuery };

function withoutControls(value: string, keep: readonly number[]): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if ((code <= 31 || code === 127) && !keep.includes(code)) continue;
    out += char;
  }
  return out;
}

/** 公開名稱：唔顯示電郵、控制字元，或長過 40 字。 */
export function publicAuthorLabel(raw: unknown): string {
  const text = withoutControls(String(raw ?? ""), []).trim();
  if (!text || text.includes("@")) return "會員";
  return [...text].slice(0, 40).join("");
}

export function assertDialogueBody(raw: unknown): string {
  if (typeof raw !== "string") throw new Error("BODY_LENGTH");
  const body = withoutControls(raw, [9, 10]).trim();
  if (body.length < 1 || body.length > DIALOGUE_BODY_MAX) throw new Error("BODY_LENGTH");
  return body;
}

export function parseDialoguePost(data: unknown): { body: string; parentId?: string } {
  if (typeof data !== "object" || data === null) throw new Error("BAD_INPUT");
  const record = data as { body?: unknown; parentId?: unknown };
  if (
    record.parentId !== undefined &&
    (typeof record.parentId !== "string" || !UUID.test(record.parentId))
  ) {
    throw new Error("PARENT_MISSING");
  }
  return {
    body: assertDialogueBody(record.body),
    ...(typeof record.parentId === "string" ? { parentId: record.parentId } : {}),
  };
}

export type DialogueModeration = "hide" | "unhide" | "close" | "open";

export function parseDialogueModeration(data: unknown): {
  postId: string;
  action: DialogueModeration;
} {
  if (typeof data !== "object" || data === null) throw new Error("BAD_INPUT");
  const record = data as { postId?: unknown; action?: unknown };
  if (typeof record.postId !== "string" || !UUID.test(record.postId)) throw new Error("NOT_FOUND");
  if (
    record.action !== "hide" &&
    record.action !== "unhide" &&
    record.action !== "close" &&
    record.action !== "open"
  ) {
    throw new Error("BAD_INPUT");
  }
  return { postId: record.postId, action: record.action };
}

export function toDialoguePost(
  row: DialogueRow,
  userId: string | null,
  replyCount?: number,
): DialoguePost {
  return {
    id: row.id,
    rootId: row.root_id,
    parentId: row.parent_id,
    authorLabel: publicAuthorLabel(row.author_label),
    staff: row.staff === true,
    mine: !!userId && row.author_id === userId,
    body: row.body,
    createdAt: row.created_at,
    hidden: row.hidden_at != null,
    closed: row.closed_at != null,
    ...(replyCount === undefined ? {} : { replyCount }),
  };
}

/**
 * 將一串帖砌成樹。管理員清單包含已隱藏留言時，子回覆留喺原位。
 * 公開清單冇隱藏留言，指去已隱藏上層嘅回覆會掛回開場帖，避免成段消失。
 */
export function buildDialogueTree(
  posts: DialoguePost[],
  rootId: string,
  preserveHidden: boolean,
): DialogueNode[] {
  const visible = preserveHidden ? posts : posts.filter((post) => !post.hidden);
  const byId = new Map(visible.map((post) => [post.id, post]));
  const children = new Map<string, DialoguePost[]>();
  for (const post of visible) {
    if (post.id === rootId) continue;
    const parent = anchorParent(post, byId, rootId, preserveHidden);
    const list = children.get(parent) ?? [];
    list.push(post);
    children.set(parent, list);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }
  const nest = (id: string): DialogueNode[] =>
    (children.get(id) ?? []).map((post) => ({ post, children: nest(post.id) }));
  return nest(rootId);
}

function anchorParent(
  post: DialoguePost,
  byId: Map<string, DialoguePost>,
  rootId: string,
  preserveHidden: boolean,
): string {
  let parentId = post.parentId;
  const seen = new Set<string>();
  while (parentId && parentId !== rootId) {
    if (seen.has(parentId)) return rootId;
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) return rootId;
    if (!parent.hidden || preserveHidden) return parent.id;
    parentId = parent.parentId;
  }
  return rootId;
}
