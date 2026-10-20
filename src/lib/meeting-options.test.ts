import { expect, it } from 'vitest';
import { meetingOptions } from './meeting-options';
it('只提供有賽事日子、不插入中間冇賽事日', () => {
  expect(meetingOptions([{ date: '2026-10-19' }, { date: '2026-10-21' }, { date: '2026-10-19' }]).map(row => row.date))
    .toEqual(['2026-10-21', '2026-10-19']);
});