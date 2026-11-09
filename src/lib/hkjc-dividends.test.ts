import { expect, it } from 'vitest';
import { parseOfficialDividends } from './hkjc-dividends';
import { normalizeOfficialDividend } from './raceDividends';
const html = '<body><select id="selectId"><option selected>21/10/2026</option></select><a href="localresults?Racecourse=HV&racedate=2026/10/21"></a><div class="race_result"><div>第 1 場<table class="dividends"><tbody><tr><td>單T</td><td>2,10,11</td><td>213.00</td></tr><tr><td>三T(安慰獎)</td><td>3,6,10/1,4,9/任何組合</td><td>26,624.00</td></tr></tbody></table></div></div></body>';
it('官方只有安慰獎不造正獎零元，保留單T作逐票核對',()=>{
  const e=parseOfficialDividends(html,'2026-10-21','HV',1);
  expect(e.trios[1]).toBe('2,10,11');
  expect(e.rows).toHaveLength(2);
  expect(e.rows[1]?.dividend).toBe(26624);
});
it('錯日期或未齊全日派彩不能發布存證',()=>{
  expect(()=>parseOfficialDividends(html,'2026-10-19','HV',1)).toThrow('date-mismatch');
  expect(()=>parseOfficialDividends(html,'2026-10-21','HV',2)).toThrow('coverage-incomplete');
});
it('選單有請求日期但實際選定其他日不能當當日證據',()=>{
  expect(()=>parseOfficialDividends(html.replace('selected>21/10/2026','selected>19/10/2026')+'21/10/2026','2026-10-21','HV',1)).toThrow('date-mismatch');
});
it('多個單T勝出組合不能任取最後一行證明三T未中',()=>{
  expect(()=>parseOfficialDividends(html.replace('</tbody>','<tr><td>單T</td><td>2,9,11</td><td>100</td></tr></tbody>'),'2026-10-21','HV',1)).toThrow('multiple-trio-combinations');
});

it('略過海外賽事段落，避免同場號觸發 dividend-race-identity',()=>{
  const overseas = '<body><select id="selectId"><option selected>25/10/2026</option></select><a href="localresults?Racecourse=ST&racedate=2026/10/25"></a><div class="race_result"><div>第 1 場<table class="dividends"><tbody><tr><td>單T</td><td>2,10,11</td><td>213.00</td></tr><tr><td>三T(安慰獎)</td><td>3,6,10/1,4,9/任何組合</td><td>26,624.00</td></tr></tbody></table></div><div>海外賽事(S2 日本) - 第 1 場<table class="dividends"><tbody><tr><td>獨贏</td><td>9</td><td>12.50</td></tr><tr><td>單T</td><td>9,3,7</td><td>99.00</td></tr></tbody></table></div></div></body>';
  // Without the overseas skip, duplicate race 1 would throw dividend-race-identity.
  const e=parseOfficialDividends(overseas,'2026-10-25','ST',1);
  expect(e.trios[1]).toBe('2,10,11');
  expect(e.rows).toHaveLength(2);
  expect(e.rows.every(r=>r.race_no===1)).toBe(true);
});

it('部分單位派彩（2026-11-08 沙田第7場四重彩 235,071.20/$1.0）換算為每$10，並保留官方原值',()=>{
  const partial=html.replace('</tbody>','<tr><td>四重彩</td><td>14,10,9,12</td><td>235,071.20/$1.0</td></tr></tbody>');
  const row=parseOfficialDividends(partial,'2026-10-21','HV',1).rows.find(r=>r.pool==='四重彩');
  expect(row).toMatchObject({dividend:2350712,unit:10,declared_dividend:235071.2,declared_unit:1});
  expect(normalizeOfficialDividend('8,401.00')).toEqual({dividend:8401,declared_dividend:8401,declared_unit:10});
});
it('退款字樣、空白或超出$10的單位仍然拒絕',()=>{
  for (const bad of ['退款','','235,071.20/$0','235,071.20/$20','12.5/每注']) expect(normalizeOfficialDividend(bad)).toBeNull();
  expect(()=>parseOfficialDividends(html.replace('213.00','退款'),'2026-10-21','HV',1)).toThrow('dividend-unverified-amount');
});
it('騎師王／練馬師王詳情行不當派彩，亦不影響正式彩池',()=>{
  const king=html.replace('</tbody>','<tr><td>騎師王 1</td><td>2 [艾兆禮]</td><td>詳情</td></tr></tbody>');
  expect(parseOfficialDividends(king,'2026-10-21','HV',1).rows).toHaveLength(2);
});
