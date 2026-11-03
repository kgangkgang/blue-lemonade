// 전체 CSS는 첫 서랍을 사용할 때만 받아요. 원래 순서를 보존하고 첫 시트와 중복 활성화하지 않아요.
import { syncThemeSheet } from './theme-sheet.js';
const URL = new globalThis.URL('./style-lazy.gen.css', import.meta.url).href;
const MARK = '#salty-lazy-panel-start {}';
export function loadFullCss(sheet, readyPanel, themeOn) {
    const link = document.createElement('style');
    link.id = 'salty-lazy-css'; link.media = 'not all'; link.dataset.blFullTheme = 'loading';
    let resolve, done = false;
    const promise = new Promise(callback => { resolve = callback; }), controller = new AbortController();
    const finish = ok => {
        if (done) return;
        done = true; clearTimeout(timeout);
        if (!ok) { controller.abort(); link.remove(); }
        resolve(ok);
    };
    const timeout = setTimeout(() => finish(false), 15000);
    sheet.ownerNode.after(link);
    Promise.resolve().then(() => fetch(URL, { credentials: 'same-origin', signal: controller.signal })).then(async response => {
        if (!response.ok) throw Error(`전체 CSS를 받지 못했어요 (${response.status})`);
        const text = await response.text(), at = text.lastIndexOf(MARK);
        if (at < 0) throw Error('전체 CSS에 서랍 규칙 경계가 없어요');
        if (done || document.getElementById('salty-lazy-css') !== link) return finish(false);
        const on = themeOn();
        // 빌드가 상대 URL/@import를 금지해 원문을 <style>에 넣어도 주소와 규칙 뜻이 같아요.
        link.textContent = text.slice(0, at);
        if (!link.sheet?.cssRules.length) throw Error('전체 CSS를 해석하지 못했어요');
        let panel = document.getElementById('salty-panel-css');
        if (!panel) {
            panel = document.createElement('style'); panel.id = 'salty-panel-css'; panel.media = 'not all';
            (document.getElementById('salty-preview-css') || link).after(panel);
        }
        const tail = text.slice(at + MARK.length);
        if (panel.textContent !== tail) panel.textContent = tail;
        readyPanel(panel);
        link.dataset.blFullTheme = 'ready'; link.media = 'all';
        syncThemeSheet(on);
        finish(true);
    }).catch(error => { if (!done) console.info('[Blue Lemonade] 전체 CSS를 받지 못했어요 — 다음에 열 때 다시 받아요', error?.message || error); finish(false); });
    return promise;
}
