// CSS 두 장(1.0.0 부터 기본 — 9.0.1 --split 준비를 켬): style.css(첫 화면) + src/style-lazy.gen.css(첫 화면에 안 쓰는 모듈 · SPLIT_LAZY)
//   · 둘째 파일은 원래 모듈 순서 전체예요. 첫 파일을 끄고 교체하므로 같은 규칙을 중복 적용하지 않아요.
//   · 미리보기 시트(src/preview.gen.css) · 호환 시트(src/compat-*.gen.css) · 서랍 전용 꼬리(src/lazy-panel.gen.css)는 한 장 빌드와 글자까지 같아요(차례 보존)
//   · 첫 장 맨 앞 :root 에 표시 변수(--bl-css-split:1) · src/lite.js 는 그 변수가 있을 때만 둘째 장을 테마 시트 바로 뒤에 붙여요(첫 프레임 뒤 미리 받기 · 덮개 걷힌 뒤 쉴 때 · 서랍 · 메뉴 누를 때)
//   · 확장만 · 테마 끔용 가벼운 사본(style-ext.css)은 두 장의 몫을 다 담고, src/theme-sheet.js 가 둘째 장도 같이 켜고 꺼요
//   node tools/tests/css-split.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const B = require(path.join(root, 'tools/build-css.cjs'));
const L = require(path.join(root, 'tools/css-lib.cjs'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const one = B.build(B.CSS_DIR, { split: false });
const two = B.build(B.CSS_DIR, { split: true });
const hydrate = (text, output) => text.replace(/@media not all \{#bl-dem-slot-([\w-]+)\{--bl-dem-slot:0\}\}/g, (_, id) => {
    assert.ok(output.dem.slots[id], `분리 내용에 ${id}가 있어요`);
    return output.dem.slots[id].rules.join('\n');
});
// 1.1.6 두 장 빌드는 켜짐 · 설정 창 규칙을 첫 장 · 전체 장 둘 다에서 떼어 작은 시트로 둬요(tools/css-gates.cjs) — 한 장 빌드에서 같은 규칙을 지운 것과 견줘요.
//   뗀 규칙이 제자리였을 때와 차례가 바뀌어도 덮어쓰기가 같은지는 tools/tests/css-gates-order.mjs 가 봐요
const G = require(path.join(root, 'tools/css-gates.cjs'));
const oneAll = hydrate(one.text, one);
const oneReady = two.gates ? G.strip(oneAll, two.gates.moved).text : oneAll, twoReady = hydrate(two.lazyText, two);
ok(one.gates === null && two.gates && two.gates.moved.size > 0, '두 장 빌드만 규칙을 떼요');
ok(one.lazyText === null, '--one 빌드는 한 장');
ok(!one.text.includes('--bl-css-split'), '한 장 빌드에는 표시 변수가 없어요');
ok(typeof two.lazyText === 'string' && /^:root\{--bl-css-split:1[;}]/m.test(two.text), '두 장이면 첫 장 맨 앞 :root 에 표시 변수(같은 규칙에 호환 시트 표식도)');
ok(read('style.css') === two.text, 'style.css 는 두 장 빌드의 첫 장 그대로(기본)');
ok(read('src/style-lazy.gen.css') === two.lazyText, 'src/style-lazy.gen.css 는 둘째 장 그대로');
ok(read('style-ext.css') === B.extText(two.text, two.lazyText), 'style-ext.css 는 두 장의 몫을 다 담아요');
ok(read('src/dem-style-data.gen.js') === two.dem.data, '데우스 분리 내용도 같은 빌드예요');
ok(read('src/dem-style-data.fallback.gen.css') === two.dem.fallback, '데우스 대체 파일도 같은 빌드예요');
const metadata = new Set(['--bl-css-split', '--bl-dem-style-key']);
const sig = text => L.flatRules(L.parse(text)).map(r => `${r.ctx.join(' / ')} || ${r.selector} { ${r.decls.filter(d => !metadata.has(d.lname)).map(d => `${d.lname}:${d.value}${d.important ? '!' : ''}`).join(';')} }`).filter(s => !/^ \|\| :root \{ \}$/.test(s));
const a = sig(oneReady), b = sig(twoReady);
ok(a.length === b.length, `규칙 수 같음 — 한 장 ${a.length} · 두 장 ${b.length}`);
ok(a.every((x, i) => x === b[i]), '전체 교체 시트의 규칙과 순서가 한 장 빌드와 같아요(정렬해서 차이를 숨기지 않아요)');
const winners = text => { const out=new Map(); for(const r of L.flatRules(L.parse(text))) for(const s of L.topSplit(r.selector)) for(const d of r.decls) if(!metadata.has(d.lname)) out.set(JSON.stringify([r.ctx,s,d.lname,d.important]),d.value); return [...out].sort(([a],[b])=>a.localeCompare(b)); };
assert.deepEqual(winners(twoReady),winners(oneReady),'같은 선택자·조건·중요도의 마지막 승리값이 같아요');n++;
ok(B.lazyTail(two.lazyText) === B.lazyTail(one.text), '전체 파일은99꼬리도 보존해서 별도 꼬리 받기 실패를 복구해요');
assert.throws(()=>B.assertInlineSafe('.a{background:url(../a.png)}'),/상대 URL/);n++;
assert.throws(()=>B.assertInlineSafe('@import "x.css";'),/@import/);n++;
ok(!/@import\b|@font-face\b/.test(two.lazyText),'현재 교체 시트에는 주소 기준이 필요한 import/font-face가 없어요');
ok((two.lazyText.match(/@property\b/g)||[]).length===(one.text.match(/@property\b/g)||[]).length,'property 등록은 그대로예요');
ok(two.text.trimEnd().length < one.text.trimEnd().length, '첫 장이 더 작아요');
const noHead = s => s.split('\n').slice(1).join('\n');   // 머리 주석 한 줄(build 해시)만 달라요
ok(noHead(one.preview) === noHead(two.preview) && noHead(one.compatBrowser) === noHead(two.compatBrowser) && noHead(one.compatWidth) === noHead(two.compatWidth), '미리보기 · 호환 시트는 한 장 빌드와 같아요(차례 보존)');
ok(B.lazyTail(one.text) === B.lazyTail(two.text), '서랍 전용 꼬리는 같아요');
const lazyIdx = two.text.lastIndexOf('#salty-lazy-panel-start {}');
ok(lazyIdx > 0 && two.lazyText.includes('#salty-lazy-panel-start'), '첫 시트와 전체 시트 모두99꼬리 원본을 보존하고 실제로는 한 벌만 켜요');
for (const name of B.SPLIT_LAZY) ok(fs.existsSync(path.join(root, 'css', name)), `나눌 모듈이 있어요: ${name}`);
// 첫 화면(채팅 · 입력판 · 서랍 겉 · 메뉴)과 덮개가 걷히자마자 쓰는 것은 첫 장에 남아요
for (const name of ['00-base.css', '03-menus.css', '04-send-form.css', '05-chat.css', '06-chat-text.css', '07-images.css', '11-chrome.css', '30-dem-skin.css', '32-weather.css', '35-qr-bar.css', '61-markdown.css', '69-websearch.css', '70-sync-update-diag.css', '72-pick.css', '77-scrollbars.css', '99-lazy-panel.css'])
    ok(!B.SPLIT_LAZY.has(name), `첫 장에 남아요: ${name}`);

const lite = read('src/lite.js'), index = read('index.js'), sheet = read('src/theme-sheet.js'), loader = read('src/split-css.js');
ok(/preloadPreviewCss\(\); loadSplitCss\(\); kickIdle\('서랍'\);/.test(index), '확장 서랍 · ✦ 메뉴를 누르는 순간 둘째 장도 당겨요 (부팅 3층과 같이)');
ok(/for \(const type of \['pointerdown', 'click'\]\) document\.getElementById\('top-settings-holder'\)\?\.addEventListener\(type, e => \{ if \(booting\(\)\) return; loadSplitCss\(\); kickIdle\('서랍'\); startLateAddons\('상단 서랍'\); fireGate\('drawer'\); \}/.test(index), '상단 서랍 아이콘을 누르는 순간(키보드 click 도 · 시작 덮개 뒤)에 둘째 장 · 3층 · 늦은 애드온 · 문 drawer');
ok(/getPropertyValue\('--bl-css-split'\)\.trim\(\) !== '1'\) return null;/.test(lite), 'lite.js 는 표시 변수가 있을 때만 붙여요');
ok(/link\.id = 'salty-lazy-css';[\s\S]*?sheet\.ownerNode\.after\(link\);/.test(loader) && /import\('\.\/split-css\.js'\)/.test(lite), '첫 사용 때 별도 로더를 받아 테마 시트 바로 뒤에');
ok(/afterBoot\(\(\) => Promise\.resolve\(after\)/.test(lite) && /requestIdleCallback\(fn, \{ timeout: 4000 \}\)/.test(lite) && /if \(want && !booting\(\) && !document\.getElementById\('salty-lazy-css'\) && document\.querySelector\(LAZY_OPENERS\)\) \{ try \{ loadSplitCss\(\); \}/.test(lite), '3층 뒤 쉴 때 붙이고, 그 전에 서랍 · 팝업이 열리면 그때 붙여요(11-03 퇴행 고침)');
ok(/scheduleSplitCss\(\{ after: idleReady, then: warmDrawers \}\)/.test(index) && /const warmDrawers = \(\) => \{ fireGate\('drawer', \{ cascade: false \}\); idleLater\(\(\) => \{ startLateAddons\('쉴 때'\); idleLater\(\(\) => \{ fireGate\('press'\); idleLater\(\(\) => \{ loadRemainingFaces\(\); \}\); \}\); \}\); \}/.test(index), 'index.js: 3층 뒤 · 둘째 장 다음에 서랍 문 → 늦은 애드온 → 누름 문 → 남은 글꼴 조각 차례로(쉴 때)');
ok(/startSafe\('scheduleSplitCss'/.test(index), 'index.js 가 예약해요');
ok(/salty-lazy-css/.test(sheet) && /setLazy\(true\)/.test(sheet) && /setLazy\(false\)/.test(sheet), '확장만 · 테마 끔에서 둘째 장도 같이 끄고 켜요');
ok(/node tools\/tests\/css-split\.mjs \./.test(read('.github/workflows/release-check.yml')), 'CI 에 이 시험');
console.log(`css-split: ${n}/${n} 통과`);
