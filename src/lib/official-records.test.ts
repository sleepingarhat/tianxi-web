import { describe, expect, it } from "vitest";

import { officialBoardPath, type OfficialEnvelope } from "./official-boards";
import {
  brandOf,
  groupNews,
  groupRacecardFiles,
  importPolicyLayout,
  newsGroupLabel,
  officialAssetUrl,
  profileCells,
  profileForRunner,
  readRacecardFiles,
  readRacecardProfiles,
  readRatingRows,
  readNewsRows,
  readStatsPosters,
  reservesForRace,
  trackMapCaption,
} from "./official-records";

function envelope(rows: unknown[], available = true): OfficialEnvelope {
  return { available, rows, source: "test", date: null, venue: null, asOf: null, brand: null, season: null, section: null, pool: null, raceNo: null };
}

describe("Wave7 讀取路徑", () => {
  it("馬匹評分一定要帶 board，否則唔發請求", () => {
    expect(officialBoardPath("horse-ratings", { ratingBoard: "clas" })).toBe("/api/official/horse-ratings?board=clas");
    expect(officialBoardPath("horse-ratings", { ratingBoard: "tp50" })).toBe("/api/official/horse-ratings?board=tp50");
    expect(officialBoardPath("horse-ratings", {})).toBeNull();
    expect(officialBoardPath("horse-ratings", { ratingBoard: "top" })).toBeNull();
  });

  it("消息分類同進口分頁唔合格式就唔發請求", () => {
    expect(officialBoardPath("horse-news", {})).toBe("/api/official/horse-news");
    expect(officialBoardPath("horse-news", { newsView: "List/bres" })).toBe("/api/official/horse-news?view=List/bres");
    expect(officialBoardPath("horse-news", { newsView: "bad" })).toBeNull();
    expect(officialBoardPath("import-policy", { policyPage: "ppgs" })).toBe("/api/official/import-policy?page=ppgs");
    expect(officialBoardPath("import-policy", { policyPage: "x" })).toBeNull();
    expect(officialBoardPath("stats-centre")).toBe("/api/official/stats-centre");
  });

  it("排位馬匹資料同檔案要日期同馬場", () => {
    expect(officialBoardPath("racecard-profile", { date: "2026-11-11", venue: "HV" })).toBe("/api/official/racecard-profile?date=2026-11-11&venue=HV");
    expect(officialBoardPath("racecard-files", { date: "2026-11-11", venue: "HV" })).toBe("/api/official/racecard-files?date=2026-11-11&venue=HV");
    expect(officialBoardPath("racecard-profile", { date: "2026-11-11" })).toBeNull();
    expect(officialBoardPath("racecard-files", { venue: "HV" })).toBeNull();
  });
});

describe("官方網址白名單", () => {
  it("放行已核對嘅官方圖片路徑", () => {
    expect(officialAssetUrl("https://consvc.hkjc.com/-/media/Sites/JCRW/Page/stats_centre/202611/statcentre_stats_261111_ch.jpg?rev=250beeac18834923980f78fa55da938a&sc_lang=zh-HK", "image")).not.toBeNull();
    expect(officialAssetUrl("https://www.hkjc.com/chinese/racing/racecourse_img.asp?filename=hvt1650_h.gif", "image")).not.toBeNull();
    expect(officialAssetUrl("https://racing.hkjc.com/racing/content/Chinese/RaceCourse/hvt1650_s.gif", "image")).not.toBeNull();
    expect(officialAssetUrl("https://consvc.hkjc.com/-/media/Sites/JCRW/Page/pps_import_critieria/title_horses_pps_CHI.gif?rev=ac5b&sc_lang=zh-HK&hash=6821377CE974", "image")).not.toBeNull();
    expect(officialAssetUrl("https://consvc.hkjc.com/-/media/Sites/JCRW/FinishPhotos/26_27/20261108/20261108R01_P3.jpg", "image")).not.toBeNull();
  });

  it("PDF 同消息檔案只可做連結，唔當圖片", () => {
    const pdf = "https://racing.hkjc.com/racing/content/PDF/RaceCard/20261111_starter_all_chi.pdf";
    const zip = "https://racing.hkjc.com/Racing/Info/MCS/Chinese/horses/bres/20261110_000000_S_BRES.xml.zip";
    const exam = "https://racing.hkjc.com/general/-/media/Sites/JCRW/pp_formsheet/ch/Veterinary_Pre-Import_Exam_Protocol_Version_Chi.pdf";
    expect(officialAssetUrl(pdf, "link")).toBe(pdf);
    expect(officialAssetUrl(zip, "link")).toBe(zip);
    expect(officialAssetUrl(exam, "link")).toBe(exam);
    expect(officialAssetUrl(pdf, "image")).toBeNull();
    expect(officialAssetUrl(zip, "image")).toBeNull();
  });

  it("拒絕外站、假冒網域、http、端口、帳號同路徑跳脫", () => {
    expect(officialAssetUrl("https://evil.example/racing/content/PDF/RaceCard/a.pdf", "link")).toBeNull();
    expect(officialAssetUrl("https://racing.hkjc.com.evil.example/racing/content/PDF/RaceCard/a.pdf", "link")).toBeNull();
    expect(officialAssetUrl("http://racing.hkjc.com/racing/content/PDF/RaceCard/a.pdf", "link")).toBeNull();
    expect(officialAssetUrl("https://racing.hkjc.com:8443/racing/content/PDF/RaceCard/a.pdf", "link")).toBeNull();
    expect(officialAssetUrl("https://user:pw@racing.hkjc.com/racing/content/PDF/RaceCard/a.pdf", "link")).toBeNull();
    expect(officialAssetUrl("https://racing.hkjc.com/racing/content/PDF/RaceCard/../../secret.pdf", "link")).toBeNull();
    expect(officialAssetUrl("https://racing.hkjc.com/racing/content/PDF/RaceCard/%2e%2e/a.pdf", "link")).toBeNull();
    expect(officialAssetUrl("https://www.hkjc.com/chinese/racing/racecourse_img.asp?filename=https://evil.example/x.gif", "image")).toBeNull();
    expect(officialAssetUrl("https://consvc.hkjc.com/-/media/Sites/JCRW/Page/other/x.jpg", "image")).toBeNull();
    expect(officialAssetUrl("javascript:alert(1)", "link")).toBeNull();
  });
});

describe("賽日數據海報", () => {
  it("用接口回傳嘅官方海報日期，唔按揀嘅賽日", () => {
    const rows = readStatsPosters(envelope([
      { slot: "raceday_stats", posterDate: "2026-11-11", imagePath: "https://consvc.hkjc.com/-/media/Sites/JCRW/Page/stats_centre/202611/statcentre_stats_261111_ch.jpg?rev=1&sc_lang=zh-HK" },
      { slot: "whos_hot", posterDate: "2026-11-11", imagePath: "https://evil.example/x.jpg" },
    ]));
    expect(rows.map((row) => [row.label, row.posterDate])).toEqual([["賽日數據", "2026-11-11"], ["熱門馬", "2026-11-11"]]);
    expect(rows[1]!.imageUrl).toBeNull();
  });
});

describe("馬匹評分", () => {
  it("變動照原文顯示，包括 * 同 +2", () => {
    const rows = readRatingRows(envelope([
      { lineNo: 190, brand: "L358", nameCh: "驍勇萌萌", nameEn: "CHK CHK BOOM", rating: 52, changeText: "*" },
      { lineNo: 6, brand: "L226", nameCh: "超和平", rating: 76, changeText: "+2" },
      { lineNo: 1, brand: "J062", nameCh: "嘉應高昇", rating: 145, changeText: null, trainerName: "大衛希斯" },
    ]));
    expect(rows.map((row) => row.changeText)).toEqual(["*", "+2", null]);
    expect(rows[2]).toMatchObject({ rating: 145, trainerName: "大衛希斯" });
  });

  it("最高評分並列唔截到 50", () => {
    const rows = Array.from({ length: 52 }, (_, i) => ({ lineNo: i + 1, brand: `K${String(i).padStart(3, "0")}`, nameCh: `馬${i}`, rating: 92 }));
    expect(readRatingRows(envelope(rows))).toHaveLength(52);
  });
});

describe("馬匹消息", () => {
  it("按分類分組，標題照原文，檔案只收官方路徑", () => {
    const rows = readNewsRows(envelope([
      { view: "List/bres", lineNo: 2, title: "試 閘 結 果 (英 文 版 ) (2026/11/06 17:14:36)", artifactPath: "https://racing.hkjc.com/Racing/Info/MCS/Chinese/horses/bres/20261106_000000_S_BRES.xml.zip" },
      { view: "List/bres", lineNo: 1, title: "試 閘 結 果 (英 文 版 ) (2026/11/10 16:16:47)", artifactPath: "https://evil.example/a.zip" },
      { view: "List/swim", lineNo: 1, title: "獲 安 排 游 泳 之 馬 匹 (2026/11/10 11:15:27)", artifactPath: null },
    ]));
    const groups = groupNews(rows);
    expect(groups.map((group) => [group.view, group.rows.length])).toEqual([["List/bres", 2], ["List/swim", 1]]);
    expect(groups[0]!.rows[0]!.title).toBe("試 閘 結 果 (英 文 版 ) (2026/11/10 16:16:47)");
    expect(groups[0]!.rows[0]!.fileUrl).toBeNull();
    expect(groups[0]!.rows[1]!.fileUrl).not.toBeNull();
    expect(newsGroupLabel("試 閘 結 果 (英 文 版 ) (2026/11/10 16:16:47)")).toBe("試閘結果(英文版)");
  });
});

describe("進口資格版面", () => {
  it("表格按 rowNo／colNo 砌，* 保留，放喺註腳段落之前", () => {
    const layout = importPolicyLayout(envelope([
      { page: "pps", kind: "tab", blockNo: 1, text: "2026/27自購馬", assetPath: "https://racing.hkjc.com/zh-hk/local/page/pps-import-critieria" },
      { page: "pps", kind: "tab", blockNo: 2, text: "2026/27自購新馬", assetPath: "https://racing.hkjc.com/zh-hk/local/page/ppgs-import-critieria" },
      { page: "pps", kind: "paragraph", blockNo: 3, text: "於下列國家出賽的馬匹：" },
      { page: "pps", kind: "paragraph", blockNo: 4, text: "*並未訂有准許從該國直接進口馬匹的規定。" },
      { page: "pps", kind: "table_cell", blockNo: 1, rowNo: 1, colNo: 2, text: "德國" },
      { page: "pps", kind: "table_cell", blockNo: 1, rowNo: 1, colNo: 1, text: "阿根廷" },
      { page: "pps", kind: "table_cell", blockNo: 1, rowNo: 2, colNo: 1, text: "秘魯 *" },
      { page: "pps", kind: "exam_pdf", blockNo: 1, text: "馬匹進口前體格檢驗規定", assetPath: "https://racing.hkjc.com/general/-/media/Sites/JCRW/pp_formsheet/ch/Veterinary_Pre-Import_Exam_Protocol_Version_Chi.pdf" },
    ]), "pps");
    expect(layout.tabs).toEqual([{ page: "pps", label: "2026/27自購馬" }, { page: "ppgs", label: "2026/27自購新馬" }]);
    expect(layout.blocks).toEqual([
      { type: "paragraph", text: "於下列國家出賽的馬匹：" },
      { type: "table", rows: [["阿根廷", "德國"], ["秘魯 *"]] },
      { type: "paragraph", text: "*並未訂有准許從該國直接進口馬匹的規定。" },
    ]);
    expect(layout.exam?.text).toBe("馬匹進口前體格檢驗規定");
    expect(layout.exam?.url).not.toBeNull();
  });
});

describe("排位馬匹資料", () => {
  const rows = readRacecardProfiles(envelope([
    { raceNo: 1, horseNo: 1, reserve: false, brand: "K308", horseName: "電路一百", age: 5, sex: "閹", seasonStakes: 134550, owner: "何燕生與曾建華", sire: "Zoustar", dam: "Reconstruct", importType: "PPG" },
    { raceNo: 1, horseNo: 1, reserve: true, brand: "H454", horseName: "良駒好友", age: 7, sex: null, seasonStakes: null },
  ]));

  it("電路一百照官方原文：5 歲、閹、134,550、PPG", () => {
    const row = profileForRunner(rows, 1, 1, "K308")!;
    const cells = profileCells(row);
    expect(cells.short.map((cell) => cell.value)).toEqual(["5", "閹", "134,550", "PPG"]);
    expect(cells.long.map((cell) => cell.value)).toEqual(["何燕生與曾建華", "Zoustar", "Reconstruct"]);
  });

  it("後備馬唔會配去同號出賽馬，空值顯示—", () => {
    const reserves = reservesForRace(rows, 1);
    expect(reserves.map((row) => row.horseName)).toEqual(["良駒好友"]);
    expect(profileCells(reserves[0]!).short.map((cell) => cell.value)).toEqual(["7", "—", "—", "—"]);
  });

  it("烙號唔對就唔配", () => {
    expect(profileForRunner(rows, 1, 1, "J169")).toBeNull();
    expect(profileForRunner(rows, 2, 1, "K308")).toBeNull();
    expect(brandOf("horse_K308")).toBe("K308");
    expect(brandOf(undefined, "HK_2024_K308")).toBe("K308");
  });
});

describe("排位檔案", () => {
  it("全日 PDF、分場 PDF 同跑道圖分開，非官方路徑剔走", () => {
    const files = readRacecardFiles(envelope([
      { raceNo: 0, kind: "starter_pdf_all", artifactPath: "https://racing.hkjc.com/racing/content/PDF/RaceCard/20261111_starter_all_chi.pdf" },
      { raceNo: 1, kind: "starter_pdf", artifactPath: "https://racing.hkjc.com/racing/content/PDF/RaceCard/20261111_starter_r1_chi.pdf" },
      { raceNo: 1, kind: "track_map", artifactPath: "https://www.hkjc.com/chinese/racing/racecourse_img.asp?filename=hvt1650_h.gif", distance: 1650, surfaceCode: "t" },
      { raceNo: 1, kind: "track_map_thumb", artifactPath: "https://racing.hkjc.com/racing/content/Chinese/RaceCourse/hvt1650_s.gif", distance: 1650, surfaceCode: "t" },
      { raceNo: 2, kind: "track_map", artifactPath: "https://evil.example/map.gif", distance: 1200 },
    ]));
    expect(files).toHaveLength(4);
    const grouped = groupRacecardFiles(files);
    expect(grouped.allPdf).toContain("starter_all_chi.pdf");
    expect(grouped.races).toHaveLength(1);
    expect(grouped.races[0]).toMatchObject({ raceNo: 1, distance: 1650 });
    expect(trackMapCaption(grouped.races[0]!)).toBe("1650米 · 草地");
  });

  it("有表但冇行就係空", () => {
    expect(groupRacecardFiles(readRacecardFiles(envelope([])))).toEqual({ allPdf: null, races: [] });
  });
});
