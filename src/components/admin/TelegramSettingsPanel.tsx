import {useServerFn} from '@tanstack/react-start';
import {useQuery} from '@tanstack/react-query';
import {telegramAdmin} from '@/lib/notification-admin.functions';
import {Panel} from './kit';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
export function TelegramSettingsPanel(){const fn=useServerFn(telegramAdmin);const q=useQuery({queryKey:['admin','telegram-bot'],queryFn:()=>fn({data:{setWebhook:false}})});return <Panel title="Telegram Bot" en="Member notifications"><p className="text-xs text-ink-2">{q.data?.configured?`回呼：${q.data.host ?? '未設定'} · 待處理 ${q.data.pending} · Pro 頻道人數 ${q.data.members ?? '—'}`:'會員 @tianxi_racing_bot 尚未設定；與引擎告警 Bot 分開。'}</p>{q.data?.lastError?<p className="mt-2 break-words text-xs text-ink-3">{q.data.lastError}</p>:null}<Button size="sm" className="mt-3" disabled={!q.data?.configured} onClick={async()=>{try{await fn({data:{setWebhook:true}});await q.refetch();toast.success('已設定 Webhook');}catch(e){toast.error(e instanceof Error?e.message:'設定失敗');}}}>設定 Webhook</Button></Panel>;}