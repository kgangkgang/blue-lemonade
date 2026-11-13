#!/usr/bin/env node
// 11-13 마트 사본 mart/theme-take.js(테마가 이 틀을 받는지)가 테마 1.2.0 받기 검사와 글자까지 같은지 맞대요.
//   node tools/theme-take-test.mjs            (테마 사본: GK_THEME_DIR 또는 ../int-120 — 읽기만 해요 · 없으면 고정 자료 tools/theme-takeable.json 으로)
//   ① 선언 글자: 마트 사본의 「── 테마 파일 ──」 칸마다 같은 이름 선언이 테마 src 의 그 선언과 글자까지 같아요(테마가 바뀌면 깨져요 — 다시 옮겨요)
//   ② 417틀: 마트 사본 판정 = 테마 checkItem 판정(받음 · 못 받음 까닭 글까지)
//   ③ 견본: 받는 꼴 · 못 받는 꼴을 일부러 짠 틀(1.2.0 이 새로 받는 줄 갈래 · 칸 묶음 · 받지 않는 요소 · 크기 초과 …)도 테마와 같은 답
//   고정 자료의 code(선언 지문) · samples(견본 답)는 tools/theme-takeable-pull.mjs 가 이 파일의 PLAN · sampleSet 으로 떠요.
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict'; import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), DIR = path.join(ROOT, 'mart/data/geulkku');
const imp = f => import(pathToFileURL(f).href);

/** 테마 판정 코드 — 테마 src 파일 → 마트 사본으로 옮긴 선언 이름(차례 그대로) */
export const PLAN = {
    'log-copy-simple-tone.js': ['SIMPLE_CONTRACT', 'BASES', 'TN', 'FRAME_KEY', 'SPEAKER_CLASS', 'OWN_TYPES', 'ROOT_RE', 'rulesOf', 'selOf', 'bodyOf', 'modeOf', 'simpleFrameInfo', 'facesOf', 'speakerColorsOf', 'originalBase', 'mainLetterOf'],
    'log-copy-simple.js': ['SIMPLE', 'MODES', 'checkFrame', 'BAD_TAG', 'checkMore', 'splitFrame'],
    'log-copy-simple-more.js': ['fail', 'SOUND_WRAP', 'NRV', 'NMV', 'DECO', 'DLV', 'DELAY', 'whoClass', 'whoTags', 'varyRow', 'varyForms', 'VOID', 'parse', 'html', 'walk', 'is', 'isRow', 'blank', 'inside', 'pathOf', 'lca', 'drop', 'prune', 'cloneOf', 'setOpen', 'unitsOf', 'unitOf', 'hasText'],
    'log-copy-simple-frame.js': ['SAMPLE_TITLE', 'LOG', 'ROW', 'SOUND_LINE', 'NR', 'NM', 'DL', 'ROW_HEAD', 'plainRow', 'stripAlias', 'shutPeek', 'quietFrame', 'frameFromHtml', 'rowsFrame', 'unitsFrame', 'finish'],
    'mart-import.js': ['CUSTOM_MAX', 'text', 'idOk', 'nameOf', 'SIMPLE_HTML_MAX', 'SIMPLE_SET_MAX', 'SIMPLE_KEY', 'SIMPLE_BAD', 'checkSimple', 'HTML_WAY', 'SIMPLE_WHY'],
};
const HEAD = /^(?:export )?(?:async )?(?:function\*? |const |let |class )([\w$]+)/;
const STOP = /^(?:\/\/|\/\*|export |const |let |function |async |class |import )/;
/** 맨 위 선언 글(이름 → 글 · 앞 export 는 떼요). 선언은 다음 맨 앞 줄(주석 · 선언 · import)까지 */
export function decls(src) {
    const lines = String(src).replace(/\r\n/g, '\n').split('\n'), out = {};
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(HEAD);
        if (!m) continue;
        let j = i + 1;
        while (j < lines.length && !STOP.test(lines[j])) j++;
        if (m[1] in out) out[m[1]] = null;   // 같은 이름 두 번 — 맞대기 실패로
        else out[m[1]] = lines.slice(i, j).join('\n').replace(/\s+$/, '').replace(/^export /, '');
    }
    return out;
}
const sha = t => crypto.createHash('sha1').update(t).digest('hex').slice(0, 16);
/** 테마 src 폴더 → { 파일: { 이름: 지문 } } (고정 자료 code) */
export function codePrint(readSrc) {
    const out = {};
    for (const [file, names] of Object.entries(PLAN)) { const d = decls(readSrc(file)); out[file] = Object.fromEntries(names.map(n => [n, d[n] == null ? null : sha(d[n])])); }
    return out;
}
/** 마트 사본 → 「── 파일 ──」 칸마다 선언 */
export function martSections(src) {
    const out = {};
    for (const part of String(src).replace(/\r\n/g, '\n').split(/^\/\/ ── /m).slice(1)) {
        const file = part.slice(0, part.indexOf(' ──'));
        out[file] = decls(part.slice(part.indexOf('\n') + 1));
    }
    return out;
}

/** 마트 조각의 preview(꾸러미에 싣는 원래 판) */
export function loadPreviews() {
    const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8')), previews = {};
    for (const c of Object.values(index.chunks)) Object.assign(previews, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
    return { index, previews };
}
const nth = (s, find, n, put) => { let at = -1; for (let i = 0; i <= n; i++) { at = s.indexOf(find, at + 1); if (at < 0) return s; } return s.slice(0, at) + put + s.slice(at + find.length); };
const css1 = (h, rule) => h.replace(/\n\n/, `\n${rule}\n\n`);   // <style> ① 기본 덩이 끝에 규칙 하나
/**
 * 일부러 짠 견본 — [이름, { html, id, key }] (테마 · 마트 둘 다에 같은 것을 넣어요)
 * @param {Record<string, { preview: string }>} previews 마트 조각
 */
export function sampleSet(previews) {
    const P = id => previews[id].preview;
    const k1 = P('simple-k1'), base = { id: 'simple-k1', key: 'k1' };
    const s = (html, meta = base) => ({ html, ...meta });
    const real = id => s(P(id), { id, key: (P(id).match(/\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1] || '' });
    return [
        ['기본 틀 k1(한 꼴 줄)', s(k1)],
        ['둘째 쪽 틀 k3', real('simple-k3')],
        ['숨은 한 줄 틀 k5', real('simple-k5')],
        ['1.2.0 줄 갈래 틀 k1053', real('simple-k1053')],
        ['1.2.0 줄 갈래 끝 꾸밈 틀 k1079', real('simple-k1079')],
        ['1.2.0 칸 묶음 틀 k1101', real('simple-k1101')],
        ['1.2.0 칸 묶음 + 바깥 이름 k1192', real('simple-k1192')],
        ['1.2.0 줄 갈래(짠 것: 둘째 지문 줄에만 쓰는 덤 class)', s(css1(nth(k1, '<p class="gk-nr">', 1, '<p class="gk-nr gk-q2">'), '.gk-k1 .gk-q2{letter-spacing:.02em}'))],
        ['줄 차례 덤 class(규칙 없음 — 떼고 받아요)', s(nth(k1, '<p class="gk-nr">', 0, '<p class="gk-nr gk-w1">'))],
        ['못 받음: 상대 화자 색 없음 k1429', real('simple-k1429')],
        ['못 받음: 줄마다 꾸밈 k1435', real('simple-k1435')],
        ['못 받음: 제목 자리 없음 k1440', real('simple-k1440')],
        ['짠 것: 제목 글을 바꿈', s(k1.replace('비 그친 뒤, 옥상에서', '다른 제목'))],
        ['짠 것: 상대 화자 띠 색 규칙을 뺌', s(k1.replace(/\n\.gk-k1\.gk-t[ld] \.gk-dB\{[^}]*\}/g, ''))],
        ['짠 것: 숨은 한 줄 둘', s(k1.replace('<p class="gk-nr">', '<span class="gk-hl">하나</span><span class="gk-hl">둘</span>\n<p class="gk-nr">'))],
        ['받지 않는 요소 img', s(k1.replace('<p class="gk-nr">', '<img src="a.png"><p class="gk-nr">'))],
        ['받지 않는 요소 svg', s(k1.replace('<p class="gk-nr">', '<svg></svg><p class="gk-nr">'))],
        ['소리 카드 줄 밖 audio', s(k1.replace('<p class="gk-nr">', '<audio></audio><p class="gk-nr">'))],
        ['동작 속성 onclick', s(k1.replace('<p class="gk-nr">', '<p class="gk-nr" onclick="x()">'))],
        ['스크립트 주소', s(k1.replace('<p class="gk-nr">', '<a href="javascript:x()"></a><p class="gk-nr">'))],
        ['바깥 주소 그림', s(css1(k1, '.gk-k1 .gk-zz{background:url(https://example.com/a.png)}'))],
        ['@import', s(css1(k1, '@import "x.css";'))],
        ['크기 초과(60KB 넘음)', s(css1(k1, `.gk-k1 .gk-zz{--pad:"${'가'.repeat(60000)}"}`))],
        ['<style> 둘', s(k1.replace('<p class="gk-nr">', '<style>p{}</style><p class="gk-nr">'))],
        ['심플 꼴 아님(뿌리 class 없음)', s('<div><p>글</p></div>')],
        ['빈 HTML', s('   ')],
        ['열쇠가 HTML 과 다름', s(k1, { id: 'simple-k1', key: 'k2' })],
        ['열쇠 꼴 틀림', s(k1, { id: 'simple-k1', key: 'x1' })],
        ['id 꼴 틀림', s(k1, { id: '틀 하나', key: 'k1' })],
        ['뿌리 열쇠 없는 class', s(k1.replace(' gk-k1 ', ' '))],
    ];
}
/** 테마 checkItem 결과 → 고정 자료 글('받음' | 까닭) */
export const themeAnswer = (checkItem, { html, id, key }) => { const r = checkItem({ kind: 'geulkku-simple', v: 1, id, key, name: id, emoji: '', html, set: { blGeulkku: 2 } }); return r.item ? '받음' : r.reason; };
const martAnswer = (tt, { html, id, key }) => { const r = tt.themeTakeable(html, { id, key }); return r.ok ? '받음' : r.reason; };

// ── 시험 ──
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    let pass = 0, fail = 0;
    const test = async (name, fn) => { try { await fn(); pass++; console.log(`통과  ${name}`); } catch (e) { fail++; console.log(`실패  ${name}\n      ${String(e.message).split('\n').slice(0, 12).join('\n      ')}`); } };
    const tt = await imp(path.join(ROOT, 'mart/theme-take.js'));
    const sf = await imp(path.join(ROOT, 'mart/simple-frames.js'));
    const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/theme-takeable.json'), 'utf8'));
    const { index, previews } = loadPreviews();
    const martSrc = fs.readFileSync(path.join(ROOT, 'mart/theme-take.js'), 'utf8'), mine = martSections(martSrc);
    const themeDir = process.env.GK_THEME_DIR || path.resolve(ROOT, '../int-120');
    const has = fs.existsSync(path.join(themeDir, 'src/mart-import.js'));
    const readSrc = f => fs.readFileSync(path.join(themeDir, 'src', f), 'utf8');
    const samples = sampleSet(previews);

    await test('① 마트 사본의 칸 · 선언 차례가 PLAN 그대로(빠진 것 · 덤 · 겹친 이름 없음)', () => {
        assert.deepEqual(Object.keys(mine), [...Object.keys(PLAN), '마트 이음']);
        for (const [file, names] of Object.entries(PLAN)) assert.deepEqual(Object.keys(mine[file]), names, file);
        assert.ok(Object.values(mine).every(d => Object.values(d).every(v => v != null)), '같은 이름 두 번');
        assert.match(martSrc, /^import \{ speakerColor \} from '\.\/lib\/log-copy\/shared\/char-tone\.js\?v=\w+';/m);
        assert.equal((martSrc.match(/^import /gm) || []).length, 1, '수입은 char-tone 하나');
    });
    await test('① 선언 지문 = 고정 자료 code(테마 사본 없이도 — 마트 사본을 손으로 고치면 깨져요)', () => {
        const got = Object.fromEntries(Object.entries(PLAN).map(([f, names]) => [f, Object.fromEntries(names.map(n => [n, sha(mine[f][n])]))]));
        assert.deepEqual(got, fixture.code);
    });
    if (has) {
        await test(`① 선언 글자 = 테마 사본 src(${path.basename(themeDir)}) — 테마 판정 코드가 바뀌면 깨져요(다시 옮기고 고정 자료를 다시 떠요)`, () => {
            const diff = [];
            for (const [file, names] of Object.entries(PLAN)) { const d = decls(readSrc(file)); for (const n of names) if (d[n] !== mine[file][n]) diff.push(`${file} ${n}`); }
            assert.deepEqual(diff, []);
            assert.deepEqual(codePrint(readSrc), fixture.code, '고정 자료 code 가 테마 사본과 달라요 — tools/theme-takeable-pull.mjs 로 다시 떠요');
        });
        await test('① 테마 char-tone speakerColor = 마트 사본 수입처(lib/log-copy/shared/char-tone.js)', () => {
            assert.equal(decls(readSrc('shared/char-tone.js')).speakerColor, decls(fs.readFileSync(path.join(ROOT, 'mart/lib/log-copy/shared/char-tone.js'), 'utf8')).speakerColor);
        });
        await test('① 테마가 이 선언들을 이 이름으로 부르는 꼴 그대로(tone. · more. · checkFrame · frameFromHtml 수입)', () => {
            const frame = readSrc('log-copy-simple-frame.js'), imp1 = readSrc('mart-import.js');
            assert.match(frame, /^import \* as tone from '\.\/log-copy-simple-tone\.js';$/m);
            assert.match(frame, /^import \{ checkFrame \} from '\.\/log-copy-simple\.js';$/m);
            assert.match(frame, /^import \* as more from '\.\/log-copy-simple-more\.js';/m);
            assert.match(imp1, /^import \{ frameFromHtml \} from '\.\/log-copy-simple-frame\.js';/m);
            assert.match(imp1, /if \(kind === 'geulkku-simple'\) return checkSimple\(raw\);/);
            const used = new Set([...frame.matchAll(/(?<![\w-])(tone|more)\.(\w+)/g)].map(m => `${m[1]}.${m[2]}`));
            const glue = mine['마트 이음'];
            for (const u of used) { const [ns, name] = u.split('.'); assert.match(glue[ns], new RegExp(`[{ ,]${name}[ ,}]`), u); }
            const why = decls(imp1).simpleWhy;
            assert.equal(why.replace("\n    if (!hit) console.warn('[Blue Lemonade] 받지 못한 틀:', message);", ''), glue.simpleWhy, 'simpleWhy(콘솔 줄만 빼고 같아요)');
        });
    } else console.log('건너뜀  ① 테마 사본 선언 글자 맞대기 — 테마 사본이 없어요(GK_THEME_DIR) · 고정 자료 지문(code)이 대신 지켜요');

    await test(`② ${index.items.length}틀: 마트 사본 판정 = 고정 자료(테마 1.2.0 checkItem) — 받음 · 까닭 글자까지`, () => {
        const ok = new Set(fixture.ok), diff = [];
        for (const it of index.items) {
            const h = previews[it.id].preview, a = martAnswer(tt, { html: h, id: it.id, key: sf.simpleFrameInfo(h)?.key || '' });
            const want = ok.has(it.id) ? '받음' : fixture.no[it.id];
            if (a !== want) diff.push(`${it.id}: 마트 ${a} · 테마 ${want}`);
        }
        assert.deepEqual(diff, []);
        assert.equal(index.items.length, fixture.total);
    });
    if (has) await test(`② ${index.items.length}틀: 마트 사본 판정 = 테마 사본 checkItem 을 바로 돌린 것`, async () => {
        const { checkItem } = await imp(path.join(themeDir, 'src/mart-import.js')), diff = [];
        for (const it of index.items) {
            const h = previews[it.id].preview, x = { html: h, id: it.id, key: sf.simpleFrameInfo(h)?.key || '' };
            const a = martAnswer(tt, x), t = themeAnswer(checkItem, x);
            if (a !== t) diff.push(`${it.id}: 마트 ${a} · 테마 ${t}`);
        }
        assert.deepEqual(diff, []);
    });
    await test(`③ 견본 ${samples.length}개: 마트 사본 = 고정 자료 samples(테마 답)`, () => {
        assert.deepEqual(Object.keys(fixture.samples), samples.map(([n]) => n));
        const diff = samples.filter(([n, x]) => martAnswer(tt, x) !== fixture.samples[n]).map(([n, x]) => `${n}: 마트 ${martAnswer(tt, x)} · 테마 ${fixture.samples[n]}`);
        assert.deepEqual(diff, []);
    });
    if (has) await test(`③ 견본 ${samples.length}개: 마트 사본 = 테마 사본 checkItem`, async () => {
        const { checkItem } = await imp(path.join(themeDir, 'src/mart-import.js'));
        const diff = samples.filter(([, x]) => martAnswer(tt, x) !== themeAnswer(checkItem, x)).map(([n, x]) => `${n}: 마트 ${martAnswer(tt, x)} · 테마 ${themeAnswer(checkItem, x)}`);
        assert.deepEqual(diff, []);
    });
    await test('③ 견본 답이 겨눈 대로(새로 받는 꼴은 받음 · 막는 꼴은 그 까닭) · 짧은 까닭(why)은 끝의 「HTML 복사」 안내를 뗀 글', () => {
        const a = Object.fromEntries(samples.map(([n, x]) => [n, martAnswer(tt, x)]));
        for (const n of ['기본 틀 k1(한 꼴 줄)', '둘째 쪽 틀 k3', '숨은 한 줄 틀 k5', '1.2.0 줄 갈래 틀 k1053', '1.2.0 줄 갈래 끝 꾸밈 틀 k1079', '1.2.0 칸 묶음 틀 k1101', '1.2.0 칸 묶음 + 바깥 이름 k1192', '1.2.0 줄 갈래(짠 것: 둘째 지문 줄에만 쓰는 덤 class)', '줄 차례 덤 class(규칙 없음 — 떼고 받아요)']) assert.equal(a[n], '받음', n);
        assert.equal(a['받지 않는 요소 img'], '틀 안에 받지 않는 요소가 있어요');
        assert.equal(a['동작 속성 onclick'], '틀 안에 동작 속성(on…)이 있어요');
        assert.equal(a['크기 초과(60KB 넘음)'], '틀이 너무 커요(60KB 까지)');
        assert.equal(a['<style> 둘'], '심플 글꾸 꼴이 아니에요(class + <style> 하나)');
        assert.match(a['짠 것: 상대 화자 띠 색 규칙을 뺌'], /^상대 화자 색이 없는 틀이라/);
        assert.match(a['열쇠가 HTML 과 다름'], /^이 글꾸는 아직 테마가 받지 못해요 — /);
        const r = tt.themeTakeable(previews['simple-k1440'].preview, { id: 'simple-k1440', key: 'k1440' });
        assert.deepEqual(r, { ok: false, reason: fixture.no['simple-k1440'], why: '제목 자리를 찾지 못한 틀이에요' });
        assert.deepEqual(tt.themeTakeable(k1Of(previews), { id: 'simple-k1', key: 'x1' }), { ok: false, reason: '틀 열쇠가 틀려요', why: '틀 열쇠가 틀려요' });
    });
    console.log(`\n${pass} 통과 · ${fail} 실패`);
    process.exit(fail ? 1 : 0);
}
function k1Of(previews) { return previews['simple-k1'].preview; }
