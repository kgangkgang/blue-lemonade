// 1.5.9 TTS 설정 「이 채팅의 캐릭터」 목소리 줄 — 인물표 명단(src/people.js people.list())에서 더할 이름을 고른다. 순수 (시험: tools/tests/tts-roster.mjs)
//   전에는 최근 메시지에 나온 이름만 줄이 생겨서, 프리셋 색 표 · 카드별 색 기억에만 있는 새 인물은 말하기 전까지 목소리 칸이 없었어요.
//   이름은 코드에 없어요 — 모두 인물표에서 받아요. 빼는 것: 나(페르소나) · 이미 줄이 있는 사람(대화 색 줄 · 캐릭터별 목소리 줄 · 메시지에서 찾은 이름).
//   같은 사람의 다른 표기(영문 / 한글)는 한 줄 — 연결표에 있는 표기가 줄 이름, 없으면 인물표의 첫 표기.
const MAX_NAME = 30;

/**
 * @param persons 인물표 명단 [{ name, names }]
 * @param fold    이름 접기 (ui.js foldName)
 * @param taken   이미 다른 줄에 있는 이름(접은 것) Set
 * @param scored  메시지에서 이미 찾은 이름들
 * @param mapped  연결표(char_map)에 있는 이름들
 * @param persona 나(페르소나) 이름
 * @returns 더할 줄 이름들 (명단 차례 그대로)
 */
export function rosterSpeakers(persons, { fold, taken = new Set(), scored = [], mapped = [], persona = '' } = {}) {
    if (typeof fold !== 'function') return [];
    const out = [];
    const used = new Set([...scored].map(fold));
    const me = fold(persona);
    const mappedSet = new Map([...mapped].map(n => [fold(n), n]));
    for (const p of Array.isArray(persons) ? persons : []) {
        const names = (Array.isArray(p?.names) && p.names.length ? p.names : [p?.name]).map(n => String(n ?? '').trim()).filter(n => n && n.length <= MAX_NAME);
        const keys = names.map(fold).filter(Boolean);
        if (!keys.length) continue;
        if ((me && keys.includes(me)) || keys.some(k => taken.has(k) || used.has(k))) continue;
        const hit = keys.find(k => mappedSet.has(k));
        out.push(hit ? mappedSet.get(hit) : names[0]);
        for (const k of keys) used.add(k);
    }
    return out;
}
