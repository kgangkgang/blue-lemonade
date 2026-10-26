// 8.0.6 데우스 V3 · 레모나 시간 상태창의 하늘 장면은 data-t(시각) · data-w(날씨)를 영어 낱말로만 읽는다
//   ([data-t*="night" i] · [data-t^="11:"][data-t*="pm" i] · [data-w*="rain" i] …). 시각을 「오후 11:42」로 옮기면 하늘이 비었다.
//   화면 서식(정규식 뒤)에서 두 속성에만 영어 꼴을 넣어 준다 — 보이는 글자(시각 · 날씨 칸)는 번역 그대로.
//   실리태번 모듈을 import 하지 않아요 (node 시험: tools/tests/translator-preset-compat.mjs).
const PERIOD = [['이른 새벽', 'pre-dawn'], ['해 뜰 녘', 'dawn'], ['새벽', 'dawn'], ['이른 아침', 'morning'], ['늦은 아침', 'morning'], ['아침', 'morning'], ['정오', 'noon'], ['한낮', 'noon'],
    ['늦은 오후', 'afternoon'], ['오후', 'afternoon'], ['해 질 녘', 'dusk'], ['황혼', 'dusk'], ['늦은 저녁', 'evening'], ['저녁', 'evening'], ['늦은 밤', 'late night'], ['심야', 'late night'], ['자정', 'midnight'], ['밤', 'night']];
const AM = new Set(['오전', '새벽', '아침']), PM = new Set(['오후', '저녁', '밤']);
const WEATHER = [['뇌우', 'thunderstorm'], ['폭풍', 'storm'], ['이슬비', 'drizzle'], ['가랑비', 'drizzle'], ['소나기', 'shower'], ['소낙비', 'shower'], ['폭우', 'rain'], ['비', 'rain'],
    ['진눈깨비', 'sleet'], ['우박', 'hail'], ['폭설', 'snow'], ['눈', 'snow'], ['옅은 안개', 'mist'], ['안개', 'fog'], ['연무', 'haze'], ['황사', 'dust'], ['흐림', 'cloud'], ['구름', 'cloud'],
    ['강풍', 'wind'], ['산들바람', 'breeze'], ['바람', 'wind'], ['맑음', 'clear']];

/** 「오후 11:42」 · 「11:42 오후」 · 「밤」 → 「11:42 PM」 · 「night」. 한국어 시각이 아니면 null */
export function skyTime(value) {
    const v = String(value ?? '').trim();
    if (!/[가-힣]/.test(v)) return null;
    let word = null, hour = null, min = null, m;
    if ((m = /^(오전|오후|새벽|아침|저녁|밤)\s*(\d{1,2})\s*[:：]\s*(\d{2})$/.exec(v))) [, word, hour, min] = m;
    else if ((m = /^(\d{1,2})\s*[:：]\s*(\d{2})\s*(오전|오후)$/.exec(v))) [, hour, min, word] = m;
    if (word) {
        const h = Number(hour);
        if (h > 23) return null;
        if (h > 12) return `${hour}:${min}`;
        return AM.has(word) ? `${hour}:${min} AM` : PM.has(word) ? `${hour}:${min} PM` : null;
    }
    const period = PERIOD.find(([ko]) => v === ko);
    return period ? period[1] : null;
}
/** 날씨 글자 속 한국어 날씨 낱말의 영어 (없으면 '') */
export function skyWeather(value) {
    const v = String(value ?? ''), found = [];
    let rest = v;
    for (const [ko, en] of WEATHER) if (rest.includes(ko)) { found.push(en); rest = rest.split(ko).join(' '); }
    return [...new Set(found)].join(' ');
}
/** 정규식이 만든 HTML 의 dem-track 태그에서 data-t · data-w 만 고친다. 고칠 게 없으면 같은 글 */
export function skyAttrs(html) {
    const text = String(html ?? '');
    if (!text.includes('data-t="') || !/dem-track/.test(text)) return text;
    return text.replace(/<div\b[^>]*\bclass="(?:custom-)?dem-track"[^>]*>/g, tag => tag
        .replace(/\sdata-t="([^"]*)"/, (m, value) => { const en = skyTime(value); return en ? ` data-t="${en}"` : m; })
        .replace(/\sdata-w="([^"]*)"/, (m, value) => { const en = skyWeather(value); return en && !value.includes(en) ? ` data-w="${value} ${en}"` : m; }));
}
