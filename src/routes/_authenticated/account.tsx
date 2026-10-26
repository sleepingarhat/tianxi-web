import {createFileRoute,Link} from '@tanstack/react-router';
import {AppShell} from '@/components/tx/AppShell';
import {PageHead} from '@/components/tx/ui';
import {TierBadge} from '@/components/tx/gates/TierBadge';
import {MembershipStatus} from '@/components/tx/MembershipStatus';
import {TelegramLinkCard} from '@/components/tx/TelegramLinkCard';
import {useTier} from '@/lib/useTier';
import {useState,useEffect} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {PushSettingsCard} from '@/components/pwa/PushSettingsCard';
import {InstallPrompt} from '@/components/pwa/InstallPrompt';
import {NotificationPreferences} from '@/components/tx/NotificationPreferences';
import {CryptoPasses} from '@/components/tx/CryptoPasses';
export const Route=createFileRoute('/_authenticated/account')({validateSearch:(s:Record<string,unknown>):{raceday?:string}=>s['raceday']==='1'?{raceday:'1'}:{},head:()=>({meta:[{title:'我的帳戶 · 天喜賽馬'},{name:'description',content:'天喜會籍、Telegram 連結及個人通知設定。'},{property:'og:title',content:'我的帳戶 · 天喜賽馬'},{property:'og:description',content:'管理會籍、個人通知及 Pro 頻道連結。'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex'}]}),component:Account});
function Account(){const tier=useTier();const search=Route.useSearch();const [email,setEmail]=useState('');useEffect(()=>{void supabase.auth.getUser().then(r=>setEmail(r.data.user?.email ?? ''));},[]);return <AppShell page="myhorses"><PageHead en="My account" title="我的帳戶" desc="會籍及個人通知"/><section className="mx-4 my-4 flex min-w-0 flex-wrap items-center gap-3"><span className="break-all text-sm">{email}</span><TierBadge tier={tier.tier}/><Link to="/my-horses" className="text-xs text-gold">我的愛駒 →</Link><Link to="/account/api" className="text-xs text-gold">API 金鑰 →</Link></section><MembershipStatus/><CryptoPasses/><InstallPrompt/><TelegramLinkCard/><PushSettingsCard/><NotificationPreferences openRaceday={search.raceday==='1'}/></AppShell>;}