// Pure comparison worker logic. Limits bound output growth as well as retained traces.
export const INPUT_LIMIT = 32000, OUTPUT_LIMIT = 128000, RULE_LIMIT = 200;
export function skipReason(rule, options) {
    if (rule.disabled) return '꺼진 규칙';
    if (!rule.findRegex) return '찾기 식 없음';
    if (!rule.placement?.includes(options.placement)) return '대상 다름';
    const markdown=options.mode==='display', prompt=options.mode==='prompt';
    if (!((rule.markdownOnly&&markdown)||(rule.promptOnly&&prompt)||(!rule.markdownOnly&&!rule.promptOnly&&!markdown&&!prompt))) return '적용 단계 다름';
    if (options.edit && !rule.runOnEdit) return '편집 시 적용 꺼짐';
    if (Number.isFinite(options.depth)) {
        if (rule.minDepth!=null&&!isNaN(rule.minDepth)&&rule.minDepth>=-1&&options.depth<rule.minDepth) return '최소 깊이 밖';
        if (rule.maxDepth!=null&&!isNaN(rule.maxDepth)&&rule.maxDepth>=0&&options.depth>rule.maxDepth) return '최대 깊이 밖';
    }
    return '';
}
export function compareRegex(input, rules) {
    if (input.length>INPUT_LIMIT || rules.length>RULE_LIMIT) throw new Error('비교 범위를 초과했어요. 글은 32,000자, 규칙은 200개까지 비교해요.');
    let output=input, retained=0;
    const traces=[];
    for (const rule of rules) {
        const trace={name:rule.name,status:rule.skip||rule.error||'',changed:false,count:0};
        traces.push(trace);
        if (trace.status) continue;
        const before=output;
        try {
            const regex=new RegExp(rule.source,rule.flags);
            output=output.replace(regex,(...args)=>{
                if (++trace.count>10000) throw new Error('한 규칙의 일치 횟수가 10,000개를 넘었어요.');
                const template=rule.replacement.replace(/{{match}}/gi,'$0');
                const result=template.replaceAll(/\$(\d+)|\$<([^>]+)>/g,(_,num,name)=>{
                    let match=num?args[Number(num)]:args.at(-1)?.[name];
                    if (!match) return '';
                    for (const trim of rule.trims) match=match.replaceAll(trim,'');
                    return match;
                });
                trace.growth=(trace.growth||0)+result.length;
                if(trace.growth>OUTPUT_LIMIT)throw new Error('치환 결과가 너무 커져 비교를 중단했어요.');
                // Only the two read-only name macros are resolved by this diagnostic tool.
                return result.replace(/{{(user|char)}}/gi,(token,key)=>rule.names[key.toLowerCase()]??token);
            });
            if(output.length>OUTPUT_LIMIT)throw new Error('치환 결과가 128,000자를 넘었어요.');
            trace.changed=before!==output;trace.status=trace.changed?'변경됨':trace.count?'일치 · 결과 같음':'일치 없음';
            if(trace.changed&&retained<256000){trace.before=before.slice(0,4000);trace.after=output.slice(0,4000);trace.truncated=before.length>4000||output.length>4000;retained+=trace.before.length+trace.after.length;}
        } catch(error) { output=before;trace.status='오류: '+error.message;trace.error=true;trace.after=undefined; }
        delete trace.growth;
    }
    return {output,traces};
}
