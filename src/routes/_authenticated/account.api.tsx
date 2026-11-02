import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, PageHead, Pill } from "@/components/tx/ui";

export const Route = createFileRoute("/_authenticated/account/api")({
  head: () => ({
    meta: [
      { title: "API 金鑰（即將上線）· 天喜賽馬" },
      { name: "description", content: "會員 API 金鑰功能即將上線。" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApiComingSoon,
});

function ApiComingSoon() {
  return (
    <AppShell page="myhorses" columns={false} ticker="會員 API · 即將上線">
      <PageHead en="API keys" title="開發者 API 金鑰" desc="即將上線" />
      <Card title="即將上線" action={<Pill>籌備中</Pill>}>
        <p className="px-4 py-3 text-sm text-ink-2">
          會員 API 金鑰建立、用量及撤銷功能正在籌備，暫未開放申請。上線時會另行公布。
        </p>
      </Card>
      <Disclaimer />
    </AppShell>
  );
}
