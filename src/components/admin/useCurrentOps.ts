import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { adminGet } from '@/lib/admin.functions';
import { getOpsEventHistory } from '@/lib/ops-history.functions';
import { projectCurrentOps } from '@/lib/ops-log-projection';
import { refreshMs, useEngineHealth, useRacingHealth } from './data';

export function useCurrentOps(showOk = false) {
  const get = useServerFn(adminGet);
  const getHistory = useServerFn(getOpsEventHistory);
  const alerts = useQuery({ queryKey: ['admin', 'alerts'], queryFn: async () => {
    const result = await get({ data: { path: '/admin/api/alerts' } });
    if (!result.ok) throw new Error(`資料完整性讀取失敗（${result.status}）`);
    return result;
  }, refetchInterval: refreshMs() });
  const history = useQuery({ queryKey: ['admin', 'ops-history'], queryFn: () => getHistory({ data: { days: 90, limit: 1000 } }), refetchInterval: refreshMs() });
  const rh = useRacingHealth();
  const eh = useEngineHealth();
  const payload = alerts.data?.payload;
  const list = Array.isArray(payload) ? payload : payload?.['alerts'] ?? payload?.['items'] ?? [];
  const readErrors = [];
  for (const [source, query] of [['賽馬健康', rh], ['引擎健康', eh], ['/admin/api/alerts', alerts], ['事件紀錄', history]] as const) {
    if (query.isError) readErrors.push({ source, message: String(query.error?.message ?? '資料暫時讀取不到') });
  }
  const logs = projectCurrentOps({
    history: history.data ?? [], checks: eh.isError ? [] : eh.data?.checks ?? [],
    alerts: list, workflows: rh.data?.workflows ?? [], telegram: rh.data?.telegram?.failing ?? [],
    readErrors, now: Date.now(), showOk,
  });
  const refresh = () => { history.refetch(); alerts.refetch(); rh.refetch(); eh.refetch(); };
  return { logs, rh, eh, refresh, refreshing: alerts.isFetching || history.isFetching || rh.isFetching || eh.isFetching,
    loading: alerts.isLoading || history.isLoading || rh.isLoading || eh.isLoading };
}