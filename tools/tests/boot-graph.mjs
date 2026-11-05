// 시작할 때 싣는 모듈 그래프 (예측점검 부팅 · 10-30) — index.js 에서 정적 import 로 따라 닿는 모듈만 「첫 화면 전에 받아 실행하는 것」이에요.
//   첫 화면에 안 쓰이는 것(꺼진 기능 · 창을 열어야 쓰는 것 · 그 기기에서 안 쓰는 것)은 여기 들어오면 안 되고, 맨 위 await 도 없어야 해요
//   (맨 위 await 가 하나라도 있으면 index.js 전체가 그 await 가 끝날 때까지 시작하지 못해요).
//   node tools/tests/boot-graph.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

// 주석을 뺀 글에서 정적 import · export from 만 (동적 import() 는 시작 그래프가 아니에요)
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const STATIC = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^'"();]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
function staticGraph(entry) {
    const seen = new Map();
    const walk = (rel, from) => {
        if (seen.has(rel)) return;
        const file = path.join(root, rel);
        if (!fs.existsSync(file)) return;   // 실리태번 본체 모듈(../../popup.js 같은 것) — 테마 밖
        seen.set(rel, from);
        const text = stripComments(fs.readFileSync(file, 'utf8'));
        for (const m of text.matchAll(STATIC)) {
            const next = path.relative(root, path.resolve(path.dirname(file), m[1])).split(path.sep).join('/');
            if (!next.startsWith('..')) walk(next, rel);
        }
    };
    walk(entry, '');
    return seen;
}
const graph = staticGraph('index.js');
const chain = rel => { const out = []; for (let at = rel; at; at = graph.get(at)) out.unshift(at); return out.join(' → '); };
const notAtBoot = (rel, why) => assert.ok(!graph.has(rel), `${rel} 는 시작할 때 싣지 않아요 (${why}) — 지금 길: ${graph.has(rel) ? chain(rel) : ''}`);

// 맨 위 await: node 의 vm.SourceTextModule.hasTopLevelAwait (--experimental-vm-modules 로 이 시험을 한 번 더 띄워 물어요).
//   그 함수가 없는 node 면 줄 머리 판정(들여쓰기 없는 `await …` · `const x = await …`)으로 — 테마 코드가 맨 위 await 를 쓰는 모양은 그것뿐이에요.
async function topLevelAwaitFiles(list) {
    const { spawnSync } = await import('node:child_process');
    const probe = `const vm=require('vm'),fs=require('fs');const out=[];for(const f of JSON.parse(process.argv[1])){const m=new vm.SourceTextModule(fs.readFileSync(f,'utf8'));if(typeof m.hasTopLevelAwait!=='function'){console.log('NA');process.exit(0);}if(m.hasTopLevelAwait())out.push(f);}console.log(JSON.stringify(out));`;
    const run = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', '-e', probe, JSON.stringify(list.map(rel => path.join(root, rel)))], { encoding: 'utf8' });
    const text = String(run.stdout || '').trim();
    if (run.status === 0 && text.startsWith('[')) return JSON.parse(text).map(f => path.relative(root, f).split(path.sep).join('/'));
    return list.filter(rel => /^(?:await\b|(?:export\s+)?(?:const|let|var)\s+[^=\n]+=\s*await\b)/m.test(stripComments(read(rel))));
}

await test('시작 그래프에 맨 위 await 가 없어요 (live-models.js 는 기다리지 않고 따로 받아요)', async () => {
    const awaiting = await topLevelAwaitFiles([...graph.keys()]);
    assert.deepEqual(awaiting, [], awaiting.map(chain).join('\n'));
    notAtBoot('src/live-models.js', '맨 위 await 로 실리태번 모듈 · 모델 등록 상태를 받아요 — 본채팅 규칙은 claude-gen.js 만');
    assert.ok(graph.has('src/claude-gen.js'), '본채팅 규칙은 작은 판정 모듈을 써요');
    const index = read('index.js');
    assert.match(index, /import\('\.\/src\/live-models\.js'\)/, '모델 목록 훅(실리태번이 연결하며 받은 목록)은 시작할 때 기다리지 않고 걸어요');
    assert.ok(index.indexOf("import('./src/live-models.js')") < index.indexOf('startAddons('), '애드온보다 먼저 받기 시작해요');
});

await test('Claude 5 판정은 예전 live-models.js 판정과 같아요', async () => {
    const versions = (re, m) => [...m.matchAll(re)].map(x => Number(x[1]));
    const inRange = (arr, lo, hi) => arr.some(n => n >= lo && n <= hi);
    const before = m => /claude-(fable|opus-5|sonnet-5)/.test(m) || inRange(versions(/claude-[a-z]+-(\d+)/g, m), 5, 9);
    const { isClaude5Plus } = await import(pathToFileURL(path.join(root, 'src/claude-gen.js')).href);
    const names = ['claude-haiku-5-5', 'claude-opus-5', 'claude-sonnet-5-1', 'claude-fable', 'claude-opus-4-8', 'claude-3-5-sonnet', 'claude-opus-6', 'claude-haiku-10', 'claude-sonnet-9-1',
        'claude-opus-4-1-20250805', 'anthropic/claude-sonnet-5', 'gpt-5', 'gemini-3-pro', '', 'claude-x-4-9', 'claude-instant-1'];
    for (const name of names) assert.equal(isClaude5Plus(name), before(name), name);
    assert.match(read('src/live-models.js'), /export \{ isClaude5Plus \}/, 'live-models.js 는 같은 이름을 그대로 내보내요 (애드온들이 씀)');
});

await test('당겨 새로고침은 홈 화면에 깐 터치 앱에서만 받아요', async () => {
    notAtBoot('src/pull-to-refresh.js', 'PC · 브라우저 탭에서는 쓰지 않아요');
    const runtime = read('index.js');
    assert.match(runtime, /\['startPullToRefresh', \(\) => installedTouchMode\(window\) \? import\('\.\/src\/pull-to-refresh\.js'\) : Promise\.resolve\(null\), m => m\?\.startPullToRefresh\(/);   // 9.0.2 3층 표(IDLE_LAYER)
    const { installedTouchMode } = await import(pathToFileURL(path.join(root, 'src/device-layouts.js')).href);
    const mode = (coarse, standalone, touch = 5, legacy = false) => ({ navigator: { maxTouchPoints: touch, standalone: legacy }, matchMedia: q => ({ matches: q === '(pointer: coarse)' ? coarse : standalone }) });
    assert.equal(installedTouchMode(mode(true, true)), true);
    assert.equal(installedTouchMode(mode(true, false, 5, true)), true, '옛 iOS navigator.standalone');
    for (const w of [mode(false, true), mode(true, false), mode(true, true, 0)]) assert.equal(installedTouchMode(w), false);
    assert.match(read('src/pull-to-refresh.js'), /export \{ installedTouchMode \}/, '예전 이름도 그대로');
});

await test('스와이프 고르기 번역은 창을 여는 단추를 처음 누를 때 받아요', async () => {
    notAtBoot('src/swipe-picker-translation.js', '스와이프 고르기 창을 열 때만 써요');
    notAtBoot('src/addons/translator/translation-source.js', '번역 기록 읽기 — 번역 애드온 · 고르기 창이 쓸 때만');
    const launch = read('src/swipe-picker-launch.js'), full = read('src/swipe-picker-translation.js');
    const openers = text => /const OPENERS = '([^']+)'/.exec(text)?.[1];
    assert.equal(openers(launch), openers(full), '여는 단추 판정이 본 모듈과 같아요');
    assert.match(launch, /import\('\.\/swipe-picker-translation\.js'\)/);
    assert.match(full, /export function lookForPicker\(/);
    // 가짜 문서: 여는 단추를 누르면 본 모듈을 한 번만 받고 그 자리에서 창 찾기를 시작해요 · 다른 곳을 누르면 받지 않아요
    const listeners = {};
    class El { constructor(opener) { this.opener = opener; } closest(sel) { return this.opener && sel === openers(launch) ? this : null; } }
    globalThis.Element = El;
    globalThis.document = { addEventListener: (type, fn) => (listeners[type] ||= []).push(fn), querySelectorAll: () => [], body: {} };
    globalThis.SillyTavern = { getContext: () => ({ extensionSettings: { salty: { enabled: true } } }) };
    const mod = await import(pathToFileURL(path.join(root, 'src/swipe-picker-launch.js')).href + '?t=' + Date.now());
    let imported = 0;
    mod._forTest.setLoader(() => { imported++; return Promise.resolve({ lookForPicker: () => { mod._forTest.looked++; } }); });
    mod.startSwipePickerTranslation(); mod.startSwipePickerTranslation();
    assert.equal(listeners.pointerdown.length, 1, '한 번만 걸어요');
    for (const fn of listeners.pointerdown) fn({ type: 'pointerdown', target: new El(false) });
    await new Promise(r => setTimeout(r, 0));
    assert.equal(imported, 0, '다른 곳 누름에는 받지 않아요');
    for (const fn of listeners.pointerdown) fn({ type: 'pointerdown', target: new El(true) });
    for (const fn of listeners.click) fn({ type: 'click', target: new El(true) });
    await new Promise(r => setTimeout(r, 0));
    assert.equal(mod._forTest.looked, 2, '누를 때마다 창 찾기');
    assert.ok(imported >= 1);
    const runtime = read('index.js');
    assert.match(runtime, /\['startSwipePickerTranslation', \(\) => import\('\.\/src\/swipe-picker-launch\.js'\), m => \{ m\.startSwipePickerTranslation\(\); \}\]/);   // 9.0.2 3층 표(IDLE_LAYER)
});

await test('시작 그래프 크기 상한 (모듈 수 · 바이트)', () => {
    let bytes = 0; for (const rel of graph.keys()) bytes += fs.statSync(path.join(root, rel)).size;
    console.log(`  시작 그래프: 모듈 ${graph.size}개 · ${(bytes / 1024).toFixed(0)}KB`);
    // 10-30 기준 170b690f: 113개 · 1,372KB → 이 고침 뒤 111개 · 1,294KB. 새 기능은 꺼진 동안 동적 import 로 (features.js load 처럼)
    // 8.2.7 lean-perf: 성능 고침을 합친 판 111개 · 1,321KB — 감시자를 줄이려고 시작에 들어온 공용 감시자(dom-watch.js 13KB · perf-fade)와
    //   icon-text 미리 거르기(+5.6KB · perf-icon)가 각 분기에서는 상한 안이었는데 합치면 1KB 남짓 넘어 상한을 1,330KB 로 올려요(모듈 수 상한은 그대로)
    // 8.3.0 개인 확장 내장 틀(private-addons.js 표 · addons.js 대기 · 「옛 단독 확장 끄기」 · 플래그 이어받기 ≈ +9KB)로 1,340KB — 확장 본체는 동적 import 라 시작 그래프 밖(모듈 수 상한은 그대로)
    // 9.0.2 내려요: 9.0.1 끝 101개 · 1,075KB → 죽은 JS 걷기 94개 · 1,022KB → 부팅 3층(채팅 · 메뉴 모양 감시 · 켜 둔 기능 · 그리기 모듈은 2층, 누르거나 열어야 쓰는 것은 3층) 49개 · 617KB.
    //   새 모듈은 첫 화면(설정 읽기 · CSS 변수 · 글꼴 · 채팅 핵심 배치 · 한국어 표 · 요청 훅)에 꼭 필요할 때만 정적으로 — 아니면 index.js FRAME_LAYER · IDLE_LAYER 표나 features.js load 로
    assert.ok(graph.size <= 52, `모듈 ${graph.size}개`);
    // 1.0.0 극한 최적화 1단계(CSS 두 장 · 애드온 CSS 3층): lite.js · addons.js 에 미리 받기 · 붙이기 코드 +1.5KB 로 641KB — 상한을 645KB 로 두고, JS 단계(시작 그래프 줄이기)에서 다시 640KB 아래로 내려요
    // 1.0.0: 브라우저는 줄인 묶음(dist)을 받아요 — 실제 상한은 tools/tests/bundle-fresh.mjs 의 정적 묶음. 여기 원본 크기는 애드온 첫 장 표 몫만큼 655KB
    // 1.0.0 Salty.addon(id) 입구(addons.js 실행 모듈 표 · 검사 도구용 +1KB 남짓) — 657KB. 브라우저가 받는 양은 dist 묶음 시험(bundle-fresh.mjs)이 지켜요
    // 1.0.1 QR 줄 접기 단추(layout.js syncQrFold · 설정 두 칸 · +2KB) — 660KB
    // 1.0.2 블루레몬에이드 제로(usage-mode.js zeroMode · zeroView · ZERO_LOOK 와 index.js · features.js · apply.js 의 문 · +3.3KB) — 664KB.
    //   제로를 고르면 시작 때 받는 모듈이 165 → 68개로 줄어요(tools/tests/zero-mode.mjs)
    // 1.0.2 채팅 정리(기본 끔 — 기본값 한 줄 · features.js 문 세 줄 · ChatsPlus 감지 한 줄, 본체는 켤 때만 동적 import · +0.6KB) — 665KB
    // 1.0.3 QR 책장(기본 끔 — layout.js 책 단추 · 기본값 한 줄 · 같은 확장 감지 · +1.3KB, 창 · 계산 · CSS 는 처음 누를 때 받음) — 667KB
    // 1.0.3 편의 기능 6개(기본값 한 줄 · features.js 문 한 묶음 · 다른 확장 감지 한 줄 · 파일 지문 표 줄, 본체는 켤 때만 동적 import · +2.5KB 원본) — 667KB.
    //   브라우저가 받는 정적 묶음(dist)은 bundle-fresh.mjs 상한 안 그대로예요
    // 1.0.3 합침: 위 둘 + API 서버 상태(기본값 한 줄 · features.js 문 네 줄) + 확장 충돌 검사(설정 창 카드 · 명령 이름) + 청과 2.1X 사전 · 프롬프트 폴더 창을 한 사본에 모으면 670KB(686,053 바이트) — 671KB
    //   본체는 모두 켤 때 · 누를 때만 받는 동적 import 이고, 브라우저가 받는 정적 묶음은 bundle-fresh.mjs 상한 안이에요
    assert.ok(bytes <= 671 * 1024, `${bytes} 바이트`);
});

await test('9.0.2 부팅 2 · 3층 모듈은 시작 그래프 밖이에요 (첫 프레임 뒤 · 유휴 · 처음 쓸 때 받아요)', () => {
    const LATER = {
        'src/assets.js': '그림 분류 — 2층', 'src/icon-text.js': '아이콘 단추 표식 — 2층', 'src/selects.js': '고르기 팝업 — 2층', 'src/tone.js': '글자색 맞춤 — 2층',
        'src/streamfade.js': '스트리밍 페이드 — 2층', 'src/draft.js': '초안 — 2층', 'src/popup-guard.js': '안내 창 닫기 — 2층', 'src/typography.js': '조판 — 2층(features.js)',
        'src/control-ink.js': '단추 글자 세로 맞춤 — 2층(apply.js)', 'src/extension-colors.js': '확장 색 지키기 — 켤 때만', 'src/role-icons-pick.js': '단추 아이콘 바꾸기 — 바꾼 게 있을 때만',
        'src/tag-ink.js': '태그 글자색 — 2층', 'src/wi-help.js': '월드인포 도움말 — 3층', 'src/wi-help-data.js': '월드인포 도움말 사전 — 3층', 'src/longpress-help.js': '길게 누르기 — 3층',
        'src/websearch.js': '웹 검색 표시 — 3층(성능 보조가 쓰면 그때)', 'src/natural-slash.js': '자연 슬래시 — 3층', 'src/chat-graph-launcher.js': '채팅 지도 — 3층', 'src/promptlist.js': '프롬프트 목록 줄 — 3층',
        'src/tab-scroll.js': '탭 줄 스크롤 — 3층', 'src/marquee.js': '긴 이름 흐르기 — 3층', 'src/cardink.js': 'HTML 카드 글자색 — 2층', 'src/reading-resume.js': '읽던 자리 — 2층',
        'src/mes-pins.js': '메시지 버튼 고정 본체 — 2층(features.js) · 설정 정리는 mes-pins-keys.js 만',
    };
    for (const [rel, why] of Object.entries(LATER)) notAtBoot(rel, why);
    const index = read('index.js');
    for (const table of ['FRAME_LAYER', 'IDLE_LAYER', 'BOOT_FRAME', 'BOOT_IDLE']) assert.ok(index.includes(`const ${table} = [`), `${table} 표`);
    assert.match(index, /afterFirstFrame\(\(\) => withReplay\('테마 2층'/, '2층은 첫 프레임 뒤 · 늦게 붙은 리스너에 지금 채팅 한 번');
    assert.match(index, /whenIdle\('테마 3층', \(\) => withReplay\('테마 3층'/, '3층은 유휴');
    assert.match(index, /scheduleIdle\(\);\s*$/, '파일 끝에서 3층을 예약해요');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
