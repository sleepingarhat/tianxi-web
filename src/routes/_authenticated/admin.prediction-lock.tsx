import { createFileRoute } from "@tanstack/react-router";

import { AdminHead, Kpi, NoteBox } from "@/components/admin/kit";
import { useLockState } from "@/components/admin/data";
import { hkDateTime } from "@/lib/hkTime";

export const Route = createFileRoute("/_authenticated/admin/prediction-lock")({
  head: () => ({ meta: [{ title: "預測鎖定 · 天喜監控端" }, { name: "description", content: "預測鎖定 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:title", content: "預測鎖定 · 天喜監控端" }, { property: "og:description", content: "預測鎖定 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: LockPage,
});

function LockPage() {
  const lock = useLockState();

  return (
    <>
      <AdminHead title="預測鎖定" en="Prediction lock" desc="賽馬首場前 90 分鐘鎖全日。鎖定紀錄只增不改，呢度只讀。" onRefresh={() => { lock.refetch(); }} refreshing={lock.isFetching} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="賽馬今日" value={lock.data?.locked ? "已鎖" : lock.data ? "未鎖" : "—"} tone={lock.data?.locked ? "win" : "gold"} sub={lock.data ? `${lock.data.date} · ${lock.data.frozenRows ?? 0} 行` : ""} />
      </div>
      <div className="mt-3">
        <NoteBox>
          賽馬鎖定：{lock.data ? `${lock.data.venue ?? ""} 首場 ${hkDateTime(lock.data.firstPostAt)}，鎖定 ${hkDateTime(lock.data.lockAt)}（提前 ${lock.data.lockLeadMinutes} 分鐘，來源 ${lock.data.source}，版本 ${lock.data.edition === "final" ? "定稿" : "初版"}）` : "今日無賽事"}
        </NoteBox>
      </div>

    </>
  );
}
