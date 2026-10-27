import { describe, expect, it } from 'vitest';
import { mergeMeetingMetadata } from './racing-meeting-metadata';
describe('read-only meeting metadata', () => {
  it('shows R5 and R11 card time and distance before result records arrive', () => {
    expect(mergeMeetingMetadata(undefined, undefined, {startTime:'14:30',distance:1200})).toMatchObject({startTime:'14:30',distance:1200});
    expect(mergeMeetingMetadata(undefined, undefined, {startTime:'2026-10-19T17:50:00+08:00',distance:1400})).toMatchObject({startTime:'17:50',distance:1400});
  });
  it('fills empty fields rather than discarding complete card references', () => {
    expect(mergeMeetingMetadata({startTime:null,distance:0}, undefined, {startTime:'16:05',distance:1600})).toMatchObject({startTime:'16:05',distance:1600});
  });
  it('預測冇途程時用排位表途程，有途程就保留', () => {
    expect(mergeMeetingMetadata(
      { class: '第五班', distance: null, startTime: null, going: null },
      { class: '第五班', distance: 1650, startTime: '18:45', going: '好地' },
    )).toMatchObject({ class: '第五班', distance: 1650, startTime: '18:45', going: '好地' });
  });
  it('prefers settled official metadata and preserves unknown fields as null', () => {
    expect(mergeMeetingMetadata({startTime:'12:30',distance:1800}, undefined, {startTime:'13:00',distance:1400})).toMatchObject({startTime:'12:30',distance:1800});
    expect(mergeMeetingMetadata().distance).toBeNull();
  });
});