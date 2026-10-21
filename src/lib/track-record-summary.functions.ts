import { createServerFn } from '@tanstack/react-start';
export const getTrackRecordSummary = createServerFn({ method: 'GET' }).handler(async () => {
  const { readTrackRecordSummary } = await import('./track-record-summary.server');
  return readTrackRecordSummary();
});