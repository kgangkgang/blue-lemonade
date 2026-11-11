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
const sixAll = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));   // 글꾸 마트 목록 = 심플 새 틀만(11-11 옛 글꾸를 뺐어요)
// 11-11 전수조사 합격 틀(sp-pass-* 조각)이 더해졌어요 — 아래 시험들은 스물여덟 틀(sp-simple) 을 보고, 합격 틀은 맨 끝 시험이 따로 봐요
const six = { ...sixAll, count: sixAll.items.filter(x => x.c === 'sp-simple').length, items: sixAll.items.filter(x => x.c === 'sp-simple'), chunks: { 'sp-simple': sixAll.chunks['sp-simple'] } };
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
            const fit = (gen.FIT_RULES[k] || []).reduce((h, r) => h.replace(`\n${r}`, ''), shutPeek(p));   // 틀 넘침 손봄 줄은 마트가 더한 것
            const orig = fit.replace(/<audio class="uploaded-audio" src="[^"]*" controls preload="metadata"/g, '<audio controls preload="none"');
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
        for (const [mark, n] of [['제목', 1], ['지문', 3], ['화자 이름', 2], ['대사', 2], ['소리 카드', 1]]) assert.equal(out.split(`<!-- ✎ ${mark}`).length - 1, n, mark);
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
    assert.deepEqual(fs.readdirSync(DIR).sort(), ['index.json', ...Object.values(sixAll.chunks).map(c => c.file)].sort());
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
    assert.match(top, new RegExp(`const COUNTS = \\{ frames: 1448, geulkku: ${sixAll.count} \\};`));
    assert.ok(!top.includes('geulkkuAll'));
    assert.match(home, new RegExp(`<b>글꾸 마트</b><p>새 글꾸 틀 ${sixAll.count}종`));
    assert.match(page, new RegExp(`<p class="mart-lede">새 글꾸 틀 ${sixAll.count}개예요\\.`));
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
    assert.match(execFileSync(process.execPath, [path.join(ROOT, 'tools/geulkku-simple.mjs'), '--check'], { cwd: ROOT }).toString(), new RegExp(`확인: 심플 새 틀 ${sixAll.count}종 그대로예요`));
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
        assert.equal(body.split(gen.SAMPLE_INNER).length - 1, 1, `${row.id} 속마음 · 강조 · 취소 견본 한 줄`);
        if (row.audio) assert.match(body, /<span class="gk-sn gk-s[A-Z]">깡통<\/span>/, `${row.id} 소리 이름표`);
    }
    assert.equal(sfx['simple-q09'].preview.split('<!-- ✎ 가게 이름 -->').length - 1, 1);
});

await test('캐릭터 목록: 묶음 넷(천지합동청 13 · D&H 8 · 무협시뮬 7 · 센티넬버스 11 = 39명) · 「기타」 묶음 없음', async () => {
    const m = await imp(path.join(MART, 'tone-state.js'));
    assert.deepEqual(m.CAST_GROUPS.map(g => [g.id, g.label, g.cast.length]), [['halo', '천지합동청', 13], ['dh', 'D&H · 아드리안', 8], ['gangho', '무협시뮬', 7], ['sentinel', '센티넬버스', 11]]);
    assert.equal(m.CAST.length, 39);
    assert.equal(new Set(m.CAST.map(x => x.color)).size, 39, '색이 서로 달라요');
    for (const f of ['tone-state.js', 'cast.js']) assert.ok(!fs.readFileSync(path.join(MART, f), 'utf8').includes('기타'), f);
});

await test('깡통 · 깡캐 두 칸 · 색 단추: 머리 줄에 칸 둘(펼친 칸 표시) · 기억한 캐릭터는 두 칸이 같이 써요 · 색 칸은 색 원 + 색 값 단추(기본 색 칸은 덮는 투명 칸)', () => {
    const cast = fs.readFileSync(path.join(MART, 'cast.js'), 'utf8'), css = fs.readFileSync(path.join(MART, 'mart.css'), 'utf8');
    assert.match(cast, /\$\{toggle\('main', '깡통', now\)\}<button type="button" class="ibtn mart-cast-swap" data-swap[^>]*>.*?<\/button>\$\{toggle\('other', '깡캐', now2\)\}/);   // 11-11 사이에 화자 바꾸기 ⇄
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

// ── 11-11 크게 보기 「조절」(tune.js) ──
// tone-state.js 가 부르는 것과 같은 주소(판 꼬리까지)로 불러요 — 꼬리가 다르면 다른 모듈로 떠서 조절 값이 안 이어져요
const tuneTail = fs.readFileSync(path.join(MART, 'tone-state.js'), 'utf8').match(/'\.\/tune\.js(\?v=\w+)'/)[1];
const tu = await import(pathToFileURL(path.join(MART, 'tune.js')).href + tuneTail);
await test('조절: 값이 없으면 한 글자도 안 달라요 · 글자색은 틀 <style> 끝 덮는 규칙(그 판에만 · fill 짝 · <style> 하나) · 고쳐 쓴 글은 그 자리 글자만(이스케이프) · 소품 색은 깡통 색과 따로 · 28틀 복사 글 정적 검사 통과', async () => {
    const ts = await import(`${pathToFileURL(path.join(MART, 'tone-state.js')).href}?tune=1`);
    for (const row of six.items) {
        const it = { ...row, ...sfx[row.id], kind: 'geulkku' }, p = it.preview, key = sf.simpleFrameInfo(p).key;
        assert.equal(tu.applyTune(p, null), p); assert.equal(tu.applyTune(p, {}), p); assert.equal(tu.applyTune(p, { inks: { light: { title: 'red' } }, texts: { x: 'a' } }), p, `${row.id} 틀린 값은 버려요`);
        const ed = tu.editables(p);
        assert.ok(ed.length >= 6, `${row.id} 글 자리 ${ed.length}`);
        assert.ok(ed.some(e => e.cls === 'gk-nr') && ed.some(e => e.cls === 'gk-nm') && ed.some(e => e.cls === 'gk-d'), row.id);
        for (const e of ed) assert.equal(p.slice(e.start, e.end), e.text);
        const last = ed.length - 1, tune = { inks: { light: { title: '#7a3cc8', dialogue: '#b3261e' }, dark: { text: '#ddeeff' } }, prop: '#e0780a', texts: { 0: '고친 <글> & 제목', [last]: '끝 줄' } };
        const base = sf.toneSimple(p, sf.ORIGINAL, { mode: 'light', prop: tune.prop }), out = tu.applyTune(base, tune);
        assert.equal((out.match(/<style>/g) || []).length, 1, row.id);
        const K = `.gk-${key}`.repeat(3);
        assert.ok(out.includes(`${K}.gk-tl .gk-tt{color:#7a3cc8;-webkit-text-fill-color:#7a3cc8}`) && out.includes(`${K}.gk-tl .gk-d{color:#b3261e;-webkit-text-fill-color:#b3261e}`), `${row.id} 낮 판 규칙`);
        assert.ok(out.includes(`${K}.gk-td p.gk-nr,${K}.gk-tx p.gk-nr{color:#ddeeff;-webkit-text-fill-color:#ddeeff}`), `${row.id} 밤 판 규칙`);
        const ed2 = tu.editables(out);
        assert.equal(ed2.length, ed.length);
        assert.equal(ed2[0].text, '고친 &lt;글&gt; &amp; 제목'); assert.equal(ed2[last].text, '끝 줄');
        for (let i = 1; i < last; i++) assert.equal(ed2[i].text, ed[i].text, `${row.id} 다른 자리 그대로`);
        // 글 · 덮는 규칙을 빼면 칠한 판 그대로
        const strip = h => { const e = tu.editables(h); let s = h; for (const x of [...e].reverse()) s = s.slice(0, x.start) + s.slice(x.end); return s.split('\n').filter(l => !l.startsWith(K)).join('\n'); };
        assert.equal(strip(out), strip(base), `${row.id} 뼈대 그대로`);
        const ready = sf.simpleReady(shutPeek(out)), rep = tg.readyReport(ready);
        assert.ok(rep.ok, `${row.id} 정적 검사 ${JSON.stringify(rep)}`);
        assert.equal((ready.match(/<style>/g) || []).length, 1);
        // toneOut 길: 조절 값이 없으면 예전과 같고, 있으면 같은 결과
        ts.setTone({ mode: 'light' });
        const before = ts.toneOut(it, p), key0 = ts.toneKey();
        tu.setTune(row.id, tune);
        assert.notEqual(ts.toneKey(), key0);
        assert.equal(ts.toneOut(it, p), out, `${row.id} toneOut`);
        tu.setTune(row.id, null);
        assert.equal(tu.tuneOf(row.id), null);
        assert.equal(ts.toneOut(it, p), before, `${row.id} 처음으로`);
    }
    // 소품 색: 깡통 색은 그대로 · 소품 톤만 그 색 사다리로(뿌리 이름 꼬리 -x-<소품 색>)
    const p = sfx['simple-k3'].preview, a = sf.toneSimple(p, sf.ORIGINAL, { mode: 'light' }), b = sf.toneSimple(p, sf.ORIGINAL, { mode: 'light', prop: '#3ccfbf' });
    assert.match(rootOf(b), /gk-cv-pk-x-3ccfbf(\s|$)/);
    assert.equal(partsOf(b)[1].split('-x-3ccfbf').join(''), partsOf(a)[1], '화자 색 덩이는 그대로');
    assert.ok(Object.values(ct.toneLadder('#3ccfbf')).some(v => styleOf(b).includes(v)) && sf.hasPropTone(p) && !sf.hasPropTone(sfx['simple-k1'].preview));
    assert.equal(sf.simpleFrameInfo(b).K0, '#ff5fa2');
    assert.deepEqual(sf.speakerPair(p), { main: '#ff5fa2', other: '#3aa7ff' });
});

await test('기본 색 판(뿌리 sk-own): 기본 색 줄은 값이 사다리 값과 같아도 안 바뀌어요 · own:false 면 뿌리 class 만 떼요 · 그 밖에는 틀 그대로', () => {
    const p0 = sfx['simple-k3'].preview, c300 = ct.toneLadder('#ff5fa2').c300;
    const p = p0.replace('<div class="gk ', '<div class="gk sk-own ').replace('\n</style>', `\n.gk-k3.sk-own .gk-zz{background-color:${c300}}\n</style>`);
    assert.ok(sf.hasOwnTone(p) && !sf.hasOwnTone(p0));
    for (const K of [sf.ORIGINAL, '#3ccfbf', null]) {
        const out = sf.toneSimple(p, K, { mode: 'light' });
        assert.ok(styleOf(out).includes(`.sk-own .gk-zz{background-color:${c300}}`), `기본 색 줄 그대로 ${String(K)}`);
        assert.match(rootOf(out), /(^|\s)sk-own(\s|$)/);
        const off = sf.toneSimple(p, K, { mode: 'light', own: false });
        assert.doesNotMatch(rootOf(off), /sk-own/);
        assert.equal(styleOf(off), styleOf(out), '<style> 은 같고 뿌리 class 만 달라요');
    }
    assert.deepEqual(tu.cleanTune({ own: false }), { own: false });
    assert.deepEqual(tu.cleanTune({ own: true }), { own: true });   // 11-11 이 틀만 소품 기본 색
});

await test('내 글꾸: 틀 + 깡통 · 깡캐 · 낮밤 + 조절 값을 이름 붙여 기억 · 같은 틀 같은 이름은 덮어써요 · 지우기 · 틀린 값은 버려요', () => {
    const store = {};
    globalThis.localStorage = { getItem: k => store[k] ?? null, setItem(k, v) { store[k] = v; }, removeItem(k) { delete store[k]; } };
    assert.deepEqual(tu.mineList(), []);
    const tone = { on: true, k: '#D19CFF', name: '백시우', k2: '#7fe03c', name2: '우리엘', mode: 'light' };
    const a = tu.saveMine({ frame: 'simple-k1', frameName: '낫표', name: '보라 낫표', tone, tune: { inks: { light: { title: '#7a3cc8' } }, texts: { 0: '제목' } } });
    assert.equal(a.tone.k, '#d19cff');
    tu.saveMine({ frame: 'simple-k6', frameName: '음성 메모', name: '둘째', tone: { on: false }, tune: null });
    tu.saveMine({ frame: 'simple-k1', frameName: '낫표', name: '보라 낫표', tone, tune: { prop: '#e0780a' } });
    const list = tu.mineList();
    assert.deepEqual(list.map(x => [x.frame, x.name]), [['simple-k1', '보라 낫표'], ['simple-k6', '둘째']]);
    assert.deepEqual(list[0].tune, { prop: '#e0780a' });
    assert.equal(tu.saveMine({ frame: 'simple-k1', name: '   ', tone }), null);
    tu.forgetMine(list[1].id);
    assert.equal(tu.mineList().length, 1);
    store['bl-mart-mine-v1'] = JSON.stringify([{ frame: '<x>', name: 'a' }, { frame: 'simple-k1', name: 'ok', tone: { k: 'red' }, tune: { inks: { light: { title: 'x' } } } }]);
    assert.deepEqual(tu.mineList().map(x => [x.name, x.tone.k, x.tune]), [['ok', null, null]]);
    delete globalThis.localStorage;
});

// ── 11-11 글 모양(look.js — 테마 「글자」 탭 축소판) · 내 프리셋 ──
const lookTail = fs.readFileSync(path.join(MART, 'tone-state.js'), 'utf8').match(/'\.\/look\.js(\?v=\w+)'/)[1];
const lk = await import(pathToFileURL(path.join(MART, 'look.js')).href + lookTail);
const FULL_LOOK = { fonts: { text: 'serif' }, type: { size: 18, weight: 500, letterSpacing: 4, lineHeight: 2, align: 'justify-word', indent: false, para: 1.2, dialogueSize: 17 }, dialogue: { style: 'marker', markerPos: 'bottom', markerThick: 40, weight: 700, letterSpacing: -2 }, shadow: { on: true, targets: { text: true, dialogue: true, title: true }, color: '#112233', alpha: 60, angle: 90, distance: 3, blur: 4 }, outline: { on: true, color: '#ffffff', width: 0.6, alpha: 80 } };
await test('글 모양: 값이 없으면 한 글자도 안 달라요 · 테마와 같은 키 · 범위로 다듬고(범위 밖은 안으로 · 모르는 값은 버림 · 웹폰트 글꼴은 버림) · 28틀에 덮는 규칙으로만(본문 그대로 · <style> 하나 · 복사 글 정적 검사) · 그림자 식 = 테마 · 형광펜은 화자 띠마다', async () => {
    const ts = await import(`${pathToFileURL(path.join(MART, 'tone-state.js')).href}?tune=1`);
    assert.equal(lk.cleanLook(null), null); assert.equal(lk.cleanLook({ type: { nope: 1 }, fonts: { text: { ko: 'pretendard' } }, shadow: { on: false }, dialogue: { style: 'tint' } }), null);
    assert.deepEqual(lk.cleanLook({ type: { size: 99, weight: '250', letterSpacing: -40, lineHeight: 1.837, align: 'justify-break', indent: false } }), { type: { size: 22, weight: 300, letterSpacing: -5, lineHeight: 1.84, align: 'justify-word', indent: false } });
    assert.deepEqual(lk.cleanLook(FULL_LOOK), FULL_LOOK);
    assert.equal(lk.shadowValue({}), '-1.41px 1.41px 3px rgba(0,0,0,0.45)');   // 테마 기본(135° · 2px · 3px · 45%)
    assert.equal(lk.shadowValue(FULL_LOOK.shadow), '0px 3px 4px rgba(17,34,51,0.6)');
    for (const f of lk.LOOK_FIELDS) if (f.kind === 'range') assert.ok(f.min < f.max && f.def >= f.min && f.def <= f.max, f.path);
    assert.deepEqual(lk.LOOK_TABS.map(x => x[1]), ['색', '본문', '대사', '속마음', '취소선', '강조', '문단', '이름', '그림자', '외곽선']);
    for (const s of lk.FONT_STACKS) assert.ok(/,(sans-serif|serif|cursive|monospace)$/.test(s.family) && !/url\(|@import/.test(s.family), s.id);
    for (const row of six.items) {
        const it = { ...row, ...sfx[row.id], kind: 'geulkku' }, p = it.preview, key = sf.simpleFrameInfo(p).key, K = `.gk-${key}`.repeat(3);
        assert.equal(lk.applyLook(p, null), p); assert.equal(lk.applyLook(p, {}), p);
        const base = sf.toneSimple(p, sf.ORIGINAL, { mode: 'light' }), out = lk.applyLook(base, FULL_LOOK);
        assert.equal((out.match(/<style>/g) || []).length, 1, row.id);
        assert.equal(out.slice(out.indexOf('</style>')), base.slice(base.indexOf('</style>')), `${row.id} 본문 그대로`);
        assert.ok(out.startsWith(base.slice(0, base.indexOf('\n</style>'))), `${row.id} 틀 규칙은 그대로 두고 뒤에 덧붙여요`);
        const add = out.slice(base.indexOf('\n</style>'), out.indexOf('\n</style>'));
        assert.ok(add.includes(`${K} p:not(.gk-nm){font-family:"AppleMyungjo","Batang","Noto Serif KR","Noto Serif CJK KR",serif;font-size:18px;font-weight:500;letter-spacing:0.04em;line-height:2;text-align:justify;word-break:keep-all;text-indent:0;margin-bottom:1.2em}`), `${row.id} 본문 규칙`);
        assert.ok(add.includes(`${K} .gk-d{font-size:17px;font-weight:700;letter-spacing:-0.02em}`), `${row.id} 대사 규칙`);
        assert.ok(add.includes(`${K} p:not(.gk-nm),${K} .gk-d,${K} .gk-tt{text-shadow:0px 3px 4px rgba(17,34,51,0.6)}`), `${row.id} 그림자`);
        assert.ok(add.includes('-webkit-text-stroke:0.6px rgba(255,255,255,0.8);paint-order:stroke fill'), `${row.id} 외곽선`);
        assert.ok(!/url\(|@import|@font-face|filter:|opacity:/.test(add.replace(/url\("data:image\/svg\+xml,[^"]+"\)/g, '')), `${row.id} 웹폰트 · filter · opacity 없음(형광펜 SVG 만)`);
        const bands = [...base.slice(0, base.indexOf('</style>')).matchAll(/\n(\.gk-[^{}\n]*\.gk-d[A-Z])\{background-color:/g)].length;
        const marks = (add.match(/\{background:url\("data:image\/svg\+xml,[^"]+"\) center \/ 100% 100% no-repeat\}/g) || []).length;   // 형광펜 = 테마와 같은 펜 자국 SVG
        if (row.id === 'simple-k13') assert.equal(marks, 0, '13 형광펜은 띠가 그림이라 그대로'); else assert.ok(marks >= 2 && marks <= bands, `${row.id} 형광펜 띠 ${marks}/${bands}`);
        assert.ok(tg.readyReport(sf.simpleReady(shutPeek(out))).ok, `${row.id} 정적 검사`);
        // toneOut 길
        ts.setTone({ mode: 'light', on: false, k2: null });
        const before = ts.toneOut(it, p), key0 = ts.toneKey();
        lk.setLook(FULL_LOOK);
        assert.notEqual(ts.toneKey(), key0);
        assert.equal(ts.toneOut(it, p), out, `${row.id} toneOut`);
        lk.setLook(null);
        assert.equal(ts.toneOut(it, p), before, `${row.id} 기본으로`);
    }
    // 한 칸씩: 그 칸의 선언만 나와요
    const p = sfx['simple-k1'].preview;
    assert.deepEqual(lk.lookRules(p, { type: { letterSpacing: -3 } }), ['.gk-k1.gk-k1.gk-k1 p:not(.gk-nm){letter-spacing:-0.03em}']);
    assert.deepEqual(lk.lookRules(p, { shadow: { on: true } }), ['.gk-k1.gk-k1.gk-k1 .gk-d{text-shadow:-1.41px 1.41px 3px rgba(0,0,0,0.45)}']);
    assert.deepEqual(lk.lookRules(p, { shadow: { color: '#ff0000', distance: 9 } }), [], '그림자를 안 켰으면 규칙 없음');
    assert.deepEqual(lk.lookRules(p, { dialogue: { style: 'full' } }), [], '전체 칠 = 틀 그대로');
});

await test('내 프리셋: 색 + 글 모양을 이름 붙여 기억(틀과 따로) · 같은 이름은 덮어써요 · 이름 바꾸기 · 지우기 · 마지막 것 기억 · 글자로 내보내고 가져오기 · 테마 스타일 코드(BLS0.) · 프리셋 파일에서 글 모양만', () => {
    const store = {};
    globalThis.localStorage = { getItem: k => store[k] ?? null, setItem(k, v) { store[k] = v; }, removeItem(k) { delete store[k]; } };
    assert.deepEqual(lk.presetList(), []); assert.equal(lk.presetLast(), '');
    const data = { tone: { on: true, k: '#D19CFF', name: '백시우', k2: '#7fe03c', name2: '우리엘' }, colors: { inks: { light: { title: '#7a3cc8', bad: 'x' } }, prop: '#e0780a', own: false }, look: FULL_LOOK };
    const a = lk.savePreset({ name: '보라 명조', ...data });
    assert.equal(a.tone.k, '#d19cff'); assert.deepEqual(a.colors, { inks: { light: { title: '#7a3cc8' } }, prop: '#e0780a', own: false }); assert.deepEqual(a.look, FULL_LOOK);
    assert.equal(lk.presetLast(), a.id);
    const b = lk.savePreset({ name: '둘째', tone: { on: false }, look: null });
    assert.equal(lk.savePreset({ name: '보라 명조', ...data, look: null }).id, a.id, '같은 이름은 덮어써요');
    assert.deepEqual(lk.presetList().map(x => x.name), ['보라 명조', '둘째']);
    assert.equal(lk.renamePreset(b.id, '보라 명조'), false); assert.equal(lk.renamePreset(b.id, '  '), false); assert.equal(lk.renamePreset(b.id, '새 이름'), true);
    lk.markPreset(b.id); assert.equal(lk.presetLast(), b.id);
    lk.forgetPreset(b.id); assert.equal(lk.presetLast(), ''); assert.equal(lk.presetList().length, 1);
    assert.equal(lk.savePreset({ name: '', ...data }), null);
    // 내보내기 → 가져오기
    const code = lk.exportPreset({ name: '옮길 것', ...data });
    assert.match(code, /^BLM1\.[A-Za-z0-9_-]+$/);
    const got = lk.importPreset(code);
    assert.equal(got.from, 'mart'); assert.equal(got.preset.name, '옮길 것'); assert.deepEqual(got.preset.look, FULL_LOOK); assert.deepEqual(got.preset.colors, a.colors); assert.equal(got.preset.tone.k2, '#7fe03c');
    // 테마 스타일(내 스타일 내보내기 JSON · BLS0 코드) — 글 모양만 · 글꼴 · 색은 건너뛰어요
    const style = { saltyStyle: 1, name: '소설책', style: { palette: 'night', fonts: { text: { ko: 'ridibatang' } }, type: { size: 17, lineHeight: 1.9, letterSpacing: -2, gutter: 24, measure: 700 }, dialogue: { style: 'tint', weight: 600, markerThick: 30 }, shadow: { on: true, targets: { dialogue: true, em: true }, alpha: 30 }, outline: { on: false }, colorOverrides: { night: { text: '#fff' } } } };
    const want = { type: { size: 17, letterSpacing: -2, lineHeight: 1.9 }, dialogue: { markerThick: 30, weight: 600 }, shadow: { on: true, targets: { dialogue: true }, alpha: 30 } };
    assert.deepEqual(lk.lookFromTheme(style), want);
    const bls0 = 'BLS0.' + Buffer.from(JSON.stringify(style)).toString('base64url');
    const th = lk.importPreset(bls0);
    assert.equal(th.from, 'theme'); assert.equal(th.preset.name, '소설책'); assert.deepEqual(th.preset.look, want); assert.equal(th.preset.tone.on, false);
    assert.deepEqual(lk.importPreset('', { json: JSON.stringify(style) }).preset.look, want, '풀어 둔 JSON(BLS1 을 화면이 푼 것)');
    const file = { blueLemonadePreset: true, version: 1, groups: { text: { 'type.size': 15, 'type.para': 1.1, 'fonts.text.ko': 'pretendard' }, marker: { 'dialogue.style': 'marker', 'dialogue.markerPos': 'bottom' }, chat: { 'chat.userSize': 90 } } };
    assert.deepEqual(lk.importPreset(JSON.stringify(file)).preset.look, { type: { size: 15, para: 1.1 }, dialogue: { style: 'marker', markerPos: 'bottom' } });
    for (const junk of ['', 'BLM1.###', '{"a":1}', 'hello']) assert.equal(lk.importPreset(junk), null, junk);
    delete globalThis.localStorage;
});

await test('숫자 조절칸 세로 2열(사용자 10-27 「파라미터는 웬만하면 다 세로 2열」 — 테마 param-two-columns · param-dimensions 와 같은 뜻): 2열 격자 · 한 열로 내리는 규칙 없음 · 칸은 윗줄 이름 · 되돌리기 · 숫자 · 단위 / 아랫줄 슬라이더 · 테마 칸 치수(손잡이 22 · 막대 5 · 칸 사이 8/12) · 혼자 남은 칸만 전체 폭 · site-rig 규칙', () => {
    const css = fs.readFileSync(path.join(MART, 'mart.css'), 'utf8'), ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
    assert.ok(css.includes('.mart-look{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px;min-width:0}'));
    // .mart-look 의 열 수를 바꾸는 규칙이 다른 곳(폰 폭 미디어 쿼리 포함)에 없어요
    const cols = [...css.matchAll(/([^{}]*)\{([^{}]*grid-template-columns[^{}]*)\}/g)].filter(m => /\.mart-look(?![\w-])/.test(m[1]));
    assert.equal(cols.length, 1, '.mart-look 열 규칙은 하나');
    for (const m of css.matchAll(/([^{}]*)\{[^{}]*grid-column:\s*1\s*\/\s*-1[^{}]*\}/g)) for (const sel of m[1].split(',')) if (/\.mart-param(?![\w-])/.test(sel.replace(':not(.mart-param)', ''))) assert.ok(/\.mart-param\.is-wide/.test(sel), `전체 폭은 혼자 남은 칸만: ${sel.trim()}`);
    assert.ok(css.includes('.mart-look>:not(.mart-param),.mart-look>.mart-param.is-wide{grid-column:1/-1}'));
    assert.ok(css.includes('.mart-param{display:flex;flex-direction:column;gap:4px;min-width:0;padding:6px 0 4px}'), '칸 안: 위아래 6 · 4 · 줄 사이 4(테마 --bl-param-pad · --bl-param-row-gap)');
    assert.ok(css.includes('::-webkit-slider-runnable-track{height:5px') && css.includes('::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;margin-top:-8.5px'), '막대 5 · 손잡이 22(테마 --bl-track-h · --bl-knob-size)');
    assert.ok(css.includes('.mart-num input{-moz-appearance:textfield;appearance:textfield;box-sizing:border-box;width:calc(5.5ch + 18px)'), '숫자칸 폭(테마 --bl-num-w)');
    // 칸 꼴: header(이름 → ↺ → 숫자 + 단위) 다음에 슬라이더
    const cell = ui.match(/if \(f\.kind === 'range'\) return `([^`]+)`;/)[1];
    const order = ['<div class="mart-param', '<header>', 'class="mart-param-name"', "undoBtn('data-look-reset'", '<span class="mart-num"><input type="number"', 'class="mart-unit"', '</header>', '<input type="range"'].map(x => cell.indexOf(x));
    assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), `칸 차례 ${order}`);
    assert.ok(ui.includes("wide: (j - i) % 2 === 1 && k === j - 1"), '이어진 슬라이더 칸이 홀수면 마지막 칸만 전체 폭');
    const rule = fs.readFileSync(path.join(ROOT, 'tools/site-rig/rules/param-grid.mjs'), 'utf8'), rig = fs.readFileSync(path.join(ROOT, 'tools/site-rig/site-rig.mjs'), 'utf8');
    assert.ok(rule.includes("export const id = 'param-grid'") && rule.includes('한 열로 내려감') && rule.includes('짝 없는 칸'));
    for (const w of ['글꾸 · 조절 본문', '글꾸 · 조절 그림자']) assert.ok(rig.split('\n').some(l => /^\s*\{ group:/.test(l) && l.includes(`'${w}'`)), w);
});

// ── 11-11 「내 글 넣기」(mine-text.js) ──
const mineTail = fs.readFileSync(path.join(MART, 'tone-state.js'), 'utf8').match(/'\.\/mine-text\.js(\?v=\w+)'/)[1];
const mt = await import(pathToFileURL(path.join(MART, 'mine-text.js')).href + mineTail);
const MINE_LOGS = {
    짧은: '하린: "오늘은 일찍 왔네?"\n도윤: "네가 먼저 와 있을 줄 알았지."',
    셋: '하린: 문이 열리자 바람이 들어왔다. "누구야?"\n도윤: "나야. 문 좀 닫아 줄래?"\n서아: *오랜만이네.* "둘 다 여기 있었구나."\n하린: "서아까지?"\n도윤: **아무 날도 아니야.** 그냥 ~~우연~~ 약속이었지. "앉아."\n서아: "그럼 나는 창가 자리."',
    그냥글: '비가 그친 골목은 젖어 있었다. 하린은 *괜히 왔나* 하고 생각했다.\n\n"……정말 올 줄은 몰랐어."\n\n도윤은 웃었다.\n\n"들어가자. **추워.**"',
    긴: Array.from({ length: 60 }, (_, i) => `${i % 2 ? '도윤' : '하린'}: 긴 밤이었다. "${i}번째 이야기."`).join('\n'),
};
await test('내 글 넣기: 붙여 넣은 글을 28틀의 글 자리(지문 · 화자 이름 · 대사)에 나눠 넣어요 — 견본 글이 안 남고 · 소리 카드 · 쪽 넘김 · 제목 · 소품 그대로 · 화자 셋이면 셋째는 둘째 본에 제 이름 · 속마음 · 강조 · 취소는 em · strong · s · 긴 글은 80줄까지 · 꺼져 있으면 한 글자도 안 달라요 · 복사 글 정적 검사', () => {
    const m3 = mt.mineModel(MINE_LOGS.셋), mg = mt.mineModel(MINE_LOGS.그냥글), ml = mt.mineModel(MINE_LOGS.긴);
    assert.deepEqual(m3.names, ['하린', '도윤', '서아']);
    assert.deepEqual(m3.lines.filter(l => l.type === 'dl').map(l => l.who), [0, 1, 2, 0, 1, 2]);
    assert.ok(m3.lines.some(l => l.type === 'nr' && l.html.includes('<strong>아무 날도 아니야.</strong>') && l.html.includes('<s>우연</s>')) && m3.lines.some(l => l.type === 'nr' && l.html.includes('<em>오랜만이네.</em>')));
    assert.deepEqual(mg.names, ['깡통', '깡캐']); assert.deepEqual(mg.lines.filter(l => l.type === 'dl').map(l => l.who), [0, 1], '이름 없는 글은 대사를 번갈아');
    assert.equal(ml.lines.length, mt.MAX_LINES); assert.equal(ml.cut, true);
    assert.equal(mt.mineModel('').lines.length, 0);
    for (const row of six.items) {
        const p = sfx[row.id].preview;
        assert.equal(mt.fillMine(p, null), p); assert.equal(mt.fillMine(p, mt.mineModel('')), p);
        for (const [name, log] of Object.entries(MINE_LOGS)) {
            const model = mt.mineModel(log), out = mt.fillMine(p, model), body = out.slice(out.indexOf('</style>')), tag = `${row.id} ${name}`;
            assert.notEqual(out, p, tag);
            assert.equal(out.slice(0, out.indexOf('</style>')), p.slice(0, p.indexOf('</style>')), `${tag} <style> 그대로`);
            assert.doesNotMatch(body, /옥상 문을 밀자|깡캐는 대답 대신|여기 있을 줄 알았어/, `${tag} 견본 글이 남음`);
            assert.equal((body.match(/<p class="gk-dl"/g) || []).length, model.lines.filter(l => l.type === 'dl').length, `${tag} 대사 줄 수`);
            for (const k of ['class="gk-sd"', 'gk-p2', 'class="gk-tt"', '<audio', '<details', '<summary']) assert.equal((out.match(new RegExp(k, 'g')) || []).length, (p.match(new RegExp(k, 'g')) || []).length, `${tag} ${k}`);
            for (const t of ['div', 'p', 'span']) { const bal = h => (h.match(new RegExp(`<${t}\\b`, 'g')) || []).length - (h.match(new RegExp(`</${t}>`, 'g')) || []).length; assert.equal(bal(out), bal(p), `${tag} ${t} 짝`); }
            if (name === '셋') { assert.ok(body.includes('>서아</p>') && body.includes('<em>오랜만이네.</em>'), tag); if (/gk-sn/.test(p)) assert.match(body, /<span class="gk-sn gk-s[A-Z]">(하린|도윤)<\/span>/, `${tag} 소리 이름표`); }
            const ready = sf.simpleReady(shutPeek(sf.toneSimple(out, '#d19cff', { mode: 'light', other: '#7fe03c' })));
            assert.ok(tg.readyReport(ready).ok, `${tag} 정적 검사`); assert.equal((ready.match(/<style>/g) || []).length, 1);
            assert.equal(mt.fillMine(out, model).length >= out.length * 0.5, true);
        }
    }
});

await test('내 글 넣기 상태: 켬 · 글을 이 브라우저에 기억 · 다시 읽어요 · 「견본 글로」는 글을 남기고 끄기 · 「지우기」 · toneOut 길과 다시 칠하기 열쇠 · 내 글에서 고쳐 쓴 글은 따로(mineTexts)', async () => {
    const store = {};
    globalThis.localStorage = { getItem: k => store[k] ?? null, setItem(k, v) { store[k] = v; }, removeItem(k) { delete store[k]; } };
    const href = pathToFileURL(path.join(MART, 'mine-text.js')).href + mineTail;
    const ts = await import(`${pathToFileURL(path.join(MART, 'tone-state.js')).href}?mine=1`);
    const it = { ...six.items[0], ...sfx[six.items[0].id], kind: 'geulkku' };
    ts.setTone({ mode: 'light', on: false, k2: null });
    const base = ts.toneOut(it, it.preview), key0 = ts.toneKey();
    assert.equal(mt.mineOn(), false);
    mt.setMine({ text: MINE_LOGS.짧은, on: true });
    assert.equal(mt.mineOn(), true); assert.notEqual(ts.toneKey(), key0);
    const mine = ts.toneOut(it, it.preview);
    assert.ok(mine.includes('하린') && !mine.includes('옥상 문을 밀자'));
    assert.deepEqual(JSON.parse(store['bl-mart-mine-text-v1']), { on: true, text: MINE_LOGS.짧은 });
    const again = await import(`${href}&re=1`);
    assert.equal(again.mineOn(), true); assert.equal(again.mineText(), MINE_LOGS.짧은);
    // 내 글에서 고쳐 쓴 글은 mineTexts — 견본 글로 돌리면 안 걸려요
    const tuneHref = pathToFileURL(path.join(MART, 'tune.js')).href + fs.readFileSync(path.join(MART, 'tone-state.js'), 'utf8').match(/'\.\/tune\.js(\?v=\w+)'/)[1];
    const tu2 = await import(tuneHref);
    tu2.setTune(it.id, { mineTexts: { 0: '내 글 제목' } });
    assert.ok(ts.toneOut(it, it.preview).includes('내 글 제목'));
    mt.setMine({ on: false });
    assert.equal(mt.mineText(), MINE_LOGS.짧은, '견본 글로 — 글은 남아요');
    assert.equal(ts.toneOut(it, it.preview), base, '견본 글로 돌리면 처음과 같아요(내 글에서 고친 글도 안 걸려요)');
    tu2.setTune(it.id, null);
    mt.setMine({ text: '', on: false });
    assert.equal(mt.mineText(), ''); assert.equal(mt.mineOn(), false);
    assert.equal(mt.setMine({ text: '   ', on: true }), null, '빈 글은 안 켜져요');
    delete globalThis.localStorage;
});

// ── 11-11 남은 칸(Opus 5.5): 형광펜 모양 · 속마음 · 강조 · 취소선 · 이름 글자 · 대사 줄 · 틀 넘침 손봄 ──
await test('남은 칸: 형광펜 모양 · 기울기 = 테마 markerGeometry 와 같은 값(펜 자국 · 직사각형 · 알약) · 속마음 · 강조 · 취소선 · 이름 글자 규칙(fill 짝) · 테마 스타일에서 속마음 · 강조 · 취소선 · 이름도 읽기 · 견본 글 한 줄 em · strong · s 가 글 칸', () => {
    // 테마 apply.js 값(두께 54 · 일직선 → 30~84 · 대각선 → 왼 38 오른 20 · 아래 → 띠 아랫변 96)
    const svgOf = t => [...String(t).matchAll(/data:image\/svg\+xml,([^"]+)/g)].map(m => decodeURIComponent(m[1])).join('\n');
    assert.deepEqual(lk.markerGeometry({}), { T: 54, l: 30, r: 30 });
    assert.deepEqual(lk.markerGeometry({ tilt: 'slant' }), { T: 54, l: 38, r: 20 });
    assert.deepEqual(lk.markerGeometry({ markerPos: 'bottom', markerThick: 40 }), { T: 40, l: 56, r: 56 });
    for (const shape of ['stroke', 'rectangle', 'pill']) { const bg = lk.markerBackground({ markerShape: shape }, 'rgba(58,167,255,.18)'); assert.match(bg, /^url\("data:image\/svg\+xml,[^"]+"\) center /, shape); assert.ok(svgOf(bg).includes("fill='rgb(58,167,255)'") && svgOf(bg).includes("fill-opacity='0.18'"), shape); }
    const p = sfx['simple-k1'].preview, K = '.gk-k1.gk-k1.gk-k1';
    const L = { em: { italic: false, color: '#6b4fa0', size: 17, weight: 500, letterSpacing: 2 }, strong: { color: '#9a2f4a', gold: '#ffe23c', size: 18, weight: 800, letterSpacing: -1 }, strike: { line: 'own', color: '#ff7a7a', italic: true, thickness: 2.5, fade: 60 }, profile: { nameSize: 15, nameWeight: 800, nameSpacing: 5 }, dialogue: { style: 'marker', markerShape: 'pill' } };
    assert.deepEqual(lk.cleanLook(L), L);
    const r = lk.lookRules(p, L).join('\n');
    assert.ok(r.includes(`${K} em{font-style:normal;color:#6b4fa0;-webkit-text-fill-color:#6b4fa0;font-size:17px;font-weight:500;letter-spacing:0.02em}`));
    assert.ok(r.includes(`${K} strong{color:#9a2f4a;-webkit-text-fill-color:#9a2f4a;box-shadow:inset 0 -0.36em rgba(255,226,60,0.62);font-size:18px;font-weight:800;letter-spacing:-0.01em}`));
    assert.ok(r.includes(`${K} s{text-decoration-line:line-through;text-decoration-color:#ff7a7a;text-decoration-thickness:2.5px;font-style:italic;opacity:0.6}`));
    assert.ok(r.includes(`${K} p.gk-nm{font-size:15px;font-weight:800;letter-spacing:0.05em}`));
    assert.ok(svgOf(r).includes('<mask id=\'m\''), '알약 형광펜');
    assert.deepEqual(lk.lookRules(p, { strike: { line: 'none', thickness: 3 } }), [`${K} s{text-decoration-line:none}`]);
    // 테마 스타일 → 글 모양(속마음 · 강조 · 취소선 · 이름 · 형광펜 모양)
    const style = { saltyStyle: 1, name: 'x', style: { em: { italic: false, size: 18, weight: 500 }, strong: { weight: 700 }, strike: { line: true, own: true, color: '#112233', thickness: 3 }, profile: { nameSize: 30, nameWeight: 650 }, dialogue: { style: 'marker', markerShape: 'rectangle', tilt: 'steep' } } };
    assert.deepEqual(lk.lookFromTheme(style), { dialogue: { style: 'marker', markerShape: 'rectangle', tilt: 'steep' }, em: { italic: false, size: 18, weight: 500 }, strike: { line: 'own', color: '#112233', thickness: 3 }, strong: { weight: 700 }, profile: { nameSize: 24, nameWeight: 650 } });
    assert.deepEqual(lk.lookFromTheme({ saltyStyle: 1, style: { strike: { line: false } } }), { strike: { line: 'none' } });
    // 견본 글 한 줄의 em · strong · s 는 글 칸
    // 속마음 · 강조 · 취소가 든 지문은 통째로 한 칸(안의 꾸밈은 따로 칸이 아니에요 — 11-11 바로 고치기 넓히기)
    const ed = tu.editables(p).filter(e => e.text.includes('<em>'));
    assert.deepEqual(ed.map(e => [e.cls, e.text]), [['gk-nr', '<em>또 기다렸구나.</em> 깡통은 <strong>따뜻한 쪽</strong>을 받아 들고 <s>화난 척</s>을 그만두었다.']]);
});

await test('대사 줄 늘리기 · 줄이기: 28틀에서 견본 대사 쌍을 번갈아 붙이거나(+1 · +2) 마지막 쌍을 빼요(-1) · 지문 · 소리 카드 · 쪽 넘김 · <style> 그대로 · 태그 짝 · 복사 글 정적 검사 · 범위 밖은 버려요 · 내 글이면 안 걸어요', () => {
    for (const row of six.items) {
        const p = sfx[row.id].preview, nDl = h => (h.match(/<p class="gk-dl"/g) || []).length, n0 = nDl(p);
        for (const k of [-1, 1, 2]) {
            const out = tu.applyLines(p, k), tag = `${row.id} ${k}`;
            assert.equal(nDl(out), n0 + k, tag);
            assert.equal(out.slice(0, out.indexOf('</style>')), p.slice(0, p.indexOf('</style>')), tag);
            for (const x of ['class="gk-sd"', 'gk-p2', 'class="gk-nr"', '<details', '<summary']) assert.equal((out.match(new RegExp(x, 'g')) || []).length, (p.match(new RegExp(x, 'g')) || []).length, `${tag} ${x}`);
            for (const t of ['div', 'p', 'span']) { const bal = h => (h.match(new RegExp(`<${t}\\b`, 'g')) || []).length - (h.match(new RegExp(`</${t}>`, 'g')) || []).length; assert.equal(bal(out), bal(p), `${tag} ${t}`); }
            assert.ok(tg.readyReport(sf.simpleReady(shutPeek(out))).ok, tag);
            assert.equal(tu.applyTune(p, { lines: k }), out, `${tag} applyTune`);
            assert.equal(tu.applyTune(p, { lines: k }, { mine: true }), p, `${tag} 내 글이면 안 걸어요`);
        }
        if (n0 >= 2) { const o = tu.applyLines(p, 2); const names = [...o.matchAll(/<p class="gk-nm gk-n([A-Z])">/g)].map(m => m[1]); assert.notEqual(names.at(-1), names.at(-2), `${row.id} 번갈아`); }
    }
    for (const bad of [3, -2, 1.5, 'x']) assert.equal(tu.cleanTune({ lines: bad }), null, String(bad));
});

await test('틀 넘침 손봄: k14 쥘부채 · q10 RPG 스탯에만 · 기본 규칙 덩이 끝에 한 번씩 · 다른 틀은 그대로', () => {
    for (const row of six.items) {
        const k = row.id.slice(7), base = partsOf(sfx[row.id].preview)[0];
        for (const [key, rules] of Object.entries(gen.FIT_RULES)) for (const r of rules) assert.equal(base.split(r).length - 1, key === k ? 1 : 0, `${k} ${r}`);
    }
});

await test('되돌리기 · 다시하기(테마 hist 꼴): 단추 둘 · 스냅샷 50 · 0.5초 묶음 · Ctrl+Z / Ctrl+Y · Ctrl+Shift+Z · 입력칸 안에서는 그 칸 것 · 되돌리는 동안은 기록 안 함 · 다른 틀은 새로', () => {
    const ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
    for (const s of ['data-hist="undo"', 'data-hist="redo"', 'const HIST_MAX = 50;', 'setTimeout(() => { histPush(item); syncHist(sheet); }, 500)', "if (e.target.closest?.('input, textarea, select')) return;", "undo(k === 'y' || e.shiftKey ? 1 : -1)", 'if (hist.restoring || hist.id !== item.id) return;', 'if (item && hist.id !== item.id) histStart(item);']) assert.ok(ui.includes(s), s);
    assert.ok(/const snapOf = item => JSON\.stringify\(\{ tune: tuneOf\(item\.id\), look: lookNow\(\), words: wordsNow\(\), tone: \{/.test(ui), '한 칸 = 조절 값 + 글 모양 + 이름 숨김 · 단어 바꾸기 + 깡통 · 깡캐 · 밤낮');
});

await test('바로 고치기 넓히기: 고쳐 쓴 글에 줄바꿈 · 굵게 · 기울임 · 강조 · 속마음 · 취소만 남기고(속성 없이) 나머지는 글자 · 붙여 넣은 줄 · 문단은 줄바꿈 · 안 닫힌 꾸밈은 닫아요 · 28틀에 넣어도 태그 짝 · 복사 글 정적 검사 · 다시 고쳐 쓸 때도 그 칸', () => {
    const c = tu.cleanRich;
    assert.equal(c('plain'), 'plain'); assert.equal(c('a<b>굵</b>c'), 'a<b>굵</b>c'); assert.equal(c('줄\n바꿈'), '줄<br>바꿈');
    assert.equal(c('<b class="x" onclick="y">b</b><img src=x onerror=1>'), '<b>b</b>'); assert.equal(c('<i>안 닫힘'), '<i>안 닫힘</i>');
    assert.equal(c('x<div>y</div>z'), 'x<br>yz'); assert.equal(c('&amp; & <'), '&amp; &amp; &lt;'); assert.equal(c('<br><br><br><br>a<br>'), 'a');
    for (const row of six.items) {
        const p = sfx[row.id].preview, eds = tu.editables(p), nr = eds.find(e => e.cls === 'gk-nr'), dl = eds.find(e => e.cls === 'gk-d');
        const out = tu.applyTune(p, { texts: { [nr.i]: '첫 줄<br><b>굵게</b> <i>기울임</i>', [dl.i]: '「한 줄<br>두 줄」' } });
        assert.ok(out.includes('첫 줄<br><b>굵게</b> <i>기울임</i>') && out.includes('「한 줄<br>두 줄」'), row.id);
        for (const t of ['div', 'p', 'span', 'b', 'i']) { const bal = h => (h.match(new RegExp(`<${t}\\b`, 'g')) || []).length - (h.match(new RegExp(`</${t}>`, 'g')) || []).length; assert.equal(bal(out), bal(p), `${row.id} ${t}`); }
        assert.ok(tg.readyReport(sf.simpleReady(shutPeek(out))).ok, row.id);
        const again = tu.editables(out);
        assert.equal(again.length, eds.length, `${row.id} 고쳐 쓴 뒤에도 칸 수 그대로`);
        assert.equal(again[nr.i].text, '첫 줄<br><b>굵게</b> <i>기울임</i>');
    }
    const ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
    for (const s of ["document.execCommand('insertLineBreak')", "document.execCommand(e.key.toLowerCase() === 'b' ? 'bold' : 'italic')", "document.execCommand('insertText', false, text)", "const ONE_LINE = '.gk-tt, .gk-nm, .gk-sn';"]) assert.ok(ui.includes(s), s);
});

await test('머리 칸 · 보일 것: 제목이 누름 칸 안인 틀(01 · 02 · 08 · 14)은 제목 끄기 없음 · 나머지는 제목 · 밑줄을 끄는 규칙 · 이름 줄 끄기 · 05 숨은 한 줄은 글 칸(15 요람 빈 조각은 아님) · 값 없으면 그대로', () => {
    assert.deepEqual(six.items.filter(r => tu.titleInPress(sfx[r.id].preview)).map(r => r.id.slice(7)), ['k1', 'k2', 'k8', 'k14']);
    for (const row of six.items) {
        const p = sfx[row.id].preview, K = `.gk-${sf.simpleFrameInfo(p).key}`.repeat(3), press = tu.titleInPress(p);
        assert.deepEqual(tu.showRules(p, {}), []);
        assert.deepEqual(tu.showRules(p, { hideTitle: true }), press ? [] : [`${K} .gk-tt,${K} .gk-ul{display:none}`], row.id);
        assert.deepEqual(tu.showRules(p, { hideNames: true }), [`${K} p.gk-nm{display:none}`]);
        const out = tu.applyTune(p, { hideTitle: true, hideNames: true });
        assert.ok(out.includes(`${K} p.gk-nm{display:none}`) && (press ? !out.includes('.gk-tt,') : out.includes(`${K} .gk-tt,${K} .gk-ul{display:none}`)), row.id);
        assert.ok(tg.readyReport(sf.simpleReady(shutPeek(out))).ok, row.id);
        assert.equal(tu.editables(p).filter(e => e.cls === 'gk-hl').length, row.id === 'simple-k5' ? 1 : 0, `${row.id} 숨은 한 줄 칸`);
    }
    assert.deepEqual(tu.cleanTune({ hideTitle: true, hideNames: false, x: 1 }), { hideTitle: true });
});

await test('도구 — 이름 숨김 · 단어 바꾸기(테마 transformLog 사본): 글자만 바꾸고 <style> · 주석 · 태그 그대로 · 화자 이름표는 통째로 가림 · ○○ · ▒▒ · 테이프 칸(fill 짝) · 직접 글자 · 조사 맞춤 · 끈 이름은 그대로 · 꺼져 있으면 한 글자도 안 달라요 · 28틀 정적 검사', async () => {
    const wd = await imp(path.join(MART, 'words.js'));
    for (const row of six.items) {
        const p = sfx[row.id].preview, head = h => h.slice(0, h.indexOf('</style>'));
        assert.equal(wd.applyWords(p, { auto: ['깡통'], words: {} }), p);
        assert.equal(wd.applyWords(p, { auto: ['깡통'], words: { hide: false, names: ['깡통'] } }), p);
        for (const mask of ['auto', 'mosaic', 'tape', 'word']) {
            const out = wd.applyWords(p, { auto: ['깡통', '깡캐'], words: { hide: true, off: ['깡캐'], mask, word: '★', rules: [{ from: '옥상', to: '지붕' }] } });
            const body = out.slice(out.indexOf('</style>')), tag = `${row.id} ${mask}`;
            assert.equal(head(out), head(p), `${tag} <style>`);
            assert.doesNotMatch(body.replace(/<!--[\s\S]*?-->/g, ''), /깡통/, `${tag} 깡통이 남음`);
            assert.ok(body.includes('깡캐'), `${tag} 끈 이름은 그대로`);
            assert.doesNotMatch(body.replace(/<!--[\s\S]*?-->/g, ''), /옥상/, `${tag} 옥상이 남음`);
            const nameLine = body.match(/<p class="gk-nm gk-n[A-Z]">((?:(?!<\/p>)[\s\S])*)<\/p>/g).find(x => !x.includes('깡캐'));
            if (mask === 'auto') assert.ok(nameLine.includes('>○○<'), tag);
            if (mask === 'mosaic') assert.ok(nameLine.includes('>▒▒<'), tag);
            if (mask === 'word') assert.ok(nameLine.includes('>★<'), tag);
            if (mask === 'tape') assert.match(nameLine, /<span data-bl-mask="" style="background-color:#[0-9a-f]{6};color:#[0-9a-f]{6};-webkit-text-fill-color:#[0-9a-f]{6};border-radius:2px">　+<\/span>/, tag);
            for (const t of ['div', 'p', 'span']) { const bal = h => (h.match(new RegExp(`<${t}\\b`, 'g')) || []).length - (h.match(new RegExp(`</${t}>`, 'g')) || []).length; assert.equal(bal(out), bal(p), `${tag} ${t}`); }
            assert.ok(tg.readyReport(sf.simpleReady(shutPeek(out))).ok, `${tag} 정적 검사`);
        }
    }
    const p = sfx['simple-k1'].preview;
    assert.ok(wd.applyWords(p, { words: { rules: [{ from: '깡통', to: '하린' }] } }).includes('하린은 난간에'), '조사 그대로(받침 있음)');
    assert.ok(wd.applyWords(p, { words: { rules: [{ from: '깡통', to: '도유' }] } }).includes('도유는 난간에'), '조사 맞춤(받침 없음)');
    assert.deepEqual(wd.cleanWords({ names: [' a ', 'a', ''], rules: [{ from: '', to: 'x' }, { from: 'b', to: '' }], mask: 'nope', word: '' }), { hide: false, names: ['a'], off: [], mask: 'auto', word: '○○', rules: [{ from: 'b', to: '' }] });
});

await test('숨기기(스포일러 · 테마 블록 숨김 꼴): 지문 · 대사 줄(p)을 통째로 눌러야 보이는 글로 · p 안에 details 를 안 넣어요(HTML 이 p 를 닫아요) · 28틀 · 꾸밈 규칙은 틀 <style> 한 곳 · 알약 무테 · fill 짝 · 복사 글 <style> 하나 · 정적 검사 · 제목 · 이름은 안 숨김 · 견본 글과 내 글 따로', () => {
    for (const row of six.items) {
        const p = sfx[row.id].preview, eds = tu.editables(p), nr = eds.find(e => e.cls === 'gk-nr'), dl = eds.find(e => e.cls === 'gk-d'), tt = eds.find(e => e.cls === 'gk-tt'), nm = eds.find(e => e.cls === 'gk-nm');
        const out = tu.applyTune(p, { spoilers: [nr, dl, tt, nm].filter(Boolean).map(e => ({ i: e.i })) });
        assert.equal((out.match(/data-bl-spoiler=""/g) || []).length, 2, row.id);
        assert.equal((out.match(/\.blsp-s>summary\{/g) || []).length, 1, `${row.id} 꾸밈 규칙 한 번`);
        assert.doesNotMatch(out, /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<details/, `${row.id} p 안에 details 없음`);
        assert.match(out, /<details class="blsp-s blsp-k" data-bl-spoiler=""[^>]*><summary[^>]*><span class="blsp-l"[^>]*>[^<]+<\/span><div class="blsp-b"[^>]*><p class="gk-nr">/, `${row.id} 지문 줄 통째로`);
        assert.match(out, /class="blsp-l" style="[^"]*border:1px solid transparent;[^"]*color:#8b8e96;-webkit-text-fill-color:#8b8e96;/, `${row.id} 무테 · fill`);
        const ready = sf.simpleReady(shutPeek(out));
        assert.equal((ready.match(/<style>/g) || []).length, 1, row.id); assert.ok(tg.readyReport(ready).ok, row.id);
        assert.equal(tu.applyTune(p, { mineSpoilers: [{ i: nr.i }] }), p, `${row.id} 내 글 숨김은 견본에 안 걸려요`);
    }
    assert.deepEqual(tu.cleanTune({ spoilers: [{ i: 1 }, { i: 1 }, { i: -1 }, { i: 'x' }] }), { spoilers: [{ i: 1 }] });
});


await test('글만 복사(마크다운 · 테마 logMarkdown 꼴): 28틀 모두 # 제목 · **이름** 한 줄 · 태그 없음 · 속마음 *…* · 강조 **…** · 취소 ~~…~~ · 숨긴 줄은 글이 한 번만(흐린 사본 빼요) · 내려받기 · 글만 단추가 이어져요', () => {
    const want = mt.frameMarkdown(sfx[six.items[0].id].preview);
    for (const row of six.items) {
        const p = sfx[row.id].preview, md = mt.frameMarkdown(sf.simpleReady(shutPeek(p)));
        assert.match(md, /^# 비 그친 뒤, 옥상에서\n\n/, row.id);
        assert.match(md, /\n\*\*깡통\*\*\n「/, row.id); assert.match(md, /\n\*\*깡캐\*\*\n「/, row.id);
        assert.doesNotMatch(md, /[<>]|&(?:amp|lt|gt|nbsp);/, row.id);
        assert.match(md, /\*또 기다렸구나\.\*/, row.id); assert.match(md, /~~화난 척~~/, row.id);
        assert.ok(md.startsWith(want.trimEnd()), `${row.id} 틀이 달라도 글만은 같아요(틀에 따라 끝에 한 줄 더 있는 견본만 달라요)`);
        const nr = tu.editables(p).find(e => e.cls === 'gk-nr');
        const sp = mt.frameMarkdown(sf.simpleReady(shutPeek(tu.applyTune(p, { spoilers: [{ i: nr.i }] }))));
        assert.equal(sp.split('젖은 바닥 냄새').length, 2, `${row.id} 숨긴 줄 한 번`);
    }
    const ms = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8'), ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
    assert.match(ms, /act === 'download'\) downloadHtml\(state\)/); assert.match(ms, /act === 'text'\) copyText\(state\)/);
    assert.match(ms, /<!doctype html>\\n<meta charset="utf-8">/);   // doctype 없으면 quirks — 클래스 대소문자를 안 가려요
    assert.match(ui, /data-act="download"/); assert.match(ui, /data-act="text"/);
});

await test('레몬 바로가기 빼기(모든 틀 공통 · 글 모양에 기억 · 프리셋에도): 28틀 모두 레몬 링크 · 그림 규칙이 빠지고 · 레몬만 있던 머리 줄도 빠지고 · 소품이 남은 머리 줄은 오른쪽 그대로 · 복사 글 정적 검사 · 기본은 달기', () => {
    for (const row of six.items) {
        const p = sfx[row.id].preview, out = lk.applyLook(p, { lemon: { off: true } });
        assert.match(p, /class="gk-lm"/, row.id);
        assert.doesNotMatch(out, /gk-lm/, row.id + ' 레몬 다 빠짐');
        assert.doesNotMatch(out, /<div class="gk-hd">\s*<\/div>/, row.id + ' 빈 머리 줄 없음');
        if (/<div class="gk-hd">/.test(out)) assert.match(out, /\.gk-hd\{justify-content:flex-end\}/, row.id + ' 소품 오른쪽');
        const ready = sf.simpleReady(shutPeek(out));
        assert.ok(tg.readyReport(ready).ok, row.id);
        assert.equal(lk.applyLook(p, null), p, row.id + ' 기본은 그대로');
    }
    assert.deepEqual(lk.cleanLook({ lemon: { off: true } }), { lemon: { off: true } });
    assert.equal(lk.cleanLook({ lemon: { off: false } }), null);
    assert.equal(lk.cleanPreset({ name: '레몬', look: { lemon: { off: true } } }).look.lemon.off, true);
    assert.match(fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8'), /data-lemon="0"/);
});
// ── 11-11 전수조사 합격 틀(sp-pass-* 조각 · 뿌리 gk-k1001 ~) ──
await test('전수조사 합격 틀: pass-defs.json 줄마다 틀 파일 · 목록 줄 · 조각(40틀씩) · 미리보기 · 세 덩이 · 원래 색 그대로 · 다른 색 · 캐릭터 없음 × 낮밤에서 기본 덩이 그대로 · <style> 하나 · 복사 글 <style> 하나 · 열쇠는 첫 묶음과 안 겹침', () => {
    const rows = sixAll.items.filter(x => x.c !== 'sp-simple');
    assert.equal(rows.length, gen.PASS_DEFS.length);
    assert.equal(sixAll.count, six.count + rows.length);
    assert.deepEqual(rows.map(x => x.id), gen.PASS_DEFS.map(d => d.id));
    const keys = new Set();
    const items = {};
    for (const [ck, c] of Object.entries(sixAll.chunks)) if (ck !== 'sp-simple') { assert.ok(c.n <= gen.PASS_STEP); Object.assign(items, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items); }
    for (const row of rows) {
        assert.match(row.c, /^sp-pass-\d+$/);
        const { html } = gen.frameHtml(gen.PASS_DEFS.find(d => d.id === row.id));
        const info = sf.simpleFrameInfo(html);
        assert.ok(info && /^k1\d{3}$/.test(info.key) && !keys.has(info.key), row.id); keys.add(info.key);
        assert.ok(items[row.id] && items[row.id].preview.includes(`gk-${info.key}`), row.id);
        assert.equal(partsOf(html).length, 3, row.id);
        assert.equal(sf.toneSimple(html, undefined, { mode: info.base === 'gk-tl' ? 'light' : 'dark' }).match(/<style>/g).length, 1);
        const base = partsOf(html)[0];
        for (const K of ['#3ccfbf', null]) for (const mode of ['light', 'dark']) {
            const out = sf.toneSimple(html, K, { mode });
            assert.equal((out.match(/<style>/g) || []).length, 1, `${row.id} ${K} ${mode}`);
            assert.equal(partsOf(out)[0], base, `${row.id} ${K} ${mode} 기본 덩이`);
        }
        assert.equal((sf.simpleReady ? sf.simpleReady(html) : html).match(/<style>/g).length, 1, row.id);
    }
});


globalThis.__ownTs = await import(`${pathToFileURL(path.join(MART, 'tone-state.js')).href}?own=1`);
await test('기본 색 잇기(sk-own): 원래 색이면 기본 색 · 캐릭터를 고르면 「소품도 캐릭터 색」(기본 켬)이면 sk-own 을 떼고 · 끄면 둔 채 글 쪽만 · 틀마다 고른 값이 먼저 · 표시 열쇠에 켬끔', () => {
    const ts = globalThis.__ownTs;
    const row = six.items[0], p0 = sfx[row.id].preview;
    const p = p0.replace(/^(\s*<div\b[^>]*\sclass="gk\s)/, '$1sk-own ');   // 기본 색 판 흉내(뿌리 class 하나)
    assert.ok(sf.hasOwnTone(p));
    const it = { ...row, ...sfx[row.id], preview: p, kind: 'geulkku', simple: true };
    const rootOf = h => (h.match(/^\s*<div\b[^>]*\sclass="([^"]*)"/) || [])[1] || '';
    ts.setTone({ on: false, k2: null, cover: true });
    assert.equal(ts.castPicked(), false); assert.equal(ts.ownOf({}), undefined);
    assert.match(rootOf(ts.toneOut(it, p)), /\bsk-own\b/, '원래 색 → 기본 색');
    const k0 = ts.toneKey();
    ts.setTone({ on: true, k: '#3aa7ff', name: '시험' });
    assert.equal(ts.ownOf({}), false);
    assert.doesNotMatch(rootOf(ts.toneOut(it, p)), /\bsk-own\b/, '캐릭터 + 덮기 켬 → 소품도 캐릭터 색');
    ts.setTone({ cover: false });
    assert.notEqual(ts.toneKey(), k0);
    assert.match(rootOf(ts.toneOut(it, p)), /\bsk-own\b/, '덮기 끔 → 소품 기본 색');
    assert.equal(ts.ownOf({ own: false }), false, '틀마다 캐릭터 색이 먼저');
    ts.setTone({ cover: true });
    assert.equal(ts.ownOf({ own: true }), undefined, '틀마다 기본 색이 먼저');
    ts.setTone({ on: false, k2: '#ff5fa2', name2: '둘째' });
    assert.equal(ts.ownOf({}), false, '깡캐만 골라도 캐릭터를 고른 것');
    ts.setTone({ on: false, k: null, k2: null });
    assert.deepEqual(tu.cleanTune({ own: true }), { own: true }); assert.deepEqual(tu.cleanTune({ own: false }), { own: false }); assert.equal(tu.cleanTune({ own: 'x' }), null);
});
console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
