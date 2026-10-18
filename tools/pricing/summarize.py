"""Turn a collect report into the step summary, annotations and the workflow verdict.

A run fails only when a human must look: a provider that newly needs attention, or one that has
stayed unverified for longer than STALE_DAYS. Prices that were kept at their last verified value
(held models, providers still under a known review) are reported as warnings instead, so a problem
is announced once and then stays visible in every summary without turning each daily run red.
"""
from pathlib import Path
from datetime import datetime, timezone
import argparse, json, os, sys

STALE_DAYS = 14
MAX_LISTED = 40

def parse(stamp):
    return datetime.fromisoformat(stamp.replace('Z','+00:00'))

def assess(report, previous, feed, now):
    """Return (rows, errors, warnings, notes) without side effects."""
    rows=[];errors=[];warnings=[];notes=[]
    before={k:v.get('status','ok') for k,v in previous.get('providers',{}).items()}
    for provider,item in report.items():
        status=item.get('status');entry=feed.get('providers',{}).get(provider,{})
        checked=entry.get('checkedAt');stale=(now-parse(checked)).days if checked else None
        if status=='ok':
            detail=[]
            if item.get('added'):detail.append(f"{len(item['added'])} added")
            if item.get('removed'):detail.append(f"{len(item['removed'])} removed")
            if item.get('held'):detail.append(f"{len(item['held'])} held")
            if not detail:detail.append('prices changed' if item.get('changed') else 'unchanged')
            rows.append((provider,'ok',item.get('models'),', '.join(detail),0))
            if item.get('held'):warnings.append((provider,f"{len(item['held'])} model(s) kept at the last verified price after an out-of-band change; review and record them under contracts.json reviewed.rates to accept"))
            if item.get('removed'):notes.append((provider,f"{len(item['removed'])} model(s) left the official catalog and were dropped: "+', '.join(item['removed'][:MAX_LISTED])))
            continue
        reason=item.get('reason','needs attention')
        rows.append((provider,status,entry.get('models') and len(entry['models']),reason,stale))
        if before.get(provider,'ok')=='ok':errors.append((provider,f"newly needs attention: {reason}"))
        elif stale is None or stale>STALE_DAYS:errors.append((provider,f"unverified for {stale} days, still {status}: {reason}"))
        else:warnings.append((provider,f"still {status} ({stale} days since the last verified prices): {reason}"))
    return rows,errors,warnings,notes

def markdown(rows, errors, warnings, notes, report):
    lines=['## Official model prices','','| Provider | Result | Models | Detail | Days since verified |','|---|---|---|---|---|']
    for provider,status,models,detail,stale in rows:
        lines.append(f"| {provider} | {'✅' if status=='ok' else '❌' if status=='error' else '⚠️'} {status} | {models if models is not None else ''} | {detail} | {stale if stale else ''} |")
    if errors:lines+=['','### Needs a human now']+[f"- **{p}**: {m}" for p,m in errors]
    if warnings:lines+=['','### Kept last verified prices']+[f"- **{p}**: {m}" for p,m in warnings]
    held={p:v['held'] for p,v in report.items() if v.get('held')}
    if held:
        lines+=['','### Held models (last verified → seen on the official source)']
        for provider,models in held.items():
            lines.append(f"- **{provider}**")
            for model,change in list(models.items())[:MAX_LISTED]:
                kept=change['kept'].get('rates',change['kept']) if isinstance(change['kept'],dict) else change['kept']
                seen=change['seen'].get('rates',change['seen']) if isinstance(change['seen'],dict) else change['seen']
                lines.append(f"  - `{model}`: `{json.dumps(kept,sort_keys=True)}` → `{json.dumps(seen,sort_keys=True)}`")
            if len(models)>MAX_LISTED:lines.append(f"  - … {len(models)-MAX_LISTED} more in report.json")
    if notes:lines+=['','### Catalog changes']+[f"- **{p}**: {m}" for p,m in notes]
    return '\n'.join(lines)+'\n'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--report',required=True);parser.add_argument('--previous',required=True);parser.add_argument('--feed',required=True)
    parser.add_argument('--summary',default=os.environ.get('GITHUB_STEP_SUMMARY'))
    args=parser.parse_args()
    report=json.loads(Path(args.report).read_text(encoding='utf8'))
    previous=json.loads(Path(args.previous).read_text(encoding='utf8'))
    feed=json.loads(Path(args.feed).read_text(encoding='utf8'))
    rows,errors,warnings,notes=assess(report,previous,feed,parse(feed['generatedAt']))
    text=markdown(rows,errors,warnings,notes,report)
    if args.summary:
        with open(args.summary,'a',encoding='utf8') as f:f.write(text)
    else:print(text)
    for provider,message in notes:print(f'::notice::{provider}: {message}')
    for provider,message in warnings:print(f'::warning::{provider}: {message}')
    for provider,message in errors:print(f'::error::{provider}: {message}')
    return 1 if errors else 0

if __name__=='__main__':raise SystemExit(main())
