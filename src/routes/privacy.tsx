import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { Card, PageHead } from "@/components/tx/ui";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "私隱政策 · 天喜 TIANXI" },
    { name: "description", content: "天喜如何收集、使用及保護會員個人資料，包括 Google 登入、會員訂閱及網站分析。" },
    { property: "og:title", content: "私隱政策 · 天喜 TIANXI" },
    { property: "og:description", content: "天喜如何收集、使用及保護會員個人資料。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Privacy,
});

const UPDATED = "2026年10月20日";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card title={title}>
    <div className="space-y-2 text-[12px] leading-relaxed text-ink-2">{children}</div>
  </Card>;
}

function Privacy() {
  return <AppShell page="dashboard" ticker="私隱政策 · 會員資料保障">
    <PageHead en="Privacy Policy" title="私隱政策" desc={`最後更新：${UPDATED}。本政策說明天喜（tianxi.racing）如何收集、使用、保存及保護你的個人資料。`} />

    <Section title="我們收集的資料">
      <p>1. 帳戶資料：當你透過 Google 登入註冊或登入天喜，我們會從 Google 取得你的電郵地址、姓名及基本個人檔案資料，用作建立及識別你的會員帳戶。我們不會取得或保存你的 Google 密碼。</p>
      <p>2. 訂閱及付款資料：如你訂閱收費計劃，付款由第三方支付服務商處理，我們只保存訂閱狀態、計劃類型及到期日等紀錄，不會保存你的完整信用卡號碼。</p>
      <p>3. 使用紀錄：我們會記錄帳戶相關的操作紀錄（例如登入、訂閱變更），用作帳戶安全及客戶服務。</p>
      <p>4. 網站分析：我們使用網站分析工具（包括 Google Analytics）收集匿名的瀏覽統計，例如瀏覽頁面、裝置類型及大約地區，用作改善網站。</p>
    </Section>

    <Section title="資料用途">
      <p>我們只會將你的資料用於：提供及維護會員服務（登入、訂閱權限）；處理付款及訂閱管理；回應你的查詢；分析網站使用情況以改善服務；以及符合法律要求。</p>
      <p>我們不會出售你的個人資料，亦不會將你的資料用於與上述無關的用途。</p>
    </Section>

    <Section title="資料分享">
      <p>我們只會在以下情況分享資料：登入及付款等必須的服務供應商（例如 Google 登入、付款處理商、雲端託管及資料庫服務），而這些供應商只可按我們的指示處理資料；或法律要求披露的情況。</p>
    </Section>

    <Section title="資料保存與安全">
      <p>帳戶資料會在你持有帳戶期間保存；刪除帳戶後，我們會在合理時間內刪除或匿名化你的個人資料，但法律要求保留的交易紀錄除外。我們採用業界標準的技術措施（加密連線、存取控制）保護資料，但互聯網傳輸不能保證百分百安全。</p>
    </Section>

    <Section title="你的權利">
      <p>你可以隨時要求查閱、更正或刪除你的個人資料，或取消訂閱。如需行使上述權利，請透過天喜官方 Telegram 頻道聯絡我們。</p>
    </Section>

    <Section title="Cookie 及類似技術">
      <p>我們使用必要的 Cookie 維持登入狀態，並使用分析 Cookie 了解網站使用情況。你可以透過瀏覽器設定停用 Cookie，但部分功能（例如登入）可能無法使用。</p>
    </Section>

    <Section title="政策更新">
      <p>本政策如有更新，會在本頁公布並更新日期。重大變更會在網站顯眼位置通知。繼續使用本服務即代表你接受更新後的政策。</p>
    </Section>
  </AppShell>;
}
