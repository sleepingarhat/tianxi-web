import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { DialogueFrame, DialogueThread } from "@/components/tx/DeveloperDialogue";

export const Route = createFileRoute("/dialogue/$postId")({
  head: () => ({
    meta: [
      { title: "對話 · 與開發者對話 · 天喜 TIANXI" },
      { name: "description", content: "睇呢篇帖同下面嘅回覆。登入後可以加入對話。" },
      { property: "og:title", content: "對話 · 與開發者對話 · 天喜 TIANXI" },
      { property: "og:description", content: "一篇帖同佢嘅回覆。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { postId } = Route.useParams();
  return (
    <AppShell page="" columns={false} ticker="與開發者對話 · 回覆">
      <DialogueFrame>
        <DialogueThread postId={postId} />
      </DialogueFrame>
    </AppShell>
  );
}
