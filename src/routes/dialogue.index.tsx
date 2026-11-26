import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { DialogueFeed, DialogueFrame } from "@/components/tx/DeveloperDialogue";

export const Route = createFileRoute("/dialogue/")({
  head: () => ({
    meta: [
      { title: "與開發者對話 · 天喜 TIANXI" },
      {
        name: "description",
        content: "同天喜開發者公開留言。一篇帖可以展開回覆，其他人同管理帳號都可以加入。",
      },
      { property: "og:title", content: "與開發者對話 · 天喜 TIANXI" },
      { property: "og:description", content: "公開留言，打開一篇帖可以睇成串回覆。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DialoguePage,
});

function DialoguePage() {
  return (
    <AppShell page="" columns={false} ticker="與開發者對話 · 公開留言">
      <DialogueFrame>
        <DialogueFeed />
      </DialogueFrame>
    </AppShell>
  );
}
