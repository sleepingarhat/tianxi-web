// 特徵排序表：直接由 D1（tianxi-backend 資料庫）唯讀計算，全部在伺服器端執行。
import type { FeatureId, FeatureStat, Horse } from "./race-data";

export async function d1<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const { publicRacingQuery } = await import('./public-racing-evidence.server');
  return publicRacingQuery<T>(sql, params);
}

const ph = (n: number) => Array.from({ length: n }, () => "?").join(",");

/** 馬會官方即日地質（風速追蹤器同源 whitelist query，必須逐字相同）。 */
const MEETING_GOING_QUERY = `
query wt_WeatherMeeting( $localSim: LocalSim, $status: [MeetingStatus!])  {
  commonMeetings(localSim: $localSim, status: $status) {
    date
    venueCode
    meetingTrack_en
    meetingTrack_ch
    status
    totalNumberOfRace
    currentNumberOfRace
     meetingType
     penetrometerReadings {
      reading
      readingTime
      sequenceNumber
    }
    hammerReadings {
      sequenceNumber
      readingTime
      reading
    }
    course {
      code
      chinese
      english
      mandarin
    }
    races {
      go_en
      go_ch
      status
      no
      raceTrack {
        code
      }
    }
  }
}
`;

/** 同一白名單查詢一次讀晒該賽日各地況；加欄位會被馬會拒（WHITELIST_ERROR）。 */
export async function fetchOfficialMeetingCard(
  date: string,
  venue: string,
): Promise<{ track: string | null; goings: Record<number, string> }> {
  try {
    const r = await fetch("https://info.cld.hkjc.com/graphql/base/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://racing.hkjc.com",
        referer: "https://racing.hkjc.com/",
      },
      body: JSON.stringify({
        variables: {
          localSim: "LOCAL",
          status: ["DECLARED", "DEFINED", "STARTED", "CLOSED", "ABANDON_PARTIAL", "ABANDON"],
        },
        query: MEETING_GOING_QUERY,
      }),
    });
    const json: any = await r.json();
    const meetings: any[] = json?.data?.commonMeetings ?? [];
    const m = meetings.find((x) => x?.date === date && x?.venueCode === venue);
    if (!m) return { track: null, goings: {} };
    const goings: Record<number, string> = {};
    for (const race of m.races ?? []) {
      const n = Number(race?.no);
      const going = typeof race?.go_ch === "string" ? race.go_ch.trim() : "";
      if (Number.isInteger(n) && n > 0 && going) goings[n] = going;
    }
    const track = typeof m.meetingTrack_ch === "string" ? m.meetingTrack_ch.trim() : "";
    return { track: track || null, goings };
  } catch {
    return { track: null, goings: {} };
  }
}

export async function fetchOfficialGoing(
  date: string,
  venue: string,
  raceNumber: number,
): Promise<string | null> {
  const card = await fetchOfficialMeetingCard(date, venue);
  return card.goings[raceNumber] ?? Object.values(card.goings)[0] ?? null;
}


export type RaceOption = {
  id: string;
  date: string;
  venue: string;
  raceNumber: number;
  distance: number | null;
  className: string | null;
  going: string | null;
  course: string | null;
};

const VENUE_CH: Record<string, string> = { ST: "沙田", HV: "跑馬地" };
export const venueLabel = (v: string) => VENUE_CH[v] ?? v;

export async function listRaces(date?: string): Promise<{ dates: string[]; races: RaceOption[] }> {
  const [settled, upcoming] = await Promise.all([
    d1<{ date: string }>(
      `SELECT m.date FROM race_meetings m
       JOIN races r ON r.meeting_id = m.id
       GROUP BY m.date HAVING COUNT(*) > 0 ORDER BY m.date DESC LIMIT 24`,
    ),
    d1<{ date: string }>(
      `SELECT race_date AS date FROM entries_upcoming GROUP BY race_date ORDER BY race_date DESC LIMIT 4`,
    ),
  ]);
  const settledDates = settled.map((d) => d.date);
  const dates = [...new Set([...upcoming.map((d) => d.date), ...settledDates])]
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 24);
  const target = date && dates.includes(date) ? date : dates[0];
  if (!target) return { dates, races: [] };

  if (!settledDates.includes(target)) {
    // 未跑賽日：用排位表（entries_upcoming）
    const rows = await d1<{
      venue: string;
      raceNumber: number;
      distance: number | null;
      className: string | null;
      course: string | null;
      track: string | null;
    }>(
      `SELECT venue, race_number AS raceNumber, MAX(distance) AS distance,
              MAX(race_class) AS className, MAX(course) AS course, MAX(track) AS track
       FROM entries_upcoming WHERE race_date = ?
       GROUP BY venue, race_number ORDER BY race_number`,
      [target],
    );
    return {
      dates,
      races: rows.map((r) => ({
        id: `upcoming:${target}:${r.venue}:${r.raceNumber}`,
        date: target,
        venue: r.venue,
        raceNumber: r.raceNumber,
        distance: r.distance,
        className: r.className,
        going: null,
        course: r.course ?? r.track,
      })),
    };
  }

  const races = await d1<RaceOption>(
    `SELECT r.id, m.date, m.venue, r.race_number AS raceNumber, r.distance,
            r.class AS className, r.going, r.course
     FROM races r JOIN race_meetings m ON m.id = r.meeting_id
     WHERE m.date = ? ORDER BY r.race_number`,
    [target],
  );
  return { dates, races };
}


type Start = {
  horse_id: string;
  race_id: string;
  date: string;
  venue: string;
  distance: number | null;
  course: string | null;
  going: string | null;
  pos: number | null;
  draw: number | null;
  weight: number | null;
  finish_time: number | null;
  jockey_id: string | null;
  trainer_id: string | null;
};


const norm = (vals: (number | null)[], higherBetter: boolean): number[] => {
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return vals.map(() => 50);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return vals.map((v) => {
    if (v == null || !Number.isFinite(v)) return 0;
    if (max === min) return 60;
    const t = (v - min) / (max - min);
    return Math.round((higherBetter ? t : 1 - t) * 96) + 4;
  });
};

const fmtTime = (s: number | null) => {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return m > 0 ? `${m}.${rest.toFixed(2).padStart(5, "0")}` : rest.toFixed(2);
};

const rate = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);

export type FeatureRaceResult = {
  race: RaceOption & { venueLabel: string; title: string | null };
  horses: Horse[];
  /** 每匹馬歷史起步數合計，用於顯示資料覆蓋 */
  sampleStarts: number;
};

type Runner = {
  horse_id: string;
  horse_number: number | null;
  name: string | null;
  draw: number | null;
  actual_weight: number | null;
  win_odds: number | null;
  jockey_id: string | null;
  trainer_id: string | null;
  jockey: string | null;
  trainer: string | null;
};

export async function buildFeatureRace(raceId: string): Promise<FeatureRaceResult> {
  let race: (RaceOption & { title: string | null }) | undefined;
  let runners: Runner[] = [];

  if (raceId.startsWith("upcoming:")) {
    const [, date, venue, num] = raceId.split(":");
    if (!date || !venue || !num) throw new Error("賽事編號無效");
    // 排位表冇騎練 id，只有中文名；用名稱對回 jockeys / trainers。
    runners = await d1<Runner>(
      `SELECT e.horse_id, e.horse_number,
              COALESCE(h.name_ch, h.name_en, e.horse_code, e.horse_id) AS name,
              e.draw, e.actual_weight, NULL AS win_odds,
              COALESCE(e.jockey_id, j.id) AS jockey_id,
              COALESCE(e.trainer_id, t.id) AS trainer_id,
              COALESCE(j.name_ch, e.jockey_name) AS jockey,
              COALESCE(t.name_ch, e.trainer_name) AS trainer
       FROM entries_upcoming e
       LEFT JOIN horses h ON h.id = e.horse_id
       LEFT JOIN jockeys j ON j.id = COALESCE(e.jockey_id, 'jockey_' || e.jockey_name)
       LEFT JOIN trainers t ON t.id = COALESCE(e.trainer_id, 'trainer_' || e.trainer_name)
       WHERE e.race_date = ? AND e.venue = ? AND e.race_number = ?
         AND e.horse_id IS NOT NULL
       ORDER BY e.horse_number`,
      [date, venue, Number(num)],
    );
    const [meta] = await d1<{
      distance: number | null;
      className: string | null;
      course: string | null;
      track: string | null;
    }>(
      `SELECT MAX(distance) AS distance, MAX(race_class) AS className,
              MAX(course) AS course, MAX(track) AS track
       FROM entries_upcoming WHERE race_date = ? AND venue = ? AND race_number = ?`,
      [date, venue, Number(num)],
    );
    // 未跑賽日：優先用馬會官方即日地質（風速追蹤器同源），冇先退回同一馬場最近賽日實際地質。
    const officialGoing = await fetchOfficialGoing(date, venue, Number(num));
    const [lastGoing] = officialGoing
      ? [{ going: officialGoing }]
      : await d1<{ going: string | null }>(
          `SELECT r.going FROM races r JOIN race_meetings m ON m.id = r.meeting_id
       WHERE m.venue = ? AND m.date < ? AND r.going IS NOT NULL
       ORDER BY m.date DESC LIMIT 1`,
          [venue, date],
        );
    race = {
      id: raceId,
      date,
      venue,
      raceNumber: Number(num),
      distance: meta?.distance ?? null,
      className: meta?.className ?? null,
      going: lastGoing?.going ?? null,

      course: meta?.course ?? meta?.track ?? null,
      title: null,
    };
  } else {
    [race] = await d1<RaceOption & { title: string | null }>(
      `SELECT r.id, m.date, m.venue, r.race_number AS raceNumber, r.distance,
              r.class AS className, r.going, r.course, r.title
       FROM races r JOIN race_meetings m ON m.id = r.meeting_id WHERE r.id = ?`,
      [raceId],
    );
    if (!race) throw new Error("找不到該場賽事");
    runners = await d1<Runner>(
      `SELECT rr.horse_id, rr.horse_number, COALESCE(h.name_ch, h.name_en, rr.horse_id) AS name,
              rr.draw, rr.actual_weight, rr.win_odds, rr.jockey_id, rr.trainer_id,
              j.name_ch AS jockey, t.name_ch AS trainer
       FROM race_results rr
       LEFT JOIN horses h ON h.id = rr.horse_id
       LEFT JOIN jockeys j ON j.id = rr.jockey_id
       LEFT JOIN trainers t ON t.id = rr.trainer_id
       WHERE rr.race_id = ? AND rr.horse_id IS NOT NULL
       ORDER BY rr.horse_number`,
      [raceId],
    );
  }
  if (!race) throw new Error("找不到該場賽事");
  if (!runners.length) throw new Error("該場尚無出賽馬匹資料");

  const ids = runners.map((r) => r.horse_id);
  const starts = await d1<Start>(
    `SELECT rr.horse_id, rr.race_id, m.date, m.venue, r.distance, r.course, r.going,
            rr.finishing_position AS pos, rr.draw, rr.actual_weight AS weight,
            rr.finish_time, rr.jockey_id, rr.trainer_id
     FROM race_results rr
     JOIN races r ON r.id = rr.race_id
     JOIN race_meetings m ON m.id = r.meeting_id
     WHERE rr.horse_id IN (${ph(ids.length)}) AND m.date < ?
     ORDER BY m.date DESC`,
    [...ids, race.date],
  );


  const lastSec = await d1<{ horse_id: string; distance: number | null; section_time: number | null }>(
    `SELECT hst.horse_id, r.distance, hst.section_time
     FROM horse_sectional_times hst
     JOIN races r ON r.id = hst.race_id
     JOIN race_meetings m ON m.id = r.meeting_id
     WHERE hst.horse_id IN (${ph(ids.length)}) AND m.date < ?
       AND hst.section_number = (
         SELECT MAX(section_number) FROM horse_sectional_times x WHERE x.race_id = hst.race_id
       )`,
    [...ids, race.date],
  );

  // 騎練合作往績
  const pairs = runners
    .filter((r) => r.jockey_id && r.trainer_id)
    .map((r) => [r.jockey_id!, r.trainer_id!] as const);
  const jt = pairs.length
    ? await d1<{ jockey_id: string; trainer_id: string; n: number; w: number; p: number }>(
        `SELECT rr.jockey_id, rr.trainer_id, COUNT(*) AS n,
                SUM(CASE WHEN rr.finishing_position = 1 THEN 1 ELSE 0 END) AS w,
                SUM(CASE WHEN rr.finishing_position <= 3 THEN 1 ELSE 0 END) AS p
         FROM race_results rr
         JOIN races r ON r.id = rr.race_id
         JOIN race_meetings m ON m.id = r.meeting_id
         WHERE m.date < ? AND rr.finishing_position < 900
           AND (${pairs.map(() => "(rr.jockey_id = ? AND rr.trainer_id = ?)").join(" OR ")})
         GROUP BY rr.jockey_id, rr.trainer_id`,
        [race.date, ...pairs.flatMap((p) => [p[0], p[1]])],
      )
    : [];
  const jtKey = (j?: string | null, t?: string | null) => `${j}|${t}`;
  const jtMap = new Map(jt.map((r) => [jtKey(r.jockey_id, r.trainer_id), r]));

  const byHorse = new Map<string, Start[]>(ids.map((id) => [id, []]));
  const byRace = new Map<string, Start[]>();
  for (const s of starts) {
    byHorse.get(s.horse_id)?.push(s);
    if (!byRace.has(s.race_id)) byRace.set(s.race_id, []);
    byRace.get(s.race_id)!.push(s);
  }

  // 同場對賽勝次：本場馬匹過往同場交手中跑贏對手的次數
  const h2h = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const group of byRace.values()) {
    if (group.length < 2) continue;
    for (const a of group)
      for (const b of group) {
        if (a.horse_id === b.horse_id) continue;
        if (a.pos != null && b.pos != null && a.pos < b.pos && a.pos < 900)
          h2h.set(a.horse_id, (h2h.get(a.horse_id) ?? 0) + 1);
      }
  }

  const secBest = new Map<string, number>();
  for (const row of lastSec) {
    if (row.section_time == null) continue;
    if (row.distance != null && race.distance != null && row.distance !== race.distance) continue;
    const cur = secBest.get(row.horse_id);
    if (cur == null || row.section_time < cur) secBest.set(row.horse_id, row.section_time);
  }

  const raw = runners.map((r) => {
    const hist = (byHorse.get(r.horse_id) ?? []).filter((s) => s.pos != null && s.pos < 900);
    const sameDist = hist.filter((s) => s.distance === race.distance);
    const sameVenue = hist.filter((s) => s.venue === race.venue);
    const sameDraw = sameVenue.filter((s) => s.distance === race.distance && s.draw === r.draw);
    const combo = sameVenue.filter((s) => s.distance === race.distance);
    const sameGoing = race.going ? hist.filter((s) => s.going === race.going) : [];
    const times = sameDist.map((s) => s.finish_time).filter((v): v is number => !!v && v > 0);
    const last5 = hist.slice(0, 5);
    const lastDate = hist[0]?.date;
    const restDays = lastDate
      ? Math.round((Date.parse(race.date) - Date.parse(lastDate)) / 86400000)
      : null;
    // 名次趨勢：近五仗（由舊到新）名次線性斜率，負數＝名次變細＝進步
    const chrono = [...last5].reverse();
    let slope: number | null = null;
    if (chrono.length >= 3) {
      const n = chrono.length;
      const mx = (n - 1) / 2;
      const my = chrono.reduce((a, s) => a + s.pos!, 0) / n;
      let num = 0;
      let den = 0;
      chrono.forEach((s, idx) => {
        num += (idx - mx) * (s.pos! - my);
        den += (idx - mx) ** 2;
      });
      slope = den ? num / den : 0;
    }
    const w5 = last5.map((s) => s.weight).filter((v): v is number => v != null && v > 0);
    const pair = jtMap.get(jtKey(r.jockey_id, r.trainer_id));
    return {
      r,
      hist,
      sameDist,
      sameVenue,
      sameDraw,
      combo,
      sameGoing,
      bestTime: times.length ? Math.min(...times) : null,
      bestSec: secBest.get(r.horse_id) ?? null,
      last5,
      slope,
      weightAvg5: w5.length ? w5.reduce((a, b) => a + b, 0) / w5.length : null,
      restDays,
      pair,
      h2hWins: h2h.get(r.horse_id) ?? 0,
    };
  });

  const top3 = (rows: Start[]) => rows.filter((s) => s.pos! <= 3).length;
  const wins = (rows: Start[]) => rows.filter((s) => s.pos === 1).length;

  const scores: Record<FeatureId, number[]> = {
    h2h: norm(raw.map((x) => x.h2hWins), true),
    distance: norm(
      raw.map((x) => (x.sameDist.length ? rate(wins(x.sameDist), x.sameDist.length) : null)),
      true,
    ),
    distStarts: norm(raw.map((x) => x.sameDist.length), true),
    draw: norm(
      raw.map((x) => (x.sameDraw.length ? rate(top3(x.sameDraw), x.sameDraw.length) : null)),
      true,
    ),
    drawStarts: norm(raw.map((x) => x.sameDraw.length), true),
    time: norm(raw.map((x) => x.bestTime), false),
    finish: norm(raw.map((x) => x.bestSec), false),
    jt: norm(raw.map((x) => (x.pair ? rate(x.pair.w, x.pair.n) : null)), true),
    form: norm(
      raw.map((x) => (x.last5.length ? x.last5.reduce((a, s) => a + s.pos!, 0) / x.last5.length : null)),
      false,
    ),
    formTop3: norm(
      raw.map((x) => (x.last5.length ? rate(top3(x.last5), x.last5.length) : null)),
      true,
    ),
    formSlope: norm(raw.map((x) => x.slope), false),
    track: norm(
      raw.map((x) => (x.sameVenue.length ? rate(wins(x.sameVenue), x.sameVenue.length) : null)),
      true,
    ),
    comboTop3: norm(raw.map((x) => (x.combo.length ? top3(x.combo) : null)), true),
    goingTop3: norm(raw.map((x) => (x.sameGoing.length ? top3(x.sameGoing) : null)), true),
    careerWin: norm(raw.map((x) => (x.hist.length ? rate(wins(x.hist), x.hist.length) : null)), true),
    careerTop3: norm(raw.map((x) => (x.hist.length ? rate(top3(x.hist), x.hist.length) : null)), true),
    rest: norm(raw.map((x) => (x.restDays == null ? null : Math.abs(x.restDays - 21))), false),
    weight: norm(raw.map((x) => x.r.actual_weight), false),
    weightAvg5: norm(raw.map((x) => x.weightAvg5), false),
  };


  const stat = (metric: string, win: number, place: number, score: number): FeatureStat => ({
    metric,
    win: Number(win.toFixed(1)),
    place: Number(place.toFixed(1)),
    score,
  });

  const horses: Horse[] = raw.map((x, i) => {
    const { r } = x;
    const pairStat = x.pair;
    return {
      no: r.horse_number ?? i + 1,
      name: (r.name ?? "").replace(/\s*\([A-Z]\d{3}\)\s*/g, "") || "—",
      age: 0,
      jockey: r.jockey ?? "—",
      trainer: r.trainer ?? "—",
      draw: r.draw ?? 0,
      weight: r.actual_weight ?? 0,
      odds: r.win_odds ?? 0,
      oddsDelta: 0,
      stats: {
        h2h: stat(String(x.h2hWins), 0, 0, scores.h2h[i]!),
        distance: stat(
          `${x.sameDist.filter((s) => s.pos === 1).length}/${x.sameDist.length}`,
          rate(x.sameDist.filter((s) => s.pos === 1).length, x.sameDist.length),
          rate(x.sameDist.filter((s) => s.pos! <= 3).length, x.sameDist.length),
          scores.distance[i]!,
        ),
        draw: stat(
          `${r.draw ?? "—"} 檔`,
          rate(x.sameDraw.filter((s) => s.pos === 1).length, x.sameDraw.length),
          rate(x.sameDraw.filter((s) => s.pos! <= 3).length, x.sameDraw.length),
          scores.draw[i]!,
        ),
        time: stat(fmtTime(x.bestTime), 0, 0, scores.time[i]!),
        finish: stat(x.bestSec != null ? x.bestSec.toFixed(2) : "—", 0, 0, scores.finish[i]!),
        jt: stat(
          pairStat ? `${pairStat.w}/${pairStat.n}` : "—",
          pairStat ? rate(pairStat.w, pairStat.n) : 0,
          pairStat ? rate(pairStat.p, pairStat.n) : 0,
          scores.jt[i]!,
        ),
        form: stat(
          x.last5.length ? x.last5.map((s) => s.pos).join("-") : "新馬",
          rate(x.last5.filter((s) => s.pos === 1).length, x.last5.length),
          rate(x.last5.filter((s) => s.pos! <= 3).length, x.last5.length),
          scores.form[i]!,
        ),
        track: stat(
          `${x.sameVenue.filter((s) => s.pos === 1).length}/${x.sameVenue.length}`,
          rate(x.sameVenue.filter((s) => s.pos === 1).length, x.sameVenue.length),
          rate(x.sameVenue.filter((s) => s.pos! <= 3).length, x.sameVenue.length),
          scores.track[i]!,
        ),
        rest: stat(x.restDays == null ? "—" : `${x.restDays} 日`, 0, 0, scores.rest[i]!),
        weight: stat(r.actual_weight != null ? String(r.actual_weight) : "—", 0, 0, scores.weight[i]!),
        distStarts: stat(`${x.sameDist.length} 仗`, 0, 0, scores.distStarts[i]!),
        drawStarts: stat(`${x.sameDraw.length} 仗`, 0, 0, scores.drawStarts[i]!),
        comboTop3: stat(
          `${top3(x.combo)}/${x.combo.length}`,
          rate(wins(x.combo), x.combo.length),
          rate(top3(x.combo), x.combo.length),
          scores.comboTop3[i]!,
        ),
        goingTop3: stat(
          x.sameGoing.length ? `${top3(x.sameGoing)}/${x.sameGoing.length}` : "—",
          rate(wins(x.sameGoing), x.sameGoing.length),
          rate(top3(x.sameGoing), x.sameGoing.length),
          scores.goingTop3[i]!,
        ),
        careerWin: stat(
          `${wins(x.hist)}/${x.hist.length}`,
          rate(wins(x.hist), x.hist.length),
          rate(top3(x.hist), x.hist.length),
          scores.careerWin[i]!,
        ),
        careerTop3: stat(
          `${top3(x.hist)}/${x.hist.length}`,
          rate(wins(x.hist), x.hist.length),
          rate(top3(x.hist), x.hist.length),
          scores.careerTop3[i]!,
        ),
        formTop3: stat(
          x.last5.length ? `${top3(x.last5)}/${x.last5.length}` : "新馬",
          rate(wins(x.last5), x.last5.length),
          rate(top3(x.last5), x.last5.length),
          scores.formTop3[i]!,
        ),
        formSlope: stat(
          x.slope == null ? "—" : (x.slope <= 0 ? "▲" : "▼") + Math.abs(x.slope).toFixed(2),
          0,
          0,
          scores.formSlope[i]!,
        ),
        weightAvg5: stat(
          x.weightAvg5 == null ? "—" : x.weightAvg5.toFixed(0),
          0,
          0,
          scores.weightAvg5[i]!,
        ),
      },

    };
  });

  return {
    race: { ...race, venueLabel: venueLabel(race.venue) },
    horses,
    sampleStarts: starts.length,
  };
}
