import {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {useAuthState} from '@/lib/useAuthState';
import {getCryptoOffer,listMyCryptoPasses,createCryptoCheckout} from '@/lib/crypto-pass.functions';
import {CRYPTO_STATUSES} from '@/lib/crypto-pass';
import {Button} from '@/components/ui/button';
import {Card} from './ui';
const date=(s:string|null)=>s?new Date(s).toLocaleDateString('zh-HK',{timeZone:'Asia/Hong_Kong'}):'—';
export function CryptoPasses({offer=false}:{offer?:boolean}){
 const auth=useAuthState();const list=useServerFn(listMyCryptoPasses);const get=useServerFn(getCryptoOffer);const checkout=useServerFn(createCryptoCheckout);const client=useQueryClient();const [pending,setPending]=useState(false);const [warning,setWarning]=useState('');const [error,setError]=useState('');const [returned,setReturned]=useState(false);const [until,setUntil]=useState(0);
 useEffect(()=>{const success=new URLSearchParams(window.location.search).get('crypto')==='success';setReturned(success);if(success)setUntil(Date.now()+300000);},[]);
 const passes=useQuery({queryKey:['crypto-passes',auth.userId],enabled:auth.signedIn===true,queryFn:()=>list(),refetchInterval:returned && Date.now()<until?10000:false});
 const config=useQuery({queryKey:['crypto-offer',auth.userId],enabled:auth.signedIn===true && offer,queryFn:()=>get()});
 const latest=passes.data?.find(p=>p.status==='finished' || p.status==='manual_granted');
 useEffect(()=>{if(returned && latest){setReturned(false);void client.invalidateQueries({queryKey:['tier']});void client.invalidateQueries({queryKey:['my-membership']});}},[returned,latest,client]);
 const pay=async(confirm=false)=>{setPending(true);setError('');try{const r=await checkout({data:{confirm}});if('url' in r && r.url)window.location.assign(r.url);else if('warning' in r && r.warning)setWarning(r.warning);else if('error' in r)setError(r.error ?? '付款未能開始');}catch{setError('付款未能開始，請稍後重試。');}finally{setPending(false);}};
 if(auth.signedIn!==true)return null;
 const activeOffer=offer && config.data?.crypto_pass_enabled && config.data.gateOpen;
 if(!activeOffer && !passes.data?.length && !passes.isError && !returned)return null;
 return <Card title={activeOffer?'加密貨幣 52 週通行證':'加密貨幣付款紀錄'} en="Crypto pass">
 {activeOffer && config.data?<div className="space-y-3 text-sm text-ink-2"><p className="font-mono-tx text-xl font-bold text-ink">US${config.data.crypto_pass_price_usd}（約 HK${Math.round(config.data.crypto_pass_price_usd*7.8).toLocaleString()}）</p><p>一次付款 {config.data.crypto_pass_weeks} 週，比逐週付款便宜；唔會自動續期，到期前 14 日會提你。</p><p>支援 USDT、USDC、BTC、ETH 等，由 NOWPayments 處理。</p>{warning?<><p className="text-gold">{warning}</p><Button disabled={pending} onClick={()=>void pay(true)}>已明白，繼續付款</Button></>:<Button disabled={pending} onClick={()=>void pay()}>{pending?'正在建立付款連結…':'用加密貨幣付款'}</Button>}</div>:null}
 {returned?<p className="my-3 text-sm text-gold">付款確認中（區塊鏈確認可能需時數分鐘至一小時）。</p>:latest && offer?<p className="my-3 text-sm text-win">Pro 已啟用至 {date(latest.valid_until)}</p>:null}
 {error?<p className="my-3 text-sm text-lose">{error}</p>:null}
 {passes.isError?<Button variant="outline" onClick={()=>void passes.refetch()}>重新讀取付款紀錄</Button>:null}
 <ul className="divide-y divide-hairline">{passes.data?.map(p=><li key={p.id} className="flex min-w-0 flex-wrap justify-between gap-2 py-3 text-xs"><span>{date(p.created_at)} · US${p.price_usd} · {p.weeks} 週{p.environment==='sandbox'?' · 測試':''}</span><span>{CRYPTO_STATUSES[p.status as keyof typeof CRYPTO_STATUSES] ?? '待核對'} · 有效至 {date(p.valid_until)}</span>{p.status==='partially_paid'?<a href="https://t.me/tianxi_racing" className="w-full text-gold">付款不足額，請聯絡我哋處理 →</a>:null}</li>)}</ul>
 </Card>;
}