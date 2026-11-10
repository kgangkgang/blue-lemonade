#!/usr/bin/env node
// 글꾸 마트 「심플 새 틀」 길 시험(11-11 · DOM 없음 · node 24 · 외부 의존 없음)
//   node tools/geulkku-simple-test.mjs [--fast]
//   ① 톤 사다리 = 테마 toneLadder(같은 식 · 같은 값) · 사본의 기존 함수 그대로 ② 색 블록 갈아 끼우기(원래 색 = 시안 그대로 · 다른 색 = 시안 식 · 낮밤 · 되풀이) ③ 재생 선 필터 = song-templates.cjs
//   ④ 실제 틀 여덟(이식판 그대로) ⑤ 미리보기 열린 판 · 복사 글 닫힌 판 ⑥ HTML 복사 <style> 하나 · 고칠 자리 주석
//   ⑦ 깃발 켬이 기본 — 첫 화면은 새 틀만 · 「옛날 버전」 목록 = 예전 첫 화면 목록 · 예전 목록 자료 · 기존 틀 출력이 바탕 커밋(4bc1cc4d)과 바이트까지 같아요
//   --fast: ⑦ 의 기존 틀 다시 칠하기 비교를 대사색 하나 · 밤 하나로 줄여요
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


// 시안 색 식: 심플-새틀-시안/make-isik.cjs 의 fit(HSL 명도 맞춤)을 글 그대로 꺼내 맞대 봐요(파일이 없으면 건너뛰어요)
const ISIK = 'C:/Users/USER/Documents/Codex/2026-10-24/w/outputs/지시-1110/심플-새틀-시안/make-isik.cjs';
const isikFit = fs.existsSync(ISIK) ? (() => { const s = fs.readFileSync(ISIK, 'utf8'); const a = s.indexOf('const h2rgb'), b = s.indexOf('const KA'); return new Function(`${s.slice(a, b)}; return fit;`)(); })() : null;

const info0 = sf.simpleFrameInfo(sample);
await test('견본 틀 읽기: 08 · 원래 판 tx · 캐릭터 색 cv-bl(#3aa7ff) · 화자 A B · 소리 카드 A · <style> 세 덩이', () => {
    assert.equal(info0.key, 'k8'); assert.equal(info0.no, 8); assert.equal(info0.base, 'gk-tx'); assert.equal(info0.cvName, 'bl'); assert.equal(info0.K0, '#3aa7ff');
    assert.deepEqual(info0.speakers, ['A', 'B']); assert.deepEqual(info0.soundBy, ['A']); assert.ok(info0.audio);
    assert.equal(partsOf(sample).length, 3);
    assert.equal((sample.match(/<style>/g) || []).length, 1);
});

const T = (K, mode) => sf.toneSimple(sample, K, { mode });
const rulesWith = (h, needle) => partsOf(h).join('\n').split('\n').filter(l => l.includes(needle));
const valueOf = (h, sel, prop) => { const line = partsOf(h).join('\n').split('\n').find(l => l.startsWith(sel + '{')); assert.ok(line, `규칙 없음 ${sel}`); return line.match(new RegExp(`${prop}:([^;}]+)`))[1]; };
const rename = (h, from, to) => h.split(`.gk-cv-${from}`).join(`.gk-cv-${to}`);

await test('시안 색 그대로: 틀을 만든 색(파랑)이면 낮 · 밤 어느 판이든 <style> 전체가 시안과 한 글자도 안 달라요(캐릭터 색 이름만 gk-cv-3aa7ff)', () => {
    for (const mode of ['dark', 'light']) {
        const out = T('#3aa7ff', mode);
        assert.equal(styleOf(out), rename(styleOf(sample), 'bl', '3aa7ff'), mode);
        assert.equal(rootOf(out), mode === 'dark' ? 'gk gk-tx gk-k8 gk-cv-3aa7ff' : 'gk gk-tl gk-tn-d gk-k8 gk-cv-3aa7ff');
        assert.match(out, new RegExp(`color-scheme:${mode}`));
    }
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
    assert.equal(valueOf(n, '.gk-k8.gk-cv-none.gk-tl .gk-nm.gk-nA', 'color'), '#26272b');
    assert.equal(rulesWith(n, 'media-controls-timeline{filter').length, 0);   // 무채는 선 필터 없음(마트 소리 카드와 같은 규칙)
});

await test('화자 색(다른 캐릭터): 주인공 A = 시안 식(HSL 명도 맞춤 4.6 = make-isik fit · 띠 rgba .18 · 밑줄 · 이름표 대비 4.6) · 다른 화자 B 는 시안 규칙 그대로 · 낮 · 밤 두 판 다', () => {
    for (const K of ['#3ccfbf', '#f0d878', '#b799e8', '#d9363e', '#ff5fa2']) for (const mode of ['light', 'dark']) {
        const out = T(K, mode), cv = `.gk-k8.gk-cv-${K.slice(1)}`;
        for (const [b, [card, log]] of [['gk-tx', sf.SIMPLE_CONTRACT.faces.k8.orig], ['gk-tl', sf.SIMPLE_CONTRACT.faces.k8.alt]]) {
            const name = valueOf(out, `${cv}.${b} .gk-nm.gk-nA`, 'color');
            assert.equal(name, sf.sianFit(K, log), `${K} ${b}`); assert.ok(ip.contrast(name, log) >= 4.6 - 0.01);
            if (isikFit) assert.equal(sf.sianFit(K, log), isikFit(K, log), 'make-isik fit 과 같은 식');
            assert.equal(valueOf(out, `${cv}.${b} .gk-dA`, 'background-color'), `rgba(${[1, 3, 5].map(i => parseInt(K.slice(i, i + 2), 16)).join(',')},.18)`);
            assert.equal(valueOf(out, `${cv}.${b} .gk-uA`, 'background-color'), sf.sianFit(K, card));
            const tag = valueOf(out, `${cv}.${b} .gk-sn.gk-sA`, 'background-color'), tagInk = valueOf(out, `${cv}.${b} .gk-sn.gk-sA`, 'color');
            assert.ok(ip.contrast(tagInk, tag) >= 4.6 - 0.01, `${K} ${b} 이름표 ${tagInk}/${tag}`);
            // 글자색 규칙은 fill 짝이 같아요
            for (const l of rulesWith(out, 'color:')) { const c = l.match(/(?:^|[{;])color:([^;}]+)/); if (c) assert.ok(l.includes(`-webkit-text-fill-color:${c[1]}`), l); }
        }
        for (const l of ['.gk-k8.gk-tl .gk-dB{background-color:rgba(255,95,162,.18)}', '.gk-k8.gk-tl .gk-nm.gk-nB{color:#c81e6a;-webkit-text-fill-color:#c81e6a}', '.gk-k8.gk-tx .gk-nm.gk-nB{color:#ff5fa2;-webkit-text-fill-color:#ff5fa2}']) assert.ok(styleOf(out).includes(l), `B 시안 그대로 ${l}`);
        assert.equal(rulesWith(out, 'media-controls-timeline{filter').filter(l => l.includes('hue-rotate(162deg)')).length, 0, '옛 파랑 선 필터가 남지 않아요');
        assert.equal(rulesWith(out, 'media-controls-timeline{filter')[0].match(/filter:([^!]+)!/)[1], sf.lineFilter(K));
    }
});

await test('그 밖의 화자 표시(04 줄자의 gk-cA 커서 같은 것)도 그 화자 색 포인트로 다시 칠해요(면 · 선 = 틀 면 대비 4.6)', () => {
    const h = sample.replace('.gk-k8.gk-tl .gk-uA{background-color:#0a69ae}', '.gk-k8.gk-tl .gk-uA{background-color:#0a69ae}\n.gk-k8.gk-tl .gk-cA{background-color:#0a69ae}').replace('<div class="gk-ft">', '<div class="gk-ft"><span class="gk-cA"></span>');
    assert.notEqual(h, sample);
    assert.deepEqual([...sf.simpleFrameInfo(h).extra.c], ['background-color']);
    for (const K of ['#3ccfbf', '#ff5fa2']) {
        const out = sf.toneSimple(h, K, { mode: 'light' }), cv = `.gk-k8.gk-cv-${K.slice(1)}`;
        assert.equal(valueOf(out, `${cv}.gk-tl .gk-cA`, 'background-color'), sf.sianFit(K, '#ffffff'));
        assert.equal(valueOf(out, `${cv}.gk-tx .gk-cA`, 'background-color'), sf.sianFit(K, '#13233b'));
        assert.equal(rulesWith(out, '#0a69ae').length, 0, '옛 값이 남지 않아요');
    }
    assert.ok(styleOf(sf.toneSimple(h, '#3aa7ff', { mode: 'light' })).includes('.gk-k8.gk-tl .gk-cA{background-color:#0a69ae}'), '원래 색이면 시안 값 그대로');
});

await test('되풀이: 다른 색으로 칠한 판을 또 다른 색으로 칠해도 원래 판에서 바로 칠한 것과 같아요 · 캐릭터 색을 바꿔도 기본 규칙 덩이 그대로', () => {
    for (const [a, b] of [['#ff5fa2', '#3ccfbf'], [null, '#d9363e'], ['#d9363e', null]]) for (const m1 of ['light', 'dark']) for (const m2 of ['light', 'dark']) {
        assert.equal(sf.toneSimple(sf.toneSimple(sample, a, { mode: m1 }), b, { mode: m2 }), T(b, m2), `${a}/${m1} → ${b}/${m2}`);
    }
    const base = new Set(COLORS.slice(0, 8).map(K => partsOf(T(K, 'light'))[0]));
    assert.equal(base.size, 1);
});

// ── 들어간 실제 틀 스물여덟(첫 묶음 8 · 둘째 5 · 셋째 5 · 대표 10) ──
const sfx = JSON.parse(fs.readFileSync(path.join(DIR, six.chunks['sp-simple'].file), 'utf8')).items;
const OUTS = 'C:/Users/USER/Documents/Codex/2026-10-24/w/outputs/지시-1110';
const ISIKS = ['심플-새틀-시안', '심플-새틀-시안-2', '심플-새틀-시안-3', '심플-기존틀-새방식'].map(d => `${OUTS}/${d}/이식판.html`);
// 틀 → [이름, 분류, 미리보기 열림] (열림은 각 이식판 설명서 표 · 분류: open 눌러서 열어요 · tap 누르면 바뀌어요 · sound 소리 카드 · still 가만히 보기)
const WANT = {
    k1: ['낫표', 'open', true], k2: ['견출지', 'sound', false], k3: ['바인더', 'tap', false], k4: ['줄자', 'tap', false], k5: ['티백', 'tap', true], k6: ['음성 메모', 'sound', false], k7: ['성냥', 'tap', true], k8: ['블라인드', 'open', true],
    k09: ['지퍼', 'open', true], k10: ['모래시계', 'open', true], k11: ['실 전화', 'sound', true], k12: ['돋보기', 'tap', false], k13: ['형광펜', 'tap', true],
    k14: ['쥘부채', 'open', true], k15: ['뉴턴의 요람', 'sound', false], k16: ['지우개', 'tap', false], k17: ['바람개비', 'sound', false], k18: ['토스터', 'open', true],
    q01: ['여름 바다', 'still', false], q02: ['흐림', 'sound', false], q03: ['새해 첫날', 'tap', true], q04: ['새벽', 'tap', true], q05: ['메신저', 'sound', false],
    q06: ['편지 봉투', 'open', true], q07: ['호박', 'tap', true], q08: ['라면', 'tap', false], q09: ['카페 영수증', 'tap', true], q10: ['RPG 스탯', 'sound', false],
};
await test('실제 틀 스물여덟: 이식판 원래 판과 한 글자도 안 다르게 들어갔고(소리 카드 src · 미리보기 열림만 다름) · 이름 · 분류 · 미리보기 열림 · 설명이 자리 채움이 아님', () => {
    assert.deepEqual(six.items.map(x => x.id), Object.keys(WANT).map(k => `simple-${k}`));
    assert.equal(six.count, 28);
    assert.deepEqual(six.categories.map(c => c.label), ['눌러서 열어요', '누르면 바뀌어요', '소리 카드', '가만히 보기']);
    const isik = ISIKS.filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).join('\n');
    for (const row of six.items) {
        const k = row.id.slice(7), [name, cat, peek] = WANT[k], p = sfx[row.id].preview;
        assert.equal(row.name, name); assert.equal(row.category, `simple-${cat}`, k); assert.ok(row.simple && row.copyOnly && row.photo && row.style === '심플');
        assert.equal(/data-bl-peek/.test(p), peek, `${k} 미리보기 열림`);
        assert.equal(row.audio === true, /<audio\b/.test(p));
        assert.ok(row.desc && !/심플 새 틀$/.test(row.desc), `${k} 설명`);
        if (isik) {   // 소리 카드 src · class · preload 와 미리보기 열림만 빼면 이식판 그 틀과 같아요
            const orig = shutPeek(p).replace(/<audio class="uploaded-audio" src="[^"]*" controls preload="metadata"/g, '<audio controls preload="none"');
            assert.ok(isik.includes(orig), `${k} 이식판과 다름`);
        }
    }
});

// 원래 주인공 색에서 나온 값(색 · 사다리 다섯 · rgb 셋 — # · 그림 안 %23 · rgb%28 꼴)이 다른 색으로 칠한 뒤 색 블록에 남는지(같은 색을 쓰는 다른 화자 몫은 빼요)
const bandColors = h => { const o = {}; for (const m of styleOf(h).matchAll(/\.gk-d([A-Z])\{background-(?:color:\s*rgba?\(|image:[^}]*?rgba?%28)(\d+),\s*(\d+),\s*(\d+)/g)) o[m[1]] ??= '#' + [m[2], m[3], m[4]].map(v => (+v).toString(16).padStart(2, '0')).join(''); return o; };
const leftovers = (p, t) => {
    const info = sf.simpleFrameInfo(p), others = Object.values(bandColors(p)).filter(c => c !== info.K0);
    const keep = new Set(others.flatMap(c => [c, ...Object.values(ct.toneLadder(c))]));
    const css = partsOf(t).slice(1).join('\n').toLowerCase(), out = [];
    for (const v of new Set([info.K0, ...Object.values(ct.toneLadder(info.K0))])) if (!keep.has(v) && (css.includes(v) || css.includes(`%23${v.slice(1)}`))) out.push(v);
    const rgb = [1, 3, 5].map(i => parseInt(info.K0.slice(i, i + 2), 16));
    if (!others.includes(info.K0) && [`(${rgb.join(',')},`, `(${rgb.join(', ')},`, `rgb%28${rgb.join(',')}%29`].some(x => css.includes(x))) out.push(`rgb ${rgb}`);
    return out;
};
await test('실제 틀 스물여덟: 원래 색이면 낮 · 밤 모두 시안 그대로 · 다른 색 · 캐릭터 없음 × 낮밤에서 옛 주인공 색 값 0 · <style> 하나 · 기본 규칙 그대로 · 되풀이 · 복사 글 <style> 하나 · 주석 안 겹침', () => {
    for (const row of six.items) {
        const p = sfx[row.id].preview, info = sf.simpleFrameInfo(p);
        for (const mode of ['light', 'dark']) assert.equal(styleOf(sf.toneSimple(p, info.K0, { mode })), rename(styleOf(p), info.cvName, info.K0.slice(1)), `${row.id} ${mode} 시안 그대로`);
        for (const K of ['#3ccfbf', '#f0d878', '#d9363e', null]) for (const mode of ['light', 'dark']) {
            const t = sf.toneSimple(p, K, { mode });
            assert.deepEqual(leftovers(p, t), [], `${row.id} ${K} ${mode} 옛 주인공 색이 남음`);
            assert.equal((t.match(/<style>/g) || []).length, 1);
            assert.equal(partsOf(t)[0], partsOf(p)[0], `${row.id} 기본 규칙 그대로`);
            if (K) assert.equal(sf.toneSimple(sf.toneSimple(p, '#b799e8', { mode: 'dark' }), K, { mode }), t, `${row.id} 되풀이`);
            const c = sf.simpleReady(shutPeek(t));
            assert.equal((c.match(/<style>/g) || []).length, 1); assert.ok(tg.readyReport(c).ok);
            assert.doesNotMatch(c, /<!--\s*✎[^>]*-->\s*<!--\s*✎/, `${row.id} 주석 겹침`);
        }
    }
    // 05 티백 낮 · 민트: 주인공 M 이름 = 시안 식 fit(민트, 로그 면 #f3f1ec) — 시안 「캐릭터 색 비교 줄」과 같은 식
    const t5 = sf.toneSimple(sfx['simple-k5'].preview, '#3ccfbf', { mode: 'light' });
    assert.equal(valueOf(t5, '.gk-k5.gk-cv-3ccfbf.gk-tl .gk-nm.gk-nM', 'color'), sf.sianFit('#3ccfbf', '#f3f1ec'));
    if (isikFit) assert.equal(sf.sianFit('#3ccfbf', '#f3f1ec'), isikFit('#3ccfbf', '#f3f1ec'));
    // 주인공: 12 돋보기 · 16 지우개 · 03 바인더 는 분홍 B, 05 · 07 은 M, 나머지는 A(틀 캐릭터 색과 같은 띠의 화자)
    for (const [id, X] of [['simple-k12', 'B'], ['simple-k16', 'B'], ['simple-k3', 'B'], ['simple-k5', 'M'], ['simple-k09', 'A']]) assert.ok(styleOf(sf.toneSimple(sfx[id].preview, '#3ccfbf', { mode: 'light' })).includes(`.gk-d${X}{background-color:rgba(60,207,191,.18)}`), `${id} 주인공 ${X}`);
});

await test('고친 조각 넷: 09 쐐기 그림(%23) · 09 밤 안감(사다리 밖 식) · 13 형광 띠(그림으로 긋는 띠 — 원래 색 · 다른 색 모두 그림 규칙 그대로 · 바탕색 띠를 안 만듦) · 15 번쩍임 키프레임 색', () => {
    const k09 = sfx['simple-k09'].preview, m09 = sf.toneSimple(k09, '#3ccfbf', { mode: 'dark' });
    assert.ok(styleOf(k09).includes('#0a1b28'));
    const deep = (K) => { const n = parseInt(K.slice(1), 16), [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, s = d / (1 - Math.abs(2 * l - 1)), h = (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; const S = s * 0.6, L = l * 0.16, C = (1 - Math.abs(2 * L - 1)) * S, X = C * (1 - Math.abs((h / 60) % 2 - 1)), M = L - C / 2; const [a, bb, c] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X]; return '#' + [a, bb, c].map(v => Math.round((v + M) * 255).toString(16).padStart(2, '0')).join(''); };
    assert.equal(deep('#3aa7ff'), '#0a1b28', '식이 시안 안감 값을 다시 만들어요');
    assert.ok(styleOf(m09).includes(`.gk-k09.gk-cv-3ccfbf.gk-tn-n .gk-gp{background-color:${deep('#3ccfbf')}}`));
    assert.doesNotMatch(styleOf(m09), /0a1b28|%23e4f1fc|%2395cefc|%230f6ab4|%2310395a/i);
    const k13 = sfx['simple-k13'].preview;
    for (const [K, rgb] of [['#3aa7ff', '58,167,255'], ['#3ccfbf', '60,207,191'], [null, '139,142,150']]) for (const mode of ['light', 'dark']) {
        const t = sf.toneSimple(k13, K, { mode });
        assert.match(styleOf(t), new RegExp(`\\.gk-k13 \\.gk-dA\\{background-image:[^}]*rgb%28${rgb}%29`), `${K} ${mode} 형광 띠 그림`);
        assert.match(styleOf(t), /\.gk-k13 \.gk-dB\{background-image:[^}]*rgb%28255,95,162%29/);
        assert.doesNotMatch(styleOf(t), /\.gk-d[AB]\{background-color:rgba/, '바탕색 띠를 새로 깔지 않아요');
        assert.match(styleOf(t), /background-size:0% 100%/, '긋는 움직임 그대로');
    }
    const t15 = sf.toneSimple(sfx['simple-k15'].preview, '#3ccfbf', { mode: 'light' });
    assert.match(styleOf(t15), /@keyframes gk-ba-tl\{[^}]*rgba\(60,207,191,/);
    assert.doesNotMatch(styleOf(t15), /rgba\(58,167,255,/);
    assert.match(styleOf(t15), /@keyframes gk-bb-tl\{[^}]*rgba\(255,95,162,/, '다른 화자 번쩍임은 그대로');
});

await test('대표 10: 09 영수증 종이는 캐릭터 색 · 낮밤과 상관없이 흰 종이 · 틀이 단 「✎」 주석은 그대로(두 번 안 달아요) · 10 레벨 글자도 캐릭터 색으로', () => {
    const q09 = sfx['simple-q09'].preview;
    const paper = h => styleOf(h).split('\n').filter(l => /\.gk-q09 \.gk-pb\{/.test(l)).join();
    assert.match(paper(q09), /#ffffff/);
    for (const K of ['#3ccfbf', '#d9363e', null]) for (const mode of ['light', 'dark']) assert.equal(paper(sf.toneSimple(q09, K, { mode })), paper(q09), `${K} ${mode}`);
    const c = sf.simpleReady(shutPeek(sf.toneSimple(q09, '#3ccfbf', { mode: 'dark' })));
    const marks = s => (s.match(/<!-- ✎/g) || []).length;
    assert.equal(c.split('<!-- ✎ 가게 이름 -->').length - 1, 1);
    assert.ok(marks(c) >= marks(q09), '틀 주석이 다 남아요');
    assert.doesNotMatch(c, /<!--\s*✎[^>]*-->\s*<!--\s*✎/);
    const q10 = sf.toneSimple(sfx['simple-q10'].preview, '#3ccfbf', { mode: 'light' });
    assert.doesNotMatch(styleOf(q10), /0075d3/i);
    assert.match(styleOf(q10), new RegExp(`\\.gk-vA\\{color:${sf.sianFit('#3ccfbf', '#f5f5f6')}`));
});

await test('개수 · 머리말: 마트 메뉴 COUNTS.geulkku · 홈 「N종」 · 글꾸 마트 머리말 「N개」 = 새 틀 수 · 예전 수는 COUNTS.geulkkuAll(= index.json count)', () => {
    const top = fs.readFileSync(path.join(MART, 'top-mart.js'), 'utf8'), ix = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
    assert.match(top, new RegExp(`const COUNTS = \\{ frames: 1448, geulkku: ${six.count}, geulkkuAll: ${ix.count} \\}`));
    assert.match(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), new RegExp(`<b>글꾸 마트</b><p>새 글꾸 틀 ${six.count}종`));
    assert.match(fs.readFileSync(path.join(MART, 'geulkku/index.html'), 'utf8'), new RegExp(`<p class="mart-lede">새 글꾸 틀 ${six.count}개예요\\.`));
});

await test('카드 미리보기: 08 은 details 를 열어 둔 판(data-bl-peek) · mart.js shutPeek 를 거친 복사 글은 원래 닫힌 판 · 칠해도 그대로', () => {
    assert.match(sample, /<details class="gk-bd" open="" data-bl-peek="">/);
    const shut = shutPeek(sample);
    assert.equal(shut, sample.replace(' open="" data-bl-peek=""', ''));
    assert.match(shut, /<details class="gk-bd">/); assert.doesNotMatch(shut, /data-bl-peek|\sopen[=\s>]/);
    assert.match(T('#ff5fa2', 'light'), /<details class="gk-bd" open="" data-bl-peek="">/);
    const fake = n => sample.replace('gk-k8', `gk-k${n}`).replace(' open="" data-bl-peek=""', '');
    for (const n of [1, 5, 7, 8]) assert.match(sf.peekSimple(fake(n)), /<details class="gk-bd" open="" data-bl-peek="">/, String(n));
    for (const n of [2, 3, 4, 6]) assert.equal(sf.peekSimple(fake(n)), fake(n), String(n));
    assert.match(sf.peekSimple(fake(2), true), /data-bl-peek/, 'DEFS 의 peek 로 따로 정해요');
    assert.equal(sf.peekSimple(fake(8), false), fake(8));
    assert.equal(sf.peekSimple(sample), sample);
    assert.equal(sf.peekSimple('<p>아님</p>'), '<p>아님</p>');
});

await test('HTML 복사: <style> 하나(감싸는 div 첫 자식 · 틀 규칙 + 코멘트 · 16px) · 그 뒤 안내 주석 한 줄 · 고칠 자리마다 「✎」 주석 · 위아래 <p><br></p> · 두 번 걸어도 같음', () => {
    for (const h of [shutPeek(sample), shutPeek(T('#ff5fa2', 'light')), shutPeek(T(null, 'dark'))]) {
        const out = sf.simpleReady(h);
        assert.equal((out.match(/<style>/g) || []).length, 1, '<style> 하나');
        assert.match(out, /^<p><br><\/p><div class="gk [^"]*"><style>/);
        assert.match(out, /<\/div><p><br><\/p>$/);
        const css = styleOf(out.replace(/^<p><br><\/p>/, ''));
        assert.ok(css.startsWith('.gk-k8{box-sizing:border-box'), '틀 규칙이 앞');
        assert.ok(css.includes('.content>p,.blq-cm{') && css.includes('margin-top:16px!important'), '코멘트 · 16px 규칙');
        assert.ok(css.includes(partsOf(h)[2].split('\n')[0]), '색 블록도 그대로 들어감');
        assert.match(out, /<\/style>\n<!-- ▲ 위 스타일 칸은 틀 모양 · 색이에요[^\n]*-->\n/);
        for (const [mark, n] of [['제목', 1], ['지문', 2], ['화자 이름', 2], ['대사', 2], ['소리 카드', 1]]) assert.equal(out.split(`<!-- ✎ ${mark}`).length - 1, n, mark);
        assert.match(out, /<!-- ✎ 제목 --><span class="gk-tt">/);
        assert.match(out, /\n<!-- ✎ 지문 --><p class="gk-nr">/);
        assert.ok(tg.readyReport(out).ok);
        assert.equal(sf.simpleReady(out), out);
        // 주석을 빼면 글은 주석 달기 전과 같아요(화면에 보이는 것은 안 바뀌어요)
        assert.equal(out.replace(/<!-- ✎ [^>]*-->/g, '').replace(/\n<!-- ▲[^\n]*-->\n/, ''), tg.kkangtongReady(sf.hoistStyle(h)));
        // 예전 길(kkangtongReady 바로)이었다면 <style> 이 둘이 돼요 — 걸림돌 3
        assert.equal((tg.kkangtongReady(h).match(/<style>/g) || []).length, 2);
    }
});

await test('깃발: SIMPLE_FRAMES_ENABLED = true(새 기본) · 새 틀이 목록 앞에 · 끄면 받은 목록 그대로(같은 객체 · 안 받아요) · 못 받으면 원래 목록', async () => {
    assert.equal(sf.SIMPLE_FRAMES_ENABLED, true);
    const raw = fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'), data = JSON.parse(raw);
    let called = 0;
    const off = await sf.withSimpleFrames(data, { enabled: false, load: async () => { called++; return six; } });
    assert.equal(off, data); assert.equal(called, 0);
    const on = await sf.withSimpleFrames(data, { load: async () => six });
    assert.equal(on.count, data.count + six.items.length); assert.equal(on.items.length, data.items.length + six.items.length);
    assert.deepEqual(on.items.slice(0, six.items.length).map(x => x.id), six.items.map(x => x.id));
    assert.deepEqual(on.items.slice(six.items.length), data.items, '예전 목록은 차례 · 내용 그대로 뒤에');
    assert.deepEqual(on.categories.slice(0, six.categories.length), six.categories);
    assert.ok(on.chunks['sp-simple'] && on.chunks['sg-song']);
    assert.equal(JSON.stringify(data), JSON.stringify(JSON.parse(raw)), '원래 목록 객체는 그대로');
    assert.equal(await sf.withSimpleFrames(data, { load: async () => { throw new Error('없음'); } }), data, '못 받으면 원래 목록');
});

// 바탕 커밋 mart.js 의 「심플만 남기돼」 목록 규칙을 글 그대로 꺼내 돌려요 — 옛날 버전 목록이 예전 첫 화면 목록과 같아야 해요
const baseMart = git('show', `${BASE}:mart/mart.js`).toString();
const oldRule = baseMart.slice(baseMart.indexOf('    const keepIds = new Set();'), baseMart.indexOf('\n', baseMart.indexOf('    const shownItems ='))).replace(/\n\s*const hashId = [^\n]+/, '');   // 주소 읽기 줄만 빼고(시험이 넘겨 줘요)
const oldStyleOf = new Function(`${baseMart.match(/const STYLE_DEFAULT = [^\n]+/)[0]}\n${baseMart.match(/const STYLE_ALIAS = [^\n]+/)[0]}\nreturn ${baseMart.match(/const styleOf = ([^\n]+);/)[1]};`)();
const oldShown = (items, hashId = '', showAll = false) => new Function('items', 'styleOf', 'hashId', 'SHOW_ALL_DESIGNS', 'kind', `${oldRule}\nreturn shownItems;`)(items, oldStyleOf, hashId, showAll, 'geulkku');
await test('옛날 버전: 첫 화면은 새 틀(스물여덟)만 · 「옛날 버전」 목록은 예전 첫 화면 목록(447)과 차례까지 같아요 · 주소 #예전글꾸 로 오면 펼친 채 · 새 틀 주소는 접힌 채', async () => {
    const data = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
    const merged = await sf.withSimpleFrames(JSON.parse(JSON.stringify(data)), { load: async () => six });
    const v = sf.splitView(merged.items, { styleOf: oldStyleOf });
    assert.deepEqual(v.fresh.map(x => x.id), six.items.map(x => x.id));
    assert.equal(v.openOld, false);
    const before = oldShown(data.items);
    assert.equal(before.length, 447);
    assert.deepEqual(v.old.map(x => x.id), before.map(x => x.id));
    assert.ok(v.old.every(x => !x.simple) && v.fresh.every(x => x.simple));
    // 숨긴 디자인(예: 다꾸) 주소로 오면 그 디자인도 옛날 버전 목록에 · 펼친 채
    const hidden = data.items.find(x => !before.some(y => y.id === x.id));
    const vh = sf.splitView(merged.items, { styleOf: oldStyleOf, hashId: hidden.id });
    assert.equal(vh.openOld, true); assert.deepEqual(vh.old.map(x => x.id), oldShown(data.items, hidden.id).map(x => x.id));
    assert.equal(sf.splitView(merged.items, { styleOf: oldStyleOf, hashId: before[5].id }).openOld, true);
    assert.equal(sf.splitView(merged.items, { styleOf: oldStyleOf, hashId: 'simple-k5' }).openOld, false);
    // ?all-designs(관리용)도 예전과 같아요
    assert.deepEqual(sf.splitView(merged.items, { styleOf: oldStyleOf, showAll: true }).old.map(x => x.id), oldShown(data.items, '', true).map(x => x.id));
    // 새 틀이 없으면(깃발 끔 · 못 받음) 예전 그대로 펼친 채 — 「옛날 버전」 단추도 안 생겨요
    const none = sf.splitView(data.items, { styleOf: oldStyleOf });
    assert.equal(none.openOld, true); assert.equal(none.fresh.length, 0); assert.deepEqual(none.old.map(x => x.id), before.map(x => x.id));
});

await test('mart.js: 「옛날 버전」 단추 · 돌아가기 줄 · 예전 목록 갈래가 들어 있고, 펼침을 저장하지 않아요', () => {
    const src = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8');
    assert.match(src, /옛날 버전 글꾸 보기 · \$\{oldList\.length\}개/);
    assert.match(src, /새 틀로 돌아가기/);
    assert.match(src, /if \(view\.fresh\.length\) wireOld\(view, shownItems, mountPicker\)/);
    const body = src.slice(src.indexOf('function wireOld'), src.indexOf('async function main'));
    assert.doesNotMatch(body, /localStorage|sessionStorage/);
    assert.match(src, /item\.simple \? simpleReady\(h\) : item\.photo \? h : kkangtongReady\(h\)/);
});

await test('목록 자료: index.json · 기존 조각이 바탕 커밋과 바이트까지 같아요(새 파일은 simple-index.json · sp-simple 조각뿐 · 개수 글은 위 「개수 · 머리말」 시험)', () => {
    const changed = git('diff', '--name-status', BASE, '--', 'mart/data').toString().trim().split('\n').filter(Boolean);
    const untracked = git('ls-files', '--others', '--exclude-standard', '--', 'mart/data').toString().trim().split('\n').filter(Boolean);
    const all = [...changed.map(l => l.split('\t').pop()), ...untracked];
    for (const f of all) assert.match(f, /^mart\/data\/geulkku\/(simple-index\.json|sp-simple\.[0-9a-f]{8}\.json)$/, `바뀐 파일 ${f}`);
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
        // 새 틀은 캐릭터 색으로(원래 색 · 꺼짐이면 그대로)
        for (const row of six.items) { const it = { ...row, ...sfx[row.id], kind: 'geulkku' }; assert.equal(neu.toned(it), on); assert.equal(neu.toneOut(it, it.preview), on ? sf.toneSimple(it.preview, k, { mode }) : it.preview); }
    }
    console.log(`      ${items.length}틀 · 비교 ${n}번`);
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
