// 1.1.6 문서 뿌리(html · head · body) 감시 경계 — 테마 런타임에서 문서 뿌리를 보는 MutationObserver 는 공용 감시 허브(src/dom-watch.js)만 만들어요.
//   ① 정적: 테마 갈래(src/ · index.js — 애드온 · 내장 스크립트 빼고)에서 html · head · body 를 직접 observe 하는 자리가 아래 허용 목록 밖에 없어요
//      (뿌리 자신만 보는 감시도 — 모듈마다 따로 걸면 body 에 감시자가 여러 벌 붙고, 변화 하나에 기록 · 콜백이 그 수만큼 생겨요)
//   ② 부팅 흉내(leak-dom): 테마를 띄운 뒤 html · head · body 에 걸린 감시자는 허브가 만든 것뿐이고(2개 이하), 팝업 하나를 열고 · 안을 바꾸고 · 닫을 때 감시 콜백이 각각 2번 이하예요
//      (1.1.5: 문서 뿌리 감시자 7 · 팝업 열기 5 · 창 안 3 · 닫기 7번)
//   ③ 옮긴 모듈들이 실제로 허브 구독으로 걸려 있어요(구독 이름)
//   node tools/tests/observer-roots.mjs [저장소]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const self = fileURLToPath(import.meta.url);
const root = path.resolve(process.argv[2] || path.join(path.dirname(self), '../..'));

// 허용 목록 — 늘릴 때는 까닭을 적어요
const ALLOW = new Map([
    ['src/boot-gate.js', '덮개 걷힘 기다림 — 허브보다 먼저(시작 묶음 맨 앞) 돌고 덮개가 걷히면 바로 끊어요'],
    ['src/apply.js', '사용자 CSS(#custom-style) 숨김을 켠 동안만 head 자식을 잠깐 봐요 — 다음 걸음 후보(apply.js 는 다른 분기와 겹쳐 이번엔 안 옮김)'],
]);

if (process.argv.includes('--probe')) {
    // ── 부팅 흉내 한 번(모듈 캐시가 한 번뿐이라 자식 프로세스) ──
    const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bl-roots-')), 'modules.txt');
    fs.writeFileSync(log, '');
    process.env.LEAK_MODLOG = log;
    process.env.LEAK_TRACE = '1';
    const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
    const { ctx, eventSource, chat: chatEl } = dom.installBrowser({ settings: { enabled: true, usageMode: 'theme' }, extensionSettings: {} });
    dom.installHost(ctx);
    const Base = globalThis.MutationObserver;
    let calls = 0;
    globalThis.MutationObserver = class extends Base { constructor(cb) { super((r, o) => { calls++; return cb(r, o); }); } };
    const { register } = await import('node:module');
    register(pathToFileURL(path.join(root, 'tools/tests/leak-loader.mjs')).href, { data: { root } });
    for (const k of ['warn', 'error', 'info', 'debug', 'log']) console[k] = () => {};
    const T = ctx.event_types, settle = ms => dom.clock.advance(ms);
    for (let i = 0; i < 6; i++) { ctx.chat.push({ name: 'Char', is_user: false, is_system: false, mes: `메시지 ${i}`, extra: {}, swipes: [`메시지 ${i}`], swipe_id: 0 }); chatEl.append(dom.messageElement(i)); }
    await import(pathToFileURL(path.join(root, 'index.js')).href);
    await settle(1000);
    await eventSource.emit(T.APP_READY);
    await eventSource.emit(T.CHAT_CHANGED, 'chat-1');
    await settle(15000);
    const on = node => [...new Set((node?._regs || []).map(r => r.observer))];
    const where = o => String(o.origin || '').replace(/\\/g, '/').match(/\/(src\/[\w./-]+|index\.js):\d+/g)?.map(s => s.replace(/^\//, '').replace(/:\d+$/, '')) || [];
    const roots = {};
    for (const [name, node] of [['html', document.documentElement], ['head', document.head], ['body', document.body]]) roots[name] = on(node).map(o => where(o)[0] || '(모름)');
    const distinct = new Set([document.documentElement, document.head, document.body].flatMap(on)).size;
    const dlg = document.createElement('dialog'); dlg.className = 'popup';
    let mark = calls;
    document.body.append(dlg); await settle(50);
    const open = calls - mark; mark = calls;
    const row = document.createElement('div'); row.className = 'bl-btn-grid'; dlg.append(row); await settle(50);
    const inner = calls - mark;
    const onDialog = on(dlg).length;
    mark = calls; dlg.remove(); await settle(50);
    const close = calls - mark;
    const stats = globalThis[Symbol.for('blue-lemonade.dom-watch.v2')]?.stats?.() || { each: [] };
    process.stdout.write(JSON.stringify({ roots, distinct, open, inner, close, onDialog, names: stats.each.map(e => e.name), errors: dom.errors.length }) + '\n');
    process.exit(0);
}

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

// ① 정적
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bl-roots-')), 'obs.json');
const tool = path.join(root, 'tools/audit/observers.mjs');
const r = spawnSync(process.execPath, ['--expose-internals', '--no-warnings', tool, root, '--json', tmp], { cwd: root, encoding: 'utf8', env: { ...process.env, ACORN_PATH: '', ST_ROOT: '' } });
const census = JSON.parse(fs.readFileSync(tmp, 'utf8'));
test('정적: 테마 갈래에서 html · head · body 를 직접 observe 하는 자리는 허용 목록뿐이에요', () => {
    assert.equal(r.status, 0, '감시 세기 도구가 돌아요 ' + (r.stderr || ''));
    const direct = census.sites.filter(s => s.group === 'theme' && s.kind === 'observe' && ['html', 'head', 'body'].includes(s.where));
    const outside = direct.filter(s => !ALLOW.has(s.file)).map(s => `${s.file}:${s.line} ${s.target}`);
    assert.deepEqual(outside, [], '문서 뿌리 감시는 watchDom(document.body, { … }) 처럼 공용 감시 허브 구독으로 걸어요(가짜 창을 받는 모듈은 watchWith)');
});
test('정적: 옮긴 모듈에 new MutationObserver 가 다시 생기지 않아요(창 안 · 창 닫힘 · body 자식 · body/html 속성)', () => {
    const moved = ['src/group-grid.js', 'src/num-width.js', 'src/popup-guard.js', 'src/st-solid.js', 'src/natural-slash.js', 'src/weather-rest.js', 'src/pull-to-refresh.js'];
    const back = census.sites.filter(s => s.kind === 'new' && moved.includes(s.file)).map(s => `${s.file}:${s.line}`);
    assert.deepEqual(back, []);
    const spt = census.sites.filter(s => s.file === 'src/swipe-picker-translation.js' && s.kind === 'observe').map(s => s.where);
    assert.deepEqual(spt.filter(w => w !== 'element'), [], '스와이프 고르기는 목록 칸(요소)만 직접 봐요');
});

// ② · ③ 부팅 흉내
const p = spawnSync(process.execPath, [self, root, '--probe'], { encoding: 'utf8', maxBuffer: 64 << 20 });
let probe = null;
try { probe = JSON.parse(String(p.stdout || '').trim().split('\n').pop()); } catch { /* 아래에서 실패 */ }
test('부팅 흉내: 문서 뿌리(html · head · body)에 걸린 감시자는 공용 감시 허브 것뿐(2개 이하)', () => {
    assert.ok(probe, '부팅 흉내 실패: ' + String(p.stderr || '').slice(0, 800));
    assert.equal(probe.errors, 0, '시작 중 오류 없음');
    const foreign = Object.entries(probe.roots).flatMap(([name, list]) => list.filter(f => f !== 'src/dom-watch.js' && !ALLOW.has(f)).map(f => `${name}: ${f}`));
    assert.deepEqual(foreign, [], '허브 밖 감시자');
    assert.ok(probe.distinct <= 2, `문서 뿌리 감시자 ${probe.distinct} (1.1.5: 7)`);
});
test('부팅 흉내: 팝업 하나를 열고 · 안을 바꾸고 · 닫을 때 감시 콜백이 각각 2번 이하', () => {
    assert.ok(probe);
    assert.ok(probe.open <= 2, `열기 ${probe.open} (1.1.5: 5)`);
    assert.ok(probe.inner <= 2, `창 안 ${probe.inner} (1.1.5: 3)`);
    assert.ok(probe.close <= 2, `닫기 ${probe.close} (1.1.5: 7)`);
    assert.ok(probe.onDialog <= 2, `창에 걸린 감시자 ${probe.onDialog} (1.1.5: 3)`);
});
test('부팅 흉내: 옮긴 모듈이 허브 구독으로 걸려 있어요(구독 이름)', () => {
    assert.ok(probe);
    for (const name of ['안내 팝업 지킴이 (새 팝업)', '숫자칸 폭 (새 창)', '단추 묶음 격자 (새 창)', '실리태번 판 불투명 (html style)', '실리태번 판 불투명 (body class)'])
        assert.ok(probe.names.includes(name), `구독 「${name}」 없음`);
    assert.ok(!probe.names.includes('숫자칸 폭 (창 닫힘)'), '닫힌 창의 구독은 끊겨요');
});

const yml = fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8');
test('release-check.yml 에 등록', () => assert.ok(yml.includes('node tools/tests/observer-roots.mjs .')));
console.log(`${passed} passed, ${failed} failed${probe ? ` · 문서 뿌리 감시자 ${probe.distinct} · 팝업 열기/안/닫기 콜백 ${probe.open}/${probe.inner}/${probe.close}` : ''}`);
if (failed) process.exit(1);
