"""Reviewed parsers for official public price tables. Source text is never executed."""
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse, parse_qs
import json, re

def parse_generic(target, source_dir):
 P=Path(source_dir); DATA={}
 def soup(name):return BeautifulSoup((P/(name+'.raw')).read_text(encoding='utf8'),'html.parser')
 def dollars(s):return [float(x) for x in re.findall(r'\$\s*([\d.]+)',s)]
 def price(s):
  if s.lower() in ['free','free of charge','免费']:return 0
  d=dollars(s);return d[0] if d else None
 def add(provider,model,input,output,cache=None,write=None,**extra):
  if input is None or output is None:return
  rates={'input':round(float(input),9),'output':round(float(output),9)}
  if cache is not None:rates['cacheRead']=round(float(cache),9)
  if write is not None:rates['cacheWrite']=round(float(write),9)
  DATA.setdefault(provider,{})[model]={'rates':rates,**extra}
 def rows(name):
  d=json.loads((P/(name+'-catalog.json')).read_text(encoding='utf8'));return d if isinstance(d,list) else d['data']
 def value(d,k,factor=1):
  v=d.get(k);return float(v)*factor if v is not None else None
 if target == 'openrouter':
  for x in rows('openrouter'):
   p=x.get('pricing',{});mods=x.get('architecture',{}).get('output_modalities',[])
   if mods!=['text'] or not p.get('prompt') or float(p['prompt'])<0 or float(p.get('completion',-1))<0:continue
   add('openrouter',x['id'],value(p,'prompt',1e6),value(p,'completion',1e6),value(p,'input_cache_read',1e6),value(p,'input_cache_write',1e6),minimum=True)
 if target == 'nanogpt':
  for x in rows('nanogpt'):
   p=x.get('pricing',{})
   if p.get('unit')!='per_million_tokens' or p.get('currency')!='USD':continue
   if x.get('architecture',{}).get('output_modalities')!=['text']:continue
   add('nanogpt',x['id'],p.get('prompt'),p.get('completion'),value(p,'cacheReadInputPer1kTokens',1000),value(p,'cacheWriteInputPer1kTokens',1000))
 if target == 'electronhub':
  for x in rows('electronhub'):
   p=x.get('pricing',{})
   if p.get('type')!='per_million_tokens' or '/v1/chat/completions' not in x.get('endpoints',[]):continue
   add('electronhub',x['id'],p.get('input'),p.get('output'),p.get('cache_read'),p.get('cache_write'),**({ 'cacheWrite5m':p['cache_write_5m'],'cacheWrite1h':p.get('cache_write_1h') } if p.get('cache_write_5m') is not None else {}))
 if target == 'chutes':
  for x in rows('chutes'):
   p=x.get('price',{})
   if x.get('output_modalities')!=['text']:continue
   add('chutes',x['id'],p.get('input',{}).get('usd'),p.get('output',{}).get('usd'),p.get('input_cache_read',{}).get('usd'))
 if target == 'pollinations':
  for x in rows('pollinations'):
   p=x.get('pricing',{})
   if x.get('category')!='text' or p.get('currency')!='pollen':continue
   for model in [x['name']]:
    add('pollinations',model,value(p,'promptTextTokens',1e6),value(p,'completionTextTokens',1e6),value(p,'promptCachedTokens',1e6))
  # An alias shared by different model rows is ambiguous: do not silently overwrite it.
  poll_aliases={}
  for x in rows('pollinations'):
   if x.get('category')=='text' and x['name'] in DATA.get('pollinations',{}):
    for alias in x.get('aliases',[]):poll_aliases.setdefault(alias,set()).add(x['name'])
  for alias,ids in poll_aliases.items():
   if len(ids)==1 and alias not in DATA['pollinations']:DATA['pollinations'][alias]=DATA['pollinations'][next(iter(ids))].copy()
 if target == 'mancer':
  for x in rows('mancer'):
   p=x.get('pricing',{});add('mancer',x['id'],value(p,'prompt',1e6),value(p,'completion',1e6))
 if target == 'aimlapi':
  # IDs and prices are both printed in the provider's official HTML table.
  for tr in soup('aimlapi-price').select('tr[data-id][data-c="l"]'):
   c=[td.get_text(' ',strip=True) for td in tr.find_all('td')]
   if len(c)<7:continue
   inp=dollars(c[5]);out=dollars(c[6]);
   if not inp or not out:continue
   add('aimlapi',tr['data-id'],inp[0],out[0],inp[1] if len(inp)>1 else None)
 if target == 'workers':
  # Cloudflare publishes token-equivalent prices, separately from the daily free allocation.
  for tr in soup('workers').find_all('tr'):
   c=[td.get_text(' ',strip=True) for td in tr.find_all('td')]
   if not c or not c[0].startswith('@') or len(c)<2:continue
   fields={k:re.search(r'\$([\d.]+) per M '+v+' tokens',c[1]) for k,v in [('input','input'),('output','output'),('cache','cached input')]}
   if fields['input'] and fields['output']:add('workers',c[0],fields['input'][1],fields['output'][1],fields['cache'][1] if fields['cache'] else None)
 if target == 'together':
  # Together's API model string is taken from its serverless table, not guessed from marketing names.
  for tr in soup('together-models').find_all('table')[0].find_all('tr')[1:]:
   c=[td.get_text(' ',strip=True) for td in tr.find_all('td')]
   if len(c)<7:continue
   add('together',c[2],price(c[4]),price(c[6]),price(c[5]))
  for m in ['moonshotai/Kimi-K3','Qwen/Qwen3.7-Max','Qwen/Qwen3.8-2.4T-A95B','together/Tev1-4B-experimental']:
   if m in DATA['together']:DATA['together'][m]['note']='공식 가격 페이지와 모델 문서의 일부 단가가 달라 모델 문서 기준을 표시해요. 청구 단가는 제공처 확인이 필요해요.';DATA['together'][m]['uncertain']=True
 if target == 'fireworks':
  # Fireworks table contains service tiers and links to the exact deployment model.
  for tr in soup('fireworks-doc').find('table').find_all('tr')[1:]:
   c=[td.get_text(' ',strip=True) for td in tr.find_all('td')];a=tr.find('a')
   if len(c)<3 or not a:continue
   model='accounts/fireworks/models/'+a['href'].split('/')[-1]
   vals=dollars(c[1]);prio=dollars(c[2])
   if len(vals)!=3:continue
   if '(US)' in c[0] or ' Fast' in c[0]:continue
   add('fireworks',model,vals[0],vals[2],vals[1],tiers={'priority':{'input':prio[0],'cacheRead':prio[1],'output':prio[2]}} if len(prio)==3 else {})
 if target == 'xai':
  for line in (P/'xai-list.raw').read_text(encoding='utf8').splitlines():
   if not line.startswith('| grok-') or '(< 200k' not in line:continue
   c=[v.strip() for v in line.split('|')[1:-1]];v=[price(x) for x in c[2:]]
   add('xai',c[0].split(' ')[0],v[0],v[2],v[1],longAbove=199999,longRates=_xai_long(P, c[0].split(' ')[0]),priorityFactor=2)
 if target in ['minimax','minimax_cn']:
  for provider,name in [('minimax','minimax-pay'),('minimax_cn','minimax-cn')]:
   raw=(P/(name+'.raw')).read_text(encoding='utf8').split('## Audio')[0].split('## 语音')[0]
   for line in raw.splitlines():
    if '| **MiniMax-M2' not in line:continue
    c=[v.strip() for v in line.split('|')[1:-1]];model=c[0].strip('*')
    v=[float(re.findall(r'[\d.]+',x)[0]) for x in c[1:]];add(provider,model,v[0],v[1],v[2],v[3])
   # Parse both context lengths and priority rows; never hard-code an advertised price.
   raw=(P/(name+'.raw')).read_text(encoding='utf8')
   m3=[]
   for line in raw.splitlines():
    if '| **MiniMax-M3**' not in line:continue
    c=[v.strip() for v in line.split('|')[1:-1]]
    v=[float(re.findall(r'(?<![\w-])\d+(?:\.\d+)?',x)[-1]) for x in c[1:]]
    if len(v)==3:m3.append({'input':v[0],'output':v[1],'cacheRead':v[2]})
   if len(m3)!=4:raise ValueError('MiniMax context/priority table changed')
   DATA.setdefault(provider,{})['MiniMax-M3']={'rates':m3[0],'longAbove':512000,'longRates':m3[1],'tiers':{'priority':m3[2]},'longTiers':{'priority':m3[3]}}
 if target in ['moonshot','moonshot_cn']:
  for provider,name in [('moonshot','moonshot'),('moonshot_cn','moonshot-cn')]:
   raw=(P/(name+'.raw')).read_text(encoding='utf8')
   for line in raw.splitlines():
    m=re.match(r'\["(kimi-[^"]+)"',line)
    if not m:continue
    vals=[float(x) for x in re.findall(r'\}(\d+\.\d+)</>',line)]
    if not vals:vals=[float(x) for x in re.findall(r'[¥￥](\d+(?:\.\d+)?)',line)]
    if len(vals)==5:add(provider,m[1],vals[3],vals[4],vals[2],cacheWrite5m=vals[0],cacheWrite1h=vals[1])
    elif len(vals)==3:add(provider,m[1],vals[1],vals[2],vals[0])
 if target == 'zai':
  for line in (P/'zai.raw').read_text(encoding='utf8').splitlines():
   line=line.strip()
   if not re.match(r'\| GLM-',line):continue
   c=[v.strip() for v in line.split('|')[1:-1]]
   if len(c)!=5:continue
   add('zai',c[0].lower(),price(c[1]),price(c[4]),price(c[2]))
 if target == 'gemini':
  # Gemini text model tables. Output includes reasoning; audio and media-only SKUs are not text rates.
  gs=soup('gemini')
  for h in gs.find_all('h2'):
   title=h.get_text(' ',strip=True)
   if any(x in title.lower() for x in ['image','tts','live','transcri','omni','embedding','lyria','veo','imagen']):continue
   code=h.parent.find('code')
   if not code:continue
   model=code.get_text(strip=True)
   if not model.startswith('gemini-'):continue
   for table in gs.find_all('table'):
    if table.find_previous('h2') is not h:continue
    head=table.find_previous('h3');tier=head.get_text(' ',strip=True).lower() if head else 'standard'
    if tier not in ['standard','priority','flex','batch']:continue
    fields={}
    for tr in table.find_all('tr'):
     c=[td.get_text(' ',strip=True) for td in tr.find_all('td')]
     if len(c)==3:fields[c[0]]=c[2]
    ik=next((x for x in fields if x.startswith('Input price')),None);ok=next((x for x in fields if x.startswith('Output price')),None)
    if not ik or not ok:continue
    ins=dollars(fields[ik]);outs=dollars(fields[ok]);cached=dollars(fields.get('Context caching price',''))
    if not ins or not outs:continue
    rates={'input':ins[0],'output':outs[0]}
    if cached:rates['cacheRead']=cached[0]
    DATA.setdefault('gemini',{}).setdefault(model,{'rates':{}})
    row=DATA['gemini'][model]
    if tier=='standard':row['rates']=rates
    else:row.setdefault('tiers',{})[tier]=rates
    if '> 200k' in fields[ik] or '>200k' in fields[ik]:
     row['longAbove']=200000;long={'input':ins[1],'output':outs[1],'cacheRead':cached[1]}
     if tier=='standard':row['longRates']=long
     else:row.setdefault('longTiers',{})[tier]=long
    if 'January 1, 2027' in fields[ik]:row['expires']='2026-12-31T23:59:59Z';row['note']='2026-12-31까지의 할인 단가예요. 이후에는 공식 요금표 갱신이 필요해요.'
 if target == 'siliconflow_cn':
  # SiliconFlow CN: rendered prices, including visible context tiers (the page's old metadata differs).
  for a in soup('siliconflow-cn').select('a[href*="models?target="]'):
   model=parse_qs(urlparse(a['href']).query).get('target',[''])[0];div=a.parent.parent
   cells=div.find_all('div',recursive=False)
   if len(cells)<4:continue
   items=[x.get_text(' ',strip=True) for x in cells[1:]]
   if any('时段' in x for x in items):continue
   vals=[]
   for x in items:
    m=re.search(r'¥\s*([\d.]+)',x);vals.append(float(m[1]) if m else 0 if '免费' in x else None)
   if len(vals) not in [3,6]:continue
   add('siliconflow_cn',model,*vals[:2],vals[2])
   if len(vals)==6 and model in DATA.get('siliconflow_cn',{}):
    threshold=re.search(r'\[0, (\d+)k\)',items[0])
    if threshold:DATA['siliconflow_cn'][model].update(longAbove=int(threshold[1])*1000-1,longRates={'input':vals[3],'output':vals[4],**({'cacheRead':vals[5]} if vals[5] is not None else {})})
 if target == 'groq':
  # One factual row per line keeps reviews and future price updates readable.
  for tr in soup('groq').find_all('tr'):
   c=[td.get_text(' ',strip=True) for td in tr.find_all('td')]
   if len(c)<3 or 'input' not in c[2] or 'output' not in c[2]:continue
   code=tr.find('code');model=code.get_text(strip=True) if code else c[0].split()[-1]
   nums=dollars(c[2])
   if len(nums)==2:add('groq',model,*nums)
 if target == 'mistral':
  for tr in soup('mistral').find_all('tr'):
   c=[td.get_text(' ',strip=True) for td in tr.find_all('td')];a=tr.find('a')
   if len(c)!=4 or not a or any(x in c[0] for x in ['OCR','Voxtral','Embed','Moderation']):continue
   slug=a['href'].split('/')[-1];detail=soup('mistral-model-'+slug);text=detail.get_text(' ',strip=True)
   match=re.search(r'([a-z][a-z0-9.-]+) \+\d+ Speed Performance',text)
   if not match:continue
   model=match[1];nums=[dollars(x)[-1] if dollars(x) else None for x in c[1:]]
   aliases=list(dict.fromkeys(re.findall(re.escape(model.split('-')[0])+r'-[a-z0-9.-]*-latest',(P/('mistral-model-'+slug+'.raw')).read_text(encoding='utf8'))))
   # Navigation may contain other models; retain only matching family.
   aliases=[x for x in aliases if x.rsplit('-latest',1)[0]==re.sub(r'-(?:\d{4}|\d-\d)$','',model)]
   add('mistral',model,nums[0],nums[2],nums[1],aliases=aliases)
 if target == 'siliconflow':
  for f in P.glob('silicon-model-*.raw'):
   s=BeautifulSoup(f.read_text(encoding='utf8'),'html.parser');txt=s.get_text(' ',strip=True)
   inp=re.search(r'Input Price \$\s*([\d.]+) / M Tokens',txt);out=re.search(r'Output Price \$\s*([\d.]+) / M Tokens',txt);cache=re.search(r'Cache Read \$\s*([\d.]+) / M Tokens',txt)
   if not inp or not out:continue
   ids=[]
   for a in s.select('a[href*="huggingface.co/"]'):
    model=urlparse(a['href']).path.strip('/')
    if model.count('/')==1 and model not in ids:ids.append(model)
   if len(ids)!=1:continue
   add('siliconflow',ids[0],inp[1],out[1],cache[1] if cache else None)
 if target == 'perplexity':
  for tr in soup('perplexity-models').find_all('tr'):
   c=[td.get_text(' ',strip=True) for td in tr.find_all('td')]
   if len(c)!=6 or '/' not in c[0]:continue
   ins=re.findall(r'\d+(?:\.\d+)?',c[1]);outs=re.findall(r'\d+(?:\.\d+)?',c[2]);reads=re.findall(r'\d+(?:\.\d+)?',c[3]);
   if not ins or not outs:continue
   cached=float(ins[0])*(1-float(reads[0])/100) if '% off input' in c[3] else float(reads[0]) if reads else None
   add('perplexity',c[0],ins[0],outs[0],cached)
   if 'k)' in c[1]:DATA['perplexity'][c[0]]['note']='짧은 문맥 기본 단가예요. 긴 문맥·도구 비용은 응답 총액을 확인하세요.'
 if target == 'cometapi':
  # React server component data is public source data, never executed as JavaScript.
  def rsc(name):
   chunks=[]
   for script in soup(name).find_all('script'):
    m=re.fullmatch(r'self\.__next_f\.push\((\[.*\])\)',script.text.strip(),re.S)
    if m:
     a=json.loads(m[1])
     if len(a)>1 and isinstance(a[1],str):chunks.append(a[1])
   d={}
   for line in ''.join(chunks).splitlines():
    m=re.match(r'^([0-9a-f]+):([\[{].*)$',line)
    if m:
     try:d[m[1]]=json.loads(m[2])
     except ValueError:pass
   return d
  def descend(x):
   if isinstance(x,dict):
    if x.get('model_type'):yield x
    for v in x.values():yield from descend(v)
   elif isinstance(x,list):
    for v in x:yield from descend(v)
  def comet_rates(expr,ratio):
   terms=expr.split(' + ');rates={}
   keys={'p':'input','c':'output','cr':'cacheRead','cc':'cacheWrite','cc1h':'cacheWrite1h'}
   for term in terms:
    m=re.fullmatch(r'(p|c|cr|cc|cc1h) \* ([\d.]+)',term)
    if not m:return None
    rates[keys[m[1]]]=float(m[2])*ratio
   if 'cacheWrite1h' in rates:rates['cacheWrite5m']=rates.pop('cacheWrite',None)
   return rates if 'input' in rates and 'output' in rates else None
  for source in ['cometapi','comet-models']:
   d=rsc(source)
   for x in descend(d):
    if x.get('model_type')!='text' or x.get('upcoming') or x.get('is_router'):continue
    p=x.get('pricing',{});p=d.get(p[1:],{}) if isinstance(p,str) and p.startswith('$') else p
    if not isinstance(p,dict) or p.get('currency')!='USD / M Tokens':continue
    model=x['id'];ratio=p.get('ratio',1)
    if not isinstance(ratio,(int,float)) or not 0<=ratio<=10:continue
    if p.get('input') is not None and p.get('output') is not None:
     add('cometapi',model,p['input']*ratio,p['output']*ratio,p['cached_input']*ratio if p.get('cached_input') is not None else None,p['cache_write']*ratio if p.get('cache_write') is not None else None)
    elif p.get('billing_mode')=='tiered_expr':
     m=re.fullmatch(r'len <= (\d+) \? tier\("short_context", (.*?)\) : tier\("long_context", (.*?)\)',p.get('billing_expr',''))
     if m:
      short=comet_rates(m[2],ratio);long=comet_rates(m[3],ratio)
      if short and long:DATA.setdefault('cometapi',{})[model]={'rates':short,'longAbove':int(m[1]),'longRates':long}

 return DATA.get(target, {})

def _xai_long(p, model):
 for line in (p/'xai-list.raw').read_text(encoding='utf8').splitlines():
  if line.startswith('| '+model+' (') and '(< 200k' not in line:
   c=[v.strip() for v in line.split('|')[1:-1]]
   v=[float(re.findall(r'\$([\d.]+)',x)[0]) for x in c[2:]]
   return {'input':v[0],'cacheRead':v[1],'output':v[2]}
 raise ValueError('Missing long context rate')
