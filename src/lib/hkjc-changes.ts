/** Parse HKJC official "更易事項" (changes) page text. Pure; no network. */
export type HkjcChange = { raceNumber: number; horseNumber: number; horseName: string; kind: 'scratched' | 'replaced' | 'other'; replacement: string | null; text: string; announcedAt: string };

export function parseHkjcChanges(htmlText: string): HkjcChange[] {
  const text = htmlText.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const out: HkjcChange[] = [];
  const races = text.split(/第 (\d+) 場/);
  for (let i = 1; i < races.length; i += 2) {
    const raceNumber = Number(races[i]);
    const body = races[i + 1] ?? '';
    for (const m of body.matchAll(/(\d+) 號馬 (\S+) ([^()]*?)\s*\((\d{2}\/\d{2} \d{2}:\d{2})\)/g)) {
      const t = m[3].trim();
      const rep = t.match(/由後備馬 (\S+) 補上/);
      out.push({ raceNumber, horseNumber: Number(m[1]), horseName: m[2], kind: rep ? 'replaced' : /退出競賽/.test(t) ? 'scratched' : 'other', replacement: rep?.[1] ?? null, text: t, announcedAt: m[4] });
    }
  }
  return out;
}
