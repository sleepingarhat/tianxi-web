import { FEATURES, type FeatureId } from "@/lib/race-data";
import { stepWeight, WEIGHT_TEMPLATES, type FeatureWeightSpec } from "@/lib/lab-backtest";
import { Button } from "@/components/ui/button";

type Props = {
  selected: FeatureId[];
  weights: FeatureWeightSpec[];
  onChange: (next: FeatureWeightSpec[]) => void;
  locked?: boolean;
};

export function FeatureWeightPanel({ selected, weights, onChange, locked }: Props) {
  const byId = new Map(weights.map((w) => [w.id, w]));

  function setOne(id: FeatureId, patch: Partial<FeatureWeightSpec>) {
    const existing = byId.get(id) ?? { id, weight: 1, invert: false };
    const next = weights.filter((w) => w.id !== id);
    next.push({ ...existing, ...patch, id });
    onChange(next);
  }

  function applyTemplate(key: string) {
    const t = WEIGHT_TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    onChange(t.weights.map((w) => ({ ...w })));
  }

  if (locked) {
    return (
      <div className="rounded-[4px] border border-hairline bg-paper/60 p-3 text-[12px] text-ink-2">
        <p className="font-bold text-ink">權重調校 · Pro</p>
        <p className="mt-1 leading-relaxed">
          登入 Pro 之後可以調 0–3（步進 0.5）、反向開關、套用模板，即場重排綜合分。以下係上一個已完場示範（示意）。
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left font-mono-tx text-[11px]">
            <thead>
              <tr className="text-ink-2">
                <th className="py-1 pr-2">名</th>
                <th className="py-1 pr-2">馬</th>
                <th className="py-1 pr-2">綜合</th>
                <th className="py-1">Δ官方</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>示範甲</td><td>78.5</td><td>—</td></tr>
              <tr><td>2</td><td>示範乙</td><td>71.2</td><td>↑1</td></tr>
              <tr><td>3</td><td>示範丙</td><td>68.0</td><td>↓1</td></tr>
              <tr><td>4</td><td>示範丁</td><td>64.4</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[11px] text-ink-2 self-center mr-1">模板</span>
        {WEIGHT_TEMPLATES.map((t) => (
          <Button key={t.key} type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => applyTemplate(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>
      <ul className="space-y-2">
        {selected.map((id) => {
          const def = FEATURES.find((f) => f.id === id);
          const w = byId.get(id) ?? { id, weight: 1, invert: false };
          return (
            <li key={id} className="flex flex-wrap items-center gap-2 rounded-[4px] border border-hairline bg-paper px-2 py-1.5">
              <span className="min-w-[7rem] text-[12px] font-bold text-ink">{def?.shortLabel ?? id}</span>
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setOne(id, { weight: stepWeight(w.weight, -0.5) })}>−</Button>
                <span className="w-8 text-center font-mono-tx text-[12px] font-bold">{w.weight.toFixed(1)}</span>
                <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setOne(id, { weight: stepWeight(w.weight, 0.5) })}>＋</Button>
              </div>
              <label className="ml-auto flex items-center gap-1 text-[11px] text-ink-2">
                <input
                  type="checkbox"
                  checked={!!w.invert}
                  onChange={(e) => setOne(id, { invert: e.target.checked })}
                />
                反向
              </label>
            </li>
          );
        })}
      </ul>
      {!selected.length ? (
        <p className="text-[11px] text-ink-2">先喺上面揀特徵，再調權重。</p>
      ) : null}
    </div>
  );
}
