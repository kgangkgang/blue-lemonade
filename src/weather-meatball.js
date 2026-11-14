// 날씨 「트래커 따라」 × 미트볼 상태창 (1.4.x) — 그 확장 달력의 오늘 날씨(calendar.weather)를 날씨 효과의 소스로 써요.
//   그 확장은 답 끝 상태 줄(<meatball>)을 본문에서 떼어 보관해서, 본문 · 데우스 트래커를 보던 「트래커 따라」에는 날씨가 안 보였어요(채팅은 비인데 화면은 맑음).
//   · 읽기: 그 확장이 등록한 매크로 {{ss::weather}}(옛 실리는 {{ss_weather}}) — 그 확장의 코드 · 저장값을 고치지 않고 화면에 보이는 값 그대로 받아요.
//   · 달력이 꺼진 채팅(chatMetadata.statussim.mods.calendar === false) · 이 채팅에서 끈 상태창 · 확장이 없거나 꺼짐 → null(예전 소스 그대로).
//   · 언제 읽나: weather.js 가 사건(답 · 스와이프 · 채팅 바꾸기 · 그 확장 화면에서 누름 · 머리 띠 바뀜) 뒤 한 번 — 프레임마다 읽지 않아요.
//   화면 없이 도는 순수 부분이에요(tools/tests/weather-meatball.mjs 가 그대로 불러요).
export const MEATBALL_MODULE = 'statussim';

/** 그 확장 날씨 표(engine.js WEATHER · skeleton_en.js)의 모든 값 + 자주 쓰는 자유 글 → 테마 날씨 종류. 빈 배열 = 아는 말인데 그릴 것 없음(흐림 · 구름 → 끔) */
export const MEATBALL_WEATHER = Object.freeze([
    // 그 확장 2.7.2 표 (봄 · 여름 · 가을 · 겨울) — 한국어 · 영어 저장 둘 다 · 2.7.9 · 2.7.11 · 2.7.15 · 2.7.17 도 표 · 매크로({{ss::weather}} · {{ss_weather}}) · 달력 칸이 같아요(11-14 원작 사본 대조)
    [['맑음', 'clear'], ['sun']],
    [['구름', 'cloudy'], []],
    [['비', 'rain'], ['rain']],
    [['안개', 'fog'], ['fog']],
    [['꽃바람', 'blossom breeze'], ['petal', 'breeze']],
    [['무더위', 'heat wave'], ['sun']],
    [['소나기', 'shower'], ['rain']],
    [['폭풍', 'storm'], ['rain', 'breeze']],
    [['쌀쌀함', 'chilly'], ['breeze']],
    [['흐림', 'overcast'], []],
    [['눈', 'snow'], ['snow']],
    [['한파', 'cold snap'], []],
    [['눈보라', 'blizzard'], ['snow', 'breeze']],
    [['폭우', 'heavy rain'], ['rain']],   // 이벤트 카드 「궂은 날씨」(weather: 폭우)
    // 상태창 글 판정(detectWeatherAll)과 달리 읽어야 하는 자유 글만 — 나머지(이슬비 · 장대비 · 안개비 · 여우비 · 함박눈 · 바람 · 화창 · 황사 …)는 그 판정이 그대로 읽어요
    [['진눈깨비', 'sleet'], ['snow', 'rain']],
    [['천둥', '천둥번개', '번개', 'lightning'], ['rain']],
]);
// 표에 없고 효과 말도 없는데 「날씨가 조용하다」는 말 — 끔으로 알아들어요(모르는 글은 지금 값을 둬요)
const CALM = /구름|흐[림린리]|한파|추위|추운|쌀쌀|무더|더위|더운|덥|후텁|습함|습한|건조|포근|따뜻|선선|시원|잔잔|고요|cloud|overcast|gloom|cold|chill|frost|freez|heat|hot|humid|muggy|dry|mild|warm|cool|calm|still/i;
const NIGHT_TIME = /밤|심야|자정|한밤|night|midnight/i;
const DUSK_TIME = /저녁|새벽|해\s*질|노을|황혼|evening|dawn|dusk|twilight|sunset|sunrise/i;

/** 비교용 꼴: 그림 글자 · 변형 선택자 · 앞뒤 기호를 떼고 소문자 · 빈칸 하나로 */
export function weatherKey(text) {
    return String(text ?? '')
        .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}]/gu, ' ')
        .replace(/[()[\]{}「」『』<>!?.,·~*_|:;"'`]+/g, ' ')
        .replace(/\s+/g, ' ').trim().toLowerCase();
}
const TABLE = new Map();
for (const [words, modes] of MEATBALL_WEATHER) for (const word of words) if (!TABLE.has(weatherKey(word))) TABLE.set(weatherKey(word), modes);

/**
 * 그 확장 날씨 글 → { known, modes, all, warm } (detectWeatherAll 과 같은 꼴 + known).
 * known=false 면 모르는 글이에요 — 부르는 쪽이 지금 값을 둬요(효과를 끄지 않음).
 * time: 그 확장의 시간대(밤 · 심야 → 맑은 하늘은 햇살 대신 별 · 저녁 · 새벽 → 따뜻한 빛).
 * detect: 표에 없는 자유 글을 읽는 판정(weather.js detectWeatherAll — 서로 불러오지 않게 받아 써요).
 */
export function meatballWeatherModes(text, time = '', detect = null) {
    const key = weatherKey(text);
    if (!key) return { known: false, modes: [], all: [], warm: false };
    let all = TABLE.get(key);
    let warm = false;
    if (all) all = [...all];
    else {
        // 표에 없는 자유 글: 상태창 글과 같은 판정(비 · 눈 · 안개 · 햇살 · 별 · 바람 …)
        const found = typeof detect === 'function' ? detect(String(text)) : null;
        if (found?.all?.length) { all = [...found.all]; warm = found.warm; }
        else if (CALM.test(key)) all = [];
        else return { known: false, modes: [], all: [], warm: false };
    }
    const night = NIGHT_TIME.test(String(time ?? '')), dusk = DUSK_TIME.test(String(time ?? ''));
    if (night && all.includes('sun')) {
        all = all.filter(mode => mode !== 'sun');
        if (!all.includes('rain') && !all.includes('snow') && !all.includes('star')) all.unshift('star');
    }
    if (!night && dusk && all.includes('sun')) warm = true;
    all = [...new Set(all)];
    return { known: true, modes: all.slice(0, 2), all, warm };
}

/** 매크로 한 번 — 못 풀면(확장이 없거나 꺼짐) null */
function macro(ctx, names) {
    if (typeof ctx?.substituteParams !== 'function') return null;
    for (const name of names) {
        let value;
        try { value = ctx.substituteParams(`{{${name}}}`); } catch { continue; }
        if (typeof value !== 'string' || value.includes(`{{${name}}}`) || value.includes('{{')) continue;
        return value.trim();
    }
    return null;
}

/**
 * 지금 채팅의 그 확장 날씨 → { text, time } · 없으면 null.
 * null: 확장이 없음 · 꺼짐 · 이 채팅에 상태창이 없음 · 이 채팅에서 끔 · 달력 꺼짐 · 날씨가 비어 있음.
 */
export function readMeatballWeather(ctx) {
    const set = ctx?.extensionSettings?.[MEATBALL_MODULE];
    if (!set || typeof set !== 'object' || set.enabled === false) return null;
    const meta = ctx.chatMetadata?.[MEATBALL_MODULE];
    if (!meta || typeof meta !== 'object' || meta.off || meta.mods?.calendar === false) return null;
    const text = macro(ctx, ['ss::weather', 'ss_weather']);
    if (!text) return null;
    return { text, time: macro(ctx, ['ss::time', 'ss_time']) || '' };
}
