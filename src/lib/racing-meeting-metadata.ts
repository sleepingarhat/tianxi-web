export type RacingMeetingMetadata = {
  raceNumber?: number; raceId?: string | undefined; startTime?: string | null; title?: string | null;
  class?: string | null; distance?: number | null; going?: string | null; track?: string | null; course?: string | null;
};

/** Display references only: never merge runner identities, ranks, scores or probabilities. */
export function mergeMeetingMetadata(settled?: RacingMeetingMetadata, meeting?: RacingMeetingMetadata, card?: RacingMeetingMetadata): RacingMeetingMetadata {
  const text = (key: 'startTime' | 'title' | 'class' | 'going' | 'track' | 'course') =>
    [settled?.[key], meeting?.[key], card?.[key]].find(v => typeof v === 'string' && v.trim().length > 0) ?? null;
  const distance = [settled?.distance, meeting?.distance, card?.distance].find(v => typeof v === 'number' && Number.isFinite(v) && v > 0) ?? null;
  const rawTime = text('startTime');
  const startTime = rawTime?.match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}):\d{2}\+08:00$/)?.[1] ?? rawTime;
  return { raceId: settled?.raceId ?? meeting?.raceId, startTime, title: text('title'), class: text('class'), distance, going: text('going'), track: text('track'), course: text('course') };
}