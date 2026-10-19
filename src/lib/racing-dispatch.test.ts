import { describe, expect, it } from 'vitest';
import { shouldDispatch, isDispatchWorkflow } from './racing-dispatch';

const now = Date.parse('2026-10-19T22:15:00Z');
const at = (min: number) => new Date(now - min * 60_000).toISOString();
describe('後端準時觸發排程', () => {
  it('GitHub 排程遲咗（20分鐘內冇新run）就觸發', () => {
    expect(shouldDispatch({ created_at: at(600), status: 'completed', conclusion: 'success' }, now)).toBe(true);
    expect(shouldDispatch(null, now)).toBe(true);
  });
  it('GitHub 剛準時開跑或成功就唔重複', () => {
    expect(shouldDispatch({ created_at: at(3), status: 'in_progress', conclusion: null }, now)).toBe(false);
    expect(shouldDispatch({ created_at: at(5), status: 'completed', conclusion: 'success' }, now)).toBe(false);
  });
  it('剛失敗或被skip照樣補觸發', () => {
    expect(shouldDispatch({ created_at: at(5), status: 'completed', conclusion: 'failure' }, now)).toBe(true);
    expect(shouldDispatch({ created_at: at(5), status: 'completed', conclusion: 'skipped' }, now)).toBe(true);
  });
  it('只准白名單排程', () => {
    expect(isDispatchWorkflow('capy_racecard.yml')).toBe(true);
    expect(isDispatchWorkflow('backend_deploy.yml')).toBe(false);
  });
});
