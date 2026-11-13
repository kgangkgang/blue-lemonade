// 9.0.2 부팅 3층 계약 (src/boot-layers.js · index.js) — 테마 index.js 를 가짜 브라우저(leak-dom.mjs · leak-loader.mjs)에서 그대로 띄워
//   ① 2층 · 3층 모듈은 첫 프레임 전에 받지 않아요(정적 묶음만) ② 2층은 첫 프레임 뒤, 3층은 시작 덮개가 걷힌 뒤 유휴에 받아요
//   ③ 처음 쓸 때(✦ 메뉴 · 확장 서랍을 누름 · 입력칸 · 생성) 3층을 바로 당겨요 — 생성 전 훅은 애드온이 붙을 때까지 기다려요
//   ④ 사건 놓침 없음: 늦게 붙은 모듈은 이미 열린 채팅으로 CHAT_CHANGED 를 한 번 받고(먼저 붙은 리스너는 두 번 받지 않아요), APP_READY 는 실리태번처럼 늦어도 받아요.
//      초안 칸(draft.js)은 늦게 붙어도 그 채팅의 초안을 채우고 빈 값으로 덮지 않아요.
// 1층(시작 그래프 · 정적 import)에 남긴 것과 까닭 — 순서에 묶인 훅이라 늦추면 첫 채팅에서 안 먹어요:
//   사용량 장부 허브(다른 확장이 시작할 때 읽음) · event_types 옛 이름 잇기 · 모델 목록 훅(실리태번이 연결하며 받은 목록) · 한국어 표(addLocaleData 는 실리태번이 그리기 전) ·
//   본채팅 규칙(fetch 감싸기 — 성능 보조 fetch 감싸기보다 먼저) · 성능 보조 시작(요청 로그 · 저장 정리 — 실리태번 요청 · 저장보다 먼저) · 생성 전 훅 창구(manifest generate_interceptor) ·
//   설정 기기 간 합치기 등록 · 설정 적용(CSS 변수 · body 표식 · 글꼴) · 입력판 배치(layout.js) · 서랍 :has 미루기 · 메뉴 열림 표식(lite.js).
//   node tools/tests/boot-layers.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as realWait } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const self = fileURLToPath(import.meta.url);
const scenario = process.argv[3];
const SCENARIOS = ['order', 'idle', 'chat-open', 'generate'];

if (!scenario) {
    let failed = 0;
    for (const name of SCENARIOS) {
        const run = spawnSync(process.execPath, [self, root, name], { encoding: 'utf8', timeout: 180000 });
        process.stdout.write(run.stdout || '');
        if (run.status !== 0) { failed++; process.stdout.write(`FAIL ${name}\n${(run.stderr || '').slice(0, 3000)}\n`); }
    }
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/boot-layers.mjs .'), 'release-check.yml 에 등록');
    // 덮개가 걷힌 뒤(3층 · 문)는 모듈을 하나씩 시작하고 사이사이 한 박자 — 덮개 아래(2층)는 한 번에(차례는 위 order 시나리오가 봐요)
    const idx = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
    assert.match(idx, /const spread = layer === 3 \|\| !booting\(\);\s*for \(const \[i, \[name, , start\]\] of table\.entries\(\)\) \{[^]*?if \(spread && i\) await new Promise\(resolve => setTimeout\(resolve, 0\)\);/, '덮개가 걷힌 뒤 시작은 나눠서');
    console.log(failed ? `\nboot-layers: ${failed} scenario(s) failed` : `\nboot-layers: ${SCENARIOS.length} scenarios passed`);
    process.exit(failed ? 1 : 0);
}

const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bl-layers-')), 'modules.txt');
fs.writeFileSync(log, '');
process.env.LEAK_MODLOG = log;
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
const settings = { enabled: true, addons: { regexlink: true, order: true } };
const { ctx, eventSource, chat: chatEl } = dom.installBrowser({ settings, autoFire: true });
dom.installHost(ctx);
const { register } = await import('node:module');
register(pathToFileURL(path.join(root, 'tools/tests/leak-loader.mjs')).href, { data: { root } });
for (const k of ['warn', 'error', 'info', 'debug', 'log']) console[k] = () => {};
const say = (...a) => process.stdout.write(a.join(' ') + '\n');
const T = ctx.event_types;
const loaded = () => new Set(fs.readFileSync(log, 'utf8').split('\n').filter(Boolean));
// 가짜 시계를 돌리고, 그 사이 시작된 동적 import(진짜 비동기 읽기)가 끝나게 진짜 시간도 조금씩
async function step(ms, rounds = 6) { for (let i = 0; i < rounds; i++) { await dom.clock.advance(ms / rounds); await realWait(60); } await dom.clock.advance(0); }
const check = (name, fn) => { fn(); say(`  PASS ${scenario}: ${name}`); };

// 2층 · 3층에서 받아야 하는 것 (첫 프레임 전엔 하나도 없어야 해요)
const FRAME = ['src/assets.js', 'src/icon-text.js', 'src/tone.js', 'src/draft.js', 'src/current.js', 'src/streamfade.js', 'src/popup-guard.js', 'src/typography.js', 'src/control-ink.js', 'src/an-anchor.js'];
// 1.0.0 극한 최적화(조정자 ④): 서랍 · 입력을 처음 쓸 때만 받는 3층 모듈(GATED)은 유휴에도 오지 않고, 서랍 · ✦ 메뉴 · 입력칸을 누르면 와요
const IDLE = ['src/longpress-help.js', 'src/addons/regexlink/index.js', 'src/addons/order/order.js'];
const GATED = ['src/wi-help.js', 'src/chat-graph-launcher.js', 'src/promptlist.js', 'src/tab-scroll-init.js', 'src/storage-report.js', 'src/prompt-template-host.js'];
const GATED_INPUT = ['src/natural-slash.js'];
const GATED_PRESS = ['src/selects.js', 'src/numcomma.js'];   // 2층 · 켜 둔 기능 중 어디든 처음 누를 때(문 press — 서랍 · 입력 누름도 포함)
const missing = list => list.filter(rel => !loaded().has(rel));
const present = list => list.filter(rel => loaded().has(rel));

// 실리태번 시작 덮개 (APP_READY 바로 앞에 걷힌다)
const preloader = document.createElement('div'); preloader.setAttribute('id', 'preloader'); document.body.append(preloader);
const liftCover = async () => { preloader.remove(); await eventSource.emit(T.APP_READY); };

// 사건 리스너를 세어요: 어느 때 걸렸나 · 몇 번 불렸나 (CHAT_CHANGED · APP_READY)
const counted = [];
let phase = 'boot';
for (const method of ['on', 'makeFirst', 'makeLast']) {
    const original = eventSource[method].bind(eventSource);
    eventSource[method] = (type, fn) => {
        if (![T.CHAT_CHANGED, T.APP_READY].includes(type) || typeof fn !== 'function' || fn.blLayerMark) return original(type, fn);   // 부팅 층 자신의 표시 리스너는 세지 않아요
        const rec = { type, phase, calls: 0, src: String(fn).slice(0, 60), full: String(fn) };
        const wrapped = function counting(...args) { rec.calls++; return fn.apply(this, args); };
        counted.push(rec);
        return original(type, wrapped);
    };
}

if (scenario === 'chat-open') {
    // 실리태번 「마지막 채팅 자동으로 열기」: 덮개가 걷히기 전에 채팅이 열린다 — 초안이 있는 채팅
    ctx.chatId = 'chat-1'; ctx.characterId = 0;
    for (let i = 0; i < 4; i++) { ctx.chat.push({ name: 'Char', is_user: false, is_system: false, mes: `메시지 ${i}`, extra: {}, swipes: [`메시지 ${i}`], swipe_id: 0 }); chatEl.append(dom.messageElement(i)); }
    localStorage.setItem('bl-drafts', JSON.stringify({ 'c:char.png:chat-1': { t: '쓰다 만 글', at: 1 }, 'char.png:chat-1': { t: '쓰다 만 글', at: 1 }, 'chat-1': { t: '쓰다 만 글', at: 1 } }));
} else {
    ctx.chatId = undefined; ctx.characterId = undefined;
}

await import(pathToFileURL(path.join(root, 'index.js')).href);
await realWait(300); await dom.clock.advance(0); await realWait(200);
phase = 'after-1';

check('첫 프레임 전에는 2층 · 3층 모듈을 받지 않아요 (정적 묶음과 1층 동적 import 만)', () => {
    assert.ok(loaded().has('src/settings.js') && loaded().has('src/apply.js') && loaded().has('src/layout.js'), '1층은 받았어요');
    assert.deepEqual(present(FRAME), [], '2층 모듈이 첫 프레임 전에 왔어요');
    assert.deepEqual(present(IDLE), [], '3층 모듈이 첫 프레임 전에 왔어요');
});

if (scenario === 'chat-open') {
    // 덮개 아래에서 채팅이 열려 CHAT_CHANGED (2층 · 3층이 붙기 전)
    await eventSource.emit(T.CHAT_CHANGED, 'chat-1');
    phase = 'after-chat';
}

await step(200);
phase = 'after-2';
check('2층은 첫 프레임 뒤에 받고, 3층은 덮개가 있는 동안 기다려요', () => {
    assert.deepEqual(missing(FRAME), [], '2층이 안 왔어요');
    assert.deepEqual(present(IDLE), [], '덮개 아래에서 3층이 왔어요');
    assert.ok(globalThis.Salty.bootLayers.log.some(([layer, name]) => layer === 2 && name === 'frame'));
});

if (scenario === 'order') {
    await step(10000);
    check('덮개가 안 걷히면 10초가 지나도 3층은 기다려요(처음 쓸 때 당김이 따로 있어요)', () => { assert.deepEqual(present(IDLE), []); });
    document.getElementById('extensionsMenuButton').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    // (문) 서랍 · ✦ 메뉴를 누르면 서랍용 3층 모듈도 같이 와요 · 입력칸용은 아직
    const expectGatedAfterPress = () => { assert.deepEqual(missing(GATED), [], '서랍을 누른 뒤 서랍용 3층 모듈'); assert.deepEqual(present(GATED_INPUT), [], '입력칸용은 입력 전엔 안 와요'); };
    await step(300);
    check('✦ 메뉴를 누르면(처음 씀) 덮개가 있어도 3층을 바로 받아요', () => {
        assert.deepEqual(missing(IDLE), []);
        expectGatedAfterPress();
        assert.ok(globalThis.Salty.bootLayers.log.some(([layer, name]) => layer === 3 && name === 'start:서랍'), '당긴 까닭');
    });
}

if (scenario === 'idle' || scenario === 'chat-open') {
    await liftCover();
    phase = 'after-ready';
    await step(400);
    check('덮개가 걷힌 뒤 유휴에 3층을 받아요', () => {
        assert.deepEqual(missing(IDLE), []);
        assert.ok(globalThis.Salty.bootLayers.log.some(([layer, name]) => layer === 3 && name === 'start:idle'), '유휴로 시작');
    });
    // 11-03 퇴행 고침: 3층이 끝나고 쉴 때(둘째 장 CSS 다음) 서랍용 3층 모듈 → 늦은 애드온 → 누름용(고르기 팝업 · 숫자 쉼표)을 차례로 미리 시작해요 — 처음 여는 서랍이 떠안고 다음 서랍으로 번지던 것. 입력칸용은 그대로 처음 쓸 때
    await step(4000);
    check('3층 뒤 쉴 때 서랍용 · 누름용 3층 모듈이 오고, 입력칸용은 처음 쓸 때까지 기다려요', () => {
        assert.deepEqual(missing(GATED), [], '서랍용이 쉴 때 안 왔어요');
        assert.deepEqual(present(GATED_INPUT), [], '입력칸용이 유휴에 왔어요');
        assert.deepEqual(missing(GATED_PRESS), [], '누름용(고르기 팝업 · 숫자 쉼표)이 쉴 때 안 왔어요');
        const log = globalThis.Salty.bootLayers.log; const at = n => log.findIndex(([layer, name]) => layer === 3 && name === n);
        assert.ok(at('문:drawer') >= 0, '문 drawer 로 시작');
        assert.ok(at('문:press') > at('문:drawer'), '문 press 는 문 drawer 뒤에(쉴 때 차례로)');
    });
    document.getElementById('extensionsMenuButton').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await step(300);
    check('✦ 메뉴를 처음 눌러도 그대로예요(서랍용 · 누름용은 이미 · 입력칸용은 아직 · 문 press 는 한 번만)', () => {
        assert.deepEqual(missing(GATED), []);
        assert.deepEqual(present(GATED_INPUT), []);
        assert.deepEqual(missing(GATED_PRESS), [], '누름용(2층 문 press)');
        assert.equal(globalThis.Salty.bootLayers.log.filter(([layer, name]) => layer === 3 && name === '문:press').length, 1, '문 press 는 한 번만');
    });
    document.getElementById('send_textarea').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await step(300);
    check('입력칸을 처음 누르면 입력칸용 3층 모듈이 와요', () => {
        assert.deepEqual(missing(GATED_INPUT), []);
        assert.ok(globalThis.Salty.bootLayers.log.some(([layer, name]) => layer === 3 && name === '문:input'), '문 input 으로 시작');
    });
}

if (scenario === 'generate') {
    // 덮개 아래 · 아직 아무것도 안 누른 채 생성이 시작되면(입력칸을 거치지 않는 /명령 · 다른 확장) 생성 전 훅 창구가 3층을 당겨 애드온이 붙을 때까지 기다려요
    let done = false;
    const job = globalThis.blueLemonadeGenerate([], 4096, () => {}, 'normal').then(() => { done = true; });
    await step(400);
    await job;
    check('생성 전 훅 창구는 애드온 본체(3층)가 붙은 뒤에 훅을 불러요', () => {
        assert.ok(done);
        assert.deepEqual(missing(['src/addons/regexlink/index.js', 'src/addons/order/order.js']), []);
        assert.ok(globalThis.Salty.bootLayers.log.some(([layer, name]) => layer === 3 && name === 'start:생성'), '당긴 까닭');
    });
}

if (scenario === 'chat-open') {
    await step(300);
    check('늦게 붙은 CHAT_CHANGED 리스너는 지금 채팅으로 한 번 받고, 먼저 붙은 리스너는 두 번 받지 않아요', () => {
        const chat = counted.filter(r => r.type === T.CHAT_CHANGED);
        const early = chat.filter(r => r.phase === 'boot' || r.phase === 'after-1'), late = chat.filter(r => r.phase !== 'boot' && r.phase !== 'after-1');
        const show = list => JSON.stringify(list.map(r => [r.phase, r.calls, r.src]));
        assert.ok(early.length > 0 && late.length > 10, `리스너 수 ${early.length} · ${late.length}`);
        assert.deepEqual(early.map(r => r.calls), early.map(() => 1), `먼저 붙은 리스너는 진짜 사건 한 번만: ${show(early)}`);
        assert.deepEqual(late.filter(r => r.calls > 1), [], `두 번 받은 리스너: ${show(late)}`);
        // 2 · 3층 표의 테마 모듈 · 2층 기능 모듈(시작 안에서 리스너를 거는 것)은 한 번씩 꼭 — 초안 · 스트리밍 페이드 · 프롬프트 귀속 · 자연 슬래시 · 웹 검색 표시 · 채팅 지도 · 빈 채팅 막기
        for (const sign of ['function onChatChanged()', '() => detach(true)', "syncPromptBinds('chat')", 'Object.keys(searchState)', 'hideChip(); origins.clear()', 'guard().onChatOpened()', 'if (!timer) timer = setTimeout(refresh, delay)']) {
            const hit = late.filter(r => r.src.includes(sign) || r.full?.includes(sign));
            assert.ok(hit.length > 0, `${sign} 리스너가 안 걸렸어요: ${show(late)}`);
            assert.deepEqual(hit.map(r => r.calls), hit.map(() => 1), `${sign} 는 다시 알림을 한 번 받아요`);
        }
        const zero = late.filter(r => r.calls === 0);
        say(`    (늦게 붙은 리스너 ${late.length}개 중 다시 알림을 못 받은 것 ${zero.length}개 — 층이 끝난 뒤 타이머 · 네트워크를 기다려 거는 것이라 시작할 때 지금 상태를 스스로 그려요${zero.length ? ': ' + show(zero) : ''})`);
    });
    check('APP_READY 는 늦게 붙은 리스너도 받아요(실리태번 autoFire)', () => {
        const ready = counted.filter(r => r.type === T.APP_READY);
        assert.ok(ready.length > 0);
        assert.deepEqual(ready.filter(r => r.calls < 1).map(r => r.phase), []);
    });
    check('초안 칸: 늦게 붙어도 그 채팅의 초안을 채우고 빈 값으로 덮지 않아요', () => {
        assert.equal(document.getElementById('send_textarea').value, '쓰다 만 글');
        assert.ok(JSON.stringify(JSON.parse(localStorage.getItem('bl-drafts') || '{}')).includes('쓰다 만 글'), '저장본이 남아요');
    });
}

if (scenario !== 'generate') {
    // 생성 전 훅 창구는 3층이 끝난 뒤엔 기다리지 않아요
    const t0 = dom.clock.now;
    await globalThis.blueLemonadeGenerate([], 4096, () => {}, 'normal');
    check('3층이 끝난 뒤의 생성은 기다리지 않아요', () => { assert.equal(dom.clock.now, t0); });
}
process.exit(0);
