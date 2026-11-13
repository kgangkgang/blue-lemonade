// 1.2.x 남의 확장 설정 칸 「정리한 보기」(src/ext-organize.js) — 브라우저 없이 도는 계산 · 계약 시험
//   ① 접는 갈래: 표의 열쇠가 든 줄만 접고, 모르는 줄 · 못 찾는 열쇠는 그대로(판이 달라져도 조용히 원래 모습) · 갈래 줄 바로 뒤 설명 문단은 같이 접어요
//   ② 숫자 줄(파라미터)은 전부 2열 칸 — 홀수면 마지막 칸은 왼쪽 열만 · 그 확장 창 안의 슬라이더 · 숫자 줄도 2열
//   ③ 탭 한 줄 설명 · 비용 표시는 그 칸이 있는 탭 · 줄에만
//   ④ 접힌 줄의 「지금 값」 글
//   ⑤ 그 확장의 요소를 옮기거나 지우거나 다시 만들지 않아요 · 감시자 · 타이머 없음 · 끼우는 것은 기본 숨김 · 기억은 이 기기에만
//   ⑥ 시트: 접기 · 2열 · 설명은 「정리한 보기」일 때만, 「원작 그대로」면 끼운 것을 감추고 전부 펼쳐요 · 2열 격자는 서랍이 펼쳐진 동안에만 · 비용 표시 네 가지
//   ⑦ 맞춤 모듈: 정리가 실패해도 탭 · 시트는 그대로(try) · 서랍 머리 스위치 누름만 멈춰요
//   ⑧ 보기 스위치는 문서 몸통에 표식 하나(data-bl-ext-raw)만 달고 떼요(채팅방 고양이 아이콘용)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const { PLANS, planRows, summaryOf, valueOf, setView } = await import(pathToFileURL(path.join(root, 'src/ext-organize.js')).href);
const { SETS } = await import(pathToFileURL(path.join(root, 'src/ext-compat.js')).href);
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };
const row = (keys, extra = {}) => ({ keys, num: false, small: false, group: '0', ...extra });
const PLAN = { intro: [['a', '가 탭 설명'], ['x', '나 탭 설명'], ['없는칸', '안 나와요']], folds: [['첫 갈래', ['b:비', 'c:씨', 'btn']], ['둘째 갈래', ['y:와이']], ['없는 갈래', ['zz']]], cost: { b: 'save', y: 'ai' } };

test('① 표의 열쇠가 든 줄만 접고, 모르는 줄은 그대로 · 뒤따르는 설명 문단은 같이 접어요', () => {
    const rows = [row(['a']), row(['b']), row([], { small: true }), row(['모르는칸']), row(['c', 'btn']), row([], { small: true, group: '1' }), row(['x'], { group: '1' }), row(['y'], { group: '1' })];
    const p = planRows(rows, PLAN);
    assert.deepEqual(p.rows.map(r => r.fold), [null, 'f0', 'f0', null, 'f0', null, null, 'f1']);
    assert.deepEqual(p.folds.map(f => [f.id, f.title, f.group, f.first]), [['f0', '첫 갈래', '0', 1], ['f1', '둘째 갈래', '1', 7]], '맞는 줄이 없는 갈래는 만들지 않아요');
    assert.deepEqual(p.folds[0].names, [['b', '비'], ['c', '씨']], '짧은 이름이 있는 열쇠만 지금 값에 보여요(단추 줄은 값이 없어요)');
    const none = planRows([row(['q']), row(['r'])], PLAN);
    assert.deepEqual(none.rows.map(r => r.fold), [null, null]);
    assert.equal(none.folds.length, 0); assert.equal(none.intro.length, 0, '아는 칸이 하나도 없으면 아무것도 하지 않아요');
    // 한 갈래의 줄이 다른 탭에도 흩어져 있으면(다른 판) 첫 줄의 탭 것만 접어요 — 다른 탭의 줄은 그대로 보여요
    const split = planRows([row(['b']), row(['c'], { group: '2' })], PLAN);
    assert.deepEqual(split.rows.map(r => r.fold), ['f0', null]);
});
test('② 숫자 줄(파라미터)은 전부 2열 칸 — 이어지면 둘씩 나란히, 홀수면 마지막 칸은 왼쪽 열만(사용자 「파라미터는 다 세로 2열」)', () => {
    const n = (keys, extra) => row(keys, { num: true, ...extra });
    const five = planRows([n(['n1']), n(['n2']), n(['n3']), n(['n4']), n(['n5']), row(['a'])], PLAN);
    assert.deepEqual(five.rows.map(r => r.col), [true, true, true, true, true, false], '숫자 줄은 다 반 폭 칸 · 숫자가 아닌 줄은 한 줄 전체');
    assert.deepEqual(planRows([n(['n1']), row(['a']), n(['n2'])], PLAN).rows.map(r => r.col), [true, false, true], '혼자 떨어진 숫자 줄도 왼쪽 열 칸');
    assert.deepEqual(planRows([n(['b']), n(['n2'])], PLAN).rows.map(r => r.col), [true, true], '접힌 갈래 안의 숫자 줄도 같아요(접혀 있으면 자리를 안 차지해요)');
    // 시트: 반 폭 칸은 표식이 달린 줄만 · 그 밖의 줄은 두 칸 전체 · 숫자 칸은 칸 폭을 채워요 · 그 확장의 창 안 조절 칸(슬라이더 · 숫자)도 반 폭
    const sheet = read('src/ext-status.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.match(sheet, /#ss-settings\[data-bl-view="org"\] \.inline-drawer-content\[style\*="display: block"\] \{ display: grid !important; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    assert.match(sheet, /#ss-settings\[data-bl-view="org"\] \.inline-drawer-content > label\[data-bl-col\] \{ grid-column: auto;/);
    assert.match(sheet, /body\.salty \.ss-scope label\.ss-f:has\(> input:is\(\[type="range"\], \[type="number"\]\)\) \{ display: inline-flex; flex: 0 1 calc\(50% - 16px\); width: calc\(50% - 16px\);/, '창 안의 슬라이더 · 숫자 줄도 2열');
});
test('③ 탭 한 줄 설명은 그 칸이 있는 탭에 · 비용 표시는 그 줄에만', () => {
    const p = planRows([row(['a']), row(['b']), row(['x'], { group: '3' }), row(['y'], { group: '3' })], PLAN);
    assert.deepEqual(p.intro, [['0', '가 탭 설명'], ['3', '나 탭 설명']]);
    assert.deepEqual(p.rows.map(r => r.cost), [null, 'save', null, 'ai']);
});
test('④ 접힌 줄의 지금 값', () => {
    assert.equal(summaryOf([['a', '가'], ['b', '나'], ['c', '다']], k => ({ a: '켬', b: '', c: '6' })[k]), '가 켬 · 다 6');
    assert.equal(valueOf({ type: 'checkbox', checked: true }), '켬'); assert.equal(valueOf({ type: 'checkbox', checked: false }), '끔');
    assert.equal(valueOf({ localName: 'select', selectedOptions: [{ textContent: '간결 — 기본 · 추천' }] }), '간결');
    assert.equal(valueOf({ localName: 'textarea', value: '  ' }), '비어 있음'); assert.equal(valueOf({ localName: 'textarea', value: '가 = 나' }), '적음');
    assert.equal(valueOf({ localName: 'input', type: 'number', value: '6000' }), '6000'); assert.equal(valueOf(null), null);
});
const src = read('src/ext-organize.js'), code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
test('⑤ 그 확장의 요소를 옮기거나 지우지 않아요 · 감시자 · 타이머 없음 · 끼우는 것은 기본 숨김', () => {
    assert.ok(!/MutationObserver|ResizeObserver|IntersectionObserver|setInterval|setTimeout|requestAnimationFrame|watchDom|watchWith|addEventListener/.test(code), '감시자 · 타이머 · 제 사건 받기 없음(누름은 맞춤 모듈의 문서 감시자 하나가 받아요)');
    assert.ok(!/innerHTML|outerHTML|\.remove\(|removeChild|replaceWith|replaceChildren|insertBefore|appendChild|cloneNode|\.nodeValue\s*=/.test(code), '그 확장의 요소를 지우거나 옮기거나 다시 만들지 않아요');
    assert.ok(!/\.(value|checked|selectedIndex)\s*=[^=]/.test(code), '그 확장의 설정 값을 쓰지 않아요(읽기만)');
    assert.ok(code.includes('row.after(hidden(button));') && code.includes("if (introMore.has(group)) line.append(' ', introMore.get(group));"), '「자세히」는 숨긴 채 끼우거나(문단 뒤), 숨겨 둔 탭 설명 줄 안에 넣어요');
    for (const cls of ['bl-ext-fold', 'bl-ext-intro', 'bl-ext-start', 'bl-ext-view']) assert.ok(code.includes(`hidden(make(doc, '${cls === 'bl-ext-intro' ? 'small' : cls === 'bl-ext-start' ? 'div' : 'button'}', '${cls}'`), `${cls} 는 제 스타일로 숨겨 둬요(테마를 끄면 안 보여요)`);
    assert.match(code, /const hidden = node => \{ node\.style\.display = 'none'; return node; \};/);
    assert.equal((code.match(/localStorage\.(get|set)Item\(/g) || []).length, (code.match(/localStorage\.(get|set)Item\(keyOf\(root, kind\)/g) || []).length, '기억은 bl-ext-<종류>:<칸> 열쇠로만');
    assert.match(code, /const keyOf = \(root, kind\) => `bl-ext-\$\{kind\}:\$\{root\.id \|\| 'x'\}`;/);
    assert.match(code, /if \(!plan \|\| !content \|\| root\.dataset\.blOrg\) return false;/, '한 칸에 한 번만 · 표가 없으면 아무것도 안 해요');
    // 표: 뿌리가 SETS 와 같고, 갈래 · 비용 꼴이 맞아요
    assert.deepEqual(Object.keys(PLANS), SETS.filter(set => !set.mark).map(set => set.root), '분류 탭을 만드는 확장(원작 표식 갈래가 아닌 것)에만 표가 있어요');
    for (const plan of Object.values(PLANS)) {
        for (const [title, keys] of plan.folds) { assert.ok(title && keys.length, title); for (const k of keys) assert.match(k, /^[A-Za-z]\w*(:[^:|]+)?$/, k); }
        for (const [key, text] of plan.intro) { assert.match(key, /^[A-Za-z]\w*$/); assert.ok(/요\.$/.test(text) && text.length <= 70, `한 줄 설명(해요체 · 70자 안): ${text}`); }
        for (const kind of Object.values(plan.cost)) assert.ok(['ai', 'tok', 'save', 'free'].includes(kind));
        const all = plan.folds.flatMap(f => f[1].map(k => k.split(':')[0])); assert.equal(new Set(all).size, all.length, '한 칸은 한 갈래에만');
    }
});
const css = read('src/ext-status.css').replace(/\/\*[\s\S]*?\*\//g, '');
test('⑥ 시트: 접기 · 2열 · 설명은 「정리한 보기」일 때만 · 「원작 그대로」면 전부 펼쳐요', () => {
    assert.match(css, /body\.salty #ss-settings\[data-bl-view="org"\] \.inline-drawer-content > \[data-bl-fold-off\] \{ display: none !important; \}/);
    assert.ok(!/\[data-bl-fold-off\][^{]*\{/.test(css.replace(/body\.salty #ss-settings\[data-bl-view="org"\] \.inline-drawer-content > \[data-bl-fold-off\] \{[^}]*\}/, '')), '접힌 줄을 숨기는 규칙은 그것 하나(「원작 그대로」에서는 안 걸려요)');
    assert.match(css, /body\.salty #ss-settings\[data-bl-view="raw"\] :is\(\.bl-ext-tabs, \.bl-ext-intro, \.bl-ext-fold, \.bl-ext-more, \.bl-ext-start\) \{ display: none !important; \}/);
    assert.match(css, /body\.salty #ss-settings:not\(\[data-bl-view="raw"\]\) \.inline-drawer-content > \[data-bl-tab-off\] \{ display: none !important; \}/, '「원작 그대로」면 다른 탭의 묶음도 한 쪽에 다 보여요');
    assert.match(css, /#ss-settings\[data-bl-view="org"\] \.inline-drawer-content\[style\*="display: block"\] \{ display: grid !important;/, '2열 격자는 실리태번이 서랍을 펼쳐 둔 동안에만(접힌 서랍을 억지로 보이게 하지 않아요)');
    assert.ok(!/\.inline-drawer-content(?!\[style\*="display: block"\])[^{,]*\{[^}]*display: (grid|block|flex) !important/.test(css.replace(/\.inline-drawer-content > [^{]*\{[^}]*\}/g, '')), '내용 칸 자체를 늘 보이게 하는 규칙이 없어요');
    for (const [kind, label] of [['ai', 'AI 요청 +'], ['tok', '토큰 +'], ['save', '토큰 절약'], ['free', '비용 없음']]) assert.ok(css.includes(`[data-bl-cost="${kind}"]::after { content: '${label}'; }`), `비용 표시 ${kind}`);
    assert.match(css, /#ss-settings\[data-bl-view="org"\] \.inline-drawer-content > small\[data-bl-clamp="hide"\] \{ display: none; \}/, '탭 맨 위 긴 문단은 정리한 보기에서만 접어요(원작 그대로면 보여요)');
    for (const cls of ['bl-ext-intro', 'bl-ext-fold', 'bl-ext-more', 'bl-ext-start']) assert.match(css, new RegExp(`#ss-settings\\[data-bl-view="org"\\] \\.${cls} \\{ display: [a-z-]+ !important;`), `${cls} 는 정리한 보기에서만 보여요`);
    assert.match(css, /#ss-settings \.inline-drawer-header > \.bl-ext-view \{ display: inline-flex !important;/, '보기 스위치는 두 보기 모두에서 보여요');
    assert.ok(!/\.bl-ext-(intro|fold|more|start|view|jump)[^{]*\{[^}]*display: [a-z-]+ !important/.test(read('style.css')), '늘 붙는 시트에는 없어요');
});
test('⑦ 맞춤 모듈: 정리가 실패해도 탭 · 시트는 그대로 · 서랍 머리 스위치 누름만 멈춰요', () => {
    const mod = read('src/ext-compat.js');
    assert.ok(mod.includes("try { if ('blTabs' in root.dataset && organize(root, set)) showGroup(root, Number(root.dataset.blTabs) || 0); } catch { /* 원래 모습 그대로 */ }"), '탭을 만든 뒤 한 번 · 실패는 삼켜요');
    assert.equal((mod.match(/stopPropagation/g) || []).length, 1); assert.equal((mod.match(/preventDefault/g) || []).length, 1);
    assert.ok(mod.includes("else { setView(root, root.dataset.blView !== 'raw'); event.stopPropagation?.(); event.preventDefault?.(); }"), '보기 스위치는 서랍 머리 안이라 그 누름만 멈춰요(서랍이 같이 접히지 않게)');
    assert.equal((mod.match(/addEventListener\('click'/g) || []).length, 1, '누름 감시자는 하나 그대로');
    assert.equal((mod.match(/addEventListener\('change'/g) || []).length, 1, '값이 바뀔 때 접힌 줄의 지금 값만 다시 적어요');
});
test('⑧ 보기 스위치는 문서 몸통에 표식 하나(data-bl-ext-raw)를 달고 떼요 — 채팅방의 고양이 아이콘이 같은 스위치를 따라가요', () => {
    const calls = []; const fake = raw0 => ({ id: 'ss-settings', dataset: {}, querySelector: () => null, ownerDocument: raw0 });
    const doc = { body: { toggleAttribute: (name, on) => calls.push([name, on]) } };
    const a = fake(doc); setView(a, true); assert.equal(a.dataset.blView, 'raw'); setView(a, false); assert.equal(a.dataset.blView, 'org');
    assert.deepEqual(calls, [['data-bl-ext-raw', true], ['data-bl-ext-raw', false]]);
    assert.doesNotThrow(() => setView(fake(undefined), true), '문서가 없어도(시험 · 떼어 낸 칸) 조용히');
    assert.doesNotThrow(() => setView(fake({}), false));
    assert.equal((code.match(/toggleAttribute/g) || []).length, 1, '몸통 표식은 이 한 곳에서만');
    assert.ok(!/document\.body|documentElement/.test(code), '칸의 문서를 거쳐서만(전역 문서를 직접 잡지 않아요)');
});
console.log(`ext-settings-organize: ${passed}개 통과`);
