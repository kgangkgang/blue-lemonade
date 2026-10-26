// :has() 무효화 범위 지킴이 (8.0.5 프리셋 화면 성능) — node tools/tests/has-invalidation-scope.mjs <테마 루트>
//
// 크롬(Blink)은 :has() 상태가 바뀔 때 다시 계산할 요소를 「모든 :has 규칙의 오른쪽 끝 칸 특징을 합친 전역 집합 하나」로 고른다.
// 실리태번 본체도 #top-settings-holder · #openai_settings 에 :has 를 걸어 두어, 체크 상자 · 인라인 style · 줄 끼우기가 있을 때마다
// 그 아래 전체가 이 집합으로 걸러진다. 테마 규칙 하나라도 :has 뒤 오른쪽 끝이 *(특징 없음) · span · [class] 이면 집합이 그 요소 전부가 되어,
// 「AI 응답 설정」 서랍이 열려 있을 때 한 번에 3천 요소 남짓을 다시 계산했다(폰 흉내 CPU 4배 한 번 약 260ms, 프리셋 한 번 바꾸는 데 25번).
// 1) 원본 CSS(css/*.css · src/**/*.css · src/scripts/plain/*.js 안 CSS)에 그런 규칙이 다시 생기지 않았는지 본다.
//    고칠 때는 :has 를 고를 칸(맨 오른쪽)으로 옮긴다: P:has(> X) > T  →  P > T:where(P > *):is(X, X ~ *, :has(~ X)) (특이도 같음).
// 2) 8.0.5 에서 다시 쓴 선택자 쌍(has-invalidation-pairs.json)의 특이도가 그대로인지 tools/css-lib.cjs 의 spec 으로 본다(폭포 순서 그대로).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const lib = createRequire(import.meta.url)(path.join(root, 'tools/css-lib.cjs'));
const PAIRS = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'has-invalidation-pairs.json'), 'utf8'));
const BAD = new Set(['*', 'span', '[class]']);

const FN_SKIP = /:(not|has|nth-child|nth-last-child|nth-of-type|nth-last-of-type)\((?:[^()]|\([^()]*\))*\)/g;
const FN_ALT = /:(?:is|where)\(((?:[^()]|\([^()]*\))*)\)/g;
/** 맨 오른쪽 칸 하나의 무효화 특징(아이디 > 클래스 > 속성 > 태그, 없으면 *) — Blink 가 고르는 순서를 대강 따른다 */
function features(compound) {
    const s0 = compound.replace(FN_SKIP, '');
    const alts = [];
    for (const m of s0.matchAll(FN_ALT)) for (const b of lib.topSplit(m[1])) { const cs = lib.compounds(b.trim()); if (cs.length) alts.push(cs[cs.length - 1]); }
    const s = s0.replace(FN_ALT, '');
    const ids = [...s.matchAll(/#([\w-]+)/g)].map(m => '#' + m[1]); if (ids.length) return ids;
    const cls = [...s.matchAll(/\.([\w-]+)/g)].map(m => '.' + m[1]); if (cls.length) return cls;
    const attrs = [...s.matchAll(/\[\s*([\w-]+)/g)].map(m => '[' + m[1] + ']'); if (attrs.length) return attrs;
    const tag = (s.match(/^[a-zA-Z][\w-]*/) || [])[0]; if (tag) return [tag.toLowerCase()];
    if (!alts.length) return ['*'];
    const out = [];
    for (const a of alts) { const f = features(a); if (f.includes('*')) return ['*']; out.push(...f); }
    return out;
}
function wideBranches(selector) {
    return lib.topSplit(selector).map(b => b.trim()).filter(b => {
        if (!b.includes(':has(')) return false;
        const cs = lib.compounds(b); const last = cs[cs.length - 1];
        if (last.includes(':has(')) return false;   // :has 가 맨 오른쪽 칸(주어)이면 그 요소만 다시 계산
        return features(last).some(f => BAD.has(f));
    });
}
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const rel = f => path.relative(root, f).split(path.sep).join('/');
const sources = walk(root).filter(f => {
    const r = rel(f);
    return /^css\/.*\.css$/.test(r) || (/^src\/.*\.css$/.test(r) && !/lazy-panel\.gen\.css$/.test(r)) || /^src\/scripts\/plain\/.*\.js$/.test(r);
});
/** JS 안 CSS: 「"…:has(…"」 꼴 문자열 조각을 풀어 CSS 로 읽는다 */
function cssOf(file, text) {
    if (!file.endsWith('.js')) return text;
    const parts = [];
    for (const m of text.matchAll(/"((?:[^"\\]|\\.)*)"/g)) if (m[1].includes(':has(') && m[1].includes('{')) { try { parts.push(JSON.parse('"' + m[1] + '"')); } catch { /* 문자열이 아님 */ } }
    return parts.join('\n');
}
const found = [];
for (const f of sources) {
    const text = fs.readFileSync(f, 'utf8');
    if (!text.includes(':has(')) continue;
    for (const rule of lib.flatRules(lib.parse(cssOf(f, text)))) for (const b of wideBranches(rule.selector)) found.push(`${rel(f)}: ${b.slice(0, 160)}`);
}

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };
test(`원본 CSS 에 「:has 뒤 오른쪽 끝이 * · span · [class]」인 규칙이 없다 (${sources.length}개 파일)`, () => assert.deepEqual(found, []));
test(`다시 쓴 선택자 ${PAIRS.length}쌍의 특이도가 그대로다`, () => { for (const [a, b] of PAIRS) assert.deepEqual(lib.spec(b), lib.spec(a), b.slice(0, 120)); });
test('지킴이가 옛 선택자는 잡고 새 선택자는 통과시킨다', () => {
    const caught = PAIRS.filter(([a]) => wideBranches(a).length).length;
    assert.ok(caught >= PAIRS.length - 2, `잡은 옛 선택자 ${caught}/${PAIRS.length}`);
    for (const [, b] of PAIRS) assert.deepEqual(wideBranches(b), [], b.slice(0, 120));
});
test('주어 칸의 :has · 특징 있는 오른쪽 끝은 넓은 규칙이 아니다', () => {
    assert.deepEqual(wideBranches('.a:has(> .b)'), []);
    assert.deepEqual(wideBranches('.a:has(> .b) > .c'), []);
    assert.deepEqual(wideBranches('.a > span:is(.b ~ *, :has(~ .b))'), []);
    assert.equal(wideBranches('.a:has(> .b) > *').length, 1);
    assert.equal(wideBranches('.a:has(> .b) > :not(.c)').length, 1);
    assert.equal(wideBranches('.a:has(> .b) > :is(span, small)').length, 1);
    assert.equal(wideBranches('.a:has(> .b) > [class*="-x"]').length, 1);
});
console.log(`has-invalidation-scope: ${n}/${n} 통과`);
