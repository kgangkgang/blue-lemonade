"""Fetch official public sources, quarantine drift, atomically write a last-good feed.

No account credentials are needed. HTML contracts deliberately fail closed when
model names, currencies, units, thresholds or surrounding billing rules change.
"""
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse, urljoin
import argparse, concurrent.futures, copy, hashlib, json, math, os, re, tempfile
import requests
from bs4 import BeautifulSoup
from parsers import parse_generic

ROOT = Path(__file__).resolve().parent
BAD_KEYS = {'__proto__', 'constructor', 'prototype'}
API_PROVIDERS = {'openrouter', 'nanogpt', 'electronhub', 'chutes', 'pollinations', 'mancer'}
REVIEW_PROVIDERS = {'vertex', 'cohere', 'ai21'}

def api_shapes(provider, raw):
    data=json.loads(raw);rows=data if isinstance(data,list) else data['data'];out=set()
    def shape(v):
        if isinstance(v,dict):return {k:shape(x) for k,x in sorted(v.items())}
        if isinstance(v,list):return [shape(x) for x in v]
        if isinstance(v,str):
            try:float(v);return 'NUMBER'
            except ValueError:return v
        return type(v).__name__
    for row in rows:
        value=row.get('price' if provider=='chutes' else 'pricing')
        if value:out.add(digest(shape(value)))
    return sorted(out)

def digest(value):
    if not isinstance(value, str): value=json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'))
    return hashlib.sha256(value.encode('utf8')).hexdigest()

def text_contract(provider, name, raw):
    """Erase only parseable money amounts; keep all non-price billing semantics."""
    if provider == 'openai':
        for tier in ['Standard','Flex','Fast','Ultrafast']:
            pattern=r'(### '+tier+r' pricing data\n.*?)(?=\n### |\n## |\Z)'
            raw=re.sub(pattern, lambda m: re.sub(r'\$[\d,.]+', '$PRICE', m[0]), raw, flags=re.S)
    elif provider == 'anthropic':
        lines=[]
        in_models=False
        for line in raw.splitlines():
            if line.startswith('## '):in_models=line=='## Model pricing'
            if in_models and line.startswith('| Claude ') and 'over 100,000' not in line:
                line=re.sub(r'\$[\d,.]+', '$PRICE', line)
            lines.append(line)
        raw='\n'.join(lines)
    else:
        if '<html' in raw.lower() or '<!doctype' in raw.lower():
            soup=BeautifulSoup(raw,'html.parser')
            if provider=='cometapi':
                for tr in soup.select('tr'):
                    cells=tr.find_all('td')
                    if len(cells)>1 and cells[1].get_text(' ',strip=True) in ['audio','image','video']:tr.decompose()
            for el in soup(['script','style','nav','footer','header','head']):el.decompose()
            raw=(soup.find('main') or soup).get_text(' ',strip=True)
        if provider not in REVIEW_PROVIDERS:
            raw=re.sub(r'[$¥￥]\s*[\d,.]+', '$PRICE', raw)
            # Kimi's MDX currency component leaves numeric values in text nodes.
            if provider.startswith('moonshot'):raw=re.sub(r'}\d+\.\d+</>', '}PRICE</>', raw)
            if provider.startswith('minimax'):
                raw='\n'.join(re.sub(r'(?<=\|)([^|]+)', lambda m: re.sub(r'(?<![\w-])\d+(?:\.\d+)?','PRICE',m[0]) if not 'MiniMax' in m[0] else m[0],line) if '| **MiniMax-M' in line else line for line in raw.splitlines())
    return digest(re.sub(r'\s+',' ',raw).strip())

def read_models(provider, directory, old):
    p=Path(directory)
    if provider in REVIEW_PROVIDERS:return copy.deepcopy(old)
    if provider == 'xai':
        soup=BeautifulSoup((p/'xai-price.raw').read_text(encoding='utf8'),'html.parser');result={}
        for tr in soup.find('table').find_all('tr'):
            c=tr.find_all('td')
            if not c:continue
            if len(c)!=8 or not c[0].find('a'):raise ValueError('xAI table shape changed')
            model=c[0].find('a').get_text(strip=True)
            v=[float(re.search(r'\$([\d.]+)',x.get_text())[1]) for x in c[2:]]
            result[model]={'rates':{'input':v[0],'cacheRead':v[1],'output':v[2]},'longAbove':199999,'longRates':{'input':v[3],'cacheRead':v[4],'output':v[5]},'priorityFactor':2}
        return result
    if provider == 'openai':
        raw=(p/'openai.raw').read_text(encoding='utf8');result={}
        for tier in ['Standard','Flex','Fast','Ultrafast']:
            section=raw.split('### '+tier+' pricing data',1)[1].split('\n\n',2)[1]
            for line in section.splitlines():
                cols=[x.strip() for x in line.split('|')[1:-1]]
                if len(cols)!=9 or not cols[0].startswith(('gpt-','o1','o3','o4')):continue
                result.setdefault(cols[0].split(' (')[0],{})[tier.lower()]=[None if x=='-' else float(x.replace('$','').replace(',','')) for x in cols[1:]]
        for model in ['chat-latest','gpt-5.3-codex','text-embedding-3-small','text-embedding-3-large','text-embedding-ada-002']:
            if model not in result and model in old:result[model]=copy.deepcopy(old[model])
        return result
    if provider == 'anthropic':
        result={}
        raw=(p/'anthropic.raw').read_text(encoding='utf8').split('## Model pricing',1)[1].split('\n## ',1)[0]
        for line in raw.splitlines():
            if not line.startswith('| Claude ') or 'over 100,000' in line:continue
            cols=[x.strip() for x in line.split('|')[1:-1]]
            name=re.match(r'Claude (Fable|Mythos|Opus|Sonnet|Haiku) ([\d.]+)',cols[0])
            if not name or len(cols)!=6:raise ValueError('Claude model table changed')
            family,version=name.groups();model='claude-'+family.lower()+'-'+version.replace('.','-')
            if model=='claude-haiku-3-5':model='claude-3-5-haiku'
            v=[float(re.search(r'\$([\d.]+)',x)[1]) for x in cols[1:]]
            result[model]=[v[0],v[4],v[3],v[1],v[2]]
        return result
    if provider == 'deepseek':
        soup=BeautifulSoup((p/'deepseek.raw').read_text(encoding='utf8'),'html.parser')
        money=[]
        for tr in soup.find('table').find_all('tr'):
            values=re.findall(r'\$([\d.]+)',tr.get_text(' ',strip=True))
            if values:money.append([float(v) for v in values])
        if len(money)!=6 or any(len(v)!=2 for v in money):raise ValueError('DeepSeek peak/offpeak table changed')
        if any(abs(a*2-b)>1e-9 for i in [0,2,4] for a,b in zip(money[i],money[i+1])):raise ValueError('DeepSeek offpeak policy changed')
        result={}
        for model in old:
            col=1 if model=='deepseek-v4-pro' else 0
            result[model]={'rates':{'input':money[3][col],'output':money[5][col],'cacheRead':money[1][col]},'timePricing':'deepseek'}
        return result
    return parse_generic(provider, directory)

def validate_models(new, old, kind, api=False):
    if not isinstance(new,dict) or not new or len(new)>15000:raise ValueError('Empty/oversized model catalog')
    # Missing rows may mean a partial HTML response. Never silently replace an entire catalog.
    missing=set(old)-set(new)
    if missing:raise ValueError(f'{len(missing)} models disappeared; review required')
    def walk(v):
        if isinstance(v,dict):
            for k,x in v.items():
                if not isinstance(k,str) or k in BAD_KEYS or len(k)>250:raise ValueError('Invalid key')
                walk(x)
        elif isinstance(v,list):
            for x in v:walk(x)
        elif isinstance(v,(int,float)) and not isinstance(v,bool):
            if not math.isfinite(v) or v<0 or v>1e9:raise ValueError('Invalid numeric value')
        elif v is not None and not isinstance(v,(str,bool)):raise ValueError('Invalid value')
    walk(new)
    for model,row in new.items():
        if kind=='openai':
            if 'standard' not in row or any(len(v)!=8 or v[0] is None or v[3] is None for v in row.values()):raise ValueError('Invalid OpenAI rates')
        elif kind=='anthropic':
            if len(row)!=5 or any(v is None for v in row):raise ValueError('Invalid Claude rates')
        elif not isinstance(row.get('rates'),dict) or any(row['rates'].get(k) is None for k in ['input','output']):raise ValueError('Missing input/output')
    # Large jumps and free/paid switches need review; smaller verified moves can apply automatically.
    def compare(a,b,path=''):
        if isinstance(a,dict) and isinstance(b,dict):
            for k in a.keys() & b.keys():compare(a[k],b[k],path+'/'+k)
        elif isinstance(a,list) and isinstance(b,list):
            if len(a)!=len(b):raise ValueError('Rate shape changed')
            for x,y in zip(a,b):compare(x,y,path)
        elif isinstance(a,(int,float)) and not isinstance(a,bool) and isinstance(b,(int,float)) and not isinstance(b,bool):
            if (a==0)!=(b==0) or (a and not .5<=b/a<=2):raise ValueError('Unusual rate change '+path)
    compare(old,new)

def fetch_source(item):
    name, spec=item;url=spec['url'];allowed=set(spec['hosts'])
    last=None
    for attempt in range(2):
        try:
            with requests.Session() as session:
                session.trust_env=False
                for _ in range(5):
                    parsed=urlparse(url)
                    if parsed.scheme!='https' or parsed.hostname not in allowed or parsed.username or parsed.port not in [None,443]:raise ValueError('Redirect outside official source')
                    accept='application/json' if name.endswith('-catalog') else 'text/markdown' if urlparse(url).path.endswith('.md') else 'text/html'
                    with session.get(url,timeout=(8,30),stream=True,allow_redirects=False,headers={'User-Agent':'BlueLemonade-Public-Pricing/1.0','Accept':accept}) as r:
                        if r.is_redirect:url=urljoin(url,r.headers['Location']);continue
                        r.raise_for_status();chunks=[];size=0
                        for chunk in r.iter_content(65536):
                            size+=len(chunk)
                            if size>12*1024*1024:raise ValueError('Source too large')
                            chunks.append(chunk)
                        return name,b''.join(chunks).decode('utf8'),None
                raise ValueError('Too many redirects')
        except Exception as e:last=type(e).__name__ # Never log response bodies, cookies or credential-like URLs.
    return name,None,last

def collect(previous, contracts, directory, fetch=True):
    now=datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00','Z')
    output=copy.deepcopy(previous);output['generatedAt']=now;errors={};raws={}
    directory=Path(directory);directory.mkdir(parents=True,exist_ok=True)
    if fetch:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            for name,raw,error in pool.map(fetch_source,contracts['sources'].items()):
                if error:errors[name]=error
                else:
                    raws[name]=raw;(directory/(name+'.raw')).write_text(raw,encoding='utf8')
                    if name.endswith('-catalog'):(directory/(name+'.json')).write_text(raw,encoding='utf8')
    else:
        for name in contracts['sources']:
            try:raws[name]=(directory/(name+'.raw')).read_text(encoding='utf8')
            except OSError:errors[name]='Missing fixture'
    report={}
    for provider,spec in contracts['providers'].items():
        old=previous['providers'][provider];entry=output['providers'][provider];entry['attemptedAt']=now
        try:
            if any(name in errors for name in spec['sources']):raise OSError('Official source unavailable')
            if provider in API_PROVIDERS:
                shapes=api_shapes(provider,raws[spec['sources'][0]])
                if not shapes or not set(shapes)<=set(spec['apiShapes']):raise ValueError('API price unit or fields changed')
            if provider not in API_PROVIDERS:
                if any(text_contract(provider,name,raws[name])!=spec['contracts'][name] for name in spec['sources']):raise ValueError('Billing page changed; parser review required')
            models=read_models(provider,directory,old['models'])
            validate_models(models,old['models'],entry['format'],provider in API_PROVIDERS)
            entry.update(models=models,checkedAt=now,status='ok',revision=digest(models),sourceDigest=digest({n:digest(raws[n]) for n in spec['sources']}))
            report[provider]={'status':'ok','models':len(models),'changed':models!=old['models']}
        except (OSError,requests.RequestException) as e:
            entry['status']='error';report[provider]={'status':'error','reason':str(e)}
        except Exception as e:
            entry['status']='review';report[provider]={'status':'review','reason':str(e)}
    return output,report

def atomic_json(path, value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    text=json.dumps(value,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    if len(text.encode('utf8'))>3*1024*1024:raise ValueError('Feed exceeds client limit')
    with tempfile.NamedTemporaryFile('w',encoding='utf8',dir=path.parent,delete=False) as f:f.write(text);temporary=f.name
    os.replace(temporary,path)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--previous',default=str(ROOT/'seed.json'))
    parser.add_argument('--output',required=True);parser.add_argument('--report',required=True)
    parser.add_argument('--sources',required=True);parser.add_argument('--offline',action='store_true')
    args=parser.parse_args()
    previous=json.loads(Path(args.previous).read_text(encoding='utf8'))
    contracts=json.loads((ROOT/'contracts.json').read_text(encoding='utf8'))
    feed,report=collect(previous,contracts,args.sources,not args.offline)
    atomic_json(args.output,feed);atomic_json(args.report,report)
    print(json.dumps({k:v['status'] for k,v in report.items()}))
    # The workflow publishes last-good partial results before flagging review-required providers.
    return 0

if __name__=='__main__':raise SystemExit(main())
