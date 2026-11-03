// 9.0.1 미리보기 전용 규칙 떼어 두기 — style.css 에는 설정 창 미리보기 전용 규칙이 하나도 없고 src/preview.gen.css 로만 가요.
//   · tools/css-park.cjs extract: 전용 규칙만 떼고(겉 @media · @supports 로 다시 싸서) 차례 · 규칙 수가 그대로, 빈 껍데기는 지워요
//   · 실제 빌드: style.css 에 전용 규칙 0개 · @media not all 0개, src/preview.gen.css 는 지금 css/ 로 만든 것과 같아요
//   · src/lite.js: 그 파일을 <link> 로 붙여 켜고 끄며(설정 창을 열 때만), 서랍 전용 <style> 은 그 뒤에 붙어요
//   · 폴백: 받기 전에는 표본 무대를 숨기고 안내 한 줄 — 숨기는 규칙은 style.css 에, 보이게 하는 규칙은 src/preview.gen.css 에
//   node tools/tests/preview-park.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const P = require(path.join(root, 'tools/css-park.cjs'));
const B = require(path.join(root, 'tools/build-css.cjs'));
const L = require(path.join(root, 'tools/css-lib.cjs'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// 1) 지어낸 시트로
const sample = [
    '.a{color:red}',
    '.salty-preview p{color:blue}',
    '.salty-sample q{margin:0}',
    '.b{color:green}',
    '@media (max-width: 1000px) {\n.c{padding:0}\n#salty-nochat .mes{display:none}\n}',
    '@media (pointer: coarse) {\n.salty-preview .y{gap:0}\n}',
    ':is(#chat .mes, .salty-preview .mes) .mes_text{color:pink}',
    '@supports (display:grid) {\n.salty-preview .x{display:grid}\n}',
].join('\n');
const r = P.extract(sample);
ok(r.rules === 5, `전용 규칙 5개 — ${r.rules}`);
ok(!/salty-preview p|salty-sample q|#salty-nochat|\.y\{|\.x\{/.test(r.text), '남은 시트에 전용 규칙이 없어요');
ok(r.text.includes(':is(#chat .mes, .salty-preview .mes) .mes_text'), '채팅과 나눠 쓰는 규칙은 남아요');
ok(!/@media \(pointer: coarse\)/.test(r.text) && !/@supports/.test(r.text), '다 떼어 낸 @media · @supports 껍데기는 지워요');
ok(r.text.includes('.c{padding:0}'), '같은 @media 안의 다른 규칙은 그대로');
const pv = L.parse(r.preview);
ok(!pv.problems.length, '떼어 낸 글을 다시 읽을 수 있어요');
ok(/@media \(max-width: 1000px\) \{\n#salty-nochat \.mes/.test(r.preview) && /@supports \(display:grid\) \{\n\.salty-preview \.x/.test(r.preview), '겉 조건으로 다시 싸요');
ok(r.preview.indexOf('.salty-preview p') < r.preview.indexOf('#salty-nochat .mes') && r.preview.indexOf('#salty-nochat .mes') < r.preview.indexOf('.salty-preview .x'), '원래 차례대로');

// 2) 실제 빌드
const css = read('style.css') + (fs.existsSync(path.join(root, 'src/style-lazy.gen.css')) ? read('src/style-lazy.gen.css') : '');   // 1.0.0 두 장 빌드: 24-previewbox 는 둘째 장
const tree = L.parse(css);
const left = L.flatRules(tree).filter(x => P.previewOnly(x.selector));
ok(left.length === 0, `style.css 에 미리보기 전용 규칙이 없어요 — ${left.length}개 (${left.slice(0, 2).map(x => x.selector.slice(0, 60)).join(' / ')})`);
ok(!/@media\s+not\s+all\s*\{/.test(css), 'style.css 에 꺼 둔 @media not all 덩어리가 없어요');
ok(!fs.existsSync(path.join(root, 'src/preview-park.gen.css')), '옛 한 벌(src/preview-park.gen.css)은 없어요');
const built = B.build();
ok(read('src/preview.gen.css') === built.preview, 'src/preview.gen.css 가 지금 css/ 로 만든 것과 같아요(node tools/build-css.cjs)');
const pvRules = L.flatRules(L.parse(built.preview));
ok(pvRules.length > 300 && pvRules.every(x => L.topSplit(x.selector).every(part => P.PREVIEW.test(part))), `src/preview.gen.css 는 갈래마다 미리보기 이름을 품어요(${pvRules.length}개 — 바구니 열쇠가 붙은 뒤라 글로만 봐요)`);

// 3) lite.js · index.js
const lite = read('src/lite.js'), index = read('index.js');
ok(/new URL\('\.\/preview\.gen\.css', import\.meta\.url\)/.test(lite), 'lite.js 가 src/preview.gen.css 를 받아요');
ok(/link\.rel = 'stylesheet'/.test(lite) && /link\.media = restored \? 'all' : 'not all'/.test(lite), '<link> 로 · 꺼진 채 미리 받을 수 있게');
ok(/function turnOn\(\) \{\s*restored = true;\s*preloadPreviewCss\(\)\.media = 'all';/.test(lite), '켤 때 <link> 의 media 만');
ok(/if \(previewLink\) previewLink\.media = 'not all';/.test(lite), '끌 때도 <link> 의 media 만');
ok(/sheet\.ownerNode\.after\(link\)/.test(read('src/split-css.js')), '전체 테마 시트는 첫 시트 바로 뒤(서랍 전용 <style> 앞)에 붙여요');
ok(/\(previewLink\?\.isConnected \? previewLink : sheetTail\(sheet\)\)\.after\(style\)/.test(lite), '서랍 전용 <style> 은 미리보기 <link> 뒤에');
ok(!/deferPreviewRules|collectParked|parkRule/.test(lite + index), '시작할 때 시트를 훑어 꺼 두는 코드는 없어요');
ok(/preloadPreviewCss\(\)/.test(index), '서랍 · ✦ 메뉴를 누르는 순간 미리 받아요');
ok(!/fetch\(|preview\.gen\.css['"`]/.test(index) && /for \(const type of \['pointerdown', 'click'\]\).*addEventListener\(type, \(\) => \{ loadPanel\(\)\.catch\(\(\) => \{\}\); preloadPreviewCss\(\);/.test(index), 'index.js 는 시작할 때 미리보기 CSS 를 받지 않고, 터치·키보드 활성화 순간에만 받아요');
const openerCode = index.split('\n').find(line => line.includes("for (const id of ['extensions-settings-button', 'extensionsMenuButton'])"));
const handlers = new Map(), opened = [];
new Function('document', 'loadPanel', 'preloadPreviewCss', 'loadSplitCss', 'kickIdle', 'startLateAddons', 'fireGate', openerCode)(
    { getElementById: id => ({ addEventListener: (type, fn) => handlers.set(id + ':' + type, fn) }) },
    () => { opened.push('panel'); return Promise.resolve(); }, () => opened.push('preview'), () => opened.push('css'),
    () => opened.push('idle'), () => opened.push('addons'), name => opened.push(name));
ok(opened.length === 0, '리스너 연결만으로 미리 받지 않아요');
for (const id of ['extensions-settings-button', 'extensionsMenuButton']) {
    opened.length = 0;
    handlers.get(id + ':click')();
    ok(opened.join(',') === 'panel,preview,css,idle,addons,drawer', `${id}: pointerdown 없는 키보드 click도 모든 처음 사용 경로를 열어요`);
}

// 4) 폴백
ok(/\.salty-prevbox > \[data-prev\] \{\s*visibility: hidden;/.test(css), 'style.css: 받기 전엔 표본 무대를 숨겨요');
ok(/\.salty-prevbox > \.bl-pv-wait \{/.test(css), 'style.css: 안내 한 줄 모양');
ok(/\[data-prev\][^{,]*\{[^}]*visibility:\s*visible/.test(built.preview) && /bl-pv-wait[^{]*\{[^}]*display:\s*none/.test(built.preview), 'src/preview.gen.css: 받으면 무대가 보이고 안내가 숨어요');
ok(/className: 'bl-pv-wait'/.test(read('src/panel.js')), 'panel.js 가 무대 뒤에 안내를 붙여요');

console.log(`preview-park: ${n}/${n} 통과`);
