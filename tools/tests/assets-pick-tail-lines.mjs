// 코드 감사 2차 N1: 캐릭터 에셋 그림 고르기 답 읽기(src/addons/assets/slots.js parsePicks).
// 한 답 그림 수를 10장 이상으로 두면, 고르기 모델 답 끝 군말 줄(「10-12: 표정만 달리 골랐어요」 · 「12:30 쯤의 밤 장면」)이
// 두 자리 번호로 읽혀 앞서 고른 10 · 12번 자리의 그림을 덮어썼어요(뒤 줄이 이김).
// 고친 뒤: 자리가 5개 이상이면 같은 번호는 처음 것을 지키고, 그 캐릭터 그림 목록에 없는 이름 줄은 버려요. 4개 이하는 예전과 글자 하나까지 같아요.
//   node tools/tests/assets-pick-tail-lines.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const S = await import(pathToFileURL(path.join(root, 'src/addons/assets/slots.js')).href);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

// 고치기 전 parsePicks 그대로 (4개 이하 견주기용)
function oldParsePicks(raw, count) {
    const n = Math.max(0, Number(count) || 0);
    const out = new Array(n).fill(null);
    const text = String(raw ?? '').replace(/<(think|thinking|reasoning)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    for (const line of text.split(/\r?\n/)) {
        const m = /^\s*[-*]?\s*\[?(?:ASSET\s*)?(\d{1,2})\]?\s*[:：.)-]\s*(.*?)\s*$/i.exec(line);
        if (!m) continue;
        const i = Number(m[1]) - 1;
        if (i < 0 || i >= n) continue;
        const name = m[2]
            .replace(/^\{\{\s*img::\s*/i, '').replace(/\s*\}\}$/, '')
            .replace(/^[`"'“”‘’「」『』*]+/, '').replace(/[`"'“”‘’「」『』*.,;]+$/, '')
            .trim();
        out[i] = !name || /^(?:none|no image|없음|n\/a|-)$/i.test(name) ? '' : name;
    }
    return out;
}

const known = name => /^Alice_face-\d+\.png$/.test(name);
const answer = Array.from({ length: 12 }, (_, i) => `${i + 1}: Alice_face-${i + 1}.png`).join('\n');
const tail = '\n\n10-12: 같은 장면이라 표정만 달리 골랐어요.\n12:30 쯤의 밤 장면이에요.';

test('12자리 + 군말 두 줄: 10 · 12번 자리의 고른 그림이 그대로예요 (고치기 전: 군말로 덮임)', () => {
    const got = S.parsePicks(answer + tail, 12, known);
    assert.deepEqual(got, Array.from({ length: 12 }, (_, i) => `Alice_face-${i + 1}.png`));
});
test('5자리 이상에서 같은 번호가 두 번이면 처음 것을 지켜요', () => {
    const got = S.parsePicks('1: Alice_face-1.png\n2: none\n1: Alice_face-9.png\n2: Alice_face-2.png\n5: Alice_face-5.png', 5, known);
    assert.deepEqual(got, ['Alice_face-1.png', '', null, null, 'Alice_face-5.png']);
});
test('목록 함수 없이 불러도 두 번째 줄은 처음 것을 덮지 않아요', () => {
    const got = S.parsePicks(answer + tail, 12);
    assert.equal(got[9], 'Alice_face-10.png');
    assert.equal(got[11], 'Alice_face-12.png');
});
test('목록에 없는 이름 줄만 있는 자리는 비어(null) 있어요 — 다른 자리는 그대로', () => {
    const got = S.parsePicks('1: Alice_face-1.png\n6: 표정만 달리 골랐어요', 6, known);
    assert.deepEqual(got, ['Alice_face-1.png', null, null, null, null, null]);
});
test('4자리 이하는 예전 parsePicks 와 글자 하나까지 같아요(목록 함수를 줘도)', () => {
    const inputs = [
        answer + tail,
        '1: Mina_smile.png\n2: none',
        '<think>1: Mina_cry.png</think>\nmaybe 1: x\n1: {{img::Mina_smile.png}}\n2. "Mina_angry.webp".',
        '[ASSET 1]: `Mina_a.png`\nASSET 2) 없음\n5: Mina_x.png',
        'Sorry, no images.',
        '- 1: Mina_b.png',
        '1: Alice_face-1.png\n1: Alice_face-2.png\n3: 군말이에요\n4-5: x',
        '',
    ];
    for (const raw of inputs) for (let n = 0; n <= 4; n++) {
        assert.deepEqual(S.parsePicks(raw, n, known), oldParsePicks(raw, n), `n=${n} ${JSON.stringify(raw).slice(0, 40)}`);
        assert.deepEqual(S.parsePicks(raw, n), oldParsePicks(raw, n));
    }
});
test('after-reply.js 가 그 캐릭터 그림 목록으로 parsePicks 를 불러요', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/assets/after-reply.js'), 'utf8');
    assert.match(src, /parsePicks\(raw, ids\.length, name => !!info\(name\)\)/);
});
test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/assets-pick-tail-lines.mjs .'));
});
console.log(`assets-pick-tail-lines: ${pass} passed`);
