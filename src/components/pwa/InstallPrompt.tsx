import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {useAuthState} from '@/lib/useAuthState';
type InstallEvent=Event & {prompt:()=>Promise<void>};
export function InstallPrompt(){const auth=useAuthState();const [event,setEvent]=useState<InstallEvent|null>(null);const [ios,setIos]=useState(false);const [hidden,setHidden]=useState(true);
useEffect(()=>{setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches);try{setHidden(Date.now()-Number(localStorage.getItem('tx-install-dismissed') ?? 0)<14*86400000);}catch{setHidden(false);}const listener=(e:Event)=>{e.preventDefault();setEvent(e as InstallEvent);};window.addEventListener('beforeinstallprompt',listener);return()=>window.removeEventListener('beforeinstallprompt',listener);},[]);
if(auth.signedIn!==true || hidden || (!ios && !event))return null;
return <section className="mx-4 my-4 border-y border-hairline py-3 text-xs text-ink-2"><p>{ios?'iPhone／iPad：撳「分享」→「加至主畫面」，之後由主畫面開啟先可以收推送（需 iOS 16.4 或以上）。':'將天喜賽馬加至主畫面，收愛駒同收賽日提示更方便'}</p><div className="mt-2 flex gap-2">{event?<Button size="sm" onClick={()=>void event.prompt()}>安裝</Button>:null}<Button size="sm" variant="ghost" onClick={()=>{setHidden(true);try{localStorage.setItem('tx-install-dismissed',String(Date.now()));}catch{}}}>暫時不要</Button></div></section>;}