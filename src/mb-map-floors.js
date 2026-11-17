// 1.6.8 미트볼 지도 「층별 보기」 — 미트볼 상태창이 깔려 있을 때만 받는 모듈이에요(index.js 의 미트볼 문).
//   장소 설명 · 이름에 층(「7F」 · 「B2」 · 「3층」 · 「지하 1층」 · 「2nd floor」 · 「5階」)이 적힌 곳이 두 층 넘게 모이면, 그 확장이 그린 지도 SVG 를
//   「건물 단면」 으로 다시 놓아요: 층마다 가로 띠(위가 높은 층 · 아래가 지하) · 띠 옆 층 이름표 · 꺾인 선(같은 층은 복도 · 이웃 층은 계단 · 먼 층은 승강기 줄).
//   층이 없는 장소: 이름 · 종류가 하늘 쪽 세계(천국 · 천계 등)면 건물 위, 땅 밑 세계(지옥 · 명계 등)면 건물 아래, 나머지는 건물 옆 바깥(땅 높이)에 둬요.
//   층 정보가 없는 지도는 손대지 않아요(그 확장 그림 그대로). 그 확장의 파일 · 자료(장소 좌표 포함)는 안 고쳐요 — 그려진 SVG 의 점 묶음을 옮기고 선만 바꿔 그려요.
//   끌기 · 확대 · 구역 탭 · 지금 위치 강조는 그 확장 것을 그대로 써요(그 확장은 viewBox 만 바꿔요). 「현재 위치로」 단추만 이 배치의 자리로 가게 받아 줘요.
//   켜고 끄기: 테마 설정 chat.mbMapFloors(기본 켬) → body[data-bl-mb-floors] · 「원작 그대로 보기」 를 켜면 안 해요. 시험: tools/tests/mb-map-floors.mjs
import { watchDom } from './dom-watch.js';

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
    const s = String(text ?? ''); if (!s) return null;
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
const normName = s => String(s ?? '').toLowerCase().replace(/[\s·・_\-.,'"()（）[\]]+/g, '');
const simpleFind = (list, name) => { const k = normName(name); return list.find(p => normName(p.name) === k) || null; };
const r1 = v => Math.round(v * 10) / 10;
/** 층 → 줄 번호(1F = 1 · B1 = 0 · B2 = −1 …): 1층과 지하 1층 사이가 땅이에요 */
const rowOf = f => (f >= 1 ? f : f + 1);
const tagOf = r => (r >= 1 ? `${r}F` : `B${1 - r}`);

/**
 * 층별 배치를 계산해요. places = 그 확장 지도 장소 목록(name · desc · kind · area · links · x · y).
 * 돌려주는 것: null(층 건물이 없음 → 그 확장 그림 그대로) 또는 { pos: Map(이름 → {x, y, zone, row, b}), rows, buildings, ground, routes(pairs) }
 */
export function floorLayout(places, { find = simpleFind, tr = null, tall = null } = {}) {
    // 버그 사냥 10b: 이름이 완전히 같은 장소는 첫째만(그 확장 findBy · layoutPlaces 도 첫째를 써요) — 둘째가 층 · 바깥 칸을 덮어 점 자리와 카드가 어긋났어요
    const names = new Set(), list = (Array.isArray(places) ? places : []).filter(p => p && p.name && !names.has(p.name) && names.add(p.name));
    if (list.length < 2) return null;
    const info = new Map(list.map((p, i) => [p.name, { p, i, f: floorOf(p, tr), area: String(p.area ?? '') }]));
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
    const buildings = [...groups.values()].filter(g => new Set(g.map(it => it.f)).size >= 2)
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
    });
    const real = n => alias.get(n) ?? n;
    // 줄: 건물마다 맨 위 ~ 맨 아래 층을 빈 층까지 다 넣어요(15층 넘게 벌어지면 장소가 있는 층만)
    const rowSet = new Set();
    for (const g of buildings) {
        const rs = g.map(it => rowOf(it.f)), hi = Math.max(...rs), lo = Math.min(...rs);
        if (hi - lo < 15) for (let r = lo; r <= hi; r++) rowSet.add(r); else rs.forEach(r => rowSet.add(r));
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
    const zone = new Map(list.filter(p => !inB.has(p.name) && !alias.has(p.name)).map(p => [p.name, headOf.has(p.name) && bAreas.has(headOf.get(p.name)) ? 'above' : zoneOf(p, tr)]));   // 건물 머리는 지붕 위
    // 승강기 줄: 건물 안 먼 층 사이 선 · 하늘 · 땅 밑 장소가 건물로 오는 선(지붕 위 · 바닥 아래로 곧게 나가요) — 선마다 줄 하나
    const shaftN = buildings.map(() => 0), laneIdx = new Map();
    const pkey = (a, b) => [a, b].sort().join('|');
    for (const [a, b] of pairs) {
        const ba = inB.get(a), bb = inB.get(b);
        if (ba !== undefined && ba === bb && Math.abs(rows.indexOf(rowOf(fOf(a))) - rows.indexOf(rowOf(fOf(b)))) > 1) laneIdx.set(pkey(a, b), [ba, shaftN[ba]++]);
        else if ((ba !== undefined) !== (bb !== undefined)) { const bi = ba ?? bb, z = zone.get(ba === undefined ? a : b); if (z === 'above' || z === 'below') laneIdx.set(pkey(a, b), [bi, shaftN[bi]++]); }
    }
    // 칸 너비 채우기: 세로(층 수 · 위 · 아래)로 정해지는 보기 칸 너비만큼 방 칸을 넓혀요(건물이 한쪽에 붙고 반이 비지 않게)
    const hasZ = z => [...zone.values()].includes(z);
    const contentH = bottom + (hasZ('above') ? 23 : 3) + (hasZ('below') ? 23 : 3);
    const outN = [...zone.values()].filter(z => z === 'out').length;
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
        const rs = rows.filter(r => r <= Math.max(...byRow.keys()) && r >= Math.min(...byRow.keys()));
        bInfo.push({ left, right, roomL, roomR: roomL + roomW, shaftL: roomL + roomW, shaftW, rows: rs, top: rowTop.get(rs[0]), bottom: rowTop.get(rs[rs.length - 1]) + rowH(rs[rs.length - 1]), lanes: 0 });
        x = right + 10;
    });
    const bLeft = bInfo[0].left, bRight = bInfo[bInfo.length - 1].right;
    const rest = list.filter(p => !pos.has(p.name) && !alias.has(p.name));
    const lane = new Map([...laneIdx].map(([k, [bi, i]]) => [k, r1(bInfo[bi].shaftL + 1.5 + i * LANE)]));
    // 바깥 장소 차례: 건물에서 링크로 몇 걸음인지(가까운 것부터) → 그 확장 x
    const adj = new Map(list.map(p => [p.name, new Set()]));
    for (const [a, b] of pairs) { adj.get(a)?.add(b); adj.get(b)?.add(a); }
    const depth = new Map(); const q = [...pos.keys()]; q.forEach(n => depth.set(n, 0));
    while (q.length) { const n = q.shift(); for (const m of adj.get(n) || []) if (!depth.has(m) && zone.get(m) === 'out') { depth.set(m, depth.get(n) + 1); q.push(m); } }
    const outs = rest.filter(p => zone.get(p.name) === 'out').sort((p, q2) => (depth.get(p.name) ?? 99) - (depth.get(q2.name) ?? 99) || ax(info.get(p.name)) - ax(info.get(q2.name)));
    const outLaneN = pairs.filter(([a, b]) => (zone.get(a) === 'out' && pos.get(b)?.zone === 'b' && pos.get(b).row !== groundRow) || (zone.get(b) === 'out' && pos.get(a)?.zone === 'b' && pos.get(a).row !== groundRow)).length;
    const outL = bRight + 4 + outLaneN * LANE;
    // 1.7.0 바깥 칸 너비는 이름표 폭 기준(두 줄로 접은 뒤 가장 긴 줄 + 2) — 이름표끼리 겹치지 않게 · 좁으면 그만큼 옆으로 밀어요
    let ox = outL;
    outs.forEach(p => {
        const lines = wrapLabel(tr?.(p.name) || p.name, OUT_W - 1.5), w = Math.max(OUT_W, Math.min(40, Math.max(...lines.map(textW)) + 2));
        pos.set(p.name, { x: r1(ox + w / 2), y: r1(dotY(groundRow)), zone: 'out', row: groundRow, b: null, w }); ox += w;
    });
    const outR = outs.length ? ox : bRight;
    // 하늘 장소는 승강기 줄 꼭대기 위, 땅 밑 장소는 바닥 아래 — 그 장소의 첫 승강기 줄 x(건물로 가는 선이 없으면 건물 가운데)
    const mid = (bLeft + bRight) / 2;
    for (const [z, y] of [['above', top - 11], ['below', bottom + 13]]) {
        const a = rest.filter(p => zone.get(p.name) === z), used = [];
        a.forEach((p, k) => {
            const own = pairs.find(([u, v]) => (u === p.name || v === p.name) && lane.has(pkey(u, v)));
            let px = own ? lane.get(pkey(...own)) : mid + (k - (a.length - 1) / 2) * SLOT_W;
            while (used.some(u => Math.abs(u - px) < SLOT_W * 0.9)) px -= SLOT_W;   // 겹치면 왼쪽으로 한 칸씩
            used.push(px); pos.set(p.name, { x: r1(px), y, zone: z, row: null, b: null, w: SLOT_W });
        });
    }
    for (const [a, b] of alias) if (pos.has(b)) pos.set(a, { ...pos.get(b), twin: b });   // 겹친 장소는 대표 점 자리
    const out = { pos, alias, rows, rowTop, rowH, dotY, groundRow, groundY, top, bottom, buildings: bInfo, bLeft, bRight, outL, outR, pairs, inB, lane, tall: tall || new Set() };
    if (tall) return out;
    // 이름표가 두 줄로 접힐 층(입히기와 같은 규칙: 보이는 이름 = 번역 보기 글 · 칸 너비 - 1.5)을 모아 한 번 더 놓아요
    const need = new Set();
    for (const [n, o] of pos) if (o.row !== null && o.row !== undefined && (o.zone === 'b' || o.zone === 'out') && info.get(n)?.p.known !== false && wrapLabel(tr?.(n) || n, (o.w || SLOT_W) - 1.5).length > 1) need.add(o.row);
    return need.size ? floorLayout(places, { find, tr, tall: need }) : out;
}

/** 두 장소 사이 꺾인 선(점 목록). L = floorLayout 결과 · shown = 지금 보이는 장소 이름 모음 · lanes = 길마다 쓴 줄 수(같은 길 선끼리 벌려요) */
export function routeOf(L, a, b, shown = null, lanes = { left: 0, out: 0 }) {
    const A = L.pos.get(a), Bp = L.pos.get(b); if (!A || !Bp) return null;
    const pts = (...p) => p.map(([x, y]) => [r1(x), r1(y)]).filter((q, i, a) => !i || q[0] !== a[i - 1][0] || q[1] !== a[i - 1][1]);
    const between = (P, Q) => [...L.pos].some(([n, o]) => n !== a && n !== b && (!shown || shown.has(n)) && Math.abs(o.y - P.y) < 0.5 && o.x > Math.min(P.x, Q.x) + 0.5 && o.x < Math.max(P.x, Q.x) - 0.5);
    // 같은 줄: 사이에 다른 장소가 없으면 곧게, 있으면 점 아래 복도로
    if (Math.abs(A.y - Bp.y) < 0.5) {
        if (!between(A, Bp)) return pts([A.x, A.y], [Bp.x, Bp.y]);
        const c = A.y + CORRIDOR; return pts([A.x, A.y], [A.x, c], [Bp.x, c], [Bp.x, Bp.y]);
    }
    const [U, D] = A.y < Bp.y ? [A, Bp] : [Bp, A];
    // 같은 건물
    if (U.zone === 'b' && D.zone === 'b' && U.b === D.b) {
        const bi = L.buildings[U.b];
        const ui = L.rows.indexOf(U.row), di = L.rows.indexOf(D.row);
        if (di - ui === 1) { const slab = L.rowTop.get(D.row); return pts([U.x, U.y], [U.x, slab], [D.x, slab], [D.x, D.y]); }   // 이웃 층: 계단
        const sx = L.lane?.get([a, b].sort().join('|')) ?? bi.shaftL + 1.5;   // 먼 층: 승강기 줄(선마다 제 줄)
        return pts([U.x, U.y], [U.x, U.y + CORRIDOR], [sx, U.y + CORRIDOR], [sx, D.y + CORRIDOR], [D.x, D.y + CORRIDOR], [D.x, D.y]);
    }
    // 하늘 장소 ↔ 건물: 지붕 위에서 승강기 줄을 타고 곧게 내려와 그 층 복도로 · 땅 밑 장소 ↔ 건물: 그 층 복도에서 승강기 줄로 바닥 아래까지 곧게(건물 벽을 안 가로질러요)
    const sx = L.lane?.get([a, b].sort().join('|'));
    if (sx !== undefined && U.zone === 'above' && D.zone === 'b') return pts([U.x, U.y], [U.x, U.y + CORRIDOR], [sx, U.y + CORRIDOR], [sx, D.y + CORRIDOR], [D.x, D.y + CORRIDOR], [D.x, D.y]);
    if (sx !== undefined && U.zone === 'b' && D.zone === 'below') return pts([U.x, U.y], [U.x, U.y + CORRIDOR], [sx, U.y + CORRIDOR], [sx, D.y], [D.x, D.y]);
    // 바깥 장소 ↔ 건물 다른 층: 건물과 바깥 사이 줄로
    if ((U.zone === 'out') !== (D.zone === 'out')) {
        const ox = L.bRight + 2 + (lanes.out++) * LANE;
        return pts([U.x, U.y], [U.x, U.y + CORRIDOR], [ox, U.y + CORRIDOR], [ox, D.y + CORRIDOR], [D.x, D.y + CORRIDOR], [D.x, D.y]);
    }
    // 그 밖: 가운데서 한 번 꺾어요
    const my = (U.y + D.y) / 2; return pts([U.x, U.y], [U.x, my], [D.x, my], [D.x, D.y]);
}
export const pathD = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

/** 보이는 장소(와 그 건물 띠)를 감싸는 viewBox — 그 확장 fitBox 와 같은 여백. 건물이 높으면 세로로 조금(최대 TALL 배) 길게 둬요(글자가 덜 작아지게) */
export const TALL = 1.25;
export function fitFloors(L, shown) {
    const xs = [], ys = [];
    for (const [n, o] of L.pos) if (!shown || shown.has(n)) { xs.push(o.x - 10, o.x + 10); ys.push(o.y - 12, o.y + 10); }
    for (const b of L.buildings) if (bShown(L, b, shown) || ghostOf(L, shown)) { xs.push(b.left - 4, b.right + 2); ys.push(b.top - 3, b.bottom + 3); }
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
/** 칸 너비 w 에 맞게 이름을 한 줄 또는 두 줄로 — 띄어쓰기에서 가운데 가까운 곳을 먼저, 없으면 글자 가운데에서 끊어요(줄임표 없이 전체 이름) */
/** 1.7.0 이름표에 쓸 이름: 「장소 — 설명」 · 「장소 | 설명」 꼴(지금 장소 줄이 그대로 장소 이름이 된 것)은 앞 조각만 */
export function labelOf(name) {
    const t = String(name ?? '').trim(), head = t.split(/\s+[—–|]\s+|,\s+/)[0].trim();   // 1.7.0 쉼표 뒤 묘사도 떼요
    return head && [...head].length >= 2 ? head : t;
}
export function wrapLabel(text, w) {
    const t = labelOf(text); if (!t || textW(t) <= w) return [t];
    const sp = [...t.matchAll(/ /g)].map(m => m.index);
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
export function applyFloors(svg, map, { ui = null, find = simpleFind, tr = null } = {}) {
    if (!svg || svg.getAttribute('data-bl-floors')) return null;
    const L = floorLayout(map?.places, { find, tr });
    // 버그 사냥 9b: 그 확장이 기억한 보던 칸(ui.mapVB — 끌기 · 확대)은 그때 그린 배치의 눈금이에요. 장소가 바뀌어 층별 배치가 새로 생기거나 없어지면
    //   다른 눈금의 칸이 남아 엉뚱한 곳(빈 곳)을 보여 줬어요 → 어느 배치로 그렸는지 ui 에 적어 두고, 바뀌면 보던 칸을 버려요.
    //   (층별 배치 → 그 확장 배치: 그 확장이 이미 옛 칸으로 그렸으니 다시 그리게 _blRefit 로 알려요 — startMbFloors 가 그려요)
    const mode = L ? 'floors' : 'plain', was = ui?.[VB_MODE];
    if (ui && typeof ui === 'object') { if (was && was !== mode && ui.mapVB) { ui.mapVB = null; if (!L) svg._blRefit = true; } ui[VB_MODE] = mode; }
    if (!L) { svg.setAttribute('data-bl-floors', 'none'); return null; }
    const doc = svg.ownerDocument;
    const nodes = [...svg.querySelectorAll('g.node[data-arg]')];
    const shown = new Set(nodes.map(g => { const p = find(map.places, g.getAttribute('data-arg')); return p ? p.name : g.getAttribute('data-arg'); }));
    // 점 묶음 옮기기: 원래 점 자리 → 새 자리만큼 translate
    for (const g of nodes) {
        const p = find(map.places, g.getAttribute('data-arg')), to = p && L.pos.get(p.name), dot = g.querySelector('circle.dot');
        if (!to || !dot) continue;
        const dx = r1(to.x - Number(dot.getAttribute('cx'))), dy = r1(to.y - Number(dot.getAttribute('cy')));
        g.setAttribute('transform', `translate(${dx} ${dy})`);
        // 이름표: 그 확장이 8글자에서 줄임표로 자른 것 · 칸보다 긴 것은 전체 이름을 두 줄로 접어요(점 위로 한 줄 더)
        const lab = [...g.querySelectorAll('text')].find(t => !/(?:^|\s)(?:ico|ppl)(?:\s|$)/.test(t.getAttribute('class') || ''));
        if (lab && p && p.known !== false) {
            const now = lab.textContent || '', full = now.endsWith('…') ? (tr?.(p.name) || p.name) : now;
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
    for (const g of nodes) { const n = nameOf(g), head = L.alias?.get(n) ?? n; if (!sets.has(head)) sets.set(head, []); sets.get(head).push(g); }
    for (const [, gs] of sets) {
        if (gs.length < 2) continue;
        const vis = gs.find(g => /\bhere\b/.test(g.getAttribute('class') || '')) || gs.find(g => /\bsel\b/.test(g.getAttribute('class') || '')) || gs.find(g => !L.alias?.has(nameOf(g))) || gs[0];
        const others = gs.filter(g => g !== vis);
        for (const g of others) { g.setAttribute('display', 'none'); g.setAttribute('data-bl-twin', nameOf(vis)); }
        const dot = vis.querySelector('circle.dot'), at = L.pos.get(nameOf(vis)) || L.pos.get(L.alias?.get(nameOf(vis)));
        // 버그 사냥 10b: 점이 없는 묶음(옮기지 않았어요)이면 좌표가 NaN 이었어요 → 배치 자리
        let cx = Number(dot?.getAttribute('cx')), cy = Number(dot?.getAttribute('cy'));
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) { cx = at?.x ?? 0; cy = at?.y ?? 0; }
        const badge = el(doc, 'text', { class: 'bl-twin', x: r1(cx - 4.1), y: r1(cy + 1.2), 'data-act': 'selplace', 'data-arg': others[0].getAttribute('data-arg') }, `+${others.length}`);
        badge.appendChild(el(doc, 'title', {}, others.map(g => tr?.(nameOf(g)) || nameOf(g)).join(' · ')));
        vis.appendChild(badge);
    }
    for (const n of [...shown]) if (L.alias?.has(n)) shown.add(L.alias.get(n));   // 쌍둥이만 보이는 구역 탭이면 대표 이름으로 선을 그려요
    // 선: 그 확장이 그린 곧은 선을 걷고 꺾인 선으로
    const edges = svg.querySelector('g.edges');
    if (edges) {
        const known = new Map(map.places.map(p => [p.name, p.known !== false]));
        const lanes = { left: 0, out: 0 }; L.buildings.forEach(b => { b.lanes = 0; });
        const frag = doc.createDocumentFragment();
        for (const [a, b] of L.pairs) {
            if (!shown.has(a) || !shown.has(b)) continue;
            const pts = routeOf(L, a, b, shown, lanes); if (!pts) continue;
            frag.appendChild(el(doc, 'path', { d: pathD(pts), class: `bl-route${known.get(a) && known.get(b) ? '' : ' unk'}` }));
        }
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
    svg.setAttribute('data-bl-floors', 'on');
    svg._blFloors = L;
    if (!ui?.mapVB) svg.setAttribute('viewBox', fitFloors(L, shown).join(' '));
    return L;
}

// ── 붙이기 ─────────────────────────────────────────────
const rawView = doc => !!doc?.body?.hasAttribute?.('data-bl-ext-raw');
const isOn = doc => doc?.body?.getAttribute?.(FLOOR_ATTR) === 'on' && !rawView(doc);
async function mbCore(doc, load = url => import(url)) {
    try {
        const tag = [...(doc?.querySelectorAll?.('script[src]') ?? [])].find(s => /\/meatballstats\/index\.js(?:$|\?)/.test(String(s.src || s.getAttribute?.('src') || '')));
        const src = tag ? String(tag.src || tag.getAttribute('src')) : '';
        if (!src || src.includes('?')) return null;
        return await load(new URL('./src/core.js', src).href);
    } catch { return null; }
}
let started = false;
export function startMbFloors(doc = globalThis.document, { watch = watchDom, load = undefined } = {}) {
    if (started || !doc?.body) return false;
    started = true;
    let core = null;
    const mapNow = () => { try { return core?.app?.current?.state?.data?.map || null; } catch { return null; } };
    const trFn = () => { try { return core?.viewTr?.() ? (s => core.trLook?.(s) ?? s) : null; } catch { return null; } };
    const findFn = () => (core?.findBy ? (list, name) => core.findBy(list, name) || null : simpleFind);
    const dress = svg => {
        if (!isOn(doc) || !core || svg.getAttribute('data-bl-floors')) return;
        const map = mapNow(); if (!map) return;
        const panel = svg.closest?.('.ss-panel');
        try { applyFloors(svg, map, { ui: panel?._ss?.ui ?? null, find: findFn(), tr: trFn() }); } catch (error) { svg.setAttribute('data-bl-floors', 'none'); console.warn('[Blue Lemonade] 미트볼 층별 지도', error); }
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
    (load ? Promise.resolve(load()) : mbCore(doc)).then(m => { core = m; sweep(); }).catch(() => { /* 그 확장 그림 그대로 */ });
    try {
        watch(doc.body, { childList: true, subtree: true, exclude: '#chat', name: '미트볼 층별 지도' }, records => {
            if (!isOn(doc) || !core) return;
            for (const r of records) for (const n of r.addedNodes || []) {
                if (n.nodeType !== 1) continue;
                if (n.matches?.('svg.ss-map')) dress(n);
                else if (n.firstElementChild) for (const svg of n.querySelectorAll?.('svg.ss-map:not([data-bl-floors])') || []) dress(svg);
            }
        });
    } catch { /* 처음 훑은 것만 */ }
    try { watch(doc.body, { attributes: [FLOOR_ATTR, 'data-bl-ext-raw'], name: '미트볼 층별 지도 (켜고 끄기)' }, () => redraw()); } catch { /* 다음 그릴 때부터 */ }
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
