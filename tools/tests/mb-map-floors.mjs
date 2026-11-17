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
    // 하늘 · 땅 밑 장소는 승강기 줄 위 · 아래(건물 가로 안)
    const b0 = L.buildings[0];
    for (const k of ['Heaven', 'Underworld']) assert.ok(at(k).x > b0.shaftL && at(k).x < b0.right, k);
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
    const L = m.floorLayout(office()); const lanes = { left: 0, out: 0 };
    for (const [a, b] of L.pairs) { const pts = m.routeOf(L, a, b, null, lanes); assert.ok(pts && pts.length >= 2, a + b); assert.ok(straight(pts), `${a}-${b} ${JSON.stringify(pts)}`); }
    // 이웃 층(3F → 2F)은 띠 경계(계단), 먼 층(3F → 1F)은 승강기 줄
    const stair = m.routeOf(L, 'Studio', 'Board Room');
    assert.ok(stair.some(([, y]) => y === L.rowTop.get(2)));
    const far = m.routeOf(L, 'Board Room', 'Reception');
    assert.ok(far.some(([x]) => x >= L.buildings[0].shaftL && x <= L.buildings[0].right), JSON.stringify(far));
    // 위 · 아래 장소는 승강기 줄로 곧게 — 건물 벽(왼쪽 · 오른쪽)을 가로지르지 않아요
    const b0 = L.buildings[0];
    const sky = m.routeOf(L, 'Heaven', 'Reception');
    assert.equal(sky[0][0], sky[1][0]); assert.ok(sky.every(([x]) => x >= b0.roomL && x <= b0.right), JSON.stringify(sky));
    assert.ok(sky.some(([x, y]) => x > b0.shaftL && y > b0.top && y < b0.bottom), '승강기 줄을 타요');
    const deep = m.routeOf(L, 'Underworld', 'Reception');
    assert.ok(deep.every(([x]) => x >= b0.roomL && x <= b0.right), JSON.stringify(deep));
    const last = deep.at(-1), prev = deep.at(-2); assert.ok(last[0] === prev[0] && prev[1] < b0.bottom && last[1] > b0.bottom, '바닥 아래로 곧게');
    assert.equal(m.pathD([[0, 1], [0, 5], [3, 5]]), 'M0 1 L0 5 L3 5');
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
    const paths = edges.querySelectorAll('path.bl-route'); assert.equal(paths.length, L.pairs.length);
    for (const p of paths) { const pts = [...p.getAttribute('d').matchAll(/[ML]([-\d.]+) ([-\d.]+)/g)].map(x => [Number(x[1]), Number(x[2])]); assert.ok(straight(pts), p.getAttribute('d')); }
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
    assert.equal(svg.querySelectorAll('path.bl-route').length, 5);
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
console.log(`mb-map-floors: ${n}개 통과`);
