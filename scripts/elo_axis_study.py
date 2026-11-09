import csv,glob,math,re,random,collections,json
rows=[]
for f in sorted(glob.glob('/tmp/tr/data/*/results_*.csv')):
    with open(f,encoding='utf-8-sig') as fh:
        for r in csv.DictReader(fh): rows.append(r)
races=collections.OrderedDict()
for r in rows:
    m=re.search(r'\(([A-Z]\d{3})\)',r['horse_name'] or '')
    if not m: continue
    races.setdefault((r['date'],r['venue'],r['race_no']),[]).append((m.group(1),r))
def axis(r):
    s='awt' if '全天候' in (r['course'] or '') else 'turf'
    try:d=int(r['distance_m'])
    except: d=0
    b='sprint' if d<=1400 else 'mile' if d<=1800 else 'middle' if d<=2000 else 'stay'
    return s+'_'+b
from datetime import date
D=lambda s:date.fromisoformat(s)
R=collections.defaultdict(lambda:1500.0); A=collections.defaultdict(lambda:None)
N=collections.Counter(); NA=collections.Counter(); last={}
res={'overall':[],'axis':[],'layoff':[]}; meta=[]; trace=collections.defaultdict(list)
WATCH={'L122','J133','K488'}
for (dt,ven,rn),ent in sorted(races.items(),key=lambda x:(x[0][0],x[0][1],int(x[0][2]) if x[0][2].isdigit() else 0)):
    ax=axis(ent[0][1]); today=D(dt)
    fin=[];
    for h,r in ent:
        p=r['place'].strip()
        fin.append((h,int(p) if p.isdigit() and int(p)<99 else None))
    valid=[(h,p) for h,p in fin if p is not None]
    if len(valid)>=5 and dt>='2019-09-01':
        top4={h for h,p in valid if p<=4}
        def pick(score): return sorted([h for h,_ in valid],key=score,reverse=True)[:4]
        def ax_score(h):
            a=A[(h,ax)]; n=NA[(h,ax)]
            if a is None: return R[h]
            w=min(n,6)/6*0.5
            return (1-w)*R[h]+w*a
        def lay_score(h):
            if h not in last: return R[h]
            gap=(today-last[h]).days
            shr=min(max(gap-120,0)/365,1)*0.5
            return R[h]-(R[h]-1500)*shr
        for k,fn in (('overall',lambda h:R[h]),('axis',ax_score),('layoff',lay_score)):
            res[k].append(len(set(pick(fn))&top4))
        meta.append((dt,ven,ax))
    # update
    n=len(valid)
    if n>=2:
        deltas={};dax={}
        for h,p in valid:
            gap=(today-last[h]).days if h in last else 0
            k=28*math.exp(-gap/548)*(1.5 if N[h]<6 else 1)
            s=0;sa=0
            ra=A[(h,ax)] if A[(h,ax)] is not None else R[h]
            for j,q in valid:
                if j==h: continue
                S=1 if p<q else 0 if p>q else .5
                s+=S-1/(1+10**((R[j]-R[h])/400))
                rja=A[(j,ax)] if A[(j,ax)] is not None else R[j]
                sa+=S-1/(1+10**((rja-ra)/400))
            deltas[h]=k*s/(n-1); dax[h]=ra+k*sa/(n-1)
        for h,_ in valid:
            if h in WATCH and dt>='2026-10-01': trace[h].append((dt,ven,rn,dict(fin)[h],round(R[h],1),round(deltas[h],2)))
            R[h]+=deltas[h]; A[(h,ax)]=dax[h]; N[h]+=1; NA[(h,ax)]+=1; last[h]=today
def ci(a,b):
    d=[x-y for x,y in zip(a,b)]; m=sum(d)/len(d)
    random.seed(1); bs=sorted(sum(random.choice(d) for _ in d)/len(d) for _ in range(1000))
    return round(m,4),round(bs[25],4),round(bs[975],4)
out={'races':len(meta)}
for k in res: out[k]=round(sum(res[k])/len(res[k]),4)
out['axis_vs_overall']=ci(res['axis'],res['overall']); out['layoff_vs_overall']=ci(res['layoff'],res['overall'])
grp=collections.defaultdict(list)
for i,(dt,ven,ax) in enumerate(meta): grp[ven+'/'+ax].append(i)
out['groups']={g:(len(ix),round(sum(res['overall'][i] for i in ix)/len(ix),3),round(sum(res['axis'][i]-res['overall'][i] for i in ix)/len(ix),3)) for g,ix in sorted(grp.items()) if len(ix)>=100}
out['watch']=trace
print(json.dumps(out,ensure_ascii=False,indent=1))
