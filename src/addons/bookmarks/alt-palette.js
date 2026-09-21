// 북마크 창만 밝게 / 어둡게 (블루 레몬에이드 내장판).
//
// 창의 색은 전부 테마 변수(--salty-*)라, 지금 에이드와 반대 밝기로 보려면 '같은 에이드의 반대쪽 팔레트'로 계산한 변수 묶음이 필요하다.
// 그 계산은 apply.js applyAll 안에 길게 들어 있어 따로 떼어 쓰기 어렵다 → 팔레트를 잠깐 바꿔 applyAll 을 돌려 변수 글을 받아 적고
// 곧바로 되돌린다(한 번의 동기 실행이라 화면에는 그려지지 않는다). 받아 적은 글의 :root 를 북마크 창 선택자로 바꿔 <style> 하나에 둔다.
import { getSettings } from '../../settings.js';
import { applyAll } from '../../apply.js';
import { PALETTES, paletteFamily, paletteVariant } from '../../palettes.js';

const STYLE_ID = 'bl-bm-alt-vars';
let cacheKey = '', busy = false;

/** @param {'auto'|'light'|'dark'} wanted 북마크 설정에서 고른 테마. 돌려주는 값: 창에 붙일 data-bl-alt ('' = 테마 그대로) */
export function syncAltPalette(wanted) {
    const s = getSettings();
    const current = (PALETTES[s.palette] || PALETTES.salt).mode;
    const tag = document.getElementById(STYLE_ID);
    if (!s.enabled || busy || !['light', 'dark'].includes(wanted) || wanted === current) { if (!busy) { tag?.remove(); cacheKey = ''; } return busy ? (tag ? wanted : '') : ''; }
    const other = paletteVariant(paletteFamily(s.palette), wanted);
    if (!PALETTES[other] || other === s.palette) { tag?.remove(); cacheKey = ''; return ''; }
    const source = document.getElementById('salty-vars');
    const key = `${s.palette}>${other}|${source?.textContent.length ?? 0}`;
    if (key === cacheKey && tag) return wanted;
    const original = s.palette;
    let text = '';
    busy = true;
    try {
        s.palette = other; applyAll();
        text = document.getElementById('salty-vars')?.textContent ?? '';
    } finally {
        s.palette = original; applyAll();
        busy = false;
    }
    // :root { … } 묶음만 창 안으로 옮긴다 (body.salty { … } 는 실리태번 자동완성용이라 뺀다)
    const blocks = [...text.matchAll(/:root\s*\{([^}]*)\}/g)].map(hit => hit[1]).join('\n');
    if (!blocks.trim()) return '';
    const style = tag ?? Object.assign(document.createElement('style'), { id: STYLE_ID });
    style.textContent = `.cg-root[data-bl-alt="${wanted}"] {\n${blocks}\n}`;
    if (!tag) document.head.append(style);
    cacheKey = `${s.palette}>${other}|${document.getElementById('salty-vars')?.textContent.length ?? 0}`;
    return wanted;
}
