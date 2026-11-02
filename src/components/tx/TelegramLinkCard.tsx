import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createTelegramLinkToken, getTelegramLink, requestProChannelInvite, unlinkTelegram } from '@/lib/telegram.functions';
import { useTier } from '@/lib/useTier';
import { toast } from 'sonner';

export function TelegramLinkCard() {
  const tier = useTier();
  const q = useQuery({ queryKey: ['telegram-link'], queryFn: () => getTelegramLink(), refetchInterval: 30_000 });
  const [busy, setBusy] = useState(false);
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : '操作未能完成'); }
    finally { setBusy(false); }
  }
  if (q.isPending) return <Card><CardHeader><CardTitle className="text-base">Telegram 通知</CardTitle></CardHeader><CardContent>載入中……</CardContent></Card>;
  if (!q.data?.configured) return <Card><CardHeader><CardTitle className="text-base">Telegram 通知</CardTitle></CardHeader><CardContent>會員 Telegram Bot 尚未設定，暫時未能連結。</CardContent></Card>;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Telegram 通知</CardTitle></CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-ink-2">
            {q.data.linked ? `已連結 Telegram 帳戶 @${q.data.username ?? ''}${q.data.dmBlocked ? ' · 你已封鎖 Bot，通知不會送達' : ''}` : '未連結 Telegram 帳戶'}
          </span>
          <div className="flex flex-wrap gap-2">
            {q.data.linked
              ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void act(async () => { await unlinkTelegram(); await q.refetch(); })}>解除連結</Button>
              : <Button size="sm" disabled={busy} onClick={() => void act(async () => {
                  const { url } = await createTelegramLinkToken();
                  window.open(url, '_blank', 'noopener');
                  toast('請喺新開嘅 Telegram 視窗按「開始」，連結完成後呢度會自動更新');
                  for (let i = 0; i < 20; i++) {
                    await new Promise(r => setTimeout(r, 3000));
                    const next = await q.refetch();
                    if (next.data?.linked) return;
                  }
                })}>連結 Telegram</Button>}
          </div>
        </div>
        {!q.data.proConfigured
          ? <p className="mt-2 text-xs text-ink-3">Pro 頻道尚未接駁，接好之後會喺呢度提示你。</p>
          : tier.has('pro')
            ? <>
                <Button variant="outline" size="sm" className="mt-3" disabled={busy || !q.data.linked} onClick={() => void act(async () => {
                  const { url } = await requestProChannelInvite();
                  window.open(url, '_blank', 'noopener');
                  toast('已為你開通 Pro 頻道加入連結');
                })}>加入 Pro 頻道</Button>
                <p className="mt-2 text-xs text-ink-3">連結 1 小時內有效，只限你已連結嘅 Telegram 帳戶。</p>
              </>
            : <p className="mt-2 text-xs">Pro 頻道只限 Pro 會員 · <Link to="/membership" className="text-gold">查看會籍</Link></p>}
      </CardContent>
    </Card>
  );
}
