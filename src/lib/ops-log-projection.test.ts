import { describe, expect, it } from 'vitest';
import { currentOpsHistory, isInactiveOddsAlert, projectCurrentOps, type OpsHistoryRow } from './ops-log-projection';
const now = Date.parse('2026-10-24T05:10:00Z');
const gate = (overrides: Partial<OpsHistoryRow> = {}): OpsHistoryRow => ({ kind: 'model_gate', source: 'engine-health', severity: 'error', message: '未完成鎖點核實', occurred_at: '2026-10-21T09:15:00Z', gate_key: 'freeze_recovery', gate_status: 'FAIL', model_version: 'v3.2', ...overrides });
describe('現時日誌投影', () => {
  it('總覽與日誌均計入四項獨立失敗，不僅計單一已登記任務', () => {
    const logs = projectCurrentOps({ now, history: [], telegram: [], readErrors: [], checks: [],
      workflows: [{ state: 'fail', label: '賽果', file: 'capy_race_daily.yml', conclusion: 'failure', startedAt: '2026-10-24T04:00:00Z' }],
      alerts: ['完整性', '四倉政策', 'Wave4'].map(title => ({ title, severity: 'critical' })),
    });
    expect(logs.filter(log => log.level === 'fail')).toHaveLength(4);
  });
  it('讀取失敗保持可見，不以舊PASS或空資料當正常', () => {
    const logs = projectCurrentOps({ now, history: [], telegram: [], workflows: [], alerts: [],
      checks: [{ key: 'a', status: 'PASS' }, { key: 'b', status: 'FAIL' }], readErrors: [{ source: '日誌', message: '讀取失敗' }] });
    expect(logs.filter(log => log.level === 'fail')).toHaveLength(2);
    expect(logs.some(log => log.source === '日誌')).toBe(true);
  });
  it('後來PASS取代7項舊失敗中嘅凍結事故，不修改原始紀錄', () => {
    const rows = [gate(), gate({ occurred_at: '2026-10-21T09:20:00Z', severity: 'info', gate_status: 'PASS' })];
    expect(currentOpsHistory(rows, [], now)).toEqual([]);
    expect(rows[0]?.gate_status).toBe('FAIL');
  });
  it('即時診斷PASS取代舊診斷警告', () => {
    expect(currentOpsHistory([gate({ gate_key: 'diag_persist', severity: 'warning', gate_status: 'WATCH' })], [{ id: 'diag_persist', status: 'PASS' }], now)).toEqual([]);
  });
  it('無恢復證據嘅舊模型FAIL仍保留', () => {
    expect(currentOpsHistory([gate()], [], now)).toHaveLength(1);
  });
  it('過往日子API事故唔冒充今日故障，但今日新故障保留', () => {
    const old = gate({ kind: 'api_error', occurred_at: '2026-10-23T06:10:00Z' });
    const current = { ...old, occurred_at: '2026-10-24T04:00:00Z' };
    expect(currentOpsHistory([old, current], [], now)).toEqual([current]);
  });
  it('香港午夜分日，不用UTC日期', () => {
    expect(currentOpsHistory([gate({ kind: 'api_error', occurred_at: '2026-10-23T17:00:00Z' })], [], now)).toHaveLength(1);
  });
  it('退休產品同斷線紀錄不計警報', () => {
    expect(currentOpsHistory([gate({ source: 'football' }), gate({ message: 'Error: aborted' })], [], now)).toEqual([]);
  });
  it('54小時舊盤口只在即時檢查明確確認非投注窗口時略過', () => {
    const check = { id: 'display_odds_freshness', status: 'PASS', detail: '非本地賽日投注窗口或已全日開跑，不按舊盤口誤報。' };
    expect(isInactiveOddsAlert('賠率已停更新 54.0 小時', [check])).toBe(true);
    expect(isInactiveOddsAlert('賠率已停更新 54.0 小時', [{ ...check, status: 'FAIL' }])).toBe(false);
    expect(isInactiveOddsAlert('賠率已停更新 54.0 小時', [])).toBe(false);
    expect(isInactiveOddsAlert('賠率已停更新 54.0 小時', [{ ...check, detail: '盤口正常' }])).toBe(false);
    expect(isInactiveOddsAlert('賽果身份不符', [check])).toBe(false);
  });
});