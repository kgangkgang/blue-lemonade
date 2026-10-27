// 10-27 속삭임 · 조용히 대사 크기 (css/55-dem-expressive.css).
// 데우스 V3 프리셋 <style> 이 감정 칸 --whispering 에 font-size .9em · letter-spacing .04em, --quiet 에 letter-spacing .01em 을 줘서
// 한 줄짜리 속삭임 대사가 다른 대사 · 본문보다 작고 성겨 보였다(사용자 제보). 테마는 칸의 크기 · 자간을 둘레 그대로 되돌린다.
// node tools/tests/dem-whisper-size.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// 프리셋이 쓰는 꼴 그대로(실리태번이 메시지 <style> 을 `.mes_text ` + custom- 접두어로 바꾼 뒤): 특이도 (0,2,0)
const PRESET = '.mes_text .custom-dem-expressive--whispering';

function rules(css) {
    const out = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push({ sel: m[1].trim(), body: m[2] });
    return out;
}
const ids = sel => (sel.match(/#[\w-]+/g) || []).length;

for (const rel of ['css/55-dem-expressive.css', 'style.css']) {
    const list = rules(read(rel));
    const hit = list.filter(r => /custom-dem-expressive--whispering/.test(r.sel) && /custom-dem-expressive--quiet/.test(r.sel)
        && /font-size\s*:\s*inherit/.test(r.body) && /letter-spacing\s*:\s*inherit/.test(r.body));
    assert.equal(hit.length, 1, `${rel}: 속삭임 · 조용히 칸의 크기 · 자간을 되돌리는 규칙이 하나여야 해요`);
    const { sel } = hit[0];
    for (const place of ['#chat', '.cg-root', '.salty-preview']) assert.ok(sel.includes(place), `${rel}: ${place} 에도 걸려야 해요`);
    assert.ok(sel.includes('.mes_text') === false, `${rel}: 미리보기 사본(gen-preview-css)에 복사되지 않게 .mes_text 를 쓰지 않아요`);
    assert.ok(ids(sel) >= 1 && ids(PRESET) === 0, `${rel}: 프리셋 규칙(${PRESET})보다 무거워야 해요`);
    // 테마 다른 곳에서 속삭임 칸의 글자 크기를 다시 줄이지 않는다
    const shrink = list.filter(r => /dem-expressive--(whispering|quiet)/.test(r.sel) && /font-size\s*:(?!\s*inherit)/.test(r.body));
    assert.deepEqual(shrink.map(r => r.sel), [], `${rel}: 속삭임 칸의 글자 크기를 바꾸는 다른 규칙이 없어야 해요`);
}
console.log('dem-whisper-size: 속삭임 · 조용히 대사 크기 · 자간 둘레 그대로 — 통과');
