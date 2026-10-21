import { detailDeadline } from "@/lib/detail-deadline";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getFrozenVersionHistory } from "@/lib/racing-evidence.functions";
import { getRetrainManifests } from "@/lib/racing-audit.functions";
import { orderVersions, recordedAlpha } from "@/lib/model-version-evidence";

import { supabase } from "@/integrations/supabase/client";

import { Empty, ErrorNote, Loading, Pill } from "./ui";

type VersionRow = {
  version: string;
  engine: string;
  fingerprint: string | null;
  released_at: string;
  status: string;
  notes: string | null;
};

/** 版本化成績：讀 model_versions，當前版本置頂，歷史版本可展開；只讀，唔改任何帳。 */
export function ModelVersions({ engine }: { engine: "racing" }) {
  const readHistory = useServerFn(getFrozenVersionHistory);
  const history = useQuery({ queryKey: ["frozen-model-version-history"], queryFn: () => detailDeadline(() => readHistory()), retry: false, enabled: engine === "racing", staleTime: 300_000 });
  const readManifests = useServerFn(getRetrainManifests);
  const manifests = useQuery({ queryKey: ["retrain-manifests"], queryFn: () => detailDeadline(() => readManifests()), retry: false, enabled: engine === "racing", staleTime: 300_000 });
  const manOf = (v: string) => manifests.data?.versions.find((m) => m.model_version === v) ?? null;
  const q = useQuery({
    queryKey: ["model-versions", engine],
    queryFn: () => detailDeadline(async () => {
      const { data, error } = await supabase
        .from("model_versions")
        .select("version,engine,fingerprint,released_at,status,notes")
        .eq("engine", engine)
        .order("released_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VersionRow[];
    }),
    retry: false,
    staleTime: 10 * 60_000,
  });
  const rows = orderVersions(q.data ?? []);
  
  const renderRow = (r: VersionRow) => (
    <li key={r.version} className="border-b border-hairline py-2 last:border-b-0">
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono-tx text-[12px] font-bold text-ink">{r.version}</span>
        <Pill tone={r.status === "active" ? "win" : "ink"}>{r.status === "active" ? "當前版本" : r.status === "candidate" ? "候選（未啟用）" : "歷史版本"}</Pill>
        <span className="tabnum ml-auto font-mono-tx text-[9px] text-ink-3">{r.released_at}</span>
      </p>
      {r.notes ? <p className="mt-1 text-[10px] leading-relaxed text-ink-3">{r.notes}</p> : null}
      <dl className="mt-2 grid grid-cols-2 gap-2 text-[10px]"><div><dt className="text-ink-3">登記α</dt><dd>{recordedAlpha(r.notes)?.toFixed(2) ?? "未記錄"}</dd></div><div><dt className="text-ink-3">訓練窗口</dt><dd>未附逐版本紀錄</dd></div><div><dt className="text-ink-3">版本閘結果</dt><dd>未附PASS／WATCH／FAIL</dd></div><div><dt className="text-ink-3">指紋</dt><dd className="break-all">{r.fingerprint ?? "未記錄"}</dd></div></dl>
      {r.fingerprint ? (
        <p className="tabnum mt-0.5 font-mono-tx text-[9px] text-ink-3">指紋 {r.fingerprint}</p>
      ) : null}
    </li>
  );

  return (
    <section className="mx-4 my-3 rounded-[8px] border border-hairline bg-paper-2 p-3 shadow-sm">
      <h2 className="font-serif-tc text-[15px] font-bold text-ink">
        模型版本
        <small className="ml-2 font-mono-tx text-[9px] font-bold uppercase tracking-[0.2em] text-ink-3">Model Versions</small>
      </h2>
      {q.isLoading ? <Loading /> : q.error ? <div><ErrorNote error={q.error} /><Button variant="outline" onClick={() => void q.refetch()}>重新讀取版本</Button></div> : rows.length ? <ul>{rows.map(renderRow)}</ul> : <Empty label="未有模型版本登記" />}
      {engine === "racing" ? <details className="mt-3 border-t border-hairline pt-2"><summary className="cursor-pointer text-[12px] font-bold text-ink">已結算預測版本紀錄 · 鎖點待核（{history.data?.versions.length ?? "—"} 組）</summary>
        <p className="my-2 text-[10px] leading-relaxed text-ink-3">按紀錄版本與α分組。下列產物只代表同名版本最近一次重訓，並非每場鎖點的模型證明；同名版本可重訓多次，未有逐場指紋配對不可當成當日原檔。賽後建立的歷史行亦不能只憑版本名當成賽前凍結。</p>
        {history.data?.truncated || manifests.data?.truncated ? <p className="my-2 text-[10px] font-semibold text-gold">讀取上限提示：只列最近 100 組版本紀錄／重訓產物，更早版本未包括；超出上限嘅版本會顯示「未有重訓產物」，唔代表產物已過保存期。</p> : null}
        {manifests.error ? <div><ErrorNote error={manifests.error} /><Button variant="outline" onClick={() => void manifests.refetch()}>重新讀取重訓產物</Button></div> : null}
        {history.isLoading ? <Loading /> : history.error ? <div><ErrorNote error={history.error} /><Button variant="outline" onClick={() => void history.refetch()}>重新讀取版本紀錄</Button></div> : history.data?.versions.length ? <ul>{history.data.versions.map(v => <li key={`${v.version}-${v.source}`} className="border-b border-hairline py-2">
          <p className="break-words font-mono-tx text-[11px] font-bold">{v.version}</p>
          <dl className="mt-1 grid grid-cols-2 gap-2 text-[10px]"><div><dt className="text-ink-3">紀錄α（鎖點待核）</dt><dd className="font-mono-tx">{recordedAlpha(v.source)?.toFixed(2) ?? "未記錄"}</dd></div><div><dt className="text-ink-3">首次使用</dt><dd>{v.firstDate}</dd></div><div><dt className="text-ink-3">最近使用／記錄數</dt><dd>{v.lastDate} · {v.rows}</dd></div>{(() => { const m = manOf(v.version); return m ? <><div><dt className="text-ink-3">訓練窗口</dt><dd className="tabnum font-mono-tx">{m.training_start ?? "—"} 至 {m.training_end ?? "—"}</dd></div><div><dt className="text-ink-3">重訓閘結果</dt><dd><Pill tone={m.gate_status === "PASS" ? "win" : m.gate_status === "FAIL" ? "lose" : "gold"}>{m.gate_status ?? "未記錄"}</Pill> 生效α {m.live_alpha ?? "—"}</dd></div><div className="col-span-2"><dt className="text-ink-3">最近重訓產物指紋（未逐場配對）</dt><dd className="break-all font-mono-tx">{m.bundle_fingerprint ?? "未記錄"}<span className="ml-1 text-ink-3">（{m.source === "artifact-import" ? "由重訓產物原檔匯入" : "重訓流程直接寫入"}，共 {m.runs} 次重訓）</span></dd></div></> : <div className="col-span-2"><dt className="text-ink-3">訓練窗口／閘結果／指紋</dt><dd>未有配對重訓產物，唔倒填</dd></div>; })()}</dl>
        </li>)}</ul> : <Empty label="未有已結算凍結模型歷史" />}
      </details> : null}
    </section>
  );
}
