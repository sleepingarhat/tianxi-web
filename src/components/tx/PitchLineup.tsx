export type LPlayer = { id: number; name: string; short_name?: string; position?: string; jersey_number?: number | null; ai_score?: number };
export type LSide = { team_name?: string; formation?: string; confidence?: number; players?: LPlayer[]; substitutes?: LPlayer[] };

const POS_ZH: Record<string, string> = { G: "門", D: "後", M: "中", F: "前" };

/** 按陣式把正選分行（門將一行＋陣式各段） */
function rowsOf(side: LSide) {
  const ps = side.players ?? [];
  const gk = ps.filter((p) => p.position === "G").slice(0, 1);
  const rest = ps.filter((p) => !gk.includes(p));
  const shape = (side.formation ?? "").split("-").map(Number).filter((n) => n > 0);
  const out: LPlayer[][] = [gk];
  let i = 0;
  for (const n of shape.length ? shape : [4, 4, 2]) { out.push(rest.slice(i, i + n)); i += n; }
  if (i < rest.length) out[out.length - 1]!.push(...rest.slice(i));
  return out;
}

function Half({ side, tone, flip }: { side: LSide; tone: "home" | "away"; flip?: boolean }) {
  const rows = rowsOf(side);
  const ordered = flip ? [...rows].reverse() : rows;
  return (
    <div className="flex flex-1 flex-col justify-around gap-1 py-2">
      {ordered.map((row, ri) => (
        <div key={ri} className="flex justify-around">
          {row.map((p) => (
            <div key={p.id} className="flex w-14 flex-col items-center">
              <span className={`grid h-7 w-7 place-items-center rounded-full border-2 border-paper font-mono-tx text-[11px] font-bold shadow-sm ${tone === "home" ? "bg-gold text-ink" : "bg-ink text-paper"}`}>
                {p.jersey_number ?? ""}
              </span>
              <span className="mt-0.5 w-full truncate text-center text-[10px] font-bold leading-tight text-paper [text-shadow:0_1px_2px_rgb(0_0_0/0.6)]">
                {p.short_name ?? p.name}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** 直向球場（手機先決）：主隊下半、客隊上半，名唔重疊 */
export function PitchLineup({ home, away }: { home: LSide; away: LSide }) {
  return (
    <div className="relative flex aspect-[3/4] max-h-[620px] w-full flex-col overflow-hidden rounded-[10px] border border-hairline bg-win/80">
      <div className="pointer-events-none absolute inset-2 rounded-[4px] border border-paper/40" />
      <div className="pointer-events-none absolute inset-x-2 top-1/2 border-t border-paper/40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-paper/40" />
      <div className="pointer-events-none absolute left-1/2 top-2 h-8 w-1/3 -translate-x-1/2 border border-t-0 border-paper/40" />
      <div className="pointer-events-none absolute bottom-2 left-1/2 h-8 w-1/3 -translate-x-1/2 border border-b-0 border-paper/40" />
      <Half side={away} tone="away" />
      <Half side={home} tone="home" flip />
    </div>
  );
}

export function SubsList({ side }: { side: LSide }) {
  const subs = side.substitutes ?? [];
  if (!subs.length) return <p className="text-[11px] text-ink-3">未有後備名單</p>;
  return (
    <ul className="divide-y divide-hairline">
      {subs.map((p) => (
        <li key={p.id} className="grid grid-cols-[1.75rem_1.5rem_minmax(0,1fr)] items-center gap-2 py-1.5 text-[12px]">
          <span className="tabnum text-right font-mono-tx text-ink-3">{p.jersey_number ?? "–"}</span>
          <span className="grid h-5 w-5 place-items-center rounded-[4px] bg-hairline text-[11px] font-bold text-ink-2">{POS_ZH[p.position ?? ""] ?? "?"}</span>
          <span className="truncate text-ink">{p.name}</span>
        </li>
      ))}
    </ul>
  );
}
