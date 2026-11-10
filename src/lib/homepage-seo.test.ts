import { describe, expect, it } from "vitest";
import { DEFAULT_PAYWALL_THRESHOLD, FOUNDING_PRO_WEEKS } from "./freeStage";
import {
  HOME_H1_LEAD,
  HOME_H1_TAIL,
  HOME_TITLE,
  HOME_URL,
  homepageDescription,
  homepageHead,
  homepageWebAppJsonLd,
} from "./homepage-seo";

describe("首頁搜尋標題", () => {
  it("標題與主標題都帶產品名同分類", () => {
    for (const text of [HOME_TITLE, `${HOME_H1_LEAD}${HOME_H1_TAIL}`]) {
      expect(text).toContain("天喜賽馬");
      expect(text).toContain("香港賽馬 AI 預測");
    }
    expect(HOME_H1_LEAD.startsWith("天喜賽馬")).toBe(true);
    expect(HOME_TITLE.startsWith(HOME_H1_LEAD)).toBe(true);
  });

  it("說明先講產品，創始優惠只放句尾", () => {
    const description = homepageDescription();
    expect(description.startsWith("天喜賽馬提供香港賽馬 AI 預測")).toBe(true);
    expect(description).toContain("賽前凍結四揀");
    expect(description).toContain("公開對帳");
    expect(description.indexOf("香港賽馬 AI 預測")).toBeLessThan(description.indexOf("全站免費"));
    expect(description).toContain(`首${DEFAULT_PAYWALL_THRESHOLD}名`);
    expect(description).toContain(`${FOUNDING_PRO_WEEKS}週`);
    expect(description).not.toContain("4,056");
    expect(description).not.toMatch(/^(限時免費|首\d+名)/);
  });

  it("首頁 head 有正規網址、社交標題同免費 WebApplication", () => {
    const head = homepageHead();
    const description = homepageDescription();
    const content = (key: string) =>
      head.meta.find(
        (tag) => ("property" in tag && tag.property === key) || ("name" in tag && tag.name === key),
      );
    expect(head.meta.find((tag) => "title" in tag)).toEqual({ title: HOME_TITLE });
    expect(content("description")).toEqual({ name: "description", content: description });
    expect(content("og:title")).toMatchObject({ content: HOME_TITLE });
    expect(content("og:description")).toMatchObject({ content: description });
    expect(content("og:url")).toMatchObject({ content: HOME_URL });
    expect(content("og:locale")).toMatchObject({ content: "zh_HK" });
    expect(content("og:site_name")).toMatchObject({ content: "天喜賽馬" });
    expect(content("twitter:title")).toMatchObject({ content: HOME_TITLE });
    expect(content("twitter:description")).toMatchObject({ content: description });
    expect(head.links).toEqual([{ rel: "canonical", href: HOME_URL }]);

    const app = homepageWebAppJsonLd();
    expect(head.meta).toContainEqual({ "script:ld+json": app });
    expect(app["@type"]).toBe("WebApplication");
    expect(app.name).toBe("天喜賽馬");
    expect(app.url).toBe(HOME_URL);
    expect(app.inLanguage).toBe("zh-Hant");
    expect(app.operatingSystem).toBe("Web");
    expect(app.offers.price).toBe("0");
    expect(app.offers.priceCurrency).toBe("HKD");
    const serialized = JSON.stringify(app);
    expect(serialized).not.toContain("開源");
    expect(serialized).not.toContain("首個");
    expect(serialized).not.toMatch(/4,?056|HK\$78/);
  });
});
