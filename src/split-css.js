// 전체 CSS는 첫 서랍을 사용할 때만 받아요. 원래 순서를 보존하고 첫 시트와 중복 활성화하지 않아요.
// 1.4.0 <style> 에 원문(1.36MB)을 글로 넣던 것을 <link> 로 — 받기 · 해석을 브라우저 몫으로 넘기고(외부 시트는 선언 해석을 처음 쓸 때로 미뤄요),
//   원문 글이 자바스크립트 힙과 DOM 글 노드에 두 벌 남지 않아요. 꺼진 채(media="not all") 받아 꼬리를 떼고 데우스 규칙을 준비한 뒤,
//   켜기 · 첫 장 끄기 · 서랍 전용 칸 연결을 한 작업에서 해요 — 다시 계산이 한 번이에요. 붙는 자리(첫 장 바로 뒤 — 본문 → 미리보기 → 뗀 규칙 → 서랍 전용)는 그대로예요.
import { syncThemeSheet, prepareDemThemeSheet, demStylesEnabled } from './theme-sheet.js';
const URL = new globalThis.URL('./style-lazy.gen.css', import.meta.url).href;
const TAIL_URL = new globalThis.URL('./lazy-panel.gen.css', import.meta.url).href;   // 빌드가 같은 꼬리를 따로 써 둔 것(src/lite.js deferPanelHasRules 와 같은 파일)
const MARK = '#salty-lazy-panel-start';
/** 시트 맨 위 목록에서 서랍 규칙 경계(#salty-lazy-panel-start {})의 자리 — 없으면 -1 */
function markAt(rules) {
    for (let i = rules.length - 1; i >= 0; i--) if (rules[i]?.selectorText === MARK) return i;
    return -1;
}
/** 서랍 전용 칸의 글 — 이미 붙은 칸이 없을 때만: 따로 써 둔 꼬리 파일(원문) → 못 받으면 떼어 낼 규칙을 적은 글 */
async function tailText(rules, at, signal) {
    try {
        const response = await fetch(TAIL_URL, { credentials: 'same-origin', signal });
        if (response.ok) { const text = await response.text(); if (text.trim()) return text; }
    } catch { /* 아래 */ }
    if (signal.aborted) return '';
    const out = [];
    for (let i = at + 1; i < rules.length; i++) out.push(rules[i].cssText);
    return out.join('\n');
}
export function loadFullCss(sheet, readyPanel, themeOn) {
    const link = document.createElement('link');
    // 실리태번(dynamic-styles.js)은 head 에 「붙는」 <link rel="stylesheet"> 마다 규칙을 전부 훑어 :hover 규칙의 :focus-visible 사본을 더 넣어요(1.36MB 를 훑고 수백 줄을 켜진 시트에 넣는 일).
    //   예전 <style> 은 그 대상이 아니었어요 — 같게 하려고 미리 받기(rel="preload")로 붙인 뒤, 다 받으면 그 자리에서 rel 을 stylesheet 로 바꿔요(붙는 사건이 아니라 보지 않아요 · 받은 것을 그대로 써요).
    //   미리 받기를 모르는 브라우저는 처음부터 stylesheet 로(그때는 실리태번이 사본을 더해요 — 동작은 같아요)
    const viaPreload = !!link.relList?.supports?.('preload');
    link.id = 'salty-lazy-css'; link.dataset.blFullTheme = 'loading';
    if (viaPreload) { link.rel = 'preload'; link.as = 'style'; } else { link.rel = 'stylesheet'; link.media = 'not all'; }
    let resolve, done = false;
    const promise = new Promise(callback => { resolve = callback; }), controller = new AbortController();
    const finish = ok => {
        if (done) return;
        done = true; clearTimeout(timeout);
        if (!ok) { controller.abort(); link.remove(); }
        resolve(ok);
    };
    const timeout = setTimeout(() => finish(false), 15000);
    const fail = error => { if (!done) console.info('[Blue Lemonade] 전체 CSS를 받지 못했어요 — 다음에 열 때 다시 받아요', error?.message || error); finish(false); };
    const live = () => !done && document.getElementById('salty-lazy-css') === link;
    const ready = async () => {
        if (!live()) return finish(false);
        const full = link.sheet, rules = full?.cssRules;
        if (!rules?.length) throw Error('전체 CSS를 해석하지 못했어요');
        const at = markAt(rules);
        if (at < 0) throw Error('전체 CSS에 서랍 규칙 경계가 없어요');
        let panel = document.getElementById('salty-panel-css');
        const text = panel ? null : await tailText(rules, at, controller.signal);
        if (!live()) return finish(false);
        if (!panel && !text) throw Error('서랍 전용 규칙을 준비하지 못했어요');
        // 꼬리(경계 표시 포함)는 서랍 전용 칸이 따로 켜고 꺼요 — 꺼진 시트라 떼어도 다시 계산이 없어요
        for (let i = rules.length - 1; i >= at; i--) full.deleteRule(i);
        if (!await prepareDemThemeSheet(full, { enabled: () => themeOn() && demStylesEnabled(), signal: controller.signal })) throw Error('전체 시트의 데우스 규칙을 준비하지 못했어요');
        if (!live()) return finish(false);
        panel = document.getElementById('salty-panel-css');
        if (!panel) {
            panel = document.createElement('style'); panel.id = 'salty-panel-css'; panel.media = 'not all';
            // 1.1.6 미리보기 · 뗀 규칙 시트들(data-bl-gate) 뒤 — 원래 차례: 본문 → 미리보기 → 뗀 규칙 → 서랍 전용 (src/lite.js themeRunEnd 와 같은 줄 · 이 모듈은 lite.js 를 부르지 않아요)
            let end = link; for (let n = link.nextElementSibling; n && (n.id === 'salty-ext-css' || n.dataset?.blGate != null); n = n.nextElementSibling) end = n;
            end.after(panel);
            panel.textContent = text;
        }
        // 여기부터 한 작업 — 서랍 전용 칸 연결 · 전체 장 켜기 · 첫 장 끄기가 한 번의 다시 계산으로 묶여요
        readyPanel(panel);
        link.dataset.blFullTheme = 'ready'; link.media = 'all';
        syncThemeSheet(themeOn());
        finish(true);
    };
    let started = false;
    const onLoad = () => {
        if (link.rel === 'preload') { if (!live()) return finish(false); link.media = 'not all'; link.rel = 'stylesheet'; return; }   // 꺼진 채 시트로 — 받은 것을 그대로 써서 곧 load 가 한 번 더 와요
        if (started) return;
        started = true;
        ready().catch(fail);
    };
    link.addEventListener('load', onLoad);
    link.addEventListener('error', () => fail(Error('전체 CSS를 받지 못했어요')), { once: true });
    link.href = URL;
    sheet.ownerNode.after(link);
    return promise;
}
