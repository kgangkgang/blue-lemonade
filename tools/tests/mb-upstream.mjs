// 1.7.7 미트볼 원작이 넣은 기능 알아보기 · 한 번 옮기기(src/mb-upstream.js)
//   ① 그 확장 설정에 키가 있으면 「원작이 가짐」 · 옛 판(키 없음) · 그 확장 꺼짐 · 없음이면 아님 ② 켜짐 판정(뒤로 가기 · 묻기 = 끔만 아니면 · 노트 = 참일 때만)
//   ③ 옮길 것 셈: 테마에서 손수 끈 뒤로 가기 · 묻기 → 그 확장 것도 끔 / 눈 감긴 답은 테마 것이 그대로라 안 옮김 / 이미 판단한 열쇠 · 옛 판은 안 건드림
//   ④ 한 번 옮기기: 그 확장 설정에 적고 저장을 부르고 테마 설정에 열쇠를 적어요 · 다시 불러도 한 번 · 그 뒤 사용자가 그 확장 설정을 바꾸면 그대로 둬요
//   ⑤ 안내 줄 · 연결(설정 정리 · 초기화 때 남김 · CI 목록)
//   node tools/tests/mb-upstream.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const M = await import(pathToFileURL(path.join(root, 'src/mb-upstream.js')).href);

// 그 확장 2.9.0 의 처음 값(설정 키 이름만 — 값은 그 확장 README 의 「기본 켬 · 기본 끔」)
const up290 = (over = {}) => ({ enabled: true, backClose: true, askDelete: true, hideSkip: false, genNote: false, genRead: 'short', ...over });
const up280 = () => ({ enabled: true, albumOn: true });
const OLD = ['back', 'ask', 'note', 'read'];   // 2.9.0 에 맡긴 것(2.9.1 것은 ⑦)
const ctxOf = up => ({ extensionSettings: up ? { statussim: up } : {}, saved: 0, saveSettingsDebounced() { this.saved++; } });
const themeOf = chat => { const s = { chat }; return { s, saves: 0, get: () => s, async save(fn) { fn(s); this.saves++; } }; };

await ok('① 그 확장 설정에 키가 있으면 원작이 가진 기능 · 옛 판 · 꺼짐 · 없음은 아님', async () => {
    for (const name of OLD) assert.equal(M.upHas(name, ctxOf(up290())), true, name);
    for (const name of OLD) assert.equal(M.upHas(name, ctxOf(up280())), false, name);
    for (const name of OLD) assert.equal(M.upHas(name, ctxOf(up290({ enabled: false }))), false, name);
    assert.equal(M.upHas('back', ctxOf(null)), false); assert.equal(M.upHas('back', null), false); assert.equal(M.upHas('nope', ctxOf(up290())), false);
    assert.deepEqual(M.UP_KEYS, [...OLD, 'album', 'autoen', 'helpers', 'grid', 'trend', 'blur']);
    assert.equal(M.upHas('hidden', ctxOf(up290())), false);   // 눈 감긴 답은 맡기지 않아요(테마 것이 그대로 돌아요)
});
await ok('② 켜짐 판정: 뒤로 가기 · 묻기는 끔만 아니면 켬 · 작가 노트는 참일 때만', async () => {
    const c = ctxOf(up290());
    assert.equal(M.upOn('back', c), true); assert.equal(M.upOn('ask', c), true); assert.equal(M.upOn('note', c), false); assert.equal(M.upOn('read', c), true);
    const d = ctxOf(up290({ backClose: false, askDelete: false, hideSkip: true, genNote: true }));
    assert.equal(M.upOn('back', d), false); assert.equal(M.upOn('ask', d), false); assert.equal(M.upOn('note', d), true);
    assert.equal(M.upOn('note', ctxOf(up280())), false);
});
await ok('③ 옮길 것 셈: 처음 값 그대로인 사용자(전부 켬)는 옮길 것이 없어요 — 판단만 끝내요', async () => {
    const p = M.planMoves({ mbBack: true, mbHiddenSync: true, mbOff: [] }, up290());
    assert.deepEqual(p.set, []);
    assert.deepEqual(p.done, OLD);
});
await ok('③ 손수 끈 뒤로 가기 · 묻기는 그 확장 것도 꺼요 · 눈 감긴 답은 켜 두든 끄든 그 확장 값을 안 건드려요', async () => {
    const p = M.planMoves({ mbBack: false, mbHiddenSync: false, mbOff: ['ask', 'note'] }, up290());
    assert.deepEqual(p.set, [['backClose', false, 'back'], ['askDelete', false, 'ask']]);
    const q = M.planMoves({ mbBack: false, mbHiddenSync: true, mbOff: ['ask'] }, up290({ backClose: false, askDelete: false, hideSkip: true }));
    assert.deepEqual(q.set, []); assert.deepEqual(q.done, OLD);   // 이미 같은 값
});
await ok('③ 이미 판단한 열쇠 · 옛 판 · 그 확장 꺼짐 · 모르는 꼴은 아무것도 안 해요', async () => {
    assert.deepEqual(M.planMoves({ mbBack: false, mbMoved: ['back', 'ask', 'note', 'read'] }, up290()), { set: [], done: [] });
    assert.deepEqual(M.planMoves({ mbHiddenSync: true, mbBack: false }, up280()), { set: [], done: [] });
    assert.deepEqual(M.planMoves({ mbHiddenSync: true }, up290({ enabled: false })), { set: [], done: [] });
    assert.deepEqual(M.planMoves(null, up290()), { set: [], done: [] }); assert.deepEqual(M.planMoves({}, null), { set: [], done: [] });
    const some = M.planMoves({ mbBack: false, mbMoved: ['back'] }, up290());   // 사용자가 그 뒤 그 확장 설정을 다시 켰어도 또 끄지 않아요
    assert.deepEqual(some.set, []); assert.deepEqual(some.done, ['ask', 'note', 'read']);
});
await ok('④ 한 번 옮기기: 그 확장 설정에 적고 저장 · 테마 설정에 열쇠 · 다시 불러도 한 번', async () => {
    M.resetMoveForTest();
    const up = up290(), c = ctxOf(up), th = themeOf({ mbBack: false, mbHiddenSync: true, mbOff: [] });
    const a = M.moveOnce({ c, settings: th }), b = M.moveOnce({ c, settings: th });
    assert.equal(a, b);
    assert.deepEqual(await a, ['back']);
    assert.equal(up.backClose, false); assert.equal(up.hideSkip, false); assert.equal(up.askDelete, true); assert.equal(up.genNote, false);
    assert.equal(c.saved, 1); assert.equal(th.saves, 1); assert.deepEqual(th.s.chat.mbMoved, OLD);
    // 그 뒤 사용자가 그 확장 설정에서 뒤로 가기를 다시 켜고 새로 시작해도 또 끄지 않아요
    up.backClose = true; M.resetMoveForTest();
    assert.deepEqual(await M.moveOnce({ c, settings: th }), []); assert.equal(up.backClose, true); assert.equal(c.saved, 1); assert.equal(th.saves, 1);
});
await ok('④ 옛 판 · 그 확장 없음: 아무것도 안 적고 다음에 다시 봐요(판을 올리면 그때 옮겨요)', async () => {
    M.resetMoveForTest();
    const old = up280(), c = ctxOf(old), th = themeOf({ mbBack: false, mbHiddenSync: true, mbOff: [] });
    assert.deepEqual(await M.moveOnce({ c, settings: th }), []); assert.equal(c.saved, 0); assert.equal(th.saves, 0); assert.equal(th.s.chat.mbMoved, undefined);
    M.resetMoveForTest();
    assert.deepEqual(await M.moveOnce({ c: ctxOf(null), settings: th }), []);
    Object.assign(old, up290()); M.resetMoveForTest();   // 판 올림
    assert.deepEqual(await M.moveOnce({ c, settings: th }), ['back']); assert.equal(old.backClose, false); assert.equal(old.hideSkip, false);
});
await ok('⑤ 안내 줄 · 연결(설정 정리 · 초기화 때 남김 · 이름표 · 그 확장 파일을 안 불러요 · CI 목록)', async () => {
    for (const name of OLD) { const t = M.upWhere(name); assert.ok(t.includes('미트볼 설정 칸') && t.includes(M.UP[name].label) && !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(t), name); }
    assert.equal(M.upWhere('nope'), '');
    const st = read('src/settings.js');
    assert.match(st, /s\.chat\.mbMoved = Array\.isArray\(s\.chat\.mbMoved\)/); assert.match(st, /'mbAllWas', 'mbMoved',/);
    assert.match(read('src/styles.js'), /'mbAllWas', 'mbMoved',/);
    assert.ok(read('src/settings-labels.js').includes('"chat.mbMoved"'));
    const src = read('src/mb-upstream.js');
    assert.ok(!/meatballstats|new MutationObserver|setInterval|setTimeout/.test(src));
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/mb-upstream.mjs .'));
});
await ok('⑥ 판을 내린 뒤 남은 키는 안 믿어요: 설정 칸 머리의 판 번호가 그 기능이 생긴 판보다 옛 판이면 「없음」 · 못 읽으면 키만', async () => {
    const docOf = text => ({ querySelector: sel => (sel === '#ss-settings .inline-drawer-header small' ? { textContent: text } : null) });
    const c = ctxOf(up290());
    assert.equal(M.upVersion(docOf('v2.9.0')), '2.9.0'); assert.equal(M.upVersion(docOf('')), ''); assert.equal(M.upVersion(null), '');
    assert.equal(M.upHas('back', c, docOf('v2.9.0')), true); assert.equal(M.upHas('back', c, docOf('v2.10.1')), true); assert.equal(M.upHas('back', c, docOf('v3.0')), true);
    assert.equal(M.upHas('back', c, docOf('v2.8.0')), false); assert.equal(M.upHas('note', c, docOf('v2.7.23')), false); assert.equal(M.upOn('ask', c, docOf('v2.8.0')), false);
    assert.equal(M.upHas('back', c, docOf('판 모름')), true);
    assert.deepEqual([M.older('2.8.0', '2.9.0'), M.older('2.9.0', '2.9.0'), M.older('2.10.0', '2.9.0'), M.older('2.9', '2.9.1')], [true, false, false, true]);
    assert.deepEqual(M.planMoves({ mbBack: false, mbHiddenSync: true }, up290(), '2.8.0'), { set: [], done: [] });
    assert.deepEqual(M.planMoves({ mbBack: false, mbHiddenSync: true }, up290(), '2.9.0').set.map(r => r[2]), ['back']);
    // 같은 뜻의 설정이 그 확장에도 있다는 안내(눈 감긴 답 — 테마 것은 그대로 돌아요)
    assert.ok(M.upAlso('hidden', c, docOf('v2.9.0')).includes('두 번 빼지 않아요')); assert.equal(M.upAlso('hidden', c, docOf('v2.8.0')), ''); assert.equal(M.upAlso('hidden', ctxOf(up280())), ''); assert.equal(M.upAlso('back', c), '');
});
await ok('⑦ 2.9.1(원작 766314d · 0112545): 앨범 단추 · 영어 저장 묻기 · 맨 위로 · 짝 칸 두 열 · 흐림을 원작에 — 시트 묶음 끔 · 옮기기 · 안내', async () => {
    const up291 = (over = {}) => up290({ albumBtn: true, trConvertAsk: true, trAutoConvert: false, popX: true, blurFx: true, ...over });
    const doc291 = { querySelector: sel => (sel === '#ss-settings .inline-drawer-header small' ? { textContent: 'v2.9.1' } : null) };
    const doc290 = { querySelector: sel => (sel === '#ss-settings .inline-drawer-header small' ? { textContent: 'v2.9.0' } : null) };
    for (const name of ['album', 'autoen', 'helpers', 'grid', 'trend', 'blur']) { assert.equal(M.upHas(name, ctxOf(up291()), doc291), true, name); assert.equal(M.upHas(name, ctxOf(up290()), doc290), false, name); assert.equal(M.upHas(name, ctxOf(up291()), doc290), false, name); }
    assert.deepEqual(M.upCssKeys(ctxOf(up291()), doc291), ['album', 'helpers', 'grid', 'trend']);   // 흐림은 일부만 맡겨 시트 묶음을 안 꺼요 · 영어 저장은 모듈이 스스로 쉬어요
    assert.deepEqual(M.upCssKeys(ctxOf(up290()), doc290), []);
    // 옮기기: 테마 기본(앨범 단추 숨김 · 흐림 끔 · 영어 저장 바로)을 원작 설정으로 이어요
    const p = M.planMoves({ mbMoved: OLD }, up291(), '2.9.1');
    assert.deepEqual(p.set, [['albumBtn', false, 'album'], ['trConvertAsk', false, 'autoen'], ['blurFx', false, 'blur']]);
    assert.deepEqual(p.done, ['album', 'autoen', 'helpers', 'grid', 'trend', 'blur']);
    const q = M.planMoves({ mbMoved: OLD, mbAlbumBtn: true, mbAutoEn: false, mbOff: ['blur'] }, up291(), '2.9.1');
    assert.deepEqual(q.set, []);   // 테마에서 보이기 · 묻기 · 흐림 켬으로 둔 사용자는 원작 처음 값 그대로
    assert.deepEqual(M.planMoves({ mbMoved: OLD }, up291(), '2.9.0'), { set: [], done: [] });
    // 안내: 늘 켜진 것은 설정 자리 대신 「늘 켜져 있어요」
    assert.ok(M.upWhere('helpers').includes('늘 켜져 있어요') && !M.upWhere('helpers').includes('설정 칸 ›'));
    assert.ok(M.upWhere('album').includes('데이터 · 화면'));
    // 끔 표식: 맡긴 묶음이 테마 스위치 끔과 같이 적혀요
    const SW = await import(pathToFileURL(path.join(root, 'src/mb-switch.js')).href);
    assert.equal(SW.offAttrValue({ chat: {} }, () => ['album', 'helpers', 'grid']), 'album helpers grid');
    assert.match(read('src/mb-auto-en.js'), /!upHas\('autoen', c \?\? undefined, doc\)/);   // 1.8.6 받은 문맥을 넘겨요(기본 문맥 = 감싼 getContext 라 되풀이됐어요)
    assert.match(read('src/ext-compat.js'), /!mbOff\('helpers', doc\)\) armTop\(dlg\)/);
});
console.log(`mb-upstream: ${n}개 통과`);
