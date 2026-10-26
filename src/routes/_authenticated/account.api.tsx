import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
import { Card, Disclaimer, Empty, ErrorNote, Loading, PageHead, Pill } from "@/components/tx/ui";
import { Button } from "@/components/ui/button";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-v1.functions";

export const Route = createFileRoute("/_authenticated/account/api")({
  head: () => ({
    meta: [
      { title: "API 金鑰 · 天喜賽馬" },
      { name: "description", content: "Pro 開發者 API 金鑰：建立、用量、撤銷。" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <FeaturePageGate min="pro" title="API 金鑰">
      <ApiKeysPage />
    </FeaturePageGate>
  ),
});

function ApiKeysPage() {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [once, setOnce] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["api-v1-keys"],
    queryFn: () => listApiKeys(),
    staleTime: 15_000,
    retry: false,
  });

  const createM = useMutation({
    mutationFn: () => createApiKey({ data: { label: label.trim() || undefined } }),
    onSuccess: (r) => {
      setOnce(r.apiKey);
      setLabel("");
      void qc.invalidateQueries({ queryKey: ["api-v1-keys"] });
    },
  });

  const revokeM = useMutation({
    mutationFn: (id: string) => revokeApiKey({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["api-v1-keys"] }),
  });

  return (
    <AppShell page="myhorses" columns={false} ticker="API 金鑰 · 明文只顯示一次">
      <PageHead en="API keys" title="開發者 API 金鑰" desc="Pro · Bearer tx_live_… · 研究／非投注" />
      <p className="mx-4 text-[11px] text-ink-3">
        文件見 <Link to="/developers" className="text-gold">/developers</Link>
        。限額建議 60／分鐘、5000／日。
      </p>

      {once ? (
        <Card title="新金鑰（只此一次）" en="Copy now" action={<Pill tone="lose">唔會再顯示</Pill>}>
          <pre className="overflow-x-auto rounded-md bg-ink px-3 py-2 font-mono-tx text-[11px] text-paper">{once}</pre>
          <Button className="mt-2" variant="outline" size="sm" onClick={() => setOnce(null)}>
            我已保存
          </Button>
        </Card>
      ) : null}

      <Card title="建立金鑰" en="Create">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-[11px] text-ink-3">
            標籤（可選）
            <input
              className="mt-1 block w-48 rounded-md border border-hairline bg-paper-2 px-2 py-1.5 text-sm text-ink"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={64}
              placeholder="例如 laptop"
            />
          </label>
          <Button disabled={createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending ? "建立中…" : "建立"}
          </Button>
        </div>
        {createM.isError ? <div className="mt-2"><ErrorNote error={createM.error} /></div> : null}
      </Card>

      <Card
        title="我嘅金鑰"
        en="Keys"
        action={
          <Pill tone="ink">
            {listQ.data?.limits
              ? `${listQ.data.limits.perMinute}/min · ${listQ.data.limits.perDay}/day`
              : "限額"}
          </Pill>
        }
      >
        {listQ.isPending ? <Loading /> : null}
        {listQ.isError ? <ErrorNote error={listQ.error} /> : null}
        {listQ.data && listQ.data.keys.length === 0 ? <Empty label="未有金鑰" /> : null}
        {listQ.data && listQ.data.keys.length > 0 ? (
          <ul className="space-y-3">
            {listQ.data.keys.map((k) => (
              <li key={k.id} className="rounded-md border border-hairline px-3 py-2 text-[12px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-mono-tx text-[11px] text-ink">{k.keyPrefix}…</p>
                    <p className="text-[10px] text-ink-3">
                      {k.label ? `${k.label} · ` : null}
                      scopes {k.scopes}
                      {k.revokedAt ? " · 已撤銷" : null}
                    </p>
                    <p className="text-[10px] text-ink-3">
                      建立 {k.createdAt}
                      {k.lastUsedAt ? ` · 最後使用 ${k.lastUsedAt}` : " · 未使用"}
                    </p>
                  </div>
                  {!k.revokedAt ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={revokeM.isPending}
                      onClick={() => {
                        if (window.confirm("確定撤銷此金鑰？")) revokeM.mutate(k.id);
                      }}
                    >
                      撤銷
                    </Button>
                  ) : (
                    <Pill tone="lose">已撤銷</Pill>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {listQ.data && listQ.data.usage.length > 0 ? (
        <Card title="近日用量" en="Usage">
          <ul className="max-h-48 space-y-1 overflow-y-auto text-[11px] text-ink-2">
            {listQ.data.usage.slice(0, 30).map((u) => (
              <li key={`${u.keyId}-${u.date}`} className="font-mono-tx">
                {u.date} · {u.count} 次 · key {u.keyId.slice(0, 8)}…
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Disclaimer extra="金鑰明文只喺建立時顯示一次；D1 只存 hash。" />
    </AppShell>
  );
}
