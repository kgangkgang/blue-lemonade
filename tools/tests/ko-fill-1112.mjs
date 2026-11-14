// 11-12 한글화 채우기 — 실리태번 1.19 화면에서 영어로 남던 글을 글자 사전(tools/scripts-src/korean.js)에 더하고, 다듬기 도구(tools/ko-dict-prune.mjs)가
//   ① title · placeholder 의 줄바꿈 글자(&NewLine; · &#10;)를 풀지 못해 화면에 있는 열쇠를 「없음」으로 빼던 것,
//   ② 이스케이프한 괄호(character\(s\))를 정규식 묶음으로 잘라 패턴을 「없음」으로 빼던 것을 고쳤어요. 실리태번 폴더 없이 도는 시험이에요.
// node tools/tests/ko-fill-1112.mjs [저장소]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const { decode, prune, normalize } = await load('tools/ko-dict-prune.mjs');
const { buildKorean, readPrune } = await load('tools/build-korean-dict.mjs');
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };

test('다듬기: 줄바꿈 글자 · 숫자 엔티티를 풀어 화면 글과 맞대요', () => {
    assert.equal(normalize(decode('Example:&#10;[Scenario: x]')), 'Example: [Scenario: x]');
    assert.equal(normalize(decode('Character Lore&NewLine;Click to load')), 'Character Lore Click to load');
    assert.equal(decode('&#x41;&amp;lt;'), 'A&lt;', '&amp; 는 맨 나중에 풀어요(두 번 풀지 않음)');
});

test('다듬기: 이스케이프한 괄호는 글자로 보고, 런타임에 붙는 묶음만 잘라요', () => {
    const corpus = { text: 'Deleting ${n} character(s)... · Removed ${n} background(s) from folder · ${a}ing extension ${b} and reloading...', bare: '', attrs: '', elements: [] };
    const patterns = [
        { re: String.raw`^Deleting (\d+) character\(s\)\.\.\.$` },
        { re: String.raw`^Removed (\d+) background\(s\) from folder$` },
        { re: String.raw`^(Enabl)ing extension (.+) and reloading\.\.\.$` },
        { re: String.raw`^Nowhere (\d+) in files$` },
    ];
    const { counts } = prune({ translations: {}, patterns }, corpus, { ADD: {} });
    assert.equal(counts.patternsDropped, 1, '파일에 없는 마지막 패턴만 빠져요');
});

test('사전: 새로 채운 글이 실제로 옮겨져요(열쇠 · 패턴 · 되살린 열쇠)', () => {
    const { dictionary } = buildKorean(fs.readFileSync(path.join(root, 'tools/scripts-src/korean.js'), 'utf8'), readPrune());
    const exact = new Map(dictionary.exact);
    const res = dictionary.PATTERNS.map(p => ({ re: new RegExp(p.re), ko: p.ko }));
    const tr = text => {
        const key = normalize(text);
        if (exact.has(key)) return exact.get(key);
        for (const { re, ko } of res) { const m = re.exec(key); if (m) return ko.replace(/\$([1-9])/g, (w, i) => m[Number(i)] ?? w); }
        return null;
    };
    const want = {
        '-- Chat Start: ': '-- 채팅 시작:',
        'Actual Max Context Allowed:': '실제 최대 컨텍스트:',
        'Search macros by name or description...': '이름이나 설명으로 매크로 찾기...',
        'Switch QR Sets...': '빠른 답장 세트 바꾸기...',
        'Modify tags of 3 characters': '캐릭터 3개의 태그 바꾸기',
        'Extension foo enabled.': 'foo 확장을 켰어요.',
        'Enabling extension foo and reloading...': 'foo 확장을 켜고 다시 불러오는 중...',
        'Removed 2 background(s) from folder': null,   // 되살린 옛 패턴 — 값은 원래 번역 그대로라 「옮겨짐」만 봐요
        'Character Lore\nClick to load\nShift/Alt-click or long-press to open \'Link to World Info\' popup': null,
    };
    for (const [en, ko] of Object.entries(want)) {
        const got = tr(en);
        assert.ok(got && got !== normalize(en), `옮겨지지 않음: ${en}`);
        if (ko !== null) assert.equal(got, ko, en);
    }
});

console.log(`ko-fill-1112: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
