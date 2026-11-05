// 1.0.0 바탕: 9.0.0 정리에서 걷었던 공지 창 · 출처 창 · 판 알약 · 새 판 확인을 되살린 것을 지켜요.
//   - 안 본 공지 판정은 (계열, 판) 짝: 저장값 「8.2.4」(계열 1) 뒤의 1.0.0(계열 2)은 새 공지, 본 값은 「s2:1.0.0」으로 저장
//   - 모두 시작 그래프 밖(3층 · 누를 때) — index.js 정적 import 로 닿지 않아요
//   - 출처 고지: 출처 창 · 애드온 카드 꼬리 · 한글화 패널 장 · README 절 (전개 지시 · 캐릭터 에셋의 「출처 명시」 조건)
//   - 공지 데이터: 맨 앞 판 = manifest, 감사 · 팬 · 공유봇 말투는 부록 대체 문장으로
//   node tools/tests/notice-credits-restore.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const mod = rel => pathToFileURL(path.join(root, rel)).href;
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ---- 흉내: 실리태번 컨텍스트 · 문서 (getExtensionManifest 로 판을 읽어요)
let MANIFEST = { version: '1.0.0', bl_series: 2 };
const ctx = { extensionSettings: {}, saveSettingsDebounced() {}, powerUserSettings: {}, getExtensionManifest: () => MANIFEST };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.document = { querySelectorAll: () => [], querySelector: () => null, addEventListener() {} };

await test('안 본 공지: 1.0.0(계열 2)은 저장값 8.2.4 · 8.2.5 · 9.9.9(계열 1)보다 새 판 · 본 값은 s2:1.0.0', async () => {
    const N = await import(mod('src/notice.js'));
    const { getSettings } = await import(mod('src/settings.js'));
    assert.equal(await N.loadVersion(), '1.0.0');
    assert.equal(N.currentVersion(), '1.0.0');
    assert.equal(N.currentRelease(), 's2:1.0.0');
    for (const seen of ['', '8.2.4', '8.2.5', '9.9.9']) { getSettings().noticeSeen = seen; assert.equal(N.hasUnseenNotice(), true, seen || '(빈 값)'); }
    for (const seen of ['s2:1.0.0', 's2:1.0.1']) { getSettings().noticeSeen = seen; assert.equal(N.hasUnseenNotice(), false, seen); }
    assert.ok(N.currentRelease().length <= 20, '설정 noticeSeen 은 20자까지 저장');
});

// 정적 import 그래프 (boot-graph.mjs 와 같은 길)
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '$1');
const STATIC = /(?:^|[\n;])\s*(?:import|export)\s+(?:[^'"();]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
function graph(entry) {
    const seen = new Set();
    const walk = rel => {
        if (seen.has(rel) || !fs.existsSync(path.join(root, rel))) return;
        seen.add(rel);
        for (const m of strip(read(rel)).matchAll(STATIC)) {
            const next = path.relative(root, path.resolve(path.dirname(path.join(root, rel)), m[1])).split(path.sep).join('/');
            if (!next.startsWith('..')) walk(next);
        }
    };
    walk(entry);
    return seen;
}
await test('시작 그래프 밖: 공지 · 공지 데이터 · 출처 창 · 판 알약 · 새 판 확인은 index.js 정적 import 로 닿지 않아요', () => {
    const g = graph('index.js');
    for (const f of ['src/notice.js', 'src/notice-data.js', 'src/notice-actions.js', 'src/credits.js', 'src/version-pill.js', 'src/update-check.js', 'src/version-series.js']) assert.ok(!g.has(f), f);
    const index = read('index.js');
    assert.match(index, /\['startVersionPill', \(\) => import\('\.\/src\/version-pill\.js'\)/, '판 알약은 3층(BOOT_IDLE)');
    assert.ok(index.indexOf("['startVersionPill'") > index.indexOf('const BOOT_IDLE'), 'BOOT_IDLE 안');   // (제로 목록 ZERO_START 의 이름은 표 칸이 아니라 빼요)
    assert.match(read('src/notice.js'), /import\('\.\/notice-data\.js'\)/, '공지 데이터는 창을 열 때');
    assert.match(read('src/version-pill.js'), /import\('\.\/update-check\.js'\)/);
    assert.match(read('src/version-pill.js'), /import\('\.\/credits\.js'\)/);
});

await test('판 알약 · ⓒ: 서랍 머리와 설정 창 제목 · 자동 확인 스위치(기타 설정)', () => {
    const pill = read('src/version-pill.js'), panel = read('src/panel.js');
    assert.match(pill, /bl-version ext-version/);
    assert.match(pill, /data-bl-credits/);
    assert.match(panel, /Blue Lemonade\$\{titleBadgesHtml\(\)\}/);
    assert.match(panel, /toggle\('updateCheck'/);
    assert.match(read('src/settings-labels.js'), /'updateCheck':'새 버전 자동 확인'/);
    assert.match(read('src/update-check.js'), /compareRelease\(/, '새 판 비교는 계열 짝');
    assert.doesNotMatch(read('src/update-check.js'), /compareVersions/);
});

await test('출처 창: 기반 · 번역 · 패널 · 리모컨 · 전개 지시 · 에셋 · Mermaid · 헬퍼 · 라이브러리, CTSI · 프롬프트 템플릿 칸은 그 기능 폴더가 있을 때만', () => {
    const c = read('src/credits.js');
    for (const s of ['Moonlit Echoes Theme', 'LLM Translator', 'Prompt Panel', '번역 리모컨', 'Direction Manager', 'Character Assets', 'Mermaid', 'PolyForm Noncommercial', 'omggif', 'image-q', '출처 명시']) assert.ok(c.includes(s), s);
    // 1.0.0 되살림(revive-1001): 기능을 되살리면 출처 칸도 함께 — 폴더가 있으면 꼭 있고, 없으면 없어야 해요
    for (const [s, dir] of [['CustomThemeStyleInputs', 'src/addons/customstyle'], ['ST-Prompt-Template', 'src/addons/prompt-template']]) assert.equal(c.includes(s), fs.existsSync(path.join(root, dir)), s);
    assert.match(c, /local\('LICENSE'\)/, '라이선스 전문은 설치된 파일로');
    assert.match(read('src/repo.js'), /export const REPO = /);
});

await test('애드온 카드 꼬리 출처 줄 · 한글화 패널 출처 장', () => {
    const a = read('src/addons.js'), c = read('src/addon-credits.js');
    for (const id of ['direction', 'assets', 'translator', 'prompt', 'mermaid']) assert.match(c, new RegExp(`${id}:\\['`), id);
    assert.match(a, /\$\{credit\}<\/div>`;/, '카드 끝에 출처 줄');
    assert.match(c, /ttsCreditsSummaryHtml\(\)/);
    assert.match(read('src/panel.js'), /setAddonCredits\(addonCreditHtml\);/, '설정 창이 출처 표를 넘겨요');
    assert.ok(!graph('index.js').has('src/addon-credits.js') && !graph('index.js').has('src/addons/tts/credits.js'), '출처 표는 시작 그래프 밖');
    assert.match(read('src/addons/prompt/guide.js'), /\['출처 · 수정 · 라이선스'/);
});

await test('README 「라이선스 · 출처」 절 · 변경 이력은 CHANGELOG.md 에 1.0.0 부터(옛 이력은 공지 데이터) · 자주 묻는 질문 절 없음', () => {
    const r = read('README.md');
    assert.match(r, /^## 라이선스 · 출처$/m);
    assert.match(r, /\]\(LICENSE\)/);
    assert.match(r, /\]\(THIRD-PARTY-NOTICES\.md\)/);
    assert.doesNotMatch(r, /<summary>8\.2\.4 /, '옛 변경 이력은 README 에 없음');
    assert.doesNotMatch(r, /^## 자주 묻는 질문/m);
    // 1.0.0 후보: 변경 이력은 CHANGELOG.md 하나에만(README 는 설치 · 업데이트 · 라이선스 · 출처 링크)
    assert.doesNotMatch(r, /^## 변경 이력/m, 'README 에 변경 이력 절 없음');
    assert.match(r, /\]\(CHANGELOG\.md\)/);
    const log = read('CHANGELOG.md');
    assert.match(log, /^# 변경 이력$/m);
    assert.match(log, /1\.0\.0 부터/);
    assert.doesNotMatch(log, /<summary>8\.2\.4 /, '옛 변경 이력은 CHANGELOG 에도 없음');
});

await test('공지 데이터: 맨 앞 판 · 계열 = manifest · 감사 · 팬 · 공유봇 말투 없음', () => {
    const data = read('src/notice-data.js'), manifest = JSON.parse(read('manifest.json'));
    const head = data.match(/NOTICES\s*=\s*\[\s*\{([^{}[]*)/)?.[1] || '';
    assert.equal(head.match(/"version"\s*:\s*"([^"]+)"/)?.[1], manifest.version);
    assert.equal(Number(head.match(/"series"\s*:\s*(\d+)/)?.[1] || 1), manifest.bl_series || 1);
    for (const s of ['팬이 만들어', '고마워', '💙', '흔쾌', '공유봇', '제보에 대한 조치', '그동안 제보로', '사용자의 ▲']) assert.ok(!data.includes(s), s);
    assert.ok(data.includes('원작자의 허락을 받아 번역 애드온에 넣었어요'), '원작 허락 근거는 남김');
});

console.log(`\nnotice-credits-restore: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
