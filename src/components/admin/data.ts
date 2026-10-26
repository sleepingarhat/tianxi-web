// 監控端資料讀取：只讀現有公開接口同資料庫，唔改任何凍結資料
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getAdminRacingHealth } from "@/lib/racingOps.functions";
import { isRacingEngine } from "@/lib/product-scope";
import { txApi } from "@/lib/tx-api";
import { racingLanguage } from "./racing-language";

const getJson = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} 回應 ${r.status}`);
  return (await r.json()) as T;
};

export const REFRESH_KEY = "tx-admin-refresh-sec";
export function refreshMs() {
  if (typeof window === "undefined") return 60_000;
  const v = Number(window.localStorage.getItem(REFRESH_KEY));
  return Number.isFinite(v) && v >= 15 ? v * 1000 : 60_000;
}

export const useRacingHealth = () =>
  useQuery({ queryKey: ["admin", "racing-health"], queryFn: () => getAdminRacingHealth(), refetchInterval: refreshMs() });

export const useEngineHealth = () =>
  useQuery({
    queryKey: ["admin", "engine-health"],
    queryFn: () => getJson<any>("/api/public/engine-health"),
    select: (data: any) => ({
      ...data,
      summary: racingLanguage(data.summary),
      season: data.season ? { ...data.season, label: racingLanguage(data.season.label) } : data.season,
      ...Object.fromEntries(["checks", "gates"].filter((key) => Array.isArray(data[key])).map((key) => [key,
        data[key].map((row: any) => ({ ...row, ...Object.fromEntries(
          ["label", "name", "note", "detail", "message"].filter((field) => typeof row[field] === "string")
            .map((field) => [field, racingLanguage(row[field])]),
        ) })),
      ])),
    }),
    refetchInterval: refreshMs(),
  });

export const useLockState = () =>
  useQuery({ queryKey: ["admin", "lock-state"], queryFn: () => getJson<any>("/api/public/lock-state"), refetchInterval: refreshMs() });

export const useRollup = () =>
  useQuery({ queryKey: ["admin", "rollup90"], queryFn: () => txApi.hitRateRollup(90), staleTime: 10 * 60_000 });

export const useRacingPnl = () =>
  useQuery({ queryKey: ["admin", "racing-pnl"], queryFn: () => txApi.strategyPnl(), staleTime: 10 * 60_000 });

export type VersionRow = { version: string; engine: string; fingerprint: string | null; released_at: string; status: string; notes: string | null };
export const useModelVersions = () =>
  useQuery({
    queryKey: ["admin", "model-versions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("model_versions")
        .select("version,engine,fingerprint,released_at,status,notes")
        .order("released_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as VersionRow[]).filter((row) => isRacingEngine(row.engine));
    },
  });

export const ago = (iso?: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(m)) return "—";
  if (m < 1) return "啱啱";
  if (m < 60) return `${m} 分鐘前`;
  if (m < 48 * 60) return `${Math.round(m / 60)} 小時前`;
  return `${Math.round(m / 1440)} 日前`;
};
