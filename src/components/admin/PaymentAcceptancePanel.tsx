import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {listAcceptanceInvoices,createAcceptanceInvoice} from '@/lib/payment-acceptance.functions';
import {CRYPTO_STATUSES} from '@/lib/crypto-pass';
import {Button} from '@/components/ui/button';
import {Panel} from './kit';
export function PaymentAcceptancePanel(){
 const list=useServerFn(listAcceptanceInvoices);const create=useServerFn(createAcceptanceInvoice);
 const q=useQuery({queryKey:['admin','payment-acceptance'],queryFn:()=>list(),refetchInterval:15000});
 const [pending,setPending]=useState(false);const [error,setError]=useState('');
 return <Panel title="正式收款小額驗收" en="Payment acceptance"><div className="space-y-3 text-xs">
 <p className="font-bold text-ink">US$10 · USDT BSC（BEP20）</p>
 <p className="text-ink-2">真實付款，另有錢包網絡費；不授予52週Pro，收費閘保持關閉。</p>
 <Button size="sm" disabled={pending} onClick={async()=>{if(!window.confirm('確認建立10美元真實付款連結？付款不授予Pro，另有網絡費。'))return;setPending(true);setError('');try{await create({data:{confirm:true}});await q.refetch();}catch(e){setError(e instanceof Error?e.message:'未能建立付款');}finally{setPending(false);}}}>{pending?'建立中…':'建立小額驗收付款'}</Button>
 {error?<p className="text-lose">{error}</p>:null}
 {q.isError?<Button size="sm" variant="outline" onClick={()=>void q.refetch()}>重新讀取</Button>:q.isPending?<p>讀取中…</p>:q.data?.length?<ul className="divide-y divide-hairline">{q.data.map(row=><li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span>{CRYPTO_STATUSES[row.status as keyof typeof CRYPTO_STATUSES]} · 已付 {row.actually_paid} USDT</span>{row.invoice_url?<Button size="sm" variant="outline" asChild><a href={row.invoice_url} target="_blank" rel="noreferrer">開啟付款頁 ↗</a></Button>:<span>付款連結待核實</span>}</li>)}</ul>:<p className="text-ink-3">未有驗收付款。</p>}
 </div></Panel>;
}