import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      middleware: () => chain,
      inputValidator: () => chain,
      handler: (fn: unknown) => fn,
    };
    return chain;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));

import { moderateDialogue } from "./developer-dialogue.functions";
import {
  assertDialogueBody,
  buildDialogueTree,
  dialogueErrorMessage,
  publicAuthorLabel,
  toDialoguePost,
  type DialoguePost,
  type DialogueRow,
} from "./developer-dialogue";

const root = join(__dirname, "..", "..");

function post(
  partial: Partial<DialoguePost> & Pick<DialoguePost, "id" | "parentId" | "createdAt">,
): DialoguePost {
  return {
    rootId: "root",
    authorLabel: "會員",
    staff: false,
    mine: false,
    body: partial.id,
    hidden: false,
    closed: false,
    ...partial,
  };
}

describe("與開發者對話", () => {
  it("公開名稱唔會帶電郵或控制字元", () => {
    expect(publicAuthorLabel(" 陳大文 ")).toBe("陳大文");
    expect(publicAuthorLabel("a@b.com")).toBe("會員");
    expect(publicAuthorLabel("名\n字")).toBe("名字");
    expect(publicAuthorLabel("")).toBe("會員");
    expect(publicAuthorLabel("超".repeat(50))).toHaveLength(40);
  });

  it("留言要有字，而且唔超過 500 字", () => {
    expect(assertDialogueBody("  你好  ")).toBe("你好");
    expect(() => assertDialogueBody("   ")).toThrow("BODY_LENGTH");
    expect(() => assertDialogueBody("好".repeat(501))).toThrow("BODY_LENGTH");
  });

  it("錯誤碼譯成會員睇得明嘅句子，唔會帶出資料庫原文", () => {
    expect(dialogueErrorMessage(new Error("Unauthorized: No authorization header"))).toBe(
      "請先登入先可以留言",
    );
    expect(dialogueErrorMessage("THREAD_CLOSED")).toBe("此對話已關閉，暫時不能回覆");
    expect(dialogueErrorMessage("PGRST205 schema cache")).toBe(
      "對話區尚未啟用，資料表套用後先可以讀寫",
    );
    expect(dialogueErrorMessage("duplicate key value violates unique constraint")).toBe(
      "暫時未能完成，請再試一次",
    );
  });

  it("回覆可以分支；已隱藏嘅中間層喺公開樹會跳過", () => {
    const posts = [
      post({ id: "root", parentId: null, createdAt: "2026-11-26T01:00:00Z" }),
      post({ id: "a", parentId: "root", createdAt: "2026-11-26T02:00:00Z", authorLabel: "甲" }),
      post({
        id: "b",
        parentId: "a",
        createdAt: "2026-11-26T03:00:00Z",
        authorLabel: "乙",
        hidden: true,
      }),
      post({ id: "c", parentId: "b", createdAt: "2026-11-26T04:00:00Z", authorLabel: "丙" }),
    ];
    const hidden = buildDialogueTree(posts, "root", true);
    expect(hidden.map((node) => node.post.id)).toEqual(["a"]);
    expect(hidden[0]?.children.map((node) => node.post.id)).toEqual(["b"]);
    expect(hidden[0]?.children[0]?.children.map((node) => node.post.id)).toEqual(["c"]);

    const visible = buildDialogueTree(
      posts.filter((item) => !item.hidden),
      "root",
      false,
    );
    expect(visible.map((node) => node.post.id)).toEqual(["a", "c"]);
    expect(visible[0]?.children).toEqual([]);
  });

  it("回傳唔包含作者內部 id，只標記係咪自己", () => {
    const row: DialogueRow = {
      id: "11111111-1111-4111-8111-111111111111",
      root_id: "11111111-1111-4111-8111-111111111111",
      parent_id: null,
      author_id: "22222222-2222-4222-8222-222222222222",
      author_label: "secret@example.com",
      staff: true,
      body: "收到",
      created_at: "2026-11-26T01:00:00Z",
      hidden_at: null,
      closed_at: null,
    };
    const mine = toDialoguePost(row, row.author_id);
    expect(mine.mine).toBe(true);
    expect(mine.authorLabel).toBe("會員");
    expect(mine.staff).toBe(true);
    expect(JSON.stringify(mine)).not.toContain(row.author_id);
    expect(toDialoguePost(row, "33333333-3333-4333-8333-333333333333").mine).toBe(false);
  });

  it("一般會員唔可以隱藏或關閉對話", async () => {
    const from = vi.fn();
    const invoke = moderateDialogue as unknown as (value: {
      data: { postId: string; action: "hide" };
      context: {
        userId: string;
        supabase: { rpc: () => Promise<{ data: boolean; error: null }>; from: typeof from };
      };
    }) => Promise<unknown>;
    await expect(
      invoke({
        data: { postId: "11111111-1111-4111-8111-111111111111", action: "hide" },
        context: {
          userId: "member",
          supabase: { rpc: async () => ({ data: false, error: null }), from },
        },
      }),
    ).rejects.toThrow("此操作只限管理員");
    expect(from).not.toHaveBeenCalled();
  });

  it("頁面、導航同資料表都係公開讀、登入先寫，而且唔經 Pro 閘", () => {
    const layout = readFileSync(join(root, "src/routes/dialogue.tsx"), "utf8");
    const dialogue = readFileSync(join(root, "src/routes/dialogue.index.tsx"), "utf8");
    const thread = readFileSync(join(root, "src/routes/dialogue.$postId.tsx"), "utf8");
    const shell = readFileSync(join(root, "src/components/tx/AppShell.tsx"), "utf8");
    const home = readFileSync(join(root, "src/components/tx/EngineLanding.tsx"), "utf8");
    const fn = readFileSync(join(root, "src/lib/developer-dialogue.functions.ts"), "utf8");
    const sql = readFileSync(join(root, "drizzle/migrations/0047_developer_dialogue.sql"), "utf8");
    for (const src of [dialogue, thread, shell, home]) expect(src).toContain("與開發者對話");
    expect(layout).toContain("<Outlet />");
    expect(layout).toContain('createFileRoute("/dialogue")');
    expect(dialogue).toContain('createFileRoute("/dialogue/")');
    expect(thread).toContain('createFileRoute("/dialogue/$postId")');
    expect(fn).toContain("requireSupabaseAuth");
    expect(fn).not.toContain("requireTier");
    expect(dialogue + thread).not.toContain("UpgradeCard");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).not.toContain("FORCE ROW LEVEL SECURITY");
    expect(sql).toContain("GRANT SELECT ON public.developer_dialogue TO anon, authenticated");
    expect(sql).not.toMatch(/GRANT INSERT[^;]*TO anon/);
    expect(sql).toContain("SIGN_IN_REQUIRED");
    expect(sql).toContain("THREAD_CLOSED");
    expect(sql).toContain("RATE_LIMIT");
    expect(sql).toContain("has_role(auth.uid(), 'admin')");
  });
});
