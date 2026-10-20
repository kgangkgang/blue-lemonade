// 7.2.6 설정 창 › 테마 › 자주 묻는 질문 (src/faq-data.js · src/panel.js faqMarkup/faqAction · src/settings-search.js)
//   항목 13개 (7.2.9 사용자 · 커뮤니티 제보 5개 더) · 단추는 panel.js 가 아는 동작만 · 상태 글도 아는 이름만 · 질문 글로 설정 검색에 잡힘 · 확장 탭 안내의 단추 · 사이트에도 같은 질문
//   node tools/tests/faq.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const url = rel => pathToFileURL(path.join(root, rel)).href;
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { FAQ } = await import(url('src/faq-data.js'));
const S = await import(url('src/settings-search.js'));
const panel = read('src/panel.js');
const ACTIONS = ['usage-mode', 'mute-css', 'enable', 'open-addons', 'open-update', 'diag-copy', 'open-cutedge'];
const STATUS = ['usage-mode', 'other-css', 'enabled', 'quiet-notes', 'addons', 'version'];

await test('항목 13개 — 질문 · 답(해요체 문단) · 검색 말 · 고유 id', () => {
    assert.equal(FAQ.length, 13);
    const ids = new Set();
    for (const item of FAQ) {
        assert.ok(item.id && !ids.has(item.id), 'id ' + item.id); ids.add(item.id);
        assert.ok(item.q.length >= 8 && item.q.length <= 40, item.q);
        assert.ok(Array.isArray(item.a) && item.a.length >= 1 && item.a.length <= 4, item.q + ' 답');
        for (const p of item.a) assert.match(p, /(?:요|예요|돼요|해요|어요|세요|에요)\.?$/, item.q + ' 해요체: ' + p);
        assert.ok(typeof item.search === 'string' && item.search.length > 10, item.q + ' 검색 말');
        assert.ok(item.readme, item.q + ' README 절');
    }
    assert.deepEqual(FAQ.map(x => x.q), ['이게 테마예요, 기본 테마에 얹는 거예요?', '글자가 깨지거나 겹쳐요', '「확장만」으로 했는데 확장이 안 켜져요', '처음 켰더니 「쓰던 테마가 있어요」 창이 떠요', '캐릭터 에셋 단추가 폰에서 안 눌려요', '번역 · TTS 가 안 돼요', 'TTS 가 들은 답을 또 분석해요', '북마크에 생각(추론)이 보여요', '에셋 그림이 본문에 들어가 토큰을 먹나요?', '어두운 화면에서 투명 그림의 검은 옷이 묻혀요', '일코 테마 확장이랑 같이 쓰려면?', '업데이트는 어떻게 해요?', '제보할 때 뭘 붙이면 돼요?']);
});
await test('단추: 데이터의 action 은 panel.js faqAction 이 아는 이름뿐 · 13개 중 11개에 단추 · 각 단추는 기존 기능을 부른다', () => {
    const withButton = FAQ.filter(x => x.action);
    assert.equal(withButton.length, 11);
    for (const item of withButton) {
        assert.ok(ACTIONS.includes(item.action), item.action);
        assert.ok(item.label, item.q + ' 단추 글');
        assert.ok(panel.includes(`case '${item.action}':`), 'panel.js case ' + item.action);
    }
    assert.deepEqual(withButton.map(x => [x.id, x.action, x.label]), [['what', 'usage-mode', '사용 모드 바꾸기'], ['broken', 'mute-css', '다른 CSS 끄기'], ['ext-off', 'enable', '블루레몬에이드 사용 켜기'], ['first-run', 'usage-mode', '사용 모드 바꾸기'], ['asset-buttons', 'open-update', '업데이트 탭 열기'], ['tts', 'open-addons', '애드온 탭 열기'], ['tts-again', 'open-update', '업데이트 탭 열기'], ['bookmark-thoughts', 'open-update', '업데이트 탭 열기'], ['cutout-dark', 'open-cutedge', '투명 그림 설정 열기'], ['update', 'open-update', '업데이트 탭 열기'], ['report', 'diag-copy', '진단 복사']]);
    // 같은 저장값: 커스텀 CSS 끄기 스위치(compat.muteCustomCss) · 맨 아래 스위치(enabled) · 진단 복사(buildDiagnosis) · 사용 모드(data-usage-mode) · 업데이트 탭
    assert.match(panel, /case 'mute-css':[\s\S]{0,400}update\(st => \{ st\.compat\.muteCustomCss = true; \}\);/);
    assert.match(panel, /case 'enable':[\s\S]{0,400}update\(st => \{ st\.enabled = true; \}\);[\s\S]{0,80}await syncChangedAddons\(\['enabled'\]\);/);
    assert.match(panel, /case 'diag-copy': await copyDiagnosis\(\); break;/);
    assert.match(panel, /async function copyDiagnosis\(\) \{\s*const text = await buildDiagnosis\(\);/);
    assert.match(panel, /case 'usage-mode': \{[\s\S]{0,300}faqRoute\(root, 'theme', 'etc'\);[\s\S]{0,200}details\.bl-usage-mode/);
    assert.match(panel, /case 'open-update': faqRoute\(root, 'theme', 'update'\); break;/);
    assert.match(panel, /case 'open-addons': faqRoute\(root, 'extensions', ''\); break;/);
    assert.match(panel, /case 'open-cutedge': faqRoute\(root, 'image', 'cutedge'\); break;/);
    assert.ok(panel.includes("row('커스텀 CSS 끄기', toggle('compat.muteCustomCss'") && panel.includes("toggle('enabled', s.enabled)"), '원래 스위치가 그대로 있다');
});
await test('상태 글: status 는 faqStatus 가 아는 이름뿐 (지금 다른 CSS 수 · 사용 모드 · 스위치 · 애드온 · 판)', () => {
    for (const item of FAQ.filter(x => x.status)) { assert.ok(STATUS.includes(item.status), item.status); assert.ok(panel.includes(`key === '${item.status}'`), 'faqStatus ' + item.status); }
    assert.match(panel, /if \(key === 'other-css'\) \{ const r = otherCssReport\(s\);[\s\S]{0,120}다른 CSS \$\{r\.on\}개 켬/);
});
await test('설정 창: 테마 탭의 「자주 묻는 질문」 소분류 · faqMarkup 이 접기 카드 · 「지금」 줄 · 단추 · README 링크를 그린다', () => {
    assert.match(panel, /\['etc', '기타 설정'\], \['faq', '자주 묻는 질문'\]\],/);
    assert.match(panel, /if \(sub === 'faq'\) return faqMarkup\(s\);/);
    assert.match(panel, /<details class="bl-faq-item" data-md-fold="faq:\$\{esc\(item\.id\)\}"><summary data-search-anchor="\$\{esc\(item\.q\)\}">/);
    assert.match(panel, /<p class="bl-faq-status"><b>지금<\/b> \$\{esc\(status\)\}<\/p>/);
    assert.match(panel, /class="bl-faq-readme" href="\$\{FAQ_README\}" target="_blank" rel="noopener">README 에서 「\$\{esc\(item\.readme\)\}」 찾아보기/);
    assert.ok(read('css/83-faq.css').startsWith('/* ===== css/83-faq.css'));
    assert.ok(read('style.css').includes('.salty-panel .bl-faq-item'), 'style.css 빌드에 들어감');
});
await test('확장 탭 안내: 스위치가 꺼졌으면 「블루레몬에이드 사용 켜기」 · 「테마만」이면 「사용 모드 바꾸러 가기」 단추 (같은 faq 동작)', () => {
    const fn = panel.slice(panel.indexOf('function tabExtensions('), panel.indexOf('function tabExtensions(') + 1400);
    assert.match(fn, /스위치가 꺼져 있어서[\s\S]{0,400}data-act="faq" data-faq="enable">블루레몬에이드 사용 켜기<\/button>/);
    assert.match(fn, /「테마만」이라[\s\S]{0,400}data-act="faq" data-faq="usage-mode">사용 모드 바꾸러 가기<\/button>/);
});
await test('검색: 질문 글 · 사용자 말투로 치면 그 항목이 맨 위 (테마 › 자주 묻는 질문)', () => {
    for (const item of FAQ) {
        const top = S.searchSettings(item.q)[0];
        assert.ok(top && top.title === item.q && top.tab === 'theme' && top.sub === 'faq' && top.anchor === item.q, item.q + ' → ' + top?.title);
    }
    for (const [q, id] of [['글자가 깨져', 'broken'], ['확장이 안 켜져', 'ext-off'], ['이게 테마', 'what'], ['일코', 'quiet'], ['업데이트 어떻게', 'update'], ['제보', 'report'], ['자주 묻는 질문', 'what'], ['쓰던 테마가 있어요', 'first-run'], ['단추가 안 눌려', 'asset-buttons'], ['요술봉 안 눌려', 'asset-buttons'], ['또 분석해요', 'tts-again'], ['북마크 생각', 'bookmark-thoughts'], ['토큰 먹나요', 'asset-tokens'], ['검은 옷이 묻혀요', 'cutout-dark']]) {
        const titles = S.searchSettings(q).slice(0, 3).map(e => e.title);
        assert.ok(titles.includes(FAQ.find(x => x.id === id).q), q + ' → ' + titles.join(' | '));
    }
    assert.equal(S.searchSettings('번역 안 됨').slice(0, 3).map(e => e.sub).filter(x => x === 'faq').length, 1, '번역 안 됨 → 번역 · TTS 항목이 셋 안에');
    assert.match(read('src/settings-search.js'), /for \(const item of FAQ\) rows\.push\(\['theme','faq',item\.q,/);
});
await test('사이트: 같은 질문 13개가 소개 사이트의 「자주 묻는 질문」 절에 (docs/ = gh-pages, 있을 때만)', () => {
    const site = path.join(root, 'docs/index.html');
    if (!fs.existsSync(site)) { console.log('       (docs/index.html 없음 — 건너뜀)'); return; }
    const html = fs.readFileSync(site, 'utf8');
    // 릴리스 이벤트 CI 는 사이트(gh-pages)가 올라가기 전에 돌 수 있다 — 절이 있을 때만 모든 질문이 다 있는지 본다
    if (!html.includes('id="faq"')) { console.log('       (docs/index.html 에 아직 자주 묻는 질문 절 없음 — 건너뜀)'); return; }
    for (const item of FAQ) assert.ok(html.includes(`<summary>${item.q}</summary>`), '사이트에 ' + item.q);
});
await test('연결: CI 목록에 이 시험', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/faq\.mjs \./);
});

console.log(`faq: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
