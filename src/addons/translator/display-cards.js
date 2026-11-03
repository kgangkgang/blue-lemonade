// Known prompt-card display values only. Raw markup, keys, code and hidden data stay local.
// No DOM parsing/rendering and no preset contents or renderer code are included.
import { MODULE_CARDS, isModuleCard, MODULE_KEY, moduleKeepsLocal, moduleLocalValue } from './v3-modules.js';
// 8.0.8 데우스 V3 바닥 모듈(<relationships> · <status> · <companions> …)도 카드 — 영어 열쇠 · 줄 · 기호는 두고 값만 보낸다 (v3-modules.js)
const CARD_NAMES = new Set(['status_bar','tracker','novel_header','prologue','meow_fm','profile','branches','ccd','snow','角色状态面板',...MODULE_CARDS]);
// 모듈 칸 앞의 꾸밈(쌍점 · 줄표 · 이모지)은 칸 글자가 아니다 — 여는 따옴표 · 괄호는 값과 함께 보낸다
const MODULE_GLYPHS = /^(?:[\s:：;,.\-–—•·*_~>]|\p{Extended_Pictographic}|️|‍)+/u;
const OPAQUE = new Set(['head','script','style','textarea','pre','code','template','noscript','iframe','svg','math','think','thinking','updatevariable','tableedit','momentum_route']);
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const TAG = /<!--[\s\S]*?-->|<![^>]*>|<\/?[^\s<>/]+(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const KNOWN_KEY = /^(?:日期|时间|天气|地点|位置|题记|之间|serial|time|scene|plot|echo|seeds|Physical|Clothes|Mental|Location|Relationship(?:\s*\([^)]*\))?|Inventory|Inner[- ]state|Motivations?|Main Plot|Subplots|Context|CYOA|OOC|Prose Plan|Response Structure|Story progression)\s*[:：]/i;
const FRAMING = /\[\[__VAR_\d+__\]\]|(?:https?|ftp):\/\/[^\s<>"']+|(?:data|javascript|file|mailto|tel):[^\s<>"']+|`[^`\r\n]*`|&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);|\{\{[\s\S]*?\}\}|\[\/?(?:CHAP|TITLE|CP|LOC|TAGS|PREFACE|Current|Unresolved|Possible|Seed)\]|[\[\]()]|\*\*|__|~~|[|｜]|[→⟶➜➞]|->|[-+]?\d+(?:\.\d+)?\s*(?:[°º][CF]|℃|℉)|;[ \t]*urge[ \t]*:|;[ \t]*(?:helps|fights)\b(?:[ \t]+Want\b)?|\b\d{1,3}[ \t]*\/[ \t]*100\b(?:[ \t]*[-–—](?=[ \t]))?|(?:\*\*|__)?(?:Physical|Clothes|Mental|Location|Relationship(?:\s*\([^)]*\))?|Inventory|Inner[- ]state|Motivations?|Main Plot|Subplots)(?:\*\*|__)?\s*[:：]/gi;
const REPLY_DIVIDER = '\n\n[Translated Text]:\n';
// 카드 정규식이 그리는 한 줄 상태창(<stat>Date=…|Location=…|Track=…</stat> 꼴): 이름을 모르는 태그라도 안이 「열쇠=값」 칸 둘 이상이면 카드로 본다.
//   열쇠 · | · 숫자 값(날짜 · 시각 · 수치)은 이 기기에 두고 글자 값(장소 · 곡명 …)만 보낸다 — 전에는 줄째 보내 모델이 데이터 줄로 보고 원문 그대로 뒀다(번역 점검 「원문 그대로」).
//   1.0.0 칸 둘(<stat>Location=…|Track=…</stat>) · 줄 끝에 남은 | · 여는 태그 뒤 · 닫는 태그 앞 줄바꿈 · 칸마다 한 줄도 (keyedFields) — 빈 줄 · 열쇠 없는 칸이 끼면 카드가 아니다
const KEYED_FIELD = /^\s*\p{L}[\p{L}\p{N}_ .-]{0,31}=/u;
const KEYED_KEY = /^\p{L}[\p{L}\p{N}_ .-]{0,31}?\s*=/u;
const KEYED_BLOCK = /<([A-Za-z][\w-]{0,31})>([^<>`]{1,2000}?)<\/\1\s*>/g;
function keyedFields(inner) {
    const lines = inner.replace(/^[ \t]*\r?\n|\r?\n[ \t]*$/g, '').split(/\r?\n/);
    if (lines.length > 24 || lines.some(line => !line.trim())) return null;
    const fields = lines.flatMap(line => line.replace(/[|｜][ \t]*$/, '').split(/[|｜]/));
    return fields.length >= 2 && fields.every(f => KEYED_FIELD.test(f)) ? fields : null;
}
const HTML_NAMES = new Set(['a','abbr','b','bdi','bdo','big','blockquote','button','caption','center','cite','dd','del','details','dfn','div','dl','dt','em','figcaption','font','h1','h2','h3','h4','h5','h6','i','ins','kbd','label','legend','li','mark','ol','option','p','q','rp','rt','ruby','s','samp','small','span','strike','strong','sub','summary','sup','td','th','time','tt','u','ul','var']);
const fail = () => Object.assign(new Error('상태 카드의 번역 항목이 빠지거나 구조가 달라 원문을 유지했어요. 다시 번역해 주세요.'), { format: true, structuredCard: true });
const hasWords = text => /\p{L}/u.test(text);
const escapeDisplay = (text, context) => {
    // These three known fields are inserted into JavaScript string literals by their renderer.
    // Hex escapes keep quotes, backticks, interpolation and script end-tags inert, while the
    // renderer still shows the actual punctuation. Other markup is never sent to the model.
    if (context === 'script') return text.replace(/[&<>"'`\\$\u2028\u2029]/g, c => '\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
    const re = context === 'attribute' ? /[&<>"'|\[\]\u2028\u2029]/g : /[&<>|\[\]\u2028\u2029]/g;
    return text.replace(re, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&#34;',"'":'&#39;','|':'&#124;','[':'&#91;',']':'&#93;','\u2028':'&#8232;','\u2029':'&#8233;'}[c]));
};
function tagInfo(raw) {
    const m = raw.match(/^<(\/?)([^\s<>/]+)/); if (!m || raw.startsWith('<!--') || raw.startsWith('<!')) return null;
    return { name:m[2].toLowerCase(), close:!!m[1], void:VOID.has(m[2].toLowerCase()) || /\/\s*>$/.test(raw), hidden:/\shidden(?:\s|=|>)/i.test(raw) || /\saria-hidden\s*=\s*["']?true/i.test(raw) || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(raw) };
}
function hiddenSelectors(block) {
    const selectors = [];
    for (const style of block.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
        const css = style[1].replace(/\/\*[\s\S]*?\*\//g,'');
        for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
            if (!/(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(rule[2])) continue;
            for (const selector of rule[1].split(',')) {
                // Deliberately limited to plain selectors. Never execute CSS or render an iframe
                // just to translate it; complex runtime styling belongs to the original renderer.
                const m = selector.trim().match(/^([a-z][\w-]*)?([.#][\w-]+)?$/i);
                if (m && (m[1] || m[2])) selectors.push({tag:m[1]?.toLowerCase(),kind:m[2]?.[0],value:m[2]?.slice(1)});
            }
        }
    }
    return selectors;
}
function hiddenBySelector(raw,info,selectors) {
    const id = raw.match(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const classes = raw.match(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const identifier = id && (id[1]??id[2]??id[3]), names = (classes && (classes[1]??classes[2]??classes[3]) || '').split(/\s+/);
    return selectors.some(s=>(!s.tag || s.tag===info.name) && (!s.kind || (s.kind==='#' ? identifier===s.value : names.includes(s.value))));
}
function fenceRanges(text) {
    const ranges = []; const re = /^( {0,3})(`{3,}|~{3,})([^\r\n]*)\r?\n/gm; let m;
    while ((m = re.exec(text))) {
        const fence = m[2], end = new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}[ \t]*$', 'gm'); end.lastIndex = re.lastIndex;
        const close = end.exec(text); if (!close) { ranges.push({start:m.index,end:text.length,bodyStart:re.lastIndex,bodyEnd:text.length,kind:m[3].trim().toLowerCase()}); break; }
        ranges.push({start:m.index,end:close.index+close[0].length,bodyStart:re.lastIndex,bodyEnd:close.index,kind:m[3].trim().toLowerCase()}); re.lastIndex = close.index+close[0].length;
    }
    return ranges;
}
// 7.2.8 같은 글을 여러 번 훑지 않게 최근 글 몇 개의 결과를 기억한다 (순수 함수 — 글이 같으면 결과가 같다). 채팅을 열 때 저장된 번역문 고치기가
//   메시지마다 같은 원문을 세 번 · 번역문을 두세 번 훑었다. 돌려줄 때는 칸마다 새 객체 (부른 쪽이 고쳐도 기억은 그대로)
const cardMemo = new Map();
function outerCards(text) {
    const hit = cardMemo.get(text);
    if (hit) { cardMemo.delete(text); cardMemo.set(text, hit); return hit.map(card => ({ ...card })); }
    const ranges = scanOuterCards(text);
    if (cardMemo.size >= 16) cardMemo.delete(cardMemo.keys().next().value);
    cardMemo.set(text, ranges.map(card => ({ ...card })));
    return ranges;
}
function scanOuterCards(text) {
    const ranges = [], opaqueRanges = [], fences = fenceRanges(text), tokens = new RegExp(TAG.source,'g'); let m, active = null, depth = 0, opaque = null;
    while ((m = tokens.exec(text))) {
        const fence = fences.find(x => m.index >= x.start && m.index < x.end);
        if (fence && !active) { tokens.lastIndex = fence.end; continue; }
        const info = tagInfo(m[0]); if (!info) { opaqueRanges.push({start:m.index,end:tokens.lastIndex}); continue; }
        if (opaque) { if (info.close && info.name === opaque.name) { opaqueRanges.push({start:opaque.start,end:tokens.lastIndex}); opaque = null; } continue; }
        if (!info.close && OPAQUE.has(info.name) && !info.void) { opaque = {name:info.name,start:m.index}; continue; }
        if (!active) {
            if (!info.close && CARD_NAMES.has(info.name) && !info.void) { active = {name:info.name,start:m.index,innerStart:tokens.lastIndex}; depth = 1; }
        } else if (info.name === active.name) {
            if (!info.close && !info.void) depth++;
            else if (info.close && --depth === 0) { ranges.push({...active,innerEnd:m.index,end:tokens.lastIndex}); active = null; }
        }
    }
    // A partial known card is kept opaque instead of sending its keys/code to the model.
    if (active) ranges.push({...active,innerEnd:text.length,end:text.length,partial:true});
    if (opaque) opaqueRanges.push({start:opaque.start,end:text.length});
    // 8.0.6 데우스 V3 · 레모나 시간 상태창: 모델(특히 Gemini)이 템플릿의 `…` 를 따라 상태창을 코드칸(```)이나 `…` 로 감싸 쓴다.
    //   원작 정규식(Unwrap @Tracker from code backticks)이 화면에서 감싸개를 풀어 상태창으로 그리니, 번역기도 감싸개째 한 카드로 본다 —
    //   전에는 코드칸을 통째로 「코드」로 보내(태그 · 이모지 · °C 까지) 모델이 그대로 두거나, 바꾸면 정규식이 못 알아봐 「Recovered」 카드가 됐다.
    //   감싸개 글자는 카드 원문에 그대로 남고 모델에는 값만 간다. 원작 정규식과 같은 범위: 백틱 1~3개 · 언어 이름 a-z 12자까지 · 상태창 하나만
    for (const f of fences) {
        if (!/^[a-z]{0,12}$/.test(f.kind) || f.end > text.length || [...ranges,...opaqueRanges].some(r => r.start < f.end && r.end > f.start)) continue;
        const body = text.slice(f.bodyStart,f.bodyEnd), m = /^\s*<tracker\b[^>`]{0,200}>[^`]{0,2000}?<\/tracker\s*>\s*$/i.exec(body);
        if (!m || !/^`{3}(?!`)/.test(text.slice(f.start).trimStart()) || (body.match(/\|/g) || []).length < 2) continue;   // 칸(|)이 둘 이상인 상태창 꼴만 — 코드 예시 <tracker>sample</tracker> 은 코드 그대로
        const open = f.bodyStart + body.indexOf('<'), innerStart = text.indexOf('>',open) + 1, innerEnd = f.bodyStart + body.search(/<\/tracker\s*>\s*$/i);
        ranges.push({name:'tracker',start:f.start,end:f.end,innerStart,innerEnd,fenced:true});
    }
    for (const r of ranges) {
        if (r.name !== 'tracker' || r.fenced || r.partial) continue;
        const before = /`{1,2}$/.exec(text.slice(Math.max(0,r.start-2),r.start))?.[0] || '';
        if (before && text.slice(r.end,r.end+before.length) === before && text[r.start-before.length-1] !== '`' && text[r.end+before.length] !== '`') { r.start -= before.length; r.end += before.length; r.fenced = 'inline'; }
    }
    // This older display format uses a mode tag and two separators instead of a wrapper tag.
    const legacy = /◸[^◹\r\n]*?<(?:olden|present|scifi)>[^◹\r\n]*?[｜|][^◹\r\n]*?◹/gi;
    while ((m = legacy.exec(text))) if (![...ranges,...fences,...opaqueRanges].some(r=>m.index<r.end && legacy.lastIndex>r.start)) {
        ranges.push({name:'legacy_top',start:m.index,innerStart:m.index+1,innerEnd:legacy.lastIndex-1,end:legacy.lastIndex});
    }
    // 한 줄 「열쇠=값|열쇠=값|…」 상태창 (KEYED_FIELD 위 설명). 알려진 카드 · 코드 · 다른 카드와 겹치면 건너뛴다
    const keyed = new RegExp(KEYED_BLOCK.source,'g');
    while ((m = keyed.exec(text))) {
        const name = m[1].toLowerCase(), end = keyed.lastIndex;
        if (CARD_NAMES.has(name) || OPAQUE.has(name) || HTML_NAMES.has(name) || VOID.has(name) || !keyedFields(m[2])) continue;
        if ([...ranges,...fences,...opaqueRanges].some(r=>m.index<r.end && end>r.start)) continue;
        const innerStart = m.index + m[1].length + 2;
        ranges.push({name,start:m.index,innerStart,innerEnd:innerStart+m[2].length,end,keyed:true});
    }
    return ranges.sort((a,b)=>a.start-b.start);
}
function visibleSpans(block, card) {
    if (card.partial || block.length > 524288) return [];
    // 8.0.6 감싼 코드칸(card.fenced)은 카드 바깥 껍데기라 안 본다 (안은 상태창 하나)
    const spans = [], fences = card.fenced ? [] : fenceRanges(block), stack = [], selectors = hiddenSelectors(block), tokens = new RegExp(TAG.source,'g'); let cursor = 0, match;
    // A broken sensitive opener is not a text node. Preserve an incomplete card as a whole.
    for (const m of block.matchAll(/<(?:head|script|style|textarea|pre|code|template|noscript|iframe)\b/gi)) {
        const token = new RegExp(TAG.source,'y'); token.lastIndex=m.index;
        if (!token.exec(block)) return [];
    }
    const add = (start,end) => {
        start = Math.max(start,card.innerStart); end = Math.min(end,card.innerEnd);
        if (start >= end || stack.some(x => x.hidden || OPAQUE.has(x.name))) return;
        let offset = start;
        for (const line of block.slice(start,end).split(/(?<=\n)/)) {
            let value = line, at = offset; offset += line.length;
            // The mode and serial are renderer switches/record identifiers, not prose.
            if (/^\s*(?:模式\s*[:：]|serial\s*[:：])/i.test(value)) continue;
            const prefix = value.match(/^\s*(?:(?:[-*•]|\d+[.)]|[A-F][.)]|#{1,6}|>+|\|\|)\s+)?/)[0]; at += prefix.length; value = value.slice(prefix.length);
            if (card.name === 'status_bar') {
                // Unknown fields do not appear in this renderer. Keep them local as data.
                const key = value.match(/^(?:\*\*|[\[【［(（「〔])*\s*(?:日期|时间|天气|地点|位置|题记|之间)\s*[:：|｜]\s*|^(?:\*\*|[\[【［(（「〔])*\s*(?:Info|Quote|Outfit)\s*[|｜]\s*/i);
                if (!key) continue;
                at += key[0].length; value = value.slice(key[0].length);
                value = value.replace(/[\]】］)）」〕\s]+$/,'');
            }
            const key = value.match(KNOWN_KEY); if (key) { at += key[0].length; value = value.slice(key[0].length); }
            // Older status cards use Info/Quote/Outfit as parser keys.
            const old = value.match(/^(?:Info|Quote|Outfit)\s*[|｜]/i); if (card.name === 'status_bar' && old) { at += old[0].length; value = value.slice(old[0].length); }
            if (/^\s*[:|\- ]+\s*$/.test(value)) continue;
            const pieces = new RegExp(FRAMING.source,'gi'); let stop, from = 0;
            const part = (a,b) => {
                const raw = value.slice(a,b), before = raw.match(/^\s*/)[0].length, after = raw.match(/\s*$/)[0].length;
                let text = raw.slice(before,raw.length-after), glyphs = 0; if (!text || !hasWords(text)) return;
                const module = isModuleCard(card.name);
                if (card.name === 'tracker') { glyphs = text.match(/^[^\p{L}\p{N}]+/u)?.[0].length || 0; text = text.slice(glyphs); }
                else if (module) { glyphs = text.match(MODULE_GLYPHS)?.[0].length || 0; text = text.slice(glyphs); }
                // Keep literal parser labels at the start of each pipe-separated field.
                // 8.0.8 V3 모듈은 영어 열쇠면 다 (Closeness: · Stage: · Unspoken: …) — 단 [표지] 바로 뒤 「이름: …」 은 값이에요 (Undercurrents)
                let label = text.match(KNOWN_KEY);
                // 열쇠=값 상태창: 칸 첫머리의 「열쇠=」는 정규식이 읽는 이름이라 그대로 (칸 안 괄호 뒤 글은 값)
                if (!label && card.keyed && /(?:^|[|｜])\s*$/.test(value.slice(0,a))) label = text.match(KEYED_KEY);
                if (!label && module && !/\]\s*$/.test(value.slice(0,a))) label = text.match(MODULE_KEY);
                // 1.0.0 데우스 3 저류(Undercurrents) 길 「[Overt] External: …」 의 External 은 이름이 아니라 정해진 낱말 (인물 이름 「Rex:」 는 예전처럼 값)
                if (!label && card.name === 'undercurrents') label = text.match(/^External[ \t]*[:：]/);
                const skip = label?.[0].length || 0;
                const rest = text.slice(skip), ws = rest.match(/^\s*/)[0].length;
                if (module && moduleKeepsLocal(rest.slice(ws),{before:value.slice(0,a),after:value.slice(b),card:card.name})) return;
                if (rest.slice(ws) && hasWords(rest.slice(ws))) {
                    let context = 'text';
                    if (card.name === '角色状态面板' && stack.some(x=>['搜索历史','语录集','当前播放'].includes(x.name))) context = 'script';
                    if (card.name === 'novel_header') context = 'attribute';
                    const key = label ? label[0].replace(/^[\s*_]+|[\s*_:：]+$/g,'').toLowerCase() : '';   // 8.0.8 칸 열쇠 (관계 단계 사전)
                    spans.push({start:at+a+before+glyphs+skip+ws,end:at+b-after,text:rest.slice(ws),context,...(key ? {key} : {})});
                }
            };
            while ((stop = pieces.exec(value))) { part(from,stop.index); from = pieces.lastIndex; } part(from,value.length);
        }
    };
    while ((match = tokens.exec(block))) {
        const fence = fences.find(x => match.index >= x.start && match.index < x.end && x.kind !== 'html');
        if (fence) { add(cursor,Math.max(cursor,fence.start)); cursor = fence.end; tokens.lastIndex = fence.end; continue; }
        add(cursor,match.index); cursor = tokens.lastIndex;
        const info = tagInfo(match[0]); if (!info) continue;
        if (info.close) { const index = stack.map(x=>x.name).lastIndexOf(info.name); if (index >= 0) stack.splice(index); }
        else if (!info.void) stack.push({...info,hidden:info.hidden || hiddenBySelector(match[0],info,selectors)});
    }
    add(cursor,block.length);
    // Code fences without tags still need to be removed from the eligible text ranges.
    const eligible = spans.filter(x => !fences.some(f => x.start < f.end && x.end > f.start && (f.kind !== 'html' || x.start < f.bodyStart || x.end > f.bodyEnd)));
    // Never silently translate only the first part of an excessive card.
    return eligible.length > 2048 ? [] : eligible;
}
function describe(text) {
    return outerCards(text).map(card => {
        const raw = text.slice(card.start,card.end), local = {...card,innerStart:card.innerStart-card.start,innerEnd:card.innerEnd-card.start};
        return {...card,raw,fields:visibleSpans(raw,local)};
    });
}
function patch(raw,fields,values) {
    let text = raw; for (let i=fields.length-1;i>=0;i--) text = text.slice(0,fields[i].start)+values[i]+text.slice(fields[i].end); return text;
}
const displayLineEndings = value => String(value).replace(/\r\n?/g,'\n');
function readCardValues(card,raw) {
    // The combined display normalizes line endings. Compare that representation only; the
    // original card remains untouched and is the template used for the eventual restore.
    raw=displayLineEndings(raw);
    if (!card.fields.length) return displayLineEndings(card.raw)===raw ? [] : null;
    const first=displayLineEndings(card.raw.slice(0,card.fields[0].start));
    if (!raw.startsWith(first)) return null;
    let cursor=first.length;const values=[];
    for (let i=0;i<card.fields.length;i++) {
        const f=card.fields[i],fixed=displayLineEndings(card.raw.slice(f.end,card.fields[i+1]?.start??card.raw.length));
        if (!fixed) return null;
        const at=i===card.fields.length-1 ? raw.length-fixed.length : raw.indexOf(fixed,cursor);
        if (at<cursor || raw.slice(at,at+fixed.length)!==fixed) return null;
        const value=raw.slice(cursor,at);
        if (!value.trim() || /[\r\n]/.test(value)) return null;
        if (value!==f.text) {
            if (/[<>]/.test(value)) return null;
            if (f.context==='attribute' && /["']/.test(value)) return null;
            if (f.context==='script' && (/[&"'`$]/.test(value) || /\\(?!u[\da-f]{4})/i.test(value))) return null;
        }
        values.push(value);cursor=at+fixed.length;
    }
    return cursor===raw.length ? values : null;
}
function decodeDisplayValue(value,context) {
    if (context==='script') return value.replace(/\\u([\da-f]{4})/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));
    // Decode only entities this adapter writes, once. An intentional literal "&amp;" remains
    // literal after &amp;amp; is decoded once and is escaped once when the result is restored.
    const entities={'&amp;':'&','&lt;':'<','&gt;':'>','&#34;':'"','&#39;':"'",'&#124;':'|','&#91;':'[','&#93;':']','&#8232;':'\u2028','&#8233;':'\u2029'};
    return value.replace(/&(?:amp|lt|gt|#34|#39|#124|#91|#93|#8232|#8233);/g,m=>entities[m]);
}
function correctionMaskNumbers(source,translation,protectionValue) {
    // Explicit protection runs over Original + Translated in one pass, so even identical
    // protected values receive different mask numbers in its two halves. Their values stay
    // local; align only those numbers for this comparison and restore the source-side blocks.
    const pattern=/\[\[__VAR_\d+__\]\]/g,wanted=source.match(pattern)||[],current=translation.match(pattern)||[];
    if (wanted.length!==current.length) throw fail();
    const resolved = (token,seen=new Set()) => {
        if (seen.has(token) || typeof protectionValue!=='function') throw fail();
        const raw=protectionValue(token);if (typeof raw!=='string') throw fail();
        const next=new Set(seen);next.add(token);
        return raw.replace(pattern,nested=>resolved(nested,next));
    };
    for (let i=0;i<wanted.length;i++) {
        if (wanted[i]!==current[i] && resolved(wanted[i])!==resolved(current[i])) throw fail();
    }
    let index=0;return translation.replace(pattern,()=>wanted[index++]);
}
/** reserve(value) must return a unique existing translation mask token. Call after user protection.
 * restore() runs after mask spelling repair and before ordinary unmasking. It rejects missing,
 * duplicated or reordered card fields; the caller keeps the original message on format errors.
 * 6.5.4 localValue(text, cardName) may return a finished translation for a field (fixed dates,
 * times, weather words, values translated before). Such fields are never sent; learn(text, value)
 * hears every field value the model returned.
 */
export function prepareDisplayCards(text,{reserve,isRetranslation=false,protectionValue,localValue,learn}={}) {
    const source = String(text ?? ''), split = isRetranslation && source.startsWith('[Original Text]:\n') ? source.indexOf(REPLY_DIVIDER) : -1;
    const primaryText = split >= 0 ? source.slice(0,split) : source, primary = describe(primaryText);
    if (!primary.length) return {text:source,count:0,compare:value=>value,restore:value=>value,cacheable:()=>true,lost:()=>[],fallbackCount:()=>0};
    if (typeof reserve !== 'function') throw new TypeError('Card masks require a reserve callback');
    const localOf = (field,card) => {
        // 8.0.8 V3 관계 단계(Stage: Strangers)는 정해진 낱말이라 이 기기에서 채운다 (v3-modules.js) — 한국어로 옮길 때만(localValue 가 있을 때)
        const value = typeof localValue === 'function' ? moduleLocalValue(field.text,card.name,field.key) ?? localValue(field.text,card.name) : null;
        return typeof value === 'string' && value.trim() && value.trim() !== field.text && !/[\r\n<>]|\[\[__/.test(value) ? value.trim() : null;
    };
    // Locally known fields get no token: the model sees only the remaining values of the card.
    const records = primary.map(card => {
        const local = card.fields.map(field => localOf(field,card));
        // 8.0.6 값이 모두 이 기기에서 채워지는 카드(날짜 · 시각 · 날씨 · 전에 옮긴 장소뿐인 시간 상태창)는 여닫는 표시 둘도 보내지 않는다 —
        //   채운 카드 전체를 보호 블록 하나로 (모델은 자리표시 하나만 본다)
        if (local.length && !local.some(v => v === null)) {   // 값 칸이 없는 카드는 예전처럼 여닫는 표시 둘 (그 사이에 지어낸 글을 막는다)
            const wholeText = patch(card.raw,card.fields,local.map((v,i)=>escapeDisplay(v,card.fields[i].context)));
            return {...card,local,whole:true,wholeText,tokens:[reserve(wholeText)]};
        }
        // 1.0.0 own = 카드가 앞뒤 빈 줄로 문단 하나를 다 차지한다 (데우스 모듈 · 아드리안 <stat>) — 여닫는 자리표가 빠진 답에서 그 문단 끝까지를 카드 자리로 읽는다 (readOpenCard)
        const own = /(?:^|\n[ \t]*\n)[ \t]*$/.test(primaryText.slice(0,card.start)) && /^[ \t]*(?:\r?\n[ \t]*\r?\n|\s*$)/.test(primaryText.slice(card.end));
        return {...card,local,own,tokens:Array.from({length:local.filter(v => v === null).length+2},()=>reserve(''))};
    });
    const encode = (card,record) => { if (record.whole) return record.tokens[0]; let n = 0; return record.tokens[0]+'\n'+card.fields.flatMap((f,i)=>record.local[i] !== null ? [] : [record.tokens[++n]+f.text]).join('\n')+'\n'+record.tokens.at(-1); };
    const transform = (part,cards=describe(part)) => {
        if (cards.length !== records.length || cards.some((c,i)=>c.name!==records[i].name || c.fields.length!==records[i].fields.length)) throw fail();
        let output = part; for (let i=cards.length-1;i>=0;i--) output = output.slice(0,cards[i].start)+encode(cards[i],records[i])+output.slice(cards[i].end); return output;
    };
    const correction = part => {
        const cards=outerCards(part);
        if (cards.length!==records.length || cards.some((c,i)=>c.name!==records[i].name)) throw fail();
        let output=part;
        for (let i=cards.length-1;i>=0;i--) {
            const card=cards[i],record=records[i],raw=correctionMaskNumbers(record.raw,part.slice(card.start,card.end),protectionValue),values=readCardValues(record,raw);
            if (!values) throw fail();
            const fields=record.fields.map((f,n)=>({...f,text:decodeDisplayValue(values[n],f.context)}));
            output=output.slice(0,card.start)+encode({fields},record)+output.slice(card.end);
        }
        return output;
    };
    const prepared = transform(primaryText,primary)+(split >= 0 ? REPLY_DIVIDER+correction(source.slice(split+REPLY_DIVIDER.length)) : '');
    let lastFallback = 0;
    return {
        text:prepared,count:records.length,
        wholeBlocks:new Set(records.filter(r=>r.whole).map(r=>r.wholeText)),   // 8.0.6 모델이 빠뜨려도 제자리에 되돌릴 카드
        compare(value) { return transform(String(value ?? '')); },
        cacheable(body,answer) {
            // Paragraph caching happens before the complete message is restored. Reject bad
            // card responses here too, otherwise a retry would keep loading the same bad row.
            const input=String(body??''), output=String(answer??''), open=records.filter(r=>!r.whole), relevant=open.filter(r=>r.tokens.some(t=>input.includes(t)));
            const expected=relevant.flatMap(r=>r.tokens);
            if (relevant.some(r=>r.tokens.some(t=>!input.includes(t)))) return false;
            if (open.some(r=>!relevant.includes(r) && r.tokens.some(t=>output.includes(t)))) return false;
            let end=-1;
            for (const token of expected) {
                const at=output.indexOf(token);
                if (at<=end || output.indexOf(token,at+token.length)>=0) return false;
                end=at;
            }
            for (const r of relevant) {
                const at=r.tokens.map(t=>output.indexOf(t));
                if (output.slice(at[0]+r.tokens[0].length,at[1]).trim()) return false;
                for (let i=0;i<r.tokens.length-2;i++) {
                    const value=output.slice(at[i+1]+r.tokens[i+1].length,at[i+2]).trim();
                    if (!value || /\[\[__VAR_\d+__\]\]/.test(value)) return false;
                }
            }
            return true;
        },
        // 1.0.0 값이 하나도 오지 않은 카드(자리표가 답에 하나도 없음)의 여는 자리표 — 번역기가 빠진 보호 블록처럼 원문 문단 자리에 되돌린 뒤 restore 가 원문 카드로 채운다
        lost(value) { const output = String(value ?? ''); return records.filter(r => !r.whole && !r.tokens.some(t => output.includes(t))).map(r => r.tokens[0]); },
        /** 보낸 글(layout)에서 openers 카드를 여는 자리표 하나로 줄인 글 — 빠진 카드를 원문 문단 자리에 되돌릴 때 견줄 원문 */
        lostLayout(layout,openers) {
            let out = String(layout ?? '');
            for (const r of records) if (!r.whole && openers.includes(r.tokens[0])) {
                const a = out.indexOf(r.tokens[0]), b = out.indexOf(r.tokens.at(-1));
                if (a >= 0 && b > a) out = out.slice(0,a+r.tokens[0].length)+out.slice(b+r.tokens.at(-1).length);
            }
            return out;
        },
        /** 1.0.0 마지막 restore 에서 모델 답에 없거나 읽을 수 없어 원문으로 둔 칸 수 (0 = 모든 칸을 번역했다). 0 이 아니면 부른 쪽이 캐시하지 않는다 */
        fallbackCount() { return lastFallback; },
        // 2.5.1 quiet: 번역 중 미리 보기 — 값 기억(learn)에 넣지 않는다 (아직 번역 안 된 값이 섞여 있다)
        // 1.0.0 칸 하나가 빠지거나 · 비거나 · 차례가 어긋났다고 카드 · 메시지 전체를 원문으로 되돌리지 않는다 — 그 칸만 원문, 나머지 칸은 번역 (readOpenCard).
        //   카드 구조 · 열쇠 · 기호는 언제나 원문(record.raw)에서 다시 짓고 답에서는 값 글자만 고른다. 같은 자리표가 떨어져 두 번 나오거나 ·
        //   다른 카드의 자리표가 섞이거나 · 카드 차례가 바뀐 답은 예전처럼 거절해요 (어느 글이 어느 칸인지 믿을 수 없다)
        restore(value, { quiet = false } = {}) {
            let output = String(value ?? ''), replacements = [], heard = [], fallback = 0;
            const owner = new Map(records.flatMap(r => r.tokens.map(t => [t, r])));
            for (const record of records) if (!record.whole) output = collapseRepeats(output,record.tokens);   // 자리를 읽기 전에 한 번에 (앞 카드 자리가 밀리지 않게)
            for (const record of records) {
                if (record.whole) {   // 8.0.6 다 채운 카드: 자리표시 하나를 채운 카드로 (없으면 번역기의 빠진 보호 블록 되돌리기가 먼저 제자리에 넣어요)
                    const at = output.indexOf(record.tokens[0]);
                    if (at >= 0 && output.indexOf(record.tokens[0],at+record.tokens[0].length) < 0) replacements.push({start:at,end:at+record.tokens[0].length,text:record.wholeText});
                    continue;
                }
                const read = readOpenCard(output,record,owner);
                if (!read) { if (quiet) continue; throw fail(); }   // 미리 보기: 아직 안 온 카드는 건너뛴다
                let n = 0;
                const values = record.fields.map((field,i)=> {
                    if (record.local[i] !== null) return escapeDisplay(record.local[i],field.context);
                    const clean = read.values.get(++n);
                    if (clean === undefined) { fallback++; return field.text; }   // 이 칸만 원문
                    if (read.exact) heard.push([field.text,clean]);   // 값 기억은 자리표가 다 맞은 카드에서만 (줄 차례로 짐작한 값은 이 답에만)
                    return clean === field.text ? field.text : escapeDisplay(clean,field.context);
                });
                replacements.push({start:read.start,end:read.end,text:patch(record.raw,record.fields,values)+(read.stray.length ? '\n'+read.stray.join('\n') : '')});
            }
            // Moving a complete card can change which prose or scene it describes. Preserve
            // the original card order as well as the order of the values inside each card.
            if (replacements.some((r,i)=>i>0 && r.start < replacements[i-1].end)) throw fail();
            for (let i=replacements.length-1;i>=0;i--) { const r=replacements[i]; output=output.slice(0,r.start)+r.text+output.slice(r.end); }
            if (typeof learn === 'function' && !quiet) for (const [source,heardValue] of heard) learn(source,heardValue);
            if (!quiet) lastFallback = fallback;
            return output;
        }
    };
}
/** 바로 붙어 되풀이된 같은 자리표(「[[__VAR_7__]][[__VAR_7__]]」 · 사이에 빈칸뿐)는 하나로 */
function collapseRepeats(output,tokens) {
    for (const token of tokens) {
        const at = output.indexOf(token); if (at < 0) continue;
        for (let next = output.indexOf(token,at+token.length); next >= 0 && !output.slice(at+token.length,next).trim(); next = output.indexOf(token,at+token.length))
            output = output.slice(0,at+token.length)+output.slice(next+token.length);
    }
    return output;
}
/** 차례가 맞는 가장 긴 줄(오름차순 부분열)의 자리 — 하나가 엉뚱한 곳에 가도 나머지 칸은 산다 */
function rising(list) {
    const tails = [], prev = [];
    for (let i = 0; i < list.length; i++) {
        let lo = 0, hi = tails.length;
        while (lo < hi) { const mid = (lo+hi) >> 1; if (list[tails[mid]] < list[i]) lo = mid+1; else hi = mid; }
        prev[i] = lo ? tails[lo-1] : -1; tails[lo] = i;
    }
    const out = []; for (let i = tails.length ? tails[tails.length-1] : -1; i >= 0; i = prev[i]) out.push(i);
    return out.reverse();
}
/** 1.0.0 열린 카드 하나를 모델 답에서 읽는다 → { start, end, values: Map(값 자리표 번호 → 글), stray: 카드 자리 안에 있던 남의 보호 자리표 } · 자리표가 하나도 없으면 null.
 *  자리표 [0] 여는 표시 · [1..k] 칸 값 · [k+1] 닫는 표시. 값 자리표가 빠졌는데 그 줄은 남았으면(줄 수가 빠진 칸 수와 딱 맞을 때만) 줄 차례대로 그 칸에,
 *  모자라거나 남으면 그 칸들은 원문. 여닫는 표시가 빠지면 카드가 문단 하나를 다 차지하던 때(own)만 그 문단 끝 · 처음까지를 카드 자리로 본다 */
function readOpenCard(output,record,owner) {
    const tokens = record.tokens, last = tokens.length-1;
    const at = tokens.map(token => { const i = output.indexOf(token); if (i >= 0 && output.indexOf(token,i+token.length) >= 0) throw fail(); return i; });
    const present = at.map((p,i)=>i).filter(i => at[i] >= 0);
    if (!present.length) return null;
    const keep = rising(present.map(i => at[i])).map(k => present[k]);
    const values = new Map();
    let tangled = false;   // 이 카드의 다른 자리표(차례가 어긋나 버린 것)가 끼어 있으면 그 글은 어느 칸 것인지 모른다
    const lines = (from,to) => { tangled = false; return output.slice(from,to).replace(/\[\[__VAR_\d+__\]\]/g, token => {
        const who = owner.get(token);
        if (who && who !== record) throw fail();   // 다른 카드의 자리표가 이 카드 값 사이에 — 두 카드가 엉켰다
        if (who) tangled = true;   // (남의 보호 자리표는 값에서 빼고 카드 뒤에 — 끝에서 카드 자리 안의 것만 모은다)
        return '\n';
    }).split(/\r?\n/).map(line => line.trim()).filter(Boolean); };
    // 값 자리표 first … first+slots-1 이 덮는 글 줄: 하나면 그 칸(여러 줄이면 이어 붙임) · 줄 수가 칸 수와 같으면 차례대로 · 한 줄뿐이면 첫 칸 · 그 밖은 모두 원문
    const fill = (first,slots,list) => {
        if (slots <= 0 || !list.length || tangled) return false;
        if (slots === 1) values.set(first,list.join(' '));
        else if (list.length === slots) list.forEach((line,j)=>values.set(first+j,line));
        else if (list.length === 1) values.set(first,list[0]);
        else return false;
        return true;
    };
    const blank = /\r?\n[ \t]*\r?\n/;
    const paraEnd = from => { const m = blank.exec(output.slice(from)); return m ? from+m.index : output.length; };
    const lineEnd = from => { const i = output.indexOf('\n',from); return i < 0 ? output.length : i; };
    let start = at[keep[0]], end = -1;
    if (keep[0] > 1 && keep[0] !== last && record.own) {   // 여는 표시 · 앞 칸 자리표가 빠짐: 같은 문단의 앞 줄이 그 칸들 값과 딱 맞으면 그 줄부터 카드
        const head = output.slice(0,start), cut = head.split(blank), from = head.length-cut[cut.length-1].length, text = output.slice(from,start);
        if (!/\[\[__/.test(text) && text.trim()) {
            const list = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            if (list.length === keep[0]-1 || keep[0]-1 === 1) { fill(1,keep[0]-1,list); start = from+text.match(/^\s*/)[0].length; }
        }
    }
    for (let k = 0; k < keep.length; k++) {
        const n = keep[k], from = at[n]+tokens[n].length, next = keep[k+1];
        if (n === last) { end = from; break; }
        const first = n === 0 ? 1 : n;
        if (next !== undefined) { fill(first,Math.min(next,last)-first,lines(from,at[next])); continue; }
        // 닫는 표시가 빠졌다: 남은 칸 수(slots)와 맞는 만큼만 카드 자리로 — 문단 하나를 다 차지하던 카드면 그 문단 끝까지, 아니면 그 줄 끝까지
        const slots = last-first, wide = record.own ? paraEnd(from) : lineEnd(from);
        const others = (output.slice(from,wide).match(/\[\[__VAR_\d+__\]\]/g) || []).some(token => owner.has(token) && owner.get(token) !== record);
        if (wide > lineEnd(from) && !others && (slots === 1 || lines(from,wide).length === slots)) { fill(first,slots,lines(from,wide)); end = wide; }
        else { end = lineEnd(from); fill(first,slots,lines(from,end)); }
    }
    end = Math.max(end,start);
    // 여닫는 자리표가 빠지면 그 자리표 줄의 줄바꿈이 빈 줄 하나로 남는다 — 카드 앞뒤가 이미 빈 줄(또는 글 처음 · 끝)일 때만 그 한 줄을 카드 자리에 넣는다
    if (keep[0] !== 0) { const m = /(?:^|\n)(\r?\n)$/.exec(output.slice(0,start)); if (m) start -= m[1].length; }
    if (keep[keep.length-1] !== last) { const m = /^(\r?\n)(?=[ \t]*(?:\r?\n|$))/.exec(output.slice(end)); if (m && (end+m[1].length >= output.length || /^\r?\n[ \t]*\r?\n[ \t]*\r?\n/.test(output.slice(end)))) end += m[1].length; }
    const stray = (output.slice(start,end).match(/\[\[__VAR_\d+__\]\]/g) || []).filter(token => !owner.has(token));   // 사용자 보호 블록 · 다 채운 카드 — 버리지 않고 카드 바로 뒤에
    return {start,end,values,stray,exact:keep.length === tokens.length && values.size === tokens.length-2};
}

/** Keep already translated card values and their exact structure out of later prose cleanup.
 * Both automatic translation and cache display can use this without network requests.
 */
export function withDisplayCardsProtected(text, transform) {
    const source = String(text ?? ''), cards = outerCards(source);
    if (!cards.length) return transform(source);
    // A separate namespace survives ordinary VAR cleanup after translation. These markers
    // never leave this synchronous local transform and cannot enter the model/cache input.
    const used = new Set([...source.matchAll(/\[\[__CARD_(\d+)__\]\]/g)].map(m=>Number(m[1]))); let next = 0;
    const rows = cards.map(card=> { while (used.has(next)) next++; const token = `[[__CARD_${next++}__]]`; return {...card,token,raw:source.slice(card.start,card.end)}; });
    let masked = source; for (let i=rows.length-1;i>=0;i--) masked = masked.slice(0,rows[i].start)+rows[i].token+masked.slice(rows[i].end);
    let output = String(transform(masked));
    for (const row of rows) { const at = output.indexOf(row.token); if (at < 0 || output.indexOf(row.token,at+row.token.length)>=0) throw fail(); output = output.slice(0,at)+row.raw+output.slice(at+row.token.length); }
    return output;
}

/** 8.0.8 사용자 「보호할 텍스트」의 <tracker>…</tracker> 규칙은 칸(|) 둘 이상인 시간 상태창에는 걸지 않는다.
 * 카드 번역(6.5.4) 전에 데우스 상태창이 깨지지 않게 넣던 줄인데, 지금은 카드가 열쇠 · 기호 · 구조를 이 기기에 두고 값만 옮기니
 * 이 줄이 남아 있으면 시간 상태창만 영어로 남았다. 다른 꼴의 <tracker>(칸 없는 글)는 예전처럼 보호해요.
 * 규칙 앞에 「카드 꼴이면 여기서 시작하지 않음」 조건만 붙인다 — 같은 규칙 글자 · 순서라 다른 보호 블록 번호는 그대로예요. */
export function cardAwareUserRule(regex) {
    if (!(regex instanceof RegExp) || !/^\^?<tracker(?:\b|>|\\b)/i.test(regex.source)) return regex;
    return new RegExp(String.raw`(?!<tracker\b[^>\x60]{0,200}>[^<\x60]*?\|[^<\x60]*?\|[^<\x60]*?<\/tracker\s*>)` + regex.source, regex.flags);
}

/** Exact blocks for display isolation; callers can escape these for their own regex registry. */
export function displayCardBlocks(text) {
    const source = String(text ?? '');
    return outerCards(source).map(card=>source.slice(card.start,card.end));
}

/** Prose-only comparison, so translated display values cannot invalidate code reuse checks. */
export function withoutDisplayCards(text) {
    const source = String(text ?? ''), cards = outerCards(source);
    let output = source;
    for (let i=cards.length-1;i>=0;i--) output = output.slice(0,cards[i].start)+'\n'+output.slice(cards[i].end);
    return output;
}

/** A cached translation predating card protection must preserve every non-display byte.
 * Match fixed fragments from the trusted source in order instead of parsing translated
 * values into a new schema. Entities introduced by escaping remain ordinary field content.
 * This is deliberately conservative and linear: ambiguous old formatting gets retranslated.
 */
export function matchesDisplayCardStructure(source,translation) {
    const original=describe(String(source??''));
    if (!original.length) return true;
    const text=String(translation??''),translated=outerCards(text);
    if (translated.length!==original.length) return false;
    for (let n=0;n<original.length;n++) {
        const card=original[n],other=translated[n],raw=text.slice(other.start,other.end);
        if (card.name!==other.name) return false;
        if (!readCardValues(card,raw)) return false;
    }
    return true;
}
