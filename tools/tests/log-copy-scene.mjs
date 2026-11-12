// 로그 복사 「장면」 글꾸 8종(11-09 · tools/mart/scene-geulkku.mjs) — 사랑 재판 · 속보 방송 · 탑승권 · 레시피 카드 · 타로 리딩 · 터미널 · 학적부 · 전보.
//   node tools/tests/log-copy-scene.mjs <테마 루트>
//   받은 글꾸와 같은 규칙(checkTemplate · checkItem · 붙여 넣기 소독 safeCss) · 내장 생성물에 실림 · 「장면」 칩 · 다른 틀과 주제 겹침 없음 ·
//   어두운 · 밝은 게시판 · 실리태번 채팅 네 곳에서 글자 대비(장식 글까지) · 색 역할 대비 · 폰 390 에서 넘치는 고정 폭 없음.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { retiredShape } = await load('src/log-copy-retired.js');
const { renderLog, PRESETS, CATEGORIES, presetsIn, shutPeek, dateLabel } = await load('src/log-copy-presets.js');
// 1.1.7 테마 내장에서 빠졌어요 — 마트에서 받은 「내 글꾸」(틈 템플릿)와 같은 길로 그려 봐요
const asMine = f => ({ ...f, messages: f.messages || 'box', tail: f.tail || '' });
const { checkTemplate, withoutSvgData, TEMPLATE_MESSAGES } = await load('src/log-copy-template.js');
const { checkItem } = await load('src/mart-import.js');
const { safeCss } = await load('src/log-copy-sanitize.js');
const { parseColor, compose, contrast } = await load('src/shared/ink-paint.js');
const { de00, hexRgb, DE_BODY, DE_PAIR, MARK_DE } = await load('tools/mart/geulkku-inks.mjs');
const { SCENE_FRAMES, SCENE_CATEGORY } = await load('tools/mart/scene-geulkku.mjs');
const { REACT_FRAMES } = await load('tools/mart/react-geulkku.mjs');

// log-copy.mjs 와 같은 떠 온 로그 표본(밤 팔레트 · 두 메시지)
const font = { color: 'rgb(219, 226, 235)', 'font-family': "'RIDIBatang', serif", 'font-size': '15.5px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '-0.39px', 'line-height': '27.13px' };
const block = (children, style = {}) => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font, 'margin-bottom': '12px', ...style }, children });
const span = (text, style, kind = null) => ({ t: 'el', block: false, tag: 'span', kind, style, children: [{ t: 'text', text }] });
const T = text => ({ t: 'text', text });
const model = {
    chatName: 'Seraphina', userName: 'Lemon',
    base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [
        { index: 0, user: false, name: 'Seraphina', nameStyle: { color: 'rgb(147, 201, 255)', 'font-family': "'Pretendard', sans-serif", 'font-size': '16px', 'font-weight': '650' }, time: Date.UTC(2026, 10, 3, 7, 12), font, bubble: null,
            nodes: [block([span('"어서 와요, 숲의 손님."', { color: 'rgb(243, 247, 252)' }), T(' '), span('그녀가 미소 지었다.', { color: 'rgb(164, 199, 237)', 'font-style': 'italic' }, 'em')]),
                block([T('여기는 '), span('안전', { color: 'rgb(255, 232, 115)', 'font-weight': '700' }, 'strong'), T('해요.'), { t: 'br' }, T('조금 쉬어요.')])] },
        { index: 1, user: true, name: 'Lemon', nameStyle: { color: 'rgb(171, 186, 206)', 'font-family': "'Pretendard', sans-serif", 'font-size': '16px', 'font-weight': '650' }, time: Date.UTC(2026, 10, 3, 8, 0), font, bubble: { 'background-color': 'rgb(40, 56, 77)', 'border-radius': '12px' },
            nodes: [block([T('*고마워.* '), span('지운 말', { 'text-decoration-line': 'line-through' }, 'del')])] },
    ],
};
const ui = { family: "'Pretendard', sans-serif", tracking: '-0.025em' };
const fields = { title: 'Seraphina', mark: 'LOG', char: '세라피나', model: 'claude-opus-5-5', prompt: '내 프리셋', date: dateLabel(Date.UTC(2026, 10, 3, 7, 12)), from: 'Lemon', tail: '#세라피나 #숲', info: '숲속 오두막에서' };
const nightT = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', dialogue: 'rgb(243, 247, 252)', em: 'rgb(164, 199, 237)', strong: 'rgb(255, 232, 115)', muted: 'rgb(171, 186, 206)', accent: 'rgb(147, 201, 255)', marker: 'rgba(96, 169, 255, 0.35)', line: 'rgba(184, 201, 224, 0.08)' };
const IDS = SCENE_FRAMES.map(f => f.id);

await test('8종 · id 꼴 c-scene-sp-N · 이름 · 이모지 · 설명 · 메시지 배치는 테마가 아는 것 · 받은 글꾸 규칙(checkTemplate · checkItem) 그대로 통과', () => {
    assert.equal(SCENE_FRAMES.length, 8);
    assert.deepEqual(IDS, [1, 2, 3, 4, 5, 6, 7, 8].map(n => `c-scene-sp-${n}`));
    assert.equal(new Set(SCENE_FRAMES.map(f => f.label)).size, 8, '이름 겹침 없음');
    assert.equal(SCENE_CATEGORY.id, 'scene');
    for (const f of SCENE_FRAMES) {
        assert.ok(f.label && f.emoji && f.desc && f.template, `${f.id} 칸`);
        assert.ok(TEMPLATE_MESSAGES.includes(f.messages), `${f.id} 메시지 배치 ${f.messages}`);
        const checked = checkTemplate(f.template);
        assert.ok(checked.ok, `${f.id}: ${checked.reason}`);
        const { item, reason } = checkItem({ kind: 'geulkku', id: f.id, label: f.label, emoji: f.emoji, template: f.template, colors: f.colors, messages: f.messages, tail: f.tail, type: f.type });
        assert.ok(item, `${f.id}: ${reason}`);
        assert.equal(item.template, f.template, `${f.id}: 고쳐 쓰지 않고 그대로 받아요`);
        assert.ok(f.template.length < 16384, `${f.id}: 16KB 아래 (${f.template.length})`);
        // 테마 붙여 넣기 소독: input · class · <style> 없음 · style 은 소독을 지나도 그대로
        assert.ok(!/<(input|label|style|script|img|svg|a)\b|\sclass=|\sid=|\sfor=/i.test(f.template), `${f.id}: input · class · style 태그 없음`);
        for (const m of f.template.matchAll(/\sstyle="([^"]*)"/g)) assert.equal(safeCss(m[1]), m[1], `${f.id}: 소독에서 걷히는 style ${m[1].slice(0, 60)}`);
        assert.ok(!/opacity\s*:|-webkit-text-fill-color|background-clip\s*:\s*text/.test(f.template), `${f.id}: 투명 · 흐린 글자 없음`);
    }
});

await test('주제가 다른 내장 틀(기본 · 대화 · 종이 · 심플 30 · 반응 4)과 겹치지 않아요 · 서로도 달라요', () => {
    const others = PRESETS.filter(p => !IDS.includes(p.id)).map(p => p.label);
    for (const f of SCENE_FRAMES) for (const label of others) assert.ok(f.label !== label && !(label.length >= 3 && f.label.includes(label)) && !(f.label.length >= 3 && label.includes(f.label)), `${f.label} ↔ ${label}`);   // 「카드」 · 「기록」 같은 두 글자 낱말은 주제가 아니에요
    assert.equal(new Set(SCENE_FRAMES.map(f => f.template)).size, 8, '모양이 틀마다 달라요');
    assert.equal(new Set(SCENE_FRAMES.map(f => f.colors.bg)).size, 8, '바탕색이 틀마다 달라요');
    const dark = SCENE_FRAMES.filter(f => contrast(parseColor(f.colors.bg), parseColor('#000000')) < 3).map(f => f.label);
    assert.deepEqual(dark, ['속보 방송', '타로 리딩', '터미널'], '다크 셋 · 라이트 다섯');
    for (const f of [...REACT_FRAMES, ...SCENE_FRAMES]) assert.equal([...REACT_FRAMES, ...SCENE_FRAMES].filter(x => x.id === f.id).length, 1, `${f.id} 겹침`);
});

await test('1.1.7 테마 내장에서 빠졌어요: 「장면」 칩 · 틀 없음 · 생성기 없음 · 옛 id 는 이름표로 읽기만', () => {
    assert.ok(!CATEGORIES.some(c => c.id === 'scene'));
    assert.deepEqual(presetsIn('scene', []), []);
    for (const f of SCENE_FRAMES) {
        assert.ok(!PRESETS.some(x => x.id === f.id), `${f.id}: PRESETS 에 없음`);
        assert.equal(retiredShape(f.id)?.name, f.label, `${f.id}: 이름표`);
    }
    assert.ok(!fs.existsSync(path.join(root, 'tools/mart/build-builtin.mjs')));
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/log-copy-scene\.mjs \./, '공개 CI 에 이 시험');
});

await test('색 역할: 메시지 칸 위 본문 · 이름 · 대사 · 속마음 · 강조 · 흐린 글 4.5 · 제목 · 알약 4.5 · 인용 막대 3 · 꾸밈 색 ΔE(본문과 · 서로 · 형광펜)', () => {
    const c = (a, b) => contrast(parseColor(a), parseColor(b));
    const d = (a, b) => de00(hexRgb(a), hexRgb(b));
    for (const f of SCENE_FRAMES) {
        const k = f.colors;
        for (const bg of ['panel', 'panel2']) for (const ink of ['text', 'name', 'dialogue', 'thought', 'emphasis', 'muted']) assert.ok(c(k[ink], k[bg]) >= 4.5, `${f.id} ${ink}/${bg} ${c(k[ink], k[bg]).toFixed(2)}`);
        for (const ink of ['text', 'dialogue']) assert.ok(c(k[ink], k.mark) >= 4.5, `${f.id} 형광펜 위 ${ink} ${c(k[ink], k.mark).toFixed(2)}`);
        for (const ink of ['faceText', 'faceMuted']) assert.ok(c(k[ink], k.face) >= 4.5, `${f.id} ${ink}/face ${c(k[ink], k.face).toFixed(2)}`);
        if (f.type?.ink) assert.ok(c(k[f.type.ink], k.face) >= 4.5, `${f.id} 제목 잉크 ${f.type.ink}`);
        assert.ok(c(k.onAccent, k.accent) >= 4.5, `${f.id} LOG 알약`);
        assert.ok(c(k.chipText, k.chip) >= 4.5, `${f.id} 알약`);
        assert.ok(c(k.quoteBar, k.panel) >= 3, `${f.id} 인용 막대 ${c(k.quoteBar, k.panel).toFixed(2)}`);
        for (const r of ['dialogue', 'thought', 'emphasis']) assert.ok(d(k[r], k.text) >= DE_BODY - 0.01, `${f.id} ${r} 본문과 ΔE ${d(k[r], k.text).toFixed(1)}`);
        for (const [a, b] of [['dialogue', 'thought'], ['dialogue', 'emphasis'], ['thought', 'emphasis']]) assert.ok(d(k[a], k[b]) >= DE_PAIR - 0.01, `${f.id} ${a}/${b} ΔE ${d(k[a], k[b]).toFixed(1)}`);
        for (const bg of ['panel', 'panel2']) assert.ok(d(k.mark, k[bg]) >= MARK_DE - 0.01, `${f.id} 형광펜/${bg} ΔE ${d(k.mark, k[bg]).toFixed(1)}`);
    }
});

/** HTML 글 → 글 조각마다 (글자색 · 바로 뒤 바탕) 대비 — log-copy.mjs 「붙인 곳 네 조건」과 같은 셈, 장식(aria-hidden) 글도 세요 */
function audit(html, host) {
    const toC = v => parseColor(String(v ?? '').trim());
    const stack = [{ ink: toC(host.ink), bg: toC(host.bg) }];
    const bad = [];
    const VOID = new Set(['img', 'br', 'col', 'hr', 'input', 'meta', 'wbr', 'source']);
    for (const m of String(html).matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:\s[^<>]*?)?)(\/?)>|([^<]+)/g)) {
        if (m[5] !== undefined) {
            const text = m[5].replace(/&[a-z#0-9]+;/gi, 'x').replace(/[\s　]+/g, '');
            if (!text) continue;
            const top = stack[stack.length - 1];
            const need = /^[\p{Extended_Pictographic}‍️·─\-—.\s★☆✦✈♡✎]+$/u.test(text) ? 3 : 4.5;
            const r = contrast(top.ink, top.bg);
            if (r < need) bad.push(`${text.slice(0, 12)} ${r.toFixed(2)}`);
            continue;
        }
        const [, close, name, attrs] = m;
        const tagName = name.toLowerCase();
        if (close) { if (!VOID.has(tagName) && stack.length > 1) stack.pop(); continue; }
        if (VOID.has(tagName) || m[4]) continue;
        const style = attrs.match(/\sstyle="([^"]*)"/)?.[1] ?? '';
        const parent = stack[stack.length - 1];
        const inkV = style.match(/(?:^|;)\s*color:\s*([^;]+)/)?.[1];
        const bgV = style.match(/(?:^|;)\s*background-color:\s*([^;]+)/)?.[1];
        let bg = parent.bg;
        const own = bgV && toC(bgV);
        if (own && own.a > 0.01) bg = own.a >= 0.999 ? own : compose(own, parent.bg);
        let ink = inkV ? toC(inkV) : parent.ink;
        if (ink && ink.a < 0.999) ink = compose(ink, bg);
        stack.push({ ink, bg });
    }
    return bad;
}

await test('그리기: 로그 · 제목 · 꼬리 · 추가 정보가 들어가고 인라인만 · 붙인 곳 네 조건(어두운 · 밝은 게시판 · 실리태번 밤 · 낮)에서 모든 글자 4.5 · 장식 3', () => {
    const hosts = [{ id: '어두운 게시판', bg: '#121212', ink: '#ffffff' }, { id: '밝은 게시판', bg: '#ffffff', ink: '#000000' }, { id: '실리태번 밤', bg: 'rgb(20, 31, 46)', ink: 'rgb(219, 226, 235)' }, { id: '실리태번 낮', bg: 'rgb(249, 252, 255)', ink: 'rgb(34, 45, 58)' }];
    const failures = [];
    for (const f of SCENE_FRAMES) {
        for (const screen of [nightT, null]) {
            const html = renderLog(model, { template: asMine(f), ui, fields, screen });
            for (const text of ['어서 와요, 숲의 손님.', 'Seraphina', '#세라피나 #숲', '숲속 오두막에서', '고마워']) assert.ok(html.includes(text), `${f.id}: 「${text}」`);
            assert.ok(!/\{\{(head|body|info|tail)\}\}/.test(html), `${f.id}: 빈 자리 없음`);
            const bare = html.replace(/ data-f="[a-z]+"/g, '').replace(/ data-bl-[a-z]+(?:="[^"]*")?/g, '').replace(/ aria-hidden="true"/g, '');
            assert.ok(!/\sclass=|<style|<script|<input|\son[a-z]+=|var\(--/i.test(bare), `${f.id}: 인라인만`);
            assert.ok(!/https?:|url\(/i.test(withoutSvgData(bare) ?? 'url('), `${f.id}: 바깥 주소 없음`);
            assert.equal(shutPeek(html), html, `${f.id}: 미리보기 펼침 표시 없음(처음부터 다 보이는 틀)`);
            for (const host of hosts) { const bad = audit(html, host); if (bad.length) failures.push(`${f.label}/${screen ? '밤' : '화면 없음'}/${host.id}: ${bad.slice(0, 3).join(' · ')}`); }
        }
        // 꼬리말을 비우면 틀 기본 꼬리말
        assert.ok(renderLog(model, { template: asMine(f), ui, fields: { ...fields, tail: '' } }).includes(f.tail), `${f.id}: 기본 꼬리말 「${f.tail}」`);
    }
    assert.deepEqual(failures, [], `안 보이는(대비 낮은) 글자 ${failures.length}건`);
});

await test('폰 390: 고정 폭은 작은 장식 · 이름 칸뿐(80px 이하 · 흰 칸 max-width 480) · 줄 칸은 flex-wrap 이나 min-width:0 · 누르면 반응 · 움직임은 bl- 만', () => {
    for (const f of SCENE_FRAMES) {
        const t = f.template;
        for (const m of t.matchAll(/(?:^|[;"])\s*(min-width|width|flex)\s*:\s*([^;"]*)/g)) {
            const px = [...m[2].matchAll(/(\d+)px/g)].map(x => Number(x[1]));
            for (const v of px) assert.ok(v <= (m[1] === 'flex' ? 180 : 80), `${f.id}: ${m[1]}:${m[2]} 가 폰에서 넘칠 수 있어요`);
        }
        assert.match(t, /^<div style="[^"]*max-width:480px/, `${f.id}: 바깥 칸 최대 480px`);
        const eggs = [...t.matchAll(/data-bl-egg="([a-z]+)"/g)].map(m => m[1]);
        assert.ok(eggs.length >= 1, `${f.id}: 누르면 반응하는 장식`);
        for (const m of t.matchAll(/animation:([a-z0-9-]+)/g)) assert.match(m[1], /^bl-/, `${f.id}: 움직임 이름`);
    }
});

console.log(`\n${passed} 통과 · ${failed} 실패`);
process.exit(failed ? 1 : 0);
