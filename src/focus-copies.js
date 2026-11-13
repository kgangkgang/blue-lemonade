// 1.4.1 키보드 초점 사본을 테마가 맡는 길 — 실리태번 scripts/dynamic-styles.js 와 같은 결과를 더 싸게.
//   실리태번은 head 에 붙는 <link rel=stylesheet> 마다, 시트를 다 받은 그 작업 안에서 규칙을 전부 훑어 「:focus 짝이 없는 :hover 규칙」의
//   :focus-visible 사본을 #dynamic-styles 에 넣어요. 테마의 애드온 시트는 첫 장 → 전체 장으로 바뀌어 같은 규칙을 두 번 붙이므로 사본도 두 벌이었고
//   (부팅 추적: 덮개가 걷힌 뒤 테마 몫 126개 중 23개가 겹침), 훑기(전체 장 약 3,500규칙)는 시트가 붙는 긴 작업 안에서 돌았어요.
//   여기로 붙이는 시트는 미리 받기(rel=preload)로 붙였다가 다 받으면 그 자리에서 stylesheet 로 바꿔요 — 실리태번 감시는 「새로 붙은 <link rel=stylesheet>」만 보므로
//   훑지 않아요. 사본은 같은 규칙으로 여기서 만들어 같은 #dynamic-styles 맨 뒤에 넣어요(같은 시트 · 같은 자리라 겹침 순서가 같아요). 이미 넣은 사본이 다시 오면
//   앞의 것을 지우고 맨 뒤에 다시 넣어요(실리태번은 두 벌을 두어 뒤의 것이 이겼어요 — 한 벌로 같은 결과),
//   훑기는 브라우저가 쉴 때(늦어도 1초) 하되 키를 누르거나 초점이 움직이면 그 자리에서 마저 해요 — :focus-visible 은 그때부터 보이므로 모양이 비는 틈이 없어요.
//   실리태번이 #dynamic-styles 를 아직 안 만들었거나(초기화 전 · 옛 판) 브라우저가 미리 받기 · @container 규칙을 모르면 예전처럼 그냥 붙여요(실리태번이 훑어요).

const PLACE = ':__bl_focus__';
const queue = [];
const made = new Map();   // 이미 넣은 사본 글 → 그 규칙 — 첫 장 · 전체 장처럼 같은 규칙이 두 번 와도 한 벌만
let idle = null, armed = false;
export const focusCopyStats = { sheets: 0, copies: 0, skipped: 0, scans: 0 };   // 시험 · 진단

const doc = () => globalThis.document;
const hostSheet = () => { try { return doc()?.getElementById?.('dynamic-styles')?.sheet ?? null; } catch { return null; } };

/** 실리태번 대신 사본을 맡을 수 있나 — 아니면 예전 길(실리태번이 훑음) */
export function canTakeOver(link) {
    try {
        if (!hostSheet()) return false;
        if (typeof globalThis.CSSContainerRule !== 'function') return false;   // 실리태번 훑기가 이 규칙 이름을 써요 — 없는 브라우저는 예전 결과(실리태번 몫) 그대로
        return !!link?.relList?.supports?.('preload');
    } catch { return false; }
}

/**
 * 시트 <link> 를 붙이고 다 받으면 풀리는 약속(못 받으면 거절). place(link) 가 실제로 붙여요(head 끝 · 어떤 시트 바로 뒤 등).
 * href 는 부르기 전에 넣어 두어요. 사본을 맡을 수 없으면 예전처럼 rel=stylesheet 로 붙여요.
 */
export function loadSheet(link, place = el => doc().head.append(el)) {
    return new Promise((resolve, reject) => {
        const fail = () => { link.onload = link.onerror = null; reject(Error('스타일을 읽지 못했어요.')); };
        if (!canTakeOver(link)) {
            link.rel = 'stylesheet';
            link.onload = () => { link.onload = link.onerror = null; resolve(); };
            link.onerror = fail;
            place(link);
            return;
        }
        link.rel = 'preload'; link.as = 'style';
        link.onerror = fail;
        link.onload = () => {   // 받기 끝 → 같은 자리에서 시트로(캐시에서 읽어요) — 실리태번 감시는 rel 바뀜을 보지 않아요
            link.onload = () => { link.onload = link.onerror = null; enqueue(link); resolve(); };
            link.removeAttribute?.('as');
            link.rel = 'stylesheet';
        };
        place(link);
    });
}

function enqueue(link) {
    queue.push(link);
    arm();
    if (!idle) {
        const run = () => { idle = null; flushFocusCopies(); };
        idle = typeof globalThis.requestIdleCallback === 'function' ? { id: globalThis.requestIdleCallback(run, { timeout: 1000 }), idle: true } : { id: setTimeout(run, 200) };
    }
}
function arm() {
    if (armed) return;
    armed = true;
    const now = () => { if (queue.length) flushFocusCopies(); };
    try { for (const type of ['keydown', 'focusin']) doc().addEventListener(type, now, { capture: true, passive: true }); } catch { /* 문서 없음 */ }
}

/** 기다리는 시트의 사본을 지금 다 넣어요 (쉴 때 · 키 누름 · 초점 이동 · 시험) */
export function flushFocusCopies() {
    if (idle) { try { if (idle.idle) globalThis.cancelIdleCallback?.(idle.id); else clearTimeout(idle.id); } catch { /* 그대로 */ } idle = null; }
    const target = hostSheet();
    const out = new Map();   // 글 → 차례(맨 뒤에 다시 온 것이 뒤로) — 실리태번은 같은 사본을 또 넣어 뒤의 것이 이기므로 「마지막에 온 자리」가 같은 결과예요
    while (queue.length) {
        const link = queue.shift();
        if (!link.isConnected) continue;   // 그 사이 전체 장으로 바뀌어 떼어 낸 첫 장 — 전체 장이 같은 규칙을 다 가져요
        let rules = null;
        try { rules = link.sheet?.cssRules ?? null; } catch { rules = null; }
        if (!rules) continue;
        focusCopyStats.sheets++;
        for (const text of copiesOf(rules)) { out.delete(text); out.set(text, true); }
    }
    if (!target) return 0;
    let n = 0;
    for (const text of out.keys()) {   // 한 작업에서 차례대로 — 다시 계산은 한 번
        const old = made.get(text);
        if (old) {   // 앞 시트(첫 장)가 넣은 같은 사본 — 지우고 맨 뒤에 다시(두 벌 두지 않고 순서는 실리태번과 같게)
            const at = Array.prototype.indexOf.call(target.cssRules, old);
            if (at >= 0) try { target.deleteRule(at); } catch { /* 그대로 */ }
            focusCopyStats.skipped++;
        }
        try { const at = target.insertRule(text, target.cssRules.length); made.set(text, target.cssRules[at]); focusCopyStats.copies++; n++; } catch { made.delete(text); /* 실리태번도 못 넣는 규칙은 건너뛰어요 */ }
    }
    return n;
}

/**
 * 실리태번 dynamic-styles.js 와 같은 규칙(같은 결과 글)으로 사본 글을 만들어요:
 *   맨 위 · @media · @supports · @container 안의 스타일 규칙을 「,」로 나눈 선택자마다 보고, :hover 만 든 선택자의 바탕(:hover → 자리표)이
 *   같은 감싸개 안의 :focus · :focus-within · :focus-visible 바탕과 짝이 없으면, 규칙 전체 선택자의 :hover 를 :focus-visible 로 바꾼 사본(가상 요소 :: 는 빼요).
 *   @import 시트도 따라 들어가요(미디어 조건은 감싸개로). 시트 안 차례 그대로 돌려줘요.
 */
export function copiesOf(rules) {
    focusCopyStats.scans++;
    const hovers = [], focus = new Set();
    const key = chain => chain.map(w => `${w.type}:${w.text}`).join(';');
    const walk = (list, chain) => {
        for (const rule of Array.from(list)) {
            if (typeof CSSImportRule === 'function' && rule instanceof CSSImportRule) {
                const media = rule.media?.mediaText;
                let sheet = null; try { sheet = rule.styleSheet; } catch { sheet = null; }
                let inner = null; try { inner = sheet?.cssRules ?? null; } catch { inner = null; }
                if (inner) walk(inner, media ? [...chain, { type: 'media', text: media }] : chain);
            } else if (rule instanceof CSSStyleRule) {
                for (const part of rule.selectorText.split(',').map(s => s.trim())) {
                    const hover = part.includes(':hover'), focused = part.includes(':focus');
                    if (hover && !focused) hovers.push({ base: part.replace(/:hover/g, PLACE).trim(), rule, chain });
                    else if (focused && !hover) focus.add(`${part.replace(/:focus(-within|-visible)?/g, PLACE).trim()}|${key(chain)}`);
                }
            } else if (rule instanceof CSSMediaRule) walk(rule.cssRules, [...chain, { type: 'media', text: rule.conditionText }]);
            else if (rule instanceof CSSSupportsRule) walk(rule.cssRules, [...chain, { type: 'supports', text: rule.conditionText }]);
            else if (rule instanceof globalThis.CSSContainerRule) walk(rule.cssRules, [...chain, { type: 'container', text: rule.conditionText }]);
        }
    };
    walk(rules, []);
    const out = [];
    for (const { base, rule, chain } of hovers) {
        if (focus.has(`${base}|${key(chain)}`)) continue;
        const selector = rule.selectorText.replace(/:hover/g, ':focus-visible');
        if (selector.includes('::')) continue;
        out.push(chain.reduceRight((inner, w) => `@${w.type} ${w.text} { ${inner} }`, `${selector} { ${rule.style.cssText} }`));
    }
    return out;
}
