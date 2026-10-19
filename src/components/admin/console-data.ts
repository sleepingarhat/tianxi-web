import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { adminGet } from "@/lib/admin.functions";

export const DOT: Record<string, string> = {
  ok: "bg-win",
  warn: "bg-gold-strong",
  bad: "bg-lose",
};

export function fmtTime(v?: string | null) {
  if (!v) return "—";
  return v.replace("T", " ").slice(0, 16);
}

/** 共用：讀取一個 /admin/api GET 端點 */
export function useAdminData(path: string | null) {
  const get = useServerFn(adminGet);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!path) return;
    setLoading(true);
    setError(null);
    get({ data: { path } })
      .then((r) => {
        if (!r.ok) throw new Error(`Worker ${r.status}: ${JSON.stringify(r.payload).slice(0, 200)}`);
        setData(r.payload);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [get, path]);

  useEffect(load, [load]);
  return { data, error, loading, reload: load };
}

