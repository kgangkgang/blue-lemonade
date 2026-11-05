// 1.0.1 로그 복사: 미리보기에서 고친 글 · 숨긴 글이 틀(글꾸) · 색을 바꿔 다시 그려도 그대로예요 (log-copy-sheet.js harvest · log-copy-spoiler.js spoilerHtml · log-copy-render.js kind 'spoiler')
//   사용자 제보(11-03): 할로윈 관 틀에서 글을 고친 뒤 미라 · 유령으로 바꾸면 원문으로 돌아갔어요.
//   node tools/tests/log-copy-edit-keep.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(root, rel)).href;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

const { spoilerHtml, SPOILER_LABEL } = await import(url('src/log-copy-spoiler.js'));
const { nodesHtml } = await import(url('src/log-copy-render.js'));

await test('spoilerHtml: wrapSpoiler 와 같은 뼈대(details · summary 알약 · 흐린 사본 · 내용) · 글줄 안 / 블록', () => {
    const inline = spoilerHtml('비밀', { line: '#123', raised: '#fff', muted: '#555', family: 'Pretendard', tracking: '0' }, true);
    assert.match(inline, /^<details class="blsp-s" data-bl-spoiler="" style="display:inline-block;/);
    assert.ok(inline.includes(`<span class="blsp-l" style="`) && inline.includes(SPOILER_LABEL));
    assert.ok(inline.includes('<span class="blsp-b" aria-hidden="true" style="display:none">비밀</span>'));
    assert.ok(inline.endsWith('<span class="blsp-c">비밀</span></details>'));
    assert.ok(inline.includes('border:1px solid #123') && inline.includes('background-color:#fff') && inline.includes('color:#555'));
    const block = spoilerHtml('<div>한 문단</div>', null, false);
    assert.match(block, /^<details class="blsp-s blsp-k" data-bl-spoiler="" style="display:block;margin:8px 0">/);
    assert.ok(block.includes('<div class="blsp-b" aria-hidden="true" style="display:none">') && block.includes('<div class="blsp-c">'));
    assert.ok(!block.includes('font-family:"'), '글꼴 따옴표는 홑따옴표로');
});

await test('nodesHtml: kind spoiler 노드는 숨긴 글 마크업으로, 다른 노드는 그대로', () => {
    const nodes = [{ t: 'el', block: true, tag: 'div', kind: 'p', style: {}, children: [
        { t: 'text', text: '앞 ' },
        { t: 'el', block: false, tag: 'span', kind: 'spoiler', style: {}, sp: { line: '#1', raised: '#2', muted: '#3', family: 'F', tracking: '0' }, children: [{ t: 'text', text: '숨김' }] },
        { t: 'text', text: ' 뒤' },
    ] }];
    const html = nodesHtml(nodes);
    assert.match(html, /^<div>앞 <details class="blsp-s" data-bl-spoiler=""/);
    assert.ok(html.includes('<span class="blsp-c">숨김</span></details> 뒤</div>'));
    assert.equal(nodesHtml([{ t: 'el', block: false, tag: 'span', kind: 'strong', style: { 'font-weight': '700' }, children: [{ t: 'text', text: '굵게' }] }]), '<span style="font-weight:700">굵게</span>');
});

await test('시트: 고친 글을 거둬(harvest) 다음 그리기부터 쓰고, 안 고친 메시지는 원래 노드를 지켜요', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /edited: null,/); assert.match(sheet, /dirty: false,/);
    assert.match(sheet, /const harvest = \(\) => \{\s*if \(!state\.dirty\) return;\s*state\.dirty = false;/);
    assert.match(sheet, /got\.messages\.length !== base\.messages\.length\) return;/, '메시지 수가 다르면 못 잇기');
    assert.match(sheet, /textOf\(got\.messages\[i\]\.nodes\)\.trim\(\) === textOf\(m\.nodes\)\.trim\(\) \? m : \{ \.\.\.m, nodes: got\.messages\[i\]\.nodes \}/, '글이 같은 메시지는 원래 노드');
    assert.match(sheet, /const draw = \(\) => \{\s*harvest\(\);/, '그리기 전에 거둠');
    assert.match(sheet, /transformLog\(state\.edited \?\? model, \{/, 'view 는 고친 모델');
    assert.match(sheet, /doc\.addEventListener\('input', \(\) => \{\s*state\.dirty = true;/, '미리보기 입력 → dirty');
    assert.match(sheet, /state\.spoilerRange = null;\s*state\.dirty = true;/, '숨기기 · 풀기 → dirty');
    assert.match(sheet, /spoilerColors\(m\.nodes, \{ line: c\.line, raised: c\.raised, muted: c\.muted, family: ui\.family, tracking: ui\.tracking \}\)/, '숨긴 글 알약은 지금 팔레트 색');
});

await test('previewModel: 블록 숨김(blsp-k)은 블록 노드로 · CI 등록', () => {
    assert.match(read('src/log-copy-spoiler.js'), /const blockSp = node\.classList\.contains\('blsp-k'\);/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/log-copy-edit-keep\.mjs \./);
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
if (fail) process.exitCode = 1;
