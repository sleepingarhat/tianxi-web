import { useMemo, useState } from "react";
import { Check, Lock, Search, SlidersHorizontal } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  FEATURE_CATALOG,
  FEATURE_STATS,
  GROUP_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  type FeatureGroup,
} from "@/lib/feature-catalog";
import { CATALOG_TO_FEATURE, FEATURES, FEATURE_MAP, type FeatureId } from "@/lib/race-data";

type Props = {
  selected: FeatureId[];
  onToggle: (id: FeatureId) => void;
  onSelectAll: () => void;
  onClear: () => void;
};

const STATUS_TONE: Record<string, string> = {
  adopted: "bg-gold-bg text-gold border-gold-strong/40",
  pending: "bg-paper-3 text-ink-3 border-hairline",
  never: "bg-paper-3 text-lose border-hairline",
};

/** 可即場排序但唔屬於引擎目錄嘅特徵（網站自算）。可排序 ≠ 未採用。 */
const EXTRA_RANKABLE = FEATURES.filter((f) => !f.catalogId);

export function FeaturePickerSheet({ selected, onToggle, onSelectAll, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [onlyRankable, setOnlyRankable] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<FeatureGroup | "site", { label: string; rows: any[] }>();
    map.set("site", { label: "網站即場自算", rows: EXTRA_RANKABLE.map((f) => ({ site: f })) });
    for (const row of FEATURE_CATALOG) {
      if (!map.has(row.group)) map.set(row.group, { label: GROUP_LABEL[row.group], rows: [] });
      map.get(row.group)!.rows.push({ cat: row });
    }
    const kw = q.trim().toLowerCase();
    return [...map.entries()]
      .map(([key, g]) => ({
        key,
        label: g.label,
        rows: g.rows.filter((r: any) => {
          const zh = r.site ? r.site.label : r.cat.zh;
          const note = r.site ? r.site.note : r.cat.note;
          const rankId: FeatureId | undefined = r.site ? r.site.id : CATALOG_TO_FEATURE[r.cat.id];
          if (onlyRankable && !rankId) return false;
          if (!kw) return true;
          return `${zh}${note}`.toLowerCase().includes(kw);
        }),
      }))
      .filter((g) => g.rows.length > 0);
  }, [q, onlyRankable]);

  const rankableCount = FEATURES.length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-1 items-center justify-between gap-2 rounded-md border border-tan bg-paper px-3 py-2.5 text-left shadow-sm active:scale-[0.99]"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-brown" />
                <span className="font-serif-tc text-sm text-ink">選擇特徵</span>
              </span>
              <span className="tabnum rounded-full bg-gold-bg px-2 py-0.5 font-mono-tx text-[10px] font-bold text-gold">
                已選 {selected.length}/{rankableCount}
              </span>
            </button>
          </SheetTrigger>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              className="rounded-full border border-brown bg-brown px-2.5 py-1 text-[11px] font-bold text-paper"
            >
              {FEATURE_MAP[id].shortLabel} ×
            </button>
          ))}
          {selected.length === 0 && (
            <span className="text-[11px] text-ink-3">未選任何特徵，請開啟選擇特徵面板。</span>
          )}
        </div>
      </div>

      <SheetContent side="bottom" className="flex h-[88vh] flex-col gap-0 bg-paper p-0">
        <SheetHeader className="border-b border-hairline px-4 pb-3 pt-4 text-left">
          <SheetTitle className="font-serif-tc text-base text-brown">
            特徵目錄 · 全部 {FEATURE_STATS.total} 項
          </SheetTitle>
          <p className="text-[11px] leading-relaxed text-ink-3">
            「已採用／未採用／永不採用」係引擎訓練狀態，「可排序」只代表呢頁可以即場排名，兩者唔係同一回事。未採用因子都可以排序，已採用因子亦未必全部開放。
            引擎目錄 {FEATURE_STATS.total} 項（已採用 {FEATURE_STATS.adopted}、未採用 {FEATURE_STATS.pending}
            、永不採用 {FEATURE_STATS.never}），其中 {FEATURES.length - EXTRA_RANKABLE.length}{" "}
            項可即場排序；另有 {EXTRA_RANKABLE.length} 項網站自算特徵。灰色鎖圖示者屬引擎內部訓練特徵，唔可以單獨排序。
          </p>
        </SheetHeader>

        <div className="flex items-center gap-2 border-b border-hairline px-4 py-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-md border border-hairline bg-paper-2 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋特徵名稱"
              className="w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyRankable((v) => !v)}
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] ${
              onlyRankable
                ? "border-gold-strong bg-gold-bg font-bold text-gold"
                : "border-hairline bg-paper text-ink-3"
            }`}
          >
            只看可排序
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-24">
          {groups.map((g) => (
            <section key={String(g.key)} className="py-3">
              <h3 className="mb-2 font-serif-tc text-[13px] text-brown">{g.label}</h3>
              <div className="space-y-1.5">
                {g.rows.map((r: any) => {
                  const site = r.site;
                  const cat = r.cat;
                  const rankId: FeatureId | undefined = site ? site.id : CATALOG_TO_FEATURE[cat.id];
                  const on = rankId ? selected.includes(rankId) : false;
                  const zh = site ? site.label : cat.zh;
                  const note = site ? site.note : cat.note;
                  const gainPct =
                    cat?.gain != null && FEATURE_STATS.maxGain > 0
                      ? Math.max(2, Math.round((cat.gain / FEATURE_STATS.maxGain) * 100))
                      : null;
                  return (
                    <button
                      key={site ? site.id : cat.id}
                      type="button"
                      disabled={!rankId}
                      onClick={() => rankId && onToggle(rankId)}
                      className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left ${
                        on
                          ? "border-brown bg-brown/10"
                          : rankId
                            ? "border-hairline bg-paper"
                            : "border-hairline/60 bg-paper-2 opacity-70"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
                          on ? "border-brown bg-brown text-paper" : "border-hairline bg-paper text-transparent"
                        }`}
                      >
                        {rankId ? <Check className="h-3 w-3" /> : <Lock className="h-2.5 w-2.5 text-ink-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-serif-tc text-[13px] text-ink">{zh}</span>
                          {cat && (
                            <span
                              className={`rounded-full border px-1.5 py-[1px] text-[9px] ${STATUS_TONE[cat.status]}`}
                            >
                              {STATUS_LABEL[cat.status as keyof typeof STATUS_LABEL]}
                            </span>
                          )}
                          {cat && (
                            <span className="rounded-full border border-hairline bg-paper-3 px-1.5 py-[1px] text-[9px] text-ink-3">
                              {SOURCE_LABEL[cat.source]}
                            </span>
                          )}
                          {rankId && (
                            <span
                              title="可即場排序，唔等於引擎未採用"
                              className="rounded-full border border-gold-strong/40 bg-gold-bg px-1.5 py-[1px] text-[9px] font-bold text-gold"
                            >
                              可排序
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-relaxed text-ink-3">{note}</span>
                        {cat?.reason && (
                          <span className="mt-0.5 block text-[10px] leading-relaxed text-lose/80">
                            {cat.reason}
                          </span>
                        )}
                        {gainPct != null && (
                          <span className="mt-1 flex items-center gap-1.5">
                            <span className="tx-bar-track h-1 flex-1">
                              <span className="tx-bar-fill h-1" style={{ width: `${gainPct}%` }} />
                            </span>
                            <span className="tabnum font-mono-tx text-[9px] text-ink-3">
                              重要度 {cat.gain}
                            </span>
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 border-t border-hairline bg-paper px-4 py-3">
          <button
            type="button"
            onClick={onSelectAll}
            className="flex-1 rounded-md border border-hairline bg-paper-2 py-2 text-[12px] text-ink-2"
          >
            全選可排序
          </button>
          <button
            type="button"
            onClick={onClear}
            className="flex-1 rounded-md border border-hairline bg-paper-2 py-2 text-[12px] text-ink-3"
          >
            清除
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-md border border-brown bg-brown py-2 text-[12px] font-bold text-paper"
          >
            完成（{selected.length}）
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
