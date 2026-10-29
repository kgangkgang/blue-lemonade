// 6.9.7 스와이프 고르기 창 번역의 시작 자리 — 창을 여는 단추(스와이프 수 · 기록 단추)를 누를 때 본 모듈(swipe-picker-translation.js)을 받아 창 찾기를 맡긴다.
// 본 모듈(글 다루기 · 번역 기록 읽기, 둘이 합쳐 20KB 남짓)은 첫 화면에 쓰이지 않으니 시작할 때 싣지 않는다. 누름 판정 · 테마 켜짐 확인은 본 모듈과 같다.
// 폰은 스와이프 수를 길게 누르면 열리고(실리태번 addLongPressEvent) PC 는 click 에 열린다 — 누르기 시작(pointerdown)에 받기 시작하니 창이 붙기 전에 대개 실린다.
import { getSettings } from './settings.js';
import { themeEnabled } from './usage-mode.js';

const OPENERS = '.swipes-counter.swipe-picker-enabled, .mes_swipe_picker';   // swipe-picker-translation.js 와 같아야 한다 (tools/tests/boot-graph.mjs)
let loader = () => import('./swipe-picker-translation.js');
let loading = null, started = false;
const load = () => (loading ||= loader().catch(error => { loading = null; throw error; }));

export function startSwipePickerTranslation() {
    if (started) return;
    started = true;
    const kick = event => {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest(OPENERS)) return;
        if (event.type === 'keydown' && event.key !== ' ') return;
        try { if (!themeEnabled(getSettings())) return; } catch { return; }
        load().then(m => m.lookForPicker()).catch(error => console.warn('[Blue Lemonade] 스와이프 고르기 번역을 불러오지 못했어요', error));
    };
    for (const type of ['pointerdown', 'click', 'keydown']) document.addEventListener(type, kick, { capture: true, passive: true });
}

/** 시험용 — 본 모듈 대신 쓸 것 */
export const _forTest = { looked: 0, setLoader(fn) { loader = fn; loading = null; } };
