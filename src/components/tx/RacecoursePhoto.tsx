import { useQuery } from "@tanstack/react-query";
import happyValley from "@/assets/racecourses/happy-valley-racecourse.jpg.asset.json";
import shaTin from "@/assets/racecourses/sha-tin-racecourse.jpg.asset.json";
import { getRacecoursePhotos } from "@/lib/racecoursePhotos.functions";
import { hkWeekIndex, pickWeekly, type RacecoursePhotoRow } from "@/lib/racecoursePhotoPick";

const FALLBACK: Record<"ST" | "HV", RacecoursePhotoRow> = {
  HV: { file_title: "File:HKIR_20231206_Happy_Valley_Racecourse_IJC.jpg", venue: "HV", image_url: happyValley.url, width: 0, height: 0,
    author: "Will629", license: "CC BY 4.0", license_url: "https://creativecommons.org/licenses/by/4.0", source_page: "https://commons.wikimedia.org/wiki/File:HKIR_20231206_Happy_Valley_Racecourse_IJC.jpg" },
  ST: { file_title: "File:HKIR_20231210_Sha_Tin_Racecourse_Hong_Kong_Cup.jpg", venue: "ST", image_url: shaTin.url, width: 0, height: 0,
    author: "Will629", license: "CC BY 4.0", license_url: "https://creativecommons.org/licenses/by/4.0", source_page: "https://commons.wikimedia.org/wiki/File:HKIR_20231210_Sha_Tin_Racecourse_Hong_Kong_Cup.jpg" },
};

export function useWeeklyPhoto(venue: "ST" | "HV") {
  const { data } = useQuery({ queryKey: ["racecourse-photos"], queryFn: () => getRacecoursePhotos(), staleTime: 3600_000 });
  return pickWeekly((data ?? []).filter((p) => p.venue === venue), hkWeekIndex()) ?? FALLBACK[venue];
}

export function PhotoCredit({ p }: { p: RacecoursePhotoRow }) {
  return (
    <a href={p.source_page} target="_blank" rel="license noopener noreferrer" className="underline decoration-hairline underline-offset-2">
      {p.author}／Wikimedia Commons · {p.license} · 已裁切
    </a>
  );
}

export function RacecoursePhoto({ venue }: { venue: string }) {
  const v = venue === "HV" || venue.includes("跑馬地") ? "HV" : "ST";
  const p = useWeeklyPhoto(v);
  const title = v === "HV" ? "跑馬地馬場" : "沙田馬場";
  return (
    <figure className="mx-4 mt-3 overflow-hidden rounded-[8px] border border-hairline bg-paper-2">
      <img src={p.image_url} alt={title} className="aspect-[16/7] w-full lg:aspect-[16/4] object-cover" loading="eager" />
      <figcaption className="flex flex-wrap items-center justify-between gap-1 px-3 py-2 text-[9px] text-ink-3">
        <span>{title} · 每週更新</span>
        <PhotoCredit p={p} />
      </figcaption>
    </figure>
  );
}

/** 首頁：本週沙田＋跑馬地海報 */
export function WeeklyRacecoursePosters() {
  const st = useWeeklyPhoto("ST");
  const hv = useWeeklyPhoto("HV");
  return (
    <section className="border-t border-hairline px-5 py-8 md:px-10">
      <p className="font-mono-tx text-[11px] font-bold text-gold">THIS WEEK · 本週馬場</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {([["沙田馬場", st], ["跑馬地馬場", hv]] as const).map(([t, p]) => (
          <figure key={t} className="overflow-hidden rounded-[10px] border border-hairline bg-paper-2">
            <img src={p.image_url} alt={t} className="aspect-[16/9] w-full object-cover" loading="lazy" />
            <figcaption className="flex flex-wrap items-center justify-between gap-1 px-3 py-2 text-[10px] text-ink-3">
              <span className="font-bold text-ink">{t}</span>
              <PhotoCredit p={p} />
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-ink-3">相片每星期自動由 Wikimedia Commons 更新，只用准許商用嘅自由授權相，詳見 <a href="/media-credits" className="underline">圖片來源</a>。</p>
    </section>
  );
}
