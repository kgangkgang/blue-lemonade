// 1.7.9 버그 사냥 3 — 번역이 있는 답을 「접기」 한 뒤 채팅을 다시 열면 접기 틀이 깨지던 것.
//   번역기의 저장된 번역 고치기(repairShownTranslation → repairTagPairs)가 원문에 없는 <details> 를 첫 문단에서 닫아
//   「<details><summary></summary></details>\n\n본문\n\n」 이 됐어요(실제 채팅의 접힌 답 14개 중 13개 꼴). 가짜 글만 써요.
//   node tools/tests/fold-translation-repair.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const { repairTagPairs } = await load('src/addons/translator/translation-segments.js');
let F = {};
try { F = await load('src/fold-markup.js'); } catch { /* 고치기 전 판에는 없어요 */ }
const index = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
const mesFold = fs.readFileSync(path.join(root, 'src/mes-fold.js'), 'utf8');
let failed = 0;
const check = (name, fn) => { try { fn(); console.log('PASS', name); } catch (error) { failed++; console.log('FAIL', name, '—', error.message); } };

// 실제 꼴을 본뜬 지어낸 글: 영어 서술(점자 빈칸 대신 보통 빈칸) · 색 span 안 「」 대사 · 감싸개 <content>
const original = '<content>\n<span style="color:#335577">「Wait…!」</span>\n\nMira lowers the cup.\n\n<true_thoughts character="Mira">Too close.</true_thoughts>\n</content>';
const translation = '<content>\n<span style="color:#335577">「잠깐…!」</span>\n\n미라가 잔을 내려놓는다.\n\n<true_thoughts character="Mira">너무 가까워.</true_thoughts>\n</content>';
const HEAD = '<details><summary></summary>\n\n', TAIL = '\n\n</details>';
const W = s => HEAD + s + TAIL;
const broken = s => '<details><summary></summary></details>\n\n' + s + '\n\n';

check('재현: 짝 고치기는 접기 틀을 깨뜨려요(고치기 전 꼴)', () => {
    assert.equal(repairTagPairs(original, W(translation)), broken(translation));
});

check('keepFold: 접힌 번역문은 틀 안쪽만 고치고 틀은 그대로', () => {
    assert.equal(typeof F.keepFold, 'function', 'src/fold-markup.js keepFold 없음');
    assert.equal(F.keepFold(W(translation), body => repairTagPairs(original, body)), W(translation));
    // 안쪽의 진짜 깨짐(닫는 태그 빠짐)은 여전히 고쳐요
    const lost = translation.replace('</true_thoughts>', '');
    const fixed = F.keepFold(W(lost), body => repairTagPairs(original, body));
    assert.ok(fixed.startsWith(HEAD) && fixed.endsWith(TAIL), '틀 유지');
    assert.equal((fixed.match(/<\/true_thoughts>/g) || []).length, 1, '안쪽 닫는 태그 고침');
});

check('keepFold: 이미 깨진 틀은 접은 답(folded)에서만 되살려요 · 두 겹 깨짐도', () => {
    assert.equal(typeof F.keepFold, 'function');
    const id = s => s;
    assert.equal(F.keepFold(broken(translation), id, { folded: true, original }), W(translation));
    assert.equal(F.keepFold(broken(broken(translation)), id, { folded: true, original }), W(translation));
    assert.equal(F.keepFold(broken(translation), id, { folded: false, original }), broken(translation), '접지 않은 답은 그대로');
    const own = '<details><summary></summary></details>\n\n원문부터 이 꼴';
    assert.equal(F.keepFold(own, id, { folded: true, original: own }), own, '원문이 그렇게 시작하면 깨진 틀이 아님');
});

check('keepFold: 접지 않은 글은 transform 그대로', () => {
    assert.equal(typeof F.keepFold, 'function');
    assert.equal(F.keepFold(translation, s => s + '!'), translation + '!');
});

check('번역기 저장 번역 고치기가 keepFold 로 감싸요(bl_folded · 원문 보기 건너뜀)', () => {
    const body = index.slice(index.indexOf('function repairShownTranslation('), index.indexOf('function repairShownTranslations('));
    assert.ok(/keepFold\(shown,/.test(body), 'keepFold 안 씀');
    assert.ok(/folded: extra\.bl_folded === true/.test(body), 'bl_folded 넘김 없음');
    assert.ok(/shown === original\) return shown/.test(body), '접은 원문 보기 건너뜀 없음');
    assert.ok(/from '\.\.\/\.\.\/fold-markup\.js'/.test(index), 'import 없음');
});

check('펼치기(rewriteFold)도 깨진 틀을 먼저 되살려요', () => {
    assert.ok(/brokenFoldInner\(owner\[key\], message\.mes\)/.test(mesFold) && /bl_folded === true/.test(mesFold));
    assert.ok(/from '\.\/fold-markup\.js'/.test(mesFold));
});

check('CI 목록에 있어요', () => {
    const yml = fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8');
    assert.ok(yml.includes('node tools/tests/fold-translation-repair.mjs .'));
});

if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('fold-translation-repair: all passed');
