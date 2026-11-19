// 버그 사냥 6 장소 이름 앞 표시 기호(@ · # · ＠ · ＃) 떼기 — 화면 글만(그 확장 자료 · 저장 · 프롬프트는 그대로) · 스위치 annex(src/mb-switch.js)와 같이 꺼져요.
//   모델이 「loc: @Lobby」 처럼 적으면 원작은 그대로 장소 이름 「@Lobby」 로 써요(허브 지시-1119/지도-골뱅이 보고). 1.8.3 은 띠 위치 칩 · 펼친 위치 줄 · 지도만 뗐고,
//   상태 칸 위치 타일 · 「갈 곳」 칩 · 검색 결과 · 알림 · 하루 정리 · 기록 줄 · 답 아래 변동 칩(「📍 @Lobby」 · 「🗺️ 새 장소: @Lobby」)에는 남았어요.
//   SNS 아이디(「@이름」)는 장소 표시(📍 · 🗺️ 새 장소 · 발견 · 위치 아이콘 · 장소 칸) 바로 뒤가 아니면 손대지 않아요 — 기호만 떼고 글은 그대로예요.
//   쓰는 곳: src/mb-map-floors.js(그 확장 창 · 띠 · 알림 — 지도 모듈 DOM 감시자) · src/ext-bridge-tr.js(답 아래 변동 칩 — 메시지 꾸미기)
//   시험: tools/tests/mb-map-floors.mjs(장소 기호 칸)
const MARK = '[@＠#＃]';
const SP = '[\\s\\u2800]';   // 띄어쓰기 · 점자 빈칸(U+2800 — 일부 프리셋이 띄어쓰기 대신 써요)
const LEAD = new RegExp(`^(${SP}*)${MARK}+${SP}*(?=[^\\s\\u2800])`, 'u');
const ONLY = new RegExp(`^${SP}*${MARK}+${SP}*$`, 'u');
const MARKS = new RegExp(`${MARK}+`, 'gu');
const PIN_SRC = `(📍|🗺\\uFE0F?${SP}*(?:새 장소|발견)${SP}*:)(${SP}*)${MARK}+(?=[^\\s\\u2800@＠#＃])`;
const PIN = new RegExp(PIN_SRC, 'gu'), PIN1 = new RegExp(PIN_SRC, 'u');
const SKIP = /^(TEXTAREA|SCRIPT|STYLE|INPUT|SELECT|OPTION)$/;   // 고치는 칸(글을 바꾸면 그 칸 값이 바뀌어 저장될 수 있어요)

/** 장소 칩 · 기록 글: 「📍 @Lobby」 → 「📍 Lobby」 · 「🗺️ 새 장소: #Lobby」 → 「🗺️ 새 장소: Lobby」(그 밖의 @ 는 그대로) */
export const pinText = s => String(s ?? '').replace(PIN, '$1$2');
export const hasPin = s => PIN1.test(String(s ?? ''));
/** 장소 이름 앞 기호만(이름 칸 · 카드 머리) — 기호뿐이면 그대로 */
export const leadText = s => String(s ?? '').replace(LEAD, '$1');

const firstText = el => {
    for (const c of el?.childNodes || []) {
        if (c.nodeType === 3) { if (String(c.nodeValue || '').trim()) return c; continue; }
        if (c.nodeType === 1) { const r = firstText(c); if (r) return r; }
    }
    return null;
};
/** 요소 안 첫 글 조각 앞의 기호를 떼요 — 검색 칠하기(<mark>)로 「@」 만 따로 떨어진 조각이면 뒤에 글이 있을 때만 그 기호를 지워요 → 뗐나 */
export function dropLead(el) {
    const t = firstText(el); if (!t) return false;
    const v = String(t.nodeValue);
    if (ONLY.test(v)) {
        if (!String(el.textContent || '').replace(MARKS, '').trim()) return false;   // 기호뿐인 이름은 그대로
        t.nodeValue = v.replace(MARKS, ''); return true;
    }
    const u = v.replace(LEAD, '$1');
    if (u === v) return false;
    t.nodeValue = u; return true;
}
/** 버그 사냥 6 점자 빈칸(U+2800)을 보통 띄어쓰기로(화면 글만) — 띄어쓰기 대신 점자 빈칸을 쓰는 프리셋으로 받은 답이면 그 확장 자료(장소 · 아이템 · 칩 글)에도 그대로 들어가,
 *  그 확장 글꼴(테마 UI 글꼴)에는 이 글자가 없어 넓은 대체 글꼴로 그려져 칩 낱말 사이가 크게 벌어졌어요(11-19 사용자 사진 「낱말  사이  벌어짐」 · 1.7.8 도 같음). 스위치 blank */
const BLANK = /⠀/g;
export const blankText = s => String(s ?? '').replace(BLANK, ' ');
/** root 안 글 조각: 「📍 @…」 · 「🗺️ 새 장소: @…」 꼴(pin) · 점자 빈칸(blank) → 바꾼 수(📍 · 🗺 · 점자 빈칸이 없으면 글을 훑지 않아요) */
export function pinNodes(root, { pin = true, blank = false } = {}) {
    const all = String(root?.textContent || '');
    const wantBlank = blank && all.includes('⠀'), wantPin = pin && (all.includes('📍') || all.includes('🗺')) && hasPin(all);
    if (!wantBlank && !wantPin) return 0;
    const fix = v => { let u = wantBlank ? blankText(v) : v; if (wantPin) u = pinText(u); return u; };
    let n = 0;
    const walk = node => {
        for (const c of node?.childNodes || []) {
            if (c.nodeType === 3) { const v = String(c.nodeValue || ''), u = fix(v); if (u !== v) { c.nodeValue = u; n++; } }
            else if (c.nodeType === 1 && !SKIP.test(c.tagName) && !c.isContentEditable && c.getAttribute?.('contenteditable') == null) walk(c);
        }
    };
    if (root?.nodeType === 1 && (SKIP.test(root.tagName) || root.closest?.('textarea, [contenteditable]'))) return 0;
    walk(root);
    return n;
}
