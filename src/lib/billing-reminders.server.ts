import { z } from 'zod';
import { renewalReminder } from './billing-reminders';
export async function checkBillingReminders(test = false) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { sendTelegramAlert } = await import('./telegramAlert.server');
  const sendOnce = async (key: string, text: string) => {
    const saved = await supabaseAdmin.from('telegram_alert_state').select('value').eq('key', key).maybeSingle();
    if (saved.error) throw new Error('付款提醒去重讀取失敗');
    if (saved.data) return 'already-notified';
    const delivery = await sendTelegramAlert(text);
    if (!delivery.sent) throw new Error('付款提醒未送達');
    const write = await supabaseAdmin.from('telegram_alert_state').upsert({ key, value: { sent_at: new Date().toISOString() } });
    if (write.error) throw new Error('付款提醒送達記錄未保存');
    return 'sent';
  };
  if (test) return { ok: true, test: await sendOnce('billing:channel-test:2026-10-19', '天喜付款預警通道測試：Cloudflare續期將於提前7／3／1日提醒；目前只測通知通道，不代表付款已完成。Lovable低餘額提醒仍需在工作區設定。') };
  const apiKey = process.env['LOVABLE_API_KEY'], connection = process.env['CLOUDFLARE_API_KEY'], account = process.env['CLOUDFLARE_ACCOUNT_ID'];
  if (!apiKey || !connection || !account) throw new Error('付款監察授權未設定');
  const base = (process.env['CONNECTOR_GATEWAY_BASE_URL'] ?? 'https://connector-gateway.lovable.dev').replace(/\/$/, '');
  try {
    const response = await fetch(`${base}/cloudflare/client/v4/accounts/${account}/subscriptions?per_page=50`, { headers: { Authorization: `Bearer ${apiKey}`, 'X-Connection-Api-Key': connection }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) {
      const detail = await response.text();
      console.error(`Cloudflare billing read [${response.status}]: ${detail}`);
      throw new Error(`付款狀態讀取失敗 [${response.status}]: ${detail}`);
    }
    const schema = z.object({ success: z.literal(true), result: z.array(z.object({ id: z.string(), current_period_end: z.string(), state: z.string(), cancel_at_period_end: z.boolean(), rate_plan: z.object({ public_name: z.string() }) })), result_info: z.object({ total_pages: z.number().optional(), next_page: z.boolean().optional() }).optional() });
    const payload = schema.parse(await response.json());
    if ((payload.result_info?.total_pages ?? 1) > 1 || payload.result_info?.next_page || !payload.result.length) throw new Error('付款方案清單不完整，未確認全部');
    const notices = payload.result.map(s => renewalReminder(s, Date.now())).filter(n => n !== null);
    const outcomes: string[] = [];
    for (const n of notices) outcomes.push(await sendOnce(n.key, n.text));
    return { ok: true, subscriptionsChecked: payload.result.length, outcomes };
  } catch (error) {
    await sendOnce(`billing:monitor-failed:${new Date().toISOString().slice(0,10)}`, '天喜付款監察失敗：未能完整核實Cloudflare续期或通知，請留意官方付款電郵。').catch(() => null);
    throw error;
  }
}
