#!/usr/bin/env node
// 글꾸 마트 「심플 새 틀」 길 시험(11-11 · DOM 없음 · node 24 · 외부 의존 없음)
//   node tools/geulkku-simple-test.mjs [--fast]
//   ① 톤 사다리 = 테마 toneLadder(같은 식 · 같은 값) · 사본의 기존 함수 그대로 ② 색 블록 갈아 끼우기(원래 색 = 시안 그대로 · 다른 색 = 시안 식 · 낮밤 · 되풀이) ③ 재생 선 필터 = song-templates.cjs
//   ④ 실제 틀 여덟(이식판 그대로) ⑤ 미리보기 열린 판 · 복사 글 닫힌 판 ⑥ HTML 복사 <style> 하나 · 고칠 자리 주석
//   ⑦ 옛 글꾸 없음(11-11 — 목록 · 자료 · 화면 · 지니 · 도구 · site-rig) · 액자 자료 그대로
//   --fast: (예전에 쓰던 꼬리 — 지금은 같은 시험을 다 돌려요)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
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

// 테마 시험의 기대값(톤 사다리 판 4564922f 의 tools/tests/char-tone-ladder.mjs CONFIRMED) + 보고서 6절 표
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
await test('톤 사다리: 마트 사본 = 테마 톤 사다리 판(4564922f) char-tone.js(첫 줄 출처 주석만 다름 · 결과도 같음)', async () => {
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
    k1: ['낫표', 'open', true], k2: ['견출지', 'tap', false], k3: ['바인더', 'tap', false], k4: ['줄자', 'tap', false], k5: ['티백', 'tap', true], k6: ['음성 메모', 'sound', false], k7: ['성냥', 'tap', true], k8: ['블라인드', 'open', true],
    k09: ['지퍼', 'open', true], k10: ['모래시계', 'open', true], k11: ['실 전화', 'sound', true], k12: ['돋보기', 'tap', false], k13: ['형광펜', 'tap', true],
    k14: ['쥘부채', 'open', true], k15: ['뉴턴의 요람', 'tap', false], k16: ['지우개', 'tap', false], k17: ['바람개비', 'tap', false], k18: ['토스터', 'open', true],
    q01: ['여름 바다', 'still', false], q02: ['흐림', 'tap', false], q03: ['새해 첫날', 'tap', true], q04: ['새벽', 'tap', true], q05: ['메신저', 'tap', false],
    q06: ['편지 봉투', 'open', true], q07: ['호박', 'tap', true], q08: ['라면', 'tap', false], q09: ['카페 영수증', 'tap', true], q10: ['RPG 스탯', 'tap', false],
};
await test('실제 틀 스물여덟: 이식판 원래 판과 한 글자도 안 다르게 들어갔고(소리 카드 src · 미리보기 열림만 다름) · 이름 · 분류 · 미리보기 열림 · 설명이 자리 채움이 아님', () => {
    assert.deepEqual(six.items.map(x => x.id), Object.keys(WANT).map(k => `simple-${k}`));
    assert.equal(six.count, 28);
    assert.deepEqual(six.categories.map(c => c.label), ['눌러서 열어요', '누르면 바뀌어요', '소리 · 음악', '가만히 보기']);
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
    assert.equal((m[1].match(/<span class="gk-nb-o">/g) || []).length, 31, '숫자 0~30 이 다 누를 곳 안');
    assert.doesNotMatch(m[1], /<div\b/);
    assert.equal((p.match(/<summary\b/g) || []).length, 1);
    // 11-12 다시 뽑기: 새 판(줄자 띠 카드 위 · 양옆 빈틈 0 — 글 칸 .gk-in 이 양옆 테를 그려요)에 누를 곳 47px 를 되살려요 — summary 아래로 4px 늘리고(padding) 같은 만큼 겹쳐(margin −4) 글 칸 자리 · 양옆 테는 그대로, position:relative 라 겹친 4px 도 summary 가 받아요
    assert.ok(base.includes('.gk-k4 .gk-ru{display:block;position:relative;padding-bottom:4px;margin-bottom:-4px}') && base.includes('.gk-k4 .gk-in{padding:15px 20px 20px;'), '누를 곳 47px 규칙(새 판 꼴)');
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
    assert.equal(valueOf(t5, '.gk-k5.gk-cv-3ccfbf.gk-tl .gk-nm.gk-nK', 'color'), sf.sianFit('#3ccfbf', '#f3f1ec'));
    if (isikFit) assert.equal(sf.sianFit('#3ccfbf', '#f3f1ec'), isikFit('#3ccfbf', '#f3f1ec'));
    // 주인공: 12 돋보기 · 16 지우개 · 03 바인더 는 분홍 B, 05 · 07 은 M, 나머지는 A(틀 캐릭터 색과 같은 띠의 화자)
    for (const [id, X] of [['simple-k12', 'B'], ['simple-k16', 'B'], ['simple-k3', 'B'], ['simple-k5', 'K'], ['simple-k09', 'A']]) assert.ok(styleOf(sf.toneSimple(sfx[id].preview, '#3ccfbf', { mode: 'light' })).includes(`.gk-d${X}{background-color:rgba(60,207,191,.18)}`), `${id} 주인공 ${X}`);
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
        assert.equal(out.replace(/<!-- ✎ [^>]*-->/g, '').replace(/\n<!-- ▲[^\n]*-->\n/, '').replace(/\ndiv\.gk-\w+ details(?:>summary~:not\(\[class\]\):not\(:has\(\[class\]\)\)\{display:none\}|\{margin:0\})/g, ''), tg.kkangtongReady(sf.hoistStyle(h)));
        if (/<details\b/.test(h)) assert.match(out, /details>summary~:not\(\[class\]\)(?::not\(:has\(\[class\]\)\))?\{display:none/, '11-11 점검 2 — 깡통 빈 줄 숨김(틀에 없으면 마트가 붙여요 · 11-12 밤 class 없는 div 로 감싼 내용은 안 숨겨요)');
        // 예전 길(kkangtongReady 바로)이었다면 <style> 이 둘이 돼요 — 걸림돌 3
        assert.equal((tg.kkangtongReady(h).match(/<style>/g) || []).length, 2);
    }
});

// ── 11-11 옛 글꾸를 마트에서 뺐어요(사용자 「마트에 옛날것들 다 없애라」) — 목록 · 자료 · 화면 · 도구 어디에도 없는지 ──
await test('옛 글꾸 없음 · 목록: index.json 은 심플 새 틀 28 하나(모든 줄 simple · 조각은 sp-simple 하나) · 자료 폴더에는 그 둘뿐(옛 조각 · 아이콘 0)', () => {
    assert.equal(six.count, 28); assert.equal(six.items.length, 28);
    assert.ok(six.items.every(x => x.simple && x.c === 'sp-simple' && x.style === '심플'));
    assert.deepEqual(Object.keys(six.chunks), ['sp-simple']);
    assert.deepEqual(fs.readdirSync(DIR).sort(), ['caps.json', 'index.json', ...Object.values(sixAll.chunks).map(c => c.file)].sort());
    assert.ok(!six.styles, '그림 결 목록 없음');
    // 바탕 커밋의 옛 목록 id 가 하나도 안 남았어요
    const old = JSON.parse(git('show', `${BASE}:mart/data/geulkku/index.json`).toString());
    const ids = new Set(six.items.map(x => x.id));
    assert.equal(old.items.filter(x => ids.has(x.id)).length, 0);
    // 옛 조각 파일 이름을 부르는 곳이 사이트에 없어요
    const site = ['mart/mart.js', 'mart/taste.js', 'mart/taste-render.js', 'mart/cart.js', 'mart/top-mart.js', 'index.html', 'mart/geulkku/index.html'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
    for (const c of Object.values(old.chunks)) assert.ok(!site.includes(c.file), c.file);
    assert.doesNotMatch(site, /simple-index\.json|data\/geulkku\/icon\//);
});

await test('옛 글꾸 없음 · 화면: 「옛날 버전」 단추 · 돌아가기 줄 · 목록 나누기 · 옛 숫자 0 · 「내 로그로 보기」 단추 없음 · 옛 주소는 새 틀 목록 + 한 줄 · HTML 복사 갈래 그대로', () => {
    const mart = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8'), page = fs.readFileSync(path.join(MART, 'geulkku/index.html'), 'utf8'), home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    for (const s of ['옛날 버전 글꾸 보기', '새 틀로 돌아가기', 'wireOld', 'splitView', 'withSimpleFrames', 'keepIds']) assert.ok(!mart.includes(s), s);
    assert.match(mart, /if \(h && !hit && kind === 'geulkku'\) \{ say\('이 글꾸는 새 틀로 바뀌었어요/);
    assert.match(mart, /item\.simple \? withFlip\(simpleReady\(h\)\) : item\.photo \? h : kkangtongReady\(h\)/);
    assert.ok(!/옛날 버전/.test(page) && !/옛날 버전/.test(home), '머리말 · 홈에 옛날 버전 말 없음');
    assert.ok(!page.includes('mart-mylog'), '「내 로그로 보기」 단추 없음');
    assert.ok(!/447|1512|1483/.test(page.replace(/\?v=\d+\w*/g, '')) && !/글꾸 1483종|1512/.test(home), '옛 숫자 없음');
    const top = fs.readFileSync(path.join(MART, 'top-mart.js'), 'utf8');
    assert.match(top, new RegExp(`const COUNTS = \\{ frames: 1854, geulkku: ${sixAll.count} \\};`));   // 11-13 그림 액자 1428 → 1824(다시 그린 판 + D&H 인물 8 + 참고사진 25) · 심플 30
    assert.ok(!top.includes('geulkkuAll'));
    assert.match(home, new RegExp(`<b>글꾸 마트</b><p>새 글꾸 틀 ${sixAll.count}종`));
    assert.match(page, new RegExp(`<div class="mart-head-help" data-label="쓰는 법">\\s*<p>새 글꾸 틀 ${sixAll.count}개예요\\.`));
    // 11-13 그림 액자는 다시 그린 판으로 바뀌었어요 — 옛 액자의 id 는 그대로 있어야 해요(받아 둔 값 · 주소가 안 깨지게). 그림 파일 · 개수는 아래 「그림 액자 1824」 시험이 잠가요
    const framesNow = JSON.parse(fs.readFileSync(path.join(MART, 'data/frames.json'), 'utf8')), framesBase = JSON.parse(git('show', `${BASE}:mart/data/frames.json`).toString());
    const nowIds = new Set(framesNow.items.filter(x => x.kind === 'frame').map(x => x.id));
    for (const x of framesBase.items.filter(x => x.kind === 'frame' || x.kind === 'picture')) if (/^mart-[a-z0-9-]+-(portrait|landscape)$/.test(x.id) && x.concept) assert.ok(nowIds.has(x.id), `옛 액자 ${x.id} 가 그대로 있어요`);
});
// ── 11-13 그림 액자 다시 그린 판 — 콘셉트마다 여섯 그림체 × 세로 · 가로 12장이 다 있어야 실어요(사용자 「디자인 6개 중에 못 만들어진 거 있으면 올리지 말고」) ──
await test('그림 액자 1824: 콘셉트 152 × 12 · 파일 넷이 다 있음 · D&H 인물 8 · 사진창 범위', () => {
    const data = JSON.parse(fs.readFileSync(path.join(MART, 'data/frames.json'), 'utf8'));
    const pics = data.items.filter(x => x.kind === 'frame');
    assert.equal(pics.length, 1824); assert.equal(new Set(pics.map(x => x.id)).size, 1824);
    const by = new Map(); for (const x of pics) by.set(x.concept, [...(by.get(x.concept) || []), x]);
    assert.equal(by.size, 152);
    const STY = ['two-d', 'three-d', 'skeuomorphism', 'clay', 'illustrated', 'glassy'];
    for (const [c, xs] of by) {
        assert.deepEqual(xs.map(x => `${x.style}-${x.orientation}`).sort(), STY.flatMap(s => [`${s}-landscape`, `${s}-portrait`]).sort(), `${c} 12장`);
        assert.equal(new Set(xs.map(x => x.category)).size, 1, `${c} 분류 하나`);
    }
    const used = new Set();
    for (const x of pics) {
        for (const k of ['thumb', 'maskThumb', 'full', 'mask']) { assert.match(x[k], /^data\/frames\/[a-z0-9-]+\.(webp|png)$/, `${x.id} ${k}`); assert.ok(fs.existsSync(path.join(MART, x[k])), `${x.id} ${k} 파일`); used.add(path.basename(x[k])); }
        assert.ok(Array.isArray(x.window) && x.window.length === 4 && x.window.every(n => n >= 0 && n < 50), `${x.id} 사진창`);
        assert.ok(x.ratio > 0.3 && x.ratio < 3 && (x.orientation === 'portrait') === (x.ratio < 1), `${x.id} 비율`);
        assert.ok(!/[<>]/.test(x.name + x.desc), `${x.id} 글`);
    }
    assert.deepEqual(fs.readdirSync(path.join(MART, 'data/frames')).sort(), [...used].sort(), '안 쓰는 그림 파일 없음');
    // 홈 카드 · 마트 메뉴 그림처럼 파일 이름(내용 해시)을 직접 부르는 곳 — 그림을 다시 만들면 이름이 바뀌니 같이 고쳐야 해요(11-13 홈 · 메뉴 그림 404)
    const direct = [];
    for (const f of ['index.html', 'mart/home.css', 'mart/top-mart.css', 'mart/mart.css', 'mart/frame-room.css', 'mart/top-mart.js', 'mart/mart.js', 'mart/frame-room.js', 'mart/frames/index.html'])
        for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/data\/frames\/([a-z0-9-]+\.(?:webp|png))/g)) direct.push([f, m[1]]);
    assert.ok(direct.length >= 2, '직접 부르는 곳을 찾았어요');
    // 머리줄 「마트」 창의 액자 마트 썸네일은 따로 구운 그림 한 장(cover-frames.webp · 368×256 · 바탕 #ECF3FB — 실린 액자 두 점에 표본 사진을 넣은 진짜 합성).
    //   규격은 메뉴 썸네일을 고치는 갈래와 같아요(그 갈래가 얹히면 CSS 줄은 그쪽 것을 살리고 그림 파일은 이것을 써요)
    assert.ok(fs.existsSync(path.join(MART, 'cover-frames.webp')) && /\.mart-menu-cover\.is-frames\{[^}]*cover-frames\.webp/.test(fs.readFileSync(path.join(MART, 'top-mart.css'), 'utf8')), '액자 마트 메뉴 썸네일');
    assert.ok(fs.existsSync(path.join(MART, 'menu-geulkku.webp')) && /\.mart-menu-cover\.is-geulkku\{[^}]*menu-geulkku\.webp/.test(fs.readFileSync(path.join(MART, 'top-mart.css'), 'utf8')), '글꾸 마트 메뉴 썸네일(진짜 틀 세 점 · 368×256)');
    for (const [f, name] of direct) assert.ok(used.has(name), `${f} 가 부르는 ${name} 이 있어요`);
    // 옛 액자는 다시 그려도 파일 이름이 그대로예요(옛 주소가 새 그림을 보여 줘요) — 공개판(11-05 ~ 11-13)의 이름 여섯을 표본으로 잠가요 · 마트 안에서는 asset() 이 ?v= 꼬리로 캐시만 갈아요
    for (const [id, k, name] of [['mart-watercolor-two-d-portrait', 'full', 'watercolor-two-d-portrait-d9f0b57e.webp'], ['mart-watercolor-two-d-portrait', 'mask', 'watercolor-two-d-portrait-m-f89766ac.png'],
        ['mart-watercolor-two-d-portrait', 'thumb', 'watercolor-two-d-portrait-t-f478d54f.webp'], ['mart-watercolor-two-d-portrait', 'maskThumb', 'watercolor-two-d-portrait-tm-b768a52f.png'],
        ['mart-picnic-clay-portrait', 'thumb', 'picnic-clay-portrait-t-10fc6aa8.webp'], ['mart-adrian-clay-landscape', 'full', 'adrian-clay-landscape-0f96bb96.webp']])
        assert.equal(pics.find(x => x.id === id)[k], `data/frames/${name}`, `${id} ${k} 파일 이름 그대로`);
    assert.ok(fs.readFileSync(path.join(MART, 'mart.js'), 'utf8').includes("const asset = p => new URL(p, import.meta.url).href + (/^data\\/frames\\//.test(p) ? `?v=${FRAMES_V}` : '');"), '액자 그림 주소에 캐시 꼬리');
    const hunter = [...by].filter(([, xs]) => xs[0].category === 'hunter-char');
    assert.equal(hunter.length, 8); for (const [c, xs] of hunter) { assert.match(c, /^hunter-[a-z]+$/); assert.match(xs[0].conceptLabel, / · D&H$/); }
    assert.equal(data.categories.findIndex(c => c.id === 'hunter-char'), data.categories.findIndex(c => c.id === 'halo-char') + 1, 'D&H 인물 칩은 천지합동청 인물 바로 뒤');
    const room = fs.readFileSync(path.join(MART, 'frame-room.js'), 'utf8');
    assert.ok(room.includes("/^(halo|hunter|gangho)-char$/.test(item.category)") && fs.readFileSync(path.join(MART, 'mart.js'), 'utf8').includes("'hunter': WORKS.hunter, 'hunter-char': WORKS.hunter,"), 'D&H 인물 액자에 원작 줄');
});
// ── 11-12 액자 마트 심플 액자 30 — 테마(1.1.4 · 판 8)가 넣은 10종(gallery … calendar)까지 · frame-presets.js 는 테마 사본 그대로 · 항목은 테마 mart-build.mjs simpleFrames() 꼴 ──
await test('심플 액자 30 ① 자료 frames.json = 테마 FRAME_PRESETS 30 · 기본 색 · 칩 글자 · 설명 · 그림 액자 1824', async () => {
    const fp = await imp(path.join(MART, 'frame-presets.js'));
    const data = JSON.parse(fs.readFileSync(path.join(MART, 'data/frames.json'), 'utf8'));
    const simple = data.items.filter(x => x.kind === 'frame-preset');
    assert.equal(data.items.length, 1854); assert.equal(data.items.length - simple.length, 1824);
    assert.equal(fp.FRAME_PRESET_VERSION, 8);
    assert.deepEqual(simple.map(x => x.presetId), fp.FRAME_PRESETS.map(([id]) => id));
    for (const id of ['gallery', 'corners', 'peg', 'phone', 'petal', 'comic', 'airmail', 'tarot', 'vinyl', 'calendar']) assert.ok(simple.some(x => x.presetId === id), id);
    for (const [i, [id, name, group]] of fp.FRAME_PRESETS.entries()) {
        const x = simple[i], [color, accent] = fp.presetColors(id);
        assert.equal(group, 'simple');
        const want = { kind: 'frame-preset', id: `simple-${id}`, name, desc: x.desc, category: 'simple', categoryLabel: '심플', presetId: id, presetColor: color, presetAccent: accent, frameWidth: 100, frameHeight: 100, ...(Object.hasOwn(fp.PRESET_LABELS, id) ? { presetLabel: fp.PRESET_LABELS[id] } : {}) };
        assert.deepEqual(x, want, id);
        assert.ok(x.desc && !/[<>]/.test(x.desc), `${id} 설명`);
    }
    assert.ok(data.categories.some(c => c.id === 'simple'));
    // 테마 사본이 이 PC 에 있으면 파일 글자까지(mart-build.mjs 가 하는 것처럼 src/frame-presets.js 를 그대로 옮겨요)
    const themeDir = process.env.GK_THEME_DIR || path.resolve(ROOT, '../builtin-out-review');
    if (fs.existsSync(path.join(themeDir, 'src/frame-presets.js'))) assert.equal(fs.readFileSync(path.join(MART, 'frame-presets.js'), 'utf8'), fs.readFileSync(path.join(themeDir, 'src/frame-presets.js'), 'utf8'));
    // 액자 마트 머리 · 홈 숫자
    assert.match(fs.readFileSync(path.join(MART, 'frames/index.html'), 'utf8'), /심플 액자 30종은 테마에 이미/);
    assert.match(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /그림 액자 1824종과, 테마에 이미 들어 있는 심플 액자 30종/);
    for (const f of ['mart/geulkku', 'mart/frames', 'mart/kara', '.']) assert.match(fs.readFileSync(path.join(ROOT, f, 'index.html'), 'utf8'), /top-mart\.js\?v=20261114a/, f);   // 11-13 밤 지니를 없애며 메뉴 두 줄 · 썸네일 규격 통일 → u
});
await test('심플 액자 30 ② 가짜 캔버스로 30종 전부 기본값 · 색 · 50 % · 200 % 그려지고 사진 창을 채워요 · 모르는 id 는 던져요(테마 frame-presets-simple.mjs ② 와 같은 셈)', async () => {
    const calls = [];
    const fake = tag => new Proxy({}, { get: (_, key) => {
        if (key === 'canvas') return { width: 1, height: 1 };
        if (key === 'measureText') return s => ({ width: String(s).length * 7 });
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (key === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
        return (...args) => { calls.push([tag, key, args]); };
    }, set: () => true });
    const had = Object.hasOwn(globalThis, 'document'), keep = globalThis.document;
    let made = 0;
    globalThis.document = { createElement(tag) { assert.equal(tag, 'canvas'); const id = made++ % 2 === 0 ? 'art' : 'mask'; return { width: 0, height: 0, getContext: () => fake(id), toDataURL: () => `data:image/png;base64,${id === 'art' ? 'QUFB' : 'QkJC'}` }; } };
    try {
        const { FRAME_PRESETS, FRAME_PRESET_VERSION, drawPreset } = await imp(path.join(MART, 'frame-presets.js'));
        for (const [id] of FRAME_PRESETS) for (const options of [{}, { presetColor: '#111111', presetAccent: '#eeeeee', frameWidth: 50, frameHeight: 200 }, { frameWidth: 200, frameHeight: 50 }]) {
            calls.length = 0;
            const r = drawPreset(id, options);
            assert.equal(r.presetId, id); assert.equal(r.presetVersion, FRAME_PRESET_VERSION);
            assert.ok(calls.some(([t, k]) => t === 'mask' && k === 'fill'), `${id}: 사진 창`);
            assert.ok(calls.some(([t, k]) => t === 'art' && /^(fill|stroke|fillRect|strokeRect|fillText)$/.test(k)), `${id}: 그림`);
            assert.ok(calls.some(([t, k]) => t === 'art' && k === 'drawImage'), `${id}: 창 뚫기`);
            assert.equal(r.frameWidth, options.frameWidth ?? 100); assert.equal(r.frameHeight, options.frameHeight ?? 100);
        }
        assert.throws(() => drawPreset('nope'), /알 수 없는 액자예요/);
    } finally { if (had) globalThis.document = keep; else delete globalThis.document; }
});

// 11-13 글꾸 지니를 사이트에서 없앴어요(사용자 「지니는 걍 없애라」) — 지니로 가는 링크 · 단추 · 글 0 · 지니 전용 파일 없음 · 옛 주소는 마트 첫 화면으로 넘겨요
await test('지니 없음: 홈 · 마트 · 노래방 화면과 마트 메뉴에 지니로 가는 링크 · 단추 · 글이 없어요 · genie.js · genie.css 없음 · 옛 주소(mart/genie/)는 글꾸 마트로 넘기는 쪽 하나', () => {
    for (const f of ['index.html', 'mart/geulkku/index.html', 'mart/frames/index.html', 'mart/kara/index.html', 'mart/top-mart.js', 'mart/top-mart.css', 'mart/home.css']) {
        const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        assert.ok(!/genie|지니|🧞/.test(t), `${f} 에 지니가 남았어요`);
    }
    for (const f of ['genie.js', 'genie.css']) assert.ok(!fs.existsSync(path.join(MART, f)), `${f} 가 남았어요`);
    const moved = fs.readFileSync(path.join(MART, 'genie/index.html'), 'utf8');
    assert.match(moved, /<meta http-equiv="refresh" content="0;\s*url=\.\.\/geulkku\/">/); assert.match(moved, /location\.replace\(/); assert.match(moved, /<a href="\.\.\/geulkku\/">/);
    assert.ok(!/<script[^>]+src=|<link[^>]+stylesheet/.test(moved) && moved.length < 1500, '넘김 쪽은 다른 파일을 부르지 않는 짧은 쪽');
    assert.deepEqual(fs.readdirSync(path.join(MART, 'genie')), ['index.html']);
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
    for (const w of ['글꾸 · 목록', '글꾸 · 상세', '글꾸 · 캐릭터 펼침', '장바구니 · 담김']) assert.ok(where.includes(w), w);
    assert.ok(!where.some(w => /지니/.test(w)), '지니 화면 없음');
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
        for (const row of six.items) { const it = { ...row, ...sfx[row.id], kind: 'geulkku' }; assert.equal(neu.toneOut(it, it.preview), sf.toneSimple(it.preview, k, { mode, own: neu.ownOf() })); }   // 11-12 새 틀 28 도 기본 색 판(gk-own) — 캐릭터를 고르면 「소품도 캐릭터 색」(기본 켬)으로 own 을 떼요
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

await test('캐릭터 줄: 맨 아래 한 줄은 「원래 색」이 먼저 · 그다음 「캐릭터 없음」 · 「바탕(종이 색 · 질감)」 칸은 숨김(PAPER_ENABLED = false · 코드는 그대로) · site-rig 바탕 펼침 화면은 쉼', () => {
    const cast = fs.readFileSync(path.join(MART, 'cast.js'), 'utf8');
    assert.match(cast, /const PAPER_ENABLED = false;/);
    assert.ok(cast.indexOf('data-pick="off"') > 0 && cast.indexOf('data-pick="off"') < cast.indexOf('data-pick="none"'));
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
    assert.equal(m.toneOut(it, it.preview), sf.toneSimple(it.preview, sf.ORIGINAL, { mode: 'light', other: '#7fe03c', own: m.ownOf() }));
    assert.deepEqual([saved().k2, saved().name2], ['#7fe03c', '우리엘']);
    const again = await import(`${href}?k2=b`);
    assert.deepEqual([again.toneState.k2, again.toneState.name2, again.toneState.on], ['#7fe03c', '우리엘', false]);
    m.setTone({ on: true, k: '#d19cff', name: '백시우' });
    assert.equal(m.toneOut(it, it.preview), sf.toneSimple(it.preview, '#d19cff', { mode: 'light', other: '#7fe03c', own: m.ownOf() }));
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
    assert.ok(cast.includes('aria-expanded="${who === id}"') && cast.includes("if (w === 'other') setTone(color === 'off' ? { k2: null } : { k2: color, name2: name });"));
    assert.ok(cast.includes('setTone(other ? { k2: saved.color, name2: saved.name } : { on: true, k: saved.color, name: saved.name })'));
    assert.equal(cast.split('<input type="color"').length - 1, 1, '색 칸은 colorField 한 곳');
    assert.ok(cast.includes('<label class="mart-cast-color"') && cast.includes('class="mart-ink-dot mart-cast-swatch"') && cast.includes('class="mart-cast-hex"'));
    assert.ok(css.includes('.mart-cast-color input[type=color]{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:0;opacity:0;'));
    assert.ok(css.includes('.mart-cast-color:focus-within{outline:2px solid var(--blue);outline-offset:2px}'));
    assert.ok(!css.includes('.mart-cast-form input[type=color]{width:40px'));
    assert.ok(cast.includes('class="mart-cast-toggle chev" data-toggle="${id}"') && !cast.includes("mart-cast-caret"), "꺾쇠는 기준 모양(.chev) — 글자 세모 칸 0");
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
        const strip = h => { const e = tu.editables(h); let s = h; for (const x of [...e].sort((a, b) => b.start - a.start)) s = s.slice(0, x.start) + s.slice(x.end); return s.split('\n').filter(l => !l.startsWith(K)).join('\n'); };
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
    const p0 = sfx['simple-k3'].preview.replace(/^(<div class="gk [^"]*?) gk-own"/, '$1"'), c300 = ct.toneLadder('#ff5fa2').c300;
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
    assert.deepEqual(lk.LOOK_TABS.map(x => x[1]), ['색', '본문', '대사', '속마음', '취소선', '강조', '문단', '이름', '제목', '그림자', '외곽선']);
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

await test('내 글 넣기: 이름만 있는 줄 + 다음 줄 따옴표 대사(11-12 밤 사용자 글 그대로) — 첫 화자 나깡 · 둘째 벨포드 · 지문 1줄 · 대사 2줄 · 긴 줄 · 마침표 줄은 이름이 아님 · 「이름:」 꼴은 그대로', () => {
    const m = mt.mineModel('글꾸 예시로 소주 좀 한다\n나깡\n"벨포드 내 남편"\n\n벨포드\n"ㅇㅈ"');
    assert.deepEqual(m.names, ['나깡', '벨포드']); assert.equal(m.generic, false);
    assert.deepEqual(m.lines.map(l => l.type), ['nr', 'dl', 'dl']);
    assert.equal(m.lines[0].html, '글꾸 예시로 소주 좀 한다');
    assert.deepEqual(m.lines.slice(1).map(l => [l.who, l.text.replace(/["“”]/g, '')]), [[0, '벨포드 내 남편'], [1, 'ㅇㅈ']]);
    const row = six.items.find(r => r.id === 'simple-k2') || six.items[0], out = mt.fillMine(sfx[row.id].preview, m), body = out.slice(out.indexOf('</style>'));
    assert.match(body, />나깡<\/p>/); assert.match(body, />벨포드<\/p>/); assert.doesNotMatch(body, />깡통<\/p>|>깡캐<\/p>/);
    assert.equal((body.match(/<p class="gk-nr">/g) || []).length, 1);
    const g = mt.mineModel('비가 그쳤다.\n"……정말 올 줄은 몰랐어."\n\n그는 한참 동안 말없이 서 있다가 겨우 입을 열었다\n"들어가자."');
    assert.equal(g.generic, true, '마침표로 끝나는 줄 · 긴 줄은 이름이 아니에요');
    assert.deepEqual(mt.mineModel(MINE_LOGS.짧은).names, ['하린', '도윤']);
    // 이름 없는 첫 줄 + 빈 줄 + 「이름: "대사"」(사용자 글 그대로) — 첫 줄은 지문 · 대사 2줄
    const h = mt.mineModel('글꾸 예시로 소주 좀 한다\n\n나깡: "벨포드 내 남편"\n벨포드: "ㅇㅈ"');
    assert.deepEqual(h.names, ['나깡', '벨포드']);
    assert.deepEqual(h.lines.map(x => x.type), ['nr', 'dl', 'dl']); assert.equal(h.lines[0].html, '글꾸 예시로 소주 좀 한다');
    assert.deepEqual(h.lines.slice(1).map(x => x.who), [0, 1]);
    const hb = mt.fillMine(sfx[row.id].preview, h); assert.ok(hb.indexOf('<p class="gk-nr">글꾸 예시로 소주 좀 한다</p>') > 0 && hb.indexOf('<p class="gk-nr">글꾸 예시로 소주 좀 한다</p>') < hb.indexOf('>나깡</p>'), '지문이 이름표 위');
    // 그대로여야 하는 꼴: 「이름: 따옴표 없는 짧은 말」은 그 화자 대사 · 실리태번 화면 복사(이름 줄 · 시간 줄 · 본문)
    assert.deepEqual(mt.mineModel('하린: 안녕\n도윤: 왔어?').lines.map(x => [x.type, x.who]), [['dl', 0], ['dl', 1]]);
    const st = mt.mineModel('하린\n오후 9:00\n"왔어?"\n도윤\n오후 9:01\n문이 닫혔다. "응."\n하린\n오후 9:02\n"앉아."');
    assert.deepEqual(st.names, ['하린', '도윤']); assert.deepEqual(st.lines.map(x => x.type), ['dl', 'nr', 'dl', 'dl']);
    const l = mt.mineModel(' 「낫표」도 돼요 처음 글\n레몬\n「안녕」\n에이드\n『속으로』 "응"');
    assert.deepEqual(l.names, ['레몬', '에이드']);
});

// ── 11-12 밤 분류 · 세계관 · 카드 원작 되살리기 — 사용자 「글꾸 카테고리에 뭐 일상 이벤트 예전에 있던 카테고리 가져오고 지금은 인물 출처도 빠지고 그 세계관 인물들 한꺼번에 보는 것도 없잖아」: 다시 빠지지 않게 잠가요 ──
await test('분류: 모든 틀이 주제 분류를 하나 갖고(묶음 다섯 · 하위 칩) 자료는 생성기에서 나와요 · 누름 방식(category)은 그대로', async () => {
    const groups = sixAll.topics;
    assert.deepEqual(groups.map(g => [g.id, g.label]), [['daily', '일상'], ['event', '이벤트'], ['screen', '화면 · 장르'], ['world', '세계관 · 인물'], ['basic', '기본 · 심플']]);
    const chipGroup = new Map();
    for (const g of groups) for (const c of g.chips) { assert.ok(!chipGroup.has(c), `칩 「${c}」가 두 묶음에`); chipGroup.set(c, g.id); }
    const n = {};
    for (const x of sixAll.items) { assert.ok(typeof x.topic === 'string' && chipGroup.has(x.topic), `${x.id} 분류 없음`); n[chipGroup.get(x.topic)] = (n[chipGroup.get(x.topic)] || 0) + 1; assert.match(x.category, /^simple-(open|tap|sound|still)$/, `${x.id} 누름 방식`); }
    assert.deepEqual(n, { basic: 36, daily: 122, event: 68, screen: 87, world: 107 }, '묶음 수(일상 122 · 이벤트 68 · 화면 · 장르 87 · 세계관 · 인물 107 · 기본 · 심플 36)');
    assert.equal(Object.values(n).reduce((a, b) => a + b, 0), sixAll.items.length);
    for (const g of groups) for (const c of g.chips) assert.ok(sixAll.items.some(x => x.topic === c), `빈 칩 「${c}」`);
    // 생성기가 쓴 값 = 분류 자료(tools/simple-frames/topics.json) · 자료에 없는 틀이면 생성기가 멈춰요
    for (const d of [...gen.DEFS, ...gen.PASS_DEFS]) assert.equal(sixAll.items.find(x => x.id === d.id).topic, gen.TOPICS.frames[d.frame].topic, d.id);
    assert.throws(() => gen.topicOf({ id: 'simple-zz', frame: 'zz' }), /분류가 없어요/);
    assert.doesNotMatch(fs.readFileSync(path.join(MART, 'mart.js'), 'utf8'), /simple-k1\d{3}/, 'mart.js 에 틀 id 를 박아 분류하지 않아요');
});
await test('세계관: 세계관 · 인물 틀 107개가 세계관 다섯에 다 들고(33 · 17 · 12 · 13 · 32) 인물은 캐릭터 묶음의 그 사람이에요', async () => {
    const so = await imp(path.join(MART, 'sources.js')), ts = await import(pathToFileURL(path.join(MART, 'tone-state.js')).href + '?world-test');
    const ws = sixAll.items.filter(x => sixAll.topics.find(g => g.id === 'world').chips.includes(x.topic));
    assert.equal(ws.length, 107);
    const n = {};
    for (const x of ws) {
        const w = so.worldOf(x.world); assert.ok(w, `${x.id} 세계관 없음`); assert.equal(w.label, x.topic, x.id); n[w.id] = (n[w.id] || 0) + 1;
        if (x.who) assert.ok(ts.CAST_GROUPS.find(g => g.id === w.group).cast.some(c => c.name === x.who), `${x.id} 인물 「${x.who}」가 ${w.label} 묶음에 없어요`);
    }
    assert.deepEqual(n, { halo: 33, hunter: 17, adrian: 12, gangho: 13, sentinel: 32 });
    for (const x of sixAll.items) if (!ws.includes(x)) assert.ok(!x.world && !x.who && !x.src, `${x.id} 는 세계관 틀이 아닌데 world · who · src 가 있어요`);
    assert.deepEqual(so.WORLDS.map(w => w.id), ['halo', 'hunter', 'adrian', 'gangho', 'sentinel']);
    for (const g of ts.CAST_GROUPS) assert.ok(so.WORLDS.some(w => w.group === g.id), `캐릭터 묶음 ${g.label} 에 세계관이 없어요`);
    assert.equal(ws.filter(x => x.world === 'sentinel' && x.who).map(x => x.who).filter((v, i, a) => a.indexOf(v) === i).length, 11, '센티넬버스 인물 11');
    assert.equal(ws.filter(x => x.who === '은설').length, 2);
    for (const x of sixAll.items) assert.doesNotMatch(x.name, /세라프/, `${x.id} 공개 표기는 라파엘`);
});
await test('카드 원작: 세계관 · 인물 틀 107장이 모두 원작 줄을 갖고(주소 있는 글) 열 글이 모두 어느 카드에든 걸려요 · 「HTML 복사로 써요」는 0개', async () => {
    const so = await imp(path.join(MART, 'sources.js'));
    const urls = new Set();
    for (const x of sixAll.items.filter(i => i.world)) {
        const src = so.itemSources(x); assert.ok(src.length && src.length === x.src.length && src.every(s => /^https:\/\/kkangtong\.xyz\/posts\/\d+$/.test(s.url) && s.title), `${x.id} 원작 없음`);
        const w = so.worldOf(x.world); assert.ok(w.works.every(k => x.src.includes(k)) || x.world === 'sentinel', `${x.id} 그 세계관 원작 글이 빠졌어요`);
        if (x.world === 'sentinel') assert.ok(x.src.length === 1 && w.works.includes(x.src[0]), `${x.id} 센티넬버스는 봇 둘 중 하나`);
        for (const c of w.chars) if (so.CHAR_WORKS[c].name === x.who) assert.ok(x.src.includes(c), `${x.id} 캐릭터 글`);
        for (const s of src) urls.add(s.url);
    }
    assert.deepEqual([...urls].sort(), so.ALL_SOURCES.map(s => s.url).sort(), '열 글이 모두 카드에 걸려요');
    assert.equal(so.ALL_SOURCES.length, 10, '원작 주소 열 개');
    for (const w of so.WORLDS) assert.ok(so.worldSources(w.id).length >= 1 && so.worldSources(w.id).every(s => s.url), `${w.label} 머리 띠 원작`);
    assert.deepEqual(so.itemSources(sixAll.items.find(x => x.id === 'simple-k1042')).map(s => s.url.split('/').pop()), ['5150', '81234', '43794'], 'D&H 쪽 아드리안 틀은 세 글 다');
    assert.deepEqual(so.itemSources(sixAll.items.find(x => x.id === 'simple-k1049')).map(s => s.url.split('/').pop()), ['29037']);
    const martSrc = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8');
    assert.ok(martSrc.includes("if (Array.isArray(item.src)) return itemSources(item).map(x => sourceHtml(x)).join('');"), '카드 · 크게 보기가 같은 줄(sourceLinks)');
    for (const [f, t] of [['mart.js', martSrc]]) assert.ok(!t.includes('>HTML 복사로 써요<'), `${f} 에 「HTML 복사로 써요」 글이 남았어요`);
    assert.ok(so.creditsHtml([]).includes('세계관 · 인물'), '「원작」 칸 설명에 세계관 틀');
});

await test('분류 화면 · 캐릭터 칸 · 머리말(11-12 밤 시안 안 A): 주제 탭 + 하위 칩 + 세계관 머리 띠 + 보조 거르기 줄 · 캐릭터 칸은 한 번에 한 묶음 · 「쓰는 법」은 맨 위 단추 안 · 맨 아래 칸 없음', async () => {
    const martSrc = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8'), castSrc = fs.readFileSync(path.join(MART, 'cast.js'), 'utf8'), css = fs.readFileSync(path.join(MART, 'mart.css'), 'utf8');
    const page = fs.readFileSync(path.join(MART, 'geulkku/index.html'), 'utf8'), frames = fs.readFileSync(path.join(MART, 'frames/index.html'), 'utf8');
    for (const k of ['<div class="mart-groups" role="group" aria-label="분류 묶음"></div>', '<div class="mart-topics" role="group" aria-label="분류" hidden></div>', '<div class="mart-chips" role="group"', '<section class="mart-band" id="mart-band" aria-label="세계관 한꺼번에 보기" hidden></section>']) assert.ok(page.includes(k), k);
    assert.ok(page.indexOf('class="mart-groups"') < page.indexOf('class="mart-topics"') && page.indexOf('class="mart-topics"') < page.indexOf('class="mart-chips"') && page.indexOf('class="mart-band"') < page.indexOf('class="mart-grid"'), '탭 → 하위 칩 → 보조 거르기 → 머리 띠 → 목록');
    assert.ok(martSrc.includes("if (p.get('g')) picker?.open?.(p.get('g'), p.get('t') || 'all');") && fs.readFileSync(path.join(MART, 'frame-room.js'), 'utf8').includes("new URLSearchParams(location.search).get('cat')"), '주소로 분류 열기(?g= · ?t= · 액자 ?cat=)');
    for (const k of ['function topicPicker(', 'picker.match(item.category, !!item.builtin, item)', 'worldSources(w.id).map(s => sourceHtml(s))', "openWorld: id => picker?.openWorld?.(id)", 'sel.who = sel.who === id ? null : id', "sel.cat = sel.cat === id ? 'all' : id"]) assert.ok(martSrc.includes(k), `mart.js ${k}`);
    // 캐릭터 칸: 탭 하나 · 색 점 칩 · 원작 N · 세계관 틀 보기 · 직접 탭 · 맨 아래 한 줄 · 라디오 목록 0
    for (const k of ['data-tab="${id}"', 'class="chip mart-cast-p" data-color=', 'data-src-toggle', 'class="mart-cast-src"', 'data-world="${esc(x.id)}"', "틀 ${x.n} 보기 →", 'id="mart-cast-direct"', 'class="mart-cast-foot"', '<label class="check mart-cast-cover"', '기억하고 고르기', 'class="mart-cast-paste"', 'data-swap', "dayNightHtml('data-mode', toneState.mode)", 'data-mine="apply"']) assert.ok(castSrc.includes(k), `cast.js ${k}`);
    assert.ok(!/name="bl-cast2?"|mart-cast-g"|type="\$\{toneState\.mix/.test(castSrc), '라디오 목록 · 꺽쇠 묶음은 없어요');
    assert.ok(castSrc.includes('${pane(tab[w])}'), '펼친 칸에는 묶음 하나만');
    // 머리말: 접힌 동안 제목 + 단추만 · 쓰는 법은 그 안(번호 넷) · 맨 아래 칸 0 · 액자 마트도
    for (const [f, t, label] of [['geulkku', page, '쓰는 법'], ['frames', frames, '받는 법']]) {
        assert.ok(t.includes(`<div class="mart-head-help" data-label="${label}">`) && !t.includes('class="mart-howto"') && !t.includes('class="mart-lede"'), f);
        assert.ok((t.match(/<div class="mart-head-help"[\s\S]*?<\/div>/)[0].match(/<li>/g) || []).length >= 4, `${f} 번호 줄`);
    }
    for (const w of ['내 글로 보기', '깡통 · 깡캐', '해 · 달', '글 고치기', 'HTML 복사', '테마로 담기', '테마용 복사']) assert.ok(page.match(/<div class="mart-head-help"[\s\S]*?<\/div>/)[0].includes(w), `쓰는 법에 실제 단추 이름 「${w}」`);
    assert.ok(css.includes('.mart-head-help{flex:0 0 100%;display:none;') && css.includes('.mart-head.is-open .mart-head-help{display:block}') && !css.includes('-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}\n.mart-head .mart-note-line'));
    assert.ok(martSrc.includes("textContent: help.dataset.label || '쓰는 법'"));
    // 밝기 단추(11-12 밤 「밤 낮 위치 바꿔주고 낮 기본으로」 · 「밤 낮이라고 하지 말고 … 아이콘 넣어」): 해 먼저 · 달 다음 · 글자 없이 아이콘(aria-label · title 에 낮 · 밤) · 기본은 낮
    { const ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8'), ts = fs.readFileSync(path.join(MART, 'tone-state.js'), 'utf8');
      const dn = (0, eval)(castSrc.match(/export const dayNightHtml = (\(attr, mode\) => `[^\n]+`);\n/)[1]);
      const html = dn('data-mode', 'light');
      assert.ok(html.indexOf('data-mode="light"') < html.indexOf('data-mode="dark"'), '해(낮) 먼저');
      assert.match(html, /data-mode="light" aria-pressed="true" aria-label="낮" title="낮"><i aria-hidden="true"><\/i><\/button>/);
      assert.match(html, /data-mode="dark" aria-pressed="false" aria-label="밤" title="밤"><i aria-hidden="true"><\/i><\/button>/);
      assert.ok(!/>밤<|>낮</.test(html) && !/>밤<\/button>|>낮<\/button>/.test(castSrc + ui), '글자 「밤」 「낮」 단추 0');
      assert.equal((ui.match(/dayNightHtml\('data-tune-mode', ''\)/g) || []).length, 2, '크게 보기 간편 · 세밀 색 갈래');
      assert.ok(ts.includes("mode = saved.mode === 'dark' ? 'dark' : 'light';"), '저장된 값이 없으면 낮');
      // 11-13 고른 칸 색: 해 · 달 둘 다 옅은 파랑 칸 + 파랑 아이콘(사용자 「해 파랑 달 파랑인 게 낫지 않아? 테마색 따라가게 둬」) · 두 칸 같은 꼴(안쪽 1px 선) · 호박색 해 · 흰 칸 · 꽉 찬 레몬 · 파랑 면 0
      for (const k of ['.mart-dn-b{box-shadow:inset 0 0 0 1px transparent}', '.mart-dn-b[aria-pressed=true]{background:var(--pick-face);box-shadow:inset 0 0 0 1px var(--pick-face)}', '.mart-dn-b[aria-pressed=true]>i{background:var(--blue-strong)}']) assert.ok(css.includes(k), k);
      assert.ok(!/--sun|#E8A100|\.mart-dn-b\.is-(?:day|night)\[aria-pressed=true\]/i.test(css), '해만 따로 칠하는 규칙(호박색 · 흰 칸)이 남았어요');
      assert.ok(!/\.mart-dn-b(?:\.is-\w+)?(?:\[aria-pressed=true\])?\{[^}]*(?:--lemon|background:var\(--blue-strong\))/.test(css), '밝기 단추에 꽉 찬 레몬 · 파랑 면이 남았어요'); }
    // 간편 「움직임」 줄의 「소품만」 — 글 움직임 끔 · 소품 움직임은 지금 세기(끔이었으면 중) · 세밀과 같은 값
    { const ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
      assert.ok(ui.includes('data-simple-motion="prop" aria-pressed="${propOnly}"') && ui.includes("setMotion(v === 'prop' ? { text: '0', prop: cur.prop === '0' ? 'm' : cur.prop } : { text: v, prop: v })") && ui.includes("const propOnly = m.text === '0' && m.prop !== '0', canPropOnly = !!caps.text['0'];")); }
    // 장바구니 줄에도 원작 줄(액자 방과 같은 줄 · 담을 때 같이 기억)
    assert.ok(fs.readFileSync(path.join(MART, 'frame-room.js'), 'utf8').includes('export const frameLinks = item => links(item);'));
    assert.ok(martSrc.includes("...((src => (src.length ? { src } : {}))(sourcesOf(item)))") && fs.readFileSync(path.join(MART, 'cart.js'), 'utf8').includes('${srcHtml(e)}'));
});
await test('소리 줄 정리(11-12 밤 「mp3 에 효과 들어간 특이한 글꾸들 아니면 … mp3 가 들어가야 할 이유도 없고」): 소리가 연출인 틀 · 애매한 틀만 소리 줄이 남고 나머지 91틀은 줄 · 규칙 · 설명 글까지 0 · 「소리 카드」 칩 이름 0', async () => {
    const T = gen.TOPICS.frames, keep = Object.entries(T).filter(([, v]) => v.sound === 'keep').map(([k]) => `simple-${k}`), ask = Object.entries(T).filter(([, v]) => v.sound === 'ask').map(([k]) => `simple-${k}`);
    assert.equal(keep.length, 25); assert.equal(ask.length, 0, '애매 12틀은 11-12 밤 사용자 결정으로 여섯 둠 · 여섯 뺌');
    assert.deepEqual(sixAll.items.filter(x => x.audio).map(x => x.id).sort(), [...keep, ...ask].sort(), '소리 줄이 남은 틀 = keep + ask');
    const all = {}; for (const c of Object.values(sixAll.chunks)) Object.assign(all, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
    let dropped = 0;
    for (const d of [...gen.DEFS, ...gen.PASS_DEFS]) {
        const raw = fs.readFileSync(gen.fileOf(d), 'utf8'), p = all[d.id].preview;
        if (!/<audio\b/.test(raw)) continue;
        if (gen.keepsSound(d)) { assert.match(p, /<div class="gk-sd">[\s\S]*?<audio\b/, `${d.id} 소리 줄 그대로`); continue; }
        dropped++;
        assert.doesNotMatch(p, /audio|gk-sd(?![\w-])|gk-sn(?![\w-])|gk-s[A-Z](?![\w-])/, `${d.id} 소리 줄 · 규칙이 남았어요`);
        assert.equal(p.split('\n\n').length, gen.frameHtml({ ...d, sample: true }).preview.split('\n\n').length, `${d.id} <style> 덩이 나눔 그대로`);
        assert.doesNotMatch(sixAll.items.find(x => x.id === d.id).desc, /소리/, `${d.id} 설명 글`);
        assert.notEqual(sixAll.items.find(x => x.id === d.id).category, 'simple-sound', d.id);
    }
    assert.equal(dropped, 91);
    assert.ok(!sixAll.categories.some(c => /소리 카드/.test(c.label)) && sixAll.categories.find(c => c.id === 'simple-sound').label === '소리 · 음악');
    for (const f of ['mart.js', 'cast.js', 'geulkku/index.html']) assert.ok(!fs.readFileSync(path.join(MART, f), 'utf8').replace(/\/\/.*$/gm, '').includes('소리 카드'), `${f} 화면 글에 「소리 카드」`);
    // 다른 규칙은 그대로: 소리 줄을 뺀 틀의 규칙 수 = 원래 − 소리 규칙
    const html = '<div class="gk gk-k1"><style>\n.gk-k1 p{margin:0}\n.gk-k1 .gk-sd{display:flex}\n.gk-k1 .gk-nm.gk-nA,.gk-k1 .gk-sn.gk-sA{color:red}\n.gk-k1 audio{display:block}\n\n.gk-k1.gk-tl .gk-sc{color:blue}\n</style><p>가</p>\n<div class="gk-sd"><span class="gk-sn gk-sA">이름</span><audio controls></audio></div>\n<p>나</p></div>';
    assert.equal(gen.dropSound(html), '<div class="gk gk-k1"><style>\n.gk-k1 p{margin:0}\n.gk-k1 .gk-nm.gk-nA{color:red}\n\n.gk-k1.gk-tl .gk-sc{color:blue}\n</style><p>가</p>\n<p>나</p></div>');
    assert.equal(gen.dropSound('<div><p>소리 없음</p></div>'), '<div><p>소리 없음</p></div>');
});

// ── 11-12 밤 급한 고침 셋(사용자가 깡통에 올린 글 163534 에서 봄) — 다시 깨지지 않게 잠가요 ──
await test('꾸민 낱말 + 빈칸 · 엔티티 든 글: 끊기지 않는 빈칸(&nbsp; · U+00A0)은 보통 빈칸으로 · 다른 엔티티는 두 번 이스케이프하지 않아요 · 두 번 걸어도 같아요', async () => {
    const tun = await import(pathToFileURL(path.join(MART, 'tune.js')).href + '?nbsp');
    // 글 고치기(contenteditable innerHTML)가 내놓는 꼴 그대로
    assert.equal(tun.cleanRich('<em>기울임</em>&nbsp;<strong>굵게</strong>&nbsp;<s>취소</s>'), '<em>기울임</em> <strong>굵게</strong> <s>취소</s>');
    assert.equal(tun.cleanRich('<em>기울임</em> <strong>굵게</strong>'), '<em>기울임</em> <strong>굵게</strong>');
    assert.equal(tun.cleanRich('가&#160;나&#xA0;다'), '가 나 다');
    assert.equal(tun.cleanRich('톰 &amp; 제리 &lt;3 &gt; &quot;따옴&quot; &#39;작은&#39; &#8212; &#x2014;'), '톰 &amp; 제리 &lt;3 &gt; &quot;따옴&quot; &#39;작은&#39; &#8212; &#x2014;', '이미 이스케이프된 엔티티는 그대로(두 번 이스케이프 0)');
    assert.equal(tun.cleanRich('톰 & 제리 < 3'), '톰 &amp; 제리 &lt; 3', '맨 & · < 는 한 번만');
    for (const v of ['<em>기울임</em>&nbsp;<strong>굵게</strong>', '톰 &amp; 제리', 'A &amp;amp; B', '&amp;nbsp;']) assert.equal(tun.cleanRich(tun.cleanRich(v)), tun.cleanRich(v), `두 번 걸어도 같아요: ${v}`);
    assert.ok(!tun.cleanRich('<b>가</b>&nbsp;<i>나</i>').includes('nbsp'));
    // 틀에 넣은 결과 HTML 한 줄: 고친 글에 &amp;nbsp; 가 안 남아요
    const html = '<style>\n.gk p{margin:0}\n</style><div class="gk"><p class="gk-nr">하나 둘 셋 넷</p></div>';
    const i = tun.editables(html).find(e => e.cls === 'gk-nr').i;
    const out = tun.applyTune(html, { texts: { [i]: '<em>기울임</em>&nbsp;<strong>굵게</strong>&nbsp;<s>취소</s>' } });
    assert.ok(out.includes('<p class="gk-nr"><em>기울임</em> <strong>굵게</strong> <s>취소</s></p>') && !/&amp;nbsp;|&nbsp;| /.test(out), out.slice(-90));
    // 내 글(붙여 넣은 글)도
    const mt = await import(pathToFileURL(path.join(MART, 'mine-text.js')).href + '?nbsp');
    const model = mt.mineModel('깡통: 여기 있을 줄 알았어.\n깡캐: 그래&nbsp;맞아.');
    assert.ok(model.lines.length >= 2 && model.lines.every(l => !/ |&nbsp;|&amp;nbsp;/.test(JSON.stringify(l))), JSON.stringify(model.lines));
});
await test('가짜 굵게: 본문 글꼴이 명조 계열(한 굵기)인 틀에만 굵게 = 고딕 700 규칙 하나 · 고딕 본문 틀 13 은 그대로 · 기본 규칙 덩이 안', async () => {
    const all = {}; for (const c of Object.values(sixAll.chunks)) Object.assign(all, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
    let serif = 0, sans = 0;
    for (const it of sixAll.items) {
        const p = all[it.id].preview, key = sf.simpleFrameInfo(p).key, font = (p.match(new RegExp(`\\.gk-${key} p\\{[^}]*?font:([^;}]*)`)) || [])[1] || '';
        const rule = gen.BOLD_RULE(key), n = p.split(rule).length - 1;
        if (/(?:^|,)\s*serif\s*$/.test(font)) { serif++; assert.equal(n, 1, `${it.id} 명조 본문인데 굵게 규칙이 ${n}개`); assert.ok(partsOf(p)[0].includes(rule), `${it.id} 기본 규칙 덩이 안`); }
        else { sans++; assert.match(font, /sans-serif\s*$/, `${it.id} 본문 글꼴 ${font}`); assert.equal(n, 0, `${it.id} 고딕 본문 틀은 그대로`); }
    }
    assert.equal(serif, 407); assert.equal(sans, 13);
    assert.equal(gen.BOLD_RULE('k1'), '.gk-k1 p strong,.gk-k1 p b{font-family:Pretendard,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;font-weight:700}');
});
await test('블라인드(details 안에 글이 든 틀): 깡통이 내용을 class 없는 div 로 감싸도 숨기지 않아요 — 빈 줄(class 없는 · class 든 것이 안 든 칸)만 숨김', () => {
    const p = sfx['simple-k8'].preview, out = sf.simpleReady(shutPeek(p));
    assert.ok(out.includes('div.gk-k8 details>summary~:not([class]):not(:has([class])){display:none}'), '새 규칙');
    assert.ok(!out.includes('details>summary~:not([class]){display:none}'), '옛 규칙(내용 칸까지 숨김)이 남았어요');
    assert.match(p, /<details\b[^>]*>\s*<summary[\s\S]*?<\/summary>[\s\S]*class="gk-(?:nr|dl|nm)/, '블라인드는 details 안에 글 줄이 들어 있어요');
    const src = fs.readFileSync(path.join(MART, 'simple-frames.js'), 'utf8');
    assert.ok(src.includes('details>summary~:not([class]):not(:has([class])){display:none}`'));
});
await test('11-13 깡통 빈 줄 막기 옛 규칙: 마트 자료 전부(원래 판에 옛 규칙이 든 틀 포함)에 옛 꼴 0 · 복사 글에도 0 · 고친 꼴은 테마 로그 복사와 같은 함수(fixKkGuard)', async () => {
    const all = {}; for (const c of Object.values(sixAll.chunks)) Object.assign(all, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
    const OLD_RULE = /details\s*>\s*summary\s*~\s*(?:\*|div)?:not\(\[class\]\)\s*\{\s*display\s*:\s*none/;
    let had = 0;
    for (const it of sixAll.items) {
        const p = all[it.id].preview;
        assert.ok(!OLD_RULE.test(p), `${it.id}: 자료에 옛 규칙(감싼 칸까지 숨김)이 남았어요`);
        if (/<details\b/.test(p)) assert.ok(!OLD_RULE.test(sf.simpleReady(shutPeek(p))), `${it.id}: 복사 글에 옛 규칙이 남았어요`);
        const def = [...gen.DEFS, ...gen.PASS_DEFS].find(d => d.id === it.id), file = def && gen.fileOf(def);
        if (file && OLD_RULE.test(fs.readFileSync(file, 'utf8'))) { had++; assert.ok(p.includes('details>summary~:not([class]):not(:has([class])){display:none}'), `${it.id}: 원래 판의 옛 규칙이 고친 꼴로 안 바뀌었어요`); }
    }
    assert.ok(had >= 389, `원래 판에 옛 규칙이 든 틀 ${had}`);
    const pol = await imp(path.join(MART, 'lib/log-copy/log-copy-polish.js'));
    assert.equal(pol.fixKkGuard('.gk-k1 details>summary~:not([class]){display:none}'), '.gk-k1 details>summary~:not([class]):not(:has([class])){display:none}');
    assert.equal(pol.fixKkGuard('div.gk-k8 details > summary ~ :not([class]) { display: none !important; }'), 'div.gk-k8 details > summary ~ :not([class]):not(:has([class])) { display: none !important; }');
    for (const keep of ['.gk-k1 details>summary~:not([class]):has(>br:only-child){display:none}', '.gk-k1 details:not([open])>summary~:not([class]){display:none}', '.gk-k1 details>summary~div{display:none}', '.gk-k1 details>summary~:not([class]){display:none;margin:0}', '.gk-k1 .x:not([class]){display:none}'])
        assert.equal(pol.fixKkGuard(keep), keep, `다른 뜻의 규칙은 그대로: ${keep}`);
    assert.ok(/^\/\/ 원본 블루레몬에이드/.test(fs.readFileSync(path.join(MART, 'lib/log-copy/log-copy-polish.js'), 'utf8')), '테마 사본 머리 그대로');
    // 이미 붙여 넣을 꼴인 내 글꾸(옛 복사 글을 다시 넣은 것 — pasteReady 가 그대로 돌려줘요)도 깡통에 붙일 꼴(kkangtongReady)에서 고쳐요
    const tgm = await imp(path.join(MART, 'tone-geulkku.js'));
    const ready = '<div class="gk gk-k8 gk-td blq-log"><style>.content>p,.blq-cm{box-sizing:border-box}.gk-k8 details>summary~:not([class]){display:none}</style><details class="gk-bl"><summary class="gk-sm">제목</summary><p class="gk-nr">글</p></details></div>';
    const got = tgm.kkangtongReady(ready);
    assert.ok(!OLD_RULE.test(got) && got.includes('.gk-k8 details>summary~:not([class]):not(:has([class])){display:none}'), got.slice(0, 200));
});
await test('액자 마트 고침(11-12 밤 전수조사 고침 안 3 · 4 · 5): 보이는 이름 하나(라파엘 · 무협시뮬 · D&H · 옛 이름으로도 찾아짐) · 장바구니는 받은 뒤에도 그대로 · 비우기 되살리기 · 작은 고장 다섯', async () => {
    const room = fs.readFileSync(path.join(MART, 'frame-room.js'), 'utf8'), cartSrc = fs.readFileSync(path.join(MART, 'cart.js'), 'utf8'), martSrc = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8');
    const showName = (0, eval)(room.match(/export const showName = (s => [^\n]+);\n/)[1]);
    assert.equal(showName('세라프 · 천지합동청 · 2D · 세로'), '라파엘 · 천지합동청 · 2D · 세로');
    assert.equal(showName('구야 · 강호유람록 · 3D · 가로'), '구야 · 무협시뮬 · 3D · 가로'); assert.equal(showName('강호유람록 · 인물'), '무협시뮬 · 인물');
    assert.equal(showName('헌시뮬 · 유리 · 가로'), 'D&H · 유리 · 가로'); assert.equal(showName('헌시뮬'), 'D&H');
    assert.equal(showName('MZ가 되고 싶은 최초의 세라프(우지엘)'), 'MZ가 되고 싶은 최초의 세라프(우지엘)', '원작 글 제목 속 세라프는 그대로');
    const frames = JSON.parse(fs.readFileSync(path.join(MART, 'data/frames.json'), 'utf8')).items;
    const shown = frames.map(x => [x.name, x.conceptLabel, x.categoryLabel].filter(Boolean).map(showName).join(' '));
    assert.ok(!shown.some(t => /세라프|강호유람록|헌시뮬/.test(t)), '보이는 이름에 옛 이름이 남았어요');
    assert.equal(shown.filter(t => /라파엘/.test(t)).length, 12); assert.equal(shown.filter(t => /무협시뮬/.test(t)).length, 84); assert.equal(shown.filter(t => /^D&H/.test(t)).length, 12);
    assert.ok(room.includes("extra, item._old || '', CAT_SEARCH[item.category] || '',"), '옛 이름은 찾기 말에 남겨요');
    assert.ok(martSrc.includes("'hunter-sim': SOURCES.hunter,") && !martSrc.includes("title: 'Dungeons & Hunters'"), '원작 제목은 sources.js 한 곳');
    // 장바구니: 받은 뒤 비우지 않아요 · 비우기는 되살릴 수 있어요
    assert.ok(!/if \(ok\) \{[^\n]*cart\.clear\(\)/.test(cartSrc), '받은 뒤 cart.clear() 금지');
    for (const k of ["restore() { if (!undo) return false;", 'data-cart="undo"', 'data-cart-got', "got = act === 'copy' ? '복사했어요 ✓' : '받았어요 ✓'", "clear() { if (entries.length) undo = [...entries];"]) assert.ok(cartSrc.includes(k), `cart.js ${k}`);
    // 작은 고장: 담기 알림 · 심플에서 방향/디자인 숨김 · 빈 결과 풀기 · 표본일 때 기억 숨김 · 개수 한 줄
    for (const k of ['담았어요 · 장바구니 ${api.cart.count()}개', "const simpleOnly = () => picker?.sel.group === 'simple' || picker?.sel.cat === 'simple';", 'data-act="clear-filters"', "document.querySelectorAll('.mart-tryon-keep')) k.hidden = !own;", "count.classList.add('is-line'); api.grid.before(count);"]) assert.ok(room.includes(k), `frame-room.js ${k}`);
});

// ── 11-13 「낮 · 밤 전환 넣기」 — 사용자 「어떤 깡은 라이트 어떤 깡은 나이트로 올리니까 밤에 보기 불편할 때가 있었음 … 나이트 라이트 선택 가능하면 해결」 ──
await test('낮 · 밤 전환 넣기: 공용 함수 사본은 허브 원본과 글자까지 같아요 · 복사 길(simpleReady 뒤)에만 걸어요 · 기본 끔 · 테마로 담기 값에는 안 실어요 · 420틀 모두 달려요', async () => {
    const dn = await imp(path.join(MART, 'day-night.js'));
    const copy = fs.readFileSync(path.join(MART, 'day-night.js'));
    assert.equal(crypto.createHash('sha256').update(copy).digest('hex'), '5fc107499709327dfd539a0322755c43b5af5d3fe406657e5fd8c7efa5cef684', '마트 사본(mart/day-night.js)이 바뀌었어요 — 허브 지시-1112/낮밤-전환-마트/전환.mjs 를 고친 뒤 다시 복사하고 이 값을 맞춰요');
    const hub = process.env.GK_TOGGLE_SRC || path.resolve(ROOT, '../../../../2026-10-24/w/outputs/지시-1112/낮밤-전환-마트/전환.mjs');
    if (fs.existsSync(hub)) assert.ok(copy.equals(fs.readFileSync(hub)), '허브 원본과 마트 사본이 달라요');
    const martSrc = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8'), ts = fs.readFileSync(path.join(MART, 'tone-state.js'), 'utf8'), ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
    for (const k of ["const withFlip = html => (toneState.flip ? flipOf(html) : html);", "return item.simple ? withFlip(simpleReady(h)) : item.photo ? h : kkangtongReady(h);", "state.item.simple && !state.item.own ? previewFlip(previewOf(state)) :"]) assert.ok(martSrc.includes(k), `mart.js ${k}`);
    assert.ok(ts.includes("const flip = saved.flip === true;") && ts.includes("...(toneState.flip ? { flip: true } : {})"), '기본 끔 · 켠 것만 기억');
    assert.ok(/html: item\.preview \|\| '', set \}\] \};/.test(martSrc) && !/themePack[\s\S]{0,400}withFlip/.test(martSrc), '테마로 담기 값은 틀 원래 판 그대로(전환 0)');
    assert.equal((ui.match(/\$\{flipChip\(item\)\}/g) || []).length, 2, '간편 · 세밀 밝기 줄 둘 다');
    assert.ok(ui.includes('data-tune-flip aria-pressed="${toneState.flip && !no}" aria-label="낮 · 밤 전환 넣기"'));
    // 420틀 × (낮 판 · 밤 판 · 캐릭터 색) — 달리고 · 뿌리 하나 · <style> 하나 · 두 번은 거절 · 지퍼의 조각 .gk-td 는 그대로 · 블라인드 빈 줄 규칙
    const all = {}; for (const c of Object.values(sixAll.chunks)) Object.assign(all, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
    const adds = [];
    for (const it of sixAll.items) {
        const key = sf.simpleFrameInfo(all[it.id].preview).key;
        for (const [name, h] of [['낮', sf.toneSimple(all[it.id].preview, sf.ORIGINAL, { mode: 'light' })], ['밤', sf.toneSimple(all[it.id].preview, sf.ORIGINAL, { mode: 'dark' })], ['색', sf.toneSimple(all[it.id].preview, '#8a5cf6', { mode: 'light', other: '#22a06b' })]]) {
            const ready = sf.simpleReady(shutPeek(h)), out = dn.addToggle(ready).html;
            assert.equal(out.split(`class="gkt gkt-${key}"`).length - 1, 1, `${it.id} ${name} 뿌리 하나`);
            assert.equal((out.match(/<style\b/g) || []).length, 1, `${it.id} ${name} <style> 하나`);
            assert.ok(/<details class="gkt-k"/.test(out) && !/>낮<|>밤</.test(out.replace(ready, '')), `${it.id} ${name} 해 · 달 단추(글자 0)`);
            assert.throws(() => dn.addToggle(out), /이미 전환/, `${it.id} 두 번은 거절`);
            if (name === '낮') adds.push(Buffer.byteLength(out) - Buffer.byteLength(ready));
        }
    }
    adds.sort((a, b) => a - b);
    assert.ok(adds[0] > 4000 && adds.at(-1) < 12000, `늘어난 바이트 ${adds[0]} ~ ${adds.at(-1)}`);
    assert.ok(Math.max(...sixAll.items.map(it => Buffer.byteLength(dn.addToggle(sf.simpleReady(shutPeek(all[it.id].preview))).html))) < 240000, '전환을 달아도 깡통 한 글(240KB)에 들어가요');
    const zip = dn.addToggle(sf.simpleReady(shutPeek(all['simple-k09'].preview))).html;
    assert.ok(/\.gk-k09 \.gk-td\b/.test(zip) || !/\.gk-k09 \.gk-td\b/.test(all['simple-k09'].preview), '지퍼의 조각 .gk-td 규칙은 안 바뀌어요');
    const blind = dn.addToggle(sf.simpleReady(shutPeek(all['simple-k8'].preview))).html;
    assert.ok(blind.includes('details>summary~:not([class]):not(:has([class])){display:none}') && !blind.includes('details>summary~:not([class]){display:none}'), '블라인드 빈 줄 규칙');
    assert.throws(() => dn.addToggle('<div><p>틀이 아님</p></div>'));
    assert.ok(fs.readFileSync(path.join(MART, 'geulkku/index.html'), 'utf8').includes('<b>전환 넣기</b>를 켜 두면 글에 해 · 달 단추가 붙어'));
});

// ── 11-12 밤 원작(출처) — 사용자 「글꾸 마트는 왜 출처가 없냐 … 링크 다 어디 감」: 다시 사라지지 않게 잠가요 ──
await test('원작(출처): 캐릭터 묶음의 모든 캐릭터가 원작 줄을 가져요 · 아홉 글 주소가 전부 자료에 있고 묶음마다 하나 이상 · 캐릭터 칸 · 고른 캐릭터 줄 · 크게 보기 · 「원작」 칸 · 액자 마트가 같은 자료(sources.js)를 읽어요', async () => {
    const so = await imp(path.join(MART, 'sources.js')), ts = await import(pathToFileURL(path.join(MART, 'tone-state.js')).href + '?src-test');
    const NINE = [54677, 5150, 78795, 78569, 127563, 155899, 81234, 29037, 99019, 43794].map(n => 'https://kkangtong.xyz/posts/' + n);   // 아홉 + 아드리안 둘째 글 = 열
    assert.deepEqual(so.ALL_SOURCES.map(x => x.url).sort(), [...NINE].sort(), '열 글 주소');
    for (const x of so.ALL_SOURCES) assert.ok(x.title && /^https:\/\/kkangtong\.xyz\/posts\/\d+$/.test(x.url), x.title);
    for (const g of ts.CAST_GROUPS) {
        assert.ok(so.groupSources(g.id, g.cast.map(x => x.name)).some(s => s.url), `묶음 ${g.label} 원작`);
        for (const x of g.cast) { const src = so.castSources(x.name, x.group); assert.ok(src.length && src.every(s => s.url && s.title), `${g.label} · ${x.name} 원작 없음`); }
    }
    assert.deepEqual(so.castSources('은설', 'sentinel').map(s => s.url), [NINE[7], NINE[8]]);
    assert.deepEqual(so.castSources('아드리안 폰 아이젠베르크', 'dh').map(s => s.url), [NINE[6], NINE[9]], '아드리안은 원작 글이 둘');
    assert.ok(/'adrian': ADRIAN_WORKS, 'adrian-char': ADRIAN_WORKS/.test(fs.readFileSync(path.join(MART, 'mart.js'), 'utf8')), '액자 마트 아드리안 액자도 둘');
    assert.deepEqual(so.castSources('백영현', 'dh').map(s => s.url), [NINE[1]]);
    assert.deepEqual(so.castSources('우지엘', 'halo').map(s => [s.kind, s.url]), [['깡캐', NINE[4]], ['원작', NINE[0]]]);
    assert.deepEqual(so.castSources('내가 만든 이름', 'mine'), []);
    const box = so.creditsHtml(ts.CAST_GROUPS);
    for (const u of NINE) assert.ok(box.includes(`href="${u}"`), `「원작」 칸에 ${u}`);
    for (const g of ts.CAST_GROUPS) for (const x of g.cast) assert.ok(box.includes(x.name), `「원작」 칸에 ${x.name}`);
    assert.doesNotMatch(box, /세라프[^(]|Seraph/, '세라프 표기는 원작 글 제목 속 낱말만');
    assert.match(so.sourceHtml({ title: '주소 없는 봇' }), /class="mart-source is-plain"/); assert.match(so.sourceHtml(so.WORKS.sengaSim), /<a class="mart-source" href="https:\/\/kkangtong\.xyz\/posts\/29037"/);
    // 화면 연결(글자 대조): 캐릭터 칸 묶음 줄 · 고른 캐릭터 줄 · 크게 보기 머리 · 「원작」 칸 · 액자 마트 봇 링크 · mart.js 는 주소를 따로 적지 않아요
    const castSrc = fs.readFileSync(path.join(MART, 'cast.js'), 'utf8'), martSrc = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8'), roomSrc = fs.readFileSync(path.join(MART, 'frame-room.js'), 'utf8');
    for (const k of ['class="mart-cast-src"', 'groupSources(g.id', 'export function pickedCreditHtml', 'class="mart-cast-credit"']) assert.ok(castSrc.includes(k), `cast.js ${k}`);
    for (const k of ['creditsHtml(CAST_GROUPS)', 'mart-sheet-credit', "workByTitle(item.source)"]) assert.ok(martSrc.includes(k), `mart.js ${k}`);
    assert.doesNotMatch(martSrc, /kkangtong\.xyz\/posts\/(54677|5150|78795|81234|127563|78569|155899|43794)/, 'mart.js 에 주소를 따로 적지 않아요(sources.js 한 곳)');
    assert.ok(roomSrc.includes('workByTitle(b)'), 'frame-room.js 봇 링크');
    assert.match(fs.readFileSync(path.join(MART, 'geulkku/index.html'), 'utf8'), /<section class="mart-credits" aria-label="캐릭터 원작"><\/section>/);
    for (const b of ['[실리/1차] 센티넬버스 시뮬레이션(센가시뮬) v1.3', '[실리/1차] 센티넬버스 아카데미']) assert.ok(so.workByTitle(b)?.url && roomSrc.includes(b), `액자 마트 봇 이름 ${b}`);
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

// ── 11-11 남은 칸: 형광펜 모양 · 속마음 · 강조 · 취소선 · 이름 글자 · 대사 줄 · 틀 넘침 손봄 ──
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
    assert.ok(/const snapOf = item => JSON\.stringify\(\{ tune: tuneOf\(item\.id\), look: lookNow\(\), motion: motionNow\(\), tex: texNow\(\), shape: shapeNow\(\), words: wordsNow\(\), tone: \{/.test(ui), '한 칸 = 조절 값 + 글 모양 + 이름 숨김 · 단어 바꾸기 + 깡통 · 깡캐 · 밤낮');
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

await test('숨기기(스포일러 · 테마 블록 숨김 꼴): 지문 · 대사 줄의 글을 통째로 눌러야 보이는 글로 · 그 줄 p 는 div.blsp-p(p 안에 details 를 안 넣어요 — HTML 이 p 를 닫아요) · 28틀 · 꾸밈 규칙은 틀 <style> 한 곳 · 알약 무테 · fill 짝 · 복사 글 <style> 하나 · 정적 검사 · 제목 · 이름은 안 숨김 · 견본 글과 내 글 따로', () => {
    for (const row of six.items) {
        const p = sfx[row.id].preview, eds = tu.editables(p), nr = eds.find(e => e.cls === 'gk-nr'), dl = eds.find(e => e.cls === 'gk-d'), tt = eds.find(e => e.cls === 'gk-tt'), nm = eds.find(e => e.cls === 'gk-nm');
        const out = tu.applyTune(p, { spoilers: [nr, dl, tt, nm].filter(Boolean).map(e => ({ i: e.i })) });
        assert.equal((out.match(/data-bl-spoiler=""/g) || []).length, 2, row.id);
        assert.equal((out.match(/\.blsp-s>summary\{/g) || []).length, 1, `${row.id} 꾸밈 규칙 한 번`);
        assert.doesNotMatch(out, /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<details/, `${row.id} p 안에 details 없음`);
        // 11-12(테마 c3528bad7 꼴): 줄 자리는 그대로 · 그 줄 글만 숨김 — p 는 div.blsp-p(원래 class 그대로)로 바뀌고 틀의 p 규칙에 짝 선택자
        assert.match(out, /<div class="gk-nr blsp-p"><details class="blsp-s blsp-k" data-bl-spoiler=""[^>]*><summary[^>]*><span class="blsp-l"[^>]*>[^<]+<\/span><div class="blsp-b"/, `${row.id} 지문 줄 자리 그대로 · 글만 숨김`);
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

await test('이름 글자색 따로 · 대사 · 이름 글꼴(기기 글꼴) · 「이 틀」 값 칸 틀(custom.js — 고리 주석이 있는 틀에만 · var 는 뿌리 변수 · cls 는 그 글자만 · 범위로 다듬기 · 2열 칸)', async () => {
    const cu = await import(pathToFileURL(path.join(MART, 'custom.js')).href);
    for (const row of six.items) {
        const p = sfx[row.id].preview, key = sf.simpleFrameInfo(p).key, K = `.gk-${key}`.repeat(3);
        const out = tu.applyTune(p, { inks: { light: { name: '#123456' } } });
        assert.ok(out.includes(`${K}.gk-tl p.gk-nm{color:#123456;-webkit-text-fill-color:#123456}`), row.id + ' 이름색');
        const lo = lk.applyLook(p, { fonts: { dialogue: lk.FONT_STACKS[1].id, name: lk.FONT_STACKS[1].id } });
        assert.ok(lo.includes(`${K} .gk-d{font-family:`) && lo.includes(`${K} p.gk-nm{font-family:`), row.id + ' 글꼴');
        assert.deepEqual(cu.fieldsOf(p), [], row.id + ' 고리 없으면 칸 없음');
    }
    // 11-11 커스텀 고리(지시-1111/커스텀/마트-연결.md · 표 98틀): 표에 있는 틀만 칸 · 기본값이면 그대로 · 고른 값이면 바뀌어요 · 틀린 값은 저장 안 함
    const { CUST } = await import(pathToFileURL(path.join(MART, 'lib/cust/cust-table.js')).href);
    const items = {}; for (const c of Object.values(sixAll.chunks)) Object.assign(items, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
    let n = 0;
    for (const [k, c] of Object.entries(CUST)) {
        const it = items['simple-' + k]; assert.ok(it, k); const p = it.preview, fs2 = cu.fieldsOf(p);
        assert.ok(fs2.length >= c.named.length, k);
        assert.equal(cu.applyVals(p, {}), p, k + ' 기본 그대로');
        const v = {}; for (const f of fs2.filter(x => x.group === 'named')) v[f.key] = f.kind === 'num' ? (f.def === f.min ? f.max : f.min) : f.kind === 'pick' ? f.options.find(o => String(o) !== String(f.def)) : f.kind === 'chars' ? '가'.repeat(f.len) : f.kind === 'date' ? '2-28' : '가';
        const slot = fs2.find(x => x.group === 'slot'); if (slot) v[slot.key] = '나';
        if (!Object.keys(v).length) continue;
        const out = tu.applyTune(p, { vals: v }); assert.notEqual(out, p, k + ' 바뀜'); assert.equal((out.match(/<style>/g) || []).length, 1, k); n++;
        assert.ok(tg.readyReport(sf.simpleReady(shutPeek(out))).ok, k + ' 복사 글 정적 검사');
    }
    assert.ok(n >= 90, '바뀐 틀 ' + n);
    const love = cu.fieldsOf(items['simple-k1079'].preview).find(f => f.key === '호감도');
    assert.equal(cu.valOk(love, 105), false); assert.equal(cu.valOk(love, 70), true);
    const ticket = cu.fieldsOf(items['simple-k1208'].preview).find(f => f.key === '좌석');
    assert.equal(cu.valOk(ticket, '12A'), true); assert.equal(cu.valOk(ticket, '가나다라마'), false, '폭 상한');
    assert.deepEqual(cu.cleanVals({ 호감도: 105, 좌석: '5D' }, [love, ticket]), { 좌석: '5D' });
    assert.match(cu.valsHtml(cu.fieldsOf(items['simple-k1079'].preview), {}), /class="mart-param is-wide"[\s\S]*data-val="호감도"/);
    assert.deepEqual(tu.cleanTune({ vals: { 호감도: 70, 'bad/key': 1, t3: '<b>' } }), { vals: { 호감도: 70, t3: 'b' } });
});

await test('독립 점검 1 · 3 · 4: 새 내 글이면 옛 글에서 고친 줄 · 숨긴 줄을 비워요(견본 글에서 고친 것은 그대로) · 실리태번 생성 시간 줄(34.2s)은 빼요 · 「이름: 글」 대사의 *속마음* 은 em', () => {
    const m1 = mt.mineModel('하린: *믿어도 되나* 그래, 알았어.\n도윤: 응.');
    const d = m1.lines.find(l => l.type === 'dl' && l.who === 0);
    const p = sfx[six.items[0].id].preview, out = mt.fillMine(p, m1);
    assert.match(out, /<em>믿어도 되나<\/em> 그래, 알았어\./);
    assert.ok(d && d.text.startsWith('믿어도 되나'), '글만 꼴(마크다운 · 이름 숨김)은 그대로');
    const st = '하린\n2026년 11월 11일 오후 9:12\n#12\n34.2s\n오늘 정말 늦었네.\n\n도윤\n2026년 11월 11일 오후 9:13\n#13\n12.0s\n"그러게."';
    const m2 = mt.mineModel(st);
    assert.ok(!m2.lines.some(l => /\d+\.\d+s/.test(l.html || l.text || '')), JSON.stringify(m2.lines));
    tu.setTune('drop-test', { texts: { 0: '견본 고침' }, mineTexts: { 0: '옛 내 글 고침' }, mineSpoilers: [{ i: 1 }] });
    tu.setTune('drop-test2', { mineTexts: { 2: '옛' } });
    assert.equal(tu.dropMineEdits(), 2);
    assert.deepEqual(tu.tuneOf('drop-test'), { texts: { 0: '견본 고침' } }); assert.equal(tu.tuneOf('drop-test2'), null);
    tu.setTune('drop-test', null);
    assert.match(fs.readFileSync(path.join(MART, 'cast.js'), 'utf8'), /if \('text' in next && String\(next\.text \?\? ''\) !== mineText\(\)\) dropMineEdits\(\)/);
});

await test('별 개수(D2 별점 고리): st-N 규칙이 든 틀에만 「별 개수」 칸(0 ~ 5 · 반 별) · 뿌리 class 하나(gk- 머리 따라) · 다섯이면 그대로 · 다시 걸면 갈아 끼움', async () => {
    const cu = await import(pathToFileURL(path.join(MART, 'custom.js')).href);
    const h = '<div class="gk gk-tl gk-k1303"><style>\n.gk-k1303.gk-st-3 .gk-s4{visibility:hidden}\n</style><p class="gk-nr">x</p></div>';
    const f = cu.fieldsOf(h).find(x => x.key === cu.STAR_KEY);
    assert.ok(f && f.min === 0 && f.max === 5 && f.step === 0.5 && f.def === 5);
    assert.equal(cu.valOk(f, 2.5), true); assert.equal(cu.valOk(f, 2.3), false); assert.equal(cu.valOk(f, 6), false);
    assert.equal(cu.applyVals(h, { 별: 5 }), h);
    assert.match(cu.applyVals(h, { 별: 2.5 }), /^<div class="gk gk-tl gk-k1303 gk-st-2h">/);
    assert.match(cu.applyVals(cu.applyVals(h, { 별: 2.5 }), { 별: 0 }), /^<div class="gk gk-tl gk-k1303 gk-st-0">/);
    assert.equal(cu.starOf(sfx[six.items[0].id].preview), null, '별점 틀이 아니면 칸 없음');
});

await test('기본 글꾸 18틀(마트-길닦기 17-8): 「이 틀」에 정보 칸(끔 · 칩 · 탭) · 높이(늘어남 · s · m · l) · 정보 글자(LOG · 모델 · 프롬프트 · 탭 이름) — 뿌리 class 하나씩 · 갈아 끼움 · 기본이면 그대로 · 레몬 빼기도 먹어요', async () => {
    const cu = await import(pathToFileURL(path.join(MART, 'custom.js')).href);
    const items = {}; for (const c of Object.values(sixAll.chunks)) Object.assign(items, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
    const ids = Object.keys(items).filter(id => /\.gk-gi-chip/.test(items[id].preview || ''));
    assert.equal(ids.length, 18);
    for (const id of ids) {
        const h = items[id].preview, keys = cu.fieldsOf(h).map(f => f.key);
        assert.ok(keys.includes('정보 칸') && keys.includes('높이') && keys.includes('모델') && keys.includes('프롬프트'), id + ' ' + keys);
        assert.equal(cu.applyVals(h, { '정보 칸': '끔', 높이: '늘어남' }), h, id);
        const o = cu.applyVals(cu.applyVals(h, { '정보 칸': '칩', 높이: 's', 모델: 'Gemini' }), { '정보 칸': '탭', 높이: 'l' });
        const root = o.match(/^<div[^>]*>/)[0];
        assert.ok(/gk-gi-tab/.test(root) && !/gk-gi-chip/.test(root) && /gk-gh-l/.test(root) && !/gk-gh-s/.test(root), id + ' ' + root);
        assert.ok(o.includes('>Gemini<'), id);
        assert.doesNotMatch(lk.applyLook(h, { lemon: { off: true } }), /gk-lm/, id + ' 레몬');
        assert.ok(tg.readyReport(sf.simpleReady(shutPeek(o))).ok, id);
    }
});
// ── 11-12 남은 넷(마트-빠진것 15): 셋째 화자 색 · 내 글꾸(남의 HTML) · 완성 프리셋 파일 · 붙일 곳 흉내 ──
const allItems = (() => { const o = {}; for (const c of Object.values(sixAll.chunks)) Object.assign(o, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items); return o; })();
await test('셋째 화자 색: 셋째부터 깡캐 본 + gk-nZ · gk-dZ · 셋째 색을 안 고르면 Z 규칙 없음(깡캐 모습 그대로) · 고르면 Z 규칙이 깡캐 규칙 뒤에 · 화자 둘이면 Z 없음 · 407틀 태그 짝 · 정적 검사', () => {
    const three = mt.mineModel(MINE_LOGS.셋), two = mt.mineModel(MINE_LOGS.짧은);
    assert.equal(three.names.length, 3);
    assert.equal(sf.THIRD, 'Z');
    let n = 0, band = 0;
    for (const [id, it] of Object.entries(allItems)) {
        const p = it.preview, f3 = mt.fillMine(p, three);
        if (f3 === p) continue;   // 내 글이 안 들어가는 틀
        n++;
        assert.ok(f3.includes('gk-nZ') && /class="gk-d gk-d[A-Z] gk-dZ"/.test(f3), id + ' Z 표시');
        assert.ok(!mt.fillMine(p, two).includes('gk-nZ'), id + ' 둘이면 Z 없음');
        const plain = sf.toneSimple(f3, sf.ORIGINAL, { mode: 'light' }), colored = sf.toneSimple(f3, sf.ORIGINAL, { mode: 'light', third: '#e63946' });
        assert.ok(!/\.gk-[a-z]+Z\{/.test(plain), id + ' 셋째 색 없으면 Z 규칙 없음');
        if (sf.simpleFrameInfo(f3).imageBand) band++;
        assert.ok(/\.gk-nm\.gk-nZ\{color:#[0-9a-f]{6};-webkit-text-fill-color:#[0-9a-f]{6}\}/.test(colored), id + ' Z 이름 규칙');
        const css = colored.slice(0, colored.indexOf('</style>')), zAt = css.search(/\.gk-nm\.gk-nZ\{/), bAt = css.lastIndexOf('.gk-nm.gk-n');
        assert.ok(zAt >= 0 && zAt >= css.lastIndexOf('.gk-nm.gk-n', zAt - 1), id + ' Z 규칙이 뒤에');
        assert.ok(bAt >= 0);
        const open = (colored.match(/<(div|p|span|details|summary)\b/g) || []).length, close = (colored.match(/<\/(div|p|span|details|summary)>/g) || []).length;
        assert.equal(open, close, id + ' 태그 짝');
        assert.ok(tg.readyReport(sf.simpleReady(shutPeek(colored))).ok, id + ' 복사 글 정적 검사');
    }
    assert.ok(n >= 300, '내 글이 들어간 틀 ' + n);
    console.log(`      셋째 화자 틀 ${n} · 띠를 그림으로 긋는 틀 ${band}`);
});

const own = await import(pathToFileURL(path.join(MART, 'own.js')).href + '?v=20261112a');
await test('내 글꾸(own.js): 마트 복사 글은 틀 꼴로 되돌려 읽혀요(407틀 · 칠하기 · 내 글 넣기 됨) · 남의 HTML 은 그대로 · 깡통 점검 · <style> 가두기 · 20개 · 60KB', () => {
    let simple = 0;
    for (const [id, it] of Object.entries(allItems)) {
        const copy = sf.simpleReady(shutPeek(it.preview)), sh = own.ownShape(copy);
        assert.ok(sh.simple && sh.key, id + ' 틀 꼴');
        assert.ok(!sh.html.includes('<!--') && !sh.html.startsWith('<p><br></p>'), id + ' 주석 · 빈칸 뗌');
        assert.notEqual(sf.toneSimple(sh.html, '#3aa7ff', { mode: 'light' }), sh.html, id + ' 칠하기');
        if (mt.storyOf(it.preview)) assert.notEqual(mt.fillMine(sh.html, mt.mineModel(MINE_LOGS.짧은)), sh.html, id + ' 내 글 넣기');
        assert.equal(own.kkLint(copy).filter(w => w.level === 'die').length, 0, id + ' 마트 복사 글은 깡통에서 죽는 것 없음 ' + JSON.stringify(own.kkLint(copy)));
        simple++;
    }
    assert.equal(simple, Object.keys(allItems).length);
    const other = '<div style="background:#fff;color:#333;padding:12px;overflow:hidden" id="a" onclick="x()"><script>alert(1)</script><svg></svg><p style="background:url(a.png)">글</p></div><style>body{margin:0}@font-face{font-family:x;src:url(a.woff)}.x{color:red;position:fixed}</style>';
    assert.equal(own.ownShape(other).simple, false);
    const ids = own.kkLint(other).map(w => w.id);
    for (const k of ['script', 'on', 'hidden', 'id', 'svg', 'font', 'fixed', 'url', 'fill', 'fill-css', 'page']) assert.ok(ids.includes(k), k + ' ' + ids);
    const sc = own.scopeCss('body{margin:0}:root{--a:1}.x,.y>p,html .w{color:red}@media (max-width:600px){.z{top:0}}@keyframes k{from{opacity:0}to{opacity:1}}@import url(a.css);', '.S');
    assert.equal(sc, '.S{--a:1}\n.S .x,.S .y>p{color:red}\n@media (max-width:600px){.S .z{top:0}}\n@keyframes k{from{opacity:0}to{opacity:1}}', 'html · body 규칙은 빼요');
    assert.equal(own.scopeCss(':is(.a,.b) .c{x:1}', '.S'), '.S :is(.a,.b) .c{x:1}', '괄호 안 쉼표는 그대로');
    assert.match(own.scopePreview('<style>.a{b:c}</style><p class="a">x</p>', 'ab12'), /^<div class="mart-own-view mart-own-ab12"><style>\.mart-own-ab12 \.a\{b:c\}<\/style><p class="a">x<\/p><\/div>$/);
    const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem(k, v) { store[k] = v; }, removeItem(k) { delete store[k]; } };
    try {
        const first = own.addOwn({ html: sf.simpleReady(shutPeek(allItems['simple-k1'].preview)), warn: [] });
        assert.equal(first.name, '내 글꾸 1'); assert.equal(first.simple, true);
        assert.equal(own.addOwn({ html: 'x'.repeat(own.OWN_BYTES + 1) }), 'big');
        for (let i = 2; i <= own.OWN_MAX; i++) assert.equal(typeof own.addOwn({ html: `<p>${i}</p>` }), 'object');
        assert.equal(own.addOwn({ html: '<p>21</p>' }), 'full');
        const item = own.ownItem(own.ownList().at(-1));
        assert.ok(item.own && item.simple && item.id === 'own-' + first.id && item.category === own.OWN_CAT);
        own.setOwnPath(first.id, [0, 2]); assert.deepEqual(own.ownList().find(x => x.id === first.id).path, [0, 2]);
        own.forgetOwn(first.id); assert.equal(own.ownList().length, own.OWN_MAX - 1);
    } finally { delete globalThis.localStorage; }
    assert.equal(own.slotHtml({ names: ['하린', '도윤'], lines: [{ type: 'nr', html: '바람.' }, { type: 'dl', who: 0, text: '안<녕' }, { type: 'dl', who: 0, text: '응' }, { type: 'dl', who: 1, text: '어' }] }), '<p>바람.</p><p><b>하린</b></p><p>안&lt;녕</p><p>응</p><p><b>도윤</b></p><p>어</p>');
    const ms = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8');
    assert.ok(ms.includes("viewOf(state)") && ms.includes("scopePreview(previewOf(state), state.item.ownId)"), '화면에만 가두기(복사 글은 그대로)');
    assert.ok(/function finishHtml\(item, h\) \{\n    if \(item\.own\)/.test(ms));
});

await test('완성 프리셋 파일: 내려받은 글을 그대로 가져와요(틀 · 색 · 셋째 · 글 모양 · 값 · 고친 글) · 모르는 꼴은 빈 목록 · 화면 이름 「완성 프리셋」', () => {
    const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem(k, v) { store[k] = v; }, removeItem(k) { delete store[k]; } };
    try {
        const row = tu.saveMine({ frame: 'simple-k1079', frameName: '호감도 게이지', name: '내 게이지', tone: { on: true, k: '#3AA7FF', name: '가브리엘', k2: '#7fe03c', name2: '우리엘', k3: '#ff5fa2', name3: '아스모데우스', mode: 'light' }, tune: { vals: { 호감도: 70 }, texts: { 0: '새 제목' }, inks: { light: { title: '#123456' } } }, look: { text: { size: 18 } } });
        assert.equal(row.tone.k3, '#ff5fa2');
        const file = tu.setsFile(tu.mineList());
        assert.match(file, /^\{\n "bl-mart-set": 1,/);
        tu.forgetMine(row.id); assert.equal(tu.mineList().length, 0);
        const got = tu.addSets(tu.readSets(file));
        assert.equal(got.length, 1);
        const { id, at, ...a } = got[0], { id: i2, at: a2, ...b } = row;
        assert.deepEqual(a, b, '같은 값');
        assert.deepEqual(tu.readSets('{"x":1}'), []); assert.deepEqual(tu.readSets('나쁜 글'), []);
        assert.equal(tu.readSets(JSON.stringify({ frame: 'simple-k1', name: '하나', tone: {} })).length, 1, '줄 하나만 든 파일');
    } finally { delete globalThis.localStorage; }
    const ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
    assert.ok(ui.includes('완성 프리셋 <small>이 틀 + 색 + 글 모양 + 값 + 고친 글</small>') && ui.includes('data-sets-down') && ui.includes('data-sets-pick') && ui.includes('data-mine-down'));
});

await test('붙일 곳 흉내: summary 뒤 빈 줄 · id · for · name 지움 · 스크립트 지움 · 마트 / 글 · PC / 글 · 폰 · 흉내 중엔 글 고치기 꺼짐 · 사이트 규칙은 :where 로 낮게', () => {
    const ms = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8');
    const simSrc = ms.match(/export const siteSim = (html => String\(html \?\? ''\)[\s\S]*?\.replace\(\/<script[^\n]*\);)\n/)[1];
    const siteSim = (0, eval)(simSrc.replace(/;$/, ''));
    assert.equal(siteSim('<details class="a"><summary id="s">t</summary><label for="x" class="b">y</label><input name="n" id="x"></details><script>1</script>'), '<details class="a"><summary>t</summary><div><br></div><label class="b">y</label><input></details>');
    assert.ok(ms.includes("['mart', '마트'], ['pc', '글 · PC'], ['phone', '글 · 폰']") && ms.includes("if (site.mode !== 'mart') { stopEdit();"));
    const css = fs.readFileSync(path.join(MART, 'mart.css'), 'utf8');
    for (const r of [':where(.mart-site) .content details{margin:.25rem 0}', '.mart-site.is-phone .mart-site-page{max-width:360px}', '.mart-site-page{box-sizing:border-box;max-width:640px;']) assert.ok(css.includes(r), r);
});
await test('간편(11-12 · 설계 4-2): 움직임 세기 사본(중 = 그대로 · 약 → 중 되돌림 · 407틀) · 글 크기 sizeStep(틀 크기 + n · 고정 px 이 이김) · 추천 스타일 여섯 · 간편 | 세밀 화면 칸', async () => {
    const ms = await import(pathToFileURL(path.join(MART, 'motion-state.js')).href + '?v=20261112a');
    const mo = await import(pathToFileURL(path.join(MART, 'lib/motion/motion.js')).href);
    let ts = 0, ps = 0;
    for (const [id, it] of Object.entries(allItems)) {
        const p = it.preview, key = id.replace('simple-', '');
        assert.equal(ms.applyMotion(p, { text: 'm', prop: 'm' }), p, id + ' 중');
        const s = ms.applyMotion(p, { text: 's', prop: 's' });
        if (s !== p) { assert.equal(mo.applyLevel(s, {}), p, id + ' 되돌림'); assert.equal((s.match(/<style>/g) || []).length, 1, id); }
        const c = ms.motionCaps(p); if (c.text.s) ts++; if (c.prop.s) ps++;
        void key;
    }
    assert.ok(ts > 140 && ps > 160, `글 ${ts} · 소품 ${ps}`);   // 11-12 깡통 118 뒤: 약이 중과 같아 보이는 틀(정본 화면 재기 FELT)은 칩을 흐리게 — 글 153 · 소품 183
    const p = sfx[six.items[0].id].preview;
    const big = lk.applyLook(p, { type: { sizeStep: 2 } });
    assert.match(big, /p:not\(\.gk-nm\)\{font-size:\d+px\}/);
    const base = Number((p.match(/\.gk-nr\{[^}]*?font(?:-size)?:[^;}]*?(\d+)px/) || [, 16])[1]);
    assert.ok(big.includes(`p:not(.gk-nm){font-size:${base + 2}px}`), '틀 크기 + 2 ' + base);
    assert.ok(lk.applyLook(p, { type: { sizeStep: 2, size: 15 } }).includes('p:not(.gk-nm){font-size:15px}'), '고정 px 이 이겨요');
    const { LOOKS } = await import(pathToFileURL(path.join(MART, 'looks.js')).href + '?v=20261112a');
    assert.deepEqual(LOOKS.map(x => x.label), ['틀 그대로', '또렷하게', '잔잔하게', '큼직하게', '책처럼', '가볍게']);
    for (const x of LOOKS) if (x.look) assert.ok(lk.cleanLook(x.look), x.id + ' 다듬어도 남아요');
    const ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
    for (const w of ['data-view="simple"', '더 조절하기', 'data-simple-style', 'data-simple-motion', 'data-simple-size', '세밀에서 바꾼 것', "['motion', '움직임']"]) assert.ok(ui.includes(w), w);
});
await test('설정 꼴 blGeulkku 2(geulkku-set.js) · 테마로 담기 꾸러미: 아무것도 안 고치면 { blGeulkku: 2 } · 지금 값 → 설정 → 다시 읽기 = 같은 값 · 꾸러미는 bl-mart 1 + geulkku-simple', async () => {
    const gs = await import(pathToFileURL(path.join(MART, 'geulkku-set.js')).href + '?v=20261112a');
    assert.deepEqual(gs.makeSet({ tone: { on: false, mode: 'dark', cover: true } }), { blGeulkku: 2, from: 'mart', style: { mode: 'dark' } });
    const tone = { on: true, k: '#3AA7FF', name: '가브리엘', k2: '#7fe03c', name2: '우리엘', k3: '#ff5fa2', name3: '아스모데우스', mode: 'light', cover: false };
    const look = { type: { size: 18, sizeStep: 2 }, lemon: { off: true }, dialogue: { style: 'full' } };
    const tune = { vals: { 호감도: 70 }, texts: { 0: '새 제목' }, inks: { light: { title: '#123456' } }, own: false, hideNames: true, lines: 1 };
    const set = gs.makeSet({ tone, look, motion: { text: 's', prop: 'm' }, tune, frame: 'simple-k1079', label: '시험' });
    assert.equal(set.frame, 'k1079'); assert.deepEqual(set.style.show, { lemon: false }); assert.deepEqual(set.frames.k1079.prop, { tone: 'cast' });
    const back = gs.readSet(JSON.stringify(set));
    assert.deepEqual(back.tone, { mode: 'light', auto: false, cover: false, on: true, k: '#3aa7ff', name: '가브리엘', k2: '#7fe03c', name2: '우리엘', k3: '#ff5fa2', name3: '아스모데우스' });
    assert.deepEqual(back.look, lk.cleanLook(look)); assert.deepEqual(back.motion, { text: 's', prop: 'm', speed: 'm', open: false });
    // 11-12 새 조절(모양 · 빠르기 · 열어 두기 · 밤낮 자동) 왕복
    const SH = { bandAlpha: 28, borderAlpha: 0, radius: 16, pad: 120, width: 560, noBorder: true, nameTag: 'pill', nameAlign: 'center', hideUl: true, hideProp: true };
    const set2 = gs.makeSet({ tone: { on: false, mode: 'dark', auto: true }, motion: { text: '0', prop: 'l', speed: 's', open: true }, shape: SH });
    assert.equal(set2.style.mode, 'auto'); assert.deepEqual(set2.style.colors, { bandAlpha: 28, borderAlpha: 0 }); assert.deepEqual(set2.style.prop, { show: false });
    assert.deepEqual(set2.style.shape, { radius: 16, pad: 120, width: 560, nameTag: 'pill', nameAlign: 'center', border: false }); assert.deepEqual(set2.style.show, { underline: false });
    const back2 = gs.readSet(set2);
    assert.deepEqual(back2.shape, SH); assert.deepEqual(back2.motion, { text: '0', prop: 'l', speed: 's', open: true }); assert.equal(back2.tone.auto, true);
    assert.deepEqual(back.tune, tu.cleanTune(tune)); assert.equal(back.name, '시험');
    assert.equal(gs.readSet('{"x":1}'), null); assert.equal(gs.readSet({ blGeulkku: 1 }), null);
    const ms = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8');
    const packSrc = ms.match(/export function themePack\(item, set\) \{[\s\S]*?\n\}/)[0].replace('export ', '');
    const keySrc = ms.match(/export const themeKey = [^\n]*/)[0].replace('export const themeKey = ', '');
    const themePack = (0, eval)(`(simpleFrameInfo) => { const themeKey = ${keySrc}; return (${packSrc}); }`)(sf.simpleFrameInfo);
    const pack = themePack({ id: 'simple-k1079', name: '호감도 게이지', emoji: '💗', preview: '<div class="gk">x</div>' }, set);
    assert.deepEqual(Object.keys(pack), ['bl-mart', 'items']); assert.equal(pack['bl-mart'], 1);
    assert.deepEqual(Object.keys(pack.items[0]), ['kind', 'v', 'id', 'key', 'name', 'emoji', 'html', 'set']);
    assert.equal(pack.items[0].kind, 'geulkku-simple'); assert.equal(pack.items[0].key, 'k1079');
    // 11-12 점검 2-① 내 글꾸(own-<무작위>)는 틀 HTML 뿌리 class 에서 열쇠를 읽어요(id 끝 k3 같은 우연에 안 속아요) · 담을 때 틀 값도 그 열쇠로
    const ownHtml = allItems['simple-k1079'].preview;
    for (const id of ['own-ab12cd34', 'own-zz9k3', 'own-q7']) assert.equal(themePack({ id, own: true, name: '내 글꾸 1', preview: ownHtml }, set).items[0].key, 'k1079', id);
    assert.match(ms, /frame: item\.own \? themeKey\(item\) : item\.id/);
    // 11-12 점검 2-② 테마(1.1.5 mart-import.js SIMPLE_SET_MAX)는 조절 값이 16KB 를 넘으면 알림 없이 틀만 받아요 — 마트가 담을 때 알려요
    assert.match(ms, /export const THEME_SET_MAX = 16 \* 1024;/);
    const take = ms.match(/async function themeTake\(state, file\) \{[\s\S]*?\n\}/)[0];
    assert.match(take, /JSON\.stringify\(set\)\.length > THEME_SET_MAX/); assert.ok(take.indexOf('makeSet(') < take.indexOf('clipText('), '조절 값은 클립보드를 열기 전에(기다림 없이) 만들어요');
    const longTune = { texts: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, '가'.repeat(3000)])) };
    assert.ok(JSON.stringify(gs.makeSet({ tone: {}, tune: longTune, frame: 'simple-k1079' })).length > 16 * 1024, '고친 글 열 칸(한 칸 2000자 안팎)이면 넘어요');
});
await test('바탕 질감(11-12 · 글꾸-질감/마트-연결.md): 끔이면 그대로 · 420틀 × 낮밤에 걸고 떼면 처음과 같음 · 걸지 않는 틀 16 · <style> 하나 · 정적 검사 · 인스타 세 틀 + #222 즉석카메라 목록', async () => {
    const tx = await import(pathToFileURL(path.join(MART, 'texture.js')).href + '?v=20261112a');
    let n = 0; const blocked = new Set();
    for (const [id, it] of Object.entries(allItems)) for (const mode of ['light', 'dark']) {
        const p = sf.toneSimple(it.preview, sf.ORIGINAL, { mode });
        assert.equal(tx.applyTex(p, null), p, id);
        const o = tx.applyTex(p, { tex: 'rough', on: 'c', level: 1 });
        if (o === p) { blocked.add(id); continue; }
        n++; assert.equal(tx.stripTex(o), p, id + ' 떼기'); assert.equal((o.match(/<style>/g) || []).length, 1, id);
        assert.match(o.match(/^<div[^>]*>/)[0], /gk-tx-rough gk-tx-on-c gk-tx-1/);
        if (n % 40 === 1) assert.ok(tg.readyReport(sf.simpleReady(shutPeek(o))).ok, id + ' 정적 검사');
    }
    assert.ok(n > 780, '건 판 ' + n);
    for (const k of Object.keys(tx.NO_TEX_MART)) assert.ok(blocked.has('simple-' + k), k + ' 막음');
    assert.equal(blocked.size, 16, '막은 틀 ' + [...blocked]);
    assert.deepEqual(tx.cleanTex({ tex: 'line', on: 'x', level: 9, margin: true }), { tex: 'line', on: 'b', level: 2, margin: true });
    assert.equal(tx.cleanTex({ tex: 'none' }), null);
    for (const k of ['k1371', 'k1372', 'k1373']) assert.ok(sixAll.items.some(x => x.id === 'simple-' + k), k);
    assert.equal(sixAll.items.find(x => x.id === 'simple-k1222').name, '즉석카메라');
    assert.ok(!sixAll.items.some(x => x.name === '인스타 스토리' && x.id !== 'simple-k1373'));
});
await test('움직임 끔(세기 모듈 gm-0 · gp-0): 칩 넷 · 끔이면 뿌리 gk-gm-0 / gk-gp-0 · 되돌림 · 끔이 없는 틀은 그대로', async () => {
    const ms = await import(pathToFileURL(path.join(MART, 'motion-state.js')).href + '?v=20261112a');
    const mo = await import(pathToFileURL(path.join(MART, 'lib/motion/motion.js')).href);
    assert.deepEqual(ms.MOTION_LEVELS.map(x => x[1]), ['끔', '약', '중', '강']);
    let off = 0;
    for (const it of Object.values(allItems)) {
        const p = it.preview, c = ms.motionCaps(p), o = ms.applyMotion(p, { text: '0', prop: '0' });
        if (!c.text[0] && !c.prop[0]) { assert.equal(o, p); continue; }
        off++; assert.match(o.match(/^<div[^>]*>/)[0], /gk-g[mp]-0/); assert.equal(mo.applyLevel(o, {}), p);
    }
    assert.ok(off > 300, '끔 되는 틀 ' + off);
});
// 11-12 테마 1.1.3 c3528bad7(기본 글꾸 새 틀 숨긴 글이 <p> 안 <details> 라 붙인 글에서 문단이 쪼개지고 글자색을 잃던 것)과 같은 결함 확인 — 420틀 × 낮밤
await test('숨긴 줄 420틀: 지문 · 대사 첫 줄을 숨겨도 복사 글에 <p> 안 <details> 0 · 숨긴 줄은 div.blsp-p · 틀 <style> 의 p 규칙마다 .blsp-p 짝(선언 그대로) · <style> 하나 · 정적 검사 · 숨길 것이 없으면 한 글자도 안 달라요 · 글만 복사에 숨긴 줄 한 번', () => {
    const P_SEL = /(^|[\s>+~(,])p(?=$|[\s>+~.:#[),])/, P_ALL = new RegExp(P_SEL.source, 'g');
    let n = 0;
    for (const [id, it] of Object.entries(allItems)) for (const mode of ['light', 'dark']) {
        const base = sf.toneSimple(it.preview, sf.ORIGINAL, { mode }), ed = tu.editables(base), tag = `${id} ${mode}`;
        assert.equal(tu.applySpoilers(base, []), base, tag);
        const lines = [ed.find(e => e.cls === 'gk-nr'), ed.find(e => e.cls === 'gk-d')].filter(Boolean);
        if (!lines.length) continue;
        const out = tu.applySpoilers(base, lines.map(e => ({ i: e.i }))), ready = sf.simpleReady(shutPeek(out));
        assert.doesNotMatch(ready, /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<details/, `${tag} p 안 details`);
        assert.match(ready, /<div class="[^"]*\bblsp-p\b[^"]*"><details class="blsp-s/, `${tag} div.blsp-p`);
        assert.equal((ready.match(/<style>/g) || []).length, 1, tag);
        const css = styleOf(out);
        for (const r of styleOf(base).match(/[^{}]+\{/g) || []) {
            const sel = r.slice(0, -1).trim(); if (sel.startsWith('@') || !P_SEL.test(sel)) continue;
            const twin = sel.split(',').map(x => x.trim()).filter(x => P_SEL.test(x)).map(x => x.replace(P_ALL, (m, b) => `${b}.blsp-p`)).join(',');
            assert.ok(css.includes(`,${twin}{`), `${tag} 짝 ${sel.slice(0, 60)}`);
        }
        assert.ok(tg.readyReport(ready).ok, `${tag} 정적 검사`);
        const md = mt.frameMarkdown(ready), first = tu.editables(base).find(e => e.cls === 'gk-nr');
        if (first) { const w = first.text.replace(/<[^>]+>/g, '').trim().slice(0, 6); if (w && !/[&*~]/.test(w)) assert.equal(md.split(w).length >= 2, true, `${tag} 글만 복사에 숨긴 줄`); }
        n++;
    }
    assert.ok(n > 800, '잰 판 ' + n);
});
// 11-12 고른 글 옆 막대(mart/select-hide.js): 고른 글만 숨기기 { i, a, b, t } — 테마 미리보기 「숨기기」와 같은 글줄 안 꼴(details.blsp-s · blsp-k 없음)
await test('고른 글만 숨기기 420틀 × 낮밤: 지문 첫 줄 가운데 글만 글줄 안 숨긴 글 · 나머지 글은 밖 · <p> 안 details 0 · 정적 검사 · 글만 복사에 숨긴 글 · 줄째 숨김이 있으면 그쪽', async () => {
    const tun = await import(pathToFileURL(path.join(MART, 'tune.js')).href + '?v=20261112s');
    let n = 0;
    for (const [id, it] of Object.entries(allItems)) for (const mode of ['light', 'dark']) {
        const base = sf.toneSimple(it.preview, sf.ORIGINAL, { mode }), tag = id + ' ' + mode;
        const cell = tun.editables(base).find(e => e.cls === 'gk-nr' && !/<[a-z]/i.test(e.text) && tun.cellText(e.text).text.trim().length >= 9);
        if (!cell) continue;
        const { text } = tun.cellText(cell.text), a = Math.floor(text.length / 3), b = Math.floor(text.length * 2 / 3), t = text.slice(a, b);
        if (!t.trim()) continue;
        const out = tun.applySpoilers(base, [{ i: cell.i, a, b, t }]), ready = sf.simpleReady(shutPeek(out));
        const det = ready.match(/<details class="([^"]*)" data-bl-spoiler="[^"]*"[^>]*>[\s\S]*?<\/details>/);
        assert.ok(det, tag + ' 숨긴 글');
        assert.equal(det[1], 'blsp-s', tag + ' 글줄 안 꼴');
        const inner = det[0].match(/<span class="blsp-c">([\s\S]*?)<\/span><\/details>/);
        assert.equal(tun.cellText(inner[1]).text, t, tag + ' 고른 글 그대로');
        assert.doesNotMatch(ready, /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*<details/, tag + ' p 안 details');
        assert.equal((ready.match(/<style>/g) || []).length, 1, tag);
        assert.ok(tg.readyReport(ready).ok, tag + ' 정적 검사');
        const md = mt.frameMarkdown(ready), w = text.slice(0, a).trim().slice(-4);
        if (w && !/[&*~_\\]/.test(w + t)) { assert.ok(md.includes(w), tag + ' 앞 글'); assert.ok(md.includes(t.trim().slice(0, 4)), tag + ' 숨긴 글도 글만 복사에'); }
        assert.equal(tun.applySpoilers(base, [{ i: cell.i }, { i: cell.i, a, b, t }]), tun.applySpoilers(base, [{ i: cell.i }]), tag + ' 줄째가 이겨요');
        n++;
    }
    assert.ok(n > 600, '잰 판 ' + n);
});
await test('고른 글만 숨기기 값: cleanTune 이 { i, a, b, t } 를 지키고 망가진 값은 줄째 { i } 로 · 글이 밀리면 t 로 다시 찾고 · 못 찾으면 그대로 · 겹치면 뒤의 것은 빼요', async () => {
    const tun = await import(pathToFileURL(path.join(MART, 'tune.js')).href + '?v=20261112s');
    assert.deepEqual(tun.cleanTune({ spoilers: [{ i: 1, a: 2, b: 5, t: 'abc' }, { i: 1, a: 2, b: 5, t: 'abc' }, { i: 2, a: 5, b: 2, t: 'x' }, { i: 3 }] }).spoilers, [{ i: 1, a: 2, b: 5, t: 'abc' }, { i: 2 }, { i: 3 }]);
    assert.deepEqual(tun.cellText('가&amp;나<br>다<b>라</b>'), { text: '가&나다라', at: [0, 1, 6, 11, 15, 20] });
    assert.deepEqual(tun.spanIn('그는 비를 맞았다', { a: 3, b: 4, t: '비' }), { a: 3, b: 4 });
    assert.deepEqual(tun.spanIn('그 사람은 비를 맞았다', { a: 3, b: 4, t: '비' }), { a: 6, b: 7 });
    assert.equal(tun.spanIn('그는 눈을 맞았다', { a: 3, b: 4, t: '비' }), null);
    const html = '<style>\n.gk p{margin:0}\n</style><div class="gk"><p class="gk-nr">하나 둘 셋 넷</p></div>';
    const one = tun.applySpoilers(html, [{ i: 0, a: 3, b: 4, t: '둘' }]);
    assert.match(one, /<div class="gk-nr blsp-p">하나 <details class="blsp-s" data-bl-spoiler="[^"]*"[^>]*>[\s\S]*<span class="blsp-c">둘<\/span><\/details> 셋 넷<\/div>/);
    assert.equal(tun.applySpoilers(html, [{ i: 0, a: 3, b: 4, t: '열' }]), html, '못 찾으면 그대로');
    // 11-12 밤 글줄 안 숨긴 글은 문단 첫 줄 들여쓰기를 물려받지 않아요(낫표처럼 text-indent 가 있는 틀에서 숨긴 글 앞에 빈칸이 생겼어요 · 테마 f158b579c 와 같은 고침 · 화면은 tools/site-rig/spoiler-indent-check.mjs)
    assert.match(one, /<details class="blsp-s" data-bl-spoiler="[^"]*" style="display:inline-block;max-width:100%;vertical-align:baseline;text-indent:0">/);
    assert.match(tun.applySpoilers(html, [{ i: 0 }]), /<details class="blsp-s blsp-k" data-bl-spoiler="[^"]*" style="display:block;margin:8px 0">/, '줄 숨기기는 문단 꼴 그대로');
    assert.equal((fs.readFileSync(path.join(MART, 'lib/log-copy/log-copy-spoiler.js'), 'utf8').match(/vertical-align:baseline;text-indent:0'/g) || []).length, 2, '미리보기 · 고른 글 감싸기 둘 다');
    const two = tun.applySpoilers(html, [{ i: 0, a: 0, b: 4, t: '하나 둘' }, { i: 0, a: 3, b: 6, t: '둘 셋' }]);
    assert.equal((two.match(/<details/g) || []).length, 1, '겹치면 하나만');
    assert.equal(tun.applySpoilers('<style>\n</style><div class="gk"><p class="gk-nr">가<b>나다</b>라</p></div>', [{ i: 0, a: 0, b: 2, t: '가나' }]).includes('<details'), false, '꾸밈을 가로지르면 안 감싸요(화면이 줄째로 바꿔 넣어요)');
});
// 11-12 막대 단추 규칙(사용자 「굵게랑 기울임은 왜 있는 거임?」 · 「PC 는 없잖아」) — 테마 · 마트 · 폰 · PC 모두 같은 규칙
await test('고른 글 막대 단추: 평소엔 「눌러야 보이게 / 숨김 풀기」만 · 굵게 · 기울임은 「글 고치기」 모드에서만 · 폰 · PC 갈림 없음', async () => {
    const sh = await import(pathToFileURL(path.join(MART, 'select-hide.js')).href + '?v=20261112s');
    assert.deepEqual(sh.barKinds({ hide: true }), ['hide']);
    assert.deepEqual(sh.barKinds({ spoiler: true }), ['unhide']);
    assert.deepEqual(sh.barKinds({ hide: true, editing: true }), ['hide', 'bold', 'italic']);
    assert.deepEqual(sh.barKinds({ spoiler: true, editing: true }), ['unhide'], '숨긴 글 안에선 풀기만');
    assert.deepEqual(sh.barKinds({}), []);
    const src = fs.readFileSync(path.join(MART, 'select-hide.js'), 'utf8');
    assert.doesNotMatch(src, /coarse|ontouchstart|matchMedia|innerWidth|userAgent/, '폰 · PC 로 단추를 가르지 않아요');
    assert.ok(src.includes("barKinds({ hide: !!plan.add, editing: box.classList.contains('is-editing')"), '글 고치기 = 미리보기 is-editing');
    assert.ok(src.includes("if (kinds.includes('bold'))"), '굵게 · 기울임은 규칙을 거쳐서만');
    assert.equal((src.match(/execCommand\(/g) || []).length, 1, '굵게 · 기울임 명령은 규칙 안 한 곳뿐');
});
await test('능력표 G4(11-12 · tools/geulkku-caps.mjs → caps.json): 420틀 모두 한 줄 · 정적 칸이 지금 틀과 같음(띠는 화면에서 그림 띠로 내릴 수만) · 범위 칸 꼴 · 표에 없는 틀은 정적 검사', async () => {
    const cp = await import(pathToFileURL(path.join(MART, 'caps.js')).href + '?v=20261112a');
    const caps = JSON.parse(fs.readFileSync(path.join(DIR, 'caps.json'), 'utf8'));
    assert.equal(caps.v, 1); assert.deepEqual(caps.widths, [640, 375, 320]);
    const ids = Object.keys(allItems).map(id => id.replace(/^simple-/, ''));
    assert.deepEqual(Object.keys(caps.frames).sort(), ids.sort(), '틀 목록');
    for (const [id, it] of Object.entries(allItems)) {
        const k = id.replace(/^simple-/, ''), row = caps.frames[k], st = cp.capsStatic(sf.toneSimple(it.preview, sf.ORIGINAL, { mode: 'light' }));
        assert.ok(!row.unmeasured, k + ' 화면에서 잼');
        for (const f of ['bg', 'border', 'radius', 'underline']) assert.equal(row[f], st[f], `${k} ${f}`);
        assert.ok(row.band === st.band || (st.band === 'color' && row.band === 'image'), k + ' 띠');
        assert.ok(row.pad === false || (row.pad[0] >= 70 && row.pad[1] <= 130 && row.pad[0] < row.pad[1]), k + ' 여백');
        assert.ok(row.width === false || (row.width.at(-1) <= 640 && row.width.every(w => [480, 560, 640].includes(w) || w === row.width.at(-1))), k + ' 폭');
        assert.ok(row.title === false || (row.title.max >= 20 && row.title.max <= 28), k + ' 제목');
        assert.equal(row.motion.speed, !!st.motion.speed, k + ' 빠르기');
    }
    const cnt = f => Object.values(caps.frames).filter(f).length;
    assert.ok(cnt(x => x.band === 'color') > 350 && cnt(x => x.pad) > 360 && cnt(x => x.hideProp) > 300, '되는 틀 수');   // 11-12 다시 뽑기: 소품 자리 (나) 뒤 여백 범위를 못 받는 틀이 늘어 404 → 369
    cp.setCapsTable(caps.frames);
    assert.equal(cp.capsOf({ simple: true, preview: allItems['simple-k1079'].preview }), caps.frames.k1079);
    assert.equal(cp.capsOf({ simple: true, own: true, preview: allItems['simple-k1079'].preview }).unmeasured, true, '내 글꾸는 정적');
    assert.equal(cp.capWhy(caps.frames.k13, 'band'), '이 틀은 대사 띠를 그림으로 그어요');
    assert.equal(cp.capWhy(caps.frames.k1079, 'band'), '');
});
await test('모양 · 색 더하기(N5 · N8 · N12 ~ N18 · N23 · shape.js): 값이 없으면 한 글자도 안 달라요 · 420틀 × 낮밤 가장 큰 값 → 덮는 규칙만(<style> 하나 · 뼈대 그대로 · 정적 검사) · 띠 진하기는 알파만 · 화자별 띠 색 · 못 받는 칸은 건너뜀', async () => {
    const sh = await import(pathToFileURL(path.join(MART, 'shape.js')).href + '?v=20261112a');
    const MAX = { bandAlpha: 40, borderAlpha: 30, radius: 24, pad: 130, width: 480, nameTag: 'pill', nameAlign: 'right', hideUl: true, hideProp: true };
    assert.deepEqual(sh.cleanShape({ bandAlpha: 99, pad: 133, width: 640, nameTag: 'plain', hideProp: false, x: 1 }), { bandAlpha: 40, pad: 130 });
    assert.equal(sh.cleanShape({ width: 640 }), null);
    let n = 0;
    for (const [id, it] of Object.entries(allItems)) for (const mode of ['light', 'dark']) {
        const p = sf.toneSimple(it.preview, '#3aa7ff', { mode, other: '#ff5fa2' });
        assert.equal(sh.applyShape(p, null, null), p, id);
        const o = sh.applyShape(p, MAX, { card: '#123456', bandMain: '#00ff88', bandOther: '#8800ff', underline: '#ff8800' });
        assert.equal((o.match(/<style>/g) || []).length, 1, id);
        assert.equal(o.slice(o.indexOf('</style>')), p.slice(p.indexOf('</style>')), id + ' 뼈대 그대로');
        const was = new Set(styleOf(p).split('\n')), add = styleOf(o).split('\n').filter(l => l && !was.has(l));
        assert.ok(add.every(l => /^\.gk-((?:k|q)\d+)\.gk-\1/.test(l)), id + ' 겹친 열쇠');
        const i = sh.shapeInfo(p);
        if (i.bands.length) { n++; assert.ok(add.some(l => /\.gk-d[A-Z]\{background-color:rgba\(0,255,136,0\.4\)\}$/.test(l)), id + ' 깡통 띠'); }
        if (n % 60 === 1 && mode === 'light') assert.ok(tg.readyReport(sf.simpleReady(shutPeek(o))).ok, id + ' 정적 검사');
    }
    assert.ok(n > 780, '띠 ' + n);
    const k = sf.toneSimple(allItems['simple-k1079'].preview, sf.ORIGINAL, { mode: 'light' });
    assert.match(sh.applyShape(k, { bandAlpha: 30 }), /\.gk-d[AB]\{background-color:rgba\(\d+,\d+,\d+,0\.3\)\}/, '알파만');
    assert.equal(sh.applyShape(k, MAX, null, { band: false, bg: false, border: false, radius: false, pad: false, width: false, nameTag: false, underline: false, hideProp: false }), k, '못 받는 칸은 건너뜀');
    assert.match(sh.applyShape(k, { hideProp: true }), / \.gk-kx \*\{visibility:hidden!important;pointer-events:none\}/);   // 열어 두기의 div 꼴에도 먹게 class 만
});
await test('움직임 빠르기 · 처음부터 열어 두기(N3 · N4 · 마트가 걺): 기본이면 그대로 · 느리게 = 뿌리 gk-gs-s + 길이 낱말만 ×1.3(3.5초 상한) · 빠르게 ×0.75 · 열어 두기 = details.gk-kx 에 open · <style> 하나 · 정적 검사', async () => {
    const ms = await import(pathToFileURL(path.join(MART, 'motion-state.js')).href + '?v=20261112a');
    assert.deepEqual(ms.SPEEDS.map(x => x[1]), ['느리게', '보통', '빠르게']);
    let sp = 0, op = 0;
    for (const [id, it] of Object.entries(allItems)) {
        const p = it.preview;
        assert.equal(ms.applyMotion(p, { speed: 'm', open: false }), p, id);
        const s = ms.applyMotion(p, { speed: 's' }), l = ms.applyMotion(p, { speed: 'l' }), c = ms.motionCaps(p);
        if (c.speed) {
            sp++; assert.match(s.match(/^<div[^>]*>/)[0], /gk-gs-s"/); assert.match(l.match(/^<div[^>]*>/)[0], /gk-gs-l"/);
            const was = new Set(styleOf(p).split('\n')), add = styleOf(s).split('\n').filter(l => l && !was.has(l));
            const inl = s.slice(s.indexOf('</style>')) !== p.slice(p.indexOf('</style>'));   // 11-12 인라인 움직임(13틀)은 그 값 자리만 같은 배
            if (inl) { const ti = h => [...h.matchAll(/style="[^"]*"/g)].map(m => m[0]).join('|'); assert.notEqual(ti(s), ti(p), id + ' 인라인'); assert.equal(s.slice(s.indexOf('</style>')).replace(/style="[^"]*"/g, ''), p.slice(p.indexOf('</style>')).replace(/style="[^"]*"/g, ''), id + ' 인라인 말고는 그대로'); }
            assert.ok((add.length || inl) && add.every(x => /^[^{]*\.gk-gs-s[^{]*\{(?:(?:animation|transition)-(?:duration|delay):[-\d.,s]+;?)+\}$/.test(x)), id + ' 길이 낱말만');
            assert.equal((s.match(/<style>/g) || []).length, 1, id);
            if (sp % 80 === 1) assert.ok(tg.readyReport(sf.simpleReady(shutPeek(s))).ok, id + ' 정적 검사');
        } else assert.equal(s, p, id);
        const o = ms.applyMotion(p, { open: true });
        if (c.open) {   // 11-12 깡통 118 뒤: open 속성에 기대지 않는 꼴(div.gk-det · div.gk-sum · .gk-kx[open] → .gk-kx.gk-det)
            const cnt = (h, re) => (h.match(re) || []).length, kx = cnt(p, /<details class="gk-kx"/g);
            op++; assert.ok(!/<details class="gk-kx"/.test(o) && cnt(o, /<summary\b/g) === cnt(p, /<summary\b/g) - kx && cnt(o, /<figure class="gk-kx gk-det"/g) === kx, id + ' 누름 칸이 figure(다른 details · 정보 탭은 그대로)');
            assert.match(o.match(/^<div[^>]*>/)[0], /gk-op"/); assert.ok(!/\.gk-kx\[open\]/.test(o.slice(0, o.indexOf('</style>'))), id + ' 열린 규칙');
            assert.equal(o.replace(/\sopen(?:="[^"]*")?(?=[\s>])/g, ''), o.replace(/(<figure class="gk-kx gk-det"[^>]*)\sopen(?:="[^"]*")?(?=[\s>])/g, '$1').replace(/\sopen(?:="[^"]*")?(?=[\s>])/g, ''), id);
            const tags = s => (o.match(new RegExp(`<${s}\\b`, 'g')) || []).length - (o.match(new RegExp(`</${s}>`, 'g')) || []).length;
            assert.equal(tags('div'), 0, id + ' div 짝'); assert.equal(tags("details"), 0, id + " details 짝"); assert.equal(tags("figure"), 0, id + " figure 짝"); assert.equal(tags("figcaption"), 0, id + " figcaption 짝"); assert.equal(cnt(o, /<figcaption\b/g), kx, id + " figcaption 수");
            if (op % 60 === 1) assert.ok(tg.readyReport(sf.simpleReady(shutPeek(o))).ok, id + ' 정적 검사');
        }
        else assert.equal(o, p, id);
    }
    assert.ok(sp > 400 && op > 380, `빠르기 ${sp} · 열어 두기 ${op}`);
    assert.match(ms.applyMotion(allItems['simple-k1079'].preview, { speed: 's' }), /animation-duration:1\.3s/);
});
await test('제목 글 모양(N19) · 대사 줄 간격 · 들여쓰기(N20 · N21): 글 모양 칸 · 다듬기 · 규칙(.gk-tt · p.gk-dl · 세 겹) · 값 없으면 그대로', () => {
    const L = lk.cleanLook({ title: { size: 40, weight: 650, letterSpacing: 3, align: 'center' }, fonts: { title: 'serif' }, dialogue: { lineHeight: 2.5, indent: false } });
    assert.deepEqual(L, { title: { size: 28, weight: 650, letterSpacing: 3, align: 'center' }, fonts: { title: 'serif' }, dialogue: { lineHeight: 2.2, indent: false } });
    const p = allItems['simple-k1079'].preview, o = lk.applyLook(p, L);
    assert.match(o, /\.gk-k1079\.gk-k1079\.gk-k1079 \.gk-tt\{font-family:[^}]*;font-size:28px;line-height:1\.4;font-weight:650;letter-spacing:0\.03em;text-align:center\}/);
    assert.match(o, /\.gk-k1079\.gk-k1079\.gk-k1079 p\.gk-dl\{line-height:2\.2;text-indent:0\}/);
    assert.equal(lk.applyLook(p, null), p);
    assert.ok(lk.LOOK_FIELDS.some(f => f.tab === 'title' && f.path === 'title.size' && f.cap === 'title'));
});
await test('새 조절 잇기(⑥): 다시 칠하기 → 모양 → 글 모양 차례 · 능력표로 못 받는 칸은 건너뜀 · 낱낱 바탕 색 넷은 tune.inks 에 · 추천 스타일 모양 · 내 스타일 · 완성 프리셋에 모양 · 움직임 · 세밀 칸(띠 · 테두리 · 카드 · 이름표 · 밑줄 · 소품 숨김 · 빠르기 · 열어 두기 · 자동 · 제목)', async () => {
    const ts = fs.readFileSync(path.join(MART, 'tone-state.js'), 'utf8'), ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
    assert.ok(/applyShape\(toneSimple\(applyMine\(html\)[\s\S]*?sp\.gate\); const shaped = applyLook\(out, lookFor\(sp\.caps\)\)/.test(ts), '다시 칠하기 → 모양 → 글 모양');
    assert.ok(ts.includes('shapeRev(), toneState.auto, capsRev(), toneState.flip]'), '다시 그리기 열쇠');
    assert.deepEqual(tu.cleanTune({ inks: { light: { card: '#ABCDEF', bandMain: '#112233', bandOther: 'x', underline: '#00ff00' } } }), { inks: { light: { card: '#abcdef', bandMain: '#112233', underline: '#00ff00' } } });
    const sh = await import(pathToFileURL(path.join(MART, 'shape.js')).href + '?v=20261112a');
    const { LOOKS } = await import(pathToFileURL(path.join(MART, 'looks.js')).href + '?v=20261112a');
    for (const x of LOOKS) assert.deepEqual(sh.cleanShape(x.shape), x.shape, x.id + ' 모양 다듬어도 같음');
    const p = lk.cleanPreset({ name: '하나', look: { type: { weight: 500 } }, shape: { radius: 16, nameTag: 'pill' } });
    assert.deepEqual(p.shape, { radius: 16, nameTag: 'pill' });
    const row = tu.saveMine({ frame: 'simple-k1079', name: '모양 시험', tone: { mode: 'dark', auto: true }, tune: null, look: null, shape: { bandAlpha: 30 }, motion: { text: 'm', prop: 's', speed: 'l', open: true } });
    assert.deepEqual([row.shape, row.motion, row.auto], [{ bandAlpha: 30 }, { text: 'm', prop: 's', speed: 'l', open: true }, true]);
    tu.forgetMine(row.id);
    for (const w of ['data-shape="', 'data-shape-num="', 'data-shape-pick="', 'data-shape-reset', 'data-motion-speed', 'data-motion-open', 'data-tune-mode="auto"', "['title', '제목']", "shapeBlock(['radius', 'pad', 'width', 'noBorder'], cp, '카드')", "shapeBlock(['nameTag', 'nameAlign'], cp, '이름표')", "shapeBlock(['hideProp']", "shapeBlock(['bandAlpha', 'borderAlpha']"]) assert.ok(ui.includes(w), w);
    // 숫자 칸 2열: 모양 숫자 칸도 이어진 칸이 홀수면 마지막만 전체 폭
    assert.ok(ui.includes('html.push(shapeFieldHtml(fields[k], caps, (j - i) % 2 === 1 && k === j - 1))'));
    // 칸 꼴: header(이름 → ↺ → 숫자 + 단위) 다음에 슬라이더
    const cell = ui.slice(ui.indexOf('function shapeFieldHtml'), ui.indexOf('function shapeBlock'));
    const order = ['<div class="mart-param', '<header>', 'class="mart-param-name"', "undoBtn('data-shape-reset'", '<span class="mart-num"><input type="number"', 'class="mart-unit"', '</header>', '<input type="range"'].map(x => cell.indexOf(x));
    assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), `칸 차례 ${order}`);
});
await test('설정 파일 .bl-geulkku.json · 코드 BLG1.(⑦ · 설계 4-7 · 5절): 코드 왕복(BLG1. 줄임 · BLG0. 그대로) · 파일 한 벌 · 여러 벌 · 옛 꼴 올리기(BLM1. · BLS0. · BLS1. · .bl-mart-set.json · bl-mart 꾸러미) · 틀린 글은 null · 화면 단추', async () => {
    const gs = await import(pathToFileURL(path.join(MART, 'geulkku-set.js')).href + '?v=20261112a');
    const tone = { on: true, k: '#3aa7ff', name: '가브리엘', k2: '#ff5fa2', name2: '아스모데우스', mode: 'light', cover: true };
    const set = gs.makeSet({ tone, look: { type: { weight: 500 }, title: { size: 24 } }, motion: { text: 's', prop: '0', speed: 'l', open: true }, shape: { bandAlpha: 30, radius: 8, nameTag: 'pill' }, tex: { tex: 'line', on: 'b', level: 3, margin: true }, tune: { vals: { 호감도: 70 }, inks: { light: { card: '#fafafa' } } }, frame: 'simple-k1079', label: '비 오는 날' });
    const code = await gs.encodeSet(set);
    assert.match(code, /^BLG1\.[A-Za-z0-9_-]+$/);
    assert.ok(code.length < JSON.stringify(set).length, '줄었어요 ' + code.length);
    assert.deepEqual(await gs.decodeCode(code), set);
    const raw0 = `BLG0.${Buffer.from(JSON.stringify(set)).toString('base64url')}`;
    assert.deepEqual(await gs.decodeCode(raw0), set, 'BLG0.');
    assert.deepEqual((await gs.readAny(` ${code}\n`)).set, set);
    assert.equal((await gs.readAny(code)).from, 'code');
    const back = gs.readSet((await gs.readAny(code)).set);
    assert.deepEqual([back.frame, back.tune.vals, back.tune.inks, back.shape, back.motion, back.tex, back.name], ['k1079', { 호감도: 70 }, { light: { card: '#fafafa' } }, { bandAlpha: 30, radius: 8, nameTag: 'pill' }, { text: 's', prop: '0', speed: 'l', open: true }, { tex: 'line', on: 'b', level: 3, margin: true }, '비 오는 날']);
    // 파일
    assert.deepEqual(JSON.parse(gs.setFile(set)), set);
    const two = JSON.parse(gs.setFile([set, gs.makeSet({ tone: { on: false, mode: 'dark' } })]));
    assert.equal(two.blGeulkku, 2); assert.equal(two.sets.length, 2);
    assert.deepEqual((await gs.readAny(gs.setFile([set, set]))).set, set, '여러 벌이면 첫 벌');
    assert.equal(gs.SET_EXT, '.bl-geulkku.json');
    // 옛 꼴
    const blm = lk.exportPreset({ name: '옛 스타일', tone: { on: true, k: '#7fe03c', name: '우리엘' }, look: { type: { weight: 600 } }, shape: { radius: 4 } });
    const g1 = await gs.readAny(blm);
    assert.equal(g1.from, 'old'); assert.equal(g1.set.name, '옛 스타일'); assert.deepEqual(g1.set.style.cast.main, { name: '우리엘', color: '#7fe03c' }); assert.deepEqual(g1.set.style.look, { type: { weight: 600 } }); assert.deepEqual(g1.set.style.shape, { radius: 4 });
    const theme = { saltyStyle: 1, style: { type: { size: 17, lineHeight: 1.9 } } };
    const bls0 = `BLS0.${Buffer.from(JSON.stringify(theme)).toString('base64url')}`;
    assert.equal((await gs.readAny(bls0)).from, 'theme');
    const z = await new Response(new Blob([JSON.stringify(theme)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    const g3 = await gs.readAny(`BLS1.${Buffer.from(z).toString('base64url')}`);
    assert.deepEqual(g3.set.style.look, { type: { size: 17, lineHeight: 1.9 } }, 'BLS1.');
    const mineFile = tu.setsFile([{ frame: 'simple-k1079', frameName: '호감도 게이지', name: '완성', tone: { on: false, mode: 'dark', k2: '#ff5fa2' }, tune: { vals: { 호감도: 40 } }, look: null, shape: { pad: 120 } }]);
    const g4 = await gs.readAny(mineFile);
    assert.equal(g4.from, 'old'); assert.equal(g4.set.frame, 'k1079'); assert.deepEqual(g4.set.frames.k1079.vals, { 호감도: 40 }); assert.deepEqual(g4.set.style.shape, { pad: 120 });
    const pack = { 'bl-mart': 1, items: [{ kind: 'geulkku-simple', v: 1, id: 'simple-k1079', key: 'k1079', html: '<div class="gk">x</div>', set }] };
    assert.deepEqual((await gs.readAny(JSON.stringify(pack))).set, set, '꾸러미');
    for (const bad of ['', '아무 글', 'BLG1.@@@', 'BLG1.AAAA', '{"x":1}', '[1]']) assert.equal(await gs.readAny(bad), null, bad);
    const ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
    for (const w of ['data-setx="file"', 'data-setx="pick"', 'data-setx="code"', 'data-setx="paste"', 'data-setx="apply"', 'mart-setx-file', 'takeSet(item, got)', 'encodeSet(setNow(item))']) assert.ok(ui.includes(w), w);
});
await test('움직임 세기 사본(⑧ · 정본 22:20 판): 브라우저에서 돌아요(맨 위 줄에 process · require · module 없음 · 노드 전용 줄은 globalThis.process?.) · 상한 표 17줄 마트 열쇠 · 중은 420틀 그대로', async () => {
    const src = fs.readFileSync(path.join(MART, 'lib/motion/motion.js'), 'utf8');
    const code = src.split('\n').filter(l => !/^\s*(\/\/|\/\*\*|\*)/.test(l));
    assert.ok(!code.some(l => /(?<![\w.?])process\.|\brequire\(|module\.exports/.test(l)), '노드 전용 이름');
    const mo = await import(pathToFileURL(path.join(MART, 'lib/motion/motion.js')).href);
    assert.equal(Object.keys(mo.CAP).length, 17); assert.ok(Object.keys(mo.CAP).every(k => /^k\d+$/.test(k) && allItems['simple-' + k]), '마트 열쇠');
    for (const [id, it] of Object.entries(allItems)) assert.equal(mo.applyLevel(it.preview, { text: 'm', prop: 'm', key: id.slice(7) }), it.preview, id);
});
await test('깡통 118 뒤 고침: ① 빠르기가 인라인 움직임 · 계속 도는 반복까지 같은 배(반복은 3.5초 상한 없음) ② 열어 두기는 open 속성 없이(figure 꼴) ⑨ 약 · 강이 중과 같아 보이는 틀은 칩을 안 줘요(정본 화면 재기 FELT)', async () => {
    const ms = await import(pathToFileURL(path.join(MART, 'motion-state.js')).href + '?v=20261112a');
    const k1 = ms.applyMotion(allItems['simple-k1'].preview, { speed: 's' }), q = ms.applyMotion(allItems['simple-q01'].preview, { speed: 's' });
    assert.match(k1, /style="animation:gk-dl 0\.455s ease-out 0\.26s both"/, 'k1 대사 줄 .35s → .455s · 늦춤 .2s → .26s');
    assert.match(q, /style="animation:gk-q-wv1 11\.7s linear 0s infinite"/, 'q01 반복 9s → 11.7s(상한 없음)');
    assert.match(ms.applyMotion(allItems['simple-q01'].preview, { speed: 'l' }), /gk-q-wv1 6\.75s linear 0s infinite/);
    const c79 = ms.motionCaps(allItems['simple-k1079'].preview), c41 = ms.motionCaps(allItems['simple-k1441'].preview);
    assert.deepEqual([c79.text.s, c79.text.l, c79.prop.s, c79.prop.l, c79.prop[0]], [true, true, false, false, true], 'k1079 글은 약 · 강 · 소품은 끔만');
    assert.deepEqual([c41.text.s, c41.prop.s, c41.prop.l], [false, false, false], 'k1441 끔과 중만');
    assert.equal(ms.applyMotion(allItems['simple-k1441'].preview, { text: 's', prop: 'l' }), allItems['simple-k1441'].preview, '느낄 수 없는 세기는 걸지 않아요');
    const o = ms.applyMotion(allItems['simple-k1079'].preview, { open: true });
    assert.ok(o.includes('<figure class="gk-kx gk-det"') && o.includes('<figcaption class="gk-pb"') && o.includes('\n.gk figure{margin:0}') && !/\[open\]/.test(o.slice(0, o.indexOf('</style>')).replace(/details\[open\]|details:not\(\[open\]\)/g, '')), 'figure 꼴 · .gk-kx[open] 없음');
    assert.ok(fs.readFileSync(path.join(ROOT, 'tools/geulkku-open-check.mjs'), 'utf8').includes('open 속성을 다 지움'), '깡통 흉내 화면 재기 도구');
});
// ── 11-12 AI 점검(지시-1112/마트-AI-점검/보고.md) — 결함 하나에 시험 하나 ──
const srcOf = f => fs.readFileSync(path.join(MART, f), 'utf8');
await test('AI 점검 ① 깨진 주소 해시(#% · #100% · 잘린 #%E0%A4%A)에도 목록이 안 덮여요 — 글꾸 마트 · 액자 마트 hashId', () => {
    for (const f of ['mart.js', 'frame-room.js']) {
        const s = srcOf(f);
        assert.ok(!/decodeURIComponent\(location\.hash/.test(s), `${f}: 해시를 바로 풀지 않아요`);
        const fn = (0, eval)(s.match(/const hashId = (\(hash = location\.hash\) => \{[^\n]+\});/)[1].replace('location.hash', "''"));
        for (const bad of ['#%', '#100%', '#%E0%A4%A', '#%zz']) assert.equal(fn(bad), '', `${f} ${bad}`);
        assert.equal(fn('#simple-k1'), 'simple-k1'); assert.equal(fn('#%ED%95%9C'), '한'); assert.equal(fn(''), '');
    }
});
await test('AI 점검 ② 말풍선 · 날아가는 그림은 열린 모달 창(크게 보기 · 맞춰 보기 · 시식) 안에 띄워요 — body 면 맨 위 층 창에 가려요', () => {
    const s = srcOf('cart.js');
    const isModal = (0, eval)(s.match(/const isModal = (d => \{[^\n]+\});/)[1]);
    const layerHost = (0, eval)(`(isModal => ${s.match(/export (function layerHost\(doc = document\) \{[\s\S]*?\n\})/)[1].replace('doc = document', 'doc')})`)(isModal);
    const dlg = (name, modal = true) => ({ name, matches: q => (q === ':modal' ? modal : false), closest: () => null });
    const doc = (open, active = null) => ({ body: { name: 'body' }, activeElement: active, querySelectorAll: () => open });
    assert.equal(layerHost(doc([])).name, 'body', '창이 없으면 body');
    const a = dlg('sheet'), b = dlg('taste'), loose = dlg('loose', false);
    assert.equal(layerHost(doc([a])).name, 'sheet');
    assert.equal(layerHost(doc([a, b])).name, 'taste', '여럿이면 뒤에 연 것(문서 차례 끝)');
    assert.equal(layerHost(doc([loose])).name, 'body', '모달 아닌 창은 맨 위 층이 아니에요');
    assert.equal(layerHost(doc([a, b], { closest: () => a })).name, 'sheet', '누른 단추가 든 창이 먼저');
    assert.match(s, /export function say\(text, ms = 2400\) \{\n\s+const host = layerHost\(\); if \(bubble\.parentNode !== host\) host\.append\(bubble\);/);
    assert.ok(s.includes('layerHost().append(dot);') && !s.includes('document.body.append(dot)'), '날아가는 그림도');
});
await test('AI 점검 ③ 글만 복사 · 테마용 복사 · 설정 코드 복사는 누른 순간에 클립보드를 열어요(사파리) · 대체 복사 칸은 열린 창 안에', async () => {
    const ms = srcOf('mart.js'), tu = srcOf('tune-ui.js');
    const src = ms.match(/\nasync function clipText\(text\) \{[\s\S]*?\n\}/)[0];
    const make = (0, eval)(`(navigator, document, layerHost) => { return ${src.trim()}; }`);
    const had = globalThis.ClipboardItem;
    try {
        let wrote = null, order = [];
        globalThis.ClipboardItem = class { constructor(o) { this.o = o; } };
        const nav = { clipboard: { write: async ([it]) => { order.push('write'); wrote = await (await it.o['text/plain']).text(); } } };
        const clip = make(nav, null, null);
        let resolve; const job = new Promise(r => { resolve = r; });
        const done = clip(job); order.push('after-call');
        assert.deepEqual(order, ['write', 'after-call'], '글을 기다리기 전에 클립보드를 열어요');
        resolve('글'); assert.equal(await done, true); assert.equal(wrote, '글');
        // 막히면 숨은 글 칸 — 열린 창(layerHost) 안에 붙여요
        const nav2 = { clipboard: { write: async () => { throw new Error('막힘'); } } };
        let host = null; const area = { focus() {}, select() {}, setSelectionRange() {}, remove() {}, style: {} };
        const doc = { createElement: () => area, execCommand: () => true };
        assert.equal(await make(nav2, doc, () => ({ append: (a) => { host = a; } }))('x'), true); assert.equal(host, area);
        // 글을 못 만들면 그 오류를 던져요
        await assert.rejects(make(nav2, doc, () => ({ append() {} }))(Promise.reject(new Error('조각'))), /조각/);
    } finally { globalThis.ClipboardItem = had; }
    const body = name => ms.match(new RegExp(`\\nasync function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`))[0];
    for (const f of ['copyText', 'themeTake']) { assert.ok(body(f).includes('clipText('), f); assert.ok(!body(f).includes('clipboard.writeText'), `${f}: await 뒤 writeText 없음`); }
    assert.ok(!/document\.body\.append\(area\)/.test(ms), '대체 복사 칸은 layerHost 에');
    assert.match(ms, /say, clip: clipText \}\);/); assert.match(tu, /const job = encodeSet\(setNow\(item\)\), copied = \(clip \? clip\(job\)/);
    assert.match(ms, /layerHost \} from '\.\/cart\.js\?v=(\d+[a-z])'/); assert.notEqual(ms.match(/cart\.js\?v=(\w+)/)[1], '20261109a', 'cart.js 판 꼬리를 올려요(옛 캐시 cart.js 에는 layerHost 가 없어요)');
});
await test('AI 점검 ④ 장바구니 줄을 지금 그 마트 페이지에서 누르면 창이 열려요(해시만 바뀌면 hashchange) · 다른 페이지면 넘어가요', () => {
    const s = srcOf('cart.js');
    const goTo = (0, eval)(`(${s.match(/export (function goTo\(href, loc = location, win = globalThis\) \{[\s\S]*?\n\})/)[1].replace('loc = location, win = globalThis', 'loc, win')})`);
    const run = (href, at) => { const ev = []; const u = new URL(at), loc = { origin: u.origin, pathname: u.pathname, search: u.search, href: at }; const win = { history: { replaceState: (a, b, h) => ev.push(`hash ${h}`) }, dispatchEvent: e => ev.push(e.type) }; const r = goTo(href, loc, win); return { r, ev, href: loc.href }; };
    const A = 'https://x.github.io/blue-lemonade/mart/';
    let o = run(`${A}geulkku/#simple-k1`, `${A}geulkku/`);
    assert.equal(o.r, 'same'); assert.deepEqual(o.ev, ['hash #simple-k1', 'hashchange']);
    o = run(`${A}geulkku/#simple-k1`, `${A}geulkku/#simple-k1`); assert.deepEqual(o.ev, ['hash #simple-k1', 'hashchange'], '같은 해시여도 다시 열어요');
    o = run(`${A}frames/#f1`, `${A}geulkku/`); assert.equal(o.r, 'go'); assert.equal(o.href, `${A}frames/#f1`); assert.deepEqual(o.ev, []);
    o = run(`${A}geulkku/#simple-k1`, `${A}geulkku/?view=1`); assert.equal(o.r, 'go', '주소 꼬리가 다르면 넘어가요');
    assert.ok(s.includes('close(); goTo(row.dataset.href); return;'));
    for (const [f, open] of [['mart.js', 'openSheet'], ['frame-room.js', 'openRoom']]) assert.ok(srcOf(f).includes(`addEventListener('hashchange', () => { const id = hashId(), it = id && items.find(x => x.id === id); if (it) ${open}(stateOf(it)); });`), f);
});
await test('AI 점검 ⑤ 액자 맞춰 보기 두 손가락 확대: 둘째 손가락이 액자 옆 빈 무대에 닿아도 확대돼요(첫 손가락만 액자 위면)', () => {
    const s = srcOf('frame-room.js');
    const src = s.match(/\nfunction wireStage\(stage\) \{[\s\S]*?\n\}/)[0];
    const make = (0, eval)(`(view, spec, clamp, paintView, saveView, room, syncRoomControls, slackOf) => { ${src}; return wireStage; }`);
    const view = { x: 50, y: 50, zoom: 100 }, spec = { sliders: [{ key: 'zoom', min: 50, max: 400 }] };
    const on = {}, frameEl = { getBoundingClientRect: () => ({ width: 200, height: 300 }) };
    const stage = { addEventListener: (t, f) => { on[t] = f; }, setPointerCapture() {}, querySelector: () => frameEl };
    make(view, spec, (n, lo, hi) => Math.max(lo, Math.min(hi, n)), () => {}, () => {}, { open: false }, () => {}, () => null)(stage);
    const ev = (id, x, y, inFrame) => ({ pointerId: id, clientX: x, clientY: y, target: { closest: q => (q === '.room-frame' && inFrame ? frameEl : null) }, preventDefault() {} });
    on.pointerdown(ev(1, 100, 100, true));
    on.pointerdown(ev(2, 200, 100, false));   // 둘째 손가락은 액자 밖 빈 무대
    on.pointermove(ev(2, 300, 100, false));   // 두 손가락 사이 100 → 200
    assert.equal(view.zoom, 200, '두 배로 벌리면 확대 두 배');
    on.pointerup(ev(1)); on.pointerup(ev(2));
    on.pointerdown(ev(3, 10, 10, false)); on.pointermove(ev(3, 60, 10, false));
    assert.equal(view.zoom, 200); assert.equal(view.x, 50, '첫 손가락이 액자 밖이면 그대로(빈 무대 끌기 없음)');
});
await test('AI 점검 ⑥ 액자 내 사진을 빠르게 두 번 고르거나 줄이는 동안 표본 사진을 고르면 마지막 것만 남아요', async () => {
    const s = srcOf('frame-room.js');
    assert.match(s, /let photoSeq = 0;[^\n]*\nfunction setPhoto\(url, label, own\) \{\n {4}photoSeq\+\+;/);
    const use = s.match(/\nasync function usePhotoFile\(file\) \{[\s\S]*?\n\}/)[0];
    const make = (0, eval)(`(shrink, api, document, URL, photo, shown) => { let photoSeq = 0; const setPhoto = (url, label) => { photoSeq++; shown.push(label); }; ${use}; return { usePhotoFile, pickSample: l => setPhoto('', l) }; }`);
    const gate = {}, shrink = f => new Promise(r => { gate[f.name] = () => r({ name: f.name }); });
    const shown = [], k = make(shrink, { say() {} }, { querySelector: () => null }, { createObjectURL: b => b.name }, {}, shown);
    const a = k.usePhotoFile({ name: 'a.jpg', type: 'image/jpeg' }), b = k.usePhotoFile({ name: 'b.jpg', type: 'image/jpeg' });
    gate['b.jpg'](); await b; gate['a.jpg'](); await a;
    assert.deepEqual(shown, ['b.jpg'], '늦게 끝난 앞 사진이 덮지 않아요');
    const c = k.usePhotoFile({ name: 'c.jpg', type: 'image/jpeg' }); k.pickSample('표본'); gate['c.jpg'](); await c;
    assert.deepEqual(shown, ['b.jpg', '표본'], '줄이는 동안 고른 표본 사진이 남아요');
});
await test('AI 점검 ⑦ 장바구니 계산하기 · 받기는 만드는 동안 다시 안 눌려요(그림 액자 PNG 를 만드는 몇 초 동안 겹쳐 돌았어요)', () => {
    const s = srcOf('cart.js');
    assert.match(s, /let pay = null, payBusy = false;/);
    const blk = s.match(/else if \(\(act === 'copy' \|\| act === 'file'\) && pay && entries\.length && !payBusy\) \{[\s\S]*?\n {4}\}/)[0];
    assert.ok(blk.indexOf('payBusy = true') < blk.indexOf('await pay('), '누르자마자 막아요');
    assert.match(blk, /b\.disabled = true/); assert.match(blk, /finally \{ payBusy = false; render\(\); \}/);
    assert.ok(srcOf('mart.js').includes("onCheckout((act, entries) => (act === 'copy' ? copyEntries(entries, true)"), '복사는 첫 await 전에 클립보드를 열어요(사파리)');
});
await test('AI 점검 판 꼬리: 이번에 고친 모듈(mart · cart · tune-ui · frame-room)을 부르는 곳은 모두 같은 새 꼬리예요(옛 캐시와 섞이지 않게 · 같은 모듈 두 벌 금지)', () => {
    const files = ['mart.js', 'geulkku/index.html', 'frames/index.html'].map(f => [f, srcOf(f)]);
    for (const mod of ['mart', 'cart', 'tune-ui', 'frame-room']) {
        const tails = new Set(files.flatMap(([, s]) => [...s.matchAll(new RegExp(`[./]${mod}\\.js\\?v=(\\w+)`, 'g'))].map(m => m[1])));
        assert.deepEqual([...tails], ['20261114a']   /* 11-14 UI 이모지 → 선 아이콘 — 넷 다 20261114a 로 */, `${mod}.js 꼬리 ${[...tails]}`);   // 11-13 저녁 그림 액자 다시 그린 판 — frame-room(D&H 인물 원작 · 찾기 말)을 고쳐 그것과 부르는 곳(mart · genie)을 r 로   // 11-13 간격 고침 3 · 해 · 달 파랑 · 깡통 문구 · 내 글꾸 판정을 올리며 다섯 다 p 로   // 11-12 점검 2 에서 mart · genie 를 c 로 · 스타일 고침에서 mart · genie · cart · tune-ui 를 d 로   // 11-13 줄바꿈 선택 — mart · tune-ui 를 고쳐 그 둘과 부르는 곳(genie)을 q 로
    }
});
await test('점검 2-③ 마트 모듈은 어디서 부르든 주소 하나(꼬리가 다르면 브라우저가 같은 모듈을 두 벌 받아요 — char-tone · spoiler · bare · presets 가 그랬어요 · 꼬리 없는 쪽은 옛 캐시가 남아요)', () => {
    const uses = new Map();
    const walk = (dir) => {
        for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, d.name);
            if (d.isDirectory()) { if (d.name !== 'data') walk(p); continue; }
            if (!/\.(?:js|html)$/.test(d.name)) continue;
            const text = fs.readFileSync(p, 'utf8');
            for (const m of text.matchAll(/(?:(?:import|export)\s[^;]*?from\s*|import\(\s*|<script[^>]*src=)(['"])(\.{1,2}\/[\w./-]+\.js)(\?[^'"]*)?\1/g)) {
                const to = path.relative(MART, path.resolve(path.dirname(p), m[2])).split(path.sep).join('/');
                if (!uses.has(to)) uses.set(to, new Set());
                uses.get(to).add(m[3] || '(꼬리 없음)');
            }
        }
    };
    walk(MART);
    const mixed = [...uses].filter(([, t]) => t.size > 1).map(([f, t]) => `${f}: ${[...t].join(' · ')}`);
    assert.deepEqual(mixed, []);
});
await test('점검 2-④ 홈: 깨진 % 주소(#% · #100%)에서도 「바로 열기」가 던지지 않아요(마트 hashId 와 같은 꼴)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'home-guide.js'), 'utf8');
    const body = src.match(/function revealTarget\(hash\)\{[\s\S]*?\n {2}\}/)[0];
    const calls = [...body.matchAll(/decodeURIComponent\(/g)].length, guarded = [...body.matchAll(/try\{return decodeURIComponent\(/g)].length;
    assert.ok(calls >= 1 && calls === guarded, '감싸지 않은 decodeURIComponent');
    const pick = (0, eval)(`(hash) => ${body.match(/hash==='#portraits'.*?\}\)\(\)(?=\);)/)[0]}`);
    for (const h of ['#%', '#100%', '#%E0%A4%A']) assert.equal(pick(h), '', h);
    assert.equal(pick('#start'), 'start'); assert.equal(pick('#' + encodeURIComponent('한눈에')), '한눈에');
    assert.match(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), /home-guide\.js\?v=20261114a/);   // 11-14 홈 영상 새로 찍기에서 꼬리 올림(20261112n → 20261114a)
});
// ── 11-12 「테마 아직 못 받음」 — 마트 판정(mart/theme-take.js · 목록 nt)이 테마 받기 검사(src/mart-import.js checkItem)와 420틀 모두 같아요 ──
{
    const tt = await imp(path.join(MART, 'theme-take.js'));
    const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/theme-takeable.json'), 'utf8'));
    const previews = {};
    for (const c of Object.values(sixAll.chunks)) Object.assign(previews, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
    const keyOf = html => sf.simpleFrameInfo(html)?.key || '';   // mart.js themeKey 와 같아요(조각 preview 뿌리 class)
    const judge = it => tt.themeTakeable(previews[it.id].preview, { id: it.id, key: keyOf(previews[it.id].preview) });
    // 11-13 마트 사본을 테마 1.2.0 판정으로 다시 옮겼어요 — 이제 「깐깐한 쪽」이 아니라 같아요(선언 글자 · 견본 맞대기는 tools/theme-take-test.mjs)
    await test('테마 못 받음 ① 고정 자료(tools/theme-takeable.json — 테마 1.2.0 받기 검사를 직접 돌려 뜬 것): 420틀 · 받음 402 · 못 받음 18 · 마트 사본 판정이 420틀 모두 같아요(까닭 글 · 짧은 까닭 nt 까지)', () => {
        assert.equal(sixAll.items.length, fixture.total); assert.equal(fixture.total, 420);
        assert.equal(fixture.ok.length, 402); assert.equal(Object.keys(fixture.no).length, 18);
        assert.deepEqual([...fixture.ok, ...Object.keys(fixture.no)].sort(), sixAll.items.map(x => x.id).sort());
        const ok = new Set(fixture.ok);
        const diff = sixAll.items.filter((it) => { const r = judge(it); return r.ok !== ok.has(it.id) || (!r.ok && (r.reason !== fixture.no[it.id] || r.why !== gen.shortWhy(fixture.no[it.id]))); }).map(it => it.id);
        assert.deepEqual(diff, [], '마트 사본 판정이 테마와 달라요');
        assert.equal(sixAll.items.filter(it => judge(it).ok).length, 402);
    });
    await test('테마 못 받음 ② 목록 index.json 의 nt = 고정 자료의 까닭(받는 틀엔 nt 없음 · 18틀) · 생성기가 고정 자료에서 써요', () => {
        const bad = sixAll.items.filter(it => (fixture.ok.includes(it.id) ? 'nt' in it : it.nt !== gen.shortWhy(fixture.no[it.id]))).map(it => it.id);
        assert.deepEqual(bad, []);
        assert.equal(sixAll.items.filter(it => it.nt).length, 18);
        for (const it of sixAll.items.filter(x => x.nt)) assert.ok(it.nt.length > 4 && !/마트의 「HTML 복사」/.test(it.nt), `${it.id} 짧은 까닭`);
        assert.equal(gen.takeOf('simple-없는틀', sample, 'k8').ok, tt.themeTakeable(sample, { id: 'simple-없는틀', key: 'k8' }).ok, '고정 자료에 없는 새 틀은 마트 사본 판정');
    });
    const themeDir = process.env.GK_THEME_DIR || path.resolve(ROOT, '../int-120');   // 테마 1.2.0 통합 분기(읽기만)
    if (fs.existsSync(path.join(themeDir, 'src/mart-import.js'))) {
        await test('테마 못 받음 ③ 테마 사본 checkItem 을 바로 돌려도 고정 자료와 420틀 같아요(받음 · 까닭 글자까지)', async () => {
            const { checkItem } = await imp(path.join(themeDir, 'src/mart-import.js'));
            const diff = [], ok = new Set(fixture.ok);
            for (const it of sixAll.items) {
                const html = previews[it.id].preview;
                const t = checkItem({ kind: 'geulkku-simple', v: 1, id: it.id, key: keyOf(html), name: it.name, emoji: it.emoji, html, set: { blGeulkku: 2 } });
                if (!!t.item !== ok.has(it.id) || (!t.item && t.reason !== fixture.no[it.id])) diff.push(`${it.id}: 고정 자료 ${ok.has(it.id) ? '받음' : fixture.no[it.id]} · 테마 ${t.reason || '받음'}`);
            }
            assert.deepEqual(diff, []);
        });
    } else console.log('건너뜀  테마 못 받음 ③ 테마 사본 바로 대조 — GK_THEME_DIR 가 없어요(고정 자료 대조 ①이 대신 지켜요)');
    await test('테마 못 받음 ④ 화면: 카드 꼬리표 · 크게 보기 「테마로 담기」 단추 막음 · 담기 함수도 막음 · 내 글꾸도 판정 · 지니 낡은 글 없음', () => {
        const mart = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8'), ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8');
        assert.match(mart, /\$\{own\}\$\{nt\}<\/span>/);
        assert.match(mart, /테마 아직 못 받음/);
        assert.match(mart, /async function themeTake\(state, file\) \{\n {4}const item = state\.item;\n {4}if \(item\.nt\)/);
        assert.match(mart, /themeTakeable\(x\.preview, \{ id: x\.id, key: themeKey\(x\) \}\)/);
        assert.match(ui, /data-act="theme-copy"\$\{no\}/);
        assert.match(ui, /data-act="theme-file"\$\{no\}/);
        for (const [n, t] of [['mart.js', mart]]) assert.doesNotMatch(t, /테마로 받기는 준비 중/, n);
        assert.match(fs.readFileSync(path.join(MART, 'mart.css'), 'utf8'), /\.tag\.is-notake\{/);
        for (const f of ['geulkku', 'frames', 'kara']) assert.match(fs.readFileSync(path.join(MART, f, 'index.html'), 'utf8'), /mart\.css\?v=20261114a/, f);
    });
}
// ── 11-13 본문 줄바꿈 「글자 단위」(기본) · 「단어 단위」 — 사용자 「단어 단위 할 건지 글자 단위 할 건지 선택 가능하게 … 난 글자 단위가 좋아서」 ──
await test('줄바꿈: 공용 함수는 테마 src/log-copy-wrap.js 와 같은 글 · 420틀 모두 글자 단위면 본문 줄만 normal(제목 · 이름표 그대로) · 단어 단위면 그대로 · 카드 · 크게 보기 · 복사 글이 한 길 · 테마로 담기에는 안 실어요', async () => {
    const ww = await imp(path.join(MART, 'word-wrap.js'));
    const copy = fs.readFileSync(path.join(MART, 'word-wrap.js'));
    assert.equal(crypto.createHash('sha256').update(copy).digest('hex'), 'be2579b33d3766427b921dc5f00a505e69d368e97abb617e7eb8ecbacf28056b', '마트 사본(mart/word-wrap.js)이 바뀌었어요 — 테마 src/log-copy-wrap.js 와 같이 고치고 두 시험의 값을 맞춰요');
    const styles = h => [...h.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
    const last = (css, sel) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m => m[1].trim() === sel).map(m => (m[2].match(/word-break:\s*([\w-]+)/) || [])[1]).filter(Boolean).pop();
    const all = {}; for (const c of Object.values(sixAll.chunks)) Object.assign(all, JSON.parse(fs.readFileSync(path.join(DIR, c.file), 'utf8')).items);
    let covered = 0;
    for (const it of sixAll.items) {
        const html = all[it.id].preview, key = sf.simpleFrameInfo(html).key, K = `.gk-${key}`, out = ww.wrapHtml(html, 'char'), before = styles(html), after = styles(out);
        assert.equal(ww.wrapHtml(html, 'word'), html, `${key} 단어 단위는 그대로`);
        if (last(before, `${K} .gk-tt`)) assert.equal(last(after, `${K} .gk-tt`), last(before, `${K} .gk-tt`), `${key} 제목`);
        if (/class="gk-nm\b/.test(html)) assert.notEqual(last(after, `${K} .gk-nm`), 'normal', `${key} 이름표`);
        const rows = ['gk-nr', 'gk-dl'].filter(c => new RegExp(`class="(?:[^"]*\\s)?${c}(?=[\\s"])`).test(html));
        if (last(before, `${K} p`) === 'keep-all' && rows.length) { assert.equal(last(after, rows.map(c => `${K} .${c}`).join(',')), 'normal', `${key} 본문 줄 덮개`); covered++; }
        for (const sel of [`${K} .gk-bb-o`]) if (last(before, sel) === 'keep-all') assert.equal(last(after, sel), 'normal', `${key} 말풍선`);
    }
    assert.ok(covered >= 400, `덮개가 달린 틀 ${covered}`);
    // 복사 길(simpleReady 뒤) · 「낮 · 밤 전환 넣기」(addToggle)를 지나도 덮개가 문단 규칙 뒤에 그대로 — 열 틀에 하나씩
    const dn = await imp(path.join(MART, 'day-night.js'));
    for (const it of sixAll.items.filter((_, i) => i % 10 === 0)) {
        const html = all[it.id].preview, K = `.gk-${sf.simpleFrameInfo(html).key}`, rows = ['gk-nr', 'gk-dl'].filter(c => new RegExp(`class="(?:[^"]*\\s)?${c}(?=[\\s"])`).test(html));
        if (!rows.length) continue;
        const flipped = styles(dn.addToggle(sf.simpleReady(ww.wrapHtml(html, 'char'))).html), cover = rows.map(c => `${K} .${c}`).join(',');
        assert.equal(last(flipped, cover), 'normal', `${it.id} 전환 뒤 덮개`);
        assert.ok(flipped.indexOf(`${cover}{`) > flipped.indexOf(`${K} p{`), `${it.id} 덮개는 문단 규칙 뒤`);
    }
    const martSrc = fs.readFileSync(path.join(MART, 'mart.js'), 'utf8'), ui = fs.readFileSync(path.join(MART, 'tune-ui.js'), 'utf8'), ws = fs.readFileSync(path.join(MART, 'wrap-state.js'), 'utf8');
    assert.ok(martSrc.includes('if (!raw || !toned(state.item)) return wrapOf(state, raw);') && martSrc.includes('return wrapOf(state, state.toneHtml);'), 'previewOf 한 길(카드 · 크게 보기 · 복사 글 · 붙일 곳 흉내)');
    assert.ok(/html: item\.preview \|\| '', set \}\] \};/.test(martSrc), '테마로 담기 값은 틀 원래 판 그대로(테마는 제 설정으로)');
    assert.equal((ui.match(/wrapChips\(\)/g) || []).length, 2, '간편 · 세밀(문단) 두 자리');
    assert.ok(ws.includes("wrapMode(globalThis.localStorage?.getItem(KEY))") && ws.includes("next === 'word' ? 'word' : ''"), '기본 글자 단위 · 단어 단위만 기억');
    for (const f of ['geulkku', 'frames']) assert.match(fs.readFileSync(path.join(MART, f, 'index.html'), 'utf8'), /mart\.js\?v=20261114a/, `${f} 꼬리`);
});

// ── 11-13 공개되는 주석 · 자료에 「만든 이 표시」가 다시 들어오지 않게(테마 tools/tests/no-maker-names.mjs 와 같은 꼴 셋) ──
//   잡는 꼴: 괄호 안 「이름 [판]」에 날짜 · 지시 번호가 같이 있거나 「이름 + 소수점 판」 하나뿐 · 「이름 + 가/이 + 만든 · 쓴 · 그린 · 설계 · 디자인 · 검토」 · 「만든 이 / … by + 이름」 · 작업 분기 이름
//   보는 곳: 마트 · 도구 · 홈의 js · css · html 주석 글자 + 지금 목록(index.json)이 가리키는 글꾸 조각 전체. 공지(release-notes.json) · 화면 글은 기능이라 안 봐요.
await test('만든 이 표시 없음: 주석(js · mjs · cjs · css · html)과 지금 쓰는 글꾸 조각에 모델 이름 + 날짜 · 작업 분기 이름이 없어요 · 기능 글(모델 목록 · 가격 · 칸 값)은 지나가요', () => {
    const NAME = '(?:fable|opus|sonnet|haiku|claude|codex|gpt|gemini|페이블|오푸스|소넷|하이쿠|클로드|코덱스|제미나이)';
    const ONE = new RegExp('^' + NAME + '(?:[ -]?\\d+(?:\\.\\d+)*)?$', 'i'), ONE_VER = new RegExp('^' + NAME + '[ -]?\\d+\\.\\d+$', 'i'), STAMP = /^(?:\d{4}-)?\d{1,2}-\d{1,2}$|^지시-\d+/;
    const MADE = new RegExp(NAME + '[ \\d.]*(?:가|이) ?(?:만든|만들|쓴|썼|그린|그렸|설계|디자인|검토)', 'i');
    const BY = new RegExp('(?:만든 ?이|작성자?|지은이|\\b(?:authored|written|designed|reviewed|made|created|modified|generated|drawn) (?:by|with)|co-authored-by)\\s*[:：]?\\s*' + NAME + '\\b', 'i');
    const BRANCH = new RegExp('(?<![\\w./-])codex' + '/[a-z0-9][\\w.-]*', 'i');
    const mark = text => {
        for (const m of text.matchAll(/\(([^()\n]{1,80})\)/g)) {
            const cells = m[1].split(/\s*[·,]\s*/).map(s => s.trim());
            if (cells.some(c => ONE.test(c)) && (cells.length === 1 ? ONE_VER.test(cells[0]) : cells.some(c => STAMP.test(c)))) return m[0];
        }
        return (text.match(MADE) || text.match(BY) || text.match(BRANCH) || [''])[0];
    };
    const OPEN = ['/', '*'].join(''), SHUT = ['*', '/'].join(''), LINE = ['/', '/'].join(''), HTML = ['<!', '--'].join(''), HTML_SHUT = ['--', '>'].join('');
    const comments = text => {
        const out = []; let block = '';
        text.split('\n').forEach((line, i) => {
            let rest = line, got = '';
            while (rest) {
                if (block) { const e = rest.indexOf(block); if (e < 0) { got += ' ' + rest; rest = ''; } else { got += ' ' + rest.slice(0, e); rest = rest.slice(e + block.length); block = ''; } continue; }
                const at = [rest.search(new RegExp('(?<!:)' + LINE)), rest.indexOf(OPEN), rest.indexOf(HTML)].filter(n => n >= 0).sort((a, b) => a - b)[0];
                if (at === undefined) break;
                if (rest.startsWith(LINE, at)) { got += ' ' + rest.slice(at); break; }
                const css = rest.startsWith(OPEN, at); block = css ? SHUT : HTML_SHUT; rest = rest.slice(at + (css ? 2 : 4));
            }
            if (got) out.push([i + 1, got]);
        });
        return out;
    };
    const bad = ['(Fa〇ble 5.2 · 11-12)', '(11-11 · Op〇us 5.5)', '(지시-1111 커스텀 · Op〇us 5.5)', '무테 이음매 3(Op〇us 5.5): 자루 끝', '페이〇블이 만든 시안', '만든 이: Son〇net', 'written by Cla〇ude', ['원본 co〇dex', 'release-112 의 src'].join('/')].map(s => s.split('〇').join(''));   // 〇: 이 줄이 스스로 걸리지 않게 끼운 글자
    const good = ['Claude 5 · Fable · Gemini 3 이후는 생각을 짧게', '현재 연결(Gemini)의 내용 차단', '예전 기본(OpenRouter Claude Haiku 5.5 · Google Gemini 3.8 Flash)', '모델 목록에 Fable 5.2 · GPT-6.1 Terra 를 넣었어요', '원본 블루레몬에이드 1.1.2 의 src', '목소리 fable · 파일 .opus'];
    for (const s of bad) assert.ok(mark(s), '잡아야 해요: ' + s);
    for (const s of good) assert.equal(mark(s), '', '잡으면 안 돼요: ' + s);
    assert.deepEqual(comments('a ' + OPEN + ' 하나\n둘 ' + SHUT + ' b ' + LINE + ' 셋').map(c => c[0]), [1, 2]);
    const hits = [], SKIP = new Set(['.git', 'node_modules', 'data', 'media', 'fonts']);
    const walk = rel => {
        for (const ent of fs.readdirSync(path.join(ROOT, rel), { withFileTypes: true })) {
            const r = rel ? rel + '/' + ent.name : ent.name;
            if (ent.isDirectory()) { if (!SKIP.has(ent.name)) walk(r); continue; }
            if (!/\.(?:js|mjs|cjs|css|html)$/.test(ent.name)) continue;
            for (const [n, c] of comments(fs.readFileSync(path.join(ROOT, r), 'utf8'))) { const why = mark(c); if (why) hits.push(r + ':' + n + ' ' + why); }
        }
    };
    walk('');
    const dir = path.join(MART, 'data/geulkku'), idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
    for (const c of Object.values(idx.chunks)) for (const it of Object.entries(JSON.parse(fs.readFileSync(path.join(dir, c.file), 'utf8')).items)) { const why = mark(it[1].preview || ''); if (why) hits.push(c.file + ' ' + it[0] + ' ' + why); }
    assert.deepEqual(hits, [], '만든 이 표시가 남았어요 — 이름을 빼고 무엇을 하는지만 적어요:\n' + hits.join('\n'));
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
