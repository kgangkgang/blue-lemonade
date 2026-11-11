// 1.1.3 로그 복사 「심플」 새 틀 28 — 글꾸 마트와 같은 틀 · 같은 캐릭터 색에서 같은 CSS 를 내는지(마트 쪽 기대값 fixture 와 대조)
//   fixture: tools/tests/fixtures/simple-frames-mart.json — node tools/mart/simple-frames.mjs --fixture <마트 worktree> 로 마트 함수(mart/simple-frames.js toneSimple)를 돌려 뜬 값이에요.
//   node tools/tests/log-copy-simple-mart.mjs .
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('log-copy-simple-mart');

const fx = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/simple-frames-mart.json'), 'utf8'));
const tool = await load('tools/mart/simple-frames.mjs');
const tone = await load('src/log-copy-simple-tone.js');
const { SIMPLE_FRAMES, drawSimple, checkFrame } = await load('src/log-copy-simple.js');
const { parseColor } = await load('src/shared/ink-paint.js');
const sha = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);

await test('등록 값 생성물이 틀 파일 · 도구와 같아요(node tools/mart/simple-frames.mjs --check 와 같은 비교) · 28틀 · 모두 등록 점검 통과', () => {
    const { entries, text } = tool.build();
    assert.equal(fs.readFileSync(path.join(root, 'src/log-copy-simple.gen.js'), 'utf8'), text);
    assert.equal(entries.length, 28);
    assert.deepEqual(SIMPLE_FRAMES.map(f => f.key), ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k09', 'k10', 'k11', 'k12', 'k13', 'k14', 'k15', 'k16', 'k17', 'k18', 'q01', 'q02', 'q03', 'q04', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10']);
    for (const f of SIMPLE_FRAMES) assert.deepEqual(checkFrame(f), [], f.key);
});

await test('이름 · 이모지 · 설명 · 미리보기 · 닫힘이 마트 DEFS 와 같아요(설명은 끝 「 · 소리 카드 한 줄」만 뗌 — 테마 판은 소리 카드가 없어요) · id 15자 이하', () => {
    assert.equal(Object.keys(fx.defs).length, 28);
    for (const f of SIMPLE_FRAMES) {
        const m = fx.defs[f.key];
        assert.ok(m, f.key);
        assert.deepEqual({ id: f.id, label: f.label, emoji: f.emoji, peek: f.peek, open: f.open }, { id: m.id, label: m.name, emoji: m.emoji, peek: m.peek, open: m.open }, f.key);
        assert.equal(f.desc, m.desc.endsWith(tool.SOUND_TAIL) ? m.desc.slice(0, -tool.SOUND_TAIL.length) : m.desc, f.key);
        assert.ok(!f.desc.includes('소리 카드'), `${f.key} 설명에 소리 카드 말 없음`);
        assert.ok(f.id.length <= 15, f.id);
    }
});

await test('틀 계약 값(캐릭터 색 이름 · 첫 묶음 면 · 미리보기 · 사다리 밖 단계 · 주인공 차례 · 바탕 글자) · ✎ 주석 문구가 마트와 같아요 · 마트 틀 파일과 같은 원래 판', () => {
    const c = tone.SIMPLE_CONTRACT;
    assert.deepEqual(JSON.parse(JSON.stringify({ cv: c.cv, faces: c.faces, peek: c.peek, extraSteps: c.extraSteps, mainOrder: c.mainOrder, ink: c.ink, tagMix: c.tagMix })), fx.contract);
    assert.deepEqual(tone.EDIT_MARKS.map(x => [...x]), fx.editMarks);
    assert.equal(fx.sameFrames, true, '마트 tools/simple-frames/<틀>.html 과 포커스 테 한 줄 말고 같아요');
});

await test('함수 대조: 원래 판(소리 카드 있음) 28틀 × (원래 색 · 무채 · 민트 · 노랑 · 빨강 · 보라) × 낮밤 = 336번 toneSimple 결과가 마트와 한 글자도 같아요', () => {
    let n = 0;
    for (const d of tool.DEFS) {
        const raw = tool.rawFrame(d);
        for (const [name, K] of tool.TONE_CASES) for (const mode of tool.MODES) {
            const key = `${d.frame}|${name}|${mode}`;
            assert.equal(sha(tone.toneSimple(raw, name === 'orig' ? tone.ORIGINAL : K, { mode })), fx.tone[key], key);
            n++;
        }
    }
    assert.equal(n, 336);
});

// 견본과 같은 꼴의 로그(주인공 · 상대 두 사람 · 이름 줄 · 대사 띠) — 그리면 화자 표시 클래스가 마트 견본과 같아져요
const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': 'serif', 'font-size': '15px', 'line-height': '24px' };
const band = (hex, text) => { const c = parseColor(hex); return { t: 'el', block: false, tag: 'span', style: { 'background-image': `linear-gradient(transparent 5%, rgba(${c.r}, ${c.g}, ${c.b}, 0.35) 5%, rgba(${c.r}, ${c.g}, ${c.b}, 0.35) 100%, transparent 100%)` }, children: [{ t: 'text', text }] }; };
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children });
const words = text => ({ t: 'text', text });
const msg = (name, nodes) => ({ index: 0, user: false, name, nameStyle: {}, time: null, font: { ...SCREEN }, bubble: null, nodes });
const model = messages => ({ messages, base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '' });
const pairModel = (mainK, secondK) => model([
    msg('이름', [para(words('옥상 문을 밀자 젖은 바닥 냄새가 먼저 올라왔다. 이름은 난간에 기대어 하늘을 올려다보았다.')), para(mainK ? band(mainK, '「여기 있을 줄 알았어.」') : words('「여기 있을 줄 알았어.」'))]),
    msg('친구', [para(words('친구는 고개를 끄덕였다.')), para(secondK ? band(secondK, '「응.」') : words('「응.」'))]),
]);

await test('그리기 대조: 28틀 × (색 모름 = 원래 색 · 틀을 만든 색 · 민트 · 노랑 · 빨강 · 보라) × 낮밤 — 주인공만 다른 색인 두 사람 로그의 <style> · 뿌리 class 가 마트(소리 없는 판)와 같아요', () => {
    let n = 0;
    for (const f of SIMPLE_FRAMES) {
        const second0 = tone.speakerColorsOf(tone.simpleFrameInfo(f.html).color_css)[f.second];
        for (const [name, K] of [['orig', null], ['self', f.sample], ...tool.TONE_CASES.filter(([x]) => !['orig', 'none'].includes(x))]) for (const mode of tool.MODES) {
            const drawn = drawSimple(f, name === 'orig' ? pairModel(null, null) : pairModel(K, second0), { mode, fields: { title: '제목' } });
            assert.equal([...drawn.letters.values()].join(), `${f.main},${f.second}`, f.key);
            const want = name === 'self' ? sha(tool.styleKey(tone.toneSimple(tool.quietFrame(tool.rawFrame(tool.DEFS.find(d => d.frame === f.key))), K, { mode }))) : fx.quiet[`${f.key}|${name}|${mode}`];
            assert.equal(sha(tool.styleKey(drawn.html)), want, `${f.key} ${name} ${mode}`);
            n++;
        }
    }
    assert.equal(n, 28 * 6 * 2);
});

await test('틀을 만든 색 그대로인 화자는 시안 규칙이 한 글자도 안 바뀌어요(② 화자 블록이 이식판 그대로 · 색 묶음 이름만 — 소리 카드가 없는 판이라 진행 선 규칙 한 줄만 빠져요, 마트 소리 없는 판과 같아요)', () => {
    for (const f of SIMPLE_FRAMES) {
        const second0 = tone.speakerColorsOf(tone.simpleFrameInfo(f.html).color_css)[f.second];
        const drawn = drawSimple(f, pairModel(f.sample, second0), { mode: f.roots.light.includes('gk-tn') ? 'dark' : 'light' });
        const block = html => html.match(/<style>\n?([\s\S]*?)\n?<\/style>/)[1].split('\n\n')[1];
        const cv0 = tone.simpleFrameInfo(f.html).cvClass;
        const noLine = css => css.split('\n').filter(line => !line.includes('media-controls-timeline')).join('\n');
        assert.equal(block(drawn.html), noLine(block(f.html)).split(`.${cv0}`).join(`.${drawn.cv}`), f.key);
        assert.equal(drawn.cv, `gk-cv-${f.sample.slice(1)}`, f.key);
    }
});

done();
