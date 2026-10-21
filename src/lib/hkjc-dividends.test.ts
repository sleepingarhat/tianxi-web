import { expect, it } from 'vitest';
import { parseOfficialDividends } from './hkjc-dividends';
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