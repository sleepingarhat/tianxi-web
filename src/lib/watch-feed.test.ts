import {describe,it,expect} from 'vitest';
import {projectHorseFeed} from './watch-events';
describe('projectHorseFeed',()=>{
 it('groups by type, newest first, and only for followed horses',()=>{
  const f=projectHorseFeed({events:[
   {horse_id:'horse_J062',type:'trackwork',event_date:'2026-11-01',title:'晨操',detail:{workType:'快操'}},
   {horse_id:'horse_J062',type:'trackwork',event_date:'2026-11-02',title:'晨操',detail:{}},
   {horse_id:'horse_J062',type:'entry',event_date:'2026-11-04',title:'排位',detail:{venue:'HV',raceNumber:3,draw:5}},
   {horse_id:'horse_X999',type:'trial',event_date:'2026-11-02',title:'試閘'},
   {horse_id:'horse_J062',type:'bogus',event_date:'2026-11-02',title:'?'},
  ]},['horse_J062']);
  expect(Object.keys(f)).toEqual(['horse_J062']);
  expect(f['horse_J062']!.trackwork.map(e=>e.date)).toEqual(['2026-11-02','2026-11-01']);
  expect(f['horse_J062']!.entry[0]?.detail).toBe('跑馬地 · 第3場 · 檔5');
  expect(f['horse_J062']!.trial).toEqual([]);
 });
});
