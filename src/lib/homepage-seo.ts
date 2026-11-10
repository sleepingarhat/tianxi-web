import { DEFAULT_PAYWALL_THRESHOLD, FOUNDING_PRO_WEEKS } from "./freeStage";

/** 首頁正規網址，與 sitemap 的 https://tianxi.racing/ 一致。 */
export const HOME_URL = "https://tianxi.racing/";

/** 文件標題與 H1 開頭對齊，避免搜尋結果改寫成「賽前凍結四揀，」。站內用語用「四揀」。 */
export const HOME_TITLE = "天喜賽馬｜香港賽馬 AI 預測（賽前凍結四揀、賽後公開對帳）";
export const HOME_H1_LEAD = "天喜賽馬｜香港賽馬 AI 預測";
export const HOME_H1_TAIL = "賽前凍結四揀、賽後公開對帳";

export function homepageDescription() {
  return `天喜賽馬提供香港賽馬 AI 預測：賽前凍結四揀，賽後以官方賽果公開對帳。現階段全站免費、尚未開放收費；首${DEFAULT_PAYWALL_THRESHOLD}名註冊會員於開閘之日獲${FOUNDING_PRO_WEEKS}週免費 Pro。`;
}

export function homepageWebAppJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "天喜賽馬",
    url: HOME_URL,
    inLanguage: "zh-Hant",
    operatingSystem: "Web",
    applicationCategory: "SportsApplication",
    description: "香港賽馬 AI 預測：賽前凍結四揀，賽後以官方賽果公開對帳。",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "HKD",
      description: "現階段全站免費，尚未開放收費。",
    },
  };
}

export function homepageHead() {
  const description = homepageDescription();
  return {
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: description },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: HOME_URL },
      { property: "og:locale", content: "zh_HK" },
      { property: "og:site_name", content: "天喜賽馬" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: description },
      { "script:ld+json": homepageWebAppJsonLd() },
    ],
    links: [{ rel: "canonical", href: HOME_URL }],
  };
}
