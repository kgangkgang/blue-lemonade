// Known prompt-card display values only. Raw markup, keys, code and hidden data stay local.
// No DOM parsing/rendering and no preset contents or renderer code are included.
const CARD_NAMES = new Set(['status_bar','tracker','novel_header','prologue','meow_fm','profile','branches','ccd','snow','角色状态面板']);
const OPAQUE = new Set(['head','script','style','textarea','pre','code','template','noscript','iframe','svg','math','think','thinking','updatevariable','tableedit','momentum_route']);
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const TAG = /<!--[\s\S]*?-->|<![^>]*>|<\/?[^\s<>/]+(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const KNOWN_KEY = /^(?:日期|时间|天气|地点|位置|题记|之间|serial|time|scene|plot|echo|seeds|Physical|Clothes|Mental|Location|Relationship(?:\s*\([^)]*\))?|Inventory|Inner[- ]state|Motivations?|Main Plot|Subplots|Context|CYOA|OOC|Prose Plan|Response Structure|Story progression)\s*[:：]/i;
const FRAMING = /\[\[__VAR_\d+__\]\]|(?:https?|ftp):\/\/[^\s<>"']+|(?:data|javascript|file|mailto|tel):[^\s<>"']+|`[^`\r\n]*`|&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);|\{\{[\s\S]*?\}\}|\[\/?(?:CHAP|TITLE|CP|LOC|TAGS|PREFACE|Current|Unresolved|Possible|Seed)\]|[\[\]()]|\*\*|__|~~|[|｜]|[→⟶➜➞]|->|[-+]?\d+(?:\.\d+)?\s*(?:[°º][CF]|℃|℉)|(?:\*\*|__)?(?:Physical|Clothes|Mental|Location|Relationship(?:\s*\([^)]*\))?|Inventory|Inner[- ]state|Motivations?|Main Plot|Subplots)(?:\*\*|__)?\s*[:：]/gi;
const REPLY_DIVIDER = '\n\n[Translated Text]:\n';
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
function outerCards(text) {
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
    // This older display format uses a mode tag and two separators instead of a wrapper tag.
    const legacy = /◸[^◹\r\n]*?<(?:olden|present|scifi)>[^◹\r\n]*?[｜|][^◹\r\n]*?◹/gi;
    while ((m = legacy.exec(text))) if (![...ranges,...fences,...opaqueRanges].some(r=>m.index<r.end && legacy.lastIndex>r.start)) {
        ranges.push({name:'legacy_top',start:m.index,innerStart:m.index+1,innerEnd:legacy.lastIndex-1,end:legacy.lastIndex});
    }
    return ranges.sort((a,b)=>a.start-b.start);
}
function visibleSpans(block, card) {
    if (card.partial || block.length > 524288) return [];
    const spans = [], fences = fenceRanges(block), stack = [], selectors = hiddenSelectors(block), tokens = new RegExp(TAG.source,'g'); let cursor = 0, match;
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
                if (card.name === 'tracker') { glyphs = text.match(/^[^\p{L}\p{N}]+/u)?.[0].length || 0; text = text.slice(glyphs); }
                // Keep literal parser labels at the start of each pipe-separated field.
                const label = text.match(KNOWN_KEY); const skip = label?.[0].length || 0;
                const rest = text.slice(skip), ws = rest.match(/^\s*/)[0].length;
                if (rest.slice(ws) && hasWords(rest.slice(ws))) {
                    let context = 'text';
                    if (card.name === '角色状态面板' && stack.some(x=>['搜索历史','语录集','当前播放'].includes(x.name))) context = 'script';
                    if (card.name === 'novel_header') context = 'attribute';
                    spans.push({start:at+a+before+glyphs+skip+ws,end:at+b-after,text:rest.slice(ws),context});
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
    if (!primary.length) return {text:source,count:0,compare:value=>value,restore:value=>value,cacheable:()=>true};
    if (typeof reserve !== 'function') throw new TypeError('Card masks require a reserve callback');
    const localOf = (field,card) => {
        const value = typeof localValue === 'function' ? localValue(field.text,card.name) : null;
        return typeof value === 'string' && value.trim() && value.trim() !== field.text && !/[\r\n<>]|\[\[__/.test(value) ? value.trim() : null;
    };
    // Locally known fields get no token: the model sees only the remaining values of the card.
    const records = primary.map(card => {
        const local = card.fields.map(field => localOf(field,card));
        return {...card,local,tokens:Array.from({length:local.filter(v => v === null).length+2},()=>reserve(''))};
    });
    const encode = (card,record) => { let n = 0; return record.tokens[0]+'\n'+card.fields.flatMap((f,i)=>record.local[i] !== null ? [] : [record.tokens[++n]+f.text]).join('\n')+'\n'+record.tokens.at(-1); };
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
    return {
        text:prepared,count:records.length,
        compare(value) { return transform(String(value ?? '')); },
        cacheable(body,answer) {
            // Paragraph caching happens before the complete message is restored. Reject bad
            // card responses here too, otherwise a retry would keep loading the same bad row.
            const input=String(body??''), output=String(answer??''), relevant=records.filter(r=>r.tokens.some(t=>input.includes(t)));
            const expected=relevant.flatMap(r=>r.tokens);
            if (relevant.some(r=>r.tokens.some(t=>!input.includes(t)))) return false;
            if (records.some(r=>!relevant.includes(r) && r.tokens.some(t=>output.includes(t)))) return false;
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
        // 2.5.1 quiet: 번역 중 미리 보기 — 값 기억(learn)에 넣지 않는다 (아직 번역 안 된 값이 섞여 있다)
        restore(value, { quiet = false } = {}) {
            let output = String(value ?? ''), replacements = [], heard = [];
            for (const record of records) {
                const positions = record.tokens.map(token => { const at = output.indexOf(token); if (at < 0 || output.indexOf(token,at+token.length)>=0) throw fail(); return at; });
                if (positions.some((at,i)=>i>0 && at <= positions[i-1])) throw fail();
                if (output.slice(positions[0]+record.tokens[0].length,positions[1]).trim()) throw fail();
                let n = 0;
                const values = record.fields.map((field,i)=> {
                    if (record.local[i] !== null) return escapeDisplay(record.local[i],field.context);
                    n++;
                    const raw = output.slice(positions[n]+record.tokens[n].length,positions[n+1]).trim();
                    if (!raw || /\[\[__VAR_\d+__\]\]/.test(raw)) throw fail();
                    const clean = raw.replace(/[\r\n]+/g,' ');
                    heard.push([field.text,clean]);
                    return clean === field.text ? field.text : escapeDisplay(clean,field.context);
                });
                replacements.push({start:positions[0],end:positions.at(-1)+record.tokens.at(-1).length,text:patch(record.raw,record.fields,values)});
            }
            // Moving a complete card can change which prose or scene it describes. Preserve
            // the original card order as well as the order of the values inside each card.
            if (replacements.some((r,i)=>i>0 && r.start < replacements[i-1].end)) throw fail();
            for (let i=replacements.length-1;i>=0;i--) { const r=replacements[i]; output=output.slice(0,r.start)+r.text+output.slice(r.end); }
            if (typeof learn === 'function' && !quiet) for (const [source,heardValue] of heard) learn(source,heardValue);
            return output;
        }
    };
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
