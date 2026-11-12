// 로그 복사 「글 고치기」 — 글꾸 마트 공용 편집 모듈(geulkku-mart/edit-blocks.js) 붙이기(11-12)
//   ① 사본: 들머리에 mart/edit-blocks.js · 마트 그대로(tune.js editables · hasLetters 와 같은 칸 규칙)
//   ② 칸 규칙: 일기 도장 「참 잘 / 했어요」 · 영수증 · 견출지 제목 같은 소품 안 글이 고칠 칸이에요(전엔 요약 칸 summary 의 글 고르기 막음 때문에 못 고쳤어요)
//   ④ 굵게 · 기울임(고른 글 옆 막대 · Ctrl+B · I)은 「글 고치기」를 켠 채 한 칸 안을 골랐을 때만(테마 · 마트 같은 규칙)
//   ③ 시트: 미리보기 머리 「글 고치기」 · 그린 뒤마다 armEdit(소품 고친 글 다시 넣기) · 복사 전 점선 칸 걷기 · 칸 단위 되돌리기 · 나눠 맡기(메시지 · 제목은 고친 글 거두기)
//   실제 누르기 · 전 · 후 · 다시 그리기 · 복사는 리그(자동화 checks/rig/log-copy-controls.mjs 의 소품 글 갈래)에서 봐요.
//   node tools/tests/log-copy-edit-blocks.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

await test('사본: 들머리에 edit-blocks.js · tune.js 에서 칸 규칙을 받아요 · 고치지 않은 마트 사본(머리 주석)', () => {
    assert.match(read('tools/mart/geulkku-mart-copy.mjs'), /export const ENTRIES = \[[^\]]*'mart\/edit-blocks\.js'/);
    const src = read('src/geulkku-mart/edit-blocks.js');
    assert.match(src, /^\/\/ 생성물 — 글꾸 마트 mart\/edit-blocks\.js 사본/);
    assert.match(src, /import \{ EDIT_CLASSES, EDIT_TAGS, hasLetters \} from "\.\/tune\.js";/);
    for (const name of ['createEditBlocks', 'markSlots', 'propDetails', 'stepLabels', 'setStep']) assert.match(src, new RegExp(`\\b${name}\\b`), name);
});

await test('칸 규칙(tune.js editables): 일기 도장 · 영수증 · 견출지 제목이 고칠 칸이에요', async () => {
    const { editables } = await load('src/geulkku-mart/tune.js');
    const { renderLog } = await load('src/log-copy-presets.js');
    const model = { messages: [{ name: '깡통', nodes: [{ t: 'text', text: '「비가 그쳤네.」' }] }] };
    const diary = renderLog(model, { shape: 'diary', fields: { title: '제목' }, mode: 'dark', marks: true });
    assert.ok(editables(diary).some(c => /참 잘/.test(c.text) && /했어요/.test(c.text)), '일기 도장');
    const frames = await load('tools/mart/simple-frames.mjs');
    const raw = code => frames.rawFrame(frames.DEFS.find(d => d.frame === code));
    assert.ok(editables(raw('q09')).some(c => c.text === '옥상 매점'), '영수증 가게 이름');
    assert.ok(editables(raw('q10')).some(c => /HP/.test(c.text)), 'RPG 스탯');
    assert.ok(editables(raw('k2')).some(c => c.cls === 'gk-tt'), '견출지 제목');
});

await test('시트: 「글 고치기」 단추 · 그린 뒤 armEdit · 복사 전 걷기 · 칸 단위 되돌리기 · 나눠 맡기', () => {
    const s = read('src/log-copy-sheet.js');
    assert.match(s, /data-lc="edit" aria-pressed="false" aria-label="글 고치기"[^>]*hidden>/);
    assert.match(s, /import\('\.\/geulkku-mart\/edit-blocks\.js'\)/);   // 늦게 받기(시작 묶음 밖)
    assert.doesNotMatch(s, /^import [^\n]*edit-blocks/m);
    assert.match(s, /const OWNED = '\.gk-lg, \.lg, \[data-f\], \[data-bl-msg\], \[data-bl-slot\]';/);   // 메시지 · 제목 · 숨은 줄은 고친 글 거두기 몫
    assert.match(s, /armEdit\(doc\);\n\s*resetHist\(doc\);/);   // 첫 되돌리기 칸에 다시 넣은 소품 글까지
    assert.match(s, /const result = \(opts = \{\}\) => editOffFor\(\(\) => resultNow\(opts\)\);/);
    assert.match(s, /if \(eb\) syncProps\(\);/);
    assert.match(s, /if \(eb\) \{ eb\.refresh\(\); syncProps\(\); \}/);   // 되돌린 문서
    assert.match(s, /case 'undo': travel\(-1\); drawHist\(\); break;/);   // 되돌리기는 한 줄만(편집 모듈의 칸 단위와 섞으면 차례가 뒤바뀌어요 — 리그 실사용 점검)
    assert.doesNotMatch(s, /eb\.undo\(\)|eb\.redo\(\)/);
    assert.match(s, /const editOn = \(doc\) => \{ doc\.designMode = 'off'; eb\.setOn\(true\);/);
    assert.match(s, /if \(eb && state\.ed\.on\) return; doc\.designMode = 'on';/);
    // 소품 덮개가 칸 위에 떠 있어도 누른 자리 아래의 칸에 커서 · 글 고치기 중엔 소품 요약 칸을 눌러도 소품이 안 움직여요
    assert.match(s, /event\.target\?\.closest\?\.\('summary:not\(\.blsp-h\)'\)\) event\.preventDefault\(\);/);
    assert.match(s, /doc\.elementsFromPoint\(event\.clientX, event\.clientY\)\.map\(el => el\.closest\('\[data-bl-ed\]\[contenteditable="true"\]'\)\)\.find\(Boolean\);/);   // 장식 누름 뒤 문서 편집 되켜기는 글 고치기 중이 아닐 때만
    // 소품 칸 열쇠는 막 그렸을 때 붙여요(글을 다 지운 칸이 빠져도 뒤 칸이 안 밀려요) · 칸 번호 · 열쇠는 편집용 꼴(marks) 복사 글에도 안 가요
    // 고친 글은 고치기 전 글(was)이 같은 칸에만 다시 넣어요(칸 수가 달라져 차례가 밀려도 다른 칸에 안 들어가요)
    assert.match(s, /state\.ed\.texts\.set\(key, \{ html: now, was: state\.ed\.texts\.get\(key\)\?\.was \?\? orig \}\)/);
    assert.match(s, /let at = state\.ed\.orig\.get\(key\) === t\.was \? key : null;/);
    assert.match(s, /if \(same\.length === 1\) at = same\[0\]\[0\];/);
    assert.match(s, /eb\.slots\(\)\.filter\(el => !el\.closest\(OWNED\)\)\.forEach\(\(el, k\) => \{ el\.dataset\.blPk = `p\$\{k\}`; \}\);/);
    assert.match(s, /querySelectorAll\('\[data-bl-ed\], \[data-bl-pk\]'\)\) \{ el\.removeAttribute\('data-bl-ed'\); el\.removeAttribute\('data-bl-pk'\); \}[^\n]*\n\s*sanitizeTree\(body/);
    assert.match(s, /summary \[data-bl-ed\],\.bl-eb-on figcaption \[data-bl-ed\]\{-webkit-user-select:text!important;user-select:text!important\}/);
    assert.match(s, /if \(state\.ed\.shape !== state\.shape\) \{ state\.ed\.shape = state\.shape; state\.ed\.texts = new Map\(\);/);
});

await test('굵게 · 기울임: 「글 고치기」를 켠 채 한 칸 안을 골랐을 때만(막대 · Ctrl+B · I) · 태그로 넣어요', () => {
    const s = read('src/log-copy-sheet.js');
    // 규칙의 문: 켜 있고(eb && state.ed.on) · 고른 자리 양 끝이 같은 고칠 칸(contenteditable) 안
    assert.match(s, /const edCell = \(range\) => \{\r?\n\s*if \(!\(eb && state\.ed\.on\) \|\| !range\) return null;/);
    assert.match(s, /closest\?\.\('\[data-bl-ed\]\[contenteditable="true"\]'\);\r?\n\s*return cell && cell\.contains\(range\.endContainer\) && !cell\.closest\('\[data-f\]'\) \? cell : null;/);   // 머리 칸(data-f)은 글자만
    // 굵게 · 기울임을 내는 곳은 모두 edCell 을 거쳐요(막대 단추 · 단추 누름 · 단축키)
    assert.match(s, /\.\.\.\(edCell\(range\) \? \[\['bold', '굵게', '굵게\(Ctrl\+B\)'\], \['italic', '기울임', '기울임\(Ctrl\+I\)'\]\]\.map\(/);
    assert.match(s, /run: \(r\) => \{ const cell = edCell\(r\); if \(cell\) \{ reselect\(r\); edFormat\(doc, cell, id\); \} \}/);
    assert.match(s, /else if \(ed && \(event\.ctrlKey \|\| event\.metaKey\) && !event\.shiftKey && !event\.altKey && \(key === 'b' \|\| key === 'i'\)\) \{ const cell = edCell\(/);
    assert.equal((s.match(/edFormat\(doc, cell, /g) || []).length, 2, '굵게 · 기울임 넣는 곳은 둘(막대 · 단축키)');
    assert.equal((s.match(/execCommand\(cmd\)/g) || []).length, 1);
    assert.doesNotMatch(s, /execCommand\('(bold|italic)'/);   // 따로 넣는 길 없음
    // 태그로: style 을 단 span 이면 그 칸이 「속성 없는 꾸밈 태그만 든 잎 요소」 규칙에서 빠져요
    assert.match(s, /const edFormat = \(doc, cell, cmd\) => \{\r?\n\s*try \{ doc\.execCommand\('styleWithCSS', false, false\); \}/);
    assert.match(s, /if \(!\(\['B', 'I', 'STRONG', 'EM', 'S', 'BR'\]\.includes\(el\.tagName\) && !el\.attributes\.length\) && !el\.hasAttribute\('data-bl-mask'\) && !el\.closest\('\[data-bl-spoiler\]'\)\) el\.replaceWith\(\.\.\.el\.childNodes\);/);   // 풀기용 span[style] 껍데기는 벗겨요
    assert.match(read('src/geulkku-mart/edit-blocks.js'), /const RICH = \["B", "I", "STRONG", "EM", "S", "BR"\];/);
});

console.log(`\n${passed} 통과 · ${failed} 실패`);
if (failed) process.exit(1);
