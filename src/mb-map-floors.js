// 1.6.8 미트볼 지도 「층별 보기」 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   장소 설명 · 이름에 층(「7F」 · 「B2」 · 「3층」 · 「지하 1층」 · 「2nd floor」 · 「5階」)이 적힌 곳이 두 층 넘게 모이면, 그 확장이 그린 지도 SVG 를
//   「건물 단면」 으로 다시 놓아요: 층마다 가로 띠(위가 높은 층 · 아래가 지하) · 띠 옆 층 이름표 · 꺾인 선(같은 층은 복도 · 이웃 층은 계단 · 먼 층은 승강기 줄).
//   층이 없는 장소: 이름 · 종류가 하늘 쪽 세계(천국 · 천계 등)면 건물 위, 땅 밑 세계(지옥 · 명계 등)면 건물 아래, 나머지는 건물 옆 바깥(땅 높이)에 둬요.
//   층 정보가 없는 지도는 손대지 않아요(그 확장 그림 그대로). 그 확장의 파일 · 자료(장소 좌표 포함)는 안 고쳐요 — 그려진 SVG 의 점 묶음을 옮기고 선만 바꿔 그려요.
//   끌기 · 확대 · 구역 탭 · 지금 위치 강조는 그 확장 것을 그대로 써요(그 확장은 viewBox 만 바꿔요). 「현재 위치로」 단추만 이 배치의 자리로 가게 받아 줘요.
//   켜고 끄기: 테마 설정 chat.mbMapFloors(기본 켬) → body[data-bl-mb-floors] · 「원작 그대로 보기」 를 켜면 안 해요. 시험: tools/tests/mb-map-floors.mjs
import { watchDom } from './dom-watch.js';
import { mbFit, onMbOff } from './mb-switch-core.js';
import { dropLead, pinNodes } from './mb-place-mark.js';   // 버그 사냥 6 장소 이름 앞 기호 — 띠 · 지도 밖(상태 칸 · 갈 곳 · 검색 · 알림 · 기록)도
import { foldBlank, squashBlank, trimEdge, SP } from './blank-fold.js';   // 버그 사냥 7 점자 빈칸 공용 정규화
import { mbImport } from './mb-util.js';   // 1.9.2 미트볼 폴더 찾기 공용

export const FLOOR_ATTR = 'data-bl-mb-floors';
const SVG_NS = 'http://www.w3.org/2000/svg';
// 배치 단위(그 확장 지도 좌표와 같은 눈금 — 장소 0~100 · 이름 글자 3.2)
export const ROW_H = 14;     // 층 띠 높이(두 줄 이름표가 들어가게)
const DOT_Y = 9.5;           // 띠 위끝에서 점까지(이름 글자가 점 위 4.4 에 와요 · 두 줄이면 한 줄 더 위)
const SLOT_W = 21;           // 방 한 칸 너비
const OUT_W = 17;            // 바깥 장소 한 칸 너비(1층 줄 한 줄에 다 두려고 좁게 · 이름표는 두 줄로 접어요)
const LINE_H = 3.4;          // 이름표 두 줄 사이
const TAG_W = 9;             // 층 이름표 칸
const LANE = 1.3;            // 같은 길로 가는 선끼리 벌리는 폭
const CORRIDOR = 4.2;        // 점 아래 복도 선
export const RESERVE = 0.22; // 처음 보기 칸 오른쪽에 비워 두는 몫 — 칸 너비에 대한 비율(그 확장의 확대 단추 줄 ≈ 폰 칸의 17%)
const ROOM_MAX = 2.4;        // 칸 너비를 채우려고 방 칸을 넓힐 때 상한(기본 칸의 배수)
const GH_STEP = 19;          // 1.7.5 아직 안 가 본 곳 줄 사이(이름표 두 줄 + 점 밑 「아직 안 가 본 곳」 글이 윗줄과 안 겹치게)
const GH_SLOT = 24;          // 아직 안 가 본 곳 줄의 한 칸(「<이름>의 집」 이 한 줄에 들도록 방 칸보다 조금 넓게)
const GH_CAP0 = 4;           // 아직 안 가 본 곳 한 줄에 적어도 몇 곳
const GH_SLOT_MAX = 34;      // 1.7.8 한 칸을 이름 폭만큼 넓힐 때 상한(이보다 긴 이름은 두 줄로 접어요)
/** 1.7.8 안 가 본 곳 줄의 칸 너비 · 줄 사이 — 그 줄 이름이 한 줄에 들도록 칸을 넓히고(사용자 폰: 다섯 글자 넘는 「<이름>의 / 집」 만 꺾임), 그래도 두 줄로 접히는 이름이 있으면 줄 사이를 한 줄만큼 더 벌려요
 *  (둘째 줄의 두 줄 이름표가 윗줄 「아직 안 가 본 곳」 글에 붙어 보였어요) */
function ghostGrid(labels) {
    const slot = r1(Math.min(GH_SLOT_MAX, Math.max(GH_SLOT, ...labels.map(l => textW(labelOf(l)) + 2.5))));
    const tall = labels.some(l => wrapLabel(l, slot - 1.5).length > 1);
    return { slot, step: GH_STEP + (tall ? LINE_H : 0) };
}
const GH_TAG_W = 18;         // 「아직 안 가 본 곳」 글 폭(글자 2.5)
export const GH_TAG = '아직 안 가 본 곳';

// ── 층 읽기 ─────────────────────────────────────────────
const B = '(?<![\\p{L}\\p{N}])';   // 앞이 글자 · 숫자가 아님
const E = '(?![\\p{L}\\p{N}])';    // 뒤가 글자 · 숫자가 아님
const FLOOR_RULES = [
    [new RegExp(`${B}B\\s?(\\d{1,2})(?:F|층|階)?${E}`, 'gu'), n => -n],
    [/(?:지하|地下)\s?(\d{1,2})\s?(?:층|階|F)/gu, n => -n],
    [/basement\s*(?:level\s*)?(\d{1,2})/giu, n => -n],
    [/(\d{1,2})(?:st|nd|rd|th)\s+basement/giu, n => -n],
    [/(?:지하층|basement)/giu, () => -1],
    [new RegExp(`${B}(\\d{1,3})\\s?F${E}`, 'gu'), n => n, (s, m) => !tempAt(s, m)],
    [/(\d{1,3})(?:st|nd|rd|th)[\s-]+floor/giu, n => n],
    [/\bfloor\s+(\d{1,3})\b/giu, n => n],
    [/ground[\s-]floor/giu, () => 1],
    [/(\d{1,3})\s?(?:층|階)/gu, n => n],
];
// 버그 사냥 9b: 「75F」 꼴은 화씨 온도이기도 해요(장소 설명의 「a warm 75F afternoon」 이 75층 방이 됐어요). 층으로 안 읽는 때:
//   ① 바로 곁(앞뒤 12자)에 온도 표시(° · ℉ · degrees · temperature · 화씨 · 기온 · 온도)가 있거나 · 바로 뒤가 「/24C」 꼴
//   ② 30 넘는 수인데 곁(앞뒤 24자)에 날씨 낱말(warm · sunny · humid · 날씨 · 더운 …)이 있어요 — 낮은 층(「Warm cafe on 3F」)은 그대로 층이에요
const TEMP_MARK = /°|℉|℃|\bdeg(?:rees?)?\b|\btemp(?:erature)?s?\b|fahrenheit|celsius|화씨|섭씨|기온|온도/iu;
const WEATHER = /\b(?:warm|hot|cold|chilly|humid|muggy|sunny|cloudy|rainy|snowy|breez[ey]|weather|heat(?:wave)?|shade)\b|날씨|더운|덥|추운|춥|따뜻|쌀쌀|무더|습한|그늘/iu;   // 「open all day」 같은 가게 설명에 걸리지 않게 때 낱말은 안 봐요
function tempAt(s, m) {
    const at = m.index, end = at + m[0].length, near = n => s.slice(Math.max(0, at - n), end + n);
    if (TEMP_MARK.test(near(12)) || /^\s*\/\s*-?\d{1,3}\s*°?\s*C(?![\p{L}\p{N}])/u.test(s.slice(end))) return true;
    return Number(m[1]) > 30 && WEATHER.test(near(24));
}
/** 글 한 줄에서 층 하나(1 이상 = 지상 · −1 이하 = 지하 · 없으면 null). 여럿이면 글에서 가장 먼저 나온 것 */
export function floorIn(text) {
    const s = foldBlank(text); if (!s) return null;   // 버그 사냥 7 점자 빈칸(`3rd⠀floor` · `지하⠀1층`)도 빈칸 — 층을 못 읽거나 지하 1층이 1층이 됐어요
    let best = null;
    for (const [re, to, keep] of FLOOR_RULES) {
        re.lastIndex = 0; let m;
        while ((m = re.exec(s))) {
            const raw = m[1] === undefined ? 1 : Number(m[1]);
            const f = to(raw);
            if (!Number.isFinite(f) || f === 0 || Math.abs(f) > 200) continue;
            if (keep && !keep(s, m)) continue;
            if (!best || m.index < best.at) best = { at: m.index, f };
            break;
        }
    }
    return best ? best.f : null;
}
/** 장소 하나의 층: 이름 → 설명 → 종류 차례(번역 보기 글이 있으면 그것도) */
export function floorOf(p, tr = null) {
    for (const k of ['name', 'desc', 'kind']) {
        const f = floorIn(p?.[k]); if (f !== null) return f;
        if (tr) { const t = tr(p?.[k]); if (t && t !== p?.[k]) { const g = floorIn(t); if (g !== null) return g; } }
    }
    return null;
}
// 층이 없는 장소의 높낮이: 이름 · 종류에 하늘 쪽 · 땅 밑 세계 낱말이 있을 때만(설명은 「천국 · 지옥 과자를 파는 가게」 처럼 섞여서 안 봐요)
const ABOVE = /heaven|celestial|paradise|empyrean|sky\s*(?:realm|kingdom|palace|city|island)|천국|천계|천상|하늘\s*나라|天国|天界|天上|極楽/iu;
const BELOW = /(?<![\p{L}])hells?(?![\p{L}])|underworld|netherworld|abyss|inferno|hades|지옥|명계|마계|저승|지하\s*세계|地獄|冥界|魔界|奈落/iu;
export function zoneOf(p, tr = null) {
    const texts = [p?.name, p?.kind]; if (tr) texts.push(tr(p?.name), tr(p?.kind));
    const s = texts.filter(Boolean).join(' ');
    if (BELOW.test(s)) return 'below';
    if (ABOVE.test(s)) return 'above';
    return 'out';
}

// ── 같은 곳 · 건물 이름 판정(1.7.0 · 그림만 · 자료는 안 바꿔요) ─────────────────────
// 조직 꼬리말: 「부 · 팀 · 과 · 국 · 실 · 처」 · dept/department/team/division/section/bureau/office · 部/課/室/局 — 이것만 떼고 비교해요(방 · 홀 같은 말은 안 떼요 · 다른 방을 합치지 않게)
const ORG_EN = /^(?:dept|department|team|division|section|bureau|office)$/;
const ORG_KO = /[부팀과국실처部課室局]$/u;
// 버그 사냥 10: 번호(「IT 1」 · 「Room 101」 · 「회의실 2」) · 그림 글자(「카페 🍰」)도 낱말로 남겨요 — 떼면 번호만 다른 방이 한 점으로 합쳐졌어요(층 표기만 떼요)
const wordMemo = new Map();   // 같은 이름을 여러 번 견줘요(층 규칙 정규식이 낱말마다 돌아서) — 배치 한 번 안에서 되풀이를 줄여요
const words = (s, keepCase = false) => { const k = (keepCase ? '1' : '0') + String(s ?? ''); let r = wordMemo.get(k); if (!r) { if (wordMemo.size > 4000) wordMemo.clear(); wordMemo.set(k, r = wordsOf(s, keepCase)); } return r.slice(); };
const wordsOf = (s, keepCase) => { const t = String(s ?? '').replace(/\([^)]*\)|（[^）]*）/g, ' '); return (keepCase ? t : t.toLowerCase()).split(/[^\p{L}\p{N}\p{Extended_Pictographic}]+/u).filter(Boolean).filter(w => floorIn(w.toUpperCase()) === null); };
/** 이름의 비교 열쇠: 괄호 · 층 표기 · 조직 꼬리말을 뗀 낱말들 */
const MODIFIER = /^(?:main|central|front|grand|메인|중앙|정문)$/u;   // 같은 곳을 꾸미는 말(「메인 로비」 ↔ 「1층 로비」)
export function placeKey(name, drop = null, keepCase = false) {
    let ws = words(labelOf(name), keepCase);
    if (drop) { ws = ws.filter(w => !drop.has(w.toLowerCase())); while (ws.length > 1 && MODIFIER.test(ws[0].toLowerCase())) ws = ws.slice(1); }
    while (ws.length > 1 && ORG_EN.test(ws[ws.length - 1].toLowerCase())) ws = ws.slice(0, -1);
    if (ws.length) { const last = ws[ws.length - 1]; if ([...last].length >= 3 && ORG_KO.test(last)) ws[ws.length - 1] = [...last].slice(0, -1).join(''); }
    return ws;
}
const tailOf = n => { const t = String(n ?? '').trim(), h = labelOf(t); return h === t ? [] : words(t.slice(t.indexOf(h) + h.length)); };
/** 두 이름이 같은 곳인가(좁게): 열쇠가 같거나 · 한쪽이 다른 쪽 낱말 머리글자(IT ↔ Information Technology) */
export function sameName(a, b) {
    const ka = placeKey(a), kb = placeKey(b); if (!ka.length || !kb.length) return false;
    // 버그 사냥 10: 둘 다 「이름, 꼬리」 · 「이름 — 꼬리」 꼴이고 꼬리가 다르면(그중 하나라도 세 낱말 이하 — 「North Wing」 · 「east side」 같은 자리 말) 다른 곳이에요.
    //   긴 꼬리(「wet canopy at dusk …」 같은 묘사)끼리만 다를 때는 앞 조각으로 견줘요(지금 장소 줄에서 같은 곳이 두 번 생긴 것)
    const ta = tailOf(a), tb = tailOf(b);
    if (ta.length && tb.length && ta.join(' ') !== tb.join(' ') && Math.min(ta.length, tb.length) <= 3) return false;
    const ja = ka.join(''), jb = kb.join('');
    if (ja === jb) return [...ja].length >= 2;
    // 머리글자: 줄임말 쪽이 대문자로 적힌 낱말 하나일 때만(「IT」 ↔ 「Information Technology」) — 「Lab」 ↔ 「Language Arts Building」 처럼 보통 낱말이 우연히 머리글자와 같은 건 안 합쳐요(버그 사냥 10)
    const ini = ws => ws.length >= 2 ? ws.map(w => [...w][0]).join('') : null;
    const acro = (n, k) => { const r = placeKey(n, null, true); return k.length === 1 && r.length === 1 && /^[A-Z]{2,6}$/.test(r[0]); };
    return (acro(a, ka) && ini(kb) === ja) || (acro(b, kb) && ini(ka) === jb);
}
// ── 부속 자리 묶기(1.7.9 · 그림만) ─────────────────────────────────
// 이야기에서 「<장소> 대문」 · 「<Place> Gate」 · 「<場所>の玄関」 처럼 어떤 장소의 문 · 입구 · 앞 · 마당을 새 장소로 적으면 그 확장은 따로 점을 만들어요
//   (그 확장 place 줄 = 새 장소 · 이어진 곳 없음 · 구역 없음 → 땅 줄 끝에 외딴 점). 이름이 「X + 부속 말」 이고 X 가 지도의 다른 장소 이름(원문 · 번역 이름)과 같으면
//   X 점 하나로 묶어요 — 부속 점은 숨기고 X 점 옆 「+N」(누르면 그 부속 카드) · 지금 위치가 부속이면 X 점에 「지금」 고리. 자료는 그대로예요. 스위치: annex(기본 켬)
const ANNEX_KO = /^(.+?)\s*(?:앞마당|뒷마당|현관문|대문\s*앞|정문\s*앞|대문|입구|현관|정문|뒷문|마당|앞)$/u;
const ANNEX_EN = /^(.+?)[\s-]+(?:(?:front|main|back|garden)\s+gates?|gates?|(?:main|front)\s+entrance|entrance|entryway|front\s+doors?|back\s+doors?|front\s+(?:yard|garden|steps|porch)|back\s*yard|courtyard|yard|porch|doorstep|front)$/iu;
const ANNEX_EN_PRE = /^(?:(?:the\s+)?(?:(?:front|main|back)\s+)?(?:gates?|entrance|front\s+door|front|doorstep|yard|front\s+yard|porch)\s+(?:of|to)|in\s+front\s+of|outside)\s+(.+)$/iu;
const ANNEX_JA = /^(.+?)(?:の)?(?:正門|裏門|門前|玄関|入口|入り口|裏口|門|前|庭)$/u;
/** 이름 하나에서 「X + 부속 말」 의 X 후보들(없으면 빈 목록) */
export function annexBase(name) {
    const t = foldBlank(labelOf(name)).replace(/\s+/g, ' ').trim(), out = [];   // 버그 사냥 7 점자 빈칸 이름(`Grand⠀Hotel⠀Gate`)도
    for (const re of [ANNEX_KO, ANNEX_EN, ANNEX_EN_PRE, ANNEX_JA]) { const m = re.exec(t); if (m) { const x = m[1].replace(/\s*(?:의|の|'s)$/u, '').trim(); if ([...placeNorm(x)].length >= 2) out.push(m[1].trim()); } }
    return out;
}
const REGION = /^(?:realm|world|region|area|zone|district|city|town|village|country|nation|kingdom|continent|island|plane|dimension|territory|province|state|세계|지역|구역|도시|마을|나라|왕국|대륙|섬|영역|영토|世界|地域|地区|都市|町|村|国|王国|大陸|島|領域)$/iu;
// 집 꼴 낱말(「X's House」 ↔ 「X's Home」)은 같은 열쇠로
const annexKey = s => placeNorm(labelOf(s)).replace(/(?:house|home|residence)$/u, 'home');
/** 부속 자리 → 그 본 장소 이름(Map). list = 지도 장소 · tr = 번역 보기 글(원문 · 번역 이름 둘 다 봐요) · 본 장소가 또 부속이면 묶지 않아요 */
export function annexMap(places, tr = null) {
    const list = (Array.isArray(places) ? places : []).filter(p => p?.name), out = new Map();
    if (list.length < 2) return out;
    const tx = s => { const a = [s]; try { const t = tr?.(s); if (typeof t === 'string' && t.trim() && t !== s) a.push(t); } catch { /* 원문만 */ } return a; };
    // 본 장소가 넓은 곳(구역 이름 · 종류가 세계 · 나라 · 도시 · 구역 …)이면 안 묶어요 — 「Heaven Gate」 는 천국이라는 세계의 한 점이 아니라 따로 가는 곳이에요
    const areas = new Set(list.flatMap(p => (p.area ? tx(String(p.area)) : [])).map(annexKey).filter(Boolean));
    const wide = p => REGION.test(String(p.kind ?? '')) || tx(p.name).some(n => areas.has(annexKey(n)));
    const byKey = new Map();
    for (const p of list) if (!wide(p)) for (const n of tx(p.name)) { const k = annexKey(n); if (k && !byKey.has(k)) byKey.set(k, p); }
    // 1.8.2 이름 앞뒤 표시 기호만 다른 곳(「@Lobby」 ↔ 「Lobby」 — 모델이 변화 줄에 「loc: @Lobby」 처럼 적으면 원작이 그대로 새 장소로 만들어요)은 기호 없는 쪽으로
    const plain = new Map(); for (const p of list) if (stripMarks(p.name) === trimEdge(p.name)) for (const n of tx(p.name)) { const k = squashBlank(n).toLowerCase(); if (k && !plain.has(k)) plain.set(k, p); }
    for (const p of list) {
        if (stripMarks(p.name) !== trimEdge(p.name)) {   // 1.9.1 앞뒤 점자 빈칸(`⠀Lobby⠀`)은 표시 기호가 아니에요
            const q = tx(p.name).map(n => plain.get(squashBlank(stripMarks(n)).toLowerCase())).find(x => x && x !== p);
            const a = String(p.area ?? ''), b = String(q?.area ?? '');
            if (q && !(a && b && a !== b)) { out.set(p.name, q.name); continue; }
        }
        let head = null;
        for (const n of tx(p.name)) { for (const x of annexBase(n)) { const q = byKey.get(annexKey(x)); if (q && q !== p) { head = q; break; } } if (head) break; }
        if (!head) continue;
        const a = String(p.area ?? ''), b = String(head.area ?? '');
        if (a && b && a !== b) continue;   // 다른 구역의 같은 이름은 안 묶어요
        out.set(p.name, head.name);
    }
    for (const [k, v] of [...out]) if (out.has(v)) out.delete(k);   // 사슬은 안 묶어요
    return out;
}
/** 1.8.2 이름 앞뒤의 표시 기호(@ · # · 전각 ＠ ＃)를 떼요 — 그 확장은 장소에 이 기호를 쓰지 않아요(SNS 아이디 「@이름」 만 따로). 다 떼서 빈 글이면 그대로 */
export function stripMarks(s) { const t = trimEdge(s), u = trimEdge(t.replace(MARK_EDGE, '')); return u || t; }   // 1.9.1 `@⠀Lobby` · `⠀@Lobby⠀`(점자 빈칸)도 — 가운데 글은 그대로
const MARK_EDGE = new RegExp(`^[@＠#＃]+${SP}*|${SP}*[@＠#＃]+$`, 'gu');
const normName = s => foldBlank(s).toLowerCase().replace(/[\s·・_\-.,'"()（）[\]]+/g, '');   // 버그 사냥 7 점자 빈칸도
const simpleFind = (list, name) => { const k = normName(name); return list.find(p => normName(p.name) === k) || null; };
const r1 = v => Math.round(v * 10) / 10;
/** 층 → 줄 번호(1F = 1 · B1 = 0 · B2 = −1 …): 1층과 지하 1층 사이가 땅이에요 */
const rowOf = f => (f >= 1 ? f : f + 1);
const tagOf = r => (r >= 1 ? `${r}F` : `B${1 - r}`);

/**
 * 층별 배치를 계산해요. places = 그 확장 지도 장소 목록(name · desc · kind · area · links · x · y).
 * 돌려주는 것: null(층 건물이 없음 → 그 확장 그림 그대로) 또는 { pos: Map(이름 → {x, y, zone, row, b}), rows, buildings, ground, routes(pairs) }
 */
export function floorLayout(places, { find = simpleFind, tr = null, tall = null, dir = null, ghosts = null, annex = null } = {}) {
    // 버그 사냥 10b: 이름이 완전히 같은 장소는 첫째만(그 확장 findBy · layoutPlaces 도 첫째를 써요) — 둘째가 층 · 바깥 칸을 덮어 점 자리와 카드가 어긋났어요
    const names = new Set(), list = (Array.isArray(places) ? places : []).filter(p => p && p.name && !names.has(p.name) && names.add(p.name));
    if (list.length < 2) return null;
    // 1.7.4 장소 이름 · 설명에 층이 없으면 로어북 층 안내(dir — floorDirectory)에서 그 이름의 층을 찾아요(그림만 · 그 확장 자료는 그대로)
    // 1.7.9 부속 자리(annex — annexMap)는 층 · 건물을 정하는 데 안 넣어요(본 장소 점에 겹쳐요)
    const ann = annex instanceof Map ? new Map([...annex].filter(([a, b]) => a !== b && list.some(p => p.name === b))) : new Map();
    const info = new Map(list.map((p, i) => [p.name, { p, i, f: ann.has(p.name) ? null : floorOf(p, tr) ?? dirFloor(dir, p, tr), area: String(p.area ?? '') }]));
    // 1.7.0 구역(area) 이름과 같은 장소(「본부 | 7F 비서실」 같은 지금 장소 줄에서 그 확장이 앞 조각으로 만든 곳)는 방이 아니라 건물 머리 — 층을 안 읽어요
    const tx = s => [s, tr?.(s)].filter(Boolean);
    const areaKeys = new Map();
    // 버그 사냥 10b: 층 표기뿐인 구역 이름(「2F」)은 열쇠가 빈 글자라 층 표기뿐인 방 이름(「3F」)과 같다고 봤어요 — 빈 열쇠는 안 견줘요
    for (const it of info.values()) if (it.area) for (const t of tx(it.area)) { const k = placeKey(t).join(''); if (k) areaKeys.set(k, it.area); }
    const headOf = new Map();
    for (const it of info.values()) for (const t of tx(it.p.name)) { const k = placeKey(t).join(''), a = k && areaKeys.get(k); if (a) { headOf.set(it.p.name, a); it.f = null; break; } }
    // 1.7.0 구역이 빈 층 장소(본편 AI 가 새로 더한 곳 등)는 이어진 층 장소들의 구역이 하나면 그 구역 건물로
    //   버그 사냥 10: 이어진 곳을 장소마다 목록 전체로 다시 찾으면(장소 200개 · 구역 빈 곳이 많을 때 0.6초 넘게) 느려서 링크를 한 번만 풀어 둬요
    const linked = new Map(list.map(p => [p.name, new Set()]));
    for (const p of list) for (const l of (Array.isArray(p.links) ? p.links : [])) { const q = find(list, l); if (q && linked.has(q.name)) { linked.get(p.name).add(q.name); linked.get(q.name).add(p.name); } }
    const linkedOf = n => linked.get(n) || new Set();
    for (const it of info.values()) {
        if (it.f === null || it.area) continue;
        const as = new Set([...linkedOf(it.p.name)].map(n => info.get(n)).filter(x => x && x.f !== null && x.area).map(x => x.area));
        if (as.size === 1) it.area = [...as][0];
    }
    // 건물 = 같은 구역(area)에서 층이 적힌 장소 묶음 · 서로 다른 층이 둘 넘어야 건물로 봐요
    const groups = new Map();
    for (const it of info.values()) if (it.f !== null) { const k = it.area; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
    const ax = it => (Number.isFinite(it.p.x) ? it.p.x : it.i * 10);
    // 1.7.4 층이 몇 곳에만 적힌 구역은 건물로 안 봐요: 그 구역 장소(건물 머리 · 하늘 · 땅 밑 장소 빼고) 가운데 층이 적힌 곳이 절반이 안 되면
    //   층 모르는 부서 여럿이 「바깥 장소」 로 땅 줄에 늘어서 건물 단면이 오히려 틀린 그림이 돼요(처음 만든 지도에 「3층 회의실」 · 「4층 서고」 만 층이 적힌 경우) → 그 확장 그림 그대로
    //   구역이 빈 묶음(구역을 안 쓰는 지도)은 바깥 장소와 가를 수 없어 예전처럼 둬요
    const thin = g => {
        const a = g[0]?.area; if (!a) return false;
        let members = 0;
        for (const it of info.values()) if (it.area === a && (it.f !== null || (!headOf.has(it.p.name) && zoneOf(it.p, tr) === 'out'))) members++;
        return g.length * 2 < members;
    };
    const buildings = [...groups.values()].filter(g => new Set(g.map(it => it.f)).size >= 2 && !thin(g))
        .sort((a, b) => a.reduce((s, it) => s + ax(it), 0) / a.length - b.reduce((s, it) => s + ax(it), 0) / b.length);
    if (!buildings.length) return null;
    const inB = new Map(); buildings.forEach((g, bi) => g.forEach(it => inB.set(it.p.name, bi)));
    for (const it of info.values()) if (it.f !== null && !inB.has(it.p.name)) it.f = null;   // 외딴 층 하나짜리는 바깥 장소로
    // 1.7.0 같은 건물 · 같은 층에서 이름이 거의 같은 곳(원문 · 번역 이름 어느 쪽이든)은 한 점으로 — 먼저 나온 장소가 대표 · 나머지는 그 점에 겹쳐 그려요(alias)
    const alias = new Map();
    buildings.forEach((g, bi) => {
        const keep = [];
        for (const it of g) {
            const twin = keep.find(k => k.f === it.f && tx(k.p.name).some(a => tx(it.p.name).some(b => sameName(a, b))));
            if (twin) { alias.set(it.p.name, twin.p.name); inB.delete(it.p.name); } else keep.push(it);
        }
        buildings[bi] = keep;
    });
    for (const [a, b] of ann) if (!alias.has(a)) alias.set(a, alias.get(b) ?? b);
    // 1.7.0 건물 밖 장소인데 그 건물 방과 같은 곳(「<건물 이름> 메인 로비」 ↔ 「1층 로비」 — 지금 장소 줄에서 생긴 곳): 구역이 비었거나 그 건물 구역일 때만 ·
    //   건물(구역) 이름 낱말과 꾸미는 말(메인 · 중앙 · 정문 · main …)을 뗀 열쇠가 그 건물 방 하나와만 같으면 그 방 점에 겹쳐요
    buildings.forEach(g => {
        const area = g[0]?.area; if (!area) return;
        const drop = new Set(tx(area).flatMap(a => words(a)));
        const keys = new Map(), keyOf = n => { if (!keys.has(n)) keys.set(n, tx(n).map(t => placeKey(t, drop).join('')).filter(k => [...k].length >= 2)); return keys.get(n); };
        for (const it of info.values()) {
            if (inB.has(it.p.name) || alias.has(it.p.name) || headOf.has(it.p.name) || it.f !== null || (it.area && it.area !== area)) continue;
            const mine = keyOf(it.p.name); if (!mine.length) continue;
            const hits = g.filter(r => keyOf(r.p.name).some(k => mine.includes(k)));
            if (hits.length === 1) alias.set(it.p.name, hits[0].p.name);
        }
        // 1.8.2 이야기에서 새로 생긴 「<방 이름>」 이 든 곳(「Greenhouse / Tech Dept plant room」 · 「기술부 옆 공작방」 — 층이 안 적힘 · 구역 없음)은
        //   땅 줄 바깥 점이 아니라 그 방의 층에 따로 점으로 놓아요(같은 곳은 아니라 겹치지 않아요). 조각(「/ · | · , · — 」)마다 그 건물 방 하나의 열쇠(6자 넘게)가 들어 있을 때만
        for (const it of info.values()) {
            if (inB.has(it.p.name) || alias.has(it.p.name) || headOf.has(it.p.name) || it.f !== null || it.ghost || (it.area && it.area !== area) || zoneOf(it.p, tr) !== 'out' || tx(it.p.name).some(t => annexBase(t).length)) continue;   // 「X 대문」 꼴은 부속 묶기(annex) 몫
            const parts = tx(it.p.name).flatMap(t => String(t).split(/\s*[/／|,，·]\s*|\s+[-–—]\s+/u)).map(s => placeKey(s, drop).join('')).filter(k => [...k].length >= 2);
            if (!parts.length) continue;
            const hits = g.filter(r => !r.ghost && keyOf(r.p.name).some(k => [...k].length >= 6 && parts.some(s => s !== k && s.includes(k))));
            if (hits.length !== 1) continue;
            it.f = hits[0].f; it.area = area; it.near = hits[0].p.name; g.push(it); inB.set(it.p.name, buildings.indexOf(g));
        }
    });
    const real = n => { let k = n; for (let i = 0; i < 4 && alias.has(k); i++) k = alias.get(k); return k; };   // 1.7.9 부속 → 쌍둥이 → 대표처럼 두 번 걸린 것도
    // 1.7.5 아직 안 가 본 곳(ghosts — unvisitedOf): 층이 있는 곳은 가장 큰 건물의 그 층 방으로(방 칸에 같이 들어가요 · 진짜 방 오른쪽),
    //   층이 없는 곳은 하늘 · 땅 밑 · 바깥(zone · 모르면 바깥)으로. 건물을 새로 만들지는 않아요(건물은 진짜 장소로만 정해요)
    const gh = new Map(), ghZone = new Map();
    (Array.isArray(ghosts) ? ghosts : []).forEach((g, k) => {
        if (!g?.key || gh.has(g.key) || info.has(g.key)) return;
        gh.set(g.key, g);
        if (Number.isFinite(g.f) && g.f !== 0) {
            const bi = buildings.reduce((b, x, i) => (x.length > buildings[b].length ? i : b), 0);
            const it = { p: { name: g.key, known: true }, i: 1e6 + k, f: g.f, area: buildings[bi][0]?.area ?? '', ghost: true };
            info.set(g.key, it); buildings[bi].push(it); inB.set(g.key, bi);
        } else ghZone.set(g.key, g.zone === 'above' || g.zone === 'below' ? g.zone : 'out');
    });
    const shownName = n => gh.get(n)?.label ?? (tr?.(n) || n);
    // 줄: 건물마다 맨 위 ~ 맨 아래 층을 빈 층까지 다 넣어요(15층 넘게 벌어지면 장소가 있는 층만)
    // 1.7.4 땅 위 건물은 1층(땅)까지 내려와요 — 맨 아래 방이 3층이면 땅 줄(바깥 장소 줄)이 3층 높이가 돼 바깥 장소가 「3층」 에 선 것처럼 보였어요
    const rowSet = new Set();
    const lowOf = rs => { const hi = Math.max(...rs), lo = Math.min(...rs); return hi >= 1 ? Math.min(lo, 1) : lo; };
    for (const g of buildings) {
        const rs = g.map(it => rowOf(it.f)), hi = Math.max(...rs), lo = lowOf(rs);
        if (hi - lo < 15) for (let r = lo; r <= hi; r++) rowSet.add(r); else { rs.forEach(r => rowSet.add(r)); rowSet.add(lo); }
    }
    // 버그 사냥 9: 지하층만 있는 건물(지하 감옥 B1 ~ B3 등)이면 땅 줄(1F)이 없어 땅 선 · 바깥 장소가 맨 아래 지하층 높이에 놓였어요 — 빈 1F 줄을 하나 둬요(그 건물 띠에는 안 들어가요)
    if (![...rowSet].some(r => r >= 1)) rowSet.add(1);
    const rows = [...rowSet].sort((a, b) => b - a);
    // 줄 y: 위에서부터 띠를 쌓아요. 1F 와 B1 사이가 땅(ground)
    // 두 줄 이름표가 있는 층은 띠를 한 줄(LINE_H)만큼 높이고 점 · 이름표를 그만큼 내려요 — 윗줄이 위층 띠 경계에 닿지 않게(tall = 그런 층 모음 · 처음엔 비우고 배치 뒤 한 번 더)
    const extra = r => (tall?.has(r) ? LINE_H : 0), rowH = r => ROW_H + extra(r);
    const rowTop = new Map(); { let acc = 0; for (const r of rows) { rowTop.set(r, acc); acc += rowH(r); } }
    const top = 0, bottom = rows.reduce((a, r) => a + rowH(r), 0);
    const groundRow = rows.includes(1) ? 1 : (rows.filter(r => r >= 1).sort((a, b) => a - b)[0] ?? rows[rows.length - 1]);
    const groundY = rowTop.get(groundRow) + rowH(groundRow);
    const dotY = r => rowTop.get(r) + DOT_Y + extra(r);
    // 링크 짝(그 확장과 같은 규칙: 이어진 곳 이름으로 찾고 · 한 번씩)
    const pairs = []; const seen = new Set();
    for (const p of list) for (const l of (Array.isArray(p.links) ? p.links : [])) {
        const q = find(list, l); if (!q || q === p || !info.has(q.name)) continue;
        const a = real(p.name), b = real(q.name); if (a === b) continue;   // 겹친 점의 링크는 대표 점으로 합쳐요
        const key = [a, b].sort().join('|'); if (seen.has(key)) continue; seen.add(key);
        pairs.push([a, b]);
    }
    const fOf = n => info.get(n)?.f ?? null;
    // 층 없는 장소: 위 · 아래 · 바깥
    const bAreas = new Set(buildings.map(g => g[0]?.area));
    // 1.7.4 이름 · 종류로 안 갈리는 장소는 구역 이름으로 한 번 더(하늘 구역의 「집」 · 땅 밑 구역의 영지가 땅 줄에 서던 것) — 건물 구역은 빼요(「Heaven Tower」 의 방)
    const zoneIn = p => { const z = zoneOf(p, tr); if (z !== 'out' || !p.area || bAreas.has(String(p.area))) return z; return zoneOf({ name: String(p.area) }, tr); };
    const zone = new Map(list.filter(p => !inB.has(p.name) && !alias.has(p.name)).map(p => [p.name, headOf.has(p.name) && bAreas.has(headOf.get(p.name)) ? 'above' : zoneIn(p)]));   // 건물 머리는 지붕 위
    // 1.7.5 공용 통로: 높이가 다른 두 곳을 잇는 선은 모두 한 건물의 승강기 줄 하나(통로)로 모여요 — 예전엔 먼 층 선 · 하늘 · 땅 밑 선마다 제 줄,
    //   바깥 장소 선마다 건물 곁 제 줄이 생겨 건물 오른쪽에 세로선이 열 개 넘게 빽빽했어요. 어느 건물 통로인가: 건물 안 장소 쪽(둘 다면 먼저 적힌 쪽) ·
    //   건물 밖끼리면 바깥 장소가 끼면 바깥 줄에 가까운 맨 오른쪽 건물, 아니면 첫 건물
    const pkey = (a, b) => [a, b].sort().join('|');
    const rowKey = n => (inB.has(n) ? `r${rowOf(fOf(n))}` : zone.get(n) === 'out' ? `r${groundRow}` : zone.get(n) ?? '');
    const hub = new Map(), shaftOn = buildings.map(() => false);
    for (const [a, b] of pairs) {
        if (rowKey(a) === rowKey(b)) continue;   // 같은 높이 줄: 가로선
        const bi = inB.get(a) ?? inB.get(b) ?? (zone.get(a) === 'out' || zone.get(b) === 'out' ? buildings.length - 1 : 0);
        hub.set(pkey(a, b), bi); shaftOn[bi] = true;
    }
    const shaftN = shaftOn.map(on => (on ? 1 : 0));
    // 칸 너비 채우기: 세로(층 수 · 위 · 아래)로 정해지는 보기 칸 너비만큼 방 칸을 넓혀요(건물이 한쪽에 붙고 반이 비지 않게)
    const hasZ = z => [...zone.values()].includes(z);
    const ghN = z => [...ghZone.values()].filter(v => v === z).length;
    const ghRowsGuess = z => Math.ceil(ghN(z) / GH_CAP0);   // 칸 너비를 정하기 전 어림(줄 수만큼 높이를 더해요)
    const contentH = bottom + (hasZ('above') ? 23 : ghN('above') ? 9 : 3) + (hasZ('below') ? 23 : ghN('below') ? 9 : 3) + (ghRowsGuess('above') + ghRowsGuess('below')) * GH_STEP;
    const outN = [...zone.values()].filter(z => z === 'out').length + ghN('out');
    // 바깥 장소: 땅 위 1층 가게 · 집이라 모두 1층 줄(땅 선 바로 위) 한 줄에 둬요 — 다른 층 높이에 두면 「3층 가게」 처럼 읽혀요
    const fixedW = 4 + buildings.length * TAG_W + shaftN.reduce((s2, n2) => s2 + (n2 ? 3 + n2 * LANE : 0), 0) + (buildings.length - 1) * 10 + (outN ? 4 + outN * OUT_W + 10 - OUT_W / 2 : 2);
    const wantW = contentH / TALL * (1 - RESERVE);
    // 건물 가로: 한 층에 가장 많은 방 수만큼 칸
    const pos = new Map(); const bInfo = [];
    const baseSum = buildings.reduce((s2, g) => { const c = new Map(); for (const it of g) c.set(rowOf(it.f), (c.get(rowOf(it.f)) || 0) + 1); return s2 + Math.max(Math.max(1, ...c.values()), 1.4) * SLOT_W; }, 0);
    let x = 0;
    buildings.forEach((g, bi) => {
        const byRow = new Map(); for (const it of g) { const r = rowOf(it.f); if (!byRow.has(r)) byRow.set(r, []); byRow.get(r).push(it); }
        const cols = Math.max(1, ...[...byRow.values()].map(a => a.length));
        const base = Math.max(cols, 1.4) * SLOT_W, roomW = Math.min(base * ROOM_MAX, Math.max(base, base + (wantW - fixedW - baseSum) / buildings.length)), shaftW = shaftN[bi] ? 3 + shaftN[bi] * LANE : 0;
        const left = x, roomL = x + TAG_W, right = roomL + roomW + shaftW;
        for (const [r, a] of byRow) {
            a.sort((p, q) => ax(p) - ax(q));
            const w = roomW / a.length;
            a.forEach((it, j) => pos.set(it.p.name, { x: r1(roomL + (j + 0.5) * w), y: r1(dotY(r)), zone: 'b', row: r, b: bi, w }));
        }
        const rs = rows.filter(r => r <= Math.max(...byRow.keys()) && r >= lowOf([...byRow.keys()]));
        bInfo.push({ left, right, roomL, roomR: roomL + roomW, shaftL: roomL + roomW, shaftW, rows: rs, top: rowTop.get(rs[0]), bottom: rowTop.get(rs[rs.length - 1]) + rowH(rs[rs.length - 1]), lanes: 0 });
        x = right + 10;
    });
    const bLeft = bInfo[0].left, bRight = bInfo[bInfo.length - 1].right;
    const rest = list.filter(p => !pos.has(p.name) && !alias.has(p.name));
    for (const b of bInfo) b.shaftX = r1(b.shaftL + b.shaftW / 2);
    // 바깥 장소 차례: 건물에서 링크로 몇 걸음인지(가까운 것부터) → 그 확장 x
    const adj = new Map(list.map(p => [p.name, new Set()]));
    for (const [a, b] of pairs) { adj.get(a)?.add(b); adj.get(b)?.add(a); }
    const depth = new Map(); const q = [...pos.keys()]; q.forEach(n => depth.set(n, 0));
    while (q.length) { const n = q.shift(); for (const m of adj.get(n) || []) if (!depth.has(m) && zone.get(m) === 'out') { depth.set(m, depth.get(n) + 1); q.push(m); } }
    const outs = rest.filter(p => zone.get(p.name) === 'out').sort((p, q2) => (depth.get(p.name) ?? 99) - (depth.get(q2.name) ?? 99) || ax(info.get(p.name)) - ax(info.get(q2.name)));
    // 1.7.5 바깥 장소 선은 통로로 땅 줄까지 내려와 가장 가까운 벽(오른쪽)으로 나가요 — 건물과 바깥 사이에 선마다 줄을 안 둬요
    const outL = bRight + 4;
    // 1.7.0 바깥 칸 너비는 이름표 폭 기준(두 줄로 접은 뒤 가장 긴 줄 + 2) — 이름표끼리 겹치지 않게 · 좁으면 그만큼 옆으로 밀어요
    let ox = outL;
    // 1.7.5 아직 안 가 본 바깥 곳은 진짜 바깥 장소 뒤에(같은 땅 줄)
    const ghOut = [...ghZone].filter(([, z]) => z === 'out').map(([k]) => ({ name: k }));
    [...outs, ...ghOut].forEach(p => {
        const lines = wrapLabel(shownName(p.name), OUT_W - 1.5), w = Math.max(OUT_W, Math.min(40, Math.max(...lines.map(textW), GH_TAG_W * (gh.has(p.name) ? 1 : 0)) + 2));
        pos.set(p.name, { x: r1(ox + w / 2), y: r1(dotY(groundRow)), zone: 'out', row: groundRow, b: null, w, ...(gh.has(p.name) ? { ghost: true } : {}) }); ox += w;
    });
    const outR = outs.length || ghOut.length ? ox : bRight;
    // 하늘 장소는 지붕 위 한 줄, 땅 밑 장소는 바닥 아래 한 줄 — 건물 방 칸 가운데에 그 확장 차례로 늘어서요
    //   1.7.5 땅 밑 줄은 통로가 바닥 아래 복도까지 내려와 지나가므로 이름표 · 점이 통로 x 에 걸리지 않게 줄 전체를 왼쪽으로 반 칸씩 비켜요
    const mid = (bInfo[0].roomL + bInfo[bInfo.length - 1].roomR) / 2;
    const shaftXs = bInfo.filter(b => b.shaftW).map(b => b.shaftX);
    for (const [z, y] of [['above', top - 11], ['below', bottom + 13]]) {
        const a = rest.filter(p => zone.get(p.name) === z);
        const half = a.map(p => Math.max(...wrapLabel(tr?.(p.name) || p.name, SLOT_W - 1.5).map(textW), 5.6) / 2 + 1);
        let x0 = mid - (a.length - 1) / 2 * SLOT_W;
        const clash = () => z === 'below' && a.some((p, k) => shaftXs.some(sx => Math.abs(x0 + k * SLOT_W - sx) < half[k]));
        for (let i = 0; i < 40 && clash(); i++) x0 -= SLOT_W / 2;
        a.forEach((p, k) => pos.set(p.name, { x: r1(x0 + k * SLOT_W), y, zone: z, row: null, b: null, w: SLOT_W }));
        // 1.7.5 아직 안 가 본 하늘 · 땅 밑 곳: 진짜 줄 바깥쪽(하늘은 더 위 · 땅 밑은 더 아래)에 따로 줄 — 건물 폭만큼 채우고 넘치면 다음 줄
        const g = [...ghZone].filter(([, v]) => v === z).map(([k]) => k);
        if (g.length) {
            const { slot, step } = ghostGrid(g.map(shownName));
            const cap = Math.max(GH_CAP0, Math.floor((bRight - bLeft) / slot)), sign = z === 'above' ? -1 : 1, first = a.length ? 1 : 0;
            g.forEach((k, i) => {
                const row = Math.floor(i / cap), inRow = Math.min(cap, g.length - row * cap), col = i % cap;
                pos.set(k, { x: r1(mid + (col - (inRow - 1) / 2) * slot), y: r1(y + sign * (row + first) * step), zone: z, row: null, b: null, w: slot, ghost: true });
            });
        }
    }
    for (const [a] of alias) { const b = real(a); if (pos.has(b) && b !== a) pos.set(a, { ...pos.get(b), twin: b, ...(ann.has(a) ? { annex: true } : {}) }); }   // 겹친 장소는 대표 점 자리(1.7.9 부속은 annex 표시)
    for (const [k] of gh) if (pos.has(k)) pos.get(k).ghost = true;
    const out = { pos, alias, rows, rowTop, rowH, dotY, groundRow, groundY, top, bottom, buildings: bInfo, bLeft, bRight, outL, outR, pairs, inB, hub, tall: tall || new Set(), ghosts: gh, annex: ann };
    if (tall) return out;
    // 이름표가 두 줄로 접힐 층(입히기와 같은 규칙: 보이는 이름 = 번역 보기 글 · 칸 너비 - 1.5)을 모아 한 번 더 놓아요
    const need = new Set();
    for (const [n, o] of pos) if (o.row !== null && o.row !== undefined && (o.zone === 'b' || o.zone === 'out') && info.get(n)?.p.known !== false && wrapLabel(shownName(n), (o.w || SLOT_W) - 1.5).length > 1) need.add(o.row);
    return need.size ? floorLayout(places, { find, tr, tall: need, dir, ghosts, annex }) : out;
}

// ── 로어북 층 안내(1.7.4) ─────────────────────────────────────
// 그 확장이 채팅마다 AI 로 만드는 지도는 같은 세계여도 장소 설명에 층을 적을 때도 · 안 적을 때도 있어요(한 채팅은 열 곳 · 다음 채팅은 세 곳 · 한 곳).
//   로어북에 「- **7F:** 사무실 A, 사무실 B」 같은 층 안내가 있으면 그것으로 층을 채워 채팅마다 같은 건물 모양이 나오게 해요(그림만 · 자료는 그대로)
const DIR_LINE = /^\s*(?:[-*•·]\s*)?(?:\*\*|__)?\s*((?:B\s?\d{1,2}\s?F?|\d{1,3}\s?F|(?:지하|地下)\s?\d{1,2}\s?(?:층|階)|\d{1,3}\s?(?:층|階)|\d{1,3}(?:st|nd|rd|th)\s+(?:floor|basement)|ground\s+floor|basement(?:\s+\d{1,2})?))\s*(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*(.+?)\s*$/iu;
/** 글 여러 개(로어북 항목 본문)에서 「층: 이름, 이름」 줄을 읽어 [{ name, f }] — 한 글 안에서 서로 다른 층이 둘 넘게 나와야 층 안내로 봐요(우연한 한 줄은 안 써요) */
export function floorDirectory(texts) {
    const out = [];
    for (const t of Array.isArray(texts) ? texts : []) {
        const got = [];
        for (const line of String(t ?? '').split(/\r?\n/)) {
            const m = DIR_LINE.exec(line); if (!m) continue;
            const f = floorIn(m[1].replace(/^B\s?(\d+)$/i, 'B$1')); if (f === null) continue;
            for (const raw of m[2].replace(/[*_`]/g, '').split(/\s*(?:[,，、;；/]|\band\b|\s·\s)\s*/u)) { const name = raw.replace(/[.。]+$/, '').trim(); if (name && [...name].length >= 2 && [...name].length <= 60) got.push({ name, f }); }
        }
        if (new Set(got.map(g => g.f)).size >= 2) out.push(...got);
    }
    return out;
}
/** 장소 하나의 로어북 층(원문 · 번역 이름이 안내 이름과 같은 곳 — sameName). 안내 이름 둘이 다른 층으로 걸리면 모르는 것으로 */
function dirFloor(dir, p, tr) {
    if (!dir?.length || !p?.name) return null;
    const names = [p.name, tr?.(p.name)].filter(Boolean);
    const fs = new Set(dir.filter(d => names.some(n => normName(n) === normName(d.name) || sameName(n, d.name))).map(d => d.f));
    return fs.size === 1 ? [...fs][0] : null;
}

// ── 아직 안 가 본 곳(1.7.5 · 그림만) ─────────────────────────────────
// 그 확장 지도에는 이야기에 나온 곳만 들어가요. 이 채팅에 걸린 로어북에 적힌 장소(집 · 저택 · 부서 · 가게 …) 가운데 지도에 없는 곳을 흐린 점으로 더해요.
//   장소로 보는 것(보수적으로 — 인물 · 설정 · 규칙 글은 안 넣어요):
//   ① 층 안내 줄(floorDirectory)의 이름 — 건물 안 그 층에
//   ② 인물 항목의 「Residence: …」 · 「거주지: …」 줄 — 「<인물>의 집」(인물 이름은 항목 이름 · Name 줄) · 천국 · 지옥 낱말로 위 · 아래
//   ③ 머리말이 장소 · 지리 · 시설(Locations · Geography · Facilities …)인 묶음 바로 밑 글머리 「- **이름:** …」
//   ④ 항목 이름이 「[장소]」 · 「[Location]」 꼴로 시작하는 항목 하나 통째
const MD = s => String(s ?? '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim();
const LINE_KV = /^\s*(?:[-*•·]\s*)?(?:\*\*|__)?\s*([^:：*_]{1,40}?)\s*(?:\*\*|__)?\s*[:：]\s*(?:\*\*|__)?\s*(.*?)\s*$/u;
const RES_KEY = /^(?:residence|home|address|lives?\s+in|dwelling|거주지|거처|사는\s*곳|주거|자택|住居|住まい|住所|自宅)$/iu;
const NAME_KEY = /^(?:name|full\s+name|이름|성명|名前|氏名)$/iu;
const LOC_HEAD = /\b(?:locations?|places?|geography|landmarks?|facilit(?:y|ies)|districts?)\b|장소|지리|지명|명소|시설|場所|地理|地名|施設/iu;
const LOC_TAG = /^\s*[[【(（]\s*(?:장소|지역|건물|가게|상점|시설|location|place|building|shop|場所|施設|店)\s*[\]】)）]\s*/iu;
// ③ 글머리 가운데 풀이 칸 이름(「Role:」 · 「Departments & Key Personnel:」 · 「Concept:」 …)은 장소가 아니에요
//   (이름 전체가 풀이 낱말일 때만 · 「&」 가 든 머리는 묶음 이름이라 빼요 — 「Staff Canteen」 같은 장소는 그대로)
const FIELD = /^(?:(?:key\s+)?(?:roles?|concepts?|society|food|problems?|characteristics?|staff|personnel|members?|departments?|history|overview|descriptions?|notes?|rules?|titles?|features?|population|economy|culture|atmosphere|summary)|역할|개요|특징|설명|인원|구성원|부서|역사|규칙|분위기|役割|概要|特徴|説明|人員)$/iu;
const TAGS = /^(?:\s*[[【(（][^\]】)）]{0,12}[\]】)）]\s*)+/u;
const HANGUL = /[가-힯]/u, KANA = /[ぁ-ヿ一-鿿]/u;
const clip = (s, n = 180) => { const t = MD(s); return [...t].length > n ? [...t].slice(0, n - 1).join('').trimEnd() + '…' : t; };
/** 이름 비교 열쇠: 괄호 · 소유(「's」 · 「의」 · 「の」) · 앞 「the」 · 띄어쓰기 · 문장부호를 떼요 */
export function placeNorm(s) {
    let t = foldBlank(s).replace(/\([^)]*\)|（[^）]*）|\[[^\]]*\]|【[^】]*】/g, ' ').toLowerCase();   // 1.9.1 `The⠀Lobby` · `Mira's⠀Estate`(점자 빈칸)도
    t = t.replace(/(\p{L})['’]s(?![\p{L}])/gu, '$1').replace(/(\p{L}{2,})의(?=\s|$)/gu, '$1').replace(/(\p{L})の(?=\p{L})/gu, '$1');
    t = t.replace(/^\s*(?:the|a|an)\s+/u, '');
    return t.replace(/[^\p{L}\p{N}]+/gu, '');
}
// 건물 · 본부 이름 꼬리(구역 이름 「Tower Headquarters」 ↔ 로어북 「Tower」)
const GENERIC = /\s+(?:headquarters|hq|building|main\s+office|본부|본청|청사|본사|빌딩|本部|本庁|庁舎)$/iu;
const noGeneric = s => { const t = foldBlank(s).replace(/\([^)]*\)|（[^）]*）/g, ' ').trim(); const u = t.replace(GENERIC, '').trim(); return u && u !== t ? u : t; };
/** 사람 이름: 「Miro Vale (ミロ・ヴェイル)」 · 「ゴルム - Gorm」 · 「Tova / トヴァ」 → 조각들 */
const nameParts = v => MD(v).split(/\s*(?:[/／(（)）,，]|\s[-–—]\s)\s*/u).map(s => s.trim()).filter(s => s && [...s].length >= 2 && [...s].length <= 30);
/**
 * 로어북 항목(entries = [{ content, comment }])에서 장소 후보를 골라요 → [{ key, label, f, zone, summary, from, src, names, owners }]
 *   label = 지도에 쓸 이름 · names = 지도 장소와 견줄 이름들 · owners = 집 주인 이름들(지도에 「<주인>'s Estate」 가 있으면 가 본 곳)
 *   zone = above | below | out | null(층 안 · 모름) · src = floor | home | section | entry(보고 · 시험용) · skipped 에 뺀 것과 까닭
 */
export function lorePlaces(entries, { tr = null } = {}) {
    const out = [], skipped = [], byKey = new Map();
    const list = (Array.isArray(entries) ? entries : []).map(e => (typeof e === 'string' ? { content: e, comment: '' } : { content: String(e?.content ?? ''), comment: String(e?.comment ?? '') }));
    // 사람 이름 모음(③ 글머리가 사람이면 빼요)
    const people = new Set();
    for (const e of list) for (const line of e.content.split(/\r?\n/)) { const m = LINE_KV.exec(line); if (m && NAME_KEY.test(m[1].trim())) for (const n of nameParts(m[2])) people.add(placeNorm(n)); }
    const zoneText = s => (BELOW.test(s) ? 'below' : ABOVE.test(s) ? 'above' : null);
    const add = c => {
        const k = placeNorm(c.label); if (!k || [...k].length < 2) { skipped.push({ name: c.label, why: '이름이 짧아요', from: c.from }); return; }
        const had = byKey.get(k);
        if (had) { if (had.f === null && c.f !== null) had.f = c.f; if (!had.summary && c.summary) had.summary = c.summary; for (const n of c.names) if (!had.names.includes(n)) had.names.push(n); return; }
        const it = { key: `bl-unv:${k}`, f: null, zone: null, summary: '', owners: [], ...c }; byKey.set(k, it); out.push(it);
    };
    for (const e of list) {
        const lines = e.content.split(/\r?\n/), from = MD(e.comment).replace(TAGS, '').trim() || MD(e.comment);
        // 「이름: 설명」 글머리 찾기(① · ③ 설명 요약)
        const descOf = name => {
            const k = placeNorm(noGeneric(name));
            for (let i = 0; i < lines.length; i++) {
                const m = /^\s*[-*•·]\s*(.+)$/u.exec(lines[i]); if (!m) continue;
                const t = MD(m[1]), at = t.search(/[:：]/u); if (at < 1) continue;
                const head = t.slice(0, at).trim();
                if (placeNorm(noGeneric(head)) !== k && !sameName(head.replace(/\([^)]*\)|（[^）]*）/g, ' ').trim(), name)) continue;
                const rest = t.slice(at + 1).trim(); if (rest) return clip(rest);
                for (let j = i + 1; j < lines.length && /^\s{2,}[-*•·]/.test(lines[j]); j++) { const s = MD(lines[j].replace(/^\s*[-*•·]\s*/, '')); if (s) return clip(s); }
            }
            return '';
        };
        // ④ 항목 통째가 장소
        if (LOC_TAG.test(e.comment)) {
            const label = MD(e.comment.replace(LOC_TAG, '')).replace(TAGS, '').trim();
            if (label) add({ label, names: [label], zone: zoneText(label + ' ' + e.content.slice(0, 300)), summary: clip(e.content.replace(/^#.*$/gm, '')), from, src: 'entry' });
            continue;
        }
        // ① 층 안내
        const dir = floorDirectory([e.content]);
        for (const d of dir) add({ label: d.name.replace(/\s*[(（][^)）]*[)）]\s*/g, ' ').trim() || d.name, names: [d.name], f: d.f, summary: descOf(d.name), from, src: 'floor' });
        // ② 거주지 줄(인물 항목 — Name 줄이나 항목 이름이 있어야)
        let owner = [], res = null;
        for (const line of lines) {
            const m = LINE_KV.exec(line); if (!m) continue;
            const k = m[1].trim();
            if (!owner.length && NAME_KEY.test(k)) owner = nameParts(m[2]);
            else if (!res && RES_KEY.test(k) && MD(m[2])) res = MD(m[2]);
        }
        if (res) {
            const tagName = from && [...from].length <= 16 && !/[:：]/.test(from) ? from : '';
            const who = [tagName, ...owner].filter(Boolean);
            if (!who.length) skipped.push({ name: res, why: '집 주인 이름을 못 찾았어요', from });
            else {
                // 보이는 이름: 항목 이름(대개 사용자 언어) → 번역 보기 글 → Name 줄 첫 조각
                const disp = (HANGUL.test(tagName) || KANA.test(tagName)) ? tagName : (owner.map(o => tr?.(o)).find(t => t && !owner.includes(t)) || tagName || owner[0]);
                const label = HANGUL.test(disp) ? `${disp}의 집` : KANA.test(disp) ? `${disp}の家` : `${disp}'s home`;
                const head = res.split(/[,，、]/u)[0].replace(/^(?:a|an|the)\s+/iu, '').trim();
                add({ label, names: [label, head], owners: who, zone: zoneText(res) ?? 'out', summary: clip(res), from, src: 'home' });
            }
        }
        // ③ 장소 · 지리 머리말 밑 글머리(맨 앞 칸 글머리만 · 사람 이름은 빼요)
        let inLoc = 0;
        for (const line of lines) {
            const h = /^\s*(#{1,6})\s*(.*)$/.exec(line);
            if (h) { inLoc = LOC_HEAD.test(h[2]) ? h[1].length : (inLoc && h[1].length > inLoc ? inLoc : 0); continue; }
            if (/^\s*---+\s*$/.test(line)) { inLoc = 0; continue; }
            if (!inLoc) continue;
            const b = /^[-*•·]\s*(.+)$/u.exec(line); if (!b) continue;   // 들여 쓴 글머리(Role · Food 같은 풀이)는 안 봐요
            const t = MD(b[1]), at = t.search(/[:：]/u); if (at < 1) continue;
            const head = t.slice(0, at).trim(), name = head.replace(/\s*[(（][^)）]*[)）]\s*/g, ' ').trim();
            if (!name || [...name].length > 40) continue;
            if (FIELD.test(name) || /[&＆]/.test(name)) { skipped.push({ name, why: '풀이 칸 이름이에요', from }); continue; }
            if (people.has(placeNorm(name))) { skipped.push({ name, why: '사람 이름이에요', from }); continue; }
            add({ label: name, names: [head, name], zone: zoneText(name), summary: descOf(head), from, src: 'section' });
        }
    }
    out.skipped = skipped;
    return out;
}
/** 지도 장소 이름 모음(한 번 만들어 후보마다 써요) */
function mapIndex(places, tr) {
    const names = new Set(), areas = new Set(), rests = [];
    for (const p of Array.isArray(places) ? places : []) {
        if (!p?.name) continue; names.add(p.name); names.add(labelOf(p.name)); if (tr) names.add(tr(p.name));
        if (p.area) {
            areas.add(p.area); if (tr) areas.add(tr(p.area));
            // 건물 이름을 앞에 붙인 장소(「Tower Lobby」 — 구역 「Tower HQ」) ↔ 로어북 「Lobby」
            const a = placeNorm(noGeneric(p.area)), n = placeNorm(p.name);
            if (a && n.length > a.length + 1 && n.startsWith(a)) rests.push(n.slice(a.length));
        }
    }
    const list = [...names].filter(Boolean);
    return { list, keys: new Set([...[...list, ...[...areas].filter(Boolean).map(noGeneric)].map(placeNorm), ...rests]), low: list.map(s => String(s).toLowerCase().replace(/\s+/g, ' ')) };
}
/** 지도 자료에 이미 있는 곳인가(이름 · 번역 이름 · 구역 이름 · 집 주인) */
export function visitedPlace(c, places, { tr = null, index = null } = {}) {
    const ix = index || mapIndex(places, tr);
    for (const n of c.names || [c.label]) {
        if (ix.keys.has(placeNorm(n)) || ix.keys.has(placeNorm(noGeneric(n)))) return true;
        if (ix.list.some(m => sameName(m, n))) return true;
    }
    for (const o of c.owners || []) { const w = String(o).toLowerCase(); if (w && ix.low.some(m => [`${w}'s `, `${w}’s `, `${w}의 `].some(p => headAt(m, p) || headAt(m, p.trim(), true)) || [`${w}の`, `${w}家`].some(p => m.includes(p)))) return true; }   // 띄어 쓰지 않는 일본어 꼴은 예전처럼 어디든
    return false;
}
/** 1.7.6 글 m 에 조각 p 가 낱말 머리(맨 앞 · 글자 · 숫자가 아닌 것 뒤)에서 시작하나 — end = 글 끝에서만. 「ann's 」 가 「joann's cafe」 에, 「수아의 」 가 「지수아의 방」 에 걸리지 않게 */
function headAt(m, p, end = false) {
    for (let i = end ? m.length - p.length : m.indexOf(p); i >= 0; i = end ? -1 : m.indexOf(p, i + 1)) {
        if (end && !m.endsWith(p)) return false;
        if (i === 0 || !/[\p{L}\p{N}]/u.test(m[i - 1])) return true;
    }
    return false;
}
/** 지도에 없는 후보만(지도 자료는 그대로) — 같은 장소 목록 · 같은 후보면 앞 결과를 써요(그 확장이 창을 다시 그릴 때마다 불려요) */
const unvMemo = new WeakMap();
export function unvisitedOf(map, lore, opt = {}) {
    const places = map?.places, list = Array.isArray(lore) ? lore : [];
    const hit = places && typeof places === 'object' ? unvMemo.get(places) : null;
    // 버그 사냥 4: 번역 사전이 늘어도(번역 단추 · 「Moonlit Cafe → 달빛 찻집」) 같은 장소 목록이면 앞 결과를 써서, 이미 지도에 있는 곳이 흐린 점으로 한 번 더 그려졌어요 — 장소 이름의 번역 값도 열쇠에(장소 수만큼만 찾아요)
    const sig = typeof opt.tr === 'function' && Array.isArray(places) ? places.map(p => { try { return String(opt.tr(p?.name) ?? ''); } catch { return ''; } }).join('\u0001') : '';
    if (hit && hit.lore === lore && hit.tr === !!opt.tr && hit.sig === sig) return hit.out;
    const index = mapIndex(places, opt.tr), out = list.filter(c => !visitedPlace(c, places, { ...opt, index }));
    if (places && typeof places === 'object') unvMemo.set(places, { lore, tr: !!opt.tr, sig, out });
    return out;
}

/** 1.7.6 그릴 흐린 점: 지도에 없는 후보(unvisitedOf) 가운데 번역 이름이 지도 장소의 번역 이름과 겹치는 것은 빼고, 이름(label) · 설명(sum)을 번역 사전 값으로(원문 summary 는 그대로) */
function shownGhosts(map, lore, tr) {
    const list = unvisitedOf(map, lore, { tr });
    if (!tr) return list.map(g => ({ ...g }));
    const look = s => { let v = null; try { v = tr(s); } catch { v = null; } return typeof v === 'string' && v.trim() ? v : null; };
    const there = new Set();
    for (const p of Array.isArray(map?.places) ? map.places : []) { const t = p?.name && look(p.name); if (t) { there.add(placeNorm(t)); there.add(placeNorm(labelOf(t))); } }
    const out = [];
    for (const g of list) {
        const t = look(g.label), sum = g.summary ? look(g.summary) : null;
        if (t && t !== g.label && there.has(placeNorm(t))) continue;
        out.push({ ...g, label: t || g.label, ...(sum && sum !== g.summary ? { sum } : {}) });
    }
    return out;
}
/** 1.7.6 번역 다리에 내줄 글: 지금 흐린 점으로 그릴 곳의 이름 · 설명 원문 [{ name, summary }] */
export function unvisitedTexts(map, lore, { tr = null } = {}) {
    if (!Array.isArray(lore) || !lore.length) return [];
    return unvisitedOf(map, lore, { tr }).map(g => ({ name: String(g.label ?? ''), summary: String(g.summary ?? '') }));
}

/** 두 장소 사이 꺾인 선(점 목록). L = floorLayout 결과 · shown = 지금 보이는 장소 이름 모음(같은 줄 사이에 낀 점 판정) */
export function routeOf(L, a, b, shown = null) {
    const A = L.pos.get(a), Bp = L.pos.get(b); if (!A || !Bp) return null;
    const pts = (...p) => p.map(([x, y]) => [r1(x), r1(y)]).filter((q, i, a) => !i || q[0] !== a[i - 1][0] || q[1] !== a[i - 1][1]);
    const between = (P, Q) => [...L.pos].some(([n, o]) => n !== a && n !== b && (!shown || shown.has(n)) && Math.abs(o.y - P.y) < 0.5 && o.x > Math.min(P.x, Q.x) + 0.5 && o.x < Math.max(P.x, Q.x) - 0.5);
    // 같은 줄: 사이에 다른 장소가 없으면 곧게, 있으면 점 아래 복도로
    if (Math.abs(A.y - Bp.y) < 0.5) {
        if (!between(A, Bp)) return pts([A.x, A.y], [Bp.x, Bp.y]);
        const c = A.y + CORRIDOR; return pts([A.x, A.y], [A.x, c], [Bp.x, c], [Bp.x, Bp.y]);
    }
    // 1.7.5 높이가 다른 두 곳: 두 끝 모두 점 바로 아래 복도로 내려와 → 그 줄 복도를 따라 공용 통로(승강기 줄 하나)로 → 통로를 타고 → 상대 줄 복도로 → 점 밑으로 올라가요.
    //   층 사이 · 하늘 · 땅 밑 · 바깥 장소 선이 모두 같은 통로 · 같은 줄 복도에 겹쳐 하나로 보여요. 이름표는 점 위에 있어서 선이 점 밑으로만 드나들면 글자를 안 지나요
    //   (예전: 이웃 층은 띠 경계 계단으로 아래층 이름표를 세로로 뚫고 · 하늘 ↔ 땅 밑은 층 가운데에서 꺾여 방 점을 지났어요)
    const [U, D] = A.y < Bp.y ? [A, Bp] : [Bp, A];
    const bi = L.hub?.get([a, b].sort().join('|')) ?? U.b ?? D.b ?? 0, bd = L.buildings[bi] || L.buildings[0];
    const sx = bd.shaftX ?? r1(bd.shaftL + (bd.shaftW || 0) / 2);
    return pts([U.x, U.y], [U.x, U.y + CORRIDOR], [sx, U.y + CORRIDOR], [sx, D.y + CORRIDOR], [D.x, D.y + CORRIDOR], [D.x, D.y]);
}
/** 1.7.5 선 여럿을 토막으로 쪼개 같은 줄에서 겹치는 토막을 합쳐요(한 path 로 그려 진하기가 쌓이지 않게) — skip = 이미 그린 토막 목록(그 위는 빼요) */
export function mergeSegments(routes, skip = null) {
    const lines = new Map();   // 'h|y' · 'v|x' → [[from, to]]
    const add = (map, p, q) => {
        if (p[0] === q[0] && p[1] === q[1]) return;
        const h = p[1] === q[1], k = `${h ? 'h' : 'v'}|${h ? p[1] : p[0]}`, a = h ? p[0] : p[1], b = h ? q[0] : q[1];
        if (!map.has(k)) map.set(k, []); map.get(k).push([Math.min(a, b), Math.max(a, b)]);
    };
    for (const pts of routes) for (let i = 1; i < pts.length; i++) add(lines, pts[i - 1], pts[i]);
    const out = [];
    for (const [k, list] of lines) {
        list.sort((x, y) => x[0] - y[0]);
        const merged = [];
        for (const s of list) { const last = merged[merged.length - 1]; if (last && s[0] <= last[1] + 0.01) last[1] = Math.max(last[1], s[1]); else merged.push([...s]); }
        // 이미 그린 토막을 빼요
        let parts = merged;
        for (const [a0, a1] of skip?.get(k) || []) parts = parts.flatMap(([b0, b1]) => (a1 <= b0 || a0 >= b1 ? [[b0, b1]] : [[b0, a0], [a1, b1]].filter(([u, v]) => v - u > 0.05)));
        for (const [u, v] of parts) out.push({ k, u, v });
    }
    const map = new Map(); for (const { k, u, v } of out) { if (!map.has(k)) map.set(k, []); map.get(k).push([u, v]); }
    const d = out.map(({ k, u, v }) => { const [o, c] = k.split('|'), n = Number(c); return o === 'h' ? `M${r1(u)} ${n} L${r1(v)} ${n}` : `M${n} ${r1(u)} L${n} ${r1(v)}`; }).join(' ');
    return { d, lines: map };
}

/** 보이는 장소(와 그 건물 띠)를 감싸는 viewBox — 그 확장 fitBox 와 같은 여백. 건물이 높으면 세로로 조금(최대 TALL 배) 길게 둬요(글자가 덜 작아지게) */
export const TALL = 1.25;
export function fitFloors(L, shown) {
    const { xs, ys } = floorsExtent(L, shown);
    return fitXY(xs, ys);
}
function floorsExtent(L, shown) {
    const xs = [], ys = [];
    for (const [n, o] of L.pos) if (!shown || shown.has(n)) { xs.push(o.x - 10, o.x + 10); ys.push(o.y - 12, o.y + 10); }
    for (const b of L.buildings) if (bShown(L, b, shown) || ghostOf(L, shown)) { xs.push(b.left - 4, b.right + 2); ys.push(b.top - 3, b.bottom + 3); }
    return { xs, ys };
}
/** 1.7.9 층별 그림이 차지하는 상자 [x0, y0, x1, y1](보기 칸 여백 · 오른쪽 비움 몫 빼고) */
export function floorsContent(L, shown) {
    const { xs, ys } = floorsExtent(L, shown);
    return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null;
}
/**
 * 1.7.9 「＋ · －」 확대: 그 확장은 보기 칸 가운데를 축으로 늘려요 — 층별 처음 칸은 오른쪽 22%(확대 단추 줄 자리)가 비어 있어 가운데가 그림보다 오른쪽이라,
 *   「＋」 한 번에 건물 왼쪽(층 이름표 · 맨 왼쪽 방 점 · 이름)이 칸 밖으로 밀렸어요(사용자 폰 · 리그 375 · 412 에서 건물 왼쪽 56 ~ 66px 잘림 · 오른쪽 170px 넘게 빔).
 *   → 지금 보이는 그림 몫의 가운데를 축으로 늘리고, 그림보다 좁으면 그림 밖 빈 곳이 안 보이게 칸을 그림 안으로 당겨요. 그림 전체보다 넓어지면 처음 칸(null)으로.
 *   vb = 지금 viewBox · content = floorsContent · fit = 처음 칸 · f = 배율(＋ 1/1.4 · － 1.4) → 새 viewBox 또는 null
 */
export function zoomFloors(vb, content, fit, f) {
    if (!Array.isArray(vb) || vb.length !== 4 || !vb.every(Number.isFinite) || !content) return null;
    const w = Math.min(240, Math.max(12, vb[2] * f)), h = Math.min(240, Math.max(12, vb[3] * f));   // 그 확장 zoomBox 와 같은 상 · 하한
    if (fit && f > 1 && w >= fit[2] - 0.05) return null;
    const [cx0, cy0, cx1, cy1] = content;
    const mid = (a0, a1, b0, b1) => { const lo = Math.max(a0, b0), hi = Math.min(a1, b1); return lo < hi ? (lo + hi) / 2 : (b0 + b1) / 2; };
    const place = (c, size, lo, hi) => (size >= hi - lo ? (lo + hi) / 2 - size / 2 : Math.min(Math.max(c - size / 2, lo), hi - size));
    const ax = mid(vb[0], vb[0] + vb[2], cx0, cx1), ay = mid(vb[1], vb[1] + vb[3], cy0, cy1);
    return [place(ax, w, cx0, cx1), place(ay, h, cy0, cy1), w, h].map(r1);
}
function fitXY(xs, ys) {
    if (!xs.length) return [-6, -8, 112, 114];
    // 오른쪽은 그 확장의 확대 단추 줄(지도 오른쪽 아래에 떠 있어요)이 덮어서 조금 비워 둬요 — 건물 옆 바깥 장소(대개 지금 위치)가 단추 밑에 숨지 않게
    //   1.7.0: 비움 몫을 「장소 폭의 몇 %」 가 아니라 「칸 너비의 몫」 으로 — 장소가 가로로 넓게 퍼진 배치(바깥 장소가 많거나 건물이 둘)에서도 확대 단추 줄 밑이 늘 비어요
    const x0 = Math.min(...xs), xr = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const wc = Math.max(40 * (1 - RESERVE), xr - x0), h = Math.max(40, y1 - y0);
    const W = Math.max(wc / (1 - RESERVE), h / TALL), H = Math.max(h, W);   // 가로가 길면 그 확장처럼 정사각형 · 세로가 길면 세로 ÷ 가로 ≤ TALL
    return [x0 - (W * (1 - RESERVE) - wc) / 2, y0 - (H - h) / 2, W, H].map(r1);   // 장소는 오른쪽 비움을 뺀 몫의 가운데
}
/** 건물은 하나도 안 보이고 하늘 · 땅 밑 장소만 보일 때(구역 탭) — 가운데에 흐린 건물 윤곽 */
const ghostOf = (L, shown) => !!shown && !L.buildings.some(b => bShown(L, b, shown)) && [...L.pos].some(([n, o]) => shown.has(n) && (o.zone === 'above' || o.zone === 'below'));
const bShown = (L, b, shown) => { const bi = L.buildings.indexOf(b); return [...L.pos].some(([n, o]) => o.zone === 'b' && o.b === bi && (!shown || shown.has(n))); };

// ── 이름표 두 줄 접기 ──────────────────────────────────────
/** 이름표 글자 너비 어림(글자 크기 3.2 기준): 한글 · 한자 · 가나 3.2 · 그림 글자 4.4 · 공백 1 · 나머지 1.9
 *  버그 사냥 10b: 그림 글자를 1.9 로 셈해 바깥 칸이 좁았어요(크롬 측정 그림 글자 하나 ≈ 4.4) · 이어 붙인 그림 글자(👨‍👩‍👧 · ☕️)는 한 글자로 */
const graphemer = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const PICTO = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const chars = t => (graphemer ? [...graphemer.segment(String(t ?? ''))].map(x => x.segment) : [...String(t ?? '')]);
export const textW = t => chars(t).reduce((s, c) => s + (PICTO.test(c) ? 4.4 : /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(c) ? 3.2 : c === ' ' ? 1 : 1.9), 0);
/** 1.7.0 이름표에 쓸 이름: 「장소 — 설명」 · 「장소 | 설명」 꼴(지금 장소 줄이 그대로 장소 이름이 된 것)은 앞 조각만 */
const LABEL_CUT = new RegExp(`${SP}+[—–|]${SP}+|,${SP}+`);
export function labelOf(name) {
    const t = stripMarks(name), head = trimEdge(t.split(LABEL_CUT)[0]);   // 1.9.1 `Grand⠀Hotel⠀|⠀7F`(점자 빈칸)도   // 1.7.0 쉼표 뒤 묘사도 떼요
    return head && [...head].length >= 2 ? head : t;
}
/** 칸 너비 w 에 맞게 이름을 한 줄 또는 두 줄로 — 띄어쓰기에서 가운데 가까운 곳을 먼저, 없으면 글자 가운데에서 끊어요(줄임표 없이 전체 이름) */
export function wrapLabel(text, w) {
    const t = labelOf(text); if (!t || textW(t) <= w) return [t];
    const sp = [...t.matchAll(/[ \u2800]/g)].map(m => m.index);   // 1.9.1 점자 빈칸 자리에서도 끊어요
    if (!sp.length && textW(t) <= w * 1.35) return [t];   // 1.7.0 띄어쓰기 없는 한 낱말은 조금 넘쳐도 안 끊어요(「Secre / tariat」 처럼 낱말 가운데가 갈리지 않게)
    let lines;
    if (sp.length) { const cut = sp.reduce((b, i) => (Math.abs(textW(t.slice(0, i)) - textW(t.slice(i + 1))) < Math.abs(textW(t.slice(0, b)) - textW(t.slice(b + 1))) ? i : b)); lines = [t.slice(0, cut), t.slice(cut + 1)]; }
    else { const cs = chars(t); let k = 1; while (k < cs.length - 1 && textW(cs.slice(0, k + 1).join('')) <= textW(t) / 2) k++; lines = [cs.slice(0, k).join(''), cs.slice(k).join('')]; }
    // 두 줄로도 칸을 한참 넘는 아주 긴 이름만 줄 끝을 「…」 로(옆 이름표와 겹치지 않게)
    const fit = s => { if (textW(s) <= w * 2) return s; const cs = chars(s); while (cs.length > 1 && textW(cs.join('') + '…') > w * 2) cs.pop(); return cs.join('').trimEnd() + '…'; };
    return lines.map(fit);
}

// ── SVG 에 입히기 ─────────────────────────────────────────
const el = (doc, tag, attrs = {}, text = null) => { const e = doc.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); if (text !== null) e.textContent = text; return e; };
const VB_MODE = 'blFloorsVB';   // ui 에 적는 「보던 칸을 어느 배치 눈금으로 그렸나」(floors · plain)
/** 그 확장이 그린 지도 SVG 하나에 층별 배치를 입혀요 → 입혔으면 배치, 아니면 null(그대로) */
export function applyFloors(svg, map, { ui = null, find = simpleFind, tr = null, dir = null, floors = true, lore = null, annex = true } = {}) {
    if (!svg || svg.getAttribute('data-bl-floors')) return null;
    // 1.7.5 아직 안 가 본 곳: 로어북 장소(lore — lorePlaces) 가운데 지도 자료에 없는 곳 · 구역 탭(ui.mapArea)을 고른 때는 안 그려요(「전체」 에서만)
    // 1.7.6 화면만 번역: 이름 · 카드 설명을 그 확장 번역 사전(tr)으로 — 사전에 없으면 영어 그대로 두고, 번역 단추를 누를 때 번역 다리(src/ext-bridge-tr.js)가 같은 사전에 채워요(unvisitedTexts).
    //   번역 이름이 지도 장소의 번역 이름과 같으면(다른 영어 이름으로 이미 들어온 곳) 흐린 점을 또 그리지 않아요
    const ghosts = lore?.length && !ui?.mapArea ? shownGhosts(map, lore, tr) : [];
    // 1.7.9 부속 자리(「X 대문」 · 「X Gate」 …)는 X 점 하나로(annex — 스위치 annex · 기본 켬)
    const ann = annex ? annexMap(map?.places, tr) : null;
    const L = floors ? floorLayout(map?.places, { find, tr, dir, ghosts, annex: ann }) : null;
    // 버그 사냥 9b: 그 확장이 기억한 보던 칸(ui.mapVB — 끌기 · 확대)은 그때 그린 배치의 눈금이에요. 장소가 바뀌어 층별 배치가 새로 생기거나 없어지면
    //   다른 눈금의 칸이 남아 엉뚱한 곳(빈 곳)을 보여 줬어요 → 어느 배치로 그렸는지 ui 에 적어 두고, 바뀌면 보던 칸을 버려요.
    //   (층별 배치 → 그 확장 배치: 그 확장이 이미 옛 칸으로 그렸으니 다시 그리게 _blRefit 로 알려요 — startMbFloors 가 그려요)
    const mode = L ? 'floors' : 'plain', was = ui?.[VB_MODE];
    if (ui && typeof ui === 'object') { if (was && was !== mode && ui.mapVB) { ui.mapVB = null; if (!L) svg._blRefit = true; } ui[VB_MODE] = mode; }
    if (!L) { svg.setAttribute('data-bl-floors', 'none'); if (ann?.size) plainAnnex(svg, map, ann, { find, tr }); if (ghosts.length) plainGhosts(svg, ghosts, ui); return null; }
    const doc = svg.ownerDocument;
    const nodes = [...svg.querySelectorAll('g.node[data-arg]')];
    const shown = new Set(nodes.map(g => { const p = find(map.places, g.getAttribute('data-arg')); return p ? p.name : g.getAttribute('data-arg'); }));
    for (const [k] of L.ghosts || []) if (L.pos.has(k)) shown.add(k);   // 흐린 점도 자리를 차지해요(같은 줄 선은 그 밑 복도로 · 보기 칸에 넣어요)
    // 점 묶음 옮기기: 원래 점 자리 → 새 자리만큼 translate
    for (const g of nodes) {
        const p = find(map.places, g.getAttribute('data-arg')), to = p && L.pos.get(p.name), dot = g.querySelector('circle.dot');
        if (!to || !dot) continue;
        const dx = r1(to.x - Number(dot.getAttribute('cx'))), dy = r1(to.y - Number(dot.getAttribute('cy')));
        g.setAttribute('transform', `translate(${dx} ${dy})`);
        // 이름표: 그 확장이 8글자에서 줄임표로 자른 것 · 칸보다 긴 것은 전체 이름을 두 줄로 접어요(점 위로 한 줄 더)
        const lab = [...g.querySelectorAll('text')].find(t => !/(?:^|\s)(?:ico|ppl)(?:\s|$)/.test(t.getAttribute('class') || ''));
        if (lab && p && p.known !== false) {
            const now = lab.textContent || '', full = stripMarks(now.endsWith('…') ? (tr?.(p.name) || p.name) : now);   // 1.8.2 「@로비」 → 「로비」(표시만)
            const lines = wrapLabel(full, (to.w || SLOT_W) - 1.5);
            if (lines.length > 1 || full !== now) {
                const lx = lab.getAttribute('x'), ly = Number(lab.getAttribute('y'));
                lab.textContent = '';
                if (lines.length > 1) lab.setAttribute('y', r1(ly - LINE_H));
                lines.forEach((ln, i) => lab.appendChild(el(doc, 'tspan', { x: lx, ...(i ? { dy: LINE_H } : {}) }, ln)));
                lab.setAttribute('data-bl-wrap', String(lines.length));
            }
        }
    }
    // 1.7.0 겹친 같은 곳(대표 + 쌍둥이): 한 점 · 이름표 하나만 보이고(지금 위치 · 고른 곳이 쌍둥이면 그쪽을 보여요), 나머지 이름은 점 옆 「+N」 — 누르면 그곳 카드가 열려요(그 확장의 selplace)
    const nameOf = g => find(map.places, g.getAttribute('data-arg'))?.name ?? g.getAttribute('data-arg');
    const sets = new Map();
    const headName = n => { let k = n; for (let i = 0; i < 4 && L.alias?.has(k); i++) k = L.alias.get(k); return k; };
    for (const g of nodes) { const n = nameOf(g), head = headName(n); if (!sets.has(head)) sets.set(head, []); sets.get(head).push(g); }
    for (const [, gs] of sets) {
        if (gs.length < 2) continue;
        // 1.7.9 부속 자리는 지금 위치여도 본 장소 점이 보여요(지금 고리만 옮겨요)
        const pool = gs.filter(g => !L.annex?.has(nameOf(g))), pick = pool.length ? pool : gs;
        const vis = pick.find(g => /\bhere\b/.test(g.getAttribute('class') || '')) || pick.find(g => /\bsel\b/.test(g.getAttribute('class') || '')) || pick.find(g => !L.alias?.has(nameOf(g))) || pick[0];
        const at = L.pos.get(nameOf(vis)) || L.pos.get(headName(nameOf(vis)));
        tieTwins(vis, gs.filter(g => g !== vis), { nameOf, tr, at, annex: n => !!L.annex?.has(n) });
    }
    for (const n of [...shown]) if (L.alias?.has(n)) shown.add(headName(n));   // 쌍둥이만 보이는 구역 탭이면 대표 이름으로 선을 그려요
    // 선: 그 확장이 그린 곧은 선을 걷고 꺾인 선으로
    const edges = svg.querySelector('g.edges');
    if (edges) {
        const known = new Map(map.places.map(p => [p.name, p.known !== false]));
        // 1.7.5 같은 통로 · 복도를 지나는 선이 겹쳐 그려지면 반투명 선이 겹친 만큼 진해져요 → 아는 곳 선 하나 · 모르는 곳 선 하나(아는 선 위 토막은 빼요)로 합쳐 그려요
        const known2 = [], unk = [];
        for (const [a, b] of L.pairs) {
            if (!shown.has(a) || !shown.has(b)) continue;
            const pts = routeOf(L, a, b, shown); if (!pts) continue;
            (known.get(a) && known.get(b) ? known2 : unk).push(pts);
        }
        const frag = doc.createDocumentFragment();
        const k = mergeSegments(known2), u = mergeSegments(unk, k.lines);
        if (k.d) frag.appendChild(el(doc, 'path', { d: k.d, class: 'bl-route' }));
        if (u.d) frag.appendChild(el(doc, 'path', { d: u.d, class: 'bl-route unk' }));
        edges.replaceChildren(frag);
    }
    // 층 띠 · 이름표 · 승강기 줄 · 땅 선(누르기 · 끌기는 그 아래 SVG 가 받아요)
    const deco = el(doc, 'g', { class: 'bl-floors', 'pointer-events': 'none', 'aria-hidden': 'true' });
    let gx0 = Infinity, gx1 = -Infinity;
    for (const b of L.buildings) {
        if (!bShown(L, b, shown)) continue;
        deco.appendChild(el(doc, 'rect', { class: 'bl-bldg', x: r1(b.left), y: r1(b.top), width: r1(b.right - b.left), height: r1(b.bottom - b.top), rx: 1.2 }));
        b.rows.forEach((r, k) => {
            const y = L.rowTop.get(r);
            deco.appendChild(el(doc, 'rect', { class: `bl-band${k % 2 ? ' alt' : ''}${r < 1 ? ' under' : ''}`, x: r1(b.left), y: r1(y), width: r1(b.right - b.left), height: r1(L.rowH(r)) }));
            deco.appendChild(el(doc, 'text', { class: 'bl-ftag', x: r1(b.left + TAG_W / 2), y: r1(L.dotY(r) + 1.1) }, tagOf(r)));
        });
        if (b.shaftW) deco.appendChild(el(doc, 'rect', { class: 'bl-shaft', x: r1(b.shaftL + 0.6), y: r1(b.top + 0.6), width: r1(b.shaftW - 1.2), height: r1(b.bottom - b.top - 1.2), rx: 0.6 }));
        gx0 = Math.min(gx0, b.left); gx1 = Math.max(gx1, b.right);
    }
    if (ghostOf(L, shown)) for (const b of L.buildings) deco.appendChild(el(doc, 'rect', { class: 'bl-bldg ghost', x: r1(b.left), y: r1(b.top), width: r1(b.right - b.left), height: r1(b.bottom - b.top), rx: 1.2 }));
    for (const [n, o] of L.pos) if (shown.has(n) && o.zone === 'out') { gx0 = Math.min(gx0, o.x - SLOT_W / 2); gx1 = Math.max(gx1, o.x + SLOT_W / 2); }
    // 땅(1층 바닥): 건물 밖으로만 — 건물 안은 띠 경계가 바닥이에요
    const bl = Math.min(...L.buildings.map(b => b.left)), br = Math.max(...L.buildings.map(b => b.right)), gy = r1(L.groundY);
    if (Number.isFinite(gx0)) for (const [a, b] of [[gx0 - 3, bl], [br, gx1 + 3]]) if (b - a > 1) deco.appendChild(el(doc, 'line', { class: 'bl-ground', x1: r1(a), y1: gy, x2: r1(b), y2: gy }));
    svg.insertBefore(deco, svg.firstChild);
    if (L.ghosts?.size) drawGhosts(svg, [...L.ghosts.values()].filter(g => L.pos.has(g.key)).map(g => ({ g, o: L.pos.get(g.key) })), ui);
    svg.setAttribute('data-bl-floors', 'on');
    svg._blFloors = L;
    svg._blContent = floorsContent(L, shown); svg._blFit = fitFloors(L, shown);
    if (!ui?.mapVB) svg.setAttribute('viewBox', svg._blFit.join(' '));
    return L;
}

/** 겹친 점 묶음: vis 하나만 보이고 나머지는 숨겨요 · vis 옆 「+N」(누르면 숨은 곳 카드) · 숨은 부속 자리가 지금 위치 · 고른 곳이면 vis 에 고리 · 고름 */
const hasCls = (g, c) => ` ${g.getAttribute('class') || ''} `.replace(/\s+/g, ' ').includes(` ${c} `);
function tieTwins(vis, others, { nameOf, tr = null, at = null, annex = () => false }) {
    if (!vis || !others.length) return;
    const doc = vis.ownerDocument;
    for (const g of others) { g.setAttribute('display', 'none'); g.setAttribute('data-bl-twin', nameOf(vis)); }
    const dot = vis.querySelector('circle.dot');
    // 버그 사냥 10b: 점이 없는 묶음(옮기지 않았어요)이면 좌표가 NaN 이었어요 → 배치 자리
    let cx = Number(dot?.getAttribute('cx')), cy = Number(dot?.getAttribute('cy'));
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) { cx = at?.x ?? 0; cy = at?.y ?? 0; }
    const ann = others.filter(g => annex(nameOf(g))), hereAnn = ann.find(g => hasCls(g, 'here'));
    if (hereAnn && !hasCls(vis, 'here')) {
        vis.setAttribute('class', `${vis.getAttribute('class') || ''} here`.trim()); vis.setAttribute('data-bl-annex-here', nameOf(hereAnn));
        if (dot) { dot.setAttribute('r', '3.2'); vis.insertBefore(el(doc, 'circle', { cx: r1(cx), cy: r1(cy), r: 4.6, class: 'ring' }), dot); }
    }
    if (ann.some(g => hasCls(g, 'sel')) && !hasCls(vis, 'sel')) vis.setAttribute('class', `${vis.getAttribute('class') || ''} sel`.trim());
    const first = hereAnn || others[0];
    const badge = el(doc, 'text', { class: `bl-twin${ann.length ? ' bl-annex' : ''}`, x: r1(cx - 4.1), y: r1(cy + 1.2), 'data-act': 'selplace', 'data-arg': first.getAttribute('data-arg') }, `+${others.length}`);
    badge.appendChild(el(doc, 'title', {}, others.map(g => tr?.(nameOf(g)) || nameOf(g)).join(' · ')));
    vis.appendChild(badge);
}
/** 1.7.9 층별 보기가 아닌 지도(그 확장 배치): 부속 자리 점을 숨기고 그 점에 닿던 선 끝을 본 장소 점으로 옮겨요 */
function plainAnnex(svg, map, ann, { find = simpleFind, tr = null } = {}) {
    if (hasCls(svg, 'line')) return;   // 노선도 보기(그 확장 「새 지도」)는 그대로
    const nameOf = g => find(map.places, g.getAttribute('data-arg'))?.name ?? g.getAttribute('data-arg');
    const nodes = new Map([...svg.querySelectorAll('g.node[data-arg]')].map(g => [nameOf(g), g]));
    const dotAt = g => { const d = g?.querySelector('circle.dot'); return d ? [Number(d.getAttribute('cx')), Number(d.getAttribute('cy'))] : null; };
    const groups = new Map();
    for (const [a, b] of ann) { const ga = nodes.get(a), gb = nodes.get(b); if (!ga || !gb || !dotAt(ga) || !dotAt(gb)) continue; if (!groups.has(b)) groups.set(b, []); groups.get(b).push(ga); }
    if (!groups.size) return;
    const lines = [...(svg.querySelector('g.edges')?.querySelectorAll('line') || [])];
    for (const [b, gs] of groups) {
        const to = dotAt(nodes.get(b));
        for (const g of gs) {
            const [x, y] = dotAt(g);
            for (const ln of lines) for (const e of ['1', '2']) if (Math.abs(Number(ln.getAttribute('x' + e)) - x) < 0.05 && Math.abs(Number(ln.getAttribute('y' + e)) - y) < 0.05) { ln.setAttribute('x' + e, to[0]); ln.setAttribute('y' + e, to[1]); }
        }
        tieTwins(nodes.get(b), gs, { nameOf, tr, annex: () => true });
    }
    // 부속 ↔ 본 장소 선은 점 하나가 되고, 부속 · 본 장소가 같은 곳으로 잇던 선은 둘이 겹쳐요 → 하나만
    const seen = new Set();
    for (const ln of lines) {
        const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map(k => r1(Number(ln.getAttribute(k))));
        const key = [`${x1},${y1}`, `${x2},${y2}`].sort().join('|') + '|' + (ln.getAttribute('class') || '');
        if ((x1 === x2 && y1 === y2) || seen.has(key)) ln.remove?.(); else seen.add(key);
    }
}

// ── 아직 안 가 본 곳 그리기(1.7.5) ─────────────────────────────────────
const GH_ATTR = 'data-bl-unv';
/** 흐린 점 묶음: 점선 동그라미 · 흐린 이름표(두 줄 접기) · 점 밑 「아직 안 가 본 곳」 · 누를 자리(그 확장 장소 점과 따로 — data-act 없음) */
function drawGhosts(svg, items, ui = null) {
    if (!items.length) return null;
    const doc = svg.ownerDocument, layer = el(doc, 'g', { class: 'bl-unvs' });
    for (const { g, o } of items) {
        const sel = ui?.blGhost === g.key;
        const n = el(doc, 'g', { class: `bl-unv${sel ? ' sel' : ''}`, [GH_ATTR]: g.key, role: 'button', tabindex: '0', 'aria-label': `${g.label} · ${GH_TAG}` });
        n.appendChild(el(doc, 'circle', { class: 'bl-unv-hit', cx: o.x, cy: o.y, r: 5.5 }));
        n.appendChild(el(doc, 'circle', { class: 'bl-unv-dot', cx: o.x, cy: o.y, r: 2.6 }));
        const lines = wrapLabel(g.label, (o.w || SLOT_W) - 1.5);
        const lab = el(doc, 'text', { class: 'bl-unv-name', x: o.x, y: r1(o.y - 4.4 - (lines.length - 1) * LINE_H) });
        lines.forEach((ln, i) => lab.appendChild(el(doc, 'tspan', { x: o.x, ...(i ? { dy: LINE_H } : {}) }, ln)));
        n.appendChild(lab);
        n.appendChild(el(doc, 'text', { class: 'bl-unv-tag', x: o.x, y: r1(o.y + 5.6) }, GH_TAG));
        n._blGhost = g;
        layer.appendChild(n);
    }
    const edges = svg.querySelector('g.edges');
    svg.insertBefore(layer, edges ? edges.nextSibling : svg.firstChild);
    svg._blGhosts = items.map(({ g }) => g);
    return layer;
}
/** 층별 보기가 아닌 지도(그 확장 배치): 하늘 쪽은 맨 위 점들 위에, 나머지(땅 밑 · 바깥 · 모름)는 맨 아래 점들 밑에 줄로 */
export function plainSpots(dots, ghosts) {
    if (!dots.length || !ghosts.length) return [];
    const xs = dots.map(d => d.x), ys = dots.map(d => d.y);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), mid = (x0 + x1) / 2;
    const out = [];
    for (const [side, list] of [[-1, ghosts.filter(g => g.zone === 'above')], [1, ghosts.filter(g => g.zone !== 'above')]]) {
        if (!list.length) continue;
        const { slot, step } = ghostGrid(list.map(g => g.label));
        const cap = Math.max(GH_CAP0, Math.floor((x1 - x0) / slot) + 1);
        list.forEach((g, i) => {
            const row = Math.floor(i / cap), inRow = Math.min(cap, list.length - row * cap), col = i % cap;
            out.push({ g, o: { x: r1(mid + (col - (inRow - 1) / 2) * slot), y: r1(side < 0 ? y0 - step * (row + 1) : y1 + step * (row + 1)), w: slot, zone: g.zone || 'out' } });
        });
    }
    return out;
}
function plainGhosts(svg, ghosts, ui) {
    const dots = [...svg.querySelectorAll('g.node')].map(g => g.querySelector('circle.dot')).filter(Boolean).map(c => ({ x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')) })).filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));
    const items = plainSpots(dots, ghosts); if (!items.length) return;
    drawGhosts(svg, items, ui);
    if (!ui?.mapVB) { const xs = [], ys = []; for (const o of [...dots, ...items.map(i => i.o)]) { xs.push(o.x - 10, o.x + 10); ys.push(o.y - 12, o.y + 10); } svg.setAttribute('viewBox', fitXY(xs, ys).join(' ')); }
}
const FLOOR_TAG = f => (f >= 1 ? `${f}F` : `B${-f}`);
/** 누른 흐린 점의 카드: 그 확장 장소 카드 자리에(그 확장 카드는 잠깐 숨겨요 — 다른 장소를 누르면 그 확장이 다시 그려요) */
export function showGhostCard(panel, g) {
    const doc = panel?.ownerDocument; if (!doc || !g) return null;
    panel.querySelector?.('.bl-unv-card')?.remove();
    for (const c of panel.querySelectorAll?.('.ss-place[data-bl-unv-hid]') || []) { c.style.display = ''; c.removeAttribute('data-bl-unv-hid'); }
    const mk = (tag, cls, text) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
    const card = mk('div', 'ss-card ss-place bl-unv-card'), head = mk('div', 'ss-place-h');
    head.append(mk('b', '', g.label), mk('span', 'ss-chip bl-unv-chip', GH_TAG));
    if (Number.isFinite(g.f) && g.f) head.append(mk('span', 'ss-chip', FLOOR_TAG(g.f)));
    card.append(head);
    if (g.sum ?? g.summary) card.append(mk('p', 'ss-pre ss-dim ss-notr', g.sum ?? g.summary));   // 로어북 원문 그대로(그 확장 화면 번역이 낱말만 바꿔 섞이지 않게 · .ss-notr = 그 확장이 건너뛰는 표식)
    card.append(mk('p', 'ss-hint', `로어북${g.from ? ` 「${g.from}」` : ''}에 적힌 곳이에요 · 이야기에 나와 지도에 들어오면 흐린 표시가 사라지고 원래 점으로 그려져요.`));
    const theirs = [...(panel.querySelectorAll?.('.ss-place') || [])].find(c => c !== card && !c.classList.contains('bl-unv-card'));
    if (theirs) { theirs.style.display = 'none'; theirs.setAttribute('data-bl-unv-hid', ''); theirs.parentNode.insertBefore(card, theirs); }
    else { const wrap = panel.querySelector?.('.ss-mapwrap'), after = wrap?.nextElementSibling?.matches?.('.ss-hint') ? wrap.nextElementSibling : wrap; if (!after) return null; after.parentNode.insertBefore(card, after.nextSibling); }
    return card;
}

/** 1.8.2 요소 안 첫 글 조각 앞의 표시 기호(@ · #)를 떼요(그 확장이 다시 그리면 원래대로 · 자료는 그대로) → 뗐나 */
export function markText(el) {
    const walk = n => { for (const c of n?.childNodes || []) { if (c.nodeType === 3) { if (String(c.nodeValue || '').trim()) return c; continue; } if (c.nodeType === 1) { const r = walk(c); if (r) return r; } } return null; };
    const t = walk(el); if (!t) return false;
    const v = String(t.nodeValue), u = v.replace(/^([\s\u2800]*)[@＠#＃]+[\s\u2800]*(?=[^\s\u2800])/u, '$1');   // 버그 사냥 6 점자 빈칸(U+2800)도 빈칸
    if (u === v) return false;
    t.nodeValue = u; return true;
}
/** 1.8.2 (미트볼 띠) 위치 칩 · 펼친 위치 줄(📍 아이콘 바로 뒤 글)의 앞 표시 기호(@ · #)를 떼요 — 모델이 「loc: @Lobby」 처럼 적으면 원작이 그대로 장소 이름으로 써요(표시만 · 자료는 그대로) → 뗀 수 */
export function markLocMarks(root) {
    let n = 0;
    for (const ic of root?.querySelectorAll?.('.fa-location-dot') || []) {
        let t = null;
        for (let s = ic.nextSibling; s && !t; s = s.nextSibling) {
            if (s.nodeType === 3) { if (String(s.nodeValue || '').trim()) t = s; }
            else if (s.nodeType === 1) { const dfs = x => { for (const c of x.childNodes || []) { if (c.nodeType === 3) { if (String(c.nodeValue || '').trim()) return c; } else if (c.nodeType === 1) { const r = dfs(c); if (r) return r; } } return null; }; t = dfs(s); }   // 버그 사냥 6 글 차례대로(예전엔 얕은 것부터 — 「<b>@로비</b> — 설명」 이면 설명 글을 집어 이름 앞 기호가 남았어요)
        }
        if (!t) continue;
        const v = String(t.nodeValue), u = v.replace(/^([\s\u2800]*)[@＠#＃]+[\s\u2800]*(?=[^\s\u2800])/u, '$1');   // 버그 사냥 6 점자 빈칸(U+2800)도 빈칸
        if (u !== v) { t.nodeValue = u; n++; }
    }
    return n;
}
/** 버그 사냥 6 그 확장 창 · 띠 · 알림 안의 장소 이름 앞 기호(표시만 · src/mb-place-mark.js): 위치 아이콘 뒤 글(상태 칸 위치 타일 · 펼친 위치 줄 · 의뢰 장소) ·
 *  「갈 곳」 칩 이름 · 검색 결과의 📍 줄 이름 · 「📍 @…」 · 「🗺️ 새 장소: @…」 꼴 글(알림 · 하루 정리 · 기록 · 검색 글 · 띠) → 뗀 수 */
export const PLACE_SCOPE = '#ss-hud, .ss-scope, .ss-root, .ss-panel, #ss-side, #ss-float, #ss-toasts, .ss-toasts, #toast-container';
export function markPlaces(root, { pin = true, blank = false } = {}) {
    if (!root || root.nodeType !== 1 || root.closest?.('#ss-settings')) return 0;
    let n = blank ? pinNodes(root, { pin: false, blank: true }) : 0;   // 점자 빈칸을 먼저(그 뒤 기호 떼기가 보통 빈칸으로 봐요)
    if (!pin) return n;
    n += markLocMarks(root);
    const all = sel => [...(root.matches?.(sel) ? [root] : []), ...(root.querySelectorAll?.(sel) || [])];
    for (const b of all('.ss-loc-go > b')) if (dropLead(b)) n++;
    for (const row of all('.ss-note')) {
        if (String(row.querySelector(':scope > .ss-t-ico')?.textContent ?? '').trim() !== '📍') continue;   // 검색 결과 · 알림함의 장소 줄만(SNS · 메신저 줄은 그대로)
        const b = row.querySelector(':scope > .ss-t-b > b'); if (b && dropLead(b)) n++;
    }
    return n + pinNodes(root);
}
/** 버그 사냥 6 지금 켜진 표시 다듬기(장소 앞 기호 annex · 점자 빈칸 blank) — 감시자 · 칩 칠하기가 같이 봐요 */
export const tidyOpts = doc => ({ pin: mbFit('annex', doc), blank: mbFit('blank', doc) });
// ── 붙이기 ─────────────────────────────────────────────
const rawView = doc => !!doc?.body?.hasAttribute?.('data-bl-ext-raw');
const isOn = doc => doc?.body?.getAttribute?.(FLOOR_ATTR) === 'on' && !rawView(doc);
async function mbCore(doc, load = url => import(url)) { return mbImport('./src/core.js', doc, load); }   // 1.9.2 공용 찾기(src/mb-util.js)
let started = false;
export function startMbFloors(doc = globalThis.document, { watch = watchDom, load = undefined, stCtx = () => globalThis.SillyTavern?.getContext?.() } = {}) {
    if (started || !doc?.body) return false;
    started = true;
    let core = null;
    const mapNow = () => { try { return core?.app?.current?.state?.data?.map || null; } catch { return null; } };
    const trFn = () => { try { return core?.viewTr?.() ? (s => core.trLook?.(s) ?? s) : null; } catch { return null; } };
    const findFn = () => (core?.findBy ? (list, name) => core.findBy(list, name) || null : simpleFind);
    // 1.7.5 「아직 안 가 본 곳」(미트볼 맞춤 스위치 unvisited · 기본 켬)은 층별 보기를 꺼도 그 확장 그림 위에 따로 그려요
    const ghostOn = () => mbFit('unvisited', doc);
    const annexOn = () => mbFit('annex', doc);   // 1.7.9 부속 자리 묶기(스위치 annex · 기본 켬)
    const active = () => isOn(doc) || ghostOn() || annexOn();
    // 1.7.6 번역 다리(src/ext-bridge-tr.js)가 번역 단추를 누른 뒤 가져가는 글 — 서로 부르지 않게 문서 밖 등록부 하나(스위치를 껐거나 로어북을 아직 못 읽었으면 빈 목록)
    //   버그 사냥 4: 지도를 열지 않고 다른 채팅 · 캐릭터로 넘어가 번역 단추를 누르면 앞 채팅 로어북의 장소 글이 새 채팅 번역 요청 · 사전에 실렸어요 — 내주기 전에 지금 채팅 것인지 맞춰 보고(loadDir) 읽는 중이면 빈 목록
    try { globalThis[Symbol.for('blue-lemonade.mb-unvisited.v1')] = () => { try { if (!ghostOn() || !core) return []; loadDir(); return !dirNow.wait && !dirNow.busy ? unvisitedTexts(mapNow(), dirNow.lore, { tr: trFn() }) : []; } catch { return []; } }; } catch { /* 번역은 그 확장이 아는 글만 */ }
    const dress = svg => {
        if (!active() || !core || svg.getAttribute('data-bl-floors')) return;
        const map = mapNow(); if (!map) return;
        const panel = svg.closest?.('.ss-panel'), ui = panel?._ss?.ui ?? null;
        loadDir();
        if (dirNow.wait) return;   // 1.7.6 다른 캐릭터의 로어북을 읽는 중 — 앞 캐릭터의 층 안내 · 장소로 그리지 않고, 다 읽으면 그 자리에서 입혀요(아래 loadDir)
        try { applyFloors(svg, map, { ui, find: findFn(), tr: trFn(), dir: dirNow.list, floors: isOn(doc), lore: ghostOn() ? dirNow.lore : null, annex: annexOn() }); } catch (error) { svg.setAttribute('data-bl-floors', 'none'); console.warn('[Blue Lemonade] 미트볼 층별 지도', error); }
        // 누른 흐린 점이 있으면(그 확장이 다시 그려도) 카드를 다시 놓아요
        if (annexOn() && panel) for (const b of panel.querySelectorAll?.('.ss-hint > b, .ss-place-h > b') || []) markText(b);   // 1.8.2 「지금 @로비」 · 카드 이름 앞 기호(표시만)
        if (ui?.blGhost) { const g = svg._blGhosts?.find(x => x.key === ui.blGhost); if (g) showGhostCard(panel, g); else ui.blGhost = null; }
        if (svg._blRefit && panel?._ss) { svg._blRefit = false; try { core.app?.renderPanel?.(panel); } catch { /* 다음에 그릴 때 */ } }   // 버그 사냥 9b: 층별 배치가 없어져 옛 눈금 칸으로 그려진 지도 — 보던 칸을 비웠으니 그 확장이 다시 맞춰 그려요
    };
    const sweep = () => { for (const svg of doc.querySelectorAll('svg.ss-map:not([data-bl-floors])')) dress(svg); };
    const redraw = () => {
        // 켜고 끌 때: 지도가 떠 있는 창을 그 확장이 다시 그리게(보던 viewBox 는 좌표 눈금이 달라 비워요)
        for (const svg of doc.querySelectorAll('svg.ss-map')) {
            const panel = svg.closest?.('.ss-panel'); if (!panel?._ss) continue;
            panel._ss.ui.mapVB = null;
            try { core?.app?.renderPanel?.(panel); } catch { /* 다음에 그릴 때 */ }
        }
    };
    // 1.7.4 로어북 층 안내: 이 채팅에 걸린 로어북(카드 · 카드 안 책 · 채팅 로어북)을 한 번 읽어 두고, 안내가 바뀌면 떠 있는 지도를 다시 그려요
    // 1.7.5 같은 로어북에서 장소 후보(lorePlaces)도 같이 — 채팅 · 로어북이 바뀔 때만 읽어요(메시지마다 안 돌아요)
    // 1.7.6 캐릭터(모임)가 바뀌면 앞 캐릭터의 목록을 비우고 다 읽을 때까지 입히기를 미뤄요(wait) — 예전엔 앞 캐릭터의 장소로 한 번 그렸다가 다시 그렸어요(리그: B 의 지도에 A 의 「달빛 찻집」).
    //   같은 캐릭터의 다른 채팅은 로어북이 거의 같아 예전처럼 바로 그리고, 달라졌을 때만 다시 그려요
    const dirNow = { key: null, card: null, wait: false, stale: false, busy: false, list: [], lore: [], gen: 0, reads: 0 };   // busy = 읽는 중(같은 캐릭터의 다른 채팅이라 wait 없이 옛 목록으로 그리는 동안 · 번역 다리에는 안 내줘요)
    const loadDir = () => {
        let c, key, card; try { c = stCtx(); if (!c) return; card = `${c.groupId ?? ''}|${c.characterId ?? ''}`; key = `${card}|${c.getCurrentChatId?.() ?? ''}|${c.chatMetadata?.world_info ?? ''}`; } catch { return; }
        if (key === dirNow.key) return;
        dirNow.key = key; const gen = ++dirNow.gen; dirNow.busy = true;
        if (card !== dirNow.card) { dirNow.card = card; dirNow.list = []; dirNow.lore = []; dirNow.wait = true; }
        else if (dirNow.stale) dirNow.wait = true;   // 1.7.9 지도가 없는 동안 로어북이 저장됐어요 — 옛 목록으로 먼저 그리지 않고 읽은 뒤 한 번에 입혀요
        dirNow.stale = false;
        if (dirNow.wait) setTimeout(() => { if (gen === dirNow.gen && dirNow.wait) { dirNow.wait = false; sweep(); } }, 3000);   // 로어북 읽기가 안 끝나도 지도는 입혀요(안내 없이)
        (async () => {
            const texts = [], entries = [], names = new Set(); dirNow.reads++;
            const cards = c.groupId ? (c.groups?.find?.(g => g.id === c.groupId)?.members || []).map(a => c.characters?.find?.(x => x.avatar === a)) : [c.characters?.[c.characterId]];
            for (const ch of cards) { const w = ch?.data?.extensions?.world; if (w) names.add(String(w)); for (const e of ch?.data?.character_book?.entries || []) if (e?.enabled !== false) { texts.push(e?.content); entries.push({ content: e?.content, comment: e?.comment ?? e?.name }); } }
            if (c.chatMetadata?.world_info) names.add(String(c.chatMetadata.world_info));
            for (const n of names) { try { const b = await c.loadWorldInfo?.(n); for (const e of Object.values(b?.entries || {})) if (!e?.disable) { texts.push(e?.content); entries.push({ content: e?.content, comment: e?.comment }); } } catch { /* 그 책은 빼요 */ } }
            return { list: floorDirectory(texts), lore: lorePlaces(entries, { tr: trFn() }) };
        })().then(({ list, lore }) => {
            if (gen !== dirNow.gen) return;
            const waited = dirNow.wait; dirNow.wait = false; dirNow.busy = false;
            const was = JSON.stringify([dirNow.list, dirNow.lore]); dirNow.list = list; dirNow.lore = lore;
            // 기다리던 지도(아직 안 입힌 것)는 그 자리에서 입히고, 이미 입혀 둔 지도가 있으면(창을 연 채 넘어온 때 · 같은 캐릭터에서 바뀐 때) 그 확장이 다시 그리게 해요
            const dressed = !waited || [...doc.querySelectorAll('svg.ss-map[data-bl-floors]')].length > 0;
            if (dressed && JSON.stringify([list, lore]) !== was && active()) redraw();
            if (waited) sweep();
        }).catch(() => { if (gen === dirNow.gen) dirNow.busy = false; if (gen === dirNow.gen && dirNow.wait) { dirNow.wait = false; sweep(); } });   // 못 읽으면 안내 없이 입혀요
    };
    // 1.7.6 층별 보기 · 안 가 본 곳이 다 꺼져 있으면 읽지 않아요(다시 켜면 그릴 때 loadDir 가 읽어요)
    // 1.7.9 지도가 화면에 없을 때도 읽지 않아요 — 로어북 편집 창은 글자를 칠 때마다 저장해서, 그때마다 걸린 로어북 전부를 훑었어요(node: 300항목 1.8ms · 1,000항목 6ms · 폰 4배면 그 4배).
    //   표시만 해 두고(stale) 다음에 지도를 그릴 때 한 번 읽어요(dress → loadDir)
    const mapShown = () => { try { return (typeof doc.getElementsByClassName === 'function' ? doc.getElementsByClassName('ss-map') : doc.querySelectorAll('svg.ss-map')).length > 0; } catch { return true; } };
    try { const c = stCtx(), ev = c?.eventTypes ?? c?.event_types; for (const k of ['WORLDINFO_UPDATED', 'CHARACTER_EDITED']) if (ev?.[k]) c.eventSource?.on?.(ev[k], () => { dirNow.key = null; if (!active()) return; if (mapShown()) loadDir(); else dirNow.stale = true; }); } catch { /* 채팅이 바뀔 때만 새로 읽어요 */ }
    (load ? Promise.resolve(load()) : mbCore(doc)).then(m => { core = m; sweep(); }).catch(() => { /* 그 확장 그림 그대로 */ });
    try {
        watch(doc.body, { childList: true, subtree: true, exclude: '#chat', name: '미트볼 층별 지도' }, records => {
            if (!core) return;
            const opt = tidyOpts(doc), pin = opt.pin || opt.blank;   // 버그 사냥 6 지도 기능을 다 꺼도 점자 빈칸 다듬기는 돌아요
            const map = active();
            for (const r of records) for (const n of r.addedNodes || []) {
                if (n.nodeType === 3) { const p = n.parentElement; if (pin && p?.closest?.(PLACE_SCOPE)) markPlaces(p, opt); continue; }   // 버그 사냥 6 글만 갈아 끼운 칸(textContent)
                if (n.nodeType !== 1) continue;
                if (n.id === 'ss-hud' || n.closest?.('#ss-hud')) { if (pin) markPlaces(n, opt); continue; }   // 1.8.2 띠 위치 칩 · 펼친 위치 줄 「@로비」(표시만 · 띠 안에 지도는 없어요)
                if (pin && n.closest?.(PLACE_SCOPE)) markPlaces(n, opt);   // 버그 사냥 6 상태 칸 위치 타일 · 갈 곳 · 검색 결과 · 알림 · 기록 줄
                if (!map) continue;
                if (n.matches?.('svg.ss-map')) dress(n);
                else if (n.firstElementChild) for (const svg of n.querySelectorAll?.('svg.ss-map:not([data-bl-floors])') || []) dress(svg);
            }
        });
    } catch { /* 처음 훑은 것만 */ }
    try { watch(doc.body, { attributes: [FLOOR_ATTR, 'data-bl-ext-raw'], name: '미트볼 층별 지도 (켜고 끄기)' }, () => redraw()); } catch { /* 다음 그릴 때부터 */ }
    onMbOff(doc, ['unvisited', 'annex'], () => redraw());
    // 버그 사냥 6 기호 떼기를 켜고 끌 때 지도 밖 창 · 띠도 그 확장이 다시 그리게(끄면 원래 글 · 켜면 새로 뗌)
    onMbOff(doc, ['annex', 'blank'], () => { try { core?.app?.rerenderPanels?.(true); } catch { /* 다음 그릴 때 */ } try { const hud = doc.getElementById?.('ss-hud'); if (hud && '_ssHtml' in hud) { hud._ssHtml = ''; core?.app?.renderHud?.(); } } catch { /* 다음 갱신 때 */ } });
    // 1.7.5 흐린 점 누르기 → 그 곳 카드(로어북 설명 요약). 그 확장의 장소 · 구역 · 「현재 위치로」를 누르면 흐린 점 고름을 풀어요(그 확장이 제 카드를 다시 그려요)
    doc.addEventListener('click', e => {
        const t = e.target; if (!t?.closest) return;
        if (t.closest('[data-act="selplace"], [data-act="maparea"], [data-act="mapzoom"][data-arg="here"]')) { const p = t.closest('.ss-panel'); if (p?._ss?.ui) p._ss.ui.blGhost = null; return; }
        const n = t.closest('g.bl-unv'), svg = n?.closest?.('svg.ss-map'); if (!n || !svg || svg._dragged) return;
        const panel = svg.closest('.ss-panel'), g = n._blGhost; if (!g) return;
        if (panel?._ss?.ui) panel._ss.ui.blGhost = g.key;
        for (const x of svg.querySelectorAll('g.bl-unv.sel, g.node.sel')) x.classList.remove('sel');
        n.classList.add('sel');
        showGhostCard(panel, g);
    }, true);
    doc.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target?.matches?.('g.bl-unv')) { e.preventDefault(); e.target.dispatchEvent(new (doc.defaultView?.MouseEvent || globalThis.MouseEvent)('click', { bubbles: true })); } });
    // 1.7.9 「＋ · －」: 층별 배치가 입혀진 지도면 그림 몫의 가운데를 축으로(zoomFloors — 건물 왼쪽이 칸 밖으로 안 밀리게)
    doc.addEventListener('click', e => {
        const btn = e.target?.closest?.('[data-act="mapzoom"][data-arg="in"], [data-act="mapzoom"][data-arg="out"]'); if (!btn || !core) return;
        const panel = btn.closest('.ss-panel'), svg = panel?.querySelector?.('svg.ss-map[data-bl-floors="on"]');
        if (!panel?._ss || !svg?._blContent) return;
        const vb = String(svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
        const next = zoomFloors(vb, svg._blContent, svg._blFit, btn.getAttribute('data-arg') === 'in' ? 1 / 1.4 : 1.4);
        if (!next && btn.getAttribute('data-arg') === 'in') return;   // 못 셈 — 그 확장 그대로
        e.stopImmediatePropagation(); e.preventDefault();
        panel._ss.ui.mapVB = next;
        try { core.app.renderPanel(panel); } catch { /* 그대로 */ }
    }, true);
    // 「현재 위치로」: 그 확장은 자기 배치의 자리로 가요 → 층별 배치가 입혀진 지도면 이 배치의 자리로
    doc.addEventListener('click', e => {
        const btn = e.target?.closest?.('[data-act="mapzoom"][data-arg="here"]'); if (!btn || !core) return;
        const panel = btn.closest('.ss-panel'), svg = panel?.querySelector?.('svg.ss-map[data-bl-floors="on"]'), L = svg?._blFloors;
        const map = mapNow(); if (!panel?._ss || !L || !map) return;
        const p = findFn()(map.places, map.here), o = p && L.pos.get(p.name); if (!o) return;
        e.stopImmediatePropagation(); e.preventDefault();
        const vb = String(svg.getAttribute('viewBox') || '').split(/\s+/).map(Number), k = vb[2] > 0 && vb[3] > 0 ? vb[3] / vb[2] : 1;   // 지금 지도 비율 그대로(창 높이가 안 튀게)
        panel._ss.ui.mapVB = [o.x - 25, o.y - 25 * k, 50, 50 * k].map(r1); panel._ss.ui.place = map.here;
        try { core.app.renderPanel(panel); } catch { /* 그대로 */ }
    }, true);
    return true;
}
