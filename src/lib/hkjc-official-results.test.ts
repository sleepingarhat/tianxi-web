import { describe, it, expect } from 'vitest';
import { parseOfficialResults, verifyOfficialResultCoverage, type OfficialRunnerResult } from './hkjc-official-results';
const rows: OfficialRunnerResult[] = [1,2,3,4,5].map(n=>({raceNumber:1,horseNumber:n,horseId:`K00${n}`,finishingPosition:n,winOdds:3,runningPosition:null,jockeyId:'PZ',trainerId:'SCS'}));
const card = rows.map(r=>({horseNumber:r.horseNumber,horseId:r.horseId}));
describe('official results do not contaminate training',()=>{
  const fixture = (extra: string) => `<select><option selected>19/10/2026</option></select><div class="race_tab">RACE 11 (101)</div><div class="performance"><table class="draggable"><thead><tr><th>Win Odds</th></tr></thead><tbody>${[1,2,3,4].map(n=>`<tr><td>${n}</td><td>${n}</td><td><a href="/horse?horseid=HK_2024_K00${n}">馬</a></td>${'<td>1</td>'.repeat(9)}</tr>`).join('')}${extra}</tbody></table></div>`;
  it('19 October WV-A keeps the numbered withdrawn runner unplaced',()=>{
    const html = fixture(`<tr><td>WV-A</td><td>5</td><td><a href="/horse?horseid=HK_2024_K585">SALON S</a></td>${'<td>---</td>'.repeat(9)}</tr>`);
    expect(parseOfficialResults(html,'2026-10-19',11).at(-1)).toMatchObject({horseNumber:5,horseId:'K585',finishingPosition:null,winOdds:null});
  });
  it('unnumbered WV preserves raw evidence without inventing a runner number',()=>{
    const html = fixture(`<tr><td>WV</td><td></td><td><a href="/horse?horseid=HK_2024_K554">AMAZING PARTNERS</a></td>${'<td>---</td>'.repeat(9)}</tr>`);
    expect(parseOfficialResults(html,'2026-10-19',11).map(r=>r.horseId)).toEqual(['K001','K002','K003','K004']);
  });
  it('unnumbered WX (stewards withdrawal) is skipped like WV, not a parse failure',()=>{
    const html = fixture(`<tr><td>WX</td><td></td><td><a href="/horse?horseid=HK_2024_L184">SYNTHETIC</a></td>${'<td>---</td>'.repeat(9)}</tr>`);
    expect(parseOfficialResults(html,'2026-10-19',11).map(r=>r.horseId)).toEqual(['K001','K002','K003','K004']);
  });
  it('unnumbered WX-A is skipped too',()=>{
    const html = fixture(`<tr><td>WX-A</td><td></td><td><a href="/horse?horseid=HK_2024_L184">SYNTHETIC</a></td>${'<td>---</td>'.repeat(9)}</tr>`);
    expect(parseOfficialResults(html,'2026-10-19',11)).toHaveLength(4);
  });
  it('numbered WX-A keeps the runner unplaced',()=>{
    const html = fixture(`<tr><td>WX-A</td><td>5</td><td><a href="/horse?horseid=HK_2024_L184">SYNTHETIC</a></td>${'<td>---</td>'.repeat(9)}</tr>`);
    expect(parseOfficialResults(html,'2026-10-19',11).at(-1)).toMatchObject({horseNumber:5,horseId:'L184',finishingPosition:null});
  });
  it('unnumbered rows with any other code still fail closed',()=>{
    for (const code of ['DNF','PU','','1','WXNR','XWX']) {
      const html = fixture(`<tr><td>${code}</td><td></td><td><a href="/horse?horseid=HK_2024_L184">SYNTHETIC</a></td>${'<td>---</td>'.repeat(9)}</tr>`);
      expect(()=>parseOfficialResults(html,'2026-10-19',11)).toThrow('official-result-runner-invalid');
    }
  });
  it('unnumbered WX without a horse identity still fails closed',()=>{
    const html = fixture(`<tr><td>WX</td><td></td><td>SYNTHETIC</td>${'<td>---</td>'.repeat(9)}</tr>`);
    expect(()=>parseOfficialResults(html,'2026-10-19',11)).toThrow('official-result-runner-invalid');
  });
  it('documented D1 prefix preserves exact identity, not fuzzy replacement',()=>{
    expect(()=>verifyOfficialResultCoverage(rows,card.map(r=>({...r,horseId:`horse_${r.horseId}`})),new Set())).not.toThrow();
    expect(()=>verifyOfficialResultCoverage(rows,card.map(r=>({...r,horseId:r.horseNumber===4?'horse_L999':`horse_${r.horseId}`})),new Set())).toThrow('official-result-identity-mismatch');
  });
  it('withdrawal is not a losing training sample',()=>{
    const results=rows.map(r=>r.horseNumber===4?{...r,finishingPosition:null}:r);
    expect(()=>verifyOfficialResultCoverage(results,card,new Set([4]))).not.toThrow();
    expect(()=>verifyOfficialResultCoverage(rows,card,new Set([4]))).toThrow('withdrawn-runner-has-placing');
  });
  it('unknown null placing needs evidence, not a guessed withdrawal',()=>{
    expect(()=>verifyOfficialResultCoverage(rows.map(r=>r.horseNumber===4?{...r,finishingPosition:null}:r),card,new Set())).toThrow('nonfinisher-needs-separate-evidence');
  });
  it('missing starters block publishing',()=>{
    expect(()=>verifyOfficialResultCoverage(rows.slice(0,4),card,new Set())).toThrow('official-result-starter-missing');
  });
  it('changed horse identities block publishing',()=>{
    expect(()=>verifyOfficialResultCoverage(rows.map(r=>r.horseNumber===4?{...r,horseId:'L999'}:r),card,new Set())).toThrow('official-result-identity-mismatch');
  });
  it('actual jockey is mandatory for completed runners',()=>{
    expect(()=>verifyOfficialResultCoverage(rows.map(r=>({...r,jockeyId:''})),card,new Set())).toThrow('actual-rider-missing');
  });
  it('pre-lock withdrawn runner listed on the page but off the card passes with an official notice',()=>{
    const offCard = {raceNumber:1,horseNumber:5,horseId:'K585',finishingPosition:null,winOdds:null,runningPosition:null,jockeyId:'',trainerId:''};
    expect(()=>verifyOfficialResultCoverage([...rows.slice(0,4),offCard],card.slice(0,4),new Set(),new Set(['5:K585']))).not.toThrow();
  });
  it('off-card unplaced runner without an official notice still blocks publishing',()=>{
    const offCard = {raceNumber:1,horseNumber:5,horseId:'K585',finishingPosition:null,winOdds:null,runningPosition:null,jockeyId:'',trainerId:''};
    expect(()=>verifyOfficialResultCoverage([...rows.slice(0,4),offCard],card.slice(0,4),new Set())).toThrow('official-result-identity-mismatch');
  });
  it('off-card notice with a different horse identity still blocks publishing',()=>{
    const offCard = {raceNumber:1,horseNumber:5,horseId:'K585',finishingPosition:null,winOdds:null,runningPosition:null,jockeyId:'',trainerId:''};
    expect(()=>verifyOfficialResultCoverage([...rows.slice(0,4),offCard],card.slice(0,4),new Set(),new Set(['5:L999']))).toThrow('official-result-identity-mismatch');
  });
  it('off-card runner with a placing is never excused as withdrawn',()=>{
    const offCard = {raceNumber:1,horseNumber:5,horseId:'K585',finishingPosition:2,winOdds:3,runningPosition:null,jockeyId:'PZ',trainerId:'SCS'};
    expect(()=>verifyOfficialResultCoverage([...rows.slice(0,4),offCard],card.slice(0,4),new Set(),new Set(['5:K585']))).toThrow('official-result-identity-mismatch');
  });
});