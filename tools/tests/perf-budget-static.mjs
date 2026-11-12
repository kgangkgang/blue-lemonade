// 1.1.4 성능 예산(정적) — 리그 없이 글 · 파일 크기만으로 지키는 상한이에요. 「지금 값에서 늘지 못하게」 잠그는 것이라, 값을 줄였으면 여기 상한도 같이 내려요(올릴 때는 까닭을 주석으로).
//   ① 첫 장 CSS(style.css) · 둘째 장(src/style-lazy.gen.css) 바이트, 첫 장의 :has( · backdrop-filter 수
//   ② 되풀이 타이머(setInterval) 자리 수 — 테마 본체 · 내장 스크립트 · 애드온 갈래별
//   ③ 감시: 허브 채팅 구독(#chat 안쪽을 보는 구독) · 허브 문서 구독 · 허브 구독 전체 수 (new MutationObserver 자리 상한은 observer-budget.mjs)
//   ④ 묶음(dist): 시작 때 바로 받는 정적 묶음 조각 수 · 바이트, 가장 큰 조각, 늦게 받는 글꾸 마트 사본 조각, dist 합계
//   ⑤ 유휴 폴링은 한 곳(src/frame-poll.js) · 진단 읽는 길(감시 허브 stats · 미리 그리기 · 메시지 꾸미기)이 남아 있어요
//   리그로 재는 예산(유휴 장면 · 구독별 시간 · 순정 대비)은 자동화 저장소의 perf-budget.json 몫이에요.
//   node tools/tests/perf-budget-static.mjs [저장소]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const size = rel => fs.statSync(path.join(root, rel)).size;
const count = (text, needle) => text.split(needle).length - 1;
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };
const within = (now, max, what) => { console.log(`   ${what}: ${now.toLocaleString('en-US')} / 상한 ${max.toLocaleString('en-US')}`); assert.ok(now <= max, `${what} ${now} > ${max} — 늘어났어요. 줄일 수 없으면 까닭을 적고 상한을 올려요`); };

// 1.1.4 시작 값(1.1.3 출시 후보 위 · 감사 고침 · 긴 채팅 2 · 유휴 타이머 정리 뒤)
const BUDGET = {
    firstSheetBytes: 713461,        // style.css — 1.1.2 · 1.1.3 과 같은 바이트
    secondSheetBytes: 1617973,      // src/style-lazy.gen.css
    firstSheetHas: 149,             // 첫 장의 ':has(' 글자 수
    firstSheetBackdrop: 18,         // 첫 장의 'backdrop-filter' 글자 수
    intervalsTheme: 7,              // 테마 본체(src/ 아래 · index.js) — 1.1.3 은 8(과일 글자 · 바로가기 폴링 둘 → frame-poll.js 하나)
    intervalsScripts: 5,            // 내장 스크립트(src/scripts/) — 진짜 타이머는 scheduler.js 하나로 모여요. 1.1.3 은 6(과일 상태창 한글 폴링이 frame-poll.js 로)
    intervalsAddons: 16,            // 애드온(src/addons/ · 묶어 온 vendor 3 포함)
    hubChatSubs: 11,                // #chat 안쪽을 보는 허브 구독
    hubDocumentSubs: 14,            // body · html 을 subtree 로 보는 허브 구독
    hubSubs: 53,                    // 허브 구독 자리 전체(세는 도구 tools/audit/observers.mjs 기준)
    staticChunks: 14,               // 지금 13
    staticBytes: 300 * 1024,        // 지금 297KB(304,145B) — bundle-fresh.mjs 의 330KB 보다 조여요
    largestChunkBytes: 700 * 1024,  // 지금 678,904B
    martChunkBytes: 125000,         // 1.1.4 「테마로 담기」 마트 사본 조각(src/log-copy-simple-set.js + src/geulkku-mart/ — 받은 심플 글꾸를 처음 그릴 때만 import()) · 지금 121,812B
    // dist 합계: 1.1.4 앞 상한 9,000,000B(그때 8,874,401B) + 위 마트 조각 상한. 체감 성능에 걸리는 것은 시작 묶음(위에서 그대로 잠금)이고, 합계는 모르게 불어나는 것을 막는 장치예요 —
    //   늦게 받는 마트 조각은 따로 상한을 걸어 그 구실을 지키고, 합계는 그만큼만 넓혀요(조정자 결정 11-12). 지금 9,051,989B(생성물 다시 만든 시험 빌드)
    distBytes: 9000000 + 125000,
};

test('① 첫 장 · 둘째 장 CSS 크기와 첫 장의 :has( · backdrop-filter 수가 늘지 않았어요', () => {
    const style = read('style.css');
    within(Buffer.byteLength(style), BUDGET.firstSheetBytes, '첫 장 style.css 바이트');
    within(size('src/style-lazy.gen.css'), BUDGET.secondSheetBytes, '둘째 장 style-lazy.gen.css 바이트');
    within(count(style, ':has('), BUDGET.firstSheetHas, '첫 장 :has( 수');
    within(count(style, 'backdrop-filter'), BUDGET.firstSheetBackdrop, '첫 장 backdrop-filter 수');
});

test('② 되풀이 타이머(setInterval) 자리가 늘지 않았어요 — 새로 필요하면 scheduler.js(가려짐 · 쉼에 멈춤)나 frame-poll.js 를 먼저 봐요', () => {
    const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    const files = ['index.js', ...fs.readdirSync(path.join(root, 'src'), { recursive: true }).map(String).filter(f => f.endsWith('.js') && !f.endsWith('.gen.js')).map(f => 'src/' + f.split(path.sep).join('/'))];
    const groups = { theme: [], scripts: [], addons: [] };
    for (const rel of files) {
        const n = (strip(read(rel)).match(/\bsetInterval\s*\(/g) || []).length;
        if (!n) continue;
        const g = rel.startsWith('src/addons/') ? 'addons' : rel.startsWith('src/scripts/') ? 'scripts' : 'theme';
        for (let i = 0; i < n; i++) groups[g].push(rel);
    }
    console.log('   테마 본체: ' + [...new Set(groups.theme)].join(' · '));
    within(groups.theme.length, BUDGET.intervalsTheme, '테마 본체 setInterval 자리');
    within(groups.scripts.length, BUDGET.intervalsScripts, '내장 스크립트 setInterval 자리');
    within(groups.addons.length, BUDGET.intervalsAddons, '애드온 setInterval 자리');
});

test('③ 감시 허브 구독 수(채팅 · 문서 · 전체)가 늘지 않았어요', () => {
    const tool = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'audit', 'observers.mjs');
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bl-budget-')), 'observers.json');
    const r = spawnSync(process.execPath, ['--expose-internals', '--no-warnings', tool, root, '--json', out], { cwd: root, encoding: 'utf8', env: { ...process.env, ACORN_PATH: '', ST_ROOT: '' } });
    assert.equal(r.status, 0, (r.stderr || r.stdout || '').slice(0, 400));
    const { summary } = JSON.parse(fs.readFileSync(out, 'utf8'));
    fs.rmSync(path.dirname(out), { recursive: true, force: true });
    within(summary.all.hubChat.length, BUDGET.hubChatSubs, '허브 채팅 구독(#chat 안쪽)');
    within(summary.all.hubDocument.length, BUDGET.hubDocumentSubs, '허브 문서 구독(body · html subtree)');
    within(summary.all.hubSites, BUDGET.hubSubs, '허브 구독 자리 전체');
});

test('④ 묶음(dist): 시작 정적 묶음 · 가장 큰 조각 · 합계가 상한 안이에요', () => {
    const dist = path.join(root, 'dist');
    const seen = new Set(); let bytes = 0;
    const walk = file => {
        if (seen.has(file)) return; seen.add(file);
        const text = fs.readFileSync(path.join(dist, file), 'utf8'); bytes += Buffer.byteLength(text);
        for (const m of text.matchAll(/(?:^|;|\})\s*import(?:[^"'()]*?from\s*)?["'](\.\/[^"']+)["']/g)) walk(m[1].slice(2));
    };
    walk('index.js');
    within(seen.size, BUDGET.staticChunks, '시작 정적 묶음 조각 수');
    within(bytes, BUDGET.staticBytes, '시작 정적 묶음 바이트');
    let total = 0, largest = 0, name = '';
    for (const f of fs.readdirSync(dist, { recursive: true }).map(String)) {
        const full = path.join(dist, f); const st = fs.statSync(full); if (!st.isFile()) continue;
        total += st.size;
        if (f.endsWith('.js') && st.size > largest) { largest = st.size; name = f; }
    }
    within(largest, BUDGET.largestChunkBytes, `가장 큰 조각(${name}) 바이트`);
    // 마트 사본 조각: 마트 모양 모듈의 저장 열쇠 글자로 찾아요(줄여도 남는 문자열) — 하나여야 하고 시작 묶음에 들면 안 돼요
    const mart = fs.readdirSync(dist).filter(f => f.endsWith('.js') && fs.readFileSync(path.join(dist, f), 'utf8').includes('bl-mart-shape-v1'));
    assert.equal(mart.length, 1, `마트 사본 조각은 하나여야 해요: ${mart.join(' · ') || '없음'}`);
    assert.ok(!seen.has(mart[0]), '마트 사본 조각이 시작 묶음에 들었어요 — import() 로만 받아야 해요');
    within(fs.statSync(path.join(dist, mart[0])).size, BUDGET.martChunkBytes, `늦게 받는 마트 사본 조각(${mart[0]}) 바이트`);
    within(total, BUDGET.distBytes, 'dist 합계 바이트');
});

test('⑤ 유휴 폴링은 한 곳 · 진단 읽는 길이 남아 있어요 · CI 등록', () => {
    assert.match(read('src/frame-poll.js'), /timer = host\.setInterval\(tick, FRAME_POLL_MS\)/, '과일 계열 폴링 타이머는 frame-poll.js 하나');
    assert.match(read('src/headswitch.js'), /const want = running && \(!drawer \|\| drawer\.classList\.contains\('openDrawer'\)\);/, '머리 스위치 타이머는 확장 서랍이 열렸을 때만');
    assert.match(read('src/dom-watch.js'), /h\.stats = \(\) => domWatchStats\(win\);/, '감시 허브 구독별 비용을 묶음 밖에서 읽는 길');
    assert.match(read('src/chat-light.js'), /Symbol\.for\('blue-lemonade\.diag\.v1'\)\] \?\?= \{\}\)\.warm = /, '미리 그리기 상태 읽는 길');
    assert.match(read('src/message-decor.js'), /Symbol\.for\('blue-lemonade\.diag\.v1'\)\] \?\?= \{\}\)\.decor = /, '메시지 꾸미기 통계 읽는 길');
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/perf-budget-static.mjs .'), 'release-check.yml 에 등록');
});

console.log(`perf-budget-static: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
