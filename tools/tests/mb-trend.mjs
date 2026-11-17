// 1.6.9 미트볼 변화 그래프(src/mb-trend.js · 그림 src/ext-status.css) — 그 확장 2.8.0 이 그리는 꼴을 본뜬 가짜 창 위에서 jsdom 으로 돌려 봐요.
//   ① 선 · 범례 동그라미 = 프로필 얼굴 색(관계 카드와 같은 faceColorOf) · 두 판에서 같은 사람 같은 색 ② 정해 둔 색이 없으면 남는 팔레트 색
//   ③ 선은 판 바탕과 3 : 1 위(밤 · 낮) ④ 비슷한 색은 아래 순위가 점선 ⑤ 범례 누르기 = 한 사람 강조 · 다시 누르면 전체 ⑥ 「원작 그대로 보기」면 그대로 ⑦ 연결 자리
//   node tools/tests/mb-trend.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   jsdom 이 없으면 종료 2(통과 아님)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log(`  통과  ${name}`); } catch (error) { fail++; console.log(`  실패  ${name}\n${error?.stack || error}`); } }

let m = null, compat = null;
try { m = await import(pathToFileURL(path.join(root, 'src/mb-trend.js')).href); } catch (e) { console.log(`  src/mb-trend.js 를 못 불러요: ${e.message}`); }
try { compat = await import(pathToFileURL(path.join(root, 'src/ext-compat.js')).href); } catch { compat = null; }

// 그 확장 2.8.0 src/trend.js chart() 와 같은 꼴(팔레트 차례 · line → text 눈금 · polyline · 범례 span>i+글+small)
const PAL = ['#e2557b', '#2f62e9', '#17855a', '#d98a1f', '#8a56d6', '#1aa3b8', '#b0553a', '#6b7280'];
function chartHtml(title, xs, series) {
    const W = 640, H = 220, L = 46, R = 12, T = 12, B = 24;
    const vals = series.flatMap(s => s.data); let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const X = i => L + ((xs[i] - xs[0]) / (xs.at(-1) - xs[0])) * (W - L - R), Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const grid = [0, 0.25, 0.5, 0.75, 1].map(p => { const v = lo + (hi - lo) * p, y = Y(v); return `<line x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity=".12"/><text x="${L - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="currentColor" fill-opacity=".65">${Math.round(v)}</text>`; }).join('');
    const ser = series.map((s, k) => ({ ...s, color: PAL[k % PAL.length] }));
    const lines = ser.map(s => `<polyline points="${s.data.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
    const legend = `<div class="ss-trend-legend">${ser.map(s => `<span><i style="background:${s.color}"></i>${s.name} <small>${s.data.at(-1)}</small></span>`).join('')}</div>`;
    return `<div class="ss-trend-box"><b>${title}</b>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title} 그래프" preserveAspectRatio="xMidYMid meet">${grid}${lines}
        <text x="${L}" y="${H - 6}" font-size="11" fill="currentColor" fill-opacity=".65">#${xs[0]}</text><text x="${W - R}" y="${H - 6}" text-anchor="end" font-size="11" fill="currentColor" fill-opacity=".65">#${xs.at(-1)} (지금)</text></svg>${legend}</div>`;
}
const xs = [3, 3, 5, 8, 9];
// 지어낸 사람들: 애정 · 우정 판에서 순위가 달라요(그 확장은 순위 차례로 팔레트를 돌려 같은 사람이 다른 색)
const AFF = [{ name: 'Orla', data: [10, 12, 18, 30, 33] }, { name: 'Bram', data: [20, 21, 25, 28, 29] }, { name: 'Pip', data: [5, 6, 9, 12, 15] }, { name: 'Nell', data: [8, 8, 9, 10, 11] }];
const TRU = [{ name: 'Bram', data: [30, 31, 33, 36, 40] }, { name: 'Nell', data: [12, 14, 20, 24, 25] }, { name: 'Orla', data: [9, 10, 12, 15, 17] }, { name: 'Pip', data: [4, 4, 6, 7, 8] }];
// 프로필 색(TTS 색 표 등에서 온 색): Orla 빨강 · Bram 청록 · Nell 은 Orla 와 거의 같은 빨강 · Pip 은 정해 둔 색 없음(첫 글자)
const RAW = { Orla: '#e63946', Bram: '#3ccfbf', Nell: '#ea3f4a' };
const pick = n => (RAW[n] && compat ? compat.faceColors(RAW[n]) : null);
const NIGHT = '#2c2e32', DAY = '#fcfdff';
function page({ raw = false, aff = AFF } = {}) {
    const dom = new JSDOM(`<!doctype html><html><body class="salty"${raw ? ' data-bl-ext-raw' : ''}><dialog open class="popup large_dialogue_popup ss-dlg ss-scope"><div class="popup-content"><div class="ss-root ss-scope ss-trend"><h3>📈 변화 그래프</h3><p class="ss-hint">안내</p>${chartHtml('💗 애정', xs, aff)}${chartHtml('🤝 우정', xs, TRU)}<p class="ss-hint">오래된 기록</p></div></div></dialog></body></html>`, { url: 'http://localhost/' });
    return dom.window.document;
}
const lineOf = (box, k) => box.querySelector(`.bl-tr-s[data-bl-k="${k}"] .bl-tr-line`)?.getAttribute('stroke');
const keys = box => [...box.querySelectorAll('.bl-tr-key')].map(b => ({ name: [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim(), dot: b.querySelector('.bl-tr-dot').style.getPropertyValue('--c'), line: b.getAttribute('data-bl-line'), dash: b.getAttribute('data-bl-dash') || '' }));

await test('모듈이 있어요(src/mb-trend.js)', () => { assert.ok(m, 'src/mb-trend.js 가 없어요'); assert.equal(typeof m.dressTrend, 'function'); assert.equal(typeof compat?.faceColorOf, 'function', 'ext-compat 의 faceColorOf'); });

await test('선 · 범례 동그라미 = 프로필 얼굴 색 · 두 판에서 같은 사람은 같은 색', () => {
    const doc = page(); const tr = doc.querySelector('.ss-trend');
    assert.equal(m.dressTrend(tr, { pick, bg: NIGHT, width: 340 }), true);
    const [a, t] = [...tr.querySelectorAll('.ss-trend-box')];
    const ka = keys(a), kt = keys(t);
    const by = (ks, n) => ks.find(k => k.name === n);
    for (const n of ['Orla', 'Bram', 'Nell']) {
        assert.equal(by(ka, n).dot, compat.faceColors(RAW[n]).bg, `${n} 동그라미 = 프로필 얼굴 색`);
        assert.equal(by(ka, n).dot, by(kt, n).dot, `${n} 두 판 같은 동그라미`);
        assert.equal(by(ka, n).line, by(kt, n).line, `${n} 두 판 같은 선 색`);
    }
    // 그림 안 선 색 = 범례가 말한 선 색 · 그 확장의 팔레트 선은 남지 않아요
    ka.forEach((k, i) => assert.equal(lineOf(a, i), k.line, `애정 ${k.name} 선`));
    kt.forEach((k, i) => assert.equal(lineOf(t, i), k.line, `우정 ${k.name} 선`));
    assert.equal(tr.querySelectorAll('polyline').length, 0, '그 확장의 polyline 은 바꿔 그렸어요');
    assert.ok(tr.closest('dialog').classList.contains('bl-mb-trend'), '창 표식(높이 맞춤)');
});

await test('정해 둔 색이 없는 사람 = 이 창에서 아무도 안 쓰는 팔레트 색(두 판 같음)', () => {
    const doc = page(); const tr = doc.querySelector('.ss-trend'); m.dressTrend(tr, { pick, bg: NIGHT, width: 340 });
    const [a, t] = [...tr.querySelectorAll('.ss-trend-box')];
    const pa = keys(a).find(k => k.name === 'Pip'), pt = keys(t).find(k => k.name === 'Pip');
    assert.equal(pa.dot, pt.dot);
    assert.ok(m.PALETTE.includes(pa.dot), '팔레트 색');
    for (const n of ['Orla', 'Bram', 'Nell']) assert.ok(m.colorGap(pa.dot, compat.faceColors(RAW[n]).bg) >= m.NEAR, `${n} 와 안 비슷해요`);
});

await test('선은 판 바탕과 3 : 1 위(밤 · 낮) · 고친 것은 같은 색 계열', () => {
    for (const bg of [NIGHT, DAY]) {
        const doc = page(); const tr = doc.querySelector('.ss-trend'); m.dressTrend(tr, { pick, bg, width: 340 });
        for (const k of keys(tr.querySelector('.ss-trend-box'))) assert.ok(compat.contrastOf(...[k.line, bg].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)))) >= 3, `${k.name} ${k.line} 대 ${bg}`);
    }
    // 낮 바탕의 옅은 노랑은 어둡게 밀어도 노랑 계열(색상각 차이 작음)
    const fixed = m.lineColor('#f0d878', DAY); const [, a1, b1] = m.oklab('#f0d878'), [, a2, b2] = m.oklab(fixed);
    assert.ok(Math.abs(Math.atan2(b1, a1) - Math.atan2(b2, a2)) < 0.25, `색상 그대로 ${fixed}`);
});

await test('색이 서로 너무 비슷하면 아래 순위가 점선(범례에도 점선 견본)', () => {
    const doc = page(); const tr = doc.querySelector('.ss-trend'); m.dressTrend(tr, { pick, bg: NIGHT, width: 340 });
    const ka = keys(tr.querySelector('.ss-trend-box'));
    assert.equal(ka.find(k => k.name === 'Orla').dash, '', '위 순위는 실선');
    assert.notEqual(ka.find(k => k.name === 'Nell').dash, '', 'Nell(Orla 와 거의 같은 빨강)은 점선');
    assert.equal(ka.find(k => k.name === 'Bram').dash, '');
    const nell = [...tr.querySelector('.ss-trend-box').querySelectorAll('.bl-tr-key')].find(b => b.textContent.includes('Nell'));
    assert.ok(nell.querySelector('.bl-tr-dash'), '범례 점선 견본');
});

await test('범례 누르기 = 그 사람만 진하게 · 다시 누르면 전체', () => {
    const doc = page(); const tr = doc.querySelector('.ss-trend'); m.dressTrend(tr, { pick, bg: NIGHT, width: 340 });
    const box = tr.querySelector('.ss-trend-box'); const b = box.querySelectorAll('.bl-tr-key')[2];
    b.dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true }));
    assert.equal(b.getAttribute('aria-pressed'), 'true'); assert.equal(box.getAttribute('data-bl-focus'), '2');
    const gs = [...box.querySelectorAll('.bl-tr-s')];
    assert.equal(gs.filter(g => g.classList.contains('dim')).length, gs.length - 1);
    assert.ok(box.querySelector('.bl-tr-s[data-bl-k="2"]').classList.contains('on'));
    assert.ok(box.querySelector('.bl-tr-s[data-bl-k="2"] .bl-tr-fill'), '고른 사람 아래 옅은 채움');
    box.querySelectorAll('.bl-tr-key')[2].dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true }));
    assert.equal(box.querySelectorAll('.bl-tr-key')[2].getAttribute('aria-pressed'), 'false'); assert.equal(box.hasAttribute('data-bl-focus'), false);
    assert.equal(box.querySelectorAll('.bl-tr-s.dim').length, 0);
});

await test('한 사람 강조는 두 판 같이 · 다시 누르면 둘 다 전체 · 그 사람이 없는 판은 전체 그대로', () => {
    const doc = page({ aff: [...AFF, { name: 'Wren', data: [1, 2, 3, 4, 5] }] }); const tr = doc.querySelector('.ss-trend'); m.dressTrend(tr, { pick, bg: NIGHT, width: 340 });
    const [a, t] = [...tr.querySelectorAll('.ss-trend-box')];
    const click = (box, name) => [...box.querySelectorAll('.bl-tr-key')].find(b => b.textContent.includes(name)).dispatchEvent(new doc.defaultView.MouseEvent('click', { bubbles: true }));
    const pressed = box => [...box.querySelectorAll('.bl-tr-key[aria-pressed="true"]')].map(b => b.textContent.replace(/\d+/g, '').trim());
    click(a, 'Bram');
    assert.deepEqual(pressed(a), ['Bram']); assert.deepEqual(pressed(t), ['Bram'], '우정 판 알약도 눌린 꼴');
    const kt = [...t.querySelectorAll('.bl-tr-key')].findIndex(b => b.textContent.includes('Bram'));
    assert.equal(t.getAttribute('data-bl-focus'), String(kt)); assert.ok(t.querySelector(`.bl-tr-s[data-bl-k="${kt}"]`).classList.contains('on'));
    assert.equal(t.querySelectorAll('.bl-tr-s.dim').length, 3);
    click(t, 'Bram');   // 우정 판에서 다시 누르면 둘 다 전체
    assert.deepEqual(pressed(a), []); assert.deepEqual(pressed(t), []);
    assert.equal(a.querySelectorAll('.bl-tr-s.dim').length + t.querySelectorAll('.bl-tr-s.dim').length, 0);
    click(a, 'Wren');   // 우정 판에 없는 사람
    assert.deepEqual(pressed(a), ['Wren']); assert.equal(t.hasAttribute('data-bl-focus'), false); assert.equal(t.querySelectorAll('.bl-tr-s.dim').length, 0, '우정 판은 전체 그대로');
});

await test('그림: 둥근 모서리 · 위 셋 굵게 · 맨 위 채움 · 끝점 · 눈금 글자는 화면 픽셀', () => {
    const doc = page(); const tr = doc.querySelector('.ss-trend'); m.dressTrend(tr, { pick, bg: NIGHT, width: 340 });
    const svg = tr.querySelector('.ss-trend-box .bl-tr-svg');
    assert.equal(svg.getAttribute('viewBox').split(' ')[2], '340', '판 폭 = 화면 폭');
    assert.ok(/Q/.test(svg.querySelector('.bl-tr-line').getAttribute('d')), '꺾이는 곳은 살짝 둥글게');
    assert.equal(svg.querySelectorAll('.bl-tr-s.top').length, 3);
    assert.equal(svg.querySelectorAll('.bl-tr-fill').length, 1, '맨 위 한 사람만 채움');
    assert.equal(svg.querySelectorAll('.bl-tr-end').length, 4, '사람마다 끝점');
    assert.ok(svg.querySelectorAll('.bl-tr-val').length >= 1);
    // 맨 앞 세로 토막(같은 x 두 점)은 첫 답 값에서 시작
    const r = m.roundPath([[0, 10], [0, 5], [10, 5], [20, 0]]); assert.equal(r.pts[0][1], 5);
});

await test('「원작 그대로 보기」 · 맞춤 밖이면 그대로', () => {
    const doc = page({ raw: true }); let cb = null;
    m.startMbTrend(doc, { watch: (_r, _s, fn) => { cb = fn; return () => {}; } });
    const tr = doc.querySelector('.ss-trend');
    cb([{ addedNodes: [tr.closest('dialog')] }]);
    assert.equal(tr.querySelectorAll('polyline').length, 8, '그 확장 그림 그대로');
    doc.body.removeAttribute('data-bl-ext-raw'); cb([{ addedNodes: [tr.closest('dialog')] }]);
    assert.equal(tr.querySelectorAll('polyline').length, 0, '맞춤이면 다시 그려요');
});

await test('연결 자리: index 의 미트볼 문 · 맞춤 시트 · 얼굴과 같은 색 고르기 · CI', () => {
    assert.ok(read('index.js').includes("import('./src/mb-trend.js').then(m => m.startMbTrend())"));
    const css = read('src/ext-status.css');
    for (const s of ['.bl-tr-key', '.bl-tr-dot', '.bl-tr-svg', 'dialog.popup.ss-dlg.bl-mb-trend']) assert.ok(css.includes(s), s);
    assert.ok(/const fc = faceColorOf\(people, cardsOf, names\[k\], shown\[k\]\)/.test(read('src/ext-compat.js')), '얼굴 칠하기도 같은 함수');
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/mb-trend.mjs . tools'));
});

console.log(`mb-trend: ${pass}개 통과 · ${fail}개 실패`);
if (fail) process.exit(1);
