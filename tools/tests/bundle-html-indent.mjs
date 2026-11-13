// 1.2.1 묶음에서만 걷는 설정 · 창 HTML 들여쓰기(tools/build-bundle.mjs minHtmlGaps) — 걷는 것이 「태그 > 줄바꿈 + 들여쓰기 < 태그」의 들여쓰기뿐인지 봐요.
//   줄바꿈 하나는 남으니 보통 글(white-space: normal · nowrap · pre-line)에서는 공백 모으기 결과가 같아요(화면 그대로).
//   공백이 보이는 곳(pre · textarea · code · samp · white-space:pre*)과 HTML 이 아닌 글(프롬프트 XML 등)은 한 글자도 안 바뀌어야 해요.
//   node tools/tests/bundle-html-indent.mjs [저장소]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const { minHtmlGaps, htmlGapStats, HTML_GAP_FILES, bundleFresh } = await import(pathToFileURL(path.join(root, 'tools/build-bundle.mjs')));
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
// 브라우저의 공백 모으기(white-space: normal): 줄바꿈 · 띄어쓰기 · 탭 묶음 → 공백 하나. 따옴표 글의 「\n」 도 줄바꿈으로 봐요
const collapse = s => s.replace(/\\n/g, '\n').replace(/[ \t\r\n]+/g, ' ');

test('설정 · 창 HTML 파일 표가 살아 있어요(애드온 설정 HTML 이 들어 있어요)', () => {
    for (const f of ['src/addons/rewrite/settings-html.js', 'src/addons/assets/panel.js', 'src/addons/perf/panel.js', 'src/addons/bookmarks/settings-view.js', 'src/addons/direction/index.js', 'src/panel.js']) assert.ok(HTML_GAP_FILES.includes(f), f);
    assert.match(read('tools/build-bundle.mjs'), /if \(HTML_GAP_FILES\.includes\(name\)\) code = minHtmlGaps\(code, name\);/, '묶음 transform 에서 부르기');
});

let total = 0;
for (const file of HTML_GAP_FILES) {
    test(`${file}: 들여쓰기만 걷고 공백 모으기 결과 · 나머지 글자는 그대로예요`, () => {
        const code = read(file);
        const out = minHtmlGaps(code, file);
        const saved = code.length - out.length;
        assert.ok(saved > 0, '줄어들어야 해요');
        total += Buffer.byteLength(code) - Buffer.byteLength(out);
        // ① 빠진 것은 공백 · 탭뿐이고 차례는 그대로
        assert.equal(out.replace(/[ \t]/g, ''), code.replace(/[ \t]/g, ''));
        // ② 공백 모으기 뒤에는 같은 글(화면이 같아요)
        assert.equal(collapse(out), collapse(code));
        // ③ 빠진 자리는 모두 「> 줄바꿈 ⋯ <」 사이 — 원본을 차례로 맞대며 확인해요
        let i = 0, j = 0;
        while (i < code.length) {
            if (code[i] === out[j]) { i++; j++; continue; }
            assert.ok(/[ \t]/.test(code[i]), `공백이 아닌 글자가 빠졌어요 @${i}`);
            const nl = code.slice(0, i).match(/>(\r?\n|\\n)[ \t]*$/);
            assert.ok(nl, `「> 줄바꿈」 바로 뒤가 아닌 공백이 빠졌어요 @${i}: ${JSON.stringify(code.slice(i - 30, i + 10))}`);
            i++;
        }
        assert.equal(j, out.length);
        // ④ 공백이 보이는 요소 안쪽(pre · textarea)의 글은 그대로
        for (const m of code.matchAll(/<(pre|textarea)\b[^<>]*>([\s\S]*?)<\/\1>/g)) assert.ok(out.includes(m[0]), `${m[1]} 안이 바뀌었어요`);
    });
}

test('공백이 보이는 곳 · HTML 이 아닌 글은 건드리지 않아요', () => {
    const keep = [
        '`<pre>\n    <b>x</b>\n    </pre>`',
        '`<textarea>\n    </textarea>`',
        '`<code>a\n  <b>b</b></code>`',
        '`<div style="white-space:pre-wrap">\n    <span>a</span>\n    <span>b</span></div>`',
        '`<div class="pt-original-text">\n  <i>a</i>\n  <i>b</i></div>`',
        '`<instructions>\n    <rule>프롬프트 XML</rule>\n</instructions>`',
        '`<div>\n    ${x}<span></span>`',
        '`<${tag}>\n    <span></span>`',
    ];
    for (const s of keep) assert.equal(htmlGapStats(s).saved, 0, s);
    assert.equal(htmlGapStats('`<div><pre>a</pre><b>c</b>\n    <span>b</span></div>`').code, '`<div><pre>a</pre><b>c</b>\n<span>b</span></div>`', 'pre 가 닫힌 뒤는 걷어요');
    assert.equal(htmlGapStats('"<div class=\\"a\\">\\n    <span>b</span>"').code, '"<div class=\\"a\\">\\n<span>b</span>"', '따옴표 글의 \\n 도');
    assert.throws(() => minHtmlGaps('const x = 1;', 'x'), /걷을 곳이 없어요/);
});

test('dist 가 src 와 맞으면 다시 쓰기 설정 HTML 조각에 들여쓰기가 남지 않았어요', () => {
    if (!bundleFresh(root).ok) { console.log('   (dist 가 낡아 건너뛰어요)'); return; }
    const dist = path.join(root, 'dist');
    const hit = fs.readdirSync(dist).filter(f => f.endsWith('.js') && fs.readFileSync(path.join(dist, f), 'utf8').includes('bwr_settings'));
    assert.ok(hit.length >= 1);
    for (const f of hit) {
        const text = fs.readFileSync(path.join(dist, f), 'utf8');
        const at = text.indexOf('<div class="bwr_settings">');
        if (at < 0) continue;
        assert.ok(!/>\n {4,}<div class="inline-drawer">/.test(text.slice(at, at + 400)), `${f} 에 들여쓰기가 남았어요`);
    }
});

test('CI 등록', () => assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/bundle-html-indent.mjs .')));
console.log(`   걷은 바이트(원본 기준): ${total.toLocaleString('en-US')}B`);
console.log(`\n${passed} 통과 · ${failed} 실패`);
if (failed) process.exit(1);
