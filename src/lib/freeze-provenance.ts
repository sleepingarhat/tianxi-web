/**
 * 「鎖後補建」標示：鎖點時未能及時建立原凍結副本，經擁有人批准、以鎖前寫好而鎖後冇改過嘅
 * 預測紀錄補建。標示寫喺副本 JSON 入面（受 SHA-256 保護），網站只讀取、唔推斷。
 * 第一次使用：2026-11-22 沙田（鎖前退出馬未剔除令凍結核對阻截）。
 */
export const REBUILD_LABEL = '鎖後補建';

export type RebuildProvenance = { kind: 'post-lock-rebuild'; approvedAt: string; rebuiltAt: string };

export function rebuildProvenance(snapshot: unknown): RebuildProvenance | null {
  const p = (snapshot as { provenance?: Record<string, unknown> } | null)?.provenance;
  if (!p || p['kind'] !== 'post-lock-rebuild') return null;
  const approvedAt = typeof p['approvedAt'] === 'string' ? p['approvedAt'] : '';
  const rebuiltAt = typeof p['rebuiltAt'] === 'string' ? p['rebuiltAt'] : '';
  if (!Number.isFinite(Date.parse(approvedAt)) || !Number.isFinite(Date.parse(rebuiltAt))) return null;
  return { kind: 'post-lock-rebuild', approvedAt, rebuiltAt };
}

/** 對帳頁預測欄副標。 */
export function frozenSourceLabel(opts: { legacy: boolean; hasFrozen: boolean; rebuild: RebuildProvenance | null | undefined }) {
  if (!opts.hasFrozen) return '原凍結核對中';
  if (opts.legacy) return '舊紀錄，未經原始副本核實';
  return opts.rebuild ? `${REBUILD_LABEL}副本（計入正式戰績）` : '已核實原始凍結副本';
}

export const REBUILD_EXPLANATION = '鎖點時凍結副本未能及時建立；經擁有人批准，以鎖前寫好、鎖後冇改過嘅預測紀錄補建，計入正式戰績。原紀錄冇改動。';
