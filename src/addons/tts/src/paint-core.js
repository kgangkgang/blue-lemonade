// TTS · 색 없는 대사에 화자 색 (테마 6.2.3) — 순수 도구 (실리태번 모듈 없이 · tools/tests/tts-paint.mjs 가 부른다)
//
// planPaint(quotes, speakers, colorOf) → [{ index, color, name }]
//   quotes   = 화면의 대화문 짝 (차례대로) [{ text, colored }] — text 는 여닫이 안쪽 글, colored = 이미 글자색이 있음(인라인 색 · font · 데우스 맨 색 표기)
//   speakers = 재생기와 같은 화자 (player.dialogueSpeakers — 화면 목록의 대화문, 차례대로) [{ text, color, name, source }]
//   colorOf  = 이름 → '#rrggbb' | null (speakers.colorOfName — 그 채팅에서 그 인물이 쓴 색)
//   짝 맞추기: 화면 대사마다 아직 안 쓴 화자 줄 가운데 글이 같은 첫 줄 (색 있는 대사도 줄을 하나 써서 같은 대사가 여럿일 때 차례가 맞는다)
//   칠하는 줄: 화면에 색이 없고 · 조각에도 색이 없고 · 화자를 색 아닌 길로 알아낸 줄(PAINT_SOURCES: 이름표 'hint' · 대사 분석의 화자 찾기 'analysis')
//              · 그 인물의 색을 앎. 보낸 쪽 이름으로 떨어진 줄('sender' — 화자를 못 찾음)은 칠하지 않는다
// needsSpeakers(quotes, speakers) → 화자를 모르는(보낸 쪽 이름으로 떨어진) 색 없는 대사가 있나 — 그때만 대사 분석을 부른다

export const PAINT_ATTR = 'data-lv-paint';
export const PAINT_SOURCES = new Set(['hint', 'analysis']);

/** 대사 글 비교용 (clickplay.js 의 fold 와 같음): NFC · 꾸밈 글자 · 보이지 않는 글자 빼기 · 빈칸 하나로 · 소문자 */
export const foldText = (s) => String(s || '').normalize('NFC').replace(/[*_~`​-‏﻿]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** 화면 대사 → 화자 줄 번호 (못 찾으면 -1). 차례를 지키며 안 쓴 줄 가운데 글이 같은 첫 줄 */
export function matchQuotes(quotes, speakers) {
    const used = new Set();
    return (quotes || []).map(q => {
        const k = foldText(q?.text);
        if (!k) return -1;
        const i = (speakers || []).findIndex((sp, n) => !used.has(n) && foldText(sp?.text) === k);
        if (i >= 0) used.add(i);
        return i;
    });
}

export function planPaint(quotes, speakers, colorOf) {
    const out = [];
    const match = matchQuotes(quotes, speakers);
    match.forEach((si, qi) => {
        if (si < 0 || quotes[qi].colored) return;
        const sp = speakers[si];
        if (!sp || sp.color || !PAINT_SOURCES.has(sp.source)) return;
        const name = String(sp.name || '').trim();
        if (!name) return;
        let color = null;
        try { color = colorOf(name); } catch { color = null; }
        if (!/^#[0-9a-f]{6}$/.test(String(color || ''))) return;
        out.push({ index: qi, color, name });
    });
    return out;
}

export function needsSpeakers(quotes, speakers) {
    const match = matchQuotes(quotes, speakers);
    return match.some((si, qi) => si >= 0 && !quotes[qi].colored && !speakers[si].color && speakers[si].source === 'sender');
}
