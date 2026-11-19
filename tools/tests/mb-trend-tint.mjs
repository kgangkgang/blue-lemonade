// 1.9.0 미트볼 변화 그래프 인물 색(src/mb-trend.js tintTrend) — 원작이 스스로 그리는 그래프(2.9.1 부터)에 테마가 아는 인물 색만 갈아입혀요.
//   그 확장이 그리는 꼴(선 묶음 g[data-k] · 범례 span[data-k] > i · 사람 색은 hsl · 가까운 색은 점선 + 범례 점 줄무늬)을 본뜬 가짜 창 위에서 jsdom 으로 돌려 봐요. 이름 · 색은 지어낸 것이에요.
//   ① 인물 색이 있는 사람의 선 · 범례 점 = 그 색 · 두 판에서 같은 색 ② 없는 사람은 원작 색 그대로 ③ 점선을 새 색으로 다시 가림(줄어들기도 · 생기기도)
//   ④ 어두운 바탕에서 안 보이는 색은 밝기 보정(3 : 1) ⑤ 아는 사람이 없으면 손대지 않음 ⑥ 사람 판이 아닌 판(수치)은 그대로 ⑦ 꼴(선 좌표 · 범례 글 · 누르기 표식)은 그대로
//   ⑧ 켜고 끄기: 원작에 맡긴 때 + 스위치 켬일 때만 · 「원작 그대로 보기」면 그대로 ⑨ 스위치 표
//   node tools/tests/mb-trend-tint.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   jsdom 이 없으면 종료 2(통과 아님)
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log(`  통과  ${name}`); } catch (error) { fail++; console.log(`  실패  ${name}\n${error?.stack || error}`); } }
const load = f => import(pathToFileURL(path.join(root, f)).href);
const m = await load('src/mb-trend.js'), compat = await load('src/ext-compat.js'), core = await load('src/mb-switch-core.js'), sw = await load('src/mb-switch.js');

// 지어낸 사람들과 원작이 줄 색상환 각도(이름 해시 대신 시험이 정해요)
const HUE = { Orla: 140, Bram: 150, Pip: 80, Nell: 88, Quin: 230, Vale: 300 };
const up = n => `hsl(${HUE[n]} 62% 48%)`;
const near = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 360 - d) < 22; };
/** 그 확장 2.9.1 부터의 사람 판 꼴(시험이 지은 글) — 순위 차례 · 앞 순위 실선과 각도가 가까우면 점선 */
function peopleBox(title, names) {
    const dash = []; names.forEach((n, i) => dash.push(names.slice(0, i).some((y, j) => !dash[j] && near(HUE[n], HUE[y]))));
    const lines = names.map((n, i) => `<g data-k="${n}"><polyline points="46,${40 + i * 20} 300,${30 + i * 20} 628,${30 + i * 20}" fill="none" stroke="${up(n)}" stroke-width="2"${dash[i] ? ' stroke-dasharray="6 4"' : ''}/></g>`).join('');
    const legend = names.map((n, i) => `<span data-k="${n}" role="button" tabindex="0"><i style="background:${up(n)}${dash[i] ? ';background-image:repeating-linear-gradient(90deg,transparent 0 3px,#fff 3px 5px)' : ''}"></i>${n} <small>${9 - i}</small></span>`).join('');
    return `<div class="ss-trend-box"><b>${title}</b><svg viewBox="0 0 640 220"><line x1="46" x2="628" y1="12" y2="12"/><text x="40" y="16">9</text>${lines}</svg><div class="ss-trend-legend">${legend}</div></div>`;
}
const barsBox = `<div class="ss-trend-box"><b>수치</b><svg viewBox="0 0 640 220"><g data-k="Orla"><polyline points="46,50 628,60" fill="none" stroke="#e2557b" stroke-width="2"/></g></svg><div class="ss-trend-legend"><span data-k="Orla" role="button"><i style="background:#e2557b"></i>Orla <small>70</small></span></div></div>`;
const AFF = ['Orla', 'Bram', 'Pip', 'Nell', 'Quin'], TRU = ['Bram', 'Quin', 'Orla', 'Vale'];
function page({ raw = false, off = 'trend' } = {}) {
    const dom = new JSDOM(`<!doctype html><html${off ? ` data-bl-mb-off="${off}"` : ''}><body class="salty"${raw ? ' data-bl-ext-raw' : ''}><dialog open class="ss-dlg ss-scope"><div class="ss-root ss-scope ss-trend"><h3>변화 그래프</h3>${peopleBox('애정', AFF)}${peopleBox('우정', TRU)}${barsBox}</div></dialog></body></html>`, { url: 'http://localhost/' });
    return dom.window.document;
}
const NIGHT = '#2c2e32', DAY = '#fcfdff';
// 인물 색: Orla 빨강 · Bram 은 Orla 와 거의 같은 빨강 · Quin 아주 어두운 남색(밤 바탕에서 안 보임) · Pip · Nell · Vale 은 정해 둔 색 없음
const RAW = { Orla: '#e63946', Bram: '#ea3f4a', Quin: '#14143a' };
const pick = n => (RAW[n] ? compat.faceColors(RAW[n]) : null);
const noWatch = () => () => {};
const lineEl = (box, n) => box.querySelector(`svg g[data-k="${n}"] polyline`);
const dotEl = (box, n) => box.querySelector(`.ss-trend-legend > span[data-k="${n}"] > i`);
const hexOf = (doc, css) => m.rgbHex(css) || m.hslHex(css)?.hex;
const stripe = el => /repeating-linear-gradient/.test(el.getAttribute('style') || '');

await test('① 인물 색이 있는 사람: 선 · 범례 점 = 그 색 · 두 판에서 같은 색', () => {
    const doc = page(), tr = doc.querySelector('.ss-trend');
    assert.equal(m.tintTrend(tr, { pick, bg: DAY, watch: noWatch }), true);
    const [a, t] = tr.querySelectorAll('.ss-trend-box');
    for (const n of ['Orla', 'Bram', 'Quin']) {
        const want = m.lineColor(compat.faceColors(RAW[n]).bg, DAY);
        assert.equal(lineEl(a, n).getAttribute('stroke'), want, `${n} 선`);
        assert.equal(hexOf(doc, dotEl(a, n).style.backgroundColor), want, `${n} 범례 점`);
        assert.equal(lineEl(t, n).getAttribute('stroke'), want, `${n} 둘째 판 선`);
        assert.ok(a.querySelector(`.ss-trend-legend > span[data-k="${n}"]`).hasAttribute('data-bl-own'));
    }
});

await test('② 인물 색이 없는 사람은 원작 색 그대로', () => {
    const doc = page(), tr = doc.querySelector('.ss-trend');
    m.tintTrend(tr, { pick, bg: DAY, watch: noWatch });
    const [a, t] = tr.querySelectorAll('.ss-trend-box'), fresh = page().querySelectorAll('.ss-trend-box');
    for (const [box, n] of [[a, 'Pip'], [a, 'Nell'], [t, 'Vale']]) {
        assert.equal(lineEl(box, n).getAttribute('stroke'), up(n), `${n} 선`);
        assert.equal(dotEl(box, n).style.backgroundColor, fresh[box === a ? 0 : 1].querySelector(`.ss-trend-legend > span[data-k="${n}"] > i`).style.backgroundColor, `${n} 범례 점`);
        assert.ok(!box.querySelector(`.ss-trend-legend > span[data-k="${n}"]`).hasAttribute('data-bl-own'));
    }
});

await test('③ 점선을 새 색으로 다시 가려요', () => {
    const before = page(), b0 = before.querySelector('.ss-trend-box');
    // 고치기 전(원작): Bram 은 Orla 와 각도가 가까워 점선 · Nell 은 Pip 과 가까워 점선
    assert.ok(lineEl(b0, 'Bram').hasAttribute('stroke-dasharray') && stripe(dotEl(b0, 'Bram')));
    assert.ok(lineEl(b0, 'Nell').hasAttribute('stroke-dasharray'));
    // 색이 서로 달라지면 점선이 없어져요
    const d1 = page(), t1 = d1.querySelector('.ss-trend');
    m.tintTrend(t1, { pick: n => (n === 'Bram' ? compat.faceColors('#3366dd') : pick(n)), bg: DAY, watch: noWatch });
    const a1 = t1.querySelector('.ss-trend-box');
    assert.ok(!lineEl(a1, 'Bram').hasAttribute('stroke-dasharray'), '색이 달라진 사람은 실선');
    assert.ok(!dotEl(a1, 'Bram').hasAttribute('data-bl-dash') && !stripe(dotEl(a1, 'Bram')), '범례 점도 꽉 찬 동그라미');
    // 인물 색끼리 가까우면 아래 순위가 점선(원작 무늬 그대로) · 범례 점은 표식으로(시트가 점선 고리로)
    const d2 = page(), t2 = d2.querySelector('.ss-trend');
    m.tintTrend(t2, { pick, bg: DAY, watch: noWatch });
    const a2 = t2.querySelector('.ss-trend-box');
    assert.ok(!lineEl(a2, 'Orla').hasAttribute('stroke-dasharray'));
    assert.equal(lineEl(a2, 'Bram').getAttribute('stroke-dasharray'), '6 4');
    assert.ok(dotEl(a2, 'Bram').hasAttribute('data-bl-dash') && !stripe(dotEl(a2, 'Bram')), '줄무늬 대신 표식');
    // 둘 다 원작 색인 짝은 원작 판정 그대로
    assert.ok(!lineEl(a2, 'Pip').hasAttribute('stroke-dasharray'));
    assert.equal(lineEl(a2, 'Nell').getAttribute('stroke-dasharray'), '6 4');
    assert.ok(dotEl(a2, 'Nell').hasAttribute('data-bl-dash'));
    assert.deepEqual(m.tintDashes([{ own: null, hue: 10, line: '#c6522f' }, { own: null, hue: 40, line: '#c6952f' }]), [false, false], '원작 색끼리는 각도 22도 규칙');
});

await test('④ 어두운 바탕에서 안 보이는 색은 밝기만 보정(3 : 1) · 낮에는 그대로', () => {
    const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const face = compat.faceColors(RAW.Quin).bg;
    const dn = page(), tn = dn.querySelector('.ss-trend');
    m.tintTrend(tn, { pick, bg: NIGHT, watch: noWatch });
    const night = lineEl(tn.querySelector('.ss-trend-box'), 'Quin').getAttribute('stroke');
    assert.ok(compat.contrastOf(rgb(face), rgb(NIGHT)) < 3, '시험 색은 밤 바탕에서 3 : 1 이 안 돼요');
    assert.ok(compat.contrastOf(rgb(night), rgb(NIGHT)) >= 3, `보정한 선 ${night}`);
    assert.notEqual(night, face);
    const dd = page(), td = dd.querySelector('.ss-trend');
    m.tintTrend(td, { pick, bg: DAY, watch: noWatch });
    assert.equal(lineEl(td.querySelector('.ss-trend-box'), 'Quin').getAttribute('stroke'), face, '낮 바탕에서는 인물 색 그대로');
});

await test('⑤ 인물 색을 아는 사람이 없으면 손대지 않아요', () => {
    const doc = page(), tr = doc.querySelector('.ss-trend'), was = tr.outerHTML;
    assert.equal(m.tintTrend(tr, { pick: () => null, bg: DAY, watch: noWatch }), false);
    assert.equal(tr.outerHTML, was);
});

await test('⑥ 사람 판이 아닌 판(수치)은 그대로 · ⑦ 꼴은 그대로', () => {
    const doc = page(), tr = doc.querySelector('.ss-trend');
    const bars = tr.querySelectorAll('.ss-trend-box')[2], wasBars = bars.outerHTML;
    const a = tr.querySelector('.ss-trend-box');
    const shape = () => ({ pts: [...a.querySelectorAll('polyline')].map(p => p.getAttribute('points')), text: a.querySelector('.ss-trend-legend').textContent, keys: [...a.querySelectorAll('[data-k]')].map(e => e.getAttribute('data-k')), n: a.querySelectorAll('*').length });
    const was = shape();
    m.tintTrend(tr, { pick, bg: DAY, watch: noWatch });
    assert.equal(bars.outerHTML, wasBars, '수치 판');
    assert.deepEqual(shape(), was, '선 좌표 · 범례 글 · 이름 표식 · 요소 수');
    assert.equal(m.tintTrend(tr, { pick, bg: DAY, watch: noWatch }), false, '한 번만');
});

await test('⑦ 밤낮이 바뀌면 다시 맞추고 · 창이 닫히면 구독을 끊어요', () => {
    const doc = page(), tr = doc.querySelector('.ss-trend');
    let cb = null, stopped = 0;
    const opts = { pick, bg: DAY, watch: (_el, _o, fn) => { cb = fn; return () => { stopped++; }; } };
    m.tintTrend(tr, opts);
    const a = tr.querySelector('.ss-trend-box'), day = lineEl(a, 'Quin').getAttribute('stroke');
    opts.bg = NIGHT; cb();
    assert.notEqual(lineEl(a, 'Quin').getAttribute('stroke'), day, '밤 바탕으로 다시');
    opts.bg = DAY; cb();
    assert.equal(lineEl(a, 'Quin').getAttribute('stroke'), day);
    tr.closest('dialog').remove(); m.sweepGone();
    assert.equal(stopped, 1);
});

await test('⑧ 켜고 끄기: 원작에 맡긴 때 + 스위치 켬일 때만', () => {
    const doc = page({ off: 'trend' });
    let cb = null;
    assert.equal(m.startMbTrend(doc, { watch: (_el, _o, fn) => { cb = fn; return () => {}; }, pick }), true);
    const fresh = () => { const d = doc.querySelector('dialog'); const html = d.outerHTML; d.remove(); doc.body.insertAdjacentHTML('beforeend', page().querySelector('dialog').outerHTML); const tr = doc.querySelector('.ss-trend'); return { tr, rec: [{ addedNodes: [doc.querySelector('dialog')] }], html }; };
    let x = fresh(); cb(x.rec);
    assert.ok(x.tr.hasAttribute('data-bl-tc'), '맡긴 때 · 스위치 켬 → 입혀요');
    doc.documentElement.setAttribute('data-bl-mb-off', 'trend tcolor');
    x = fresh(); cb(x.rec);
    assert.ok(!x.tr.hasAttribute('data-bl-tc') && !x.tr.hasAttribute('data-bl-tr'), '스위치 끔 → 원작 색');
    doc.documentElement.setAttribute('data-bl-mb-off', 'trend');
    doc.body.setAttribute('data-bl-ext-raw', '');
    x = fresh(); cb(x.rec);
    assert.ok(!x.tr.hasAttribute('data-bl-tc'), '「원작 그대로 보기」 → 그대로');
    doc.body.removeAttribute('data-bl-ext-raw'); doc.body.classList.remove('salty');
    x = fresh(); cb(x.rec);
    assert.ok(!x.tr.hasAttribute('data-bl-tc'), '테마 끔 → 그대로');
});

await test('⑨ 스위치 표: 화면만 · 기본 켬 · 설명 22자 안', () => {
    const k = core.MB_CORE.findIndex(s => s.key === 'tcolor');
    assert.ok(k > 0 && core.MB_CORE[k - 1].key === 'trend' && core.MB_CORE[k].kind === 'screen' && !core.MB_CORE[k].setting);
    assert.equal(core.switchOn({ chat: {} }, 'tcolor'), true);
    assert.equal(core.switchOn({ chat: { mbOff: ['tcolor'] } }, 'tcolor'), false);
    const t = sw.MB_SWITCHES.find(s => s.key === 'tcolor');
    assert.ok(t?.name && t.desc && [...t.desc].length <= 22 && t.more && t.words, '이름 · 설명 · 찾기 낱말');
});

console.log(`mb-trend-tint: ${pass}개 통과${fail ? ` · ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
