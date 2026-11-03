import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { Card, PageHead } from "@/components/tx/ui";

export const Route = createFileRoute("/media-credits")({
  head: () => ({ meta: [
    { title: "圖片來源與授權 · 天喜 TIANXI" },
    { name: "description", content: "天喜網站實景圖片來源、作者、授權與修改紀錄。" },
    { property: "og:title", content: "圖片來源與授權 · 天喜 TIANXI" },
    { property: "og:description", content: "天喜網站實景圖片的可追溯授權紀錄。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MediaCredits,
});

const ITEMS = [
  { title: "沙田馬場賽事", author: "Will629", license: "CC BY 4.0", source: "https://commons.wikimedia.org/wiki/File:HKIR_20231210_Sha_Tin_Racecourse_Hong_Kong_Cup.jpg", note: "網站展示版本按版面比例裁切。" },
  { title: "跑馬地馬場夜賽", author: "Will629", license: "CC BY 4.0", source: "https://commons.wikimedia.org/wiki/File:HKIR_20231206_Happy_Valley_Racecourse_IJC.jpg", note: "網站展示版本按版面比例裁切。" },
];

function MediaCredits() {
  return <AppShell page="dashboard" ticker="圖片來源 · 可追溯授權">
    <PageHead en="Media Credits" title="圖片來源與授權" desc="只採用可核實商用授權素材；未有清晰授權嘅圖片不會公開。" />
    <Card title="馬場實景" en="Racecourses">
      <div className="divide-y divide-hairline">
        {ITEMS.map((item) => <article key={item.source} className="py-3 first:pt-0 last:pb-0">
          <h2 className="font-serif-tc text-[14px] font-bold text-ink">{item.title}</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-2">作者：{item.author} · 授權：{item.license} · {item.note}</p>
          <a href={item.source} target="_blank" rel="license noopener noreferrer" className="mt-1 inline-block break-all font-mono-tx text-[11px] text-gold underline">原始檔案及授權頁</a>
        </article>)}
      </div>
    </Card>
    <Card title="球員照片" en="Players">
      <p className="text-[12px] leading-relaxed text-ink-2">API 提供圖片網址不等於獲授權商用。天喜只會採用逐張核實嘅 CC BY／公有領域白名單，或另有書面商用授權嘅供應商素材；現階段未核實球員照片一律不顯示。</p>
    </Card>
  </AppShell>;
}
