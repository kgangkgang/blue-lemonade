// 6.5.4 상태 카드의 고정 값은 모델에 보내지 않고 여기서 바로 한국어로 채운다 (번역 요청 · 크레딧 절약).
//   1) 꼴이 정해진 값: 날짜(2026年10月15日 星期四 · April 2, Tuesday, 2030) · 시각(上午 07:35 · Morning · PM) · 날씨 낱말(晴 · 微风 · Cloudy)만으로 된 값.
//   2) 전에 한 번 번역한 똑같은 값(같은 용어집 · 프롬프트 범위): 매 답마다 되풀이되는 날짜 · 날씨 · 장소. 이 기기 localStorage 에 최근 400개만.
//   번역 대상이 한국어일 때만 쓴다(index.js 가 판단). 재번역은 기억을 쓰지 않고 새 결과로 덮어써서 틀린 값을 고칠 수 있다.
// 카드 키 · 마크업 · 숨긴 값은 display-cards.js 가 그대로 둔다. 여기서는 값 글자만 본다.

import { foldBlank } from '../../blank-fold.js';   // 버그 사냥 7 점자 빈칸 공용 정규화
const WEEK_ZH = { 一: '월', 二: '화', 三: '수', 四: '목', 五: '금', 六: '토', 日: '일', 天: '일' };
const CALENDAR_ZH = { 公历: '양력', 阳历: '양력', 农历: '음력', 阴历: '음력', 新历: '신력', 旧历: '구력', 行政历: '행정력', 帝国历: '제국력', 王国历: '왕국력', 联邦历: '연방력', 星历: '성력', 纪元: '기원', 历: '력' };
const PERIOD_ZH = { 上午: '오전', 下午: '오후', 凌晨: '새벽', 清晨: '이른 아침', 早晨: '아침', 早上: '아침', 中午: '정오', 正午: '정오', 午后: '오후', 傍晚: '해 질 녘', 黄昏: '황혼', 晚上: '저녁', 夜晚: '밤', 夜间: '밤', 夜里: '밤', 深夜: '심야', 午夜: '자정' };
const WEATHER_ZH = {
    晴: '맑음', 晴天: '맑음', 晴朗: '맑음', 晴好: '맑음', 少云: '구름 조금', 多云: '구름 많음', 阴: '흐림', 阴天: '흐림', 微阴: '약간 흐림', 阴沉: '잔뜩 흐림',
    雨: '비', 小雨: '약한 비', 中雨: '비', 大雨: '큰비', 暴雨: '폭우', 阵雨: '소낙비', 雷阵雨: '뇌우', 雷雨: '뇌우', 毛毛雨: '이슬비', 细雨: '가랑비', 小到中雨: '약한 비', 雨夹雪: '진눈깨비',
    雪: '눈', 小雪: '약한 눈', 中雪: '눈', 大雪: '큰눈', 暴雪: '폭설', 冰雹: '우박', 雾: '안개', 大雾: '짙은 안개', 薄雾: '옅은 안개', 晨雾: '아침 안개', 霾: '연무', 雾霾: '연무', 沙尘: '황사',
    风: '바람', 微风: '산들바람', 和风: '산들바람', 清风: '맑은 바람', 大风: '강풍', 狂风: '강풍', 无风: '바람 없음',
    闷热: '무더움', 炎热: '더움', 酷热: '무더위', 温暖: '따뜻함', 暖和: '따뜻함', 凉爽: '선선함', 微凉: '약간 쌀쌀함', 寒冷: '추움', 严寒: '혹한',
    湿润: '습함', 潮湿: '습함', 干燥: '건조함', 恒温: '항온', 室内: '실내', 室外: '실외'
};
const WORDS_EN = {
    morning: '아침', 'early morning': '이른 아침', 'late morning': '늦은 아침', noon: '정오', midday: '한낮', afternoon: '오후', 'late afternoon': '늦은 오후',
    evening: '저녁', 'late evening': '늦은 저녁', dusk: '해 질 녘', sunset: '해 질 녘', twilight: '황혼', dawn: '새벽', sunrise: '해 뜰 녘', night: '밤', 'late night': '늦은 밤', midnight: '자정',
    'pre-dawn': '이른 새벽', predawn: '이른 새벽', 'pre dawn': '이른 새벽',   // 8.0.6 데우스 「Time Window」 칸
    am: '오전', 'a.m.': '오전', pm: '오후', 'p.m.': '오후',
    clear: '맑음', sunny: '맑음', 'partly cloudy': '구름 조금', 'mostly cloudy': '구름 많음', cloudy: '흐림', overcast: '흐림',
    rain: '비', rainy: '비', 'light rain': '약한 비', 'heavy rain': '폭우', drizzle: '이슬비', showers: '소낙비', thunderstorm: '뇌우', storm: '폭풍', stormy: '폭풍',
    snow: '눈', snowy: '눈', 'light snow': '약한 눈', 'heavy snow': '폭설', sleet: '진눈깨비', hail: '우박', fog: '안개', foggy: '안개', mist: '옅은 안개', misty: '옅은 안개', haze: '연무', hazy: '연무',
    wind: '바람', windy: '바람', breeze: '산들바람', breezy: '산들바람', calm: '바람 없음', humid: '습함', dry: '건조함',
    hot: '더움', warm: '따뜻함', mild: '온화함', cool: '선선함', chilly: '쌀쌀함', cold: '추움', freezing: '매우 추움', indoors: '실내', outdoors: '실외'
};
// 1.5.3 「정해진 칸」에서만 읽는 낱말 — 1.5.1 에 더했던 시간대 · 날 · 계절 · 날씨 낱말과 달 이름 하나만.
//   이 낱말들은 사람 이름 · 별명(June · April · Summer · Autumn · Fair · Frost · Rainbow …)과 겹쳐서, 칸 이름이 날짜 · 시간 · 날씨 · 계절일 때만 읽어요(검토 3).
//   칸을 모르면(옛 길) · 이름 칸이면 1.5.0 처럼 모델에 보내요. 미트볼 다리(src/ext-bridge-tr.js)는 정해진 칸 종류를 넘겨요.
const SLOT_WORDS = {
    day: '낮', daytime: '낮', 'mid-morning': '늦은 아침', 'mid-afternoon': '한낮', nightfall: '해 질 녘', 'early evening': '이른 저녁', 'early afternoon': '이른 오후', 'small hours': '새벽', 'wee hours': '새벽',
    today: '오늘', tonight: '오늘 밤', tomorrow: '내일', yesterday: '어제', weekday: '평일', weekdays: '평일', weekend: '주말', weekends: '주말', holiday: '휴일',
    spring: '봄', summer: '여름', autumn: '가을', winter: '겨울', 'early spring': '이른 봄', 'late spring': '늦봄', 'early summer': '초여름', 'midsummer': '한여름', 'late summer': '늦여름', 'early autumn': '초가을', 'late autumn': '늦가을', 'early winter': '초겨울', 'midwinter': '한겨울', 'late winter': '늦겨울',
    'clear skies': '맑음', 'clear sky': '맑음', fair: '맑음', 'sunny intervals': '구름 사이 해', raining: '비', drizzling: '이슬비', shower: '소낙비', 'rain showers': '소낙비', thunderstorms: '뇌우', thunder: '천둥', lightning: '번개', downpour: '폭우', snowing: '눈', blizzard: '눈보라', 'gentle breeze': '산들바람', 'light breeze': '산들바람', 'strong wind': '강풍', 'strong winds': '강풍', gusty: '강풍', muggy: '무더움', crisp: '상쾌함', 'heat wave': '폭염', heatwave: '폭염', smog: '스모그', frost: '서리', frosty: '서리', icy: '얼음', rainbow: '무지개', cloud: '구름', clouds: '구름'
};
const WEEK_EN = { monday: '월', tuesday: '화', wednesday: '수', thursday: '목', friday: '금', saturday: '토', sunday: '일', mon: '월', tue: '화', tues: '화', wed: '수', thu: '목', thur: '목', thurs: '목', fri: '금', sat: '토', sun: '일' };
const MONTH_EN = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
for (const [day, ko] of Object.entries(WEEK_EN)) WORDS_EN[day] = ko + '요일';
// 1.5.1 달 이름 하나만(「April」 · 「Sept」) — 정해진 칸에서만(1.5.3) · 「May」 「Mar」는 날짜 꼴(「May 3」)에서만 읽어요
for (const [month, n] of Object.entries(MONTH_EN)) if (month !== 'may' && month !== 'mar') SLOT_WORDS[month] = `${n}월`;
/** 칸 이름이 사람 이름 칸 — 사전을 안 걸어요(값은 모델로) */
const NAME_FIELD = /name|이름|名|姓|who|partner|lover|spouse|char|person|nick|alias|별명|호칭|인물|人物|角色|npc/i;
/** 칸 이름이 날짜 · 시간 · 날씨 · 계절 칸 — 정해진 칸 낱말까지 읽어요 */
const SLOT_FIELD = /date|time|day|weather|season|clock|period|calendar|날짜|시간|시각|요일|날씨|계절|日期|时间|時間|天气|天氣|季节|季節|时段|星期/i;

const keyOf = (table, word) => Object.prototype.hasOwnProperty.call(table, word) ? table[word] : null;
const PERIODS = Object.keys(PERIOD_ZH).join('|'), CALENDARS = Object.keys(CALENDAR_ZH).sort((a, b) => b.length - a.length).join('|');
const DATE_ZH = new RegExp(`^(?:([A-Za-z][\\w.\\-]*(?:\\s+[A-Za-z][\\w.\\-]*)*)\\s*)?(${CALENDARS})?\\s*(?:(\\d{1,6})\\s*年\\s*)?(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*[日号](?:\\s*[,，、]?\\s*(?:星期|周|礼拜)([一二三四五六日天]))?$`);
const WEEKDAY_ZH = /^(?:星期|周|礼拜)([一二三四五六日天])$/;
const TIME_ZH = new RegExp(`^(${PERIODS})?\\s*(\\d{1,2}\\s*[:：]\\s*\\d{2})\\s*(${PERIODS})?$`);
const SEPARATOR = /([,，、·・\/&+~～]+|\s+-\s+|\s*[–—]\s*)/;

function dateZh(text) {
    const m = text.match(DATE_ZH); if (!m) { const w = text.match(WEEKDAY_ZH); return w ? WEEK_ZH[w[1]] + '요일' : null; }
    const [, prefix, calendar, year, month, day, week] = m;
    return [prefix, calendar && CALENDAR_ZH[calendar], year && `${Number(year)}년`, `${Number(month)}월`, `${Number(day)}일`, week && WEEK_ZH[week] + '요일'].filter(Boolean).join(' ');
}
// 8.0.6 데우스 V3 · 다른 프리셋의 「Exact Time」 시각: 11:42 PM · 7:40 a.m. → 오후 11:42 · 오전 7:40 (숫자는 그대로)
const TIME_EN = /^(\d{1,2})\s*[:：]\s*(\d{2})\s*([AaPp])\.?\s*[Mm]\.?$/;
function timeEn(text) {
    const m = text.match(TIME_EN); if (!m || Number(m[1]) > 12) return null;
    return `${/[Pp]/.test(m[3]) ? '오후' : '오전'} ${m[1]}:${m[2]}`;
}
function timeZh(text) {
    const m = text.match(TIME_ZH); if (!m || (!m[1] && !m[3]) || (m[1] && m[3])) return null;
    return `${PERIOD_ZH[m[1] || m[3]]} ${m[2].replace(/\s+/g, '').replace('：', ':')}`;
}
// April 2, Tuesday, 2030 · Tuesday, April 2, 2030 · April 2, 2030 · 2 April 2030 · April 2
function dateEn(text) {
    const words = text.replace(/(\d+)(?:st|nd|rd|th)\b/gi, '$1').split(/[\s,]+/).filter(Boolean);
    let month = null, day = null, year = null, week = null, era = null;
    for (const word of words) {
        const w = word.toLowerCase().replace(/\.$/, '');
        if (keyOf(ERA_EN, w) && era === null) era = ERA_EN[w];   // 8.0.6 데우스 「Date, Day of week, Year, Era」
        else if (keyOf(MONTH_EN, w) && month === null) month = MONTH_EN[w];
        else if (keyOf(WEEK_EN, w) && week === null) week = WEEK_EN[w];
        else if (/^\d{1,2}$/.test(w) && day === null && Number(w) >= 1 && Number(w) <= 31) day = Number(w);
        else if (/^\d{3,6}$/.test(w) && year === null) year = Number(w);
        else return null;
    }
    if (month === null || day === null) return null;
    return [era, year !== null && `${year}년`, `${month}월`, `${day}일`, week && week + '요일'].filter(Boolean).join(' ');
}
const ERA_EN = { ad: '서기', 'a.d': '서기', ce: '서기', 'c.e': '서기', bc: '기원전', 'b.c': '기원전', bce: '기원전', 'b.c.e': '기원전' };
// 한자 덩어리는 사전의 가장 긴 낱말부터 잘라 읽는다 (恒温晴朗 → 恒温 + 晴朗). 모르는 글자가 하나라도 있으면 null.
function hanWords(run) {
    const out = [];
    for (let at = 0; at < run.length;) {
        let size = Math.min(4, run.length - at);
        while (size > 0 && !keyOf(WEATHER_ZH, run.slice(at, at + size)) && !keyOf(PERIOD_ZH, run.slice(at, at + size))) size--;
        if (!size) return null;
        const word = run.slice(at, at + size); out.push(WEATHER_ZH[word] || PERIOD_ZH[word]); at += size;
    }
    return out.join(' ');
}
const wordOf = (word, slot) => keyOf(WORDS_EN, word) || (slot ? keyOf(SLOT_WORDS, word) : null);
function piece(text, slot = false) {
    const value = foldBlank(text).trim(); if (!value) return '';   // 버그 사냥 7 점자 빈칸(`Light⠀rain`)도 낱말 사이 — 고정 사전에 안 맞아 AI 번역으로 가던 것
    const english = wordOf(value.toLowerCase().replace(/\s+/g, ' '), slot);
    if (english) return english;
    const out = [];
    for (const word of value.split(/\s+/)) {
        if (/^[一-鿿]+$/.test(word)) { const ko = hanWords(word); if (!ko) return null; out.push(ko); continue; }
        const ko = wordOf(word.toLowerCase(), slot); if (!ko) return null; out.push(ko);
    }
    return out.join(' ');
}
function byDictionary(text, slot = false) {
    const parts = text.split(SEPARATOR), out = [];
    for (let i = 0; i < parts.length; i++) {
        if (i % 2) { out.push(parts[i]); continue; }
        const ko = piece(parts[i], slot); if (ko === null) return null; out.push((/^\s/.test(parts[i]) && i ? ' ' : '') + ko + (/\s$/.test(parts[i]) && i < parts.length - 1 ? ' ' : ''));
    }
    const joined = out.join('').trim();
    return joined && /[가-힣]/.test(joined) ? joined : null;
}

/**
 * 꼴이 정해진 카드 값의 한국어 ('' · null = 모델에 보낸다).
 * key: 그 칸 이름(카드 칸 「Weather」 · 「日期」 · 미트볼 다리의 칸 종류 day · time · date · weather · season) — 1.5.3
 *   사람 이름 칸이면 아무것도 안 읽고(모델로) · 날짜 · 시간 · 날씨 · 계절 칸이면 정해진 칸 낱말(달 · 계절 · Day · Fair …)까지 읽어요.
 */
export function ruleValue(text, key = null) {
    const value = String(text ?? '').trim();
    if (!value || value.length > 80 || /[\r\n<>]/.test(value)) return null;
    const field = String(key ?? '');
    if (field && NAME_FIELD.test(field)) return null;
    const slot = !!field && SLOT_FIELD.test(field);
    return dateZh(value) || timeZh(value) || timeEn(value) || dateEn(value) || dayCount(value) || slashDate(value) || byDictionary(value, slot);
}
// 1.5.1 「Day 3」 「Day 12 of 30」 → 3일째 · 12일째 (30일 중) — 「4/1 (Mon)」 「12/24 (Tuesday)」 → 4/1(월) (미트볼 날짜 줄 꼴)
function dayCount(text) {
    const m = text.match(/^Day\s+(\d{1,5})(?:\s+of\s+(\d{1,5}))?$/i);
    return m ? `${m[1]}일째${m[2] ? ` (${m[2]}일 중)` : ''}` : null;
}
function slashDate(text) {
    const m = text.match(/^(\d{1,2})\s*\/\s*(\d{1,2})\s*\(\s*([A-Za-z]{3,9})\.?\s*\)$/);
    const w = m && keyOf(WEEK_EN, m[3].toLowerCase());
    return w ? `${Number(m[1])}/${Number(m[2])}(${w})` : null;
}

// ── 같은 값의 지난 번역 (이 기기만, 최근 LIMIT 개) ──
const STORE = 'llmt-card-values-v1', LIMIT = 400, MAX_TEXT = 400;
const CJK_LEFT = /[぀-ヿ一-鿿]/;
let memory = null;
function load(storage) {
    if (memory) return memory;
    memory = new Map();
    try { const saved = JSON.parse(storage?.getItem(STORE) || '[]'); if (Array.isArray(saved)) for (const row of saved) if (Array.isArray(row) && typeof row[0] === 'string' && typeof row[1] === 'string') memory.set(row[0], row[1]); } catch { /* 기억 없이 번역 */ }
    return memory;
}
function save(storage) { try { storage?.setItem(STORE, JSON.stringify([...memory])); } catch { /* 저장 공간 없음: 이번 화면에서만 기억 */ } }

/** 카드 값 번역기: scope = 프롬프트 · 용어집 요약 (바뀌면 다른 기억), remember = false 면 기억을 읽지 않는다(재번역) — 새 결과는 언제나 적는다 */
export function cardValues({ scope = '', remember = true, storage } = {}) {
    if (storage === undefined) try { storage = globalThis.localStorage; } catch { storage = null; }   // 막힌 저장소: 기억 없이
    const key = text => `${scope}\u0000${text}`;
    return {
        local(text, cardName, field) {   // 1.5.3 칸 이름(field)을 받아 이름 칸 · 정해진 칸을 가려요
            const value = String(text ?? '').trim();
            const rule = ruleValue(value, field); if (rule) return rule;
            if (!remember || value.length > MAX_TEXT) return null;
            const known = load(storage).get(key(value));
            return typeof known === 'string' && known.trim() ? known : null;
        },
        /** learn(원문, 번역) 하나 또는 learn([[원문, 번역], …]) 묶음 — 묶음은 한 번만 저장(카드 하나의 칸 수만큼 400쌍 전체를 다시 쓰지 않게) · 바뀐 것이 없으면 저장하지 않는다 */
        learn(text, translated) {
            const pairs = Array.isArray(text) ? text : [[text, translated]];
            let map = null, changed = false;
            for (const [source, answer] of pairs) {
                const value = String(source ?? '').trim(), result = String(answer ?? '').trim();
                // 덜 옮겨진 값(한자 · 가나가 남음) · 원문 그대로 · 줄바꿈 · 자리표시자는 기억하지 않는다
                if (!value || !result || result === value || value.length > MAX_TEXT || result.length > MAX_TEXT || /[\r\n]|\[\[__/.test(result) || CJK_LEFT.test(result) || ruleValue(value)) continue;
                map ||= load(storage); const k = key(value);
                if (map.get(k) === result) continue;
                map.delete(k); map.set(k, result); changed = true;
            }
            if (!changed) return;
            while (map.size > LIMIT) map.delete(map.keys().next().value);
            save(storage);
        }
    };
}
/** 시험용: 메모리에 읽어 둔 기억을 버린다 (다음 호출이 storage 에서 다시 읽음) */
export function forgetCardValueMemory() { memory = null; }
