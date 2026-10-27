// 데우스 V3 하늘(8.0.9) — 트래커의 시각 · 날짜 글자를 읽어 해 · 달 자리와 달 모양을 정한다. 모양은 css/30-dem-skin.css 가 아니라 원작 V3 <style> 의 변수
//  (--ox · --oy · --gx: 해/달 · 지평선 빛무리 자리, --orb-m: 달 마스크, --moon-r: 달 기울기)를 요소 인라인 값으로만 덧씌운다.
//  · 원작은 하루를 9칸(새벽 전 · 새벽 · 아침 · 한낮 · 오후 · 해질녘 · 저녁 · 밤 · 깊은 밤)으로 나눠 칸마다 한 자리에 두고, 달은 늘 초승달 하나였다(10-27 사용자 요청).
//  · 여기서는 시각으로 호 위의 자리를 연속으로 잡고(해 6시→19시 · 달 19시→6시, 끝은 지평선 · 가운데는 꼭대기), 날짜의 「일」로 위상 8단계를 돌린다
//    (1일 신월 → 16일 보름 → 30일 다시 신월, 글에 보름달 · 초승달 같은 말이 있으면 그쪽이 먼저). 해/달 가름 · 색 · 하늘은 원작 규칙 그대로.
//  · 스킨을 끄면(syncDemSky(false)) 덧씌운 값을 모두 떼서 원작으로 돌아간다. 설정 창 미리보기(.salty-preview)는 건드리지 않는다.
const SEL = '#chat .mes_text .custom-dem-track[data-t]';
const VARS = ['--ox', '--oy', '--gx', '--orb-m', '--moon-r'];
const RING = 'radial-gradient(circle, #0000 0 6.2px, #000 6.5px)';   // 원작 달 마스크의 둘째 층: 달 둘레 빛무리는 그대로 두는 몫
// 위상 8단계 마스크: 오른쪽이 차오르는 쪽(상현), 왼쪽이 이지러지는 쪽(하현). 원작 초승달 반지름(8.5 · 8.2~9.4px) 그대로.
const PHASES = [
    `radial-gradient(circle 8.5px at calc(50% - 8px) 50%, #0000 0 8.2px, #000 9.4px), ${RING}`,   // 0 신월(실오라기)
    `radial-gradient(circle 8.5px at calc(50% - 6px) 50%, #0000 0 8.2px, #000 9.4px), ${RING}`,   // 1 초승달
    `linear-gradient(90deg, #0000 50%, #000 50%), ${RING}`,                                          // 2 상현(반달)
    `radial-gradient(circle 8.5px at calc(50% + 3px) 50%, #000 0 8.2px, #0000 9.4px), ${RING}`,   // 3 차오르는 달
    'none',                                                                                           // 4 보름달
    `radial-gradient(circle 8.5px at calc(50% - 3px) 50%, #000 0 8.2px, #0000 9.4px), ${RING}`,   // 5 이지러지는 달
    `linear-gradient(90deg, #000 50%, #0000 50%), ${RING}`,                                          // 6 하현(반달)
    `radial-gradient(circle 8.5px at calc(50% + 6px) 50%, #0000 0 8.2px, #000 9.4px), ${RING}`,   // 7 그믐달
];
const WORDS = [[/보름달|만월|full\s*moon/i, 4], [/반달|상현|first\s*quarter|half\s*moon/i, 2], [/하현|last\s*quarter|third\s*quarter/i, 6], [/그믐|waning\s*crescent/i, 7], [/초승달|crescent/i, 1], [/신월|삭월|new\s*moon/i, 0]];
const MONTHS = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?/i;

/** 「3:20 PM」 · 「15:20」 · 「오후 3:20」 · 「3시 20분」 → 0~1439 분. 못 읽으면 null(원작 칸 규칙 그대로) */
export function minutesOf(text) {
    const s = String(text || '').trim();
    const m = s.match(/(오전|오후|a\.?m\.?|p\.?m\.?)?\s*(\d{1,2})\s*[:시]\s*(\d{2})?\s*분?\s*(오전|오후|a\.?m\.?|p\.?m\.?)?/i);
    if (!m) return null;
    let h = Number(m[2]); const min = Number(m[3] || 0);
    const mer = (m[1] || m[4] || '').toLowerCase().replace(/\./g, '');
    if (!Number.isFinite(h) || h > 24 || min > 59) return null;
    if (mer === 'pm' || mer === '오후') { if (h < 12) h += 12; }
    else if (mer === 'am' || mer === '오전') { if (h === 12) h = 0; }
    if (h === 24) h = 0;
    return h * 60 + min;
}
/** 날짜 글에서 「일」 — 「5월 3일」 · 「2026-10-27」 · 「October 27」 · 「27 October」 · 「3rd」. 없으면 null */
export function dayOf(text) {
    const s = String(text || '');
    let m = s.match(/(\d{1,2})\s*일/); if (m) return Number(m[1]);
    m = s.match(/\d{4}[-./]\s*\d{1,2}[-./]\s*(\d{1,2})/); if (m) return Number(m[1]);
    m = s.match(new RegExp(MONTHS.source + '\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b', 'i')); if (m) return Number(m[1]);
    m = s.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MONTHS.source, 'i')); if (m) return Number(m[1]);
    return null;
}
/** 분 → 해/달 자리. 해는 6:00~19:00, 달은 19:00~6:00(원작의 칸 가름과 같음). 호의 양 끝(3% · 97%, 33%) 과 꼭대기(50%, 0%) 는 원작 값 */
export function orbAt(minutes) {
    const sun = minutes >= 360 && minutes < 1140;
    const f = sun ? (minutes - 360) / 780 : ((minutes - 1140 + 1440) % 1440) / 660;
    const x = 3 + 94 * f, y = 33 - 33 * Math.sin(Math.PI * f);
    return { sun, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}
/** 날짜의 「일」 → 위상 0~7 (1일 신월 · 16일 보름). 글에 달 모양 말이 있으면 그쪽 */
export function phaseOf(day, text) {
    for (const [re, idx] of WORDS) if (re.test(text || '')) return idx;
    if (!Number.isFinite(day)) return 1;   // 날짜가 없으면 원작처럼 초승달
    return Math.round((((day - 1) % 30 + 30) % 30) / 30 * 8) % 8;
}

function dress(el) {
    const t = el.getAttribute('data-t') || '';
    const dateText = el.querySelector('.custom-dem-track__date')?.textContent || '';
    const wx = el.getAttribute('data-w') || '';
    const key = `${t}|${dateText}|${wx}`;
    if (el.dataset.blSky === key) return;
    const minutes = minutesOf(t);
    if (minutes === null) { strip(el); return; }
    const o = orbAt(minutes);
    el.style.setProperty('--ox', `${o.x}%`); el.style.setProperty('--oy', `${o.y}%`); el.style.setProperty('--gx', `${o.x}%`);
    if (o.sun) { el.style.removeProperty('--orb-m'); el.style.removeProperty('--moon-r'); }
    else { el.style.setProperty('--orb-m', PHASES[phaseOf(dayOf(dateText), `${dateText} ${wx} ${el.textContent}`)]); el.style.setProperty('--moon-r', '0deg'); }
    el.dataset.blSky = key;
}
function strip(el) { for (const v of VARS) el.style.removeProperty(v); delete el.dataset.blSky; }

let active = false, bound = null, watcher = null, timers = [], quiet = 0, changed = new Set(), dressing = false;
function sweep() { if (!active) return; dressing = true; try { document.querySelectorAll(SEL).forEach(dress); } finally { queueMicrotask(() => { watcher?.takeRecords(); dressing = false; }); } }
function schedule() { timers.forEach(clearTimeout); timers = [setTimeout(sweep, 80), setTimeout(sweep, 800), setTimeout(sweep, 3000)]; }
// 번역 확장은 본문을 갈아 끼울 때 이벤트를 내지 않는다 — 본문이 통째로 바뀐 메시지만 적어 뒀다가 조용해진 뒤(0.4초) 그 메시지만 다시 본다(dem-expressive.js 와 같은 방식)
function onMutations(records) {
    if (dressing) return;
    for (const r of records) { const body = r.target.nodeType === 1 && r.target.classList.contains('mes_text') ? r.target : null; if (body) changed.add(body); }
    if (!changed.size) return;
    clearTimeout(quiet);
    quiet = setTimeout(() => { const bodies = [...changed]; changed = new Set(); dressing = true; try { for (const b of bodies) if (b.isConnected) b.querySelectorAll('.custom-dem-track[data-t]').forEach(dress); } finally { queueMicrotask(() => { watcher?.takeRecords(); dressing = false; }); } }, 400);
}
function bind() {
    if (bound) return;
    const chatBox = document.getElementById('chat');
    if (chatBox && !watcher) { watcher = new MutationObserver(onMutations); watcher.observe(chatBox, { childList: true, subtree: true }); }
    const { eventSource, event_types: t } = SillyTavern.getContext();
    const names = [t.CHAT_CHANGED, t.CHARACTER_MESSAGE_RENDERED, t.USER_MESSAGE_RENDERED, t.MORE_MESSAGES_LOADED, t.MESSAGE_UPDATED, t.MESSAGE_SWIPED, t.MESSAGE_EDITED].filter(Boolean);
    names.forEach(name => eventSource.on(name, schedule));
    bound = { eventSource, names };
}
function unbind() {
    if (!bound) return;
    watcher?.disconnect(); watcher = null; clearTimeout(quiet); changed = new Set();
    bound.names.forEach(name => bound.eventSource.removeListener(name, schedule));
    timers.forEach(clearTimeout); timers = []; bound = null;
}

/** features.js 가 설정이 바뀔 때마다 부른다 — 켜짐/꺼짐이 그대로면 아무것도 안 한다 */
export function syncDemSky(on) {
    if (!!on === active && !!on === !!bound) return;
    active = !!on;
    if (active) { bind(); schedule(); } else { unbind(); document.querySelectorAll('#chat .mes_text .custom-dem-track[data-bl-sky]').forEach(strip); }
}
