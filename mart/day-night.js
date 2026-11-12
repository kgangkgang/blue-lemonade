// 글꾸 틀 하나에 「낮 | 밤」 전환을 달아요 — DOM 없는 순수 함수(마트 · 테마 · node 어디서나) (Fable 5.2 · 11-12)
//   import { addToggle } from './전환.mjs';
//   const out = addToggle(html);              // html: 마트 복사 길의 결과(toneSimple → … → simpleReady) 또는 조각 preview — 낮 판이든 밤 판이든, 캐릭터 색을 입혔든
//   out.html  전환 달린 HTML(판은 한 벌 · <style> 도 하나 그대로)      out.info  { key, base, start, 바꾼선택자, 늘어난바이트, 자리, 주의[] }
//   못 다는 꼴이면 throw 해요(받는 쪽은 try/catch 로 「전환 없이」 원래 글을 쓰면 돼요).
//
// 원리(깡통 161847 예시 글에서 먼저 쓴 방식 — 지시-1112/예시글-161847/만들기.cjs · 그 앞은 마트-자랑글-개편/예시.cjs)
//   심플 틀은 <style> 하나에 낮 규칙(.gk-kN.gk-tl …)과 밤 규칙(.gk-kN.gk-td … · .gk-tn-n …)을 둘 다 갖고, 마트는 뿌리 class 만 바꿔 낮/밤을 골라요(toneSimple).
//   → 판을 두 벌 싣지 않고, 틀 규칙 선택자의 낮/밤 class 를 「전환이 닫힘 / 열림」 조건으로 바꿔 끼워요:
//        .gk-tl   →  .gk:where(.gkt-kN:not(:has(.gkt-k[open])) *)        .gk-td · .gk-tn-n   →  .gk:where(.gkt-kN:has(.gkt-k[open]) *)
//     :where() 는 명시도 0 이고 .gk(뿌리에 늘 있는 class)가 바뀐 class 한 개 몫을 대신해서, 규칙끼리 이기고 지는 차례가 원래와 똑같아요.
//   · 전환은 <details class="gkt-k">(체크박스가 아님 — 깡통도 테마 로그 복사 정화기도 <input> 은 지우고 <details> 는 남겨요).
//   · 전환 조건의 뿌리는 틀 열쇠로 고유해요(.gkt-k13 …) — 한 글에 여러 틀을 붙여도 서로 안 걸려요.
//   · 낮/밤 class 는 선택자의 「첫 덩이」(뿌리)에서만 바꿔요 — 지퍼(k09)의 아랫니 조각처럼 뿌리가 아닌 곳의 .gk-td 는 낮밤이 아니에요.
//   · 원래 밤인 틀(뿌리 gk-td · gk-tx)은 반대 짝: 밤 = 그 바탕 · 낮 = gk-tl + gk-tn-d.
//   · 소리 카드 <audio> 의 인라인 color-scheme 은 규칙(!important)으로 덮어요.
//   · 깡통 빈 줄 막기 규칙(마트 kkGuard)이 details 안 내용까지 숨기는 고장을 같이 고쳐요(아래 GUARD).
//   · 전환 줄 자리: 보통은 틀 바로 위 오른쪽(틀 폭에 맞춤). 「LOG · 프롬프트」 탭 띠가 켜진 기본 글꾸(뿌리 gk-gi-tab)는 그 띠 오른쪽 끝에 한 줄로 얹어요.

const TONE = /\.gk-(tl|td|tx|tn-n|tn-d)(?![\w-])/g;
const BASES = ['gk-tl', 'gk-td', 'gk-tx'], TN = ['gk-tn-n', 'gk-tn-d'];
// 소품이 틀 위 오른쪽으로 8px 넘게 나오는 틀(알약 자리와 겹침 — 도구/튀어나옴.mjs 가 잰 목록 · 튀어나옴.csv): 이 틀들은 알약을 틀 위 왼쪽에 둬요. 틀이 늘거나 바뀌면 다시 재서 갈아 끼워요
export const SIDE_LEFT = new Set([]);

/** 그 class 가 이 틀에서 낮인지 밤인지(원래 바탕 기준 — 마트 toneSimple 과 같은 약속). never = 이 틀에서는 안 걸리던 짝 */
function toneOf(cls, base) {
    const c = 'gk-' + cls;
    if (base === 'gk-tl') return c === 'gk-tl' ? 'day' : c === 'gk-td' || c === 'gk-tn-n' ? 'night' : c === 'gk-tn-d' ? 'never' : null;   // gk-tx 는 낮 틀에서는 「탭 details」 이름이라 안 건드려요
    return c === base ? 'night' : c === 'gk-tl' || c === 'gk-tn-d' ? 'day' : c === 'gk-tn-n' ? 'never' : c === 'gk-td' ? 'never' : null;
}
const firstEnd = one => { let d = 0; for (let j = one.search(/\S/); j >= 0 && j < one.length; j++) { const ch = one[j]; if (ch === '(') d++; else if (ch === ')') d--; else if (!d && /[\s>+~]/.test(ch)) return j; } return one.length; };
const splitTop = sel => { const out = []; let d = 0, a = 0; for (let j = 0; j < sel.length; j++) { const ch = sel[j]; if (ch === '(') d++; else if (ch === ')') d--; else if (ch === ',' && !d) { out.push(sel.slice(a, j)); a = j + 1; } } out.push(sel.slice(a)); return out; };

/** 틀 <style> 글의 선택자에서만 낮/밤 class 를 전환 조건으로(선언 값 · @keyframes 안 · @media 머리는 그대로) */
export function retone(cssText, cond, base) {
    let n = 0; const out = []; let i = 0, key = 0; const s = cssText;
    const swapOne = one => { const e = firstEnd(one); return one.slice(0, e).replace(TONE, (all, t) => { const k = toneOf(t, base); if (!k) return all; n++; return `.gk:where(${cond[k]} *)`; }) + one.slice(e); };
    while (i < s.length) {
        const open = s.indexOf('{', i), close = s.indexOf('}', i);
        if (open === -1 && close === -1) { out.push(s.slice(i)); break; }
        if (open !== -1 && (close === -1 || open < close)) {
            const head = s.slice(i, open), isAt = /^\s*@/.test(head);
            out.push(!isAt && !key ? splitTop(head).map(swapOne).join(',') : head, '{');
            if (/^\s*@keyframes/.test(head)) key = 1; else if (key) key++;
            i = open + 1;
        } else { out.push(s.slice(i, close + 1)); if (key) key--; i = close + 1; }
    }
    return { css: out.join(''), n };
}

/** 뿌리 <div class="gk …"> 의 자리(여는 태그 · 닫는 </div>)를 찾아요 — 앞뒤에 깡통 빈 줄(<p><br></p>) · 주석이 있어도 돼요 */
function findRoot(html) {
    const m = /<div\b[^>]*\sclass="(gk(?:\s[^"]*)?)"[^>]*>/.exec(html); if (!m) return null;
    const re = /<!--[\s\S]*?-->|<style\b[^>]*>[\s\S]*?<\/style>|<(\/?)div\b[^>]*>/g; re.lastIndex = m.index; let depth = 0, t;
    while ((t = re.exec(html))) { if (t[1] === undefined) continue; depth += t[1] ? -1 : 1; if (depth === 0) return { start: m.index, openEnd: m.index + m[0].length, end: re.lastIndex, classes: m[1].split(/\s+/) }; }
    return null;
}

// 해 · 달 그림: 블루레몬 테마의 모양 그대로(테마 src/scripts/fruit-status.js sunMask · moonMask — 24 칸 · 끝 둥금) · 선 굵기 2.2 · 16px 로 그려요.
//   깡통 정화기는 인라인 <svg> · 인라인 style 의 url(data:) 를 지워서 <style> 규칙의 mask-image 로(색은 background-color). 꼴은 테마 로그 복사 「밝기」 칩(띠 위 두 칸 · 고른 칸만 켜짐).
const glyph = shape => `url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" shape-rendering="geometricPrecision">${shape}</svg>`).replace(/'/g, '%27')}')`;
export const SUN = glyph('<circle cx="12" cy="12" r="4.5" fill="#000" stroke="none"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>');
export const MOON = glyph('<path d="M20.9 13.5A9 9 0 0 1 10.5 3.1 9 9 0 1 0 20.9 13.5Z"/>');
/** 전환 줄 규칙 — 틀 <style> 끝에 덧붙여요(뿌리 .gkt-kN 로 갇힘 · 명시도는 뿌리를 세 번 적어 사이트 규칙보다 위) */
function shellCss(K, { maxWidth, band, cond, side }) {
    const R = `.${K}.${K}.${K}`;
    return [
        `${R}{display:block;box-sizing:border-box;margin:0 auto;padding:0}`,
        band   // 탭 띠(높이 48px) 오른쪽 끝에 얹기: 줄 높이 34 + 위 7 = 41 을 아래 음수 여백으로 되돌려 틀이 제자리에서 시작해요
            ? `${R} .gkt-b{display:flex;justify-content:flex-end;box-sizing:border-box;position:relative;z-index:1;max-width:${maxWidth};margin:0 auto -41px;padding:7px ${band.inset}px 0 0;pointer-events:none}\n${R} .gkt-b>*{pointer-events:auto}`
            : `${R} .gkt-b{display:flex;justify-content:${side === 'left' ? 'flex-start' : 'flex-end'};box-sizing:border-box;max-width:${maxWidth};margin:0 auto 8px;padding:0}`,
        `${R} details.gkt-k{display:block;flex:none;margin:0!important;padding:0!important;border:0!important;background:none!important}`,
        `${R} details.gkt-k>summary{list-style:none}`,
        `${R} details.gkt-k>summary::-webkit-details-marker{display:none}`,
        `${R} details.gkt-k>:not(summary){display:none!important}`,
        `${R} details.gkt-k>summary:focus:not(:focus-visible){outline:none}`,
        `${R} .gkt-t{display:inline-flex;align-items:center;gap:2px;box-sizing:border-box;height:34px;block-size:34px;padding:3px;border-radius:10px;background-color:#E9EDF2;background-color:light-dark(#E9EDF2,#22272E);cursor:pointer;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}`,
        `${R} .gkt-t>span{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;width:34px;height:28px;block-size:28px;border-radius:7px;background-color:transparent;box-shadow:inset 0 0 0 1px transparent;transition:background-color .2s}`,
        `${R} .gkt-i{display:block;width:16px;height:16px;block-size:16px;background-color:#4F6279;background-color:light-dark(#4F6279,#B4BECB);-webkit-mask:center/100% 100% no-repeat;mask:center/100% 100% no-repeat}`,
        `${R} .gkt-d .gkt-i{-webkit-mask-image:${SUN};mask-image:${SUN}}`,
        `${R} .gkt-n .gkt-i{-webkit-mask-image:${MOON};mask-image:${MOON}}`,
        `${cond.day} .gkt-t .gkt-d{background-color:#FFFFFF;background-color:light-dark(#FFFFFF,#2F3742);box-shadow:inset 0 0 0 1px #D5DDE7;box-shadow:inset 0 0 0 1px light-dark(#D5DDE7,#4A5564)}`,   // 고른 쪽만 켜짐: 해 = 흰 칸 + 호박색 해 + 가는 테 · 달 = 옅은 파랑 칸 + 파랑 달(11-13 사용자 — 꽉 찬 레몬 · 파랑 칸은 뺌) · 어두운 깡통에서는 한 단계 낮춘 값
        `${cond.night} .gkt-t .gkt-n{background-color:#D6E6F7;background-color:light-dark(#D6E6F7,#1E3F63);box-shadow:inset 0 0 0 1px #C3D8EE;box-shadow:inset 0 0 0 1px light-dark(#C3D8EE,#2C5482)}`,
        `${cond.night} .gkt-t .gkt-d,${cond.day} .gkt-t .gkt-n{background-color:transparent;box-shadow:inset 0 0 0 1px transparent}`,
        `${cond.day} .gkt-t .gkt-d .gkt-i{background-color:#E8A100}`,
        `${cond.night} .gkt-t .gkt-n .gkt-i{background-color:#2264A5;background-color:light-dark(#2264A5,#9CC7F2)}`,
        `${cond.night} .gkt-t .gkt-d .gkt-i,${cond.day} .gkt-t .gkt-n .gkt-i{background-color:#4F6279;background-color:light-dark(#4F6279,#B4BECB)}`,
    ].join('\n');
}

/**
 * 틀 HTML 에 「낮 | 밤」 전환을 달아요.
 * @param {string} html 심플 틀 HTML(뿌리 <div class="gk gk-tl|gk-td|gk-tx [gk-tn-n|gk-tn-d] gk-<열쇠> …"> + 첫 자식 <style> 하나)
 * @param {{ start?: 'light'|'dark', aria?: string, where?: 'auto'|'above'|'band', side?: 'right'|'left' }} [o]
 *   start: 처음 보이는 판(안 주면 받은 HTML 의 판 그대로) · aria: 알약의 안 보이는 이름(aria-label · title) · where: 전환 줄 자리(auto = 탭 띠가 켜졌으면 띠 위 · 아니면 틀 위)
 */
export function addToggle(html, o = {}) {
    const src = String(html ?? ''); const root = findRoot(src);
    if (!root) throw new Error('심플 틀 꼴이 아니에요(뿌리 <div class="gk …"> 가 없어요)');
    const keyCls = root.classes.find(c => /^gk-[kq]\d+$/.test(c)); if (!keyCls) throw new Error('틀 열쇠 class(gk-kN)가 없어요');
    const key = keyCls.slice(3), K = 'gkt-' + key;
    if (src.includes(`class="gkt ${K}"`)) throw new Error('이미 전환이 달린 글이에요');
    const inner = src.slice(root.openEnd, root.end);
    const sm = /^\s*<style>([\s\S]*?)<\/style>/.exec(inner); if (!sm) throw new Error('뿌리 첫 자식이 <style> 이 아니에요');
    if ((inner.match(/<style\b/g) || []).length !== 1) throw new Error('<style> 이 하나가 아니에요');
    const css0 = sm[1];
    // 지금 판 · 원래 바탕(마트 originalBase 와 같은 규칙)
    const nowBase = BASES.find(c => root.classes.includes(c)); if (!nowBase) throw new Error('뿌리에 낮/밤 바탕 class 가 없어요');
    const flipped = root.classes.some(c => TN.includes(c));
    const base = !flipped ? nowBase : nowBase !== 'gk-tl' ? 'gk-tl' : /\.gk-tx(?![\w-])[^{}]*\{/.test(css0) && !/<details\b[^>]*\sclass="gk-tx"/.test(inner) ? 'gk-tx' : 'gk-td';
    const nowMode = (nowBase === 'gk-tl') ? 'light' : 'dark';
    const start = o.start === 'light' || o.start === 'dark' ? o.start : nowMode;
    const altNeed = base === 'gk-tl' ? ['gk-td', 'gk-tn-n'] : ['gk-tl', 'gk-tn-d'];
    const has = t => new RegExp(`\\.${t}(?![\\w-])`).test(css0);
    const 주의 = [];
    if (!has(altNeed[0]) && !has(altNeed[1])) throw new Error(`반대 판 규칙(${altNeed.join(' · ')})이 없는 틀이에요`);
    // 전환 조건: 닫힘 = 처음 판 · 열림 = 반대 판
    const shut = `.${K}:not(:has(.gkt-k[open]))`, open = `.${K}:has(.gkt-k[open])`;
    const cond = { day: start === 'light' ? shut : open, night: start === 'light' ? open : shut, never: '.gkt-never' };
    // 마트 복사 글의 「깡통 빈 줄 막기」 규칙(kkGuard — details>summary~:not([class]){display:none})은 details 안에 내용이 든 틀에서 그 내용까지 숨겨요:
    //   깡통은 details 안 내용을 class 없는 <div> 로 한 번 감싸거든요(게시글 161847 블라인드 · 11-12 밤 사용자 발견). 「class 가 없고 안에 class 달린 것도 없는 칸」만 숨기게 고쳐요(빈 줄 <div><br></div> 만).
    const GUARD = 'details>summary~:not([class]){display:none}'; const guardFixed = css0.split(GUARD).length - 1;
    const rt = retone(guardFixed ? css0.split(GUARD).join('details>summary~:not([class]):not(:has([class])){display:none}') : css0, cond, base);
    // 소리 카드
    const audio = /<audio\b/.test(inner) ? `\n.${keyCls}.gk:where(${cond.night} *) audio{color-scheme:dark!important}\n.${keyCls}.gk:where(${cond.day} *) audio{color-scheme:light!important}` : '';
    // 틀 폭(전환 줄을 틀 오른쪽 끝에 맞춰요): 뿌리만 가리키는 규칙의 마지막 max-width
    let maxWidth = '640px';
    for (const m of css0.matchAll(/(^|[},\n])\s*((?:div)?\.gk-[kq]\d+(?:\.[\w-]+)*)\s*(?:,[^{]*)?\{([^{}]*)\}/g)) { const w = /(?:^|;)\s*max-width\s*:\s*([^;!}]+)/.exec(m[3]); if (w) maxWidth = w[1].trim(); }
    // 자리: 탭 띠
    //   탭이 켜져 있고(gk-gi-tab) 그 띠가 틀 맨 위를 꽉 채운 꼴(음수 여백으로 틀 안쪽 여백을 먹는 띠)일 때만 띠 위에 얹어요 — 「창」(k1431)처럼 띠 위에 다른 줄이 있는 틀은 틀 위로
    const bandTop = /\.gk-tq\{[^{}]*margin:-\d+px -\d+px/.test(css0);
    const tabOn = root.classes.includes('gk-gi-tab') && /<details\b[^>]*\sclass="gk-tx"/.test(inner) && bandTop;
    const where = o.where === 'above' || o.where === 'band' ? o.where : tabOn ? 'band' : 'above';
    let band = null;
    if (where === 'band') { const q = /\.gk-tq\{[^{}]*?padding:0 (\d+)px/.exec(css0); band = { inset: q ? Number(q[1]) : 20 }; if (!tabOn) 주의.push('탭 띠가 꺼진 틀에 band 자리를 골랐어요'); }
    const shell = shellCss(K, { maxWidth, band, side: o.side === 'left' ? 'left' : SIDE_LEFT.has(key) && o.side !== 'right' ? 'left' : 'right', cond: { day: `.${K}.${K}.${K}${start === 'light' ? ':not(:has(.gkt-k[open]))' : ':has(.gkt-k[open])'}`, night: `.${K}.${K}.${K}${start === 'light' ? ':has(.gkt-k[open])' : ':not(:has(.gkt-k[open]))'}` } });
    const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const pill = `<div class="gkt-b"><details class="gkt-k"><summary class="gkt-t" aria-label="${esc(o.aria ?? '낮 · 밤 바꾸기')}" title="${esc(o.aria ?? '낮 · 밤 바꾸기')}"><span class="gkt-d"><span class="gkt-i"></span></span><span class="gkt-n"><span class="gkt-i"></span></span></summary></details></div>`;
    const tail = /\n\s*$/.test(css0) ? '' : '\n';
    const newInner = inner.replace(sm[0], () => `${sm[0].slice(0, sm[0].indexOf('<style>'))}<style>${rt.css.replace(/\s+$/, '')}${audio}\n${shell}\n</style>`);
    const out = `${src.slice(0, root.start)}<div class="gkt ${K}">${pill}\n${src.slice(root.start, root.openEnd)}${newInner}</div>${src.slice(root.end)}`;
    if (!rt.n) 주의.push('바꾼 선택자가 0개예요');
    return { html: out, info: { key, base, 받은판: nowMode, start, 자리: where, 틀폭: maxWidth, 바꾼선택자: rt.n, 늘어난바이트: byteLen(out) - byteLen(src), 소리카드: !!audio, 빈줄규칙고침: guardFixed, 주의 } };
}
const byteLen = s => (typeof Buffer !== 'undefined' ? Buffer.byteLength(s) : new TextEncoder().encode(s).length);
