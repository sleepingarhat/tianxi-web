import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { hkDateTime } from "@/lib/hkTime";
import {
  DIALOGUE_BODY_MAX,
  buildDialogueTree,
  dialogueErrorMessage,
  type DialogueNode,
  type DialoguePost,
} from "@/lib/developer-dialogue";
import {
  createDialoguePost,
  getDialogueThread,
  listDialoguePosts,
  moderateDialogue,
} from "@/lib/developer-dialogue.functions";
import { useAuthState } from "@/lib/useAuthState";

import { Card, Loading, PageHead, Pill, TxCta } from "./ui";
import { Textarea } from "@/components/ui/textarea";

function PostBody({ post, parentLabel }: { post: DialoguePost; parentLabel?: string | undefined }) {
  return (
    <article className={`min-w-0 ${post.hidden ? "opacity-60" : ""}`}>
      <header className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-deep font-serif-tc text-[14px] font-bold text-gold-strong"
        >
          {(post.authorLabel || "會").slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-serif-tc text-[14px] font-bold text-ink">{post.authorLabel}</span>
            {post.staff ? <Pill tone="gold">管理</Pill> : null}
            {post.mine ? <Pill>你</Pill> : null}
            {post.hidden ? <Pill tone="lose">已隱藏</Pill> : null}
            {post.closed && !post.parentId ? <Pill>已關閉</Pill> : null}
            <time dateTime={post.createdAt} className="tabnum font-mono-tx text-[11px] text-ink-3">
              {hkDateTime(post.createdAt)} HKT
            </time>
          </p>
          {parentLabel ? <p className="mt-0.5 text-[11px] text-ink-3">回覆 {parentLabel}</p> : null}
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink">
            {post.body}
          </p>
        </div>
      </header>
    </article>
  );
}

function Composer({
  placeholder,
  replyLabel,
  onCancelReply,
  onSubmit,
  disabled,
}: {
  placeholder: string;
  replyLabel?: string | undefined;
  onCancelReply?: (() => void) | undefined;
  onSubmit: (body: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const length = body.trim().length;
  const remaining = DIALOGUE_BODY_MAX - length;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || disabled) return;
    setPending(true);
    try {
      await onSubmit(body);
      setBody("");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-2">
      {replyLabel ? (
        <p className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
          <span>回覆 {replyLabel}</span>
          {onCancelReply ? (
            <button type="button" className="font-bold text-gold" onClick={onCancelReply}>
              取消
            </button>
          ) : null}
        </p>
      ) : null}
      <label className="sr-only" htmlFor="dialogue-body">
        留言
      </label>
      <Textarea
        id="dialogue-body"
        value={body}
        maxLength={DIALOGUE_BODY_MAX}
        rows={3}
        disabled={disabled || pending}
        placeholder={placeholder}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <span
          className={`tabnum font-mono-tx text-[11px] ${remaining < 0 ? "text-lose" : "text-ink-3"}`}
        >
          {Math.max(0, length)}/{DIALOGUE_BODY_MAX}
        </span>
        <TxCta
          type="submit"
          variant="gold"
          size="sm"
          disabled={disabled || pending || body.trim().length < 1 || remaining < 0}
        >
          {pending ? "發佈中…" : "發佈"}
        </TxCta>
      </div>
    </form>
  );
}

function WriteGate({ next, children }: { next: string; children: ReactNode }) {
  const { signedIn } = useAuthState();
  if (signedIn === null) return <p className="text-[12px] text-ink-3">讀取登入狀態…</p>;
  if (!signedIn) {
    return (
      <p className="text-[13px] leading-relaxed text-ink-2">
        登入後可以發帖同回覆。
        <Link to="/auth" search={{ next }} className="ml-1 font-bold text-gold">
          登入
        </Link>
      </p>
    );
  }
  return children;
}

function ModerateButtons({ post, onDone }: { post: DialoguePost; onDone: () => Promise<void> }) {
  const { isAdmin } = useAuthState();
  const moderate = useServerFn(moderateDialogue);
  const [pending, setPending] = useState(false);
  if (!isAdmin) return null;

  async function run(action: "hide" | "unhide" | "close" | "open") {
    setPending(true);
    try {
      await moderate({ data: { postId: post.id, action } });
      toast.success(
        action === "hide"
          ? "已隱藏"
          : action === "unhide"
            ? "已重新公開"
            : action === "close"
              ? "已關閉對話"
              : "已重開對話",
      );
      await onDone();
    } catch (error) {
      toast.error(dialogueErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        className="text-[12px] font-bold text-ink-3 hover:text-ink disabled:opacity-50"
        onClick={() => void run(post.hidden ? "unhide" : "hide")}
      >
        {post.hidden ? "重新公開" : "隱藏"}
      </button>
      {post.parentId ? null : (
        <button
          type="button"
          disabled={pending}
          className="text-[12px] font-bold text-ink-3 hover:text-ink disabled:opacity-50"
          onClick={() => void run(post.closed ? "open" : "close")}
        >
          {post.closed ? "重開對話" : "關閉對話"}
        </button>
      )}
    </div>
  );
}

function ThreadNodes({
  nodes,
  depth,
  labels,
  rootId,
  closed,
  replyTo,
  setReplyTo,
  onDone,
}: {
  nodes: DialogueNode[];
  depth: number;
  labels: Map<string, string>;
  rootId: string;
  closed: boolean;
  replyTo: string | null;
  setReplyTo: (id: string) => void;
  onDone: () => Promise<void>;
}) {
  return (
    <div
      className={
        depth > 0 && depth <= 3 ? "ml-3 border-l border-hairline pl-2" : depth > 3 ? "mt-2" : ""
      }
    >
      {nodes.map((node) => {
        const parent =
          node.post.parentId && node.post.parentId !== rootId
            ? labels.get(node.post.parentId)
            : undefined;
        return (
          <div key={node.post.id} className="border-b border-hairline py-3 last:border-b-0">
            <PostBody post={node.post} parentLabel={parent} />
            <div className="mt-2 flex flex-wrap items-center gap-3 pl-11">
              {closed || node.post.hidden ? null : (
                <button
                  type="button"
                  className="text-[12px] font-bold text-gold"
                  onClick={() => setReplyTo(node.post.id)}
                >
                  回覆
                </button>
              )}
            </div>
            <div className="pl-11">
              <ModerateButtons post={node.post} onDone={onDone} />
            </div>
            {replyTo === node.post.id ? (
              <p className="mt-2 pl-11 text-[12px] text-ink-3">
                喺下面回覆 {node.post.authorLabel}
              </p>
            ) : null}
            <ThreadNodes
              nodes={node.children}
              depth={depth + 1}
              labels={labels}
              rootId={rootId}
              closed={closed}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              onDone={onDone}
            />
          </div>
        );
      })}
    </div>
  );
}

export function DialogueFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[680px]">
      <PageHead
        en="Talk with the developers"
        title="與開發者對話"
        desc="公開留言。第一則係一篇帖，打開可以睇成串回覆；其他人同管理帳號都可以加入，回覆亦可以再分支。"
      />
      {children}
    </div>
  );
}

export function DialogueFeed() {
  const list = useServerFn(listDialoguePosts);
  const create = useServerFn(createDialoguePost);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["developer-dialogue", "feed"],
    queryFn: () => list({ data: {} }),
  });
  const [older, setOlder] = useState<DialoguePost[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const newest = query.data?.posts[0]?.id ?? "";

  useEffect(() => {
    setOlder([]);
    setHasMore(query.data?.hasMore ?? false);
  }, [newest, query.data?.hasMore]);

  const posts = [...(query.data?.posts ?? []), ...older];

  async function publish(body: string) {
    try {
      await create({ data: { body } });
      toast.success("已發佈");
      await client.invalidateQueries({ queryKey: ["developer-dialogue"] });
    } catch (error) {
      toast.error(dialogueErrorMessage(error));
      throw error;
    }
  }

  async function loadOlder() {
    const cursor = posts.at(-1)?.createdAt;
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await list({ data: { before: cursor } });
      setOlder((current) => {
        const seen = new Set(posts.map((post) => post.id));
        return [...current, ...page.posts.filter((post) => !seen.has(post.id))];
      });
      setHasMore(page.hasMore);
    } catch (error) {
      toast.error(dialogueErrorMessage(error));
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <>
      <Card title="寫一則新帖" en="New post">
        <WriteGate next="/dialogue">
          <Composer placeholder="寫低你想同開發者講嘅嘢…" onSubmit={publish} />
        </WriteGate>
      </Card>
      {query.isPending ? (
        <div className="mx-4 my-3">
          <Loading label="讀取帖文…" />
        </div>
      ) : null}
      {query.isError ? (
        <p className="mx-4 my-3 text-[13px] text-lose">{dialogueErrorMessage(query.error)}</p>
      ) : null}
      {query.isSuccess && posts.length === 0 ? (
        <p className="mx-4 my-6 text-[13px] leading-relaxed text-ink-2">
          未有帖文。登入之後可以寫第一則。
        </p>
      ) : null}
      <div>
        {posts.map((post) => (
          <Card key={post.id} className="tx-wide">
            <Link
              to="/dialogue/$postId"
              params={{ postId: post.id }}
              className="block hover:opacity-90"
            >
              <PostBody post={post} />
            </Link>
            <p className="mt-2 pl-11 text-[12px] font-bold text-gold">
              <Link to="/dialogue/$postId" params={{ postId: post.id }}>
                {post.replyCount ? `${post.replyCount} 則回覆` : "回覆"}
              </Link>
            </p>
          </Card>
        ))}
      </div>
      {hasMore ? (
        <div className="mx-4 mb-4">
          <TxCta
            type="button"
            variant="outline"
            size="sm"
            disabled={loadingOlder}
            onClick={() => void loadOlder()}
          >
            {loadingOlder ? "讀取中…" : "更早的帖"}
          </TxCta>
        </div>
      ) : null}
    </>
  );
}

export function DialogueThread({ postId }: { postId: string }) {
  const read = useServerFn(getDialogueThread);
  const create = useServerFn(createDialoguePost);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["developer-dialogue", "thread", postId],
    queryFn: () => read({ data: { postId } }),
  });
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const root = query.data?.root;
  const replies = query.data?.replies ?? [];
  const labels = new Map<string, string>([
    ...(root ? [[root.id, root.authorLabel] as [string, string]] : []),
    ...replies.map((post) => [post.id, post.authorLabel] as [string, string]),
  ]);
  const tree = root ? buildDialogueTree([root, ...replies], root.id, true) : [];
  const target = replyTo ? labels.get(replyTo) : root?.authorLabel;

  useEffect(() => {
    if (root && replyTo === null) setReplyTo(root.id);
  }, [root, replyTo]);

  async function refresh() {
    await client.invalidateQueries({ queryKey: ["developer-dialogue"] });
  }

  async function publish(body: string) {
    if (!replyTo) return;
    try {
      await create({ data: { body, parentId: replyTo } });
      toast.success("已回覆");
      await refresh();
    } catch (error) {
      toast.error(dialogueErrorMessage(error));
      throw error;
    }
  }

  return (
    <>
      <p className="mx-4 mt-3">
        <Link to="/dialogue" className="text-[12px] font-bold text-gold">
          ← 全部帖文
        </Link>
      </p>
      {query.isPending ? (
        <div className="mx-4 my-3">
          <Loading label="讀取對話…" />
        </div>
      ) : null}
      {query.isError ? (
        <p className="mx-4 my-3 text-[13px] text-lose">{dialogueErrorMessage(query.error)}</p>
      ) : null}
      {root ? (
        <Card title="對話" en="Thread" className="tx-wide">
          <PostBody post={root} />
          <div className="pl-11">
            <ModerateButtons post={root} onDone={refresh} />
          </div>
          {tree.length ? (
            <div className="mt-2">
              <ThreadNodes
                nodes={tree}
                depth={1}
                labels={labels}
                rootId={root.id}
                closed={root.closed}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                onDone={refresh}
              />
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-ink-3">未有回覆。登入後可以第一個回。</p>
          )}
          <div className="mt-3 border-t border-hairline pt-3">
            {root.closed ? (
              <p className="text-[13px] text-ink-2">此對話已關閉。</p>
            ) : (
              <WriteGate next={`/dialogue/${postId}`}>
                <Composer
                  placeholder="寫一則回覆…"
                  replyLabel={target}
                  onCancelReply={
                    replyTo && replyTo !== root.id ? () => setReplyTo(root.id) : undefined
                  }
                  onSubmit={publish}
                />
              </WriteGate>
            )}
          </div>
        </Card>
      ) : null}
    </>
  );
}
