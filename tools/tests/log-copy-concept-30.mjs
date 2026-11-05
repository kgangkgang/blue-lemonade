// 로그 복사 컨셉 글꾸 30종(1.0.1 기념일 · 사물 · 장르 · 오리지널 그림) — 하나하나 실제로 그려 봐요.
//   node tools/tests/log-copy-concept-30.mjs <테마 루트>
// 11-04: 테마에서 빼서 글꾸 마트 「일러스트」로 옮겼어요(tools/mart/geulkku-concept30.mjs · 마트 미리보기 · HTML 복사). 테마 내장은 기본 틀 + 심플 글꾸(틈 템플릿)뿐이에요.
// 30개 전부 예외 없이 HTML 이 나오고 · class 속성이 없고(인라인 style 만) · 길이가 2~40KB 안 · 고정 폭 없음 · 로그 글이 들어가요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { renderLog: themeRender, PRESETS, CATEGORIES, OWN_COLORS, movedShape, presetsIn, dateLabel } = await load('src/log-copy-presets.js');
const { MART_CONCEPT_FRAMES: CONCEPT_FRAMES, MART_CONCEPT_COLORS: CONCEPT_COLORS, MART_CONCEPT_SHAPES: SHAPES, renderConcept } = await load('tools/mart/geulkku-concept30.mjs');
const { BUILTIN_TEMPLATES } = await load('src/log-copy-builtin.gen.js');
// 옛 테마 renderLog(model, { shape: 컨셉 id, … }) 자리 — 이제 마트 도구가 그려요(같은 길)
const renderLog = (m, { shape, ...o }) => renderConcept(m, { id: shape, ...o });
const { withoutSvgData } = await load('src/log-copy-template.js');   // 1.0.1 그림 부품 url('data:image/svg+xml,…')(그림만)은 허용

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
            nodes: [block([span('"어서 와요, 숲의 손님."', { color: 'rgb(243, 247, 252)' }), T(' '), span('그녀가 미소 지었다.', { color: 'rgb(164, 199, 237)', 'font-style': 'italic' }, 'em')], { 'text-indent': '15.5px' }),
                block([T('여기는 '), span('안전', { color: 'rgb(255, 232, 115)', 'font-weight': '700' }, 'strong'), T('해요.'), { t: 'br' }, T('조금 쉬어요.')])] },
        { index: 1, user: true, name: 'Lemon', nameStyle: { color: 'rgb(171, 186, 206)', 'font-family': "'Pretendard', sans-serif", 'font-size': '16px', 'font-weight': '650' }, time: Date.UTC(2026, 10, 3, 8, 0), font, bubble: { 'background-color': 'rgb(40, 56, 77)', 'border-radius': '12px' },
            nodes: [block([T('*고마워.* '), span('지운 말', { 'text-decoration-line': 'line-through' }, 'del')])] },
    ],
};
const ui = { family: "'Pretendard', sans-serif", tracking: '-0.025em' };
const fields = { title: 'Seraphina', mark: 'LOG', model: 'claude-opus-5-5', prompt: '내 프리셋', date: dateLabel(Date.UTC(2026, 10, 3, 7, 12)), from: 'Lemon', tail: '#세라피나 #숲', info: '숲속 오두막에서' };
const nightT = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', dialogue: 'rgb(243, 247, 252)', em: 'rgb(164, 199, 237)', strong: 'rgb(255, 232, 115)', muted: 'rgb(171, 186, 206)', accent: 'rgb(147, 201, 255)', marker: 'rgba(96, 169, 255, 0.35)', line: 'rgba(184, 201, 224, 0.08)' };

const IDS = ['concept-birthday', 'concept-xmas', 'concept-pepero', 'concept-seol', 'concept-chuseok', 'concept-valentine', 'concept-white',
    'concept-cafe', 'concept-sticky', 'concept-letter', 'concept-parcel', 'concept-tape', 'concept-diary', 'concept-library', 'concept-menu', 'concept-radio', 'concept-rx', 'concept-passport',
    'concept-space', 'concept-retro', 'concept-case', 'concept-news', 'concept-subway', 'concept-cinema', 'concept-lab', 'concept-score', 'concept-map', 'concept-weather', 'concept-spring', 'concept-winter'];

/** 붙여 넣을 HTML 규칙(log-copy.mjs 와 같음): class · <style> · <script> · on* · CSS 변수 · javascript: 없음, 모든 요소가 style 만(aria-hidden · open 허용) */
function inlineOnly(html, label) {
    const bare = html.replace(/ data-f="[a-z]+"/g, '').replace(/ data-bl-[a-z]+(?:="[^"]*")?/g, '').replace(/ aria-hidden="true"/g, '');
    assert.ok(!/\sclass=/i.test(bare), `${label}: class 없음`);
    assert.ok(!/<style|<script|<link|<iframe/i.test(bare), `${label}: style · script 태그 없음`);
    assert.ok(!/\son[a-z]+=/i.test(bare), `${label}: on* 없음`);
    assert.ok(!/var\(--/.test(bare), `${label}: CSS 변수 없음`);
    const plain = withoutSvgData(bare);
    assert.ok(plain !== null && !/javascript:|https?:|url\(/i.test(plain), `${label}: 바깥 주소 없음(그림 부품은 svg 데이터 주소만)`);
    for (const m of bare.matchAll(/<([a-z]+)((?:\s[^>]*)?)>/g)) {
        const attrs = m[2].replace(/\sstyle="[^"]*"/, '').trim();
        assert.ok(!attrs || /^(?:open(?:="")?)?$/.test(attrs), `${label}: <${m[1]}> 는 style 만 (${attrs})`);   // 1.0.1 눌러 접는 상자는 처음부터 펼친 채(open="")
    }
    return bare;
}

await test('30종이 마트 도구에 다 있어요: 분류 기념일 7 · 사물 11 · 장르 12 · 모양 조각과 색 묶음이 틀마다 · 테마 내장은 기본 틀 + 심플 글꾸뿐', () => {
    assert.deepEqual(CONCEPT_FRAMES.map(f => f.id), IDS);
    assert.deepEqual(CONCEPT_FRAMES.filter(f => f.category === 'event').map(f => f.id), IDS.slice(0, 7));
    assert.deepEqual(CONCEPT_FRAMES.filter(f => f.category === 'thing').map(f => f.id), IDS.slice(7, 18));
    assert.deepEqual(CONCEPT_FRAMES.filter(f => f.category === 'genre').map(f => f.id), IDS.slice(18));
    for (const frame of CONCEPT_FRAMES) {
        assert.ok(typeof SHAPES[frame.shape] === 'function', `${frame.id}: 모양 조각 ${frame.shape}`);
        assert.ok(CONCEPT_COLORS[frame.colors], `${frame.id}: 색 묶음 ${frame.colors}`);
        assert.ok(frame.emoji && /^[가-힣 ]+$/.test(frame.label), `${frame.id}: 라벨은 한국어`);
    }
    assert.equal(new Set(CONCEPT_FRAMES.map(f => f.shape)).size, CONCEPT_FRAMES.length, '모양 조각은 틀마다 달라요');
    // 테마(src): 컨셉 30 은 PRESETS 에 없고 모양 코드도 안 실려요 — 내장 글꾸는 기본 틀 20(그대로 포함) + 심플 글꾸(틈 템플릿)
    for (const id of IDS) assert.ok(!PRESETS.some(p => p.id === id), `${id}: 테마 PRESETS 에 없어요`);
    const theme = read('src/log-copy-presets.js').replace(/\/\/.*$/gm, '');
    assert.ok(!/CONCEPT_SHAPES|CONCEPT_PALETTES|CONCEPT_FRAMES|drawConcept|geulkku-concept30/.test(theme), '테마는 컨셉 30 그림 코드를 싣지 않아요');
    assert.equal(PRESETS.filter(p => !p.template).length, 20, '기본 틀 20(그대로 · 기본 6 · 대화 4 · 종이 5 · 갤러리 4)');
    assert.deepEqual(PRESETS.filter(p => p.template).map(p => p.id), BUILTIN_TEMPLATES.map(t => t.id));
    for (const t of BUILTIN_TEMPLATES) {
        const preset = PRESETS.find(p => p.id === t.id);
        assert.ok(preset.own === t.id && OWN_COLORS[t.id]?.bg && preset.emoji && preset.label, `${t.id}: 내장 심플 글꾸 · 전용 색`);
        assert.equal(movedShape(t.was), t.id, `${t.was} → ${t.id}`);
        const html = themeRender(model, { shape: t.id, colors: null, ui, fields, screen: nightT });
        for (const text of ['어서 와요, 숲의 손님.', 'Seraphina', '#세라피나 #숲', '숲속 오두막에서']) assert.ok(html.includes(text), `${t.id}: 「${text}」`);
    }
    // 11-04 내장 심플 30: 옛 내장 컨셉 30 은 빠짐없이 같은 주제 · 같은 차례의 심플 틀(concept-sp-<원본 열쇠>)로 옮겨져요 · 기본 틀 id 는 그대로
    assert.deepEqual(IDS.map(movedShape), IDS.map(id => id.replace(/^concept-/, 'concept-sp-')));
    assert.deepEqual(BUILTIN_TEMPLATES.map(t => [t.label, t.category]), CONCEPT_FRAMES.map(f => [f.label, f.category]), '내장 심플 30 은 옛 내장 30 과 같은 차례 · 이름 · 분류');
    for (const id of ['card', 'plain', 'concept-nope']) assert.equal(movedShape(id), id);
    // 분류 칩은 틀이 있는 것만 — 내장 심플 30 으로 기념일 · 사물 · 장르가 모두 서요
    assert.deepEqual(CATEGORIES.map(c => c.id), ['basic', 'talk', 'paper', 'event', 'thing', 'genre', 'gallery', 'mine']);
    // 즐겨찾기 · 최근에 남은 옛 id 도 시트가 처음 열릴 때 같은 길로 옮겨요(시작 그래프 밖 — settings.js 는 모양 표를 몰라요)
    assert.match(read('src/log-copy-sheet.js'), /s\.fav = moved\(s\.fav\)/);
    // 1.0.1 2단계: 할로윈 13종은 PRESETS 에서 빠지고 글꾸 마트(tools/mart)로 — 받으면 「내 글꾸」 틈 템플릿
    assert.equal(presetsIn('halloween').length, 0);
    assert.match(read('tools/mart/geulkku-halloween.mjs'), /export const MART_HALLOWEEN_SHAPES = \{/);
    assert.ok(!/MART_HALLOWEEN/.test(read('src/log-copy-presets.js').replace(/\/\/.*$/gm, '')), '테마는 할로윈 파일을 불러오지 않아요');
});

await test('30종 각각 실제 render: 예외 없음 · 인라인만 · 2~40KB · 고정 폭 없음 · 로그 글 · 제목 · 꼬리 · 추가 정보가 들어가요 · 틀마다 다르게', () => {
    const outputs = new Map();
    for (const id of IDS) {
        const html = renderLog(model, { shape: id, colors: null, ui, fields, screen: nightT });
        assert.equal(typeof html, 'string', `${id}: 문자열`);
        const bytes = Buffer.byteLength(html, 'utf8');
        assert.ok(bytes >= 2000 && bytes <= 40000, `${id}: 길이 ${bytes}B (2~40KB)`);
        inlineOnly(html, id);
        assert.match(html, /^<div style="(?:color:[^;]+;)?box-sizing:border-box;max-width:100%/, `${id}: 맨 바깥은 화면 폭 안`);
        assert.ok(!/(?:^|;)width:\d{3,}px/.test(html.replace(/<span[^>]*>/g, '').replace(/aria-hidden="true" style="[^"]*"/g, '')), `${id}: 고정 폭 칸 없음(장식 조각 말고)`);
        for (const text of ['어서 와요, 숲의 손님.', '조금 쉬어요.', 'Seraphina', '#세라피나 #숲', '숲속 오두막에서', '2026년 11월 3일']) assert.ok(html.includes(text), `${id}: 「${text}」`);
        assert.ok(html.includes('font-style:italic') && html.includes('line-through'), `${id}: 기울임 · 취소선 그대로`);
        assert.ok(!html.includes('color:rgb(219, 226, 235)'), `${id}: 화면 색이 남지 않아요(컨셉 색으로)`);
        assert.ok(!/transform:rotate\([^)]*\)[^"]*"[^>]*>[^<]*어서 와요/.test(html), `${id}: 글 칸은 기울이지 않아요`);
        outputs.set(id, html);
    }
    assert.equal(new Set(outputs.values()).size, IDS.length, '30종이 서로 달라요');
    // 시안의 핵심 요소 몇 가지
    assert.match(outputs.get('concept-cafe'), /clip-path:polygon\(0 0, 100% 0, 100% calc\(100% - 8px\), 97% 100%/, '영수증 톱니');
    assert.match(outputs.get('concept-retro'), /box-shadow:0 0 0 4px #1b1e24, 0 0 0 8px #e8edf3/, '레트로 두 겹 흰 테');
    assert.match(outputs.get('concept-subway'), /left:-31px;top:2px;width:14px;height:14px;border-radius:50%/, '노선 역 점');
    assert.match(outputs.get('concept-news'), /column-count:2/, '신문 두 단');
    assert.match(outputs.get('concept-letter'), /clip-path:polygon\(0 0, 100% 0, 50% 100%\)/, '봉투 뚜껑');
    assert.match(outputs.get('concept-parcel'), /repeating-linear-gradient\(90deg, #3b2f22 0 2px, transparent 2px 4px/, '송장 바코드');
    assert.match(outputs.get('concept-score'), /𝄞/, '높은음자리표');
    assert.match(outputs.get('concept-rx'), /℞/, '처방 기호');
    assert.match(outputs.get('concept-map'), /✕/, '보물 ✕');
    assert.match(outputs.get('concept-seol'), /福/, '복주머니');
    assert.match(outputs.get('concept-cinema'), /height:44px;padding:0 14px;background-color:#000000/, '레터박스');
});

await test('칸이 다 비어도 · 이름을 숨겨도 그려져요', async () => {
    const { transformLog } = await load('src/log-copy-words.js');
    const hidden = transformLog(model, { hide: { names: ['Seraphina'], mask: 'auto' } });
    const blank = { count: '2개' };
    for (const id of IDS) {
        assert.ok(renderLog(model, { shape: id, colors: null, ui, fields: {} }).length > 1000, `${id}: 칸이 다 비어도`);
        const html = renderLog(hidden.model, { shape: id, colors: null, ui, fields: hidden.rewriteFields({ ...fields, ...blank }) });
        assert.ok(!html.includes('Seraphina'), `${id}: 숨긴 이름이 남지 않아요`);
    }
});

console.log(`log-copy-concept-30: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
