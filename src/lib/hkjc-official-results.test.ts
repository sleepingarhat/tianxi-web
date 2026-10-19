import { describe, it, expect } from 'vitest';
import { verifyOfficialResultCoverage, type OfficialRunnerResult } from './hkjc-official-results';
const rows: OfficialRunnerResult[] = [1,2,3,4,5].map(n=>({raceNumber:1,horseNumber:n,horseId:`K00${n}`,finishingPosition:n,winOdds:3,runningPosition:null,jockeyId:'PZ',trainerId:'SCS'}));
const card = rows.map(r=>({horseNumber:r.horseNumber,horseId:r.horseId}));
describe('official results do not contaminate training',()=>{
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
});