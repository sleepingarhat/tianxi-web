export type ModelFamilyReport = {
  scope: string;
  sourceRows: number;
  sourceRaces: number;
  completeRaces: number;
  excludedRaces: number;
  inputSha256: string;
  dates: string[];
  features: string[];
  allMissingFeatures: string[];
  limitations: string[];
  trees: number;
  seed: number;
  summary: { name: string; hits: number; races: number; averageHits: number; ci95: number[] }[];
  days: { date: string; trainingEnd: string; trainingRows: number; races: { raceId: string; models: Record<string, { hits: number; selected: string[] }> }[] }[];
};