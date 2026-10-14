"""Reproduce the shipped vendor bytes from the pinned official dist (Python 3).
python rebuild.py --upstream /path/to/Extension-Mermaid --output ../vendor
Without --upstream, fetch only fixed-commit public GitHub files. No npm/user data.
For an editable-source webpack build instead: npm ci; npm run build (see README).
"""
import argparse, hashlib, json, urllib.request
from pathlib import Path
COMMIT='62265d550ca3dc46737c09bddf0bf328fd1f3469'
ROOT=Path(__file__).resolve().parent
NAMESPACE=('webpackChunkextension_mermaid','webpackChunkblue_lemonade_mermaid')
BASE=('n.p="/scripts/extensions/third-party/Extension-Mermaid/dist/"','n.p=(globalThis.__blMermaidBase||"/scripts/extensions/third-party/Extension-Mermaid/dist/")')
START='const{eventSource:sr,event_types:lr}=SillyTavern.getContext(),cr='
END='jQuery(()=>{Ue.initialize({theme:"dark",startOnLoad:!1,securityLevel:"loose"})})'
BRIDGE='Ue.startOnLoad=!1;globalThis.__blMermaidEngine=Ue;/* Blue Lemonade 2026-10-14: isolated engine bridge; source/README.md */'
def transform(name, data):
    s=data.decode('utf8')
    assert NAMESPACE[0] in s, (name,'namespace absent')
    s=s.replace(*NAMESPACE).replace('extension-mermaid:', 'blue_lemonade_mermaid:')
    if name=='index.js':
        assert s.count(BASE[0])==1
        s=s.replace(*BASE)
        assert s.count(START)==s.count(END)==1
        begin=s.index(START);end=s.index(END,begin)+len(END)
        s=s[:begin]+BRIDGE+s[end:]
    return s.encode('utf8')
def main():
    p=argparse.ArgumentParser();p.add_argument('--upstream',type=Path);p.add_argument('--output',type=Path,default=ROOT.parent/'vendor');a=p.parse_args()
    hashes=json.loads((ROOT/'upstream-sha256.json').read_text(encoding='utf8'));out=a.output.resolve();out.mkdir(parents=True,exist_ok=True)
    result={}
    for name,expected in hashes.items():
        if a.upstream: data=(a.upstream/'dist'/name).read_bytes()
        else:
            with urllib.request.urlopen(f'https://raw.githubusercontent.com/SillyTavern/Extension-Mermaid/{COMMIT}/dist/{name}',timeout=30) as r:data=r.read()
        assert hashlib.sha256(data).hexdigest()==expected, (name,'pinned upstream hash mismatch')
        data=transform(name,data);(out/name).write_bytes(data);result[name]=hashlib.sha256(data).hexdigest()
    print(json.dumps({'files':len(result),'bytes':sum((out/n).stat().st_size for n in result)},sort_keys=True))
if __name__=='__main__':main()
