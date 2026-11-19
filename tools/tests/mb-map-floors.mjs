// 1.6.8 미트볼 지도 층별 보기(src/mb-map-floors.js · 그림 src/ext-status.css)
//   ① 층 읽기(7F · B2 · 3층 · 지하 1층 · 2nd floor · 5階 · 地下2階) ② 위 · 아래 · 바깥 ③ 배치(위가 높은 층 · 땅 아래 지하 · 하늘 위 · 땅 밑 아래 · 바깥은 옆)
//   ④ 선은 모두 꺾인 직각 선 ⑤ SVG 에 입히기(점 묶음 옮김 · 선 바꿈 · 띠 · 보던 viewBox 그대로) ⑥ 층 정보가 없으면 그대로 ⑦ 설정 · 연결 자리
//   node tools/tests/mb-map-floors.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const m = await import(pathToFileURL(path.join(root, 'src/mb-map-floors.js')).href);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };

// 지어낸 자료: 일반 사무 건물(이름 · 설명은 낱말뿐)
const P = (name, desc, extra = {}) => ({ name, desc, kind: 'building', x: NaN, y: NaN, links: [], known: true, area: 'Office', ...extra });
const office = () => {
    const list = [
        P('Board Room', 'Quiet room on 3F.', { x: 60, links: ['Reception'] }),
        P('Archive', 'Dusty shelves on the 3rd floor.', { x: 30, links: ['Board Room'] }),
        P('Studio', '2F studio with lights.', { links: ['Board Room'] }),
        P('Reception', 'Front desk at 1F.', { links: ['Studio', 'Garage', 'Bakery'] }),
        P('Garage', 'B1 parking.', { links: ['Reception'] }),
        P('Bakery', 'Corner bakery across the street.', { kind: 'shop', area: 'Street', links: ['Reception', 'Park'] }),
        P('Park', 'Small park.', { kind: 'nature', area: 'Street', links: ['Bakery'] }),
        P('Heaven', 'A calm realm.', { kind: 'realm', area: 'Beyond', links: ['Reception'] }),
        P('Underworld', 'A loud realm.', { kind: 'realm', area: 'Beyond', links: ['Reception'] }),
    ];
    return list;
};

await ok('층 읽기', () => {
    const cases = [['Office on 7F.', 7], ['1F Lobby', 1], ['B2 server hall', -2], ['B1F store', -1], ['3층 회의실', 3], ['지하 1층 주차장', -1], ['지하2층', -2], ['the 2nd floor', 2], ['floor 12', 12],
        ['5階の部屋', 5], ['地下2階', -2], ['ground floor cafe', 1], ['basement gym', -1], ['basement level 2', -2], ['2nd basement', -2],
        ['24-hour corner store', null], ['District 1', null], ['Room 101', null], ['0F', null], ['', null], [null, null], ['A 72-clan city', null]];
    for (const [s, want] of cases) assert.equal(m.floorIn(s), want, s);
    // 여럿이면 먼저 나온 것 · 이름 → 설명 → 종류
    assert.equal(m.floorIn('From 3F down to B1'), 3);
    assert.equal(m.floorOf({ name: '2F Hall', desc: 'near 5F' }), 2);
    assert.equal(m.floorOf({ name: 'Hall', desc: 'near 5F' }), 5);
    assert.equal(m.floorOf({ name: 'Hall', desc: '', kind: 'B1 room' }), -1);
    // 번역 보기 글
    assert.equal(m.floorOf({ name: 'Hall', desc: 'x' }, s => (s === 'x' ? '지하 2층 복도' : s)), -2);
});

await ok('버그 사냥 9b: 화씨 온도(75F)는 층이 아니에요 — 온도 표시(° · degrees · 기온 · 75F/24C)가 붙거나, 높은 수(30 넘음) 곁에 날씨 · 때 낱말이 있으면', () => {
    const cases = [['A warm 75F afternoon.', null], ['Sunny, 75 F outside.', null], ['It is 75F/24C today.', null], ['Hot day — 98F in the shade.', null], ['실내 온도 72F 유지', null], ['기온 80F 의 무더운 오후', null],
        ['Temperature 68F on the 12F terrace', 12], ['Warm cafe on 3F.', 3], ['Cozy room on 2F, warm and quiet.', 2], ['Penthouse on 75F.', 75], ['Sky lounge 40F with a night view', 40], ['Diner on 45F, open all day every afternoon', 45], ['75F', 75]];
    for (const [s, want] of cases) assert.equal(m.floorIn(s), want, s);
    // 배치: 온도를 적은 정원이 75층 방이 되지 않아요(바깥 장소)
    const L = m.floorLayout([P('Lobby', '1F lobby.'), P('Studio', '2F studio.', { links: ['Lobby'] }), P('Roof Garden', 'Open garden; a warm 75F afternoon breeze.', { links: ['Studio'] })]);
    assert.deepEqual(L.rows, [2, 1]); assert.equal(L.pos.get('Roof Garden').zone, 'out');
});

await ok('위 · 아래 · 바깥', () => {
    assert.equal(m.zoneOf({ name: 'Heaven', kind: 'realm' }), 'above');
    assert.equal(m.zoneOf({ name: '천계', kind: '' }), 'above');
    assert.equal(m.zoneOf({ name: 'Hell', kind: 'realm' }), 'below');
    assert.equal(m.zoneOf({ name: '지옥' }), 'below');
    assert.equal(m.zoneOf({ name: 'The Underworld' }), 'below');
    assert.equal(m.zoneOf({ name: 'Shell Beach' }), 'out');   // 낱말 안의 hell 은 아님
    assert.equal(m.zoneOf({ name: 'Corner Store', desc: 'snacks from heaven and hell' }), 'out');   // 설명은 안 봐요
    assert.equal(m.zoneOf({ name: 'Cafe' }), 'out');
});

await ok('배치: 층이 쌓이고 · 땅 · 위 · 아래 · 바깥', () => {
    const L = m.floorLayout(office());
    assert.ok(L);
    const at = k => L.pos.get(k);
    assert.deepEqual(L.rows, [3, 2, 1, 0]);
    assert.ok(at('Board Room').y < at('Studio').y && at('Studio').y < at('Reception').y && at('Reception').y < at('Garage').y);
    assert.equal(at('Board Room').y, at('Archive').y);
    assert.ok(at('Archive').x < at('Board Room').x, '같은 층은 그 확장 x 차례');
    assert.ok(at('Reception').y < L.groundY && at('Garage').y > L.groundY, '1층 위 · 지하는 땅 아래');
    assert.ok(at('Heaven').y < L.buildings[0].top && at('Underworld').y > L.buildings[0].bottom);
    assert.equal(at('Heaven').zone, 'above'); assert.equal(at('Underworld').zone, 'below');
    assert.ok(at('Bakery').x > L.bRight && at('Park').x > at('Bakery').x, '바깥은 건물 옆 · 가까운 것부터');
    assert.ok(at('Bakery').y === at('Reception').y && at('Park').y === at('Reception').y, '바깥은 모두 1층 줄(땅 선 바로 위)');
    assert.ok(at('Park').y < L.groundY && at('Park').y > L.groundY - m.ROW_H, '층 띠 높이 안');
    // 하늘 · 땅 밑 장소는 건물 위 · 아래(건물 가로 안) — 1.7.5 땅 밑 장소는 통로 x 에서 비켜요(통로가 그 줄 밑 복도까지 내려와요)
    const b0 = L.buildings[0];
    for (const k of ['Heaven', 'Underworld']) assert.ok(at(k).x >= b0.left && at(k).x <= b0.right, k);
    assert.ok(Math.abs(at('Underworld').x - b0.shaftX) > 5, `${at('Underworld').x} / ${b0.shaftX}`);
    // 칸 너비 채우기: 낮은 건물은 기본 칸(한 층 방 둘 × 21) 그대로 · 높은 건물은 넓어져요(상한 2.4배)
    assert.equal(b0.roomR - b0.roomL, 42);
    const nine = m.floorLayout([...Array(9)].map((_, i) => P('R' + i, `${i + 1}F`, { x: i % 2 ? 70 : 30, links: i ? ['R' + (i - 1)] : [] })).concat([P('R9', '5F', { x: 80 }), P('Shop', 'shop', { area: 'S', links: ['R0'] })]));
    const tb = nine.buildings[0]; assert.ok(tb.roomR - tb.roomL > 42 && tb.roomR - tb.roomL <= 42 * 2.4 + 1e-9, String(tb.roomR - tb.roomL));
    // 층 사이 빈 층도 띠로 · 너무 벌어지면 있는 층만
    const gap = m.floorLayout([P('A', '5F'), P('B', '1F', { links: ['A'] })]);
    assert.deepEqual(gap.rows, [5, 4, 3, 2, 1]);
    const tall = m.floorLayout([P('A', '40F'), P('B', '1F')]);
    assert.deepEqual(tall.rows, [40, 1]);
});

await ok('층 정보가 없거나 한 층뿐이면 null(그 확장 그림 그대로)', () => {
    assert.equal(m.floorLayout([P('A', 'a'), P('B', 'b'), P('Heaven', 'c', { kind: 'realm' })]), null);
    assert.equal(m.floorLayout([P('A', 'on 2F'), P('B', 'also 2F')]), null);
    assert.equal(m.floorLayout([]), null); assert.equal(m.floorLayout(null), null);
    // 다른 구역의 층 하나짜리는 건물로 안 보고 바깥 장소로
    const L = m.floorLayout([...office(), P('Shop', '2F shop', { area: 'Mall', links: ['Bakery'] })]);
    assert.equal(L.buildings.length, 1); assert.equal(L.pos.get('Shop').zone, 'out');
});

const straight = pts => pts.every((p, i) => !i || p[0] === pts[i - 1][0] || p[1] === pts[i - 1][1]);
await ok('선은 모두 직각으로 꺾여요', () => {
    const L = m.floorLayout(office());
    for (const [a, b] of L.pairs) { const pts = m.routeOf(L, a, b, null); assert.ok(pts && pts.length >= 2, a + b); assert.ok(straight(pts), `${a}-${b} ${JSON.stringify(pts)}`); }
    // 1.7.5 이웃 층(3F → 2F)도 먼 층(3F → 1F)도 같은 공용 통로(승강기 줄 하나)로
    const b0 = L.buildings[0];
    for (const [a, b] of [['Studio', 'Board Room'], ['Board Room', 'Reception']]) {
        const pts = m.routeOf(L, a, b);
        assert.ok(pts.some(([x, y], i) => i && x === b0.shaftX && pts[i - 1][0] === b0.shaftX && y !== pts[i - 1][1]), JSON.stringify(pts));
    }
    // 위 · 아래 장소도 통로로 — 건물 벽(왼쪽 · 오른쪽)을 가로지르지 않고 점 밑으로 드나들어요(이름표는 점 위)
    const sky = m.routeOf(L, 'Heaven', 'Reception');
    assert.equal(sky[0][0], sky[1][0]); assert.ok(sky[1][1] > sky[0][1], '점 밑으로 나가요'); assert.ok(sky.every(([x]) => x >= b0.roomL && x <= b0.right), JSON.stringify(sky));
    assert.ok(sky.some(([x, y]) => x === b0.shaftX && y > b0.top && y < b0.bottom), '승강기 줄을 타요');
    const deep = m.routeOf(L, 'Underworld', 'Reception');
    assert.ok(deep.every(([x]) => x >= b0.roomL && x <= b0.right), JSON.stringify(deep));
    const last = deep.at(-1), prev = deep.at(-2); assert.ok(last[0] === prev[0] && prev[1] > last[1] && prev[1] > b0.bottom, '땅 밑 장소에는 점 밑에서 올라가요');
});

// ── 작은 가짜 SVG 문서 ─────────────────────────────
class El {
    constructor(doc, tag, attrs = {}) { this.ownerDocument = doc; this.nodeType = 1; this.tagName = tag; this.attrs = { ...attrs }; this.childNodes = []; this.parentNode = null; }
    get firstChild() { return this.childNodes[0] || null; }
    get firstElementChild() { return this.childNodes[0] || null; }
    getAttribute(k) { return this.attrs[k] ?? null; } setAttribute(k, v) { this.attrs[k] = String(v); } hasAttribute(k) { return k in this.attrs; }
    appendChild(c) { if (c.isFrag) { for (const x of c.childNodes) this.appendChild(x); c.childNodes = []; return c; } c.parentNode = this; this.childNodes.push(c); return c; }
    insertBefore(c, ref) { c.parentNode = this; const i = ref ? this.childNodes.indexOf(ref) : -1; if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c); return c; }
    replaceChildren(...kids) { this.childNodes = []; for (const k of kids) this.appendChild(k); }
    set textContent(v) { this.text = v; } get textContent() { return this.text ?? this.childNodes.map(c => c.textContent).join(''); }
    matches(sel) { const mm = /^(\w+)?((?:\.[\w-]+)*)((?:\[[\w-]+(?:="[^"]*")?\])*)(?::not\(\[([\w-]+)\]\))?$/.exec(sel.trim()); if (!mm) throw new Error('선택자 ' + sel);
        if (mm[1] && mm[1] !== this.tagName) return false;
        const cls = String(this.attrs.class || '').split(/\s+/); for (const c of mm[2].split('.').filter(Boolean)) if (!cls.includes(c)) return false;
        for (const a of mm[3].match(/\[[^\]]+\]/g) || []) { const [, k, v] = /\[([\w-]+)(?:="([^"]*)")?\]/.exec(a); if (!(k in this.attrs) || (v !== undefined && this.attrs[k] !== v)) return false; }
        if (mm[4] && mm[4] in this.attrs) return false; return true; }
    querySelectorAll(sel) { const out = []; const walk = e => { for (const c of e.childNodes) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    closest() { return null; }
}
const makeDoc = () => { const doc = { createElementNS: (ns, tag) => new El(doc, tag), createDocumentFragment: () => Object.assign(new El(doc, '#frag'), { isFrag: true }) }; return doc; };
/** 그 확장 views.js 와 같은 모양의 지도 SVG(점 · 이름 · 곧은 선) */
const drawn = (doc, places) => {
    const svg = new El(doc, 'svg', { class: 'ss-map', viewBox: '-6 -8 112 114' });
    const edges = new El(doc, 'g', { class: 'edges' }); svg.appendChild(edges);
    places.forEach((p, i) => {
        const x = 10 + (i % 4) * 25, y = 10 + Math.floor(i / 4) * 25;
        const g = new El(doc, 'g', { class: 'node', 'data-act': 'selplace', 'data-arg': p.name });
        g.appendChild(new El(doc, 'circle', { cx: x, cy: y, r: 2.8, class: 'dot' })); g.appendChild(new El(doc, 'text', { class: 'ico', x, y: y + 1.15 })); g.appendChild(new El(doc, 'text', { x, y: y - 4.4 }));   // 그 확장처럼 아이콘 글자가 이름표 앞
        svg.appendChild(g);
        edges.appendChild(new El(doc, 'line', { x1: x, y1: y, x2: 0, y2: 0, class: '' }));
    });
    return svg;
};
await ok('SVG 에 입히기', () => {
    const doc = makeDoc(), places = office(), svg = drawn(doc, places);
    const L = m.applyFloors(svg, { places }, { ui: { mapVB: null } });
    assert.ok(L); assert.equal(svg.getAttribute('data-bl-floors'), 'on');
    // 점 묶음: 원래 점 + translate = 새 자리
    for (const g of svg.querySelectorAll('g.node[data-arg]')) {
        const [, dx, dy] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute('transform')).map(Number);
        const dot = g.querySelector('circle.dot'), to = L.pos.get(g.getAttribute('data-arg'));
        assert.ok(Math.abs(Number(dot.getAttribute('cx')) + dx - to.x) < 0.11 && Math.abs(Number(dot.getAttribute('cy')) + dy - to.y) < 0.11, g.getAttribute('data-arg'));
        assert.equal(dot.getAttribute('cx') !== null, true);   // 그 확장 요소의 좌표는 그대로
    }
    // 선: 곧은 선은 없고 꺾인 길만
    const edges = svg.querySelector('g.edges');
    assert.equal(edges.querySelectorAll('line').length, 0);
    const paths = edges.querySelectorAll('path.bl-route'); assert.equal(paths.length, 1, '1.7.5 선은 한 path 로 합쳐요(모두 아는 곳)');
    for (const p of paths) for (const sub of p.getAttribute('d').split(/(?=M)/)) { const pts = [...sub.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map(x => [Number(x[1]), Number(x[2])]); assert.ok(straight(pts), sub); }
    // 모든 링크가 그려졌어요: 링크마다 꺾인 선의 토막이 합친 선 안에 들어 있어요
    const drawnSegs = paths[0].getAttribute('d').split(/(?=M)/).map(s => [...s.matchAll(/([-\d.]+) ([-\d.]+)/g)].map(x => [Number(x[1]), Number(x[2])]));
    const covered = (p, q) => drawnSegs.some(([u, v]) => (p[0] === q[0] && u[0] === p[0] && v[0] === p[0] && Math.min(u[1], v[1]) <= Math.min(p[1], q[1]) + 0.01 && Math.max(u[1], v[1]) >= Math.max(p[1], q[1]) - 0.01)
        || (p[1] === q[1] && u[1] === p[1] && v[1] === p[1] && Math.min(u[0], v[0]) <= Math.min(p[0], q[0]) + 0.01 && Math.max(u[0], v[0]) >= Math.max(p[0], q[0]) - 0.01));
    for (const [a, b] of L.pairs) { const pts = m.routeOf(L, a, b); for (let i = 1; i < pts.length; i++) assert.ok(covered(pts[i - 1], pts[i]), `${a}-${b} ${pts[i - 1]} → ${pts[i]}`); }
    // 띠 · 이름표 · 땅 선은 맨 앞(점 · 선 뒤) · 누르기를 안 받아요
    const deco = svg.firstChild; assert.equal(deco.getAttribute('class'), 'bl-floors'); assert.equal(deco.getAttribute('pointer-events'), 'none');
    assert.deepEqual(deco.querySelectorAll('text.bl-ftag').map(t => t.textContent), ['3F', '2F', '1F', 'B1']);
    assert.ok(deco.querySelectorAll('line.bl-ground').length >= 1);
    assert.ok(deco.querySelectorAll('rect.bl-shaft').length === 1);
    assert.notEqual(svg.getAttribute('viewBox'), '-6 -8 112 114');
    const [, , w, h] = svg.getAttribute('viewBox').split(' ').map(Number); assert.ok(h >= w && h / w <= m.TALL + 1e-9);
    // 두 번 입히지 않아요
    assert.equal(m.applyFloors(svg, { places }), null);
});
await ok('보던 viewBox(끌기 · 확대)는 그대로 · 구역 탭으로 걸러진 지도', () => {
    const doc = makeDoc(), places = office(), shown = places.filter(p => p.area === 'Office');
    const svg = drawn(doc, shown); svg.setAttribute('viewBox', '1 2 30 30');
    m.applyFloors(svg, { places }, { ui: { mapVB: [1, 2, 30, 30] } });
    assert.equal(svg.getAttribute('viewBox'), '1 2 30 30');
    // 안 보이는 장소로 가는 선은 안 그려요
    for (const p of svg.querySelectorAll('path.bl-route')) assert.ok(p.getAttribute('d'));
    assert.equal(svg.querySelectorAll('path.bl-route').length, 1);
    // 1.7.5 한 path 로 합쳐도 안 보이는 곳(바깥 · 하늘 · 땅 밑)으로 가는 선 토막은 없어요: 모든 토막이 보이는 장소들 사이 선의 토막
    const L = m.floorLayout(places), names = new Set(shown.map(p => p.name));
    const want = m.mergeSegments(L.pairs.filter(([a, b]) => names.has(a) && names.has(b)).map(([a, b]) => m.routeOf(L, a, b, names))).d;
    assert.equal(svg.querySelectorAll('path.bl-route')[0].getAttribute('d'), want);
});
await ok('버그 사냥 9b: 층별 배치가 새로 생기거나 없어지면 그 확장이 기억한 보던 칸(다른 눈금)을 버리고 다시 맞춰요', () => {
    const doc = makeDoc(), flat = office().map(p => ({ ...p, desc: 'plain room' })), ui = { mapVB: null };
    // ① 층 없는 지도를 보다가 끌어서 보던 칸이 생김(그 확장 눈금) → 다음 그리기에 층이 생김
    assert.equal(m.applyFloors(drawn(doc, flat), { places: flat }, { ui }), null);
    ui.mapVB = [1, 2, 30, 30];
    const places = office(), svg = drawn(doc, places); svg.setAttribute('viewBox', '1 2 30 30');   // 그 확장은 보던 칸으로 그려요
    const L = m.applyFloors(svg, { places }, { ui });
    assert.ok(L); assert.equal(ui.mapVB, null, '다른 눈금의 보던 칸은 버려요');
    assert.equal(svg.getAttribute('viewBox'), m.fitFloors(L, new Set(places.map(p => p.name))).join(' '), '층별 배치 전체가 보이게');
    // ② 층별 배치로 보다가 끌어서 보던 칸이 생김 → 층이 없어짐: 보던 칸을 버리고 그 확장이 다시 그리게 알려요
    ui.mapVB = [5, 5, 40, 40];
    const svg2 = drawn(doc, flat); svg2.setAttribute('viewBox', '5 5 40 40');
    assert.equal(m.applyFloors(svg2, { places: flat }, { ui }), null);
    assert.equal(ui.mapVB, null); assert.equal(svg2._blRefit, true);
    // ③ 같은 눈금이면(층별 배치끼리) 보던 칸 그대로
    m.applyFloors(drawn(doc, places), { places }, { ui }); ui.mapVB = [1, 2, 30, 30];
    const svg3 = drawn(doc, places); svg3.setAttribute('viewBox', '1 2 30 30');
    m.applyFloors(svg3, { places }, { ui }); assert.equal(svg3.getAttribute('viewBox'), '1 2 30 30'); assert.deepEqual(ui.mapVB, [1, 2, 30, 30]);
});
await ok('하늘 · 땅 밑 장소만 보일 때 흐린 건물 윤곽', () => {
    const doc = makeDoc(), places = office(), shown = places.filter(p => p.area === 'Beyond');
    const svg = drawn(doc, shown);
    const L = m.applyFloors(svg, { places }, { ui: { mapVB: null } });
    const deco = svg.firstChild;
    assert.equal(deco.querySelectorAll('rect.bl-band').length, 0);
    const ghost = deco.querySelectorAll('rect.bl-bldg'); assert.equal(ghost.length, 1); assert.ok(String(ghost[0].getAttribute('class')).includes('ghost'));
    const [, y, , h] = svg.getAttribute('viewBox').split(' ').map(Number);
    assert.ok(y <= L.pos.get('Heaven').y - 10 && y + h >= L.pos.get('Underworld').y + 10);
});
await ok('처음 보기 칸: 오른쪽 확대 단추 자리 비움 · 가운데', () => {
    const L = m.floorLayout(office()), vb = m.fitFloors(L, null);
    const xr = Math.max(...[...L.pos.values()].map(o => o.x + 10));
    assert.ok(vb[0] + vb[2] - xr >= vb[2] * m.RESERVE - 0.2, JSON.stringify(vb));
});
await ok('이름표: 줄임표 대신 두 줄 접기', () => {
    assert.deepEqual(m.wrapLabel('Cafe', 15), ['Cafe']);
    assert.deepEqual(m.wrapLabel('Front Gate — wet canopy at dusk in the rain', 15), ['Front', 'Gate'], '「장소 — 설명」 은 앞 조각만');
    assert.equal(m.labelOf('Hall | 7F Desk'), 'Hall');
    assert.deepEqual(m.wrapLabel('Reception', 15), ['Reception'], '한 낱말은 조금 넘쳐도 안 끊어요');
    assert.deepEqual(m.wrapLabel('Records Maintenance Dept', 15), ['Records', 'Maintenance Dept'], '보통 긴 이름은 줄임표 없이');
    assert.deepEqual(m.wrapLabel('CORNER-SHOP 24', 15), ['CORNER-SHOP', '24']);
    assert.deepEqual(m.wrapLabel('가나다 라마바사', 15), ['가나다', '라마바사']);
    const two = m.wrapLabel('가나다라마바사아', 15); assert.equal(two.length, 2); assert.equal(two.join(''), '가나다라마바사아');
    // SVG: 그 확장이 줄임표로 자른 이름 → 전체 이름 두 줄(tspan) · 한 줄 위로
    const doc = makeDoc(), places = office().map(p => p.name === 'Bakery' ? { ...p, name: 'Bakery And Coffee 24' } : p);
    places.find(p => p.name === 'Reception').links = ['Studio', 'Garage', 'Bakery And Coffee 24'];
    const svg = drawn(doc, places);
    for (const g of svg.querySelectorAll('g.node')) { const t = g.querySelectorAll('text')[1]; const n = g.getAttribute('data-arg'); t.textContent = n.length > 8 ? n.slice(0, 7) + '…' : n; }
    m.applyFloors(svg, { places }, { ui: null });
    const g = svg.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === 'Bakery And Coffee 24'), t = g.querySelectorAll('text')[1];
    const spans = t.querySelectorAll('tspan'); assert.ok(spans.length === 2, String(spans.length));
    assert.equal(spans.map(x => x.textContent).join(' '), 'Bakery And Coffee 24');
    assert.equal(t.getAttribute('data-bl-wrap'), '2');
    assert.ok(!t.textContent.includes('…'));
});
await ok('두 줄 이름표 층은 띠가 높아져 윗줄이 위층 경계에 닿지 않아요', () => {
    const places = office().map(p => p.name === 'Studio' ? { ...p, name: 'Studio With A Much Longer Name Here' } : p);
    places.find(p => p.name === 'Board Room').links = ['Reception'];
    places.find(p => p.name === 'Reception').links = ['Studio With A Much Longer Name Here', 'Garage', 'Bakery'];
    const L = m.floorLayout(places);
    assert.ok(L.tall.has(2), '2F 는 두 줄');
    assert.ok(L.rowH(2) > m.ROW_H && L.rowH(3) === m.ROW_H, '두 줄 층만 높아요');
    // 모든 장소의 이름표 윗줄(글자 위끝 ≈ 점 - 4.4 - 줄 수만큼 - 2.6)이 제 띠 위끝보다 2 넘게 아래
    for (const [n, o] of L.pos) {
        if (o.row === null || o.row === undefined) continue;
        const lines = m.wrapLabel(n, (o.w || 21) - 1.5).length;
        const top = o.y - 4.4 - (lines - 1) * 3.4 - 2.6;
        assert.ok(top - L.rowTop.get(o.row) >= 2, `${n} ${top} ${L.rowTop.get(o.row)}`);
    }
    // 띠는 겹치지 않고 이어져요
    L.rows.slice(1).forEach((r, i) => assert.equal(L.rowTop.get(r), L.rowTop.get(L.rows[i]) + L.rowH(L.rows[i])));
});
await ok('버그 사냥 9: 지하층만 있는 건물이면 땅 선은 건물 꼭대기 · 바깥 장소는 땅 위(맨 아래 지하층 높이가 아니에요) · 빈 1F 띠는 안 그려요', () => {
    const places = [P('Gate', 'B1 entrance hall', { area: 'Keep', links: ['Cells'] }), P('Cells', 'B2 holding cells', { area: 'Keep', links: ['Pit'] }), P('Pit', 'B3 deepest pit', { area: 'Keep' }),
        P('Market', 'busy square', { kind: 'shop', area: 'Town', links: ['Gate'] })];
    const L = m.floorLayout(places);
    const b = L.buildings[0];
    assert.equal(L.groundY, b.top, '땅 = 건물 꼭대기(B1 띠 위)');
    assert.ok(L.pos.get('Market').y < b.top, `바깥 장소는 땅 위 ${L.pos.get('Market').y} < ${b.top}`);
    assert.deepEqual(b.rows, [0, -1, -2], '건물 띠는 B1 ~ B3 만');
    const doc = makeDoc(), svg = drawn(doc, places); m.applyFloors(svg, { places });
    assert.ok(!svg.querySelectorAll('text.bl-ftag').some(t => t.textContent === '1F'), '빈 1F 이름표 없음');
});
await ok('같은 곳 판정은 좁게(원문 · 번역 둘 다)', () => {
    for (const [x, y] of [['Data Dept', 'Data Department (B2)'], ['QA Team', 'Quality Assurance Department'], ['자료관리부', '자료관리팀 (B2)'], ['Archive Office', 'Archive (3F)']]) assert.equal(m.sameName(x, y), true, x + ' ' + y);
    for (const [x, y] of [['Server Room', 'Server Hall'], ['Room A', 'Room B'], ['PR Dept', 'Planning Dept'], ['1실', '2실'], ['Staff Canteen', 'Staff Lounge'], ['North Wing', 'South Wing'], ['Gym', 'Gallery']]) assert.equal(m.sameName(x, y), false, x + ' ' + y);
});
await ok('구역 없는 새 장소 · 구역 이름 장소 · 같은 층 같은 곳', () => {
    const list = [...office(),
        P('Office', 'head of 3F', { area: '', kind: '', links: ['Studio'] }),                         // 구역 이름과 같은 장소 → 건물 머리(지붕 위)
        P('Garage Team (B1)', 'second record of the B1 parking', { area: '', kind: '', links: ['Board Room'] }),   // 구역 없음 · 이어진 곳이 그 건물 → 그 건물 B1 · Garage 와 같은 곳
        P('Rooftop Garden', 'on 3F', { area: '', links: [] })];                                        // 구역 없고 이어진 곳도 없음 → 건물에 안 들어가요(외딴 층 하나짜리 → 바깥)
    list.find(p => p.name === 'Garage').name = 'Garage Dept';
    list.find(p => p.name === 'Reception').links = ['Studio', 'Garage Dept', 'Bakery'];
    const L = m.floorLayout(list);
    assert.equal(L.buildings.length, 1, '건물이 둘로 갈라지지 않아요');
    assert.equal(L.pos.get('Office').zone, 'above', '건물 머리는 방이 아니라 지붕 위');
    assert.equal(L.alias.get('Garage Team (B1)'), 'Garage Dept');
    assert.deepEqual([L.pos.get('Garage Team (B1)').x, L.pos.get('Garage Team (B1)').y], [L.pos.get('Garage Dept').x, L.pos.get('Garage Dept').y], '같은 점');
    assert.ok(L.pairs.some(([a, b]) => [a, b].includes('Garage Dept') && [a, b].includes('Board Room')), '쌍둥이 링크는 대표 점으로 합쳐요');
    assert.ok(!L.pairs.some(([a, b]) => a === 'Garage Team (B1)' || b === 'Garage Team (B1)'));
    assert.equal(L.pos.get('Rooftop Garden').zone, 'out');
    // 다른 층 · 다른 건물의 같은 이름은 합치지 않아요
    const two = m.floorLayout([P('Data Dept', '2F'), P('Data Team', '3F', { links: ['Data Dept'] }), P('Hall', '1F'), P('Data Dept ', '2F', { area: 'Other' }), P('Shed', '1F', { area: 'Other' })]);
    assert.equal(two.alias.size, 0);
    // SVG: 쌍둥이 점은 숨기고 대표 점 옆 「+1」(누르면 쌍둥이 카드)
    const doc = makeDoc(), svg = drawn(doc, list);
    m.applyFloors(svg, { places: list }, { ui: null });
    const g2 = svg.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === 'Garage Team (B1)'), g1 = svg.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === 'Garage Dept');
    assert.equal(g2.getAttribute('display'), 'none'); assert.equal(g1.getAttribute('display'), null);
    const badge = g1.querySelectorAll('text.bl-twin')[0]; assert.ok(badge); assert.equal(badge.getAttribute('data-act'), 'selplace'); assert.equal(badge.getAttribute('data-arg'), 'Garage Team (B1)');
    assert.equal(svg.querySelectorAll('rect.bl-bldg').length, 1);
});
await ok('건물 밖 「건물 이름 메인 + 방」 은 그 방 점에 · 바깥 이름표는 겹치지 않게 · 쉼표 뒤 묘사는 이름표에서 떼요', () => {
    const list = [...office(),
        P('Office Main Reception, wet canopy at dusk in heavy rain', '', { area: '', kind: '', links: ['Bakery'] }),   // 구역 없음 · 건물 이름(Office) + 꾸밈(Main) + 방(Reception)
        P('Main Hall', 'a hall', { area: 'Street', kind: '', links: ['Bakery'] }),                                      // 다른 구역 → 안 합쳐요
        P('Riverside Botanical Conservatory Annex', 'long name shop', { area: 'Street', kind: 'shop', links: ['Bakery'] })];
    const L = m.floorLayout(list);
    assert.equal(L.alias.get('Office Main Reception, wet canopy at dusk in heavy rain'), 'Reception');
    assert.ok(!L.alias.has('Main Hall'));
    assert.equal(m.labelOf('Office Main Reception, wet canopy at dusk'), 'Office Main Reception');
    // 바깥 1층 줄 이름표: 이웃 이름표와 가로로 안 겹쳐요(두 줄로 접은 뒤 가장 긴 줄 폭)
    const outs = [...L.pos].filter(([, o]) => o.zone === 'out' && !o.twin).sort((a, b) => a[1].x - b[1].x);
    for (let i = 1; i < outs.length; i++) {
        const half = ([n, o]) => Math.max(...m.wrapLabel(n, o.w - 1.5).map(m.textW)) / 2;
        assert.ok(outs[i][1].x - half(outs[i]) >= outs[i - 1][1].x + half(outs[i - 1]) - 0.01, outs[i - 1][0] + ' / ' + outs[i][0]);
    }
});
await ok('넓은 배치에서도 오른쪽 확대 단추 자리 비움', () => {
    const list = [...office(), ...[1, 2, 3, 4, 5, 6].map(i => P('Shop ' + i, 'shop', { area: 'Street', kind: 'shop', links: ['Reception'] }))];
    const L = m.floorLayout(list), vb = m.fitFloors(L, null);
    const xr = Math.max(...[...L.pos.values()].map(o => o.x + 10));
    assert.ok(vb[2] > vb[3] * 0.99, '가로가 넓은 배치');
    assert.ok(vb[0] + vb[2] - xr >= vb[2] * m.RESERVE - 0.2, JSON.stringify(vb));
});
await ok('버그 사냥 10: 번호 · 기호만 다른 방은 같은 곳이 아니에요', () => {
    for (const [x, y] of [['IT 1', 'IT 2'], ['Room 101', 'Room 102'], ['회의실 1', '회의실 2'], ['Class 3-1', 'Class 3-2'], ['Ward 7', 'Ward 8'], ['카페 🍰', '카페 🍩']]) assert.equal(m.sameName(x, y), false, x + ' / ' + y);
    // 머리글자는 대문자로 적힌 줄임말만(낱말 하나가 우연히 다른 이름의 머리글자와 같아도 안 합쳐요)
    for (const [x, y] of [['Lab', 'Language Arts Building'], ['Gym', 'Grand Yoga Mat']]) assert.equal(m.sameName(x, y), false, x + ' / ' + y);
    for (const [x, y] of [['IT', 'Information Technology'], ['QA Team', 'Quality Assurance Department'], ['Data Dept', 'Data Department (B2)'], ['IT 1', 'IT 1 (2F)']]) assert.equal(m.sameName(x, y), true, x + ' / ' + y);
    // 같은 건물 · 같은 층의 「IT 1」 「IT 2」 「Art Room」 은 세 점 그대로
    const list = [P('IT 1', '2F lab', { links: ['Lobby'] }), P('IT 2', '2F lab', { links: ['Lobby'] }), P('Art Room', '2F', { links: ['Lobby'] }), P('Lobby', '1F hall')];
    const L = m.floorLayout(list);
    assert.equal(L.alias.size, 0, JSON.stringify([...L.alias]));
    assert.notEqual(L.pos.get('IT 1').x, L.pos.get('IT 2').x);
});
await ok('버그 사냥 10: 「이름, 자리 말」 꼬리가 다르면 다른 곳 · 긴 묘사 꼬리만 다르면 같은 곳', () => {
    for (const [x, y] of [['Lab, North Wing', 'Lab, South Wing'], ['Hall — east side', 'Hall — west side'], ['Desk | A', 'Desk | B']]) assert.equal(m.sameName(x, y), false, x + ' / ' + y);
    for (const [x, y] of [['Front Gate — wet canopy at dusk in the rain', 'Front Gate — bright morning with long queue outside'], ['Lab, North Wing', 'Lab'], ['Lab, North Wing', 'Lab, North Wing (2F)']]) assert.equal(m.sameName(x, y), true, x + ' / ' + y);
    const L = m.floorLayout([P('Lab, North Wing', '2F', { links: ['Lobby'] }), P('Lab, South Wing', '2F', { links: ['Lobby'] }), P('Lobby', '1F hall')]);
    assert.equal(L.alias.size, 0, JSON.stringify([...L.alias]));
});
await ok('1.7.2: 줄임말 부서 ↔ 풀어 쓴 부서(같은 지하 층) · 「1F 로비」 ↔ 「건물 이름 Main 로비 — 긴 묘사」 는 계속 한 점', () => {
    const A = 'A.R.C Headquarters', H = (name, desc, extra = {}) => P(name, desc, { area: A, ...extra });
    const list = [
        H('Front Desk', '7F desk.', { links: ['1F Lobby', 'A.R.C Main Lobby — windy entrance porch at dawn'] }),
        H('QA Dept', 'Cold B2 test hall.', { links: ['1F Lobby', 'Quality Assurance Department (B2)'] }),
        H('QA 2', 'Spare B2 test hall.', { links: ['QA Dept'] }),
        H('1F Lobby', 'Marble hall at the entrance.', { links: ['Front Desk', 'QA Dept'] }),
        P('Quality Assurance Department (B2)', 'Cold B2 control room.', { area: '', kind: '', links: ['QA Dept'] }),
        P('A.R.C Main Lobby — windy entrance porch at dawn', '', { area: '', kind: '', links: ['Front Desk'] })];
    const L = m.floorLayout(list);
    assert.equal(L.alias.get('Quality Assurance Department (B2)'), 'QA Dept', JSON.stringify([...L.alias]));
    assert.equal(L.alias.get('A.R.C Main Lobby — windy entrance porch at dawn'), '1F Lobby', JSON.stringify([...L.alias]));
    assert.ok(!L.alias.has('QA 2') && ![...L.alias.values()].includes('QA 2'), '번호만 다른 방은 따로');
});
await ok('버그 사냥 10: 장소 250개(구역 빈 층 장소가 많아도) 배치가 빨라요', () => {
    const nm = i => 'Room ' + i + ' Long Name Of Place';
    const list = [];
    for (let i = 0; i < 200; i++) list.push(P(nm(i), ((i % 12) + 1) + 'F', { area: i % 3 ? '' : 'Office', links: [nm((i + 1) % 200)] }));
    for (let i = 0; i < 50; i++) list.push(P('Shop ' + i, 'shop', { area: 'Street', kind: 'shop', links: [nm(1)] }));
    m.floorLayout(list);
    const t = performance.now(); const L = m.floorLayout(list.map(p => ({ ...p, name: p.name + ' ' }))); const ms = performance.now() - t;
    assert.ok(L && L.buildings.length === 1);
    assert.ok(ms < 300, `${Math.round(ms)}ms`);   // 1.7.0: 0.6초 넘게(이어진 곳을 장소마다 목록 전체로 다시 찾았어요)
});
await ok('층 정보가 없는 지도는 손대지 않아요', () => {
    const doc = makeDoc(), places = [P('A', 'a', { links: ['B'] }), P('B', 'b'), P('Heaven', 'c', { kind: 'realm' })], svg = drawn(doc, places);
    assert.equal(m.applyFloors(svg, { places }), null);
    assert.equal(svg.getAttribute('data-bl-floors'), 'none');
    assert.equal(svg.getAttribute('viewBox'), '-6 -8 112 114');
    assert.equal(svg.querySelectorAll('line').length, 3);
    assert.ok(svg.querySelectorAll('g.node').every(g => !g.hasAttribute('transform')));
});

await ok('설정 · 연결 자리', () => {
    assert.ok(read('src/settings.js').includes('s.chat.mbMapFloors = flag(s.chat.mbMapFloors, true);'));
    for (const f of ['src/settings.js', 'src/styles.js']) assert.ok(/'mbBack',(?: '\w+',)* 'mbMapFloors',/.test(read(f)), f); // 1.6.8 통합: 1.6.7 의 'mbAutoEn' 이 사이에 들어가도 같은 목록이면 통과
    assert.ok(read('src/apply.js').includes("s.chat.mbMapFloors !== false ? 'on' : 'off'") && read('src/apply.js').includes("setAttribute('data-bl-mb-floors', on)"));
    assert.ok(read('src/panel.js').includes("toggle('chat.mbMapFloors', s.chat.mbMapFloors !== false)"));
    assert.ok(read('src/settings-labels.js').includes('"chat.mbMapFloors":"미트볼 지도 층별 보기"') && read('src/settings-search.js').includes("'chat.mbMapFloors']"));
    assert.ok(read('index.js').includes("import('./src/mb-map-floors.js').then(m => m.startMbFloors())"));
    assert.equal(m.FLOOR_ATTR, 'data-bl-mb-floors');
    const css = read('src/ext-status.css');
    for (const sel of ['path.bl-route', '.bl-bldg.ghost', '.bl-band', '.bl-ftag', '.bl-ground', '.bl-shaft', '.bl-bldg']) assert.ok(css.includes(`body.salty:not([data-bl-ext-raw]) .ss-scope .ss-map `) && css.includes(sel), sel);
    assert.ok(/path\.bl-route \{ fill: none;/.test(css), '선은 칠하지 않아요');
});
// ── 버그 사냥 10b(10차가 남긴 의심) ─────────────────────
const tryOk = async (name, fn) => { try { await ok(name, fn); } catch (e) { bad++; console.log('실패', name, '\n', e?.message || e); } };
let bad = 0;
const r = v => Math.round(v * 10) / 10;
await tryOk('버그 사냥 10b: 「+N」 표 — 보이는 점에 circle.dot 이 없어도 좌표가 숫자', () => {
    const list = [...office(), P('Garage Team (B1)', 'second record of the B1 parking', { area: '', kind: '', links: ['Reception'] })];
    const doc = makeDoc(), svg = drawn(doc, list);
    const vis = svg.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === 'Garage');
    vis.childNodes = vis.childNodes.filter(c => c.tagName !== 'circle');   // 점 없는 꼴(다른 애드온 · 그 확장 다음 판이 점을 다르게 그릴 때)
    const L = m.applyFloors(svg, { places: list }, { ui: null });
    assert.equal(L.alias.get('Garage Team (B1)'), 'Garage');
    const badge = vis.querySelectorAll('text.bl-twin')[0]; assert.ok(badge, '「+1」 표');
    for (const k of ['x', 'y']) assert.ok(Number.isFinite(Number(badge.getAttribute(k))), `${k} = ${badge.getAttribute(k)}`);
});
await tryOk('버그 사냥 10b: 이름이 완전히 같은 장소 둘 — 첫째(그 확장이 찾고 그리는 쪽)를 따르고 · 바깥 줄에 빈 칸이 안 생겨요', () => {
    // 그 확장 findBy · layoutPlaces 는 같은 이름이면 첫째를 써요(누르면 첫째 카드). 층별 배치도 첫째의 층에 둬야 점 자리와 카드가 맞아요
    const list = [...office(), P('Restroom', 'on 2F', { links: ['Studio'] }), P('Restroom', 'on 3F', { links: ['Board Room'] })];
    const L = m.floorLayout(list);
    assert.equal(L.pos.get('Restroom').row, 2, '첫째 장소의 층(2F)');
    const once = m.floorLayout([...office(), P('Shed', 'garden shed', { area: 'Street', kind: 'shop', links: ['Park'] })]);
    const twice = m.floorLayout([...office(), P('Shed', 'garden shed', { area: 'Street', kind: 'shop', links: ['Park'] }), P('Shed', 'garden shed', { area: 'Street', kind: 'shop', links: ['Park'] })]);
    assert.equal(r(twice.outR - twice.outL), r(once.outR - once.outL), '같은 이름 바깥 장소가 두 칸을 차지하지 않아요');
});
await tryOk('버그 사냥 10b: 구역 이름이 층 표기뿐(「2F」)이어도 층 표기뿐인 방은 건물 머리가 아니에요', () => {
    const list = [P('Lobby', '1F hall', { area: 'Tower', links: ['Office'] }), P('Office', '2F desks', { area: 'Tower', links: ['3F'] }), P('3F', 'top floor lounge', { area: 'Tower' }), P('Balcony', 'small balcony', { area: '2F', kind: 'nature', links: ['Office'] })];
    const L = m.floorLayout(list);
    assert.equal(L.pos.get('3F')?.zone, 'b', JSON.stringify(L.pos.get('3F')));
    assert.equal(L.pos.get('3F').row, 3);
});
await tryOk('버그 사냥 10b: 그림 글자 이름표 폭(헤드리스 크롬 측정 · 글자 3.2 · 굵기 600)', () => {
    // 측정(Windows 크롬 · Segoe UI Emoji): 「Bakery」 10.4 · 「Bakery🍰🍩🧁🍪」 28.0 → 그림 글자 하나 ≈ 4.4 · 「👨‍👩‍👧 Home」 14.3(가족 그림은 한 글자)
    assert.ok(m.textW('Bakery🍰🍩🧁🍪') >= 27.9, String(m.textW('Bakery🍰🍩🧁🍪')));
    assert.ok(m.textW('👨‍👩‍👧 Home') <= 16, '이어 붙인 그림 글자는 하나로 셈 ' + m.textW('👨‍👩‍👧 Home'));
    assert.ok(Math.abs(m.textW('☕️ Tea') - 10.6) < 1.2, '☕️ Tea ' + m.textW('☕️ Tea'));
    const L = m.floorLayout([...office(), P('Bakery🍰🍩🧁🍪', 'sweets', { area: 'Street', kind: 'shop', links: ['Park'] })]);
    const o = L.pos.get('Bakery🍰🍩🧁🍪');
    const lines = m.wrapLabel('Bakery🍰🍩🧁🍪', o.w - 1.5);
    assert.ok(lines.length === 2 || o.w >= 27.9 + 1, `한 줄 이름표(실제 28.0)인데 바깥 칸이 ${o.w} — 이웃과 겹쳐요`);
    assert.ok(Math.max(...lines.map(m.textW)) <= o.w, '접은 줄도 칸 안');
    // 두 줄로 끊을 때도 그림 글자 가운데(이어 붙인 가족 그림)를 가르지 않아요
    for (const ln of m.wrapLabel('👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧', 10)) assert.ok(!/^\u200d|\u200d$/.test(ln.replace(/…$/, '')), JSON.stringify(ln));
});
// 1.7.4: 처음 만든 지도에 층이 몇 곳에만 적힌 경우(본편 AI 가 「3층 회의실」 · 「4층 서고」 만 쓰고 나머지 부서는 층을 안 씀)
//   전: 3F ~ 4F 두 층짜리 건물 + 층 모르는 부서 열 곳이 땅 줄 대신 3F 줄(건물 밖)에 늘어서고 · 하늘 구역의 집 · 땅 밑 구역의 영지도 그 줄에 섞였어요
const sparse = () => [
    P('Chief Office', 'Shared office of the two chiefs.', { area: 'Civic Tower', links: ['Desk Office'] }),
    P('Desk Office', 'Scheduling and protocol.', { area: 'Civic Tower', links: ['Chief Office', 'Main Hall'] }),
    P('Review Bureau', 'Checks the rules.', { area: 'Civic Tower', links: ['Desk Office'] }),
    P('Merit Dept.', 'Judges past deeds.', { area: 'Civic Tower', links: ['Main Hall'] }),
    P('Help Desk', 'Fields appeals.', { area: 'Civic Tower', links: ['Merit Dept.'] }),
    P('Media Dept.', 'Runs the official account.', { area: 'Civic Tower', links: ['Main Hall'] }),
    P('Data Dept.', 'Server floor.', { area: 'Civic Tower', links: ['Repair Shop'] }),
    P('Repair Shop', 'Tinkerers fix things on 3F.', { area: 'Civic Tower', kind: 'workshop', links: ['Data Dept.', 'Garden Room'] }),
    P('Garden Room', 'Small 3F room full of pots.', { area: 'Civic Tower', kind: 'workroom', links: ['Main Hall'] }),
    P('Guard Post', 'Mostly naps.', { area: 'Civic Tower', links: ['Main Hall'] }),
    P('Great Library', 'The 4F archive and library.', { area: 'Civic Tower', kind: 'library', links: ['Main Hall'] }),
    P('Main Hall', 'Crowded hall.', { area: 'Civic Tower', kind: 'hall', links: ['Great Library', 'Heaven', 'Hell', 'Old Manor'] }),
    P('Old Manor', 'Historic manor just outside the tower.', { area: 'Civic Tower', kind: 'mansion', links: ['Main Hall'] }),
    P('Heaven', 'A calm realm.', { area: 'Heaven', kind: 'realm', links: ['Main Hall', 'Cottage'] }),
    P('Cottage', 'A tidy house in the first district.', { area: 'Heaven', kind: 'house', links: ['Heaven'] }),
    P('Hell', 'A loud realm.', { area: 'Hell', kind: 'realm', links: ['Main Hall', 'Dark Keep', 'Pit'] }),
    P('Dark Keep', 'A desolate domain.', { area: 'Hell', kind: 'domain', links: ['Hell'] }),
    P('Pit', 'Harsh punishment zone.', { area: 'Hell', kind: 'prison', links: ['Hell'] }),
];
await tryOk('1.7.4: 구역 장소 가운데 층이 적힌 곳이 절반이 안 되면 층별 보기를 안 해요(그 확장 그림 그대로)', () => {
    assert.equal(m.floorLayout(sparse()), null, '열세 곳 중 세 곳만 층 — 건물 단면으로 그리면 층 모르는 부서가 엉뚱한 층 줄에 서요');
    // 번역 이름 · 설명으로 층이 읽혀도 같아요
    assert.equal(m.floorLayout(sparse(), { tr: s => (s === 'Judges past deeds.' ? '5층 심사실' : s) }), null);
    // 층이 넉넉히 적힌 같은 건물(열세 곳 중 일곱)은 그대로 건물이에요
    const dense = sparse().map((p, i) => (i < 4 ? { ...p, desc: `${p.desc} On ${7 - i}F.` } : p));
    const L = m.floorLayout(dense); assert.ok(L, '절반 넘게 층이 있으면 건물'); assert.equal(L.buildings.length, 1);
    // 구역이 빈 장소(구역을 안 쓰는 지도)는 이 규칙을 안 써요 — 예전처럼 층 장소만 건물로
    const noArea = sparse().map(p => ({ ...p, area: '' }));
    assert.ok(m.floorLayout(noArea), '구역 없는 지도는 그대로');
});
await tryOk('1.7.4: 건물 맨 아래가 1층보다 높아도 바깥 장소는 1층 줄(땅) — 건물은 땅까지 내려와요', () => {
    const list = [P('Studio', '3F studio.', { links: ['Board'] }), P('Board', '4F board room.', { links: ['Lounge'] }), P('Lounge', '5F lounge.'), P('Bakery', 'Corner bakery.', { area: 'Street', kind: 'shop', links: ['Studio'] })];
    const L = m.floorLayout(list);
    assert.equal(L.groundRow, 1, '땅 줄은 1층'); assert.deepEqual(L.rows, [5, 4, 3, 2, 1]);
    assert.equal(L.pos.get('Bakery').row, 1, '바깥 장소가 3층 줄에 서지 않아요');
    assert.ok(L.pos.get('Bakery').y > L.pos.get('Studio').y);
    const b0 = L.buildings[0]; assert.deepEqual(b0.rows, [5, 4, 3, 2, 1], '건물 띠가 땅(1층)까지'); assert.equal(r(b0.bottom), r(L.groundY));
});
await tryOk('1.7.4: 하늘 · 땅 밑 구역에 든 장소(그 구역의 집 · 영지)는 바깥 줄이 아니라 그 세계 쪽에', () => {
    const list = [...office(), P('Cottage', 'A tidy house.', { area: 'Heaven', kind: 'house', links: ['Heaven'] }), P('Dark Keep', 'A desolate domain.', { area: 'Hell', kind: 'domain', links: ['Underworld'] })];
    const L = m.floorLayout(list);
    assert.equal(L.pos.get('Cottage').zone, 'above'); assert.equal(L.pos.get('Dark Keep').zone, 'below');
    assert.equal(L.pos.get('Bakery').zone, 'out', '보통 구역 바깥 장소는 그대로');
    // 건물 구역 이름에 하늘 낱말이 있어도(「Heaven Tower」) 그 구역의 층 모르는 장소는 하늘로 안 가요
    const tower = office().map(p => (p.area === 'Office' ? { ...p, area: 'Heaven Tower' } : p)).concat([P('Mail Room', 'Letters.', { area: 'Heaven Tower', links: ['Reception'] })]);
    assert.equal(m.floorLayout(tower).pos.get('Mail Room').zone, 'out');
});
await tryOk('1.7.4: 로어북 층 안내(「- **7F:** 이름, 이름」)를 읽어요 — 한 글에 서로 다른 층이 둘 넘을 때만', () => {
    const book = ['Intro text.\n### Building\n- **4F:** Chief Office, Desk Office\n- **3F:** Review Bureau\n- 2F: Merit Dept. and Help Desk\n* **1F**: Main Hall, Guard Post.\n- **B1:** Data Department\n- 지하 2층: 보관실', 'Note — 3F: just one line here.', '- 5층: 회의실, 휴게실\n- 4층: 자료실'];
    const d = m.floorDirectory(book);
    const f = n => d.filter(x => x.name === n).map(x => x.f);
    assert.deepEqual(f('Chief Office'), [4]); assert.deepEqual(f('Desk Office'), [4]); assert.deepEqual(f('Review Bureau'), [3]);
    assert.deepEqual(f('Merit Dept'), [2]); assert.deepEqual(f('Help Desk'), [2]); assert.deepEqual(f('Guard Post'), [1]); assert.deepEqual(f('Data Department'), [-1]);
    assert.deepEqual(f('보관실'), [-2]); assert.deepEqual(f('휴게실'), [5]); assert.deepEqual(f('자료실'), [4]);
    assert.equal(f('just one line here').length, 0, '층이 한 줄뿐인 글은 안내가 아니에요');
    assert.deepEqual(m.floorDirectory(null), []); assert.deepEqual(m.floorDirectory(['no floors at all']), []);
});
await tryOk('1.7.4: 같은 세계의 다른 채팅 지도(층이 설명에 몇 곳만 · 한 곳만)도 로어북 층 안내로 같은 건물 모양', () => {
    const dir = m.floorDirectory(['- **4F:** Chief Office, Desk Office\n- **3F:** Review Bureau, Merit Dept.\n- **2F:** Help Desk, Media Dept.\n- **1F:** Main Hall, Guard Post\n- **B1:** Information Technology Dept.']);
    // 앞 시험의 지도(층이 세 곳만 · 안내 없으면 null): 안내로 부서가 제 층에 · 「IT」 꼴 줄임말도
    const list = sparse().concat([P('IT Dept.', 'Server room.', { area: 'Civic Tower', links: ['Main Hall'] })]);
    assert.equal(m.floorLayout(list), null);
    const L = m.floorLayout(list, { dir }); assert.ok(L); assert.equal(L.buildings.length, 1);
    const row = n => L.pos.get(n)?.row;
    assert.equal(row('Chief Office'), 4); assert.equal(row('Review Bureau'), 3); assert.equal(row('Help Desk'), 2); assert.equal(row('Main Hall'), 1); assert.equal(row('IT Dept.'), 0);
    assert.equal(row('Repair Shop'), 3, '설명의 층이 먼저'); assert.equal(row('Great Library'), 4);
    assert.equal(L.pos.get('Old Manor').zone, 'out'); assert.equal(L.pos.get('Old Manor').row, 1);
    assert.equal(L.pos.get('Cottage').zone, 'above'); assert.equal(L.pos.get('Dark Keep').zone, 'below');
    // 다른 채팅: 구역 이름이 장소(건물 머리)이고 층은 한 곳만 — 같은 안내로 같은 층 배치
    const other = [P('Tower', 'The joint office.', { area: 'Tower', links: ['Chief Office', 'Main Hall'] }), P('Chief Office', 'Big office.', { area: 'Tower', links: ['Tower'] }), P('Desk Office', 'Desks.', { area: 'Tower', links: ['Chief Office'] }),
        P('Review Bureau', 'Rules.', { area: 'Tower', links: ['Tower'] }), P('Help Desk', 'Appeals.', { area: 'Tower', links: ['Tower'] }), P('Main Hall', 'Hall.', { area: 'Tower', links: ['Tower'] }), P('Archive Room', 'Archive on 4F.', { area: 'Tower', links: ['Tower'] }),
        P('Snack Shop', 'Lobby store.', { area: 'Tower', kind: 'shop', links: ['Tower'] }), P('Heaven', 'Realm.', { area: 'Heaven', kind: 'realm', links: ['Tower'] })];
    assert.equal(m.floorLayout(other), null);
    const O = m.floorLayout(other, { dir }); assert.ok(O);
    for (const n of ['Chief Office', 'Review Bureau', 'Help Desk', 'Main Hall']) assert.equal(O.pos.get(n).row, L.pos.get(n).row, n);
    assert.equal(O.pos.get('Tower').zone, 'above', '건물 머리는 지붕 위'); assert.equal(O.pos.get('Snack Shop').row, 1);
    // 안내 이름 둘이 서로 다른 층으로 걸리면 모르는 것(바깥 그대로)
    const two = m.floorDirectory(['- 3F: Lab\n- 5F: Lab\n- 1F: Hall']);
    assert.equal(m.floorLayout([P('Lab', 'x', { links: ['Hall'] }), P('Hall', 'y'), P('Room', 'on 2F')], { dir: two }).pos.get('Lab').zone, 'out');
});
// 1.7.5 연결선: 7F ~ B2 건물에 링크가 많으면 건물 오른쪽에 먼 층 선마다 제 줄 · 바깥 선마다 제 줄이 생겨 세로선이 열 개 넘게 빽빽했고,
//   이웃 층 계단 선은 아래층 이름표를 세로로 뚫고 · 하늘 ↔ 땅 밑 선은 층 가운데에서 꺾여 방 점을 지났어요(지어낸 이름만)
const tower = () => {
    const T = (name, desc, links, extra = {}) => P(name, desc, { area: 'Tower', links, ...extra });
    return [
        T('Tower', 'The joint office building.', ['Top Office', 'Review', 'Help Desk', 'Archive', 'Heaven', 'Hell'], { kind: 'building' }),
        T('Top Office', 'Office on 7F.', ['Desk Room', 'Tower']), T('Desk Room', 'Desks on 7F.', ['Top Office', 'Audit', 'Archive']),
        T('Audit', 'Audit floor 6F.', ['Desk Room', 'Media']), T('Media', 'Media room 5F.', ['Audit', 'Lobby']),
        T('Review', 'Review hall 4F.', ['Lobby', 'Tower']), T('Archive', 'Archive on 4F.', ['Desk Room', 'Lobby']),
        T('Repair', 'Repair shop 3F.', ['Garden Room', 'Lobby', 'Guard']), T('Garden Room', 'Pots on 3F.', ['Repair']),
        T('Help Desk', 'Help desk 2F.', ['Lobby']), T('Lobby', 'Lobby on 1F.', ['Guard', 'Server', 'Old Manor', 'Heaven', 'Hell']), T('Guard', 'Guard post 1F.', ['Lobby', 'Repair']),
        T('Server', 'Server room B2.', ['Lobby']),
        T('Old Manor', 'Historic manor next door.', ['Lobby'], { kind: 'mansion' }),
        P('Snack Shop', 'Corner store.', { kind: 'shop', area: 'Street', links: ['Audit', 'Lobby', 'Karaoke'] }), P('Karaoke', 'Songs.', { kind: 'shop', area: 'Street', links: ['Snack Shop'] }),
        P('Heaven', 'A calm realm.', { kind: 'realm', area: 'Heaven', links: ['Cottage', 'Lobby', 'Hell'] }), P('Cottage', 'A tidy house.', { kind: 'house', area: 'Heaven', links: ['Heaven'] }),
        P('Hell', 'A loud realm.', { kind: 'realm', area: 'Hell', links: ['Dark Keep', 'Pit', 'Lobby'] }), P('Dark Keep', 'A desolate domain.', { kind: 'domain', area: 'Hell', links: ['Hell'] }), P('Pit', 'Harsh zone.', { kind: 'prison', area: 'Hell', links: ['Hell'] }),
    ];
};
/** 모든 연결선을 그려 세요: 겹친 세로선(서로 3 안쪽으로 붙어 나란히 2 넘게 가는 서로 다른 세로선) · 점(반지름 2.8)이나 이름표를 지나는 (선, 장소) · 통로 밖에서 층을 건너는 세로선 */
const lineStats = L => {
    const routes = L.pairs.map(([a, b]) => ({ a, b, pts: m.routeOf(L, a, b, null, { left: 0, out: 0 }) }));
    const segs = r => r.pts.slice(1).map((p, i) => [r.pts[i], p]);
    const vert = new Map();
    for (const r of routes) for (const [p, q] of segs(r)) if (p[0] === q[0] && Math.abs(p[1] - q[1]) >= 1) { const k = p[0]; if (!vert.has(k)) vert.set(k, []); vert.get(k).push([Math.min(p[1], q[1]), Math.max(p[1], q[1])]); }
    const xs = [...vert.keys()], crowded = new Set();
    for (const x of xs) for (const y of xs) if (x < y && y - x < 3 && vert.get(x).some(([a0, a1]) => vert.get(y).some(([b0, b1]) => Math.min(a1, b1) - Math.max(a0, b0) > 2))) { crowded.add(x); crowded.add(y); }
    const cross = [];
    for (const [n, o] of L.pos) {
        if (L.alias?.has(n)) continue;
        const lines = m.wrapLabel(n, (o.w || 21) - 1.5), w = Math.max(...lines.map(m.textW));
        const lab = [o.x - w / 2 + 0.2, o.y - 4.4 - (lines.length - 1) * 3.4 - 2.2, o.x + w / 2 - 0.2, o.y - 4.4 + 0.6];
        for (const rt of routes) {
            const own = n === rt.a || n === rt.b;
            const hit = segs(rt).some(([p, q]) => {
                if (Math.max(p[0], q[0]) > lab[0] && Math.min(p[0], q[0]) < lab[2] && Math.max(p[1], q[1]) > lab[1] && Math.min(p[1], q[1]) < lab[3]) return true;
                if (own) return false;
                const cx = Math.max(Math.min(p[0], q[0]), Math.min(o.x, Math.max(p[0], q[0]))), cy = Math.max(Math.min(p[1], q[1]), Math.min(o.y, Math.max(p[1], q[1])));
                return Math.hypot(cx - o.x, cy - o.y) < 2.75;
            });
            if (hit) cross.push(`${rt.a}-${rt.b} × ${n}`);
        }
    }
    const offShaft = routes.filter(rt => segs(rt).some(([p, q]) => p[0] === q[0] && L.buildings.some(b => p[0] > b.left && p[0] < b.shaftL && Math.min(Math.max(p[1], q[1]), b.bottom) - Math.max(Math.min(p[1], q[1]), b.top) > 5))).map(rt => `${rt.a}-${rt.b}`);
    const leftOut = routes.filter(rt => L.pos.get(rt.a).x >= L.bLeft && L.pos.get(rt.b).x >= L.bLeft && rt.pts.some(([x]) => x < L.bLeft - 0.5)).map(rt => `${rt.a}-${rt.b}`);
    return { routes, crowded: crowded.size, cross, offShaft, leftOut };
};
await tryOk('1.7.5 연결선: 층 사이 선은 공용 통로 하나로 모여 세로선이 겹치지 않아요', () => {
    const L = m.floorLayout(tower()); assert.ok(L); assert.equal(L.buildings.length, 1);
    const s = lineStats(L);
    assert.equal(s.crowded, 0, `겹친 세로선 ${s.crowded}`);
    assert.deepEqual(s.offShaft, [], '통로 밖에서 층을 건너는 세로선');
    // 건물 안에서 층을 건너는 세로 구간은 모두 같은 x(통로 하나)
    const b0 = L.buildings[0], xs = new Set();
    for (const rt of s.routes) rt.pts.slice(1).forEach((q, i) => { const p = rt.pts[i]; if (p[0] === q[0] && Math.min(Math.max(p[1], q[1]), b0.bottom) - Math.max(Math.min(p[1], q[1]), b0.top) > 5) xs.add(p[0]); });
    assert.equal(xs.size, 1, JSON.stringify([...xs]));
    assert.ok([...xs][0] > b0.roomR && [...xs][0] < b0.right, '통로는 방 칸 오른쪽 승강기 줄 안');
});
await tryOk('1.7.5 연결선: 선이 다른 장소의 점 · 이름표(제 이름표 포함)를 가로지르지 않아요', () => {
    const s = lineStats(m.floorLayout(tower()));
    assert.deepEqual(s.cross, []);
    assert.deepEqual(s.leftOut, [], '건물 왼쪽 벽 밖으로 돌아가지 않아요');
    // 사무 건물(이웃 층 계단 선 · 하늘 · 땅 밑)도
    const o = lineStats(m.floorLayout(office()));
    assert.deepEqual(o.cross, []); assert.equal(o.crowded, 0);
});
await tryOk('1.7.5 연결선: 바깥 장소로 가는 선은 가장 가까운 벽(오른쪽)으로 나가 땅 줄 복도로 — 건물과 바깥 사이에 선마다 줄을 안 만들어요', () => {
    const L = m.floorLayout(tower()), S = L.pos.get('Snack Shop');
    const pts = m.routeOf(L, 'Audit', 'Snack Shop', null, { left: 0, out: 0 });
    // 건물 오른쪽 벽 밖 세로 구간은 바깥 장소로 올라가는 끝 한 토막뿐
    const outside = pts.slice(1).map((q, i) => [pts[i], q]).filter(([p, q]) => p[0] === q[0] && p[0] > L.bRight);
    assert.equal(outside.length, 1, JSON.stringify(pts)); assert.equal(outside[0][0][0], S.x);
    assert.ok(Math.abs(outside[0][0][1] - outside[0][1][1]) < 5, '바깥 장소 바로 밑 복도에서 올라가요');
    assert.ok(L.outL - L.bRight <= 4.01, `바깥 장소가 건물 곁에 붙어요(${L.outL - L.bRight})`);
});
await tryOk('1.7.5 연결선: 겹쳐 지나는 선은 한 번만 그려요(진하기가 쌓이지 않게)', () => {
    const doc = makeDoc(), places = tower(), svg = drawn(doc, places);
    m.applyFloors(svg, { places }, { ui: null });
    const paths = svg.querySelector('g.edges').querySelectorAll('path.bl-route');
    assert.ok(paths.length >= 1 && paths.length <= 2, String(paths.length));
    const seen = new Set();
    for (const p of paths) for (const sub of p.getAttribute('d').split(/(?=M)/)) {
        const pts = [...sub.matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map(x => [Number(x[1]), Number(x[2])]);
        assert.ok(straight(pts), sub);
        for (let i = 1; i < pts.length; i++) { const k = [pts[i - 1], pts[i]].map(String).sort().join('|'); assert.ok(!seen.has(k), '같은 토막 두 번 ' + k); seen.add(k); }
    }
});
// ── 1.7.5 아직 안 가 본 곳(로어북 장소 가운데 지도 자료에 없는 곳 · 그림만) ─────────────────────
//   지어낸 로어북: 층 안내가 있는 탑 · 인물 셋(집 둘 · 집 없음 하나) · 장소 묶음 · 「[장소]」 항목 · 규칙 항목
const LORE = () => [
    { comment: '[설정]Tower', content: '### Building Structure\n- **5F:** Sky Lounge, Board Office\n- **2F:** Mail Room\n- **B1:** Boiler Room\n\n#### Other Facilities\n- **Sky Lounge (空ラウンジ):** A rooftop lounge for staff.\n- **Role:** Keeping the tower running.\n- **Departments & Key Personnel:** Board Office: Pip' },
    { comment: '[🌟]미로', content: '### BASICS\n- **Name:** Miro (ミロ)\n- **Residence:** A small cottage in the Sky Realm, Ward 2\n- **Job:** Clerk' },
    { comment: '[😈]고름', content: '#### BASICS\n* Name: Gorm\n* Residence: Penthouse in the Underworld, Ward 4\n* Job: Guard' },
    { comment: '[🌟]핍', content: '- **Name:** Pip\n- **Job:** Baker' },
    { comment: '[설정]지리', content: '### Major Locations\n- **Old Port :**\n    - **Role:** A fishing harbor.\n- **Pip:** listed here by mistake.\n---\n### Society\n- **Clans:** Old families.' },
    { comment: '[장소]달빛 찻집', content: '작은 찻집이에요. 밤에만 열어요.' },
    { comment: '[규칙]말투', content: '- Speak politely: always.\n- Residence rules: none.' },
];
await tryOk('1.7.5 아직 안 가 본 곳: 로어북에서 장소만 골라요(층 안내 · 인물의 집 · 장소 묶음 · [장소] 항목) — 인물 · 풀이 칸 · 규칙은 빼요', () => {
    const lore = m.lorePlaces(LORE());
    const by = new Map(lore.map(c => [c.label, c]));
    assert.deepEqual([...by.keys()].sort(), ['Board Office', 'Boiler Room', 'Mail Room', 'Old Port', 'Sky Lounge', '고름의 집', '달빛 찻집', '미로의 집'].sort());
    assert.equal(by.get('Sky Lounge').f, 5); assert.equal(by.get('Boiler Room').f, -1); assert.equal(by.get('Sky Lounge').summary, 'A rooftop lounge for staff.', '층 안내 이름의 설명 글머리');
    assert.equal(by.get('미로의 집').zone, 'above'); assert.equal(by.get('고름의 집').zone, 'below'); assert.equal(by.get('Old Port').zone, null, '모르면 바깥(배치에서)');
    assert.deepEqual(by.get('고름의 집').owners.sort(), ['Gorm', '고름'].sort());
    assert.match(by.get('미로의 집').summary, /cottage in the Sky Realm/);
    assert.equal(by.get('Old Port').summary, 'Role: A fishing harbor.', '이름 뒤 글이 없으면 첫 풀이 줄');
    assert.equal(by.get('달빛 찻집').src, 'entry');
    const skipped = lore.skipped.map(s => `${s.name}:${s.why}`);
    for (const want of ['Pip:사람 이름이에요', 'Role:풀이 칸 이름이에요', 'Departments & Key Personnel:풀이 칸 이름이에요']) assert.ok(skipped.includes(want), want + ' ← ' + skipped.join(' / '));
    assert.ok(!by.has('Clans') && !by.has('Speak politely') && !by.has('핍의 집'), '장소 머리말 밖 · 규칙 · 집 없는 인물은 안 넣어요');
    // 영어 이름 항목(항목 이름이 비었으면 Name 줄) · 일본어 항목 이름
    const en = m.lorePlaces([{ comment: '', content: 'Name: Tova\nResidence: Hut by the Old Port' }, { comment: 'リナ', content: 'Name: Rina\nResidence: 天界の家' }]);
    assert.deepEqual(en.map(c => [c.label, c.zone]), [["Tova's home", 'out'], ['リナの家', 'above']]);
});
await tryOk('1.7.5 아직 안 가 본 곳: 이름은 정규화해서 견줘요(띄어쓰기 · 「의」 · 「\'s」 · 괄호 · 앞 「the」) · 건물 이름 앞붙음 · 집 주인 · 지도에 들어오면 사라져요', () => {
    for (const [a, b] of [["Miro's Cottage", 'Miro Cottage'], ['미로의 집', '미로 집'], ['Sky Lounge (空ラウンジ)', 'sky lounge'], ['The Old Port', 'Old-Port'], ['달빛 찻집', '달빛찻집']]) assert.equal(m.placeNorm(a), m.placeNorm(b), `${a} ↔ ${b}`);
    assert.notEqual(m.placeNorm('의무실'), m.placeNorm('무실'), '낱말 안의 「의」 는 그대로');
    const lore = m.lorePlaces(LORE());
    const Q = (name, area = 'Tower HQ', extra = {}) => ({ name, area, desc: '', kind: 'room', links: [], known: true, ...extra });
    const map = { places: [Q('Tower Mail Room'), Q('Board Dept.'), Q("Gorm's Penthouse", 'Underworld'), Q('the old port', 'Coast'), Q('Moonlight', 'Town')] };
    const un = m.unvisitedOf(map, lore).map(c => c.label).sort();
    assert.deepEqual(un, ['Boiler Room', 'Sky Lounge', '달빛 찻집', '미로의 집'].sort(), '건물 이름 앞붙음(Tower Mail Room ↔ Mail Room) · 부서 꼬리(Board Office ↔ Board Dept.) · 집 주인(Gorm\'s Penthouse) · 작은 글자 · 앞 the');
    // 번역 보기 글로도 맞춰요
    const tr = s => ({ Moonlight: '달빛 찻집' })[s] || s;
    assert.ok(!m.unvisitedOf({ places: [...map.places] }, lore, { tr }).some(c => c.label === '달빛 찻집'));
    // 이야기에 나와 지도에 들어오면 흐린 점이 사라져요(같은 목록이면 앞 결과 · 새 목록이면 다시 봐요)
    const more = { places: [...map.places, Q('Sky Lounge 5F')] };
    assert.ok(!m.unvisitedOf(more, lore).some(c => c.label === 'Sky Lounge'));
    assert.equal(m.unvisitedOf(map, lore), m.unvisitedOf(map, lore), '같은 장소 목록 · 같은 후보면 한 번만 견줘요');
    // 지도 자료는 그대로
    assert.deepEqual(map.places.map(p => p.name), ['Tower Mail Room', 'Board Dept.', "Gorm's Penthouse", 'the old port', 'Moonlight']);
});
const GH = (key, label, extra = {}) => ({ key: `bl-unv:${key}`, label, f: null, zone: null, summary: '', ...extra });
await tryOk('1.7.5 아직 안 가 본 곳 배치: 층 있는 곳은 건물 그 층(진짜 방 오른쪽) · 하늘은 하늘 줄 위 · 땅 밑은 땅 밑 줄 아래 · 모르면 바깥 줄', () => {
    const places = office(), before = m.floorLayout(places);
    const ghosts = [GH('loft', 'Loft', { f: 2 }), GH('vault', 'Vault', { f: -1 }), GH('a1', 'Sky Hut', { zone: 'above' }), GH('a2', 'Cloud Hut', { zone: 'above' }), GH('b1', 'Ash Den', { zone: 'below' }), GH('o1', 'Old Port', { zone: null }), GH('o2', 'Mill', { zone: 'out' })];
    const L = m.floorLayout(places, { ghosts });
    const at = k => L.pos.get(`bl-unv:${k}`);
    assert.equal(at('loft').zone, 'b'); assert.equal(at('loft').row, 2); assert.equal(at('loft').y, L.pos.get('Studio').y); assert.ok(at('loft').x > L.pos.get('Studio').x, '진짜 방 오른쪽');
    assert.equal(at('vault').row, 0); assert.equal(at('vault').y, L.pos.get('Garage').y);
    for (const k of ['a1', 'a2']) { assert.equal(at(k).zone, 'above'); assert.ok(at(k).y < L.pos.get('Heaven').y, k); }
    assert.equal(at('b1').zone, 'below'); assert.ok(at('b1').y > L.pos.get('Underworld').y);
    for (const k of ['o1', 'o2']) { assert.equal(at(k).zone, 'out'); assert.equal(at(k).y, L.pos.get('Bakery').y, '땅 줄'); assert.ok(at(k).x > Math.max(L.pos.get('Bakery').x, L.pos.get('Park').x), '진짜 바깥 장소 뒤'); }
    for (const g of ghosts) assert.equal(L.pos.get(g.key).ghost, true);
    // 겹치지 않아요 · 선 짝은 그대로(흐린 점은 선이 없어요)
    const spots = [...L.pos.values()].map(o => `${o.x}|${o.y}`); assert.equal(new Set(spots).size, spots.length, '점 자리 겹침');
    assert.deepEqual(L.pairs, before.pairs);
    // 건물을 새로 만들지는 않아요(층 없는 지도 + 층 있는 흐린 점 → 그대로 null)
    const flat = [P('Hall', 'Big hall.', { links: ['Yard'] }), P('Yard', 'Open yard.', { links: ['Hall'] })];
    assert.equal(m.floorLayout(flat, { ghosts }), null);
    // 줄이 넘치면 다음 줄(위로 쌓여요)
    const many = Array.from({ length: 9 }, (_, i) => GH(`s${i}`, `Sky ${i}`, { zone: 'above' }));
    const L2 = m.floorLayout(places, { ghosts: many }), ys = [...new Set(many.map(g => L2.pos.get(g.key).y))].sort((a, b) => b - a);
    assert.ok(ys.length >= 2 && ys.every((y, i) => !i || ys[i - 1] - y >= 18.9), ys.join(','));
});
await tryOk('1.7.5 아직 안 가 본 곳 그리기: 점선 흐린 점 · 「아직 안 가 본 곳」 · 그 확장 장소 점과 따로(data-act 없음) · 구역 탭에선 안 그려요 · 층 없는 지도도', () => {
    const places = office(), lore = [GH('loft', 'Loft', { f: 2, names: ['Loft'], summary: 'Dusty loft.' }), GH('a1', 'Sky Hut', { zone: 'above', names: ['Sky Hut'] }), GH('st', 'Studio', { f: 2, names: ['Studio'] })];
    const doc = makeDoc(), svg = drawn(doc, places);
    const L = m.applyFloors(svg, { places }, { ui: { mapVB: null }, lore });
    const gs = svg.querySelectorAll('g.bl-unv');
    assert.deepEqual(gs.map(g => g.getAttribute('data-bl-unv')).sort(), ['bl-unv:a1', 'bl-unv:loft'], '지도에 있는 Studio 는 빼요');
    for (const g of gs) {
        assert.equal(g.getAttribute('data-act'), null); assert.ok(g.querySelector('circle.bl-unv-dot') && g.querySelector('circle.bl-unv-hit'));
        assert.equal(g.querySelector('text.bl-unv-tag').textContent, m.GH_TAG); assert.equal(m.GH_TAG, '아직 안 가 본 곳');
        const o = L.pos.get(g.getAttribute('data-bl-unv')); assert.equal(Number(g.querySelector('circle.bl-unv-dot').getAttribute('cx')), o.x);
    }
    assert.equal(svg.querySelectorAll('g.node[data-arg]').length, places.length, '그 확장 점은 그대로');
    // 보기 칸에 흐린 점이 들어가요
    const [x0, y0, w, h] = svg.getAttribute('viewBox').split(' ').map(Number), sky = L.pos.get('bl-unv:a1');
    assert.ok(sky.x > x0 && sky.x < x0 + w && sky.y - 8 > y0 && sky.y < y0 + h, svg.getAttribute('viewBox'));
    // 구역 탭(ui.mapArea)을 고르면 안 그려요
    const svg2 = drawn(makeDoc(), places); m.applyFloors(svg2, { places }, { ui: { mapVB: null, mapArea: 'Office' }, lore });
    assert.equal(svg2.querySelectorAll('g.bl-unv').length, 0);
    // 층 없는 지도(그 확장 배치) · 층별 보기 끔: 맨 아래 점들 밑(하늘 쪽은 맨 위 점들 위)에 줄로 · 보기 칸을 넓혀요
    const flat = [P('Hall', 'Big hall.', { links: ['Yard'] }), P('Yard', 'Open yard.', { links: ['Hall'] }), P('Gate', 'Gate.', { links: ['Yard'] })];
    for (const [pl, opt] of [[flat, {}], [places, { floors: false }]]) {
        const s3 = drawn(makeDoc(), pl), was = s3.getAttribute('viewBox');
        assert.equal(m.applyFloors(s3, { places: pl }, { ui: { mapVB: null }, lore, ...opt }), null);
        assert.equal(s3.getAttribute('data-bl-floors'), 'none');
        const g3 = s3.querySelectorAll('g.bl-unv'); assert.ok(g3.length >= 2, String(g3.length));
        const dots = s3.querySelectorAll('g.node').map(g => Number(g.querySelector('circle.dot').getAttribute('cy')));
        const cy = k => Number(g3.find(g => g.getAttribute('data-bl-unv') === k).querySelector('circle.bl-unv-dot').getAttribute('cy'));
        assert.ok(cy('bl-unv:a1') < Math.min(...dots) && cy('bl-unv:loft') > Math.max(...dots));
        assert.notEqual(s3.getAttribute('viewBox'), was);
        // 보던 칸(끌기 · 확대)은 그대로
        const s4 = drawn(makeDoc(), pl); s4.setAttribute('viewBox', '1 2 30 30'); m.applyFloors(s4, { places: pl }, { ui: { mapVB: [1, 2, 30, 30] }, lore, ...opt }); assert.equal(s4.getAttribute('viewBox'), '1 2 30 30');
    }
});
const dump = e => `${e.tagName}${JSON.stringify(e.attrs)}${e.text ?? ''}[${e.childNodes.map(dump).join(',')}]`;
await tryOk('1.7.5 스위치 끔(lore 없음) · 다 가 본 곳이면 지금과 같은 그림', () => {
    for (const pl of [office(), [P('Hall', 'Big hall.', { links: ['Yard'] }), P('Yard', 'Open yard.', { links: ['Hall'] })]]) {
        const a = drawn(makeDoc(), pl), b = drawn(makeDoc(), pl), c = drawn(makeDoc(), pl);
        m.applyFloors(a, { places: pl }, { ui: { mapVB: null } });
        m.applyFloors(b, { places: pl }, { ui: { mapVB: null }, lore: null });
        m.applyFloors(c, { places: pl }, { ui: { mapVB: null }, lore: [GH('h', pl[0].name, { names: [pl[0].name] })] });
        assert.equal(dump(b), dump(a)); assert.equal(dump(c), dump(a));
    }
    // 스위치 표: 화면만 바꾸는 것 · 기본 켬 · 끄면 표식에
    return import(pathToFileURL(path.join(root, 'src/mb-switch.js')).href).then(SW => {
        const sw = SW.switchOf('unvisited'); assert.ok(sw); assert.equal(sw.kind, 'screen'); assert.equal(sw.file, 'src/mb-map-floors.js');
        assert.equal(SW.switchOn({ chat: {} }, 'unvisited'), true);
        const chat = {}; SW.setSwitch(chat, 'unvisited', false); assert.ok(SW.offAttrValue({ chat }).split(' ').includes('unvisited'));
        assert.match(read('src/ext-status.css'), /\/\* @mb unvisited \*\/\n[^@]*g\.bl-unv \.bl-unv-dot \{[^}]*stroke-dasharray/);
    });
});
await tryOk('1.7.6 집 주인 이름은 낱말 머리에서만 맞춰요(「Ann」 ↔ 「Joann 의 가게」 · 「수아」 ↔ 「지수아의 방」 은 다른 사람)', async () => {
    // 고치기 전: 주인 이름이 다른 이름의 꼬리와 같으면(includes) 「가 본 곳」 으로 봐서 그 집이 흐린 점으로 안 나왔어요
    const home = (label, owners) => ({ label, names: [label], owners });
    const seen = (c, names) => m.visitedPlace(c, names.map(name => ({ name })));
    assert.equal(seen(home("Ann's home", ['Ann']), ["Joann's Cafe", 'Plaza']), false, '영어 이름 꼬리');
    assert.equal(seen(home('수아의 집', ['수아']), ['지수아의 방', '광장']), false, '한국어 이름 꼬리');
    assert.equal(seen(home("Ann's home", ['Ann']), ["Ann's Estate", 'Plaza']), true, '그 사람의 집은 가 본 곳');
    assert.equal(seen(home("Ann's home", ['Ann']), ["Old Ann's Cottage"]), true, '앞에 낱말이 있어도');
    assert.equal(seen(home('수아의 집', ['수아']), ['수아의 저택']), true);
    assert.equal(seen(home('수아의 집', ['수아']), ['2층 수아의 방']), true);
    assert.equal(seen(home('ミロの家', ['ミロ']), ['東区ミロの屋敷']), true, '띄어 쓰지 않는 일본어는 예전처럼 어디든');
    assert.equal(seen(home("Ann's home", ['Ann']), ["Villa Ann's"]), true, '이름으로 끝나도');
});
await tryOk('1.7.5 붙이기: 로어북은 채팅 · 로어북이 바뀔 때만 한 번 읽어요(지도를 몇 번 다시 그려도) · 스위치를 끄면 흐린 점을 안 그려요', async () => {
    const places = office(), map = { places };
    let wiReads = 0, off = '', cb = null; const listeners = {};
    const doc = {
        body: { getAttribute: k => (k === m.FLOOR_ATTR ? 'on' : null), hasAttribute: () => false, classList: { contains: c => c === 'salty' } },
        documentElement: { getAttribute: k => (k === 'data-bl-mb-off' ? off : null) },
        querySelectorAll: () => [], addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn); },
    };
    const ctx = { characterId: 0, getCurrentChatId: () => 'chat-1', chatMetadata: {},
        characters: [{ data: { extensions: { world: 'book' }, character_book: { entries: [{ comment: '[🌟]미로', content: '- **Name:** Miro\n- **Residence:** A cottage in the Sky Realm' }] } } }],
        loadWorldInfo: async () => { wiReads++; return { entries: { 0: { comment: '[장소]달빛 찻집', content: '작은 찻집이에요.' } } }; } };
    const core = { app: { current: { state: { data: { map } } }, renderPanel() {} } };
    assert.equal(m.startMbFloors(doc, { watch: (_t, o, fn) => { if (o.childList) cb = fn; }, load: () => core, stCtx: () => ctx }), true);
    const tick = () => new Promise(res => setTimeout(res, 5));
    await tick();
    const draw = () => { const svg = drawn(makeDoc(), places); cb([{ addedNodes: [svg] }]); return svg; };
    draw(); await tick();
    const shown = [];
    for (let i = 0; i < 12; i++) { const s = draw(); shown.push(s.querySelectorAll('g.bl-unv').length); }   // 메시지마다 상태창이 다시 그려지는 것처럼
    assert.equal(wiReads, 1, '로어북 파일은 한 번만');
    assert.ok(shown.every(k => k === 2), shown.join(','));
    off = 'unvisited';
    const s2 = draw(); assert.equal(s2.querySelectorAll('g.bl-unv').length, 0, '끄면 흐린 점 없음');
    assert.equal(s2.getAttribute('data-bl-floors'), 'on', '층별 보기는 그대로');
    off = '';
    ctx.getCurrentChatId = () => 'chat-2'; draw(); await tick(); assert.equal(wiReads, 2, '채팅이 바뀌면 다시 읽어요');
});
await tryOk('1.7.6 다른 캐릭터로 넘어간 뒤 지도를 처음 열 때 앞 캐릭터의 로어북 장소로 그리지 않아요(읽을 때까지 기다렸다 한 번에)', async () => {
    // 리그(폰 384 · 미트볼 2.8.0)에서 본 것: 캐릭터 B 의 지도에 캐릭터 A 의 「달빛 찻집」 이 먼저 그려졌다가 다시 그려졌어요
    const fresh = await import(pathToFileURL(path.join(root, 'src/mb-map-floors.js')).href + '?other-card');
    const places = office(), map = { places };
    let cb = null, renders = 0; const live = [];
    const doc = {
        body: { getAttribute: k => (k === fresh.FLOOR_ATTR ? 'on' : null), hasAttribute: () => false, classList: { contains: c => c === 'salty' } },
        documentElement: { getAttribute: () => null },
        querySelectorAll: sel => (sel.includes('svg.ss-map') ? live.filter(s => (sel.includes(':not([data-bl-floors])') ? !s.getAttribute('data-bl-floors') : true)) : []), addEventListener: () => {},
    };
    const book = name => ({ entries: [{ comment: '[장소]' + name, content: '작은 가게예요.' }] });
    const ctx = { characterId: 0, getCurrentChatId: () => 'chat-a', chatMetadata: {},
        characters: [{ data: { character_book: book('달빛 찻집') } }, { data: { extensions: { world: 'book-b' }, character_book: book('별빛 서점') } }],
        loadWorldInfo: async () => { await new Promise(res => setTimeout(res, 30)); return { entries: {} }; } };
    const core = { app: { current: { state: { data: { map } } }, renderPanel() { renders++; } } };
    assert.equal(fresh.startMbFloors(doc, { watch: (_t, o, fn) => { if (o.childList) cb = fn; }, load: () => core, stCtx: () => ctx }), true);
    const tick = (ms = 5) => new Promise(res => setTimeout(res, ms));
    const names = svg => svg.querySelectorAll('g.bl-unv').map(g => g._blGhost.label);
    const draw = () => { const svg = drawn(makeDoc(), places); live.push(svg); cb([{ addedNodes: [svg] }]); return svg; };
    await tick();
    draw(); await tick();
    const a = draw();
    assert.deepEqual(names(a), ['달빛 찻집'], '캐릭터 A 의 지도');
    ctx.characterId = 1; ctx.getCurrentChatId = () => 'chat-b';
    const b = draw();
    assert.ok(!names(b).includes('달빛 찻집'), '읽기 전: 앞 캐릭터의 장소를 그리지 않아요 — ' + names(b).join(','));
    await tick(80);
    assert.deepEqual(names(b), ['별빛 서점'], '읽은 뒤: 그 자리에서 한 번에 입혀요');
    assert.equal(b.getAttribute('data-bl-floors'), 'on');
    // 같은 캐릭터의 다른 채팅은 예전처럼 바로 그려요(로어북이 같아요)
    ctx.getCurrentChatId = () => 'chat-b2';
    assert.deepEqual(names(draw()), ['별빛 서점']);
});
await tryOk('버그 사냥 4: 지도를 열지 않고 다른 캐릭터 · 채팅으로 넘어간 뒤 번역 다리가 가져가는 글은 앞 채팅 로어북 것이 아니에요(읽는 중이면 빈 목록 · 다 읽으면 그 채팅 것)', async () => {
    const fresh = await import(pathToFileURL(path.join(root, 'src/mb-map-floors.js')).href + '?hunt4-registry');
    const places = office(), map = { places };
    let cb = null; const live = [];
    const doc = {
        body: { getAttribute: k => (k === fresh.FLOOR_ATTR ? 'on' : null), hasAttribute: () => false, classList: { contains: c => c === 'salty' } },
        documentElement: { getAttribute: () => null },
        querySelectorAll: sel => (sel.includes('svg.ss-map') ? live.filter(s => (sel.includes(':not([data-bl-floors])') ? !s.getAttribute('data-bl-floors') : true)) : []), addEventListener: () => {},
    };
    const book = name => ({ entries: [{ comment: '[장소]' + name, content: '작은 가게예요.' }] });
    const ctx = { characterId: 0, getCurrentChatId: () => 'chat-a', chatMetadata: {},
        characters: [{ data: { character_book: book('달빛 찻집') } }, { data: { extensions: { world: 'book-b' }, character_book: book('별빛 서점') } }],
        loadWorldInfo: async () => { await new Promise(res => setTimeout(res, 30)); return { entries: {} }; } };
    const core = { app: { current: { state: { data: { map } } }, renderPanel() {} } };
    const REG = Symbol.for('blue-lemonade.mb-unvisited.v1'), old = globalThis[REG];
    try {
        fresh.startMbFloors(doc, { watch: (_t, o, fn) => { if (o.childList) cb = fn; }, load: () => core, stCtx: () => ctx });
        const tick = (ms = 5) => new Promise(res => setTimeout(res, ms));
        await tick();
        const svg = drawn(makeDoc(), places); live.push(svg); cb([{ addedNodes: [svg] }]); await tick(60);
        const get = globalThis[REG];
        assert.deepEqual(get().map(x => x.name), ['달빛 찻집'], 'A 채팅');
        ctx.characterId = 1; ctx.getCurrentChatId = () => 'chat-b';   // 지도를 열지 않고 B 로
        assert.deepEqual(get(), [], 'B 로어북을 읽는 중: 앞 캐릭터 글을 안 내줘요');
        await tick(80);
        assert.deepEqual(get().map(x => x.name), ['별빛 서점'], '다 읽은 뒤: B 의 글');
    } finally { globalThis[REG] = old; }
});
await tryOk('버그 사냥 4: 번역 사전이 늘면(같은 장소 목록이어도) 안 가 본 곳을 다시 골라요 — 이미 지도에 있는 곳을 흐린 점으로 또 그리지 않아요', async () => {
    const places = [{ name: 'Moonlit Cafe', desc: '', kind: 'shop', area: 'Town', links: [] }, { name: 'Plaza', desc: '', kind: 'x', area: 'Town', links: [] }];
    const lore = [{ key: 'bl-unv:a', label: '달빛 찻집', names: ['달빛 찻집'], owners: [], zone: 'out', summary: '' }];
    const dict = {}; const tr = s => dict[s] ?? s;
    assert.deepEqual(m.unvisitedOf({ places }, lore, { tr }).map(g => g.label), ['달빛 찻집'], '번역 전');
    dict['Moonlit Cafe'] = '달빛 찻집';
    assert.deepEqual(m.unvisitedOf({ places }, lore, { tr }).map(g => g.label), [], '번역 뒤 같은 목록');
    assert.deepEqual(m.unvisitedTexts({ places }, lore, { tr }), [], '번역 다리에도 안 내줘요');
});
await tryOk('1.7.6 안 가 본 곳 번역: 사전에 있으면 이름 · 카드 설명을 번역으로 · 원문 보기면 영어 그대로 · 번역 이름이 지도 장소와 같으면 두 번 안 그려요 · 번역할 글을 번역 다리에 내줘요', async () => {
    const places = office(), map = { places };
    const lore = [{ key: 'bl-unv:lobby', label: 'Lobby', names: ['Lobby'], f: null, zone: 'out', summary: 'A wide hall with two information desks.', owners: [], from: 'Tower', src: 'section' },
        { key: 'bl-unv:staffcanteen', label: 'Staff Canteen', names: ['Staff Canteen'], f: null, zone: 'out', summary: 'A restaurant where employees eat together.', owners: [], from: 'Tower', src: 'section' }];
    const dict = { Lobby: '로비', 'A wide hall with two information desks.': '안내 창구 둘이 있는 넓은 홀이에요.' };
    const tr = s => dict[String(s ?? '').trim()];
    const names = svg => svg.querySelectorAll('g.bl-unv').map(g => g._blGhost.label);
    // 번역 켬: 사전에 있는 이름만 번역 · 없는 이름은 영어 그대로(번역 단추를 누르면 채워져요)
    let svg = drawn(makeDoc(), places); m.applyFloors(svg, map, { lore, tr });
    assert.deepEqual(names(svg).sort(), ['Staff Canteen', '로비']);
    const lobby = svg.querySelectorAll('g.bl-unv').map(g => g._blGhost).find(g => g.key === 'bl-unv:lobby');
    assert.equal(lobby.sum, '안내 창구 둘이 있는 넓은 홀이에요.', '카드 설명도 번역'); assert.equal(lobby.summary, 'A wide hall with two information desks.', '원문은 그대로 둬요');
    // 원문 보기(tr 없음): 영어 그대로
    svg = drawn(makeDoc(), places); m.applyFloors(svg, map, { lore, tr: null });
    assert.deepEqual(names(svg).sort(), ['Lobby', 'Staff Canteen']);
    assert.equal(svg.querySelectorAll('g.bl-unv').map(g => g._blGhost)[0].sum, undefined);
    // 이야기에 나와 지도에 다른 영어 이름으로 들어왔는데 번역 이름이 같으면(「Employee Cafeteria」 · 「Staff Canteen」 → 둘 다 「구내식당」) 흐린 점을 또 안 그려요
    const more = [...places, { name: 'Employee Cafeteria', desc: '', kind: 'shop', area: places[0].area, links: [], x: 50, y: 50 }];
    const d2 = { ...dict, 'Employee Cafeteria': '구내식당', 'Staff Canteen': '구내 식당' }, tr2 = s => d2[String(s ?? '').trim()];
    svg = drawn(makeDoc(), more); m.applyFloors(svg, { places: more }, { lore, tr: tr2 });
    assert.deepEqual(names(svg), ['로비'], '같은 번역 이름은 가 본 곳');
    // 번역 다리에 내주는 글: 지금 흐린 점으로 그릴 곳의 이름 · 설명(원문)
    assert.deepEqual(m.unvisitedTexts(map, lore, { tr }), [{ name: 'Lobby', summary: 'A wide hall with two information desks.' }, { name: 'Staff Canteen', summary: 'A restaurant where employees eat together.' }]);
    assert.deepEqual(m.unvisitedTexts(map, [], { tr }), []);
    // 카드: 번역 설명이 있으면 그것을 보여요
    const src = fs.readFileSync(path.join(root, 'src/mb-map-floors.js'), 'utf8');
    assert.ok(src.includes('g.sum ?? g.summary')); assert.ok(src.includes("Symbol.for('blue-lemonade.mb-unvisited.v1')"));
});
await tryOk('1.7.8 안 가 본 곳 줄: 「<이름>의 집」 이 한 줄에 들고(한 이름만 꺾이지 않게) · 둘째 줄 이름표가 윗줄 「아직 안 가 본 곳」 글과 안 붙어요 · 옆 이름표끼리 안 겹쳐요', async () => {
    // 사용자 폰 사진(1.7.7): 땅 밑 줄 다섯 · 여섯 글자 이름의 「<이름>의 / 집」 둘만 두 줄로 꺾이고, 둘째 줄 이름표가 윗줄 「아직 안 가 본 곳」 에 붙어 보였어요
    const names = ['하늘의 집', '바다별의 집', '솔의 집', '은빛호수숲의 집', '푸른달빛언덕의 집', '노을의 집'];   // 지어낸 이름(글자 수는 사진의 이름과 같게 2 · 3 · 1 · 5 · 6 · 2)
    const ghosts = names.map((label, i) => ({ key: 'bl-unv:h' + i, label, zone: 'below', f: null }));
    const L = m.floorLayout(office(), { ghosts });
    const items = names.map((label, i) => ({ label, o: L.pos.get('bl-unv:h' + i) }));
    const NAME_UP = 2.6, TAG_DOWN = 0.7;   // 글자 3.2 의 윗부분 · 글자 2.5 의 아랫부분(어림)
    const rows = new Map(); for (const it of items) { if (!rows.has(it.o.y)) rows.set(it.o.y, []); rows.get(it.o.y).push(it); }
    const ys = [...rows.keys()].sort((a, b) => a - b);
    assert.ok(ys.length >= 2, '두 줄 넘게(본보기)');
    for (const it of items) assert.equal(m.wrapLabel(it.label, it.o.w - 1.5).length, 1, it.label + ' 은 한 줄');
    for (let r = 1; r < ys.length; r++) {
        const lines = Math.max(...rows.get(ys[r]).map(it => m.wrapLabel(it.label, it.o.w - 1.5).length));
        const nameTop = ys[r] - 4.4 - (lines - 1) * 3.4 - NAME_UP, tagBottom = ys[r - 1] + 5.6 + TAG_DOWN;
        assert.ok(nameTop - tagBottom >= 2, `줄 ${r}: 이름표 위 ${nameTop.toFixed(1)} · 윗줄 글 아래 ${tagBottom.toFixed(1)}`);
    }
    for (const row of rows.values()) { row.sort((a, b) => a.o.x - b.o.x); for (let k = 1; k < row.length; k++) { const a = row[k - 1], b = row[k]; assert.ok(b.o.x - a.o.x >= (m.textW(a.label) + m.textW(b.label)) / 2 + 1, a.label + ' · ' + b.label + ' 안 겹침'); } }
    // 그 확장 배치 위(층별 보기가 아닌 지도)도 같은 규칙
    const spots = m.plainSpots([{ x: 10, y: 10 }, { x: 90, y: 40 }], names.map((label, i) => ({ key: 'p' + i, label, zone: 'below' })));
    for (const s of spots) assert.equal(m.wrapLabel(s.g.label, s.o.w - 1.5).length, 1, s.g.label + ' 은 한 줄(그 확장 배치)');
});
await tryOk('1.7.9 로어북 · 캐릭터 편집을 저장해도 지도가 화면에 없으면 로어북을 다시 읽지 않고, 다음에 지도를 그릴 때 한 번 읽어 그 자리에서 입혀요', async () => {
    const fresh = await import(pathToFileURL(path.join(root, 'src/mb-map-floors.js')).href + '?lazy-dir');
    const places = office(), map = { places };
    let cb = null, renders = 0, wiReads = 0, shop = '달빛 찻집'; const live = [], on = {};
    const doc = {
        body: { getAttribute: k => (k === fresh.FLOOR_ATTR ? 'on' : null), hasAttribute: () => false, classList: { contains: c => c === 'salty' } },
        documentElement: { getAttribute: () => null },
        querySelectorAll: sel => (sel.includes('svg.ss-map') ? live.filter(s => (sel.includes(':not([data-bl-floors])') ? !s.getAttribute('data-bl-floors') : sel.includes('[data-bl-floors]') ? !!s.getAttribute('data-bl-floors') : true)) : []), addEventListener: () => {},
    };
    const ctx = { characterId: 0, getCurrentChatId: () => 'chat-a', chatMetadata: {}, eventTypes: { WORLDINFO_UPDATED: 'wi', CHARACTER_EDITED: 'ce' }, eventSource: { on: (k, fn) => { (on[k] ||= []).push(fn); } },
        characters: [{ data: { extensions: { world: 'book' } } }],
        loadWorldInfo: async () => { wiReads++; return { entries: { 0: { comment: '[장소]' + shop, content: '작은 가게예요.' } } }; } };
    const core = { app: { current: { state: { data: { map } } }, renderPanel() { renders++; } } };
    assert.equal(fresh.startMbFloors(doc, { watch: (_t, o, fn) => { if (o.childList) cb = fn; }, load: () => core, stCtx: () => ctx }), true);
    const tick = (ms = 5) => new Promise(res => setTimeout(res, ms));
    const names = svg => svg.querySelectorAll('g.bl-unv').map(g => g._blGhost.label);
    const draw = () => { const svg = drawn(makeDoc(), places); live.push(svg); cb([{ addedNodes: [svg] }]); return svg; };
    const emit = k => { for (const fn of on[k] || []) fn(); };
    await tick(); draw(); await tick();
    assert.deepEqual(names(draw()), ['달빛 찻집']); assert.equal(wiReads, 1);
    // 지도 창을 닫은 채 로어북을 고쳐 저장(글자를 칠 때마다 저장돼요) — 읽지 않아요
    live.length = 0; shop = '별빛 서점';
    for (let i = 0; i < 6; i++) emit(i % 2 ? 'ce' : 'wi');
    await tick(20);
    assert.equal(wiReads, 1, '지도가 없는데 로어북을 다시 읽었어요: ' + wiReads);
    // 다음에 지도를 그릴 때 한 번 읽고, 옛 장소로 먼저 그리지 않아요
    const b = draw();
    assert.ok(!names(b).includes('달빛 찻집'), '옛 로어북 장소로 먼저 그렸어요 — ' + names(b).join(','));
    await tick(20);
    assert.equal(wiReads, 2, '지도를 그릴 때 한 번');
    assert.deepEqual(names(b), ['별빛 서점'], '읽은 뒤 그 자리에서 입혀요');
    assert.equal(renders, 0, '그 확장에 다시 그리기를 시키지 않아요(한 번에 입힘)');
    draw(); await tick(); assert.equal(wiReads, 2, '그 뒤에는 다시 안 읽어요');
    // 지도가 떠 있을 때 저장하면 예전처럼 바로 읽고, 달라졌으면 다시 그리게 해요
    shop = '은빛 온실'; emit('wi'); await tick(20);
    assert.equal(wiReads, 3, '지도가 떠 있으면 바로 읽어요');
    assert.equal(renders >= 0, true);
});
// ── 1.7.9 부속 자리 묶기(「X 대문」 · 「X Gate」 · 「Xの玄関」 → X 점 하나) ─────────────
await ok('1.7.9 부속 이름 읽기: 한국어 · 영어 · 일본어 꼴만 · 본 이름이 두 글자 넘을 때만', () => {
    const cases = [['토끼의 집 대문', ['토끼의 집']], ['토끼의 집 앞마당', ['토끼의 집']], ['빵집 정문', ['빵집']], ['빵집앞', ['빵집']], ['Mira\'s House Gate', ['Mira\'s House']], ['Bakery Front Entrance', ['Bakery']],
        ['Bakery Entrance', ['Bakery']], ['Front of the Bakery', ['the Bakery']], ['Old Mill Back Door', ['Old Mill']], ['パン屋の玄関', ['パン屋']], ['学校正門', ['学校']],
        ['집 앞', []], ['駅前', []], ['Gate', []], ['Bakery', []], ['정문', []]];
    for (const [s, want] of cases) assert.deepEqual(m.annexBase(s), want, s);
});
const town = () => [
    P('Sky', 'A calm realm.', { kind: 'realm', area: 'Sky', links: ['Mira\'s Home'] }),
    P('Sky Gate', 'Gate of the sky realm.', { kind: 'gate', area: 'Sky', links: ['Sky'] }),   // 넓은 곳(세계 · 구역 이름)의 문은 따로 가는 곳 — 안 묶어요
    P('Mira\'s Home', 'A tidy house.', { kind: 'house', area: 'Sky', links: ['Sky'] }),
    P('Mira\'s House Gate', '', { kind: '', area: '', links: [] }),   // 그 확장 place 줄로 생긴 곳(구역 · 이어진 곳 없음)
    P('Bakery', 'Corner bakery.', { kind: 'shop', area: 'Street', links: ['Bakery Entrance'] }),
    P('Bakery Entrance', '', { kind: '', area: 'Street', links: ['Park'] }),
    P('Park', 'Small park.', { kind: 'nature', area: 'Street', links: [] }),
    P('Park Gate', '', { kind: '', area: 'Harbor', links: [] }),   // 다른 구역 → 안 묶어요
];
await ok('1.7.9 부속 자리 찾기: 원문 · 번역 이름 · 집 꼴 낱말(House ↔ Home) · 넓은 곳 · 다른 구역 · 사슬', () => {
    const A = m.annexMap(town());
    assert.equal(A.get('Mira\'s House Gate'), 'Mira\'s Home');
    assert.equal(A.get('Bakery Entrance'), 'Bakery');
    assert.ok(!A.has('Sky Gate'), '세계 · 구역 이름의 문은 따로');
    assert.ok(!A.has('Park Gate'), '다른 구역은 따로');
    // 번역 이름으로만 같은 곳(원문은 다른 낱말)
    const tr = s => ({ 'Mira\'s Place': '미라의 집', 'Mira Gatehouse Spot': '미라의 집 대문' })[s] || s;
    const B = m.annexMap([P('Mira\'s Place', ''), P('Mira Gatehouse Spot', '')], tr);
    assert.equal(B.get('Mira Gatehouse Spot'), 'Mira\'s Place');
    assert.equal(m.annexMap([P('Mira\'s Place', ''), P('Mira Gatehouse Spot', '')]).size, 0, '번역이 없으면 원문만');
    // 사슬(「X 대문」 의 본 장소가 또 부속)은 안 묶어요
    const C = m.annexMap([P('Tower', ''), P('Tower Gate', ''), P('Tower Gate Front', '')]);
    assert.equal(C.get('Tower Gate'), 'Tower'); assert.ok(!C.has('Tower Gate Front'));
    // 자료는 그대로
    const list = town(), before = JSON.stringify(list); m.annexMap(list); assert.equal(JSON.stringify(list), before);
});
await ok('1.7.9 층별 배치: 부속 자리는 본 장소 점 자리 · 링크는 본 장소로 · 땅 줄에 외딴 점이 안 생겨요', () => {
    const list = [...office(), P('Bakery Entrance', '', { kind: '', area: '', links: ['Park'] }), P('Garage Gate', '', { kind: '', area: '', links: [] })];
    const plain = m.floorLayout(list);
    assert.equal(plain.pos.get('Bakery Entrance').zone, 'out'); assert.ok(!plain.pos.get('Bakery Entrance').twin, '묶기 전에는 따로 점');
    const A = m.annexMap(list), L = m.floorLayout(list, { annex: A });
    assert.equal(A.get('Bakery Entrance'), 'Bakery'); assert.equal(A.get('Garage Gate'), 'Garage');
    for (const [a, b] of A) { assert.deepEqual([L.pos.get(a).x, L.pos.get(a).y], [L.pos.get(b).x, L.pos.get(b).y], a); assert.ok(L.pos.get(a).annex && L.pos.get(a).twin === b); }
    assert.equal(L.pos.get('Garage Gate').zone, 'b', '건물 방(지하) 자리');
    const outs = o => [...o.pos].filter(([, p]) => p.zone === 'out' && !p.twin).length;
    assert.equal(outs(L), outs(plain) - 2, '땅 줄 외딴 점 둘이 없어져요');
    assert.ok(L.pairs.some(([a, b]) => [a, b].includes('Bakery') && [a, b].includes('Park')), '부속 링크는 본 장소로');
    assert.ok(!L.pairs.some(([a, b]) => A.has(a) || A.has(b)));
    assert.equal(L.annex.size, 2);
});
await ok('1.7.9 SVG: 부속 점은 숨기고 본 장소 점 옆 「+1」 · 지금 위치가 부속이면 본 장소 점에 지금 고리 · 끄면 따로 · 층 없는 지도도', () => {
    const list = [...office(), P('Bakery Entrance', '', { kind: '', area: '', links: [] })];
    const doc = makeDoc(), svg = drawn(doc, list);
    const ge = svg.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === 'Bakery Entrance');
    ge.setAttribute('class', 'node here'); ge.insertBefore(new El(doc, 'circle', { cx: 0, cy: 0, r: 4.6, class: 'ring' }), ge.firstChild);
    const L = m.applyFloors(svg, { places: list, here: 'Bakery Entrance' }, { ui: null });
    const gb = svg.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === 'Bakery');
    assert.equal(ge.getAttribute('display'), 'none', '부속 점 숨김'); assert.equal(gb.getAttribute('display'), null, '본 장소 점이 보여요(지금 위치가 부속이어도)');
    assert.match(gb.getAttribute('class'), /\bhere\b/); assert.equal(gb.getAttribute('data-bl-annex-here'), 'Bakery Entrance');
    assert.equal(gb.querySelectorAll('circle.ring').length, 1, '지금 고리'); assert.equal(gb.querySelector('circle.dot').getAttribute('r'), '3.2');
    const badge = gb.querySelector('text.bl-twin'); assert.ok(badge); assert.match(badge.getAttribute('class'), /bl-annex/); assert.equal(badge.getAttribute('data-arg'), 'Bakery Entrance'); assert.equal(badge.textContent, '+1');
    assert.ok(L.pos.get('Bakery Entrance').annex);
    // 스위치 끔(annex: false): 지금과 같은 그림
    const svgA = drawn(makeDoc(), list), svgB = drawn(makeDoc(), list.filter(p => p.name !== 'Bakery Entrance').concat([P('Bakery Entrance', '', { kind: '', area: '', links: [] })]));
    m.applyFloors(svgA, { places: list }, { ui: null, annex: false });
    assert.equal(svgA.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === 'Bakery Entrance').getAttribute('display'), null, '끄면 따로 점');
    assert.equal(svgA.querySelectorAll('text.bl-twin').length, 0); void svgB;
    // 층 없는 지도(그 확장 배치): 부속 점을 숨기고 닿던 선 끝을 본 장소 점으로 · 부속 ↔ 본 장소 선은 지워요
    const flat = [P('Bakery', 'shop', { area: '', links: ['Park', 'Bakery Entrance'] }), P('Park', 'park', { area: '', links: [] }), P('Bakery Entrance', '', { area: '', links: ['Park'] })];
    const d2 = makeDoc(), s2 = drawn(d2, flat), e2 = s2.querySelector('g.edges');
    e2.childNodes = [];
    const at = n => { const d = s2.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === n).querySelector('circle.dot'); return [d.getAttribute('cx'), d.getAttribute('cy')]; };
    const line = (a, b) => { const [x1, y1] = at(a), [x2, y2] = at(b); const l = new El(d2, 'line', { x1, y1, x2, y2, class: '' }); l.remove = () => { e2.childNodes = e2.childNodes.filter(c => c !== l); }; e2.appendChild(l); return l; };
    line('Bakery', 'Park'); const lp = line('Bakery Entrance', 'Park'); line('Bakery', 'Bakery Entrance');
    assert.equal(m.applyFloors(s2, { places: flat }, { ui: null }), null);
    assert.equal(s2.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === 'Bakery Entrance').getAttribute('display'), 'none');
    assert.deepEqual([lp.getAttribute('x1'), lp.getAttribute('y1')], at('Bakery').map(String), '선 끝을 본 장소 점으로');
    assert.equal(e2.querySelectorAll('line').length, 1, '점 하나가 된 선 · 겹친 선은 지워요(빵집 ↔ 공원 하나만)');
    // 노선도 보기(그 확장 「새 지도」)는 그대로
    const s3 = drawn(makeDoc(), flat); s3.setAttribute('class', 'ss-map line'); m.applyFloors(s3, { places: flat }, { ui: null });
    assert.equal(s3.querySelectorAll('g.node').filter(x => x.getAttribute('display') === 'none').length, 0);
});
await ok('1.7.9 「＋」 확대: 그림 몫 가운데를 축으로 · 건물 왼쪽이 칸 밖으로 안 밀려요 · 「－」 로 처음 칸', () => {
    const list = [...office(), ...['North Kiosk', 'South Kiosk', 'East Kiosk', 'West Kiosk'].map(nm => P(nm, 'kiosk', { kind: 'shop', area: 'Street', links: ['Bakery'] }))];
    const doc = makeDoc(), svg = drawn(doc, list); const L = m.applyFloors(svg, { places: list }, { ui: null });
    const fit = svg._blFit, c = svg._blContent; assert.ok(fit && c); assert.deepEqual(svg.getAttribute('viewBox'), fit.join(' '));
    assert.deepEqual(fit, m.fitFloors(L, null));
    const bl = L.buildings[0].left;
    // 그 확장처럼 보기 칸 가운데를 축으로 늘리면(오른쪽 비움 몫 때문에) 건물 왼쪽이 칸 밖으로 나가요
    const theirs = (() => { const w = fit[2] / 1.4, cx = fit[0] + fit[2] / 2; return cx - w / 2; })();
    assert.ok(theirs > bl, '고치기 전 모양: 건물 왼쪽 벽이 칸 밖');
    const z = m.zoomFloors(fit, c, fit, 1 / 1.4);
    assert.ok(z[2] < fit[2] && Math.abs(z[2] / z[3] - fit[2] / fit[3]) < 0.01, '비율 그대로 좁혀요');
    assert.ok(z[0] < theirs - 5, `건물 쪽으로 당겨요 ${z[0]} < ${theirs}`);
    assert.ok(z[0] >= c[0] - 0.05 && z[0] + z[2] <= Math.max(c[2], c[0] + z[2]) + 0.05, '그림 밖 빈 곳을 안 보여요');
    const firstRoom = Math.min(...[...L.pos.values()].filter(o => o.zone === 'b').map(o => o.x));
    assert.ok(firstRoom - 6 >= z[0], '맨 왼쪽 방 점 · 이름이 칸 안');
    // 여러 번 확대해도 칸이 그림 안 · 「－」 를 거듭하면 처음 칸(null)
    let v = z; for (let i = 0; i < 4; i++) { v = m.zoomFloors(v, c, fit, 1 / 1.4); assert.ok(v[0] >= c[0] - 0.05 && v[0] + v[2] <= c[2] + 0.05); }
    for (let i = 0; i < 8 && v; i++) v = m.zoomFloors(v, c, fit, 1.4);
    assert.equal(v, null);
    assert.equal(m.zoomFloors([NaN, 0, 1, 1], c, fit, 1.4), null);
    const src = read('src/mb-map-floors.js');
    assert.match(src, /\[data-act="mapzoom"\]\[data-arg="in"\]/); assert.match(src, /zoomFloors\(vb, svg\._blContent, svg\._blFit/);
});
await ok('1.7.9 스위치 annex: 표 · 화면만 · 기본 켬 · 붙이기가 mbFit 로 봐요', () => {
    // 1.7.9 시작 묶음 나누기: 열쇠 · 갈래는 열쇠 표(src/mb-switch-core.js) · 묶음 · 이름은 글 표(src/mb-switch.js)
    assert.match(read('src/mb-switch-core.js'), /\{ key: 'annex', kind: 'screen' \}/);
    assert.match(read('src/mb-switch.js'), /annex: \{ group: 'add'/);
    const src = read('src/mb-map-floors.js');
    assert.match(src, /mbFit\('annex', doc\)/); assert.match(src, /onMbOff\(doc, \[[^\]]*'annex'/);
});
await ok('1.8.2 층 없이 새로 생긴 「… / <방 이름> 쪽 방」 은 땅 줄이 아니라 그 방의 층에 따로 점', () => {
    const list = [...office(), P('Greenhouse / Archive Team plant room', '', { kind: '', area: '', links: ['Studio'] }), P('Kiosk near Bakery', '', { kind: '', area: '', links: [] }), P('Board Gate', '', { kind: '', area: '', links: [] })];
    const L = m.floorLayout(list);
    const g = L.pos.get('Greenhouse / Archive Team plant room');
    assert.equal(g.zone, 'b'); assert.equal(g.row, L.pos.get('Archive').row, '그 방(3F) 줄'); assert.ok(!g.twin, '같은 곳은 아니라 겹치지 않아요');
    assert.notEqual(g.x, L.pos.get('Archive').x);
    assert.equal(L.pos.get('Kiosk near Bakery').zone, 'out', '건물 밖 가게 이름은 그대로 바깥');
    assert.equal(L.pos.get('Board Gate').zone, 'out', '「X 대문」 꼴은 부속 묶기 몫(끄면 그대로 바깥)');
    // 두 방에 걸리면 안 넣어요
    const L2 = m.floorLayout([...office(), P('Studio and Archive storage', '', { kind: '', area: '' })]);
    assert.equal(L2.pos.get('Studio and Archive storage').zone, 'out');
});
await ok('1.8.2 이름 앞뒤 표시 기호: 「@Bakery」 는 「Bakery」 점 하나로 · 이름표 · 안내 글에서 기호를 떼요(자료는 그대로)', () => {
    assert.equal(m.stripMarks('@Bakery'), 'Bakery'); assert.equal(m.stripMarks(' #빵집 '), '빵집'); assert.equal(m.stripMarks('@'), '@'); assert.equal(m.stripMarks('Park @ noon'), 'Park @ noon');
    assert.equal(m.labelOf('@Bakery'), 'Bakery');
    const list = [...office(), P('@Bakery', '', { kind: '', area: '', links: [] }), P('#Lonely Pier', '', { kind: '', area: '', links: [] })];
    const before = JSON.stringify(list);
    const A = m.annexMap(list); assert.equal(A.get('@Bakery'), 'Bakery'); assert.ok(!A.has('#Lonely Pier'), '기호 없는 짝이 없으면 그대로(이름표만 기호를 떼요)');
    const tr = s => ({ '@Bakery': '@빵집', Bakery: '빵집' })[s] || s; assert.equal(m.annexMap(list, tr).get('@Bakery'), 'Bakery');
    assert.equal(JSON.stringify(list), before);
    const doc = makeDoc(), svg = drawn(doc, list);
    const gb = svg.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === '@Bakery'); gb.setAttribute('class', 'node here');
    m.applyFloors(svg, { places: list, here: '@Bakery' }, { ui: null });
    const vis = svg.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === 'Bakery');
    assert.equal(gb.getAttribute('display'), 'none'); assert.ok(/(^| )here( |$)/.test(vis.getAttribute('class')), '지금 고리는 기호 없는 점에');
    const svg2 = drawn(makeDoc(), list); const p2 = svg2.querySelectorAll('g.node').find(x => x.getAttribute('data-arg') === '#Lonely Pier'); p2.querySelectorAll('text')[1].text = '#Lonely Pier';
    m.applyFloors(svg2, { places: list }, { ui: null }); assert.equal(p2.querySelectorAll('text')[1].childNodes.map(c => c.text).join(' '), 'Lonely Pier', '이름표에서 기호를 떼요');
    // 안내 글(「지금 @빵집」)
    const tn = { nodeType: 3, nodeValue: '@빵집' }, b = { nodeType: 1, childNodes: [tn] };
    assert.equal(m.markText(b), true); assert.equal(tn.nodeValue, '빵집'); assert.equal(m.markText(b), false);
});
// 1.8.2 위치 칩 · 펼친 위치 줄의 앞 표시 기호(지어낸 장소 이름)
const N = (tag, kids = [], cls = '') => { const e = { nodeType: 1, tagName: tag, cls, childNodes: kids, nextSibling: null }; kids.forEach((k, i) => { k.nextSibling = kids[i + 1] || null; }); return e; };
const X = v => ({ nodeType: 3, nodeValue: v, nextSibling: null });
const icon = () => N('i', [], 'fa-solid fa-location-dot');
await ok('1.8.2 위치 칩 · 위치 줄: 📍 뒤 글의 앞 「@ · #」 만 떼요(사람 아이디 · 다른 글은 그대로)', () => {
    const a = X(' @로비'), b = X('#Bakery Corner'), c = X('@'), d = X('Park @ noon');
    const chip = N('div', [icon(), N('span', [a])]), row = N('div', [icon(), N('span', [N('b', [b])])]), lone = N('div', [icon(), N('span', [c])]), mid = N('div', [icon(), N('span', [d])]);
    const all = [chip, row, lone, mid].flatMap(r => r.childNodes.filter(k => k.cls.includes('fa-location-dot')));
    const host = { querySelectorAll: sel => (sel === '.fa-location-dot' ? all : []) };
    assert.equal(m.markLocMarks(host), 2);
    assert.equal(a.nodeValue, ' 로비'); assert.equal(b.nodeValue, 'Bakery Corner'); assert.equal(c.nodeValue, '@', '기호뿐이면 그대로'); assert.equal(d.nodeValue, 'Park @ noon', '가운데 기호는 그대로');
    assert.equal(m.markLocMarks(host), 0, '두 번 해도 같아요');
    const src = read('src/mb-map-floors.js'); assert.ok(src.includes("if (pin) markPlaces(n, opt)") && src.includes('n += markLocMarks(root);'), '띠가 다시 그려질 때 · 스위치 annex(버그 사냥 6 부터 markPlaces 가 이 일을 같이 해요)'); assert.ok(!read('src/ext-compat.js').includes('markLocMarks'), '맞춤 모듈(ext-compat)은 글자 노드를 안 고쳐요');
});
if (bad) { console.log(`mb-map-floors: ${n}개 통과 · ${bad}개 실패`); process.exit(1); }
console.log(`mb-map-floors: ${n}개 통과`);
