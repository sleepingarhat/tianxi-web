"""Official reference-data collector only; no authenticated or remote writes."""
import argparse, csv, hashlib, json, re, sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

args = argparse.ArgumentParser()
args.add_argument('--repo-root', default='/tmp/racing-backfill')
args.add_argument('--output', default='/tmp/racing-backfill/verified')
config = args.parse_args()
ROOT = Path(config.repo_root).resolve()
sys.path.insert(0, str(ROOT))
from horse_profile_fields import parse_profile_html, merge_profile_rows, PROFILE_CSV_FIELDS, profile_completeness

def parse_zh_location(raw):
    m=re.fullmatch(r'(沙田|跑馬地)?(草地|全天候跑道|全天候|沙地跑道|沙地|泥地)"?([^"]*)"?',raw.strip())
    return (m.group(1) or '',m.group(2),m.group(3).strip()) if m else (raw,'','')

OUT = Path(config.output).resolve()
MISSING = ['L332','L342','L445','L448','L452','L486','L510','L564','M021']
STALE = ['K402','G312','K028','K216','L045','L005','G095','K431','L048','H419','G292','K265']
JOCKEYS = {'BA':'巴度','BEP':'布浩榮','BHW':'班德禮','CJR':'高力德','HCY':'何澤堯'}
STAMP = datetime.now(timezone.utc).isoformat()
evidence = []

def official(url, identity):
    r = requests.get(url, timeout=35)
    r.raise_for_status()
    soup = BeautifulSoup(r.content, 'html.parser')
    if identity not in soup.get_text(' ',strip=True):
        raise ValueError('Official identity missing: '+identity)
    evidence.append({'url':url,'identity':identity,'sha256':hashlib.sha256(r.content).hexdigest(),'read_at':STAMP})
    raw = OUT / 'audit_reports' / ('repair-'+STAMP.replace(':','-')) / (hashlib.sha256(r.content).hexdigest()+'.html')
    raw.parent.mkdir(parents=True,exist_ok=True)
    raw.write_bytes(r.content)
    return soup, r.text

def stage_csv(path, fields, rows):
    dest = OUT/path
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore',lineterminator='\n')
        w.writeheader();w.writerows(rows)

def collect_horse(code):
    url='https://racing.hkjc.com/racing/information/Chinese/Horse/Horse.aspx?HorseNo='+code
    soup, html = official(url, '('+code+')')
    profile=parse_profile_html(html,code)
    if profile_completeness(profile)<5: raise ValueError('Incomplete profile '+code)
    profile.update(profile_source_url=url,profile_source_kind='HKJC public horse profile',profile_parser_version='hkjc-labels-v2',profile_checked_at=STAMP,profile_last_scraped=STAMP[:10])
    forms=[]
    fields=['horse_no','race_index','place','date','racecourse','track','course','distance_m','going','race_class','draw','rating','trainer','jockey','lbw','win_odds','actual_wt_lbs','running_position','finish_time','declared_wt_lbs','gear']
    for table in soup.find_all('table'):
        for tr in table.find_all('tr'):
            c=[td.get_text(' ',strip=True) for td in tr.find_all('td',recursive=False)]
            if len(c)<18 or not c[0].isdigit() or '/' not in c[2]: continue
            row = dict(zip(['race_index','place','date','racecourse','distance_m','going','race_class','draw','rating','trainer','jockey','lbw','win_odds','actual_wt_lbs','running_position','finish_time','declared_wt_lbs','gear'], c[:18]),horse_no=code)
            row['racecourse'],row['track'],row['course']=parse_zh_location(c[3])
            if not re.fullmatch(r'\d{2}/\d{2}/(?:\d{2}|\d{4})',row['date']) or not row['distance_m'].isdigit() or (code in MISSING and not row['track']):raise ValueError('Invalid official form '+code)
            forms.append(row)
    if forms:profile['last_race_date']=max(datetime.strptime(r['date'],'%d/%m/%y' if len(r['date'])==8 else '%d/%m/%Y') for r in forms).date().isoformat()
    # Missing form files are published only with actual official rows.
    if code in MISSING:
        if not forms: raise ValueError('No official form rows '+code)
        stage_csv('horses/form_records/form_'+code+'.csv',fields,forms)
    print('horse',code,'fields',profile_completeness(profile),'official rows',len(forms))
    return code,profile

def collect_jockey(code,name):
    rows=[]
    fields=['jockey_code','jockey_name','season','race_index','place','total_starters','track','course','distance_m','race_class','going','horse_name','draw','rating','trainer','gear','body_wt_lbs','actual_wt_lbs','date','venue']
    for season in ['Current','Previous']:
        url=f'https://racing.hkjc.com/zh-hk/local/information/jockeypastrec?jockeyid={code}&season={season}'
        seen=set()
        while url:
            if url in seen or len(seen)>30: raise ValueError('Pagination cycle '+code)
            seen.add(url);soup,_=official(url,name)
            date=venue=''
            for table in soup.find_all('table'):
                for tr in table.find_all('tr'):
                    c=[td.get_text(' ',strip=True) for td in tr.find_all('td',recursive=False)]
                    if c and len(c)<=3 and __import__('re').match(r'\d{2}/\d{2}/\d{4}',c[0]):
                        date=c[0][:10];venue=c[0][10:].strip().split(' ')[0]
                    if len(c)!=13 or not c[0].isdigit():continue
                    if not date: raise ValueError('Missing official record date '+code)
                    place,_,total=c[1].partition('/')
                    row=dict(zip(['race_index','track','distance_m','race_class','going','horse_name','draw','rating','trainer','gear','body_wt_lbs','actual_wt_lbs'],[c[0]]+c[2:]),jockey_code=code,jockey_name=name,season=season,place=place,total_starters=total,date=date,venue=venue)
                    _,row['track'],row['course']=parse_zh_location(c[2])
                    if not row['track'] or venue not in ('沙田','跑馬地') or not row['distance_m'].isdigit():raise ValueError('Invalid official jockey row '+code+' '+repr((c,date,venue)))
                    rows.append(row)
            next_link=next((a for a in soup.find_all('a',href=True) if a.get_text(' ',strip=True)=='下一頁'),None)
            url=urljoin(url,next_link['href']) if next_link else None
    if not rows:
        print('jockey',code,'no rows: remains unverified; no placeholder file')
        return
    unique={(r['season'],r['date'],r['race_index']):r for r in rows}
    stage_csv('jockeys/records/jockey_'+code+'.csv',fields,list(unique.values()))
    print('jockey',code,'official rows',len(unique))

def collect():
    OUT.mkdir(parents=True,exist_ok=True)
    profile_path=ROOT/'horses/profiles/horse_profiles.csv'
    if not profile_path.exists():profile_path=ROOT/'horse_profiles.csv'
    profiles=list(csv.DictReader(profile_path.open(encoding='utf-8-sig')))
    old={r['horse_no']:r for r in profiles}
    with ThreadPoolExecutor(max_workers=4) as pool:
        incoming=dict(pool.map(collect_horse,MISSING+STALE))
    for code,p in incoming.items():old[code]=merge_profile_rows(old.get(code),p)
    stage_csv('horses/profiles/horse_profiles.csv',PROFILE_CSV_FIELDS,list(old.values()))
    for code,name in JOCKEYS.items():
        try:
            collect_jockey(code,name)
        except ValueError as exc:
            if str(exc) != 'Official identity missing: '+name: raise
            print('jockey',code,'identity unavailable; remains missing, no placeholder')
            evidence.append({'code':code,'name':name,'status':'official-identity-unavailable','read_at':STAMP})
    url='https://racing.hkjc.com/zh-hk/local/information/trainerprofile?trainerid=CJA'
    official(url,'甘敏斯')
    trainer_path=ROOT/'trainers/trainer_profiles.csv'
    if not trainer_path.exists():trainer_path=ROOT/'trainer_profiles.csv'
    trainers=list(csv.DictReader(trainer_path.open(encoding='utf-8-sig')))
    if not any(r['trainer_code']=='CJA' for r in trainers):trainers.append({'trainer_code':'CJA','trainer_name':'甘敏斯'})
    stage_csv('trainers/trainer_profiles.csv',['trainer_code','trainer_name'],trainers)
    outputs=[{'path':f.relative_to(OUT).as_posix(),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'size':f.stat().st_size} for f in sorted(OUT.rglob('*')) if f.is_file()]
    manifest=OUT/'audit_reports'/('repair-'+STAMP.replace(':','-'))/'manifest.json'
    manifest.write_text(json.dumps({'read_at':STAMP,'sources':evidence,'outputs':outputs,'scope':'Official current reference data only; no frozen predictions or training writes'},ensure_ascii=False,indent=2))

if __name__=='__main__':
    collect()