#!/usr/bin/env node
// 글꾸 마트 「심플 새 틀」 길 시험(11-11 · DOM 없음 · node 24 · 외부 의존 없음)
//   node tools/geulkku-simple-test.mjs [--fast]
//   ① 톤 사다리 = 테마 toneLadder(같은 식 · 같은 값) · 사본의 기존 함수 그대로 ② 색 블록 갈아 끼우기(기대값 · 낮밤 · 되풀이) ③ 재생 선 필터 = song-templates.cjs
//   ④ 미리보기 열린 판 · 복사 글 닫힌 판 ⑤ HTML 복사 <style> 하나 ⑥ 깃발이 꺼져 있으면 목록 · 개수 · 기존 틀 출력이 바탕 커밋(4bc1cc4d)과 바이트까지 같아요
//   --fast: ⑥ 의 기존 틀 다시 칠하기 비교를 대사색 하나 · 밤 하나로 줄여요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MART = path.join(ROOT, 'mart');
const BASE = '4bc1cc4d';   // 이 분기의 바탕(공개판)
const FAST = process.argv.includes('--fast');
const imp = f => import(pathToFileURL(f).href);
const sf = await imp(path.join(MART, 'simple-frames.js'));
const ct = await imp(path.join(MART, 'lib/log-copy/shared/char-tone.js'));
const ip = await imp(path.join(MART, 'lib/log-copy/shared/ink-paint.js'));
const tg = await imp(path.join(MART, 'tone-geulkku.js'));
const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28 });

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`통과  ${name}`); }
    catch (e) { fail++; console.log(`실패  ${name}\n      ${String(e.message).split('\n').slice(0, 6).join('\n      ')}`); }
}

// 견본 틀: tools/simple-frames/sample-08-blind.html 을 생성기와 같은 길로(미리보기 판 — DEFS 에서 견본을 빼도 시험은 돌아요) · 목록 자료는 생성기가 쓴 것
const DIR = path.join(MART, 'data/geulkku');
const six = JSON.parse(fs.readFileSync(path.join(DIR, sf.SIMPLE_INDEX), 'utf8'));
const gen = await imp(path.join(ROOT, 'tools/geulkku-simple.mjs'));
const sample = gen.frameHtml(gen.SAMPLE_DEF).preview;
const styleOf = h => h.match(/<style>\n?([\s\S]*?)\n?<\/style>/)[1];
const partsOf = h => styleOf(h).split('\n\n');
const rootOf = h => h.match(/^<div class="([^"]*)"/)[1];
// mart.js 의 shutPeek 를 글 그대로 꺼내 써요(같은 식으로 닫히는지)
const shutSrc = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8').match(/export const shutPeek = (html => [^\n]+);\n/)[1];
const shutPeek = (0, eval)(shutSrc);

// 테마 시험의 기대값(codex/tone-ladder-113 tools/tests/char-tone-ladder.mjs CONFIRMED) + 보고서 6절 표
const CONFIRMED = {
    '#3aa7ff': { c100: '#e4f1fc', c300: '#95cefc', c500: '#3aa7ff', c700: '#0f6ab4', c900: '#10395a' },
    '#ff5fa2': { c100: '#fde9f1', c300: '#fda9cc', c500: '#ff5fa2', c700: '#c9105e', c900: '#651235' },
};
const TABLE = {
    '#3ccfbf': ['#e4f6f4', '#96e3da', '#3ccfbf', '#287d74', '#1a413c'], '#f0d878': ['#fbf8ed', '#f5e9b6', '#f0d878', '#bb9d24', '#5f521b'],
    '#b799e8': ['#f4f1fa', '#d8c8f1', '#b799e8', '#6837b7', '#3a245e'], '#d9363e': ['#f7e3e4', '#e89397', '#d9363e', '#852328', '#44181a'],
    '#c4ccd6': ['#f1f1f3', '#c9cacf', '#8b8e96', '#4c4e55', '#26272b'],
};
const COLORS = ['#3b9cf0', '#f0559a', '#5a78c8', '#86d84a', '#45c4b6', '#7ea4cc', '#e8d27a', '#f2603f', '#ad92de', '#f59a50', '#d9363e', '#86cfe0', '#6a72cf', '#2277cc', '#ffff00', '#fff3b0', '#f0d878', '#1b1f3a', '#3a0010', '#2c3e8f', '#c4ccd6', '#47505e', '#ffffff', '#000000', '#3aa7ff', '#ff5fa2'];

await test('톤 사다리: 확정 두 색 · 다른 색 다섯 단계가 테마 기대값 그대로 · 캐릭터 없음 = 무채 사다리', () => {
    for (const [K, want] of Object.entries(CONFIRMED)) assert.deepEqual({ ...ct.toneLadder(K) }, want, K);
    for (const [K, want] of Object.entries(TABLE)) assert.deepEqual(Object.values(ct.toneLadder(K)), want, K);
    for (const none of [null, '', 'nope', undefined]) assert.deepEqual({ ...ct.toneLadder(none) }, { c100: '#f1f1f3', c300: '#c9cacf', c500: '#8b8e96', c700: '#4c4e55', c900: '#26272b' });
});

const THEME = path.resolve(ROOT, '../tone-ladder-113/src/shared/char-tone.js');
await test('톤 사다리: 마트 사본 = 테마 codex/tone-ladder-113 char-tone.js(첫 줄 출처 주석만 다름 · 결과도 같음)', async () => {
    if (!fs.existsSync(THEME)) { console.log('      (테마 사본이 이 PC 에 없어 파일 대조는 건너뛰어요 — 기대값 시험이 대신 지켜요)'); return; }
    const mine = fs.readFileSync(path.join(MART, 'lib/log-copy/shared/char-tone.js'), 'utf8').split('\n').slice(1).join('\n');
    assert.equal(mine, fs.readFileSync(THEME, 'utf8'));
    const th = await imp(THEME);
    for (const K of COLORS) {
        assert.deepEqual({ ...ct.toneLadder(K) }, { ...th.toneLadder(K) }, K);
        for (const f of Object.keys(th.LADDER_SLOTS)) for (const m of ['light', 'dark']) assert.deepEqual(ct.ladderSlots(K, f, m), th.ladderSlots(K, f, m), `${K} ${f} ${m}`);
    }
});

// 바탕 커밋의 마트 모듈(옛 판)을 임시 폴더에 꺼내요 — 옛 사본과 새 사본의 결과를 맞대 봐요
const OLD = path.join(os.tmpdir(), `geulkku-simple-test-${BASE}`);
fs.mkdirSync(OLD, { recursive: true });
for (const f of ['mart/tone-state.js', 'mart/tone-geulkku.js', 'mart/lib/log-copy/shared/char-tone.js', 'mart/lib/log-copy/shared/ink-paint.js', 'mart/lib/log-copy/log-copy-lift.js', 'mart/lib/log-copy/log-copy-polish.js']) {
    const to = path.join(OLD, f); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, git('show', `${BASE}:${f}`));
}
const oldCt = await imp(path.join(OLD, 'mart/lib/log-copy/shared/char-tone.js'));

await test('char-tone.js 사본: 기존 함수(tone · fitInk · bandColor · oklch · over · speakerColor · 점검 두 개) 결과가 바탕 커밋과 같아요', () => {
    for (const K of [...COLORS, null, 'rgb(1,2,3)', '#f80']) for (const mode of ['light', 'dark']) {
        for (const plan of ['A', 'B', 'C']) {
            const a = ct.tone(K, { mode, plan }), b = oldCt.tone(K, { mode, plan });
            assert.deepEqual(a, b, `${K} ${mode} ${plan}`);
            assert.equal(ct.toneColorCount(a), oldCt.toneColorCount(b)); assert.deepEqual(ct.toneContrast(a), oldCt.toneContrast(b));
        }
        assert.equal(ct.bandColor(K, mode), oldCt.bandColor(K, mode));
        for (const bg of ['#ffffff', '#1c1e21', '#f3f1ec', '#13233b']) assert.equal(ct.fitInk(K, bg), oldCt.fitInk(K, bg));
        assert.deepEqual(ct.oklchOf(K || '#000'), oldCt.oklchOf(K || '#000')); assert.equal(ct.speakerColor(K), oldCt.speakerColor(K));
        assert.equal(ct.over('rgba(58,167,255,.18)', K || '#fff'), oldCt.over('rgba(58,167,255,.18)', K || '#fff'));
    }
    for (const k of Object.keys(oldCt)) assert.ok(k in ct, `${k} 가 사라졌어요`);
});

await test('재생 선 색 필터: simple-frames.js lineFilter = tools/song-templates.cjs lineFilter(같은 식)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'tools/song-templates.cjs'), 'utf8').match(/const lineFilter = (\(hex\) => \{[\s\S]*?\n\});/)[1];
    const orig = (0, eval)(src);
    for (const K of [...COLORS, '#3ccfbf', '#79A9D8', '', null, 'zz']) assert.equal(sf.lineFilter(K), orig(K), String(K));
    assert.equal(sf.lineFilter('#3ccfbf'), 'invert(.55) sepia(1) saturate(9) hue-rotate(120deg) brightness(0.92)');
});

const info0 = sf.simpleFrameInfo(sample);
await test('견본 틀 읽기: 08 · 원래 판 tx · 캐릭터 색 cv-bl(#3aa7ff) · 화자 A B · 소리 카드 A · <style> 세 덩이', () => {
    assert.equal(info0.no, 8); assert.equal(info0.base, 'gk-tx'); assert.equal(info0.cvName, 'bl'); assert.equal(info0.K0, '#3aa7ff');
    assert.deepEqual(info0.speakers, ['A', 'B']); assert.deepEqual(info0.soundBy, ['A']); assert.ok(info0.audio);
    assert.equal(partsOf(sample).length, 3);
    assert.equal((sample.match(/<style>/g) || []).length, 1);
});

const T = (K, mode) => sf.toneSimple(sample, K, { mode });
const rulesWith = (h, needle) => partsOf(h).join('\n').split('\n').filter(l => l.includes(needle));
const valueOf = (h, sel, prop) => { const line = partsOf(h).join('\n').split('\n').find(l => l.startsWith(sel + '{')); assert.ok(line, `규칙 없음 ${sel}`); return line.match(new RegExp(`${prop}:([^;}]+)`))[1]; };

await test('색 블록: 원래 색(파랑) · 원래 판(밤)으로 칠하면 소품 블록은 원래 값 그대로(이름표만 gk-cv-3aa7ff) · 기본 규칙은 한 글자도 안 바뀜', () => {
    const out = T('#3aa7ff', 'dark');
    assert.equal(rootOf(out), 'gk gk-tx gk-k8 gk-cv-3aa7ff');
    assert.equal(partsOf(out)[0], partsOf(sample)[0]);
    const prop0 = partsOf(sample)[2].split('.gk-cv-bl').join('.gk-cv-3aa7ff');
    assert.equal(partsOf(out)[2], prop0);
    assert.match(out, /color-scheme:dark/);
});

await test('색 블록: 분홍 · 낮 — 뿌리 gk-tl gk-tn-d · 소품 톤 다섯 단계가 분홍 사다리(테마 기대값) · 소리 카드 color-scheme:light', () => {
    const out = T('#ff5fa2', 'light'), P = CONFIRMED['#ff5fa2'], s = '.gk-k8.gk-cv-ff5fa2.gk-tn-d';
    assert.equal(rootOf(out), 'gk gk-tl gk-tn-d gk-k8 gk-cv-ff5fa2');
    assert.equal(valueOf(out, `${s} .gk-bl`, 'background-color'), P.c100);
    assert.equal(valueOf(out, `${s} .gk-bl span`, 'background-color'), P.c300);
    for (const x of ['gk-br', 'gk-cl', 'gk-dt']) assert.equal(valueOf(out, `${s} .${x}`, 'background-color'), P.c500);
    assert.equal(valueOf(out, `${s} .gk-cb`, 'background-color'), P.c700);
    assert.match(out, /<audio\b[^>]*color-scheme:light/); assert.doesNotMatch(out, /color-scheme:dark/);
    assert.equal((out.match(/<style>/g) || []).length, 1);
    assert.equal(partsOf(out)[0], partsOf(sample)[0]);
});

await test('색 블록: 민트 · 낮과 캐릭터 없음(무채 사다리 · gk-cv-none)', () => {
    const m = T('#3ccfbf', 'light'), s = '.gk-k8.gk-cv-3ccfbf.gk-tn-d';
    assert.equal(valueOf(m, `${s} .gk-bl`, 'background-color'), TABLE['#3ccfbf'][0]);
    assert.equal(valueOf(m, `${s} .gk-cb`, 'background-color'), TABLE['#3ccfbf'][3]);
    const n = T(null, 'light'), z = '.gk-k8.gk-cv-none.gk-tn-d';
    assert.equal(rootOf(n), 'gk gk-tl gk-tn-d gk-k8 gk-cv-none');
    assert.equal(valueOf(n, `${z} .gk-bl`, 'background-color'), '#f1f1f3');
    assert.equal(valueOf(n, `${z} .gk-br`, 'background-color'), '#8b8e96');
    assert.equal(valueOf(n, '.gk-k8.gk-cv-none.gk-tl .gk-nm.gk-nA', 'color'), ct.tone(null, { mode: 'light' }).text);
    assert.equal(rulesWith(n, 'media-controls-timeline{filter').length, 0);   // 무채는 선 필터 없음(마트 소리 카드와 같은 규칙)
});

await test('화자 색: 주인공 A = 캐릭터 색(이름 fitInk 4.6 · 띠 bandColor · 밑줄 · 이름표) · 다른 화자 B 는 틀의 원래 색(분홍) 그대로 · 낮 · 밤 두 판 다', () => {
    for (const K of ['#3aa7ff', '#3ccfbf', '#f0d878', '#b799e8', '#d9363e']) for (const mode of ['light', 'dark']) {
        const out = T(K, mode), cv = `.gk-k8.gk-cv-${K.slice(1)}`;
        for (const [b, m, [card, log]] of [['gk-tx', 'dark', sf.SIMPLE_CONTRACT.faces[8].orig], ['gk-tl', 'light', sf.SIMPLE_CONTRACT.faces[8].alt]]) {
            const name = valueOf(out, `${cv}.${b} .gk-nm.gk-nA`, 'color');
            assert.equal(name, ct.fitInk(K, log), `${K} ${b}`); assert.ok(ip.contrast(name, log) >= 4.6 - 0.01);
            assert.equal(valueOf(out, `${cv}.${b} .gk-dA`, 'background-color'), ct.bandColor(K, m));
            assert.equal(valueOf(out, `${cv}.${b} .gk-uA`, 'background-color'), ct.fitInk(K, card));
            const tag = valueOf(out, `${cv}.${b} .gk-sn.gk-sA`, 'background-color'), tagInk = valueOf(out, `${cv}.${b} .gk-sn.gk-sA`, 'color');
            assert.ok(ip.contrast(tagInk, tag) >= 4.6 - 0.01, `${K} ${b} 이름표 ${tagInk}/${tag}`);
            assert.equal(valueOf(out, `${cv}.${b} .gk-dB`, 'background-color'), ct.bandColor('#ff5fa2', m));
            assert.equal(valueOf(out, `${cv}.${b} .gk-nm.gk-nB`, 'color'), ct.fitInk('#ff5fa2', log));
            // 글자색 규칙은 fill 짝이 같아요
            for (const l of rulesWith(out, 'color:')) { const c = l.match(/(?:^|[{;])color:([^;}]+)/); if (c) assert.ok(l.includes(`-webkit-text-fill-color:${c[1]}`), l); }
        }
        assert.equal(rulesWith(out, 'media-controls-timeline{filter')[0].match(/filter:([^!]+)!/)[1], sf.lineFilter(K));
    }
});

await test('그 밖의 화자 표시(04 줄자의 gk-cA 커서 같은 것)도 그 화자 색 포인트로 다시 칠해요(면 · 선 = 틀 면 대비 4.6)', () => {
    const h = sample.replace('.gk-k8.gk-tl .gk-uA{background-color:#0a69ae}', '.gk-k8.gk-tl .gk-uA{background-color:#0a69ae}\n.gk-k8.gk-tl .gk-cA{background-color:#0a69ae}').replace('<div class="gk-ft">', '<div class="gk-ft"><span class="gk-cA"></span>');
    assert.notEqual(h, sample);
    assert.deepEqual([...sf.simpleFrameInfo(h).extra.c], ['background-color']);
    for (const K of ['#3ccfbf', '#ff5fa2']) {
        const out = sf.toneSimple(h, K, { mode: 'light' }), cv = `.gk-k8.gk-cv-${K.slice(1)}`;
        assert.equal(valueOf(out, `${cv}.gk-tl .gk-cA`, 'background-color'), ct.fitInk(K, '#ffffff'));
        assert.equal(valueOf(out, `${cv}.gk-tx .gk-cA`, 'background-color'), ct.fitInk(K, '#13233b'));
        assert.equal(rulesWith(out, '#0a69ae').length, 0, '옛 값이 남지 않아요');
    }
});

await test('되풀이: 칠한 판을 다시 칠해도 원래 판에서 바로 칠한 것과 같아요 · 캐릭터 색을 바꿔도 기본 규칙 덩이 그대로', () => {
    for (const [a, b] of [['#ff5fa2', '#3ccfbf'], [null, '#3aa7ff'], ['#d9363e', null]]) for (const m1 of ['light', 'dark']) for (const m2 of ['light', 'dark']) {
        assert.equal(sf.toneSimple(sf.toneSimple(sample, a, { mode: m1 }), b, { mode: m2 }), T(b, m2), `${a}/${m1} → ${b}/${m2}`);
    }
    const base = new Set(COLORS.slice(0, 8).map(K => partsOf(T(K, 'light'))[0]));
    assert.equal(base.size, 1);
});

await test('카드 미리보기: 08 은 details 를 열어 둔 판(data-bl-peek) · mart.js shutPeek 를 거친 복사 글은 원래 닫힌 판 · 칠해도 그대로', () => {
    assert.match(sample, /<details class="gk-bd" open="" data-bl-peek="">/);
    const shut = shutPeek(sample);
    assert.equal(shut, sample.replace(' open="" data-bl-peek=""', ''));
    assert.match(shut, /<details class="gk-bd">/); assert.doesNotMatch(shut, /data-bl-peek|\sopen[=\s>]/);
    assert.match(T('#ff5fa2', 'light'), /<details class="gk-bd" open="" data-bl-peek="">/);
    // 다른 틀 번호: 01 · 05 · 07 은 열고 02 · 03 · 04 · 06 은 그대로 · 이미 열린 건 두 번 안 달아요
    const fake = n => sample.replace('gk-k8', `gk-k${n}`).replace(' open="" data-bl-peek=""', '');
    for (const n of [1, 5, 7, 8]) assert.match(sf.peekSimple(fake(n)), /<details class="gk-bd" open="" data-bl-peek="">/, String(n));
    for (const n of [2, 3, 4, 6]) assert.equal(sf.peekSimple(fake(n)), fake(n), String(n));
    assert.equal(sf.peekSimple(sample), sample);
    assert.equal(sf.peekSimple('<p>아님</p>'), '<p>아님</p>');
});

await test('HTML 복사: 틀 <style> + 코멘트 빈칸 · 16px 규칙이 <style> 하나(감싸는 div 첫 자식) · 위아래 <p><br></p> · 붙일 꼴 점검 통과 · 두 번 걸어도 같음', () => {
    for (const h of [shutPeek(sample), shutPeek(T('#ff5fa2', 'light')), shutPeek(T(null, 'dark'))]) {
        const out = sf.simpleReady(h);
        assert.equal((out.match(/<style>/g) || []).length, 1, '<style> 하나');
        assert.match(out, /^<p><br><\/p><div class="gk [^"]*"><style>/);
        assert.match(out, /<\/div><p><br><\/p>$/);
        const css = styleOf(out.replace(/^<p><br><\/p>/, ''));
        assert.ok(css.startsWith('.gk-k8{box-sizing:border-box'), '틀 규칙이 앞');
        assert.ok(css.includes('.content>p,.blq-cm{') && css.includes('margin-top:16px!important'), '코멘트 · 16px 규칙');
        assert.ok(css.includes(partsOf(h)[2].split('\n')[0]), '색 블록도 그대로 들어감');
        assert.ok(tg.readyReport(out).ok);
        assert.equal(sf.simpleReady(out), out);
        // 예전 길(kkangtongReady 바로)이었다면 <style> 이 둘이 돼요 — 걸림돌 3
        assert.equal((tg.kkangtongReady(h).match(/<style>/g) || []).length, 2);
    }
});

await test('깃발: SIMPLE_FRAMES_ENABLED = false 면 받은 목록을 그대로(같은 객체 · simple-index.json 을 안 받아요) · 켜면 노래 앨범 뒤에 붙고 원래 목록은 안 바뀌어요', async () => {
    assert.equal(sf.SIMPLE_FRAMES_ENABLED, false);
    const raw = fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'), data = JSON.parse(raw);
    let called = 0;
    const same = await sf.withSimpleFrames(data, { load: async () => { called++; return six; } });
    assert.equal(same, data); assert.equal(called, 0); assert.equal(JSON.stringify(same), JSON.stringify(JSON.parse(raw)));
    const on = await sf.withSimpleFrames(data, { enabled: true, load: async () => six });
    assert.equal(on.count, data.count + six.items.length); assert.equal(on.items.length, data.items.length + six.items.length);
    const at = on.items.findIndex(x => x.simple), lastSong = data.items.map(x => x.category).lastIndexOf('song');
    assert.equal(at, lastSong + 1); assert.equal(on.items[at - 1].category, 'song');
    assert.equal(on.categories[on.categories.findIndex(c => c.id === 'song') + 1].id, 'simple-new');
    assert.ok(on.chunks['sp-simple'] && on.chunks['sg-song']);
    assert.equal(JSON.stringify(data), JSON.stringify(JSON.parse(raw)), '원래 목록 객체는 그대로');
    assert.equal(await sf.withSimpleFrames(data, { enabled: true, load: async () => { throw new Error('없음'); } }), data, '못 받으면 원래 목록');
});

await test('목록 자료: index.json · 기존 조각 · top-mart.js COUNTS 가 바탕 커밋과 바이트까지 같아요(새 파일은 simple-index.json · sp-simple 조각뿐)', () => {
    const changed = git('diff', '--name-status', BASE, '--', 'mart/data', 'mart/top-mart.js', 'index.html', 'mart/geulkku/index.html').toString().trim().split('\n').filter(Boolean);
    const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'mart/data').toString().trim().split('\n').filter(Boolean);
    const all = [...changed.map(l => l.split('\t').pop()), ...untracked];
    for (const f of all) assert.match(f, /^mart\/data\/geulkku\/(simple-index\.json|sp-simple\.[0-9a-f]{8}\.json(\.old)?)$/, `바뀐 파일 ${f}`);
    for (const l of changed) assert.match(l, /^A\t/, `기존 파일이 바뀜 ${l}`);
    assert.equal(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'), git('show', `${BASE}:mart/data/geulkku/index.json`).toString());
});

await test(`기존 틀 출력: 새 tone-state.js 의 다시 칠하기 대상 · 결과가 바탕 커밋과 같아요(공개 목록 전부 × ${FAST ? '대사색 1 × 밤' : '대사색 3 · 없음 × 낮밤'})`, async () => {
    const neu = await imp(path.join(MART, 'tone-state.js')), old = await imp(path.join(OLD, 'mart/tone-state.js'));
    const ix = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
    const chunks = new Map();
    const heavy = m => { if (!chunks.has(m.c)) chunks.set(m.c, JSON.parse(fs.readFileSync(path.join(DIR, ix.chunks[m.c].file), 'utf8')).items); return chunks.get(m.c)[m.id] || {}; };
    const items = ix.items.map(m => ({ ...m, ...heavy(m), kind: 'geulkku', label: m.name }));
    const cases = FAST ? [['#3aa7ff', 'dark']] : [['#3aa7ff', 'dark'], ['#3aa7ff', 'light'], ['#ff5fa2', 'light'], ['#c9d1dc', 'dark'], [null, 'dark'], [null, 'light']];
    let n = 0;
    for (const on of [true, false]) for (const [k, mode] of (on ? cases : [cases[0]])) {
        neu.setTone({ k, mode, on }); old.setTone({ k, mode, on });
        for (const it of items) {
            assert.equal(neu.toned(it), old.toned(it), `${it.id} toned`);
            if (!it.preview) continue;
            const a = neu.toneOut(it, it.preview), b = old.toneOut(it, it.preview); n++;
            if (a !== b) throw new Error(`${it.id} ${k} ${mode} 결과가 달라요`);
            if (on && neu.toned(it)) assert.equal(tg.kkangtongReady(a), tg.kkangtongReady(b));
        }
    }
    console.log(`      ${items.length}틀 · 비교 ${n}번`);
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
