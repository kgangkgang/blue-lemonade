// 1.7.8 미트볼 상태창 2.9.0 개발 판(원작 3af88894 · 11-18 — 판 번호는 그대로 2.9.0) 맞춤
//   ① 약속 장부 D-day 딱지: 원작은 굵은 글자 하나만 더했어요 → 테마 딱지 꼴(옅은 면 · 1px 선 · 작은 글 · 간격 토큰) · 하루 남음 · 오늘까지만 강조 글자색 · 새 색 0 · :has 0 · 원작 그대로 보기 문
//   ② 시각 달력(🕐 「시간 적는 법」 24시 · 오전 오후): 원작이 「갈 곳」 도착 시각을 시각으로 셈하게 고쳤어요(t-trip) —
//      테마 「관계 숫자 · 시간대 바로잡기」(relfix)가 시각 달력에 시간대 낱말(「밤」)을 덮어쓰면 그 셈이 0시로 읽혀요 → 시각 달력이면 손대지 않아요
//   ③ 날씨 「트래커 따라」: 시각 달력이면 매크로 시간이 「22:00」 이라 밤 · 저녁을 못 알아봤어요 → 시각을 읽어 밤 · 저녁 · 새벽으로
//   ④ 인물이 상태창에 손댄 것(연락처 차단 · 이름) · 가게 재고는 숫자 칸이 아니라 바로 반영(autosub)이 안 셈 — 원작이 리롤 · 지우기로 되돌려도 두 번 빼지 않아요
//   ⑤ 확인한 판 줄
//   node tools/tests/mb-29x.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const require = createRequire(import.meta.url);
const imp = file => import(pathToFileURL(path.join(root, file)).href);
let n = 0; const bad = []; const ok = async (name, fn) => { try { await fn(); n++; console.log('ok', name); } catch (e) { bad.push(name); console.log('실패', name, '—', e.message.split('\n')[0]); } };

const src = read('src/ext-status.css');
const gen = read('src/ext-status.gen.css');
const L = require(path.join(root, 'tools/css-lib.cjs'));
const marks = [...src.matchAll(/\/\*\s*@mb\s+([a-z|]+)\s*\*\//g)].map(m => ({ at: m.index, key: m[1] }));
const keyAt = pos => { let k = null; for (const m of marks) { if (m.at < pos) k = m.key; else break; } return k; };
const DDAY = '.ss-st-f[data-f="promise"] .ss-st-row small > b';

await ok('① D-day 딱지: 약속 장부 줄의 굵은 글자에만 · 단추 · 입력창 모양(controls) 묶음 · 딱지 꼴 · 간격 토큰 · 새 색 0', () => {
    const at = src.indexOf(`${DDAY} {`);
    assert.ok(at > 0, '약속 장부 D-day 딱지 규칙');
    assert.equal(keyAt(at), 'controls', '「단추 · 입력창 · 스위치 모양」 스위치 문 안');
    const body = src.slice(at, src.indexOf('}', at));
    for (const want of ['display: inline-flex', 'border: 1px solid var(--salty-line)', 'background: var(--bl-hover)', 'border-radius: var(--bl-r-pill', 'font-size: var(--bl-ts-micro', 'white-space: nowrap', 'margin-inline-start: var(--bl-s1'])
        assert.ok(body.includes(want), `딱지 꼴: ${want}`);
    assert.doesNotMatch(body, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, '박힌 색 없음');
    assert.doesNotMatch(body, /!important/, '원작 규칙 위에 무게로 덮지 않아요');
    const warn = src.indexOf(`${DDAY}.ss-warn {`);
    assert.ok(warn > at, '하루 남음 · 오늘까지(원작 ss-warn)');
    assert.match(src.slice(warn, src.indexOf('}', warn)), /color: var\(--ss-warn\)/, '강조는 있던 강조 글자색 토큰');
    assert.doesNotMatch(src.slice(at - 400, src.indexOf('}', warn)), /:has\(/, ':has 없음');
});
await ok('① 생성 시트에도 같은 규칙 · 원작 그대로 보기 · controls 끔이면 안 걸림', () => {
    assert.ok(gen.includes(DDAY), '생성 시트(ext-status.gen.css)에 있음 — node tools/build-css.cjs');
    const at = gen.indexOf(DDAY); const head = gen.slice(Math.max(0, gen.lastIndexOf('}', at) + 1), at);
    assert.match(head, /:root:not\(\[data-bl-mb-off~="controls"\]\)/, '「단추 · 입력창 · 스위치 모양」 을 끄면 안 걸려요');
    assert.ok(typeof L === 'object', 'css-lib');
});

await ok('② 시각 달력이면 relfix 가 달력 시간을 시간대 낱말로 덮지 않아요 · 시간대 달력은 예전 그대로', async () => {
    const M = await imp('src/mb-prompt.js');
    const T = ['새벽', '아침', '낮', '저녁', '밤', '심야'];
    const op = (...ops) => ({ statussim: { bySwipe: { 0: ops } } });   // 시험용으로 지어낸 줄
    const mk = calendar => ({ chat: [{ name: 'A', mes: 'a', swipe_id: 0, extra: op(['period', 'Evening -> Night'], ['aff', 'Mira +3']) }],
        chatMetadata: { statussim: { base: { data: { calendar, rel: { user: [{ name: 'Mira', aff: 0, trust: 0, stage: 0 }] } } } } } });
    for (const clock of ['24', '12', 'both']) {
        const time = clock === '12' ? '오후 2:30' : clock === 'both' ? '낮 · 14:30' : '14:30';
        const c = mk({ time, times: T, clock });
        const r = M.reconcileRel(c);
        assert.equal(r.time, null, `${clock}: 시간대 바꿈 없음`);
        assert.equal(c.chatMetadata.statussim.base.data.calendar.time, time, `${clock}: 달력 시각 그대로`);
        assert.deepEqual(c.chatMetadata.statussim.base.data.rel.user.map(x => x.aff), [3], `${clock}: 관계 숫자 바로잡기는 그대로`);
    }
    const c = mk({ time: '아침', times: T, clock: '' });
    assert.deepEqual(M.reconcileRel(c).time, { from: '아침', to: '밤' }, '시간대 달력(시간 적는 법 「시간대」)은 예전 그대로');
    const old = mk({ time: '아침', times: T });
    assert.deepEqual(M.reconcileRel(old).time, { from: '아침', to: '밤' }, '옛 판(시간 적는 법 칸 없음)도 그대로');
});

await ok('③ 날씨: 시각 달력의 「22:00」 · 「오후 6:30」 · 「오전 5:30」 도 밤 · 저녁 · 새벽으로 읽어요', async () => {
    const W = await imp('src/weather-meatball.js');
    assert.equal(typeof W.clockWord, 'function', 'clockWord 내보냄');
    const cases = [['22:00', '밤'], ['03:10', '밤'], ['오후 11:05', '밤'], ['10:30 PM', '밤'], ['오전 5:30', '새벽'], ['18:00', '저녁'], ['오후 6:30', '저녁'], ['14:30', ''], ['오전 9:00', ''], ['오후 12:00', ''], ['오전 12:30', '밤'], ['낮', ''], ['', ''], ['25:00', '']];
    for (const [t, w] of cases) assert.equal(W.clockWord(t), w, t);
    assert.deepEqual(W.meatballWeatherModes('맑음', '22:00').modes, ['star'], '밤 시각 맑음 = 별');
    assert.equal(W.meatballWeatherModes('맑음', '오후 6:30').warm, true, '저녁 시각 = 따뜻한 빛');
    assert.deepEqual(W.meatballWeatherModes('맑음', '14:30').modes, ['sun'], '낮 시각은 햇살');
    assert.deepEqual(W.meatballWeatherModes('맑음', '밤').modes, ['star'], '시간대 낱말은 예전 그대로');
    assert.deepEqual(W.meatballWeatherModes('맑음', '낮 · 22:00').modes, ['sun'], '「시간대 + 시각」 은 그 확장이 붙인 낱말을 믿어요');
});

await ok('④ 바로 반영(autosub): 손대기의 연락처 저장 · 가게 재고 저장은 숫자 칸 저장이 아니라 셈하지 않아요(두 번 되돌림 없음)', async () => {
    const A = await imp('src/mb-autosub.js');
    const meta = { adjust: [
        { at: 3, t: 10, set: { mod: 'rel', data: { rel: { user: [{ name: 'Mira', aff: 9, trust: 1 }] } } } },
        { at: 4, t: 11, set: { mod: 'contact', data: { contact: { contacts: [{ name: 'Oskar', blocked: true }] } } }, label: '' },   // 원작 손대기 「차단」 · 되돌리기(commit('contact'))
        { at: 4, t: 12, set: { mod: 'shop', data: { shop: { shops: [] } } }, silent: true },                                          // 2.9.0 옛 구매의 재고 저장
        { at: 4, t: 13, ops: [['cash', '-30'], ['item', '+빵 1|'], ['stock', '가게 | 빵 -1']], label: '가게에서 빵 구매' },          // 새 판 구매(재고도 같은 기록)
    ] };
    assert.deepEqual(A.liveSets(meta).map(a => a.t), [10], '숫자 칸(관계 · 재산 · 수치) 저장만');
    assert.equal(A.numbers({ contact: meta.adjust[1].set.data.contact }, 'contact').size, 0);
});

await ok('⑤ 확인한 판: 2.9.0 줄에 개발 판 3af88894 · 이름 대조 · 리그', () => {
    const t = read('src/ext-compat.js');
    assert.match(t, /3af88894/, '확인한 원작 커밋'); assert.match(t, /4c7df674/, '같은 날 다음 개발 판');
    assert.match(t, /verified: \[[^\]]*'2\.9\.0', '2\.9\.1'\]/, '개발 판들은 판 번호 그대로 2.9.0 · 다음은 2.9.1');
});

await ok('⑥ 4c7df674 「관리 › 전체 설정」(서랍과 같은 칸을 상태창 안에 · .ss-set-sheet): 서랍 줄 꼴(체크 줄 · 숫자 줄 · 고르기 줄 · 단추 줄 · 머리)이 두 자리에 같이 · 단추는 같은 폭 두 칸 · 찾기 칸 띠 걷기 · 관리 탭 한 줄', () => {
    const rulesOf = re => [...src.matchAll(/^[^\n{]*\{[^}]*\}/gm)].map(m => m[0]).filter(r => re.test(r));
    const both = (re, what) => { const rs = rulesOf(re).filter(r => !/\[data-bl-(tabs|view)/.test(r));   /* 분류 탭 · 정리한 보기는 서랍에만 */ assert.ok(rs.length, what); for (const r of rs) assert.ok(r.includes('.ss-set-sheet'), `${what} — 상태창 안 전체 설정에도: ${r.slice(0, 120)}`); };
    both(/^body\.salty [^{]*#ss-settings[^{]*label\.checkbox_label \{/, '체크 줄');
    both(/^body\.salty [^{]*#ss-settings[^{]*label:has\(> input\[type="number"\]\) \{/, '숫자 줄');
    both(/^html:not\(#bl-num-off\) body\.salty [^{]*#ss-settings (?::is\()?\.inline-drawer-content[^{]* label > input\[type="number"\] \{/, '숫자 칸 폭');
    both(/^body\.salty [^{]*#ss-settings[^{]*\.ss-set-h \{/, '묶음 머리');
    both(/^body\.salty [^{]*#ss-settings[^{]*\.ss-set-btns > \.menu_button \{/, '단추 줄 단추');
    assert.ok(rulesOf(/\.ss-set-btns \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/).some(r => r.includes('.ss-set-sheet')), '단추 줄 = 같은 폭 두 칸');
    assert.ok(rulesOf(/\.ss-set-btns > \.menu_button:last-child:nth-child\(odd\) \{ grid-column: 1 \/ -1; \}/).length, '홀수 끝 단추는 한 줄');
    assert.ok(rulesOf(/\[data-s-act="chaton"\]::before \{ content: '\\1F4A1'/).length, '아이콘 없던 「이 채팅에서 켜기」 에도 선 아이콘');
    assert.ok(rulesOf(/\.ss-set-sheet \.ss-set-find \{ position: static; margin: 0; padding: 0; background: none; \}/).length, '찾기 칸 둘레 띠');
    assert.ok(rulesOf(/\.ss-seg\.wrap\.ss-mg-tabs \{ flex-wrap: nowrap; overflow-x: auto;/).length, '관리 탭 줄 한 줄');
    assert.match(read('src/ext-compat.js'), /strips: \['\.ss-scope \.ss-tabs', '\.ss-scope \.ss-mg-tabs'\]/, '관리 탭 줄도 가로 탭 줄 등록부에');
});
await ok('⑦ 4c7df674 상태창 검색의 찾은 말 칠하기(<mark>): 원작은 강조색 28% 섞음에 글자색 그대로 — 흐린 글 위에서 대비 3.5 ~ 3.7(리그 11-18) → 테마 고른 면 · 고른 글자색(다른 「고른 것」과 같은 짝) · 색 토큰만', () => {
    const at = src.indexOf('body.salty .ss-scope .ss-search .ss-results mark {');
    assert.ok(at > 0, '칠하기 규칙'); assert.equal(keyAt(at), 'palette', '「색을 테마 팔레트로」 묶음 안');
    const body = src.slice(at, src.indexOf('}', at));
    assert.match(body, /background: var\(--bl-ui-pick-face\)/); assert.match(body, /color: var\(--bl-ui-pick-ink\)/);
    assert.doesNotMatch(body, /#[0-9a-f]{3,8}\b|rgba?\(|color-mix/i, '박힌 색 · 섞음 없음');
});
await ok('CI 목록(release-check.yml)에 이 시험', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/mb-29x\.mjs \./);
});

if (bad.length) { console.error(`mb-29x: ${bad.length}개 실패`); process.exit(1); }
console.log(`mb-29x: ${n}개 통과`);
