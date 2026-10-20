import { z } from 'zod';

export const racingResultsJobInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('completion-check') }).strict(),
  z.object({
    kind: z.literal('archive-backfill'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
      const parsed = new Date(`${value}T00:00:00Z`);
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    }),
    venue: z.enum(['ST', 'HV']),
    raceNumber: z.number().int().min(1).max(12),
  }).strict(),
]);