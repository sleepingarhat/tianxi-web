import { Link } from "@tanstack/react-router";

/** 訪客隱藏場次：照列賽果，唔計入命中統計（唔當冇中），提示登入查看全日對帳。 */
export function RedactedNote({ races }: { races: { race: number; actual: number[] }[] }) {
  if (!races.length) return null;
  return (
    <div className="mt-2 rounded-[6px] border border-hairline bg-paper px-2 py-2 text-[11px]">
      <ul className="mb-1.5">
        {races.map((r) => (
          <li key={r.race} className="flex flex-wrap gap-1.5 py-0.5 text-ink-2">
            <b className="text-ink">第 {r.race} 場</b>
            <span className="tabnum font-mono-tx text-ink-3">賽果 {r.actual.join("-") || "—"}</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] leading-relaxed text-ink-3">
        以上場次未計入命中統計（唔係冇中）。
        <Link to="/auth" className="ml-1 font-bold text-gold">登入查看全日對帳 →</Link>
      </p>
    </div>
  );
}
