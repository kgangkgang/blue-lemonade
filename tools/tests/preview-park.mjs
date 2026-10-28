// 10-28: 미리보기 전용 덩어리 한 벌(src/preview-park.gen.css) — style.css 의 `@media not all` 미리보기 덩어리와 하나씩 같은 글 · 같은 겉 조건 · 같은 차례인가,
//   그리고 src/lite.js 가 그 파일을 꺼 둔 <style> 로 붙여 켜고 끄는가(제자리 mediaText 를 바꾸지 않는가)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const B = require(path.join(root, 'tools/build-css.cjs'));
const L = require(path.join(root, 'tools/css-lib.cjs'));
const PREVIEW = /#salty-nochat|\.salty-preview|\.salty-sample/;
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// 1) 지어낸 시트로: 맨 위 덩어리 · @media 안 덩어리 · 미리보기 아닌 not all 덩어리(빠져야 함)
const sample = [
    '.a{color:red}',
    '@media not all {\n.salty-preview p{color:blue}\n.salty-sample q{margin:0}\n}',
    '.b{color:green}',
    '@media (max-width: 1000px) {\n.c{padding:0}\n@media not all {\n#salty-nochat .mes{display:none}\n}\n}',
    '@media not all {\n.other{color:pink}\n}',
    '@supports (display:grid) {\n@media not all {\n.salty-preview .x{display:grid}\n}\n}',
].join('\n');
const gen = B.previewParkText(sample);
const t = L.parse(gen); ok(!t.problems.length, '만든 글을 다시 읽을 수 있어요');
const top = t.children.filter(c => c.type === 'at');
ok(top.length === 3, `덩어리 3개(미리보기 아닌 것 빠짐) — ${top.length}`);
ok(/^@media all$/.test(top[0].prelude) && gen.includes('.salty-preview p{color:blue}\n.salty-sample q{margin:0}'), '맨 위 덩어리는 @media all 로 싸고 안쪽 글 그대로');
ok(top[1].prelude === '@media (max-width: 1000px)' && top[1].children.length === 1 && top[1].children[0].prelude === '@media all', '@media 안 덩어리는 겉 조건으로 다시 싸요');
ok(/^@supports/.test(top[2].prelude), '@supports 안 덩어리도');
ok(!gen.includes('.other'), '미리보기 아닌 꺼진 덩어리는 안 옮겨요');
ok(!gen.includes('.a{') && !gen.includes('.c{'), '켜진 규칙은 안 옮겨요');

// 2) 실제 style.css 와 저장된 생성 파일
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const saved = fs.readFileSync(path.join(root, 'src/preview-park.gen.css'), 'utf8');
ok(saved === B.previewParkText(css), 'src/preview-park.gen.css 가 지금 style.css 에서 만든 것과 같아요(node tools/build-css.cjs)');
const blocks = []; const walk = (nodes) => { for (const x of nodes) { if (x.type !== 'at' || !x.block) continue; if (x.name === 'media' && /^@media\s+not\s+all$/i.test(x.prelude)) { const f = (x.children || []).find(c => c.type === 'rule'); if (f && PREVIEW.test(f.selector)) blocks.push(css.slice(x.bodyStart, x.bodyEnd)); continue; } if (x.children) walk(x.children); } };
walk(L.parse(css).children);
ok(blocks.length > 0, '미리보기 덩어리가 있어요');
let at = 0; for (const b of blocks) { const i = saved.indexOf(`@media all {${b}}`, at); ok(i >= 0, '덩어리 글이 차례대로 그대로 들어 있어요'); at = i + b.length; }

// 3) lite.js: 켜고 끌 때 작은 <style> 의 media 를 쓰고, 그 <style> 은 테마 시트 바로 뒤 · 게으른 칸은 그 뒤
const lite = fs.readFileSync(path.join(root, 'src/lite.js'), 'utf8');
ok(/preview-park\.gen\.css/.test(lite), 'lite.js 가 생성 파일을 받아요');
ok(/if \(previewStyle\) \{ previewStyle\.media = 'all'; return; \}/.test(lite), '켤 때 작은 <style> 만');
ok(/if \(previewStyle\) previewStyle\.media = 'not all';/.test(lite), '끌 때도 작은 <style> 만');
ok(/sameShape\(b\.cssRules, deferred\[i\]\.cssRules\)/.test(lite), '붙이기 전에 덩어리마다 뼈대를 견줘요');
ok(/\(previewStyle\?\.isConnected \? previewStyle : sheet\.ownerNode\)\.after\(style\)/.test(lite), '게으른 칸은 미리보기 <style> 뒤에');
console.log(`preview-park: ${n}/${n} 통과`);
