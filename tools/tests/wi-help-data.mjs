// 6.1.5 월드인포 ? 도움말 데이터 검사 — 붙일 자리마다 글이 있고, 금지 글자가 없고, 모양이 맞는지
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
const { WI_HELP, GLOBAL_ANCHORS, ENTRY_ANCHORS } = await import(new URL('src/wi-help-data.js', root));
const anchors = [...GLOBAL_ANCHORS, ...ENTRY_ANCHORS];
const ids = anchors.map(a => a[1]);
assert.equal(new Set(ids).size, ids.length, 'each help is placed once');
for (const [selector, id, how] of anchors) {
    assert.ok(WI_HELP[id], `help text for ${id}`);
    assert.ok(['after', 'append'].includes(how), `${id} placement`);
    assert.ok(typeof selector === 'string' && selector.length > 3, `${id} selector`);
}
for (const id of Object.keys(WI_HELP)) assert.ok(ids.includes(id), `${id} is placed somewhere`);
// 공개 글 규칙의 금지 글자(U+AC24)는 글자 그대로 적지 않는다 — 개인 이름 검사는 릴리스 점검이 따로 한다
const forbidden = [String.fromCharCode(0xAC24)];
for (const [id, h] of Object.entries(WI_HELP)) {
    assert.ok(h.title && typeof h.title === 'string', `${id} title`);
    assert.ok((h.body?.length || 0) + (h.list?.length || 0) > 0, `${id} has content`);
    for (const p of h.body || []) assert.ok(typeof p === 'string' && p.length > 5, `${id} body`);
    for (const row of h.list || []) assert.ok(Array.isArray(row) && row.length === 2 && row.every(x => typeof x === 'string' && x), `${id} list row`);
    const text = JSON.stringify(h);
    for (const word of forbidden) assert.ok(!text.includes(word), `${id} must not contain ${word}`);
    assert.ok(!/<[a-z]/i.test(text), `${id} is plain text (escaped when shown)`);
}
assert.equal(GLOBAL_ANCHORS.length, 15);
assert.equal(ENTRY_ANCHORS.length, 24);   // 실리태번이 숨기는 선택적 · 확률 사용 · 메모 추가 칸은 뺐다
// 1.5.1 상태 기호: 도움말 글에 색 그림 글자가 없고, 항목 틀의 상태 칸 글자를 글(상시 · 일반 · 벡터)로 적고, 닫힌 칸 표시는 CSS 가 고른 값으로 그려요
{
    const fs = await import('node:fs'); const read = rel => fs.readFileSync(new URL(rel, root), 'utf8');
    assert.ok(!/\p{Emoji_Presentation}|.️/u.test(JSON.stringify(WI_HELP)), '도움말 글에 그림 글자가 남았어요');
    const js = read('src/wi-help.js');
    assert.match(js, /export const WI_STATE_LABEL = \{ constant: '상시', normal: '일반', vectorized: '벡터' \};/);
    assert.match(js, /labelStateOptions\(template\);/, '항목 틀에 한 번');
    assert.ok(!/MutationObserver|setInterval/.test(js), '감시자 · 타이머 없이');
    const css = read('css/12-worldinfo.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const base = 'html body.salty #WorldInfo .world_entry select[name="entryStateSelector"]:not(#bl-arrow-a):not(#bl-arrow-b):not(#bl-arrow-c)';
    assert.ok(css.includes(base + ' {'), '닫힌 칸 규칙');
    assert.match(css, /color: transparent !important;\s*background-image: var\(--bl-wi-state\), var\(--bl-select-arrow\) !important;/, '글자는 숨기고 표시 + 꺾쇠 두 그림');
    for (const v of ['constant', 'vectorized']) assert.ok(css.includes(`${base}:has(> option[value="${v}"]:checked) {`), `${v} 는 칸 자신의 :has(주어)`);
    assert.ok(css.includes('select[name="entryStateSelector"] > option { color: var(--salty-text); }'), '펼친 목록 글자색은 그대로');
}
console.log(`PASS ${ids.length} World Info help anchors with texts`);
