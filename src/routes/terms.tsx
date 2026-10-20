import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { Card, PageHead } from "@/components/tx/ui";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "服務條款 · 天喜 TIANXI" },
    { name: "description", content: "使用天喜香港賽馬數據分析服務的條款，包括服務性質、訂閱、免責聲明及帳戶規則。" },
    { property: "og:title", content: "服務條款 · 天喜 TIANXI" },
    { property: "og:description", content: "使用天喜香港賽馬數據分析服務的條款。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Terms,
});

const UPDATED = "2026年10月20日";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card title={title}>
    <div className="space-y-2 text-[12px] leading-relaxed text-ink-2">{children}</div>
  </Card>;
}

function Terms() {
  return <AppShell page="dashboard" ticker="服務條款 · 使用細則">
    <PageHead en="Terms of Service" title="服務條款" desc={`最後更新：${UPDATED}。使用天喜（tianxi.racing）服務前，請細閱以下條款。使用本服務即代表你同意本條款。`} />

    <Section title="服務性質">
      <p>天喜是一個香港賽馬數據分析及研究平台，提供公開、可審計的模型預測、歷史戰績及賽事資料。天喜<strong className="text-ink">不是博彩營運商</strong>，不接受投注、不處理彩金，亦不保證任何預測結果。所有預測及分析只供參考及研究用途。</p>
      <p>你必須年滿 18 歲方可使用本服務。如你選擇參與任何博彩活動，那是你與相關持牌機構之間的事，與天喜無關；請遵守你所在地區的法律，並理性看待博彩風險。</p>
    </Section>

    <Section title="帳戶">
      <p>你透過 Google 登入建立帳戶，須確保帳戶資料真確，並妥善保管登入憑證。帳戶不得轉讓或與他人共享。如發現帳戶被未經授權使用，請盡快通知我們。</p>
    </Section>

    <Section title="訂閱及收費">
      <p>部分功能屬收費訂閱計劃，收費、計劃內容及有效期以訂閱頁公布為準。訂閱經第三方支付服務商處理。推廣優惠（例如創始會員優惠）的名額、條件及價值以公布時的說明為準。</p>
      <p>除法律要求或我們另有公布外，已支付的訂閱費用不設退款。你可以隨時取消續訂，已付費的服務期會維持到期滿。</p>
    </Section>

    <Section title="可接受使用">
      <p>你同意不會：以自動化方式大量擷取本網站資料；干擾或攻擊本服務的運作；冒充他人或提供虛假資料；或將本服務用於任何非法用途。違反本條款的帳戶可被暫停或終止。</p>
    </Section>

    <Section title="知識產權">
      <p>本網站的模型、分析、文字及設計內容屬天喜所有。賽事原始資料（排位、賽果、賠率等）的權利屬香港賽馬會及相關權利人所有，天喜只作引用及分析。未經許可，不得複製或商業轉載本網站內容。</p>
    </Section>

    <Section title="免責聲明及責任限制">
      <p>本服務按「現況」提供。我們盡力確保資料準確及服務穩定，但不保證內容完全無誤、服務永不中斷。預測本質上涉及不確定性，過往戰績不代表將來表現。</p>
      <p>在法律允許的最大範圍內，天喜不會就你使用或無法使用本服務而引致的任何直接或間接損失（包括但不限於投注損失）承擔責任。</p>
    </Section>

    <Section title="條款變更及終止">
      <p>我們可隨時更新本條款並在本頁公布；重大變更會在網站顯眼位置通知。繼續使用本服務即代表你接受更新後的條款。我們保留在合理情況下暫停或終止服務的權利。</p>
      <p>本條款受香港特別行政區法律管轄。如對本條款有疑問，請透過天喜官方 Telegram 頻道聯絡我們。</p>
    </Section>
  </AppShell>;
}
