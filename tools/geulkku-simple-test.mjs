#!/usr/bin/env node
// 글꾸 마트 「심플 새 틀」 길 시험(11-11 · DOM 없음 · node 24 · 외부 의존 없음)
//   node tools/geulkku-simple-test.mjs [--fast]
//   ① 톤 사다리 = 테마 toneLadder(같은 식 · 같은 값) · 사본의 기존 함수 그대로 ② 색 블록 갈아 끼우기(원래 색 = 시안 그대로 · 다른 색 = 시안 식 · 낮밤 · 되풀이) ③ 재생 선 필터 = song-templates.cjs
//   ④ 실제 틀 여덟(이식판 그대로) ⑤ 미리보기 열린 판 · 복사 글 닫힌 판 ⑥ HTML 복사 <style> 하나 · 고칠 자리 주석
//   ⑦ 옛 글꾸 없음(11-11 — 목록 · 자료 · 화면 · 지니 · 도구 · site-rig) · 액자 자료 그대로
//   --fast: (예전에 쓰던 꼬리 — 지금은 같은 시험을 다 돌려요)
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
const six = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));   // 글꾸 마트 목록 = 심플 새 틀만(11-11 옛 글꾸를 뺐어요)
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
//   원본 시안 폴더는 저장소 밖이라 자리를 환경 변수로 받아요: GK_ISIK_DIR = make-isik.cjs 가 든 폴더 · GK_OUTS_DIR = 시안 폴더 넷(심플-새틀-시안 …)이 든 폴더.
//   값이 없으면 원본 대조만 「건너뜀」으로 알리고 나머지 시험은 그대로 돌아요.
const ISIK = process.env.GK_ISIK_DIR ? path.join(process.env.GK_ISIK_DIR, 'make-isik.cjs') : '';
if (!ISIK) console.log('건너뜀  시안 색 식 원본 대조(make-isik.cjs) — GK_ISIK_DIR 가 없어요');
const isikFit = ISIK && fs.existsSync(ISIK) ? (() => { const s = fs.readFileSync(ISIK, 'utf8'); const a = s.indexOf('const h2rgb'), b = s.indexOf('const KA'); return new Function(`${s.slice(a, b)}; return fit;`)(); })() : null;

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
const OUTS = process.env.GK_OUTS_DIR || '';   // 이식판 원본 폴더(저장소 밖) — 위 GK_ISIK_DIR 설명 참고
if (!OUTS) console.log('건너뜀  이식판 원본 글자 대조(이식판.html) — GK_OUTS_DIR 가 없어요');
const ISIKS = OUTS ? ['심플-새틀-시안', '심플-새틀-시안-2', '심플-새틀-시안-3', '심플-기존틀-새방식'].map(d => path.join(OUTS, d, '이식판.html')) : [];
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
    const isik = gen.sampleNames(ISIKS.filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')).join('\n'));   // 견본 화자 이름(깡통 · 깡캐)만 마트가 바꿔요
    for (const row of six.items) {
        const k = row.id.slice(7), [name, cat, peek] = WANT[k], p = sfx[row.id].preview;
        assert.equal(row.name, name); assert.equal(row.category, `simple-${cat}`, k); assert.ok(row.simple && row.copyOnly && row.photo && row.style === '심플');
        assert.equal(/data-bl-peek/.test(p), peek, `${k} 미리보기 열림`);
        assert.equal(row.audio === true, /<audio\b/.test(p));
        assert.ok(row.desc && !/심플 새 틀$/.test(row.desc), `${k} 설명`);
        if (isik) {   // 소리 카드 src · class · preload 와 미리보기 열림만 빼면 이식판 그 틀과 같아요
            // (첫 묶음 포커스 테 숨김 한 줄은 11-11 원본 make-isik.cjs 에도 들어가 이제 차이가 아니에요)
            const orig = shutPeek(p).replace(/<audio class="uploaded-audio" src="[^"]*" controls preload="metadata"/g, '<audio controls preload="none"');
            assert.ok(isik.includes(orig), `${k} 이식판과 다름`);
        }
    }
});

await test('포커스 테: summary 가 있는 틀은 모두 「마우스로 누를 때 테 숨김」 한 줄이 기본 규칙 덩이에 하나 · 키보드 테(:focus-visible)는 그대로 · 첫 묶음 일곱에도(06 음성 메모는 누를 곳이 없어요)', () => {
    for (const row of six.items) {
        const p = sfx[row.id].preview, key = sf.simpleFrameInfo(p).key, base = partsOf(p)[0];
        if (!/<summary\b/.test(p)) { assert.ok(!base.includes('summary:focus:not'), row.id); continue; }
        assert.equal(base.split(gen.FOCUS_RULE(key)).length - 1, 1, `${row.id} 테 숨김`);
        assert.ok(base.includes(`.gk-${key} summary:focus-visible{outline:2px solid`), `${row.id} 키보드 테`);
    }
    for (const k of ['k1', 'k2', 'k3', 'k4', 'k5', 'k7', 'k8']) assert.ok(partsOf(sfx[`simple-${k}`].preview)[0].includes(gen.FOCUS_RULE(k)), k);
});

await test('04 줄자 누를 곳: summary 하나가 자(눈금 · 숫자 줄) + 세모 줄을 다 품어요(11-11 폰 폭 검사 — 세모 줄만 13px → 47px) · summary 안은 span 만 · 겉모습 규칙은 그대로', () => {
    const p = sfx['simple-k4'].preview, base = partsOf(p)[0];
    const m = p.match(/<details class="gk-kx"><summary class="gk-ru" aria-label="들여쓰기 바꾸기">([\s\S]*?)<\/summary><\/details>/);
    assert.ok(m, 'summary.gk-ru');
    assert.match(m[1], /^<span class="gk-rl"><span class="gk-rs"><span class="gk-rc"><span class="gk-rr" aria-hidden="true">/);
    assert.match(m[1], /<span class="gk-ms"><span class="gk-tr gk-t1"><\/span><span class="gk-tr gk-t2"><\/span><\/span>$/);
    assert.equal((m[1].match(/<span class="gk-nb">/g) || []).length, 31, '숫자 0~30 이 다 누를 곳 안');
    assert.doesNotMatch(m[1], /<div\b/);
    assert.equal((p.match(/<summary\b/g) || []).length, 1);
    assert.ok(base.includes('.gk-k4 .gk-ru{display:block;padding-bottom:4px}') && base.includes('.gk-k4 .gk-in{padding:10px 20px 20px}'), '자 30 + 세모 줄 13 + 아래 여백 4 = 47px · 본문 칸 위 여백 14 → 10(자리 그대로)');
    for (const rule of ['.gk-k4 .gk-rl{display:block;container-type:size;height:30px', '.gk-k4 .gk-rs{display:flex;', '.gk-k4 .gk-rc{display:block;', '.gk-k4 .gk-rr{display:flex;', '.gk-k4 .gk-ms{display:flex;align-items:flex-start;height:13px']) assert.ok(base.includes(rule), rule);
});

await test('「✎ 숨은 한 줄」 주석은 05 티백에만(15 요람의 gk-hl 공 빛 조각 다섯에는 안 달아요 · 테마 markEdits skip 과 같은 규칙) · 원래 색 · 다른 색 · 캐릭터 없음 × 낮밤', () => {
    const HIDDEN = '<!-- ✎ 숨은 한 줄';
    for (const row of six.items) for (const K of [undefined, '#3ccfbf', null]) for (const mode of ['light', 'dark']) {
        const p = sfx[row.id].preview, info = sf.simpleFrameInfo(p);
        const c = sf.simpleReady(shutPeek(sf.toneSimple(p, K === undefined ? info.K0 : K, { mode })));
        assert.equal(c.split(HIDDEN).length - 1, row.id === 'simple-k5' ? 1 : 0, `${row.id} ${K} ${mode}`);
    }
    const k15 = sf.simpleReady(shutPeek(sfx['simple-k15'].preview));
    assert.equal((k15.match(/<span class="gk-hl">/g) || []).length, 5, '15 공 빛 조각 다섯은 그대로');
    assert.doesNotMatch(k15, /-->\s*<span class="gk-hl">/);
    assert.match(sf.simpleReady(shutPeek(sfx['simple-k5'].preview)), /<!-- ✎ 숨은 한 줄\(찻물이 차면 나와요\) --><span class="gk-hl">/);
    assert.deepEqual([...sf.HIDDEN_LINE_FRAMES], ['k5']);
    assert.deepEqual(sf.EDIT_MARKS.map(x => x[0]), ['gk-tt', 'gk-nr', 'gk-nm', 'gk-dl', 'gk-sd', 'gk-hl'], '주석 표는 그대로(테마 fixture 와 같은 꼴)');
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

// ── 11-11 옛 글꾸를 마트에서 뺐어요(사용자 「마트에 옛날것들 다 없애라」) — 목록 · 자료 · 화면 · 도구 어디에도 없는지 ──
await test('옛 글꾸 없음 · 목록: index.json 은 심플 새 틀 28 하나(모든 줄 simple · 조각은 sp-simple 하나) · 자료 폴더에는 그 둘뿐(옛 조각 · 아이콘 0)', () => {
    assert.equal(six.count, 28); assert.equal(six.items.length, 28);
    assert.ok(six.items.every(x => x.simple && x.c === 'sp-simple' && x.style === '심플'));
    assert.deepEqual(Object.keys(six.chunks), ['sp-simple']);
    assert.deepEqual(fs.readdirSync(DIR).sort(), ['index.json', six.chunks['sp-simple'].file].sort());
    assert.ok(!six.styles, '그림 결 목록 없음');
    // 바탕 커밋의 옛 목록 id 가 하나도 안 남았어요
    const old = JSON.parse(git('show', `${BASE}:mart/data/geulkku/index.json`).toString());
    const ids = new Set(six.items.map(x => x.id));
    assert.equal(old.items.filter(x => ids.has(x.id)).length, 0);
    // 옛 조각 파일 이름을 부르는 곳이 사이트에 없어요
    const site = ['mart/mart.js', 'mart/genie.js', 'mart/taste.js', 'mart/taste-render.js', 'mart/cart.js', 'mart/top-mart.js', 'index.html', 'mart/geulkku/index.html', 'mart/genie/index.html'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    for (const c of Object.values(old.chunks)) assert.ok(!site.includes(c.file), c.file);
    assert.doesNotMatch(site, /simple-index\.json|data\/geulkku\/icon\//);
});

await test('옛 글꾸 없음 · 화면: 「옛날 버전」 단추 · 돌아가기 줄 · 목록 나누기 · 옛 숫자 0 · 「내 로그로 보기」 단추 없음 · 옛 주소는 새 틀 목록 + 한 줄 · HTML 복사 갈래 그대로', () => {
    const mart = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8'), page = fs.readFileSync(path.join(MART, 'geulkku/index.html'), 'utf8'), home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const s of ['옛날 버전 글꾸 보기', '새 틀로 돌아가기', 'wireOld', 'splitView', 'withSimpleFrames', 'keepIds']) assert.ok(!mart.includes(s), s);
    assert.match(mart, /if \(h && !hit && kind === 'geulkku'\) \{ say\('이 글꾸는 새 틀로 바뀌었어요/);
    assert.match(mart, /item\.simple \? simpleReady\(h\) : item\.photo \? h : kkangtongReady\(h\)/);
    assert.ok(!/옛날 버전/.test(page) && !/옛날 버전/.test(home), '머리말 · 홈에 옛날 버전 말 없음');
    assert.ok(!page.includes('mart-mylog'), '「내 로그로 보기」 단추 없음');
    assert.ok(!/447|1512|1483/.test(page.replace(/\?v=\d+\w*/g, '')) && !/글꾸 1483종|1512/.test(home), '옛 숫자 없음');
    const top = fs.readFileSync(path.join(MART, 'top-mart.js'), 'utf8');
    assert.match(top, new RegExp(`const COUNTS = \\{ frames: 1448, geulkku: ${six.count} \\};`));
    assert.ok(!top.includes('geulkkuAll'));
    assert.match(home, new RegExp(`<b>글꾸 마트</b><p>새 글꾸 틀 ${six.count}종`));
    assert.match(page, new RegExp(`<p class="mart-lede">새 글꾸 틀 ${six.count}개예요\\.`));
    // 다른 마트(액자) 목록 · 숫자는 그대로
    assert.equal(fs.readFileSync(path.join(MART, 'data/frames.json'), 'utf8'), git('show', `${BASE}:mart/data/frames.json`).toString());
});

// 지니: 글꾸 질문표를 글 그대로 꺼내 새 틀 28개에 돌려 봐요(genie.js 의 score · candidates 와 같은 셈)
const genieSrc = fs.readFileSync(path.join(MART, 'genie.js'), 'utf8');
const STEPS = new Function(`${genieSrc.slice(genieSrc.indexOf('const GEULKKU_STEPS = ['), genieSrc.indexOf('const FRAME_STEPS = ['))}; return GEULKKU_STEPS;`)();
await test('지니: 글꾸 질문표가 새 틀 이름 · 분류만 써요 · 그림 결 · 세계관 질문 없음 · 모든 답 조합에서 후보가 있고 점수가 붙어요 · 스물여덟 틀이 다 한 번은 1등 후보에 들어요', () => {
    const names = new Set(six.items.map(x => x.name)), cats = new Set(six.items.map(x => x.category));
    for (const st of STEPS) {
        assert.ok(!st.when, `${st.id} 갈림 질문 없음`);
        for (const o of st.opts) {
            assert.ok(!o.set, `${st.id} ${o.t} 거름망 없음`);
            for (const k of Object.keys(o.w?.name || {})) assert.ok(names.has(k), `${st.id} 이름 ${k}`);
            for (const k of Object.keys(o.w?.cat || {})) assert.ok(cats.has(k), `${st.id} 분류 ${k}`);
        }
    }
    const score = (item, ans) => STEPS.reduce((s, st, i) => { const w = st.opts[ans[i]].w || {}; let v = s + (w.cat?.[item.category] || 0); for (const k in (w.name || {})) if (item.name.includes(k)) v += w.name[k]; return v; }, 0);
    const tops = new Set();
    const combos = STEPS.reduce((acc, st) => acc.flatMap(a => st.opts.map((_, i) => [...a, i])), [[]]);
    for (const ans of combos) {
        const sc = six.items.map(i => [i, score(i, ans)]).sort((a, b) => b[1] - a[1]);
        assert.ok(sc.length && sc[0][1] > 0, `답 ${ans} 점수 없음`);
        for (const [i, s] of sc) if (s >= sc[0][1]) tops.add(i.name);
    }
    assert.equal(tops.size, 28, `1등 후보에 한 번도 안 드는 틀: ${[...names].filter(n => !tops.has(n)).join(' · ')}`);
});

await test('옛 글꾸 도구는 쉬어요: 자료를 만들고 점검하던 열한 도구가 --check 에서 한 줄 알리고 0 으로 끝나요(소스는 그대로) · 새 틀 생성기 --check 는 그대로 돌아요', () => {
    for (const n of ['accent', 'builtin', 'hwabo', 'kara', 'polish', 'react', 'scene', 'song', 'xmas', 'tone', 'tone-gate']) {
        const out = execFileSync(process.execPath, [path.join(ROOT, 'tools', `geulkku-${n}.mjs`), '--check'], { cwd: ROOT }).toString();
        assert.match(out, /옛 글꾸는 마트에서 뺐어요 — 이 도구는 쉬어요/, n);
        assert.ok(fs.readFileSync(path.join(ROOT, 'tools', `geulkku-${n}.mjs`), 'utf8').split('\n').length > 20, `${n} 소스 그대로`);
    }
    assert.match(execFileSync(process.execPath, [path.join(ROOT, 'tools/geulkku-simple.mjs'), '--check'], { cwd: ROOT }).toString(), /확인: 심플 새 틀 28종 그대로예요/);
});

await test('site-rig: 글꾸 화면은 새 틀로 열려요(아무 카드나 크게 보기 · 칩만 고름) · 시식 · 내 로그 · 담김 카드는 쉬고 장바구니는 액자 마트에서', () => {
    const rig = fs.readFileSync(path.join(ROOT, 'tools/site-rig/site-rig.mjs'), 'utf8');
    const live = rig.split('\n').filter(l => /^\s*\{ group:/.test(l));
    const where = live.map(l => (l.match(/where: '([^']+)'/) || [])[1]);
    for (const w of ['글꾸 · 시식', '글꾸 · 내 로그 설정', '글꾸 · 내 로그 켬', '글꾸 · 담김 카드']) assert.ok(!where.includes(w), w);
    for (const w of ['글꾸 · 목록', '글꾸 · 상세', '글꾸 · 캐릭터 펼침', '지니 · 글꾸 결과', '장바구니 · 담김']) assert.ok(where.includes(w), w);
    assert.match(live.find(l => l.includes("'장바구니 · 담김'")), /url: 'mart\/frames\/'/);
    assert.doesNotMatch(rig.match(/const REQUIRED = [^\n]+/)[0], /시식/);
    assert.match(rig, /const openSheetBy = [^\n]*'\.mart-card:not\(\[hidden\]\) \.mart-preview'/);
});

await test('기본 = 원래 색: 캐릭터를 안 골랐으면 스물여덟 틀이 이식판 글자 그대로(원래 판) · 반대 판은 원래 색 그대로 낮밤만 · 캐릭터를 고르면 그 색 · 「캐릭터 없음(무채)」을 고르면 무채', async () => {
    const neu = await imp(path.join(MART, 'tone-state.js'));
    assert.equal(neu.toneState.on, false, '저장된 것이 없으면 원래 색');
    for (const row of six.items) {
        const it = { ...row, ...sfx[row.id], kind: 'geulkku' }, info = sf.simpleFrameInfo(it.preview), orig = info.base === 'gk-tl' ? 'light' : 'dark', alt = orig === 'light' ? 'dark' : 'light';
        assert.equal(neu.toned(it), true);
        neu.setTone({ mode: orig });
        assert.equal(neu.toneState.on, false);
        assert.equal(neu.toneOut(it, it.preview), it.preview, `${row.id} 원래 판 = 이식판 글자 그대로`);
        neu.setTone({ mode: alt });
        const a = neu.toneOut(it, it.preview);
        assert.equal(a.split(`gk-cv-${info.cvName}`).join(`gk-cv-${info.K0.slice(1)}`), sf.toneSimple(it.preview, info.K0, { mode: alt }), `${row.id} 반대 판 = 원래 색 그대로 낮밤만`);
        assert.match(rootOf(a), new RegExp(`gk-cv-${info.cvName}(\\s|$)`));
    }
    for (const [k, mode] of [['#3ccfbf', 'light'], ['#3aa7ff', 'dark']]) {
        neu.setTone({ k, mode, on: true });
        assert.equal(neu.toneState.none, false);
        for (const row of six.items) { const it = { ...row, ...sfx[row.id], kind: 'geulkku' }; assert.equal(neu.toneOut(it, it.preview), sf.toneSimple(it.preview, k, { mode })); }
    }
    neu.setTone({ k: null, on: true });
    assert.equal(neu.toneState.none, true, '무채를 직접 고른 것은 기억해요');
    const it = { ...six.items[0], ...sfx[six.items[0].id], kind: 'geulkku' };
    assert.match(rootOf(neu.toneOut(it, it.preview)), /gk-cv-none/);
    neu.setTone({ on: false });
    assert.equal(neu.toneState.none, false);
});

await test('기억한 값 읽기: 예전 기본(on · 캐릭터 없음)은 원래 색으로 · 무채를 직접 고른 것 · 캐릭터를 고른 것 · 원래 색은 그대로', async () => {
    const cases = [[{ on: true, k: null, mode: 'dark' }, false], [{ on: true, k: null, none: true }, true], [{ on: true, k: '#3ccfbf' }, true], [{ on: false, k: '#3ccfbf' }, false], [{}, false]];
    for (const [i, [saved, on]] of cases.entries()) {
        globalThis.localStorage = { getItem: key => (key === 'bl-mart-tone-v1' ? JSON.stringify(saved) : null), setItem() { }, removeItem() { } };
        const m = await import(`${pathToFileURL(path.join(MART, 'tone-state.js')).href}?read=${i}`);
        assert.equal(m.toneState.on, on, JSON.stringify(saved));
    }
    delete globalThis.localStorage;
});

await test('캐릭터 줄: 「원래 색(틀마다 정해 둔 색)」이 첫 항목 · 「바탕(종이 색 · 질감)」 칸은 숨김(PAPER_ENABLED = false · 코드는 그대로) · site-rig 바탕 펼침 화면은 쉼', () => {
    const cast = fs.readFileSync(path.join(MART, 'cast.js'), 'utf8');
    assert.match(cast, /const PAPER_ENABLED = false;/);
    assert.ok(cast.indexOf('원래 색(틀마다 정해 둔 색)') < cast.indexOf('캐릭터 없음(무채)'));
    assert.match(cast, /\$\{PAPER_ENABLED \? `<button type="button" class="mart-cast-toggle" data-paper/);
    assert.match(cast, /const paperPanel = PAPER_ENABLED && paperOpen \?/);
    const rig = fs.readFileSync(path.join(ROOT, 'tools/site-rig/site-rig.mjs'), 'utf8');
    assert.ok(!rig.split('\n').filter(l => /^\s*\{ group:/.test(l)).some(l => l.includes("'글꾸 · 바탕 펼침'")));
});

// ── 11-11 깡통 · 깡캐 두 칸(둘째 화자 색) · 견본 화자 이름 · 색 단추 ──
await test('깡캐(둘째 화자) 색: 안 고르면 한 글자도 안 달라요 · 고르면 스물여덟 틀 × (원래 색 · 다른 색 · 캐릭터 없음) × 낮밤에서 상대의 옛 색이 화자 규칙 · 소품에 안 남고 새 색으로 · 기본 규칙 그대로 · <style> 하나 · 뿌리 이름에 상대 색 · 되풀이', () => {
    const K2 = '#7fe03c', rgb2 = '127,224,60';
    const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
    const noScheme = h => h.slice(h.indexOf('</style>')).replace(/color-scheme:(light|dark)/g, '');
    for (const row of six.items) {
        const p = sfx[row.id].preview, info = sf.simpleFrameInfo(p);
        const otherOld = info.K0 === '#3aa7ff' ? '#ff5fa2' : '#3aa7ff';
        for (const mode of ['dark', 'light']) for (const K of [sf.ORIGINAL, '#d19cff', null]) {
            const plain = sf.toneSimple(p, K, { mode });
            for (const none of [undefined, null, '', 'nope']) assert.equal(sf.toneSimple(p, K, { mode, other: none }), plain, `${row.id} 상대 안 고름`);
            const out = sf.toneSimple(p, K, { mode, other: K2 }), css = styleOf(out), tag = `${row.id} ${mode} ${String(K)}`;
            assert.equal((out.match(/<style>/g) || []).length, 1, tag);
            assert.equal(partsOf(out)[0], partsOf(p)[0], `${tag} 기본 규칙`);
            assert.equal(noScheme(out), noScheme(plain), `${tag} 본문 그대로`);
            assert.match(rootOf(out), /gk-cv-\w+-7fe03c(\s|$)/, tag);
            assert.ok(css.includes(rgb2), `${tag} 새 띠 색`);
            // 화자 규칙(이름 · 띠 · 밑줄 · 이름표)에는 상대의 옛 색이 없어요
            for (const r of css.split('\n')) if (/\.gk-[a-z]+[A-Z](?![\w-])/.test(r.slice(0, r.indexOf('{')))) assert.ok(!r.includes(rgbOf(otherOld)) && !r.toLowerCase().includes(otherOld), `${tag} 화자 규칙에 옛 색 ${r.slice(0, 70)}`);
            // 주인공 색까지 바꾼 판은 어디에도 옛 상대 색이 없어요(소품 · 키프레임 포함)
            if (K !== sf.ORIGINAL) { const bare = css.replace(/gk-cv-[\w-]+/g, '').toLowerCase(); assert.ok(!bare.includes(otherOld) && !bare.includes(rgbOf(otherOld)), `${tag} 옛 상대 색`); }
            // 상대 이름 글자 규칙이 두 판 다 있어요
            const X = info.speakers.find(x => new RegExp(`gk-n${x}">깡캐`).test(p));
            assert.ok([...css.matchAll(new RegExp(`\\.gk-nm\\.gk-n${X}\\{color:#[0-9a-f]{6}`, 'g'))].length >= 2, `${tag} 상대 이름 규칙 두 판`);
            if (K) assert.equal(sf.toneSimple(out, K, { mode, other: K2 }), out, `${tag} 되풀이`);
        }
    }
    // 주인공이 원래 색이면 주인공 · 소품 규칙은 시안 그대로(상대 규칙만 바뀜 — 뿌리 이름 꼬리만 다름)
    const p = sfx['simple-k1'].preview, a = styleOf(sf.toneSimple(p, sf.ORIGINAL, { mode: 'light' })).split('\n'), b = styleOf(sf.toneSimple(p, sf.ORIGINAL, { mode: 'light', other: K2 })).split('\n').map(l => l.split('-7fe03c').join(''));
    for (const l of a) if (!/\.gk-[a-z]+B(?![\w-])/.test(l.slice(0, l.indexOf('{')))) assert.ok(b.includes(l), `k1 주인공 · 소품 규칙 그대로: ${l.slice(0, 80)}`);
});

await test('깡캐 기억: k2 · name2 를 깡통과 같은 저장소에 기억하고 다시 읽어요 · 안 골랐으면 저장 꼴이 예전과 같아요 · 복사 글 길(toneOut)과 다시 칠하기 열쇠에 들어가요', async () => {
    const store = {};
    globalThis.localStorage = { getItem: k => store[k] ?? null, setItem(k, v) { store[k] = v; }, removeItem(k) { delete store[k]; } };
    const href = pathToFileURL(path.join(MART, 'tone-state.js')).href;
    const m = await import(`${href}?k2=a`);
    const it = { ...six.items[0], ...sfx[six.items[0].id], kind: 'geulkku' };
    assert.equal(m.toneState.k2, null);
    m.setTone({ mode: 'light' });
    const saved = () => JSON.parse(store['bl-mart-tone-v1']);
    assert.ok(!('k2' in saved()) && !('name2' in saved()), '안 골랐으면 k2 칸 없음');
    const base = m.toneOut(it, it.preview), key0 = m.toneKey();
    m.setTone({ k2: '#7fe03c', name2: '우리엘' });
    assert.notEqual(m.toneKey(), key0);
    assert.equal(m.toneOut(it, it.preview), sf.toneSimple(it.preview, sf.ORIGINAL, { mode: 'light', other: '#7fe03c' }));
    assert.deepEqual([saved().k2, saved().name2], ['#7fe03c', '우리엘']);
    const again = await import(`${href}?k2=b`);
    assert.deepEqual([again.toneState.k2, again.toneState.name2, again.toneState.on], ['#7fe03c', '우리엘', false]);
    m.setTone({ on: true, k: '#d19cff', name: '백시우' });
    assert.equal(m.toneOut(it, it.preview), sf.toneSimple(it.preview, '#d19cff', { mode: 'light', other: '#7fe03c' }));
    m.setTone({ k2: null }); m.setTone({ on: false });
    assert.equal(m.toneState.name2, '');
    assert.equal(m.toneOut(it, it.preview), base, '둘 다 원래 색으로 돌리면 처음과 같아요');
    assert.equal(m.toneKey().replace('"#d19cff"', 'null'), key0);
    delete globalThis.localStorage;
});

await test('견본 화자 이름: 스물여덟 틀의 이름표 · 소리 이름표 · 지문이 「깡통」 · 「깡캐」(옛 견본 이름 0) · 주석 속 「가게 이름」 같은 낱말은 그대로 · 두 번 걸어도 같아요', () => {
    for (const row of six.items) {
        const p = sfx[row.id].preview, body = p.slice(p.indexOf('</style>')), text = body.replace(/<!--[\s\S]*?-->/g, '');
        assert.ok(!/이름|친구/.test(text), `${row.id} 옛 견본 이름`);
        assert.equal((body.match(/<p class="gk-nm gk-n[A-Z]">깡통<\/p>/g) || []).length, 1, row.id);
        assert.equal((body.match(/<p class="gk-nm gk-n[A-Z]">깡캐<\/p>/g) || []).length, 1, row.id);
        assert.ok(body.includes('깡통은 난간에 기대어') && body.includes('<p class="gk-nr">깡캐는 대답 대신'), `${row.id} 지문`);
        assert.equal(gen.sampleNames(p), p);
        if (row.audio) assert.match(body, /<span class="gk-sn gk-s[A-Z]">깡통<\/span>/, `${row.id} 소리 이름표`);
    }
    assert.equal(sfx['simple-q09'].preview.split('<!-- ✎ 가게 이름 -->').length - 1, 1);
});

await test('캐릭터 목록: 묶음 넷(천지합동청 13 · D&H 6 · 무협시뮬 7 · 센티넬버스 11 = 37명) · 「기타」 묶음 없음', async () => {
    const m = await imp(path.join(MART, 'tone-state.js'));
    assert.deepEqual(m.CAST_GROUPS.map(g => [g.id, g.label, g.cast.length]), [['halo', '천지합동청', 13], ['dh', 'D&H · 아드리안', 6], ['gangho', '무협시뮬', 7], ['sentinel', '센티넬버스', 11]]);
    assert.equal(m.CAST.length, 37);
    for (const f of ['tone-state.js', 'cast.js']) assert.ok(!fs.readFileSync(path.join(MART, f), 'utf8').includes('기타'), f);
});

await test('깡통 · 깡캐 두 칸 · 색 단추: 머리 줄에 칸 둘(펼친 칸 표시) · 기억한 캐릭터는 두 칸이 같이 써요 · 색 칸은 색 원 + 색 값 단추(기본 색 칸은 덮는 투명 칸)', () => {
    const cast = fs.readFileSync(path.join(MART, 'cast.js'), 'utf8'), css = fs.readFileSync(path.join(MART, 'mart.css'), 'utf8');
    assert.ok(cast.includes("${toggle('main', '깡통', now)}${toggle('other', '깡캐', now2)}"));
    assert.ok(!cast.includes('<span>캐릭터:</span>'));
    assert.ok(cast.includes('aria-expanded="${who === id}"') && cast.includes('name="bl-cast2" value="off"'));
    assert.ok(cast.includes('setTone(other ? { k2: saved.color, name2: saved.name } : { on: true, k: saved.color, name: saved.name })'));
    assert.equal(cast.split('<input type="color"').length - 1, 1, '색 칸은 colorField 한 곳');
    assert.ok(cast.includes('<label class="mart-cast-color"') && cast.includes('class="mart-ink-dot mart-cast-swatch"') && cast.includes('class="mart-cast-hex"'));
    assert.ok(css.includes('.mart-cast-color input[type=color]{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;opacity:0;'));
    assert.ok(css.includes('.mart-cast-color:focus-within{outline:2px solid var(--blue);outline-offset:2px}'));
    assert.ok(!css.includes('.mart-cast-form input[type=color]{width:40px'));
    assert.ok(css.includes('.mart-cast-toggle[data-toggle][aria-expanded=true]::after{content:"";position:absolute;'));
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
