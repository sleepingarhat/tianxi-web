import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {Link} from '@tanstack/react-router';
import {toast} from 'sonner';
import {useAuthState} from '@/lib/useAuthState';
import {getPrefs,updatePrefs} from '@/lib/watchlist.functions';
import {useTier} from '@/lib/useTier';
import {Card} from './ui';
import {useEffect,useRef,useState} from 'react';

type PrefPatch = {
  telegram_enabled?: boolean;
  push_enabled?: boolean;
  raceday_enabled?: boolean;
  trackwork_mode?: 'all' | 'gallop';
  lock_complete_enabled?: boolean;
  top4_lock_enabled?: boolean;
  daily_pnl_enabled?: boolean;
};

export function NotificationPreferences({openRaceday=false}:{openRaceday?:boolean}){
  const auth=useAuthState();
  const tier=useTier();
  const client=useQueryClient();
  const ref=useRef<HTMLDivElement>(null);
  const [choose,setChoose]=useState(false);
  const get=useServerFn(getPrefs);
  const update=useServerFn(updatePrefs);
  const q=useQuery({queryKey:['notification-prefs',auth.userId],enabled:auth.signedIn===true,queryFn:()=>get()});
  useEffect(()=>{
    if(openRaceday && q.data?.racedayLive){setChoose(true);ref.current?.scrollIntoView({block:'center'});}
    else if(!q.data?.racedayLive)setChoose(false);
  },[openRaceday,q.data?.racedayLive]);

  // 開閘後新事件屬 Pro；free_stage（gate 未開）同 Pro 可開關。註冊會員見到 disabled＋說明。
  const proEventsEnabled = !tier.loading && tier.has('pro');
  const proTip = tier.gateOpen && !tier.has('pro') ? '開閘後屬 Pro 功能' : null;

  const change=async(data: PrefPatch)=>{
    try{
      await update({data});
      if(data.raceday_enabled && !q.data?.telegram_enabled && !q.data?.push_enabled)setChoose(true);
      await client.invalidateQueries({queryKey:['notification-prefs',auth.userId]});
    }catch{toast.error('設定未能儲存');}
  };

  const channelKeys = ['telegram_enabled','push_enabled','raceday_enabled'] as const;
  const channelLabels = ['Telegram','推送通知',q.data?.racedayLive?'收賽日提示':'收賽日提示（即將推出）'];

  const eventKeys = [
    {key:'lock_complete_enabled' as const, label:'鎖定完成（最終版）'},
    {key:'top4_lock_enabled' as const, label:'愛駒入四揀（鎖定後）'},
    {key:'daily_pnl_enabled' as const, label:'官方策略每日盈虧'},
  ];

  return <div ref={ref}><Card title="提示設定" en="Preferences">
    <div className="flex flex-wrap gap-4 text-xs">
      {channelKeys.map((key,i)=>(
        <label key={key} className="flex items-center gap-2">
          <input type="checkbox" disabled={!q.data || (key==='raceday_enabled' && !q.data.racedayLive)} checked={q.data?.[key] ?? false} onChange={e=>void change({[key]:e.target.checked})}/>
          {channelLabels[i]}
        </label>
      ))}
      <label className="flex items-center gap-2">晨操
        <select className="bg-paper text-ink" value={q.data?.trackwork_mode ?? 'gallop'} onChange={e=>void change({trackwork_mode:e.target.value==='all'?'all':'gallop'})}>
          <option value="gallop">快操／試閘／出賽</option>
          <option value="all">全部晨操</option>
        </select>
      </label>
    </div>

    <div className="mt-3 border-t border-hairline pt-3">
      <p className="mb-2 text-xs text-ink-3">新事件類型{proTip?`（${proTip}）`:''}</p>
      <div className="flex flex-wrap gap-4 text-xs">
        {eventKeys.map(({key,label})=>(
          <label key={key} className={`flex items-center gap-2${!proEventsEnabled?' opacity-60':''}`} title={proTip ?? undefined}>
            <input
              type="checkbox"
              disabled={!q.data || !proEventsEnabled}
              checked={q.data?.[key] ?? false}
              onChange={e=>void change({[key]:e.target.checked})}
            />
            {label}
          </label>
        ))}
      </div>
      {proTip ? <p className="mt-2 text-xs text-ink-3">註冊會員可睇到開關；升級 Pro 後先可以開啟。→ <Link to="/membership" className="text-gold">會籍</Link></p> : null}
    </div>

    {choose && q.data?.racedayLive?<div className="mt-3 border-t border-hairline pt-3 text-xs"><p>揀選收賽日提示及通知方式；未確認前唔會自動登記。</p><div className="mt-2 flex flex-wrap gap-4"><Link to="/account" className="text-gold" onClick={()=>document.getElementById('telegram-settings')?.scrollIntoView({block:'center'})}>連結 Telegram →</Link><Link to="/account" className="text-gold" onClick={()=>document.getElementById('push-settings')?.scrollIntoView({block:'center'})}>設定推送通知 →</Link></div></div>:null}
    <p className="mt-3 text-xs text-ink-3">每日批次同步，非即時；<Link to="/account" className="text-gold">連結 Telegram／設定推送</Link>。收賽日提示同鎖定／四揀只通知已核實賽前凍結最終版（draft 永遠唔通知）。每條訊息附「數據模型預測 僅供參考 · 理性投注」。</p>
  </Card></div>;
}
