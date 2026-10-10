"""Publish only the isolated pricing-data branch; never edit a release or Pages."""
from pathlib import Path
import argparse, base64, json, os, requests

REPO='kgangkgang/blue-lemonade'
BRANCH='pricing-data'
def api(method,path,**kw):
    with requests.Session() as session:
        session.trust_env=False
        r=session.request(method,'https://api.github.com/repos/'+REPO+path,timeout=30,headers={
            'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},**kw)
        if r.status_code==404:return None
        r.raise_for_status();return r.json()

def main():
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['prepare','publish']);p.add_argument('--directory',required=True);a=p.parse_args()
    if os.environ.get('GITHUB_REPOSITORY')!=REPO:raise ValueError('Unexpected repository')
    d=Path(a.directory);d.mkdir(parents=True,exist_ok=True)
    ref=api('GET','/git/ref/heads/'+BRANCH);head=ref['object']['sha'] if ref else ''
    if a.mode=='prepare':
        (d/'expected-head.txt').write_text(head)
        if head:
            commit=api('GET','/git/commits/'+head)
            tree=api('GET','/git/trees/'+commit['tree']['sha'])
            entry=next((e for e in tree['tree'] if e['path']=='official-prices.json' and e['type']=='blob'),None)
            item=api('GET','/git/blobs/'+entry['sha']) if entry else None
            if not item or item.get('encoding')!='base64':raise ValueError('Existing price feed unavailable; refusing to reset it')
            raw=base64.b64decode(item['content']).decode('utf8');json.loads(raw)
        else:raw=Path(__file__).with_name('seed.json').read_text(encoding='utf8')
        (d/'previous.json').write_text(raw,encoding='utf8');return
    if head!=(d/'expected-head.txt').read_text():raise ValueError('Branch advanced; retry with its latest prices')
    data=(d/'official-prices.json').read_bytes()
    if len(data)>3*1024*1024:raise ValueError('Feed too large')
    blob=api('POST','/git/blobs',json={'content':base64.b64encode(data).decode(),'encoding':'base64'})
    body={'tree':[{'path':'official-prices.json','mode':'100644','type':'blob','sha':blob['sha']}]}
    if head:
        commit=api('GET','/git/commits/'+head);body['base_tree']=commit['tree']['sha']
    tree=api('POST','/git/trees',json=body)
    commit=api('POST','/git/commits',json={'message':'Refresh verified public model prices','tree':tree['sha'],'parents':[head] if head else []})
    if head:api('PATCH','/git/refs/heads/'+BRANCH,json={'sha':commit['sha'],'force':False})
    else:api('POST','/git/refs',json={'ref':'refs/heads/'+BRANCH,'sha':commit['sha']})
    print('Published verified feed to pricing-data: '+commit['sha'])

if __name__=='__main__':main()
