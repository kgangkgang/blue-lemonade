// Single-pass matching. Replacement text is never searched again or stored as sentinel text.
const wordChar = c => !!c && /[\p{L}\p{N}\p{M}_]/u.test(c);
const pairs = [['으로','로'], ['이랑','랑'], ['은','는'], ['이','가'], ['을','를'], ['과','와'], ['아','야']];
const particles = pairs.flat().sort((a,b)=>b.length-a.length);
export function ending(value) {
    const last = Array.from(String(value).normalize('NFKC').trim()).at(-1) || '';
    const n = last.codePointAt(0) - 0xac00;
    if (n >= 0 && n < 11172) return n % 28;
    if ('178lLrRㄹ'.includes(last) && last) return 8;
    if (/^[036mMnNㄱ-ㅎ]$/.test(last)) return 1;
    return 0;
}
function particleAt(chars, start) {
    for (const p of particles) {
        if (chars.slice(start,start+p.length).join('') !== p) continue;
        const end=start+p.length;
        if (!wordChar(chars[end]) || (chars[end] === '요' && !wordChar(chars[end+1]))) return p;
    }
    return '';
}
export function replaceText(source, rules, options = {}) {
    const fold = c => options.caseSensitive ? c : c.toLowerCase();
    const root = new Map();
    for (const [rank,rule] of rules.entries()) {
        if (!rule || rule.enabled === false) continue;
        for (const spelling of String(rule.from ?? rule.original ?? '').split(/[,，]/).map(s=>s.trim()).filter(Boolean)) {
            let node=root;
            for (const ch of Array.from(spelling)) {
                const key=fold(ch); if(!node.has(key)) node.set(key,new Map()); node=node.get(key);
            }
            if(!node.has(null)) node.set(null,{rank,to:String(rule.to ?? rule.replacement ?? '')});
        }
    }
    let count=0;
    function transform(text) {
        const chars=Array.from(text), out=[];
        for(let i=0;i<chars.length;) {
            let node=root,hit=null;
            for(let j=i;j<chars.length && node.has(fold(chars[j]));j++) {
                node=node.get(fold(chars[j])); const rule=node.get(null); if(!rule)continue;
                const p=options.particles===false?'':particleAt(chars,j+1);
                if(options.wholeWords && (wordChar(chars[i-1]) || (wordChar(chars[j+1])&&!p)))continue;
                if(!hit || rule.rank<hit.rank)hit={...rule,end:j+1,p};
            }
            if(!hit){out.push(chars[i++]);continue;}
            let tail=hit.p;
            if(tail && hit.to) {
                const pair=pairs.find(a=>a.includes(tail)), jong=ending(hit.to);
                tail=pair[jong && !(pair[0]==='으로' && jong===8)?0:1];
            }
            out.push(hit.to,tail);i=hit.end+hit.p.length;count++;
        }
        return out.join('');
    }
    // Keep HTML attributes, fenced code and inline code intact when editing chat markup.
    const parts=String(source??'').split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`|<!--[\s\S]*?-->|<[^>]*>)/g);
    const text=parts.map((part,i)=>i%2?part:transform(part)).join('');
    return {text,count};
}

export function importRuleSets(extensionSettings) {
    const sets=[];
    const normalize = list => Array.isArray(list)?list.filter(r=>r&&typeof r==='object').map(r=>({from:String(r.from??r.original??'').split('||').join(', '),to:String(r.to??r.replacement??''),enabled:r.enabled!==false})).filter(r=>r.from):[];
    const saved=normalize(extensionSettings.word_replace?.rules);
    if(saved.length)sets.push({name:'기존 단어 치환 규칙',rules:saved});
    const legacy=extensionSettings['text-to-image-converter'];
    const plain=normalize(legacy?.replaceRules);if(plain.length)sets.push({name:'기존 발췌 규칙',rules:plain});
    for(const [name,preset] of Object.entries(legacy?.presets||{})) {
        if(!preset || name==='nonePreset')continue;
        const rules=normalize(preset.replaceRules);
        if(!rules.length)for(let n=1;n<=4;n++)if(preset[`originalWord${n}`])rules.push({from:String(preset[`originalWord${n}`]),to:String(preset[`replacementWord${n}`]??''),enabled:true});
        if(rules.length)sets.push({name,rules:normalize(rules)});
    }
    return sets;
}
