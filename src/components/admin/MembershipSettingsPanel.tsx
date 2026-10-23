import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Panel } from "./kit";
import { getMembershipSettings, saveMembershipSettings, openMembershipGate } from "@/lib/membership-settings.functions";
import { MEMBERSHIP_SETTING_KEYS, type MembershipSettingKey } from "@/lib/membership-settings";

const labels: Record<MembershipSettingKey, string> = {
  paywall_threshold: "開閘門檻＝創始名額（真實會員人數）",
  watch_limit_free_stage: "閘前愛駒上限",
  watch_limit_registered: "開閘後免費會員愛駒上限",
  watch_limit_pro: "Pro 愛駒上限",
};

export function MembershipSettingsPanel() {
  const read = useServerFn(getMembershipSettings);
  const save = useServerFn(saveMembershipSettings);
  const open = useServerFn(openMembershipGate);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "membership-settings"], queryFn: () => read() });
  const [values, setValues] = useState<(Record<MembershipSettingKey, number> & {raceday_alerts_enabled:boolean}) | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { if (query.data) setValues(query.data.values); }, [query.data]);
  const act = async (opening: boolean) => {
    if (!values || !query.data) return;
    if (opening && !window.confirm(`開閘後不可逆轉，創始名額會鎖定為 ${query.data.values.paywall_threshold}，確定？`)) return;
    setBusy(true); setMessage("");
    try {
      if (opening) await open(); else await save({ data: values });
      await Promise.all([client.invalidateQueries({ queryKey: ["admin", "membership-settings"] }), client.invalidateQueries({ queryKey: ["founding-info"] }), client.invalidateQueries({ queryKey: ["tier"] }), client.invalidateQueries({ queryKey: ["my-membership"] })]);
      setMessage(opening ? "收費閘已開" : "會員設定已儲存");
    } catch (error) { setMessage(error instanceof Error ? error.message : "操作未能完成，請重試"); }
    finally { setBusy(false); }
  };
  return <Panel title="會員分級設定" en="Membership">
    {query.isPending ? <p className="text-sm text-ink-3">讀取中…</p> : query.isError || !query.data || !values ? <p className="text-sm text-loss">暫時未能讀取會員設定</p> : <div className="grid gap-3">
      <dl className="grid gap-2 text-sm text-ink-2">
        <div className="flex justify-between gap-3"><dt>現時真實會員</dt><dd>{query.data.total}</dd></div>
        <div className="flex flex-wrap justify-between gap-3"><dt>開閘時間</dt><dd>{query.data.gateOpenAt ? new Date(query.data.gateOpenAt).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" }) : "未開閘"}</dd></div>
        <div className="flex justify-between gap-3"><dt>創始名額（已鎖定）</dt><dd>{query.data.gateOpenAt ? query.data.foundingSlots : "未鎖定"}</dd></div>
      </dl>
      {MEMBERSHIP_SETTING_KEYS.map(key => <label key={key} className="grid gap-1 text-sm text-ink-2">{labels[key]}<input type="number" min={1} max={100000} step={1} disabled={busy || (key === "paywall_threshold" && !!query.data.gateOpenAt)} value={values[key]} onChange={event => setValues({ ...values, [key]: Number(event.target.value) })} className="w-full rounded-md border border-hairline bg-paper-3 px-3 py-2 text-ink disabled:opacity-60" /></label>)}
      <label className="flex items-center gap-2 text-sm text-ink-2"><input type="checkbox" disabled={busy} checked={values.raceday_alerts_enabled} onChange={event=>setValues({...values,raceday_alerts_enabled:event.target.checked})}/>賽日提示已上線</label>
      <p className="text-xs leading-relaxed text-ink-3">同一個數字決定幾多人開閘，同埋首幾多名有 52 週免費 Pro。開閘之後創始名額會鎖定。</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void act(false)}>儲存會員設定</Button>{!query.data.gateOpenAt && <Button variant="outline" disabled={busy} onClick={() => void act(true)}>立即開閘</Button>}</div>
      {message && <p role="status" className="text-sm text-ink-2">{message}</p>}
    </div>}
  </Panel>;
}