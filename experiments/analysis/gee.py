import sys, json, math, random
sys.path.insert(0, sys.argv[2])
import numpy as np, pandas as pd, statsmodels.api as sm, statsmodels.formula.api as smf
R=[json.loads(l) for l in open(sys.argv[1],encoding='utf-8')]
A=pd.DataFrame([r for r in R if r['kind']=='attack'])
A['adaptive']=(A['cls']=='adaptive').astype(int)
A['cluster']=np.where(A['adaptive']==1, A['id']+'|'+A['model']+'|'+A['lang']+'|'+A['defense']+'|'+A['rep'].astype(str), A['id'])
A['y']=A['leaked'].astype(int)
sub=A[A.defense.isin(['D0','D1','D2','D3'])].copy()
sub['model']=pd.Categorical(sub.model,['qwen2.5-7b','bggpt-7b']); sub['lang']=pd.Categorical(sub.lang,['bg','en'])
f='y ~ C(defense, Treatment("D0")) + model + lang + adaptive'
naive=smf.glm(f,sub,family=sm.families.Binomial()).fit()
gee=smf.gee(f,'cluster',sub,family=sm.families.Binomial(),cov_struct=sm.cov_struct.Exchangeable()).fit()
print('clusters',sub.cluster.nunique(),'n',len(sub))
for name in gee.params.index:
    b,se=gee.params[name],gee.bse[name]; bn,sn=naive.params[name],naive.bse[name]
    print(f"{name:45s} GEE OR={math.exp(b):.2f} [{math.exp(b-1.96*se):.2f}-{math.exp(b+1.96*se):.2f}] p={gee.pvalues[name]:.4f} | naive SE {sn:.3f} vs GEE SE {se:.3f}")
print('working corr', gee.cov_struct.summary())
# cluster bootstrap CI for ASR per model/defense (resample attack ids)
random.seed(7)
for m in ['qwen2.5-7b','bggpt-7b']:
  for d in ['D0','D1','D2','D3','D4','D5','D6']:
    x=A[(A.model==m)&(A.defense==d)]
    g=x.groupby('cluster')['y'].agg(['sum','count']).values
    bs=[]
    for _ in range(2000):
        idx=np.random.randint(0,len(g),len(g)); s=g[idx].sum(0); bs.append(100*s[0]/s[1])
    bs.sort(); print(m,d,f"{100*x.y.mean():.1f} clusterCI [{bs[50]:.1f}-{bs[1949]:.1f}] clusters={len(g)}")
