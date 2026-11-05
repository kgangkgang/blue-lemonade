// 1.0.1 글꾸 마트 — 손으로 짠 시안 183종(세계관 24 · 인물 40 · 시리즈 53(S) · 컨셉 66(T))을 옮긴 틈 템플릿(tools/mart/geulkku-sian.json)이
// 테마 가져오기 검사(살균)를 그대로 통과하고 · 네 자리가 한 번씩 · 64KB 이하 · 표본 글로 그려지고 · 메시지 칸 글자 대비가 맞는지 봐요.
//   node tools/tests/mart-geulkku-64.mjs <테마 루트>
// 시안 원본(outputs/공지-1000)이 있는 곳에서는 tools/mart/convert-sian.mjs --check 로 「시안에서 다시 만들어도 같다」까지 봐요(CI 에는 없어서 건너뛰어요).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { checkTemplate, TEMPLATE_MAX, TEMPLATE_ROLES, withoutSvgData } = await load('src/log-copy-template.js');
const { checkItem, readMart, MART_ITEMS_MAX } = await load('src/mart-import.js');
const { renderLog: themeRender } = await load('src/log-copy-presets.js');
const { MART_CONCEPT_FRAMES: CONCEPT_FRAMES, renderConcept } = await load('tools/mart/geulkku-concept30.mjs');   // 1.0.1(11-04) 옛 내장 컨셉 30 — 마트 「일러스트」(미리보기 · HTML 복사)
const renderLog = (m, o) => (/^concept-/.test(o.shape ?? '') ? renderConcept(m, { ...o, id: o.shape }) : themeRender(m, o));
const { MOTION_NAMES, EGG_KINDS, motionCss, motionStyleFor } = await load('src/log-copy-motion.js');
const data = JSON.parse(read('tools/mart/geulkku-sian.json'));
const frames = data.frames;
// 1.0.2 그림체(tools/mart/geulkku-style.mjs): style 칸 「심플 · 일러스트 · 다꾸 · 무테」 — 칸이 없으면 일러스트(오리지널 그림). 아래 183 · 분류 수는 「일러스트」 틀만 세요(다른 그림체 시안이 들어와도 그대로)
const { GEULKKU_STYLES, STYLE_SLUG, STYLE_ALIAS, styleOf } = await load('tools/mart/geulkku-style.mjs');
const baseFrames = frames.filter(f => (f.style ?? '일러스트') === '일러스트');

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const [x, y] = [lum(hex(a)), lum(hex(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// 표본 글 — tools/mart-build.mjs SAMPLE 과 같은 꼴(세라피나 · 숲 오두막)
const FONT = { 'font-family': "'Pretendard', sans-serif", 'font-size': '15px', 'font-weight': '400', 'letter-spacing': '-0.025em', 'line-height': '1.7', color: '#1c2a3a' };
const text = t => ({ t: 'el', block: true, tag: 'div', kind: null, style: {}, children: [{ t: 'text', text: t }] });
const msg = (user, name, nodes) => ({ index: null, user, name, nameStyle: { color: '#1c2a3a', 'font-size': '14px', 'font-weight': '700' }, time: Date.UTC(2026, 10, 3, 12), font: { ...FONT }, bubble: null, nodes });
const SAMPLE = { chatName: 'Seraphina', userName: '여행자', base: { bg: '#ffffff', ...FONT }, images: [], messages: [msg(false, 'Seraphina', [text('오두막 창가에 등불이 하나 켜졌다.')]), msg(true, '여행자', [text('숲에서 뭔가 날아다니던데…')]), msg(false, 'Seraphina', [text('"오늘 밤은 다 그래요."')])] };
const UI = { family: "'Pretendard', sans-serif", tracking: '-0.025em' };

await test('183종 · 분류(세계관 넷 · 인물 둘 · 시리즈 8 · 컨셉 10) · id 겹침 없음 · 내 글꾸 id 꼴', () => {
    assert.equal(baseFrames.length, 183);
    const by = {};
    for (const f of baseFrames) by[f.category] = (by[f.category] ?? 0) + 1;
    assert.deepEqual(by, { halo: 6, hunter: 6, adrian: 6, gangho: 6, 'halo-char': 26, 'gangho-char': 14, season: 2, weather: 7, event: 7, daytime: 5, transport: 7, paper: 5, place: 12, animal: 8, food: 8, hobby: 8, job: 8, media: 6, nature: 8, fantasy: 8, mood: 5, sport: 6, hud: 4, love: 5 });
    const labels = Object.fromEntries(frames.map(f => [f.category, f.categoryLabel]));
    assert.deepEqual(labels, { halo: '천지합동청', hunter: '헌시뮬', adrian: '아드리안', gangho: '강호유람록', 'halo-char': '천지합동청 · 인물', 'gangho-char': '강호유람록 · 인물', season: '계절', weather: '날씨', event: '기념일', daytime: '시간대', transport: '교통', paper: '종이', place: '장소', animal: '동물', food: '음식', hobby: '취미', job: '직업', media: '옛날 매체', nature: '우주 자연', fantasy: '판타지', mood: '감정', sport: '스포츠', hud: '상태창', love: '연애 일상', halloween: '할로윈', thing: '사물', genre: '장르' });   // thing · genre: 내장 심플 30(concept-sp-*)
    assert.equal(new Set(frames.map(f => f.id)).size, frames.length);
    for (const f of frames) {
        assert.match(f.id, /^((world|char)-[a-z]+-((dk|mt|sp)-)?\d{1,2}|[sc]-[a-z]+-((dk|mt|sp)-)?\d{1,2}|halloween-(sp|dk|mt)-[a-z]+|concept-sp-[a-z]+)$/, f.id);
        assert.ok(f.id.length <= 24, `${f.id} 24자 넘음`);
        assert.ok(f.label && f.label.length <= 40 && f.emoji && f.emoji.length <= 8, `${f.id} 이름 · 이모지`);
        assert.ok(f.tail && f.tail.length <= 60, `${f.id} 꼬리 기본 글`);
    }
});

await test('그림체(1.0.2 · 11-04 18:3x 이름): style 칸은 「심플 · 일러스트 · 다꾸 · 무테」만 · 일러스트는 칸 없음 · 그 밖은 id 꼬리(sp · dk · mt) · 테마 가져오기는 이 칸을 모르고 넘겨요 · 생성기가 사이트 항목 · 목록에 실어요', () => {
    assert.deepEqual([...GEULKKU_STYLES], ['심플', '일러스트', '다꾸', '무테']);   // 사이트 칩 차례도 이대로(심플 → 일러스트 → 다꾸 → 무테 — 심플은 테마 내장과 같은 그림체라 맨 앞)
    assert.deepEqual({ ...STYLE_SLUG }, { 심플: 'sp', 일러스트: '', 다꾸: 'dk', 무테: 'mt' }, 'id 꼬리는 이름을 바꾸기 전 그대로');
    assert.equal(styleOf({}), '일러스트'); assert.equal(styleOf({ style: '무테' }), '무테'); assert.equal(styleOf({}, '다꾸'), '다꾸');
    assert.equal(styleOf({ style: '기본' }), '일러스트', '옛 이름 「기본」은 일러스트로 읽어요'); assert.deepEqual({ ...STYLE_ALIAS }, { 기본: '일러스트' });
    assert.throws(() => styleOf({ id: 'x', style: 'mute' }), /모르는 그림체/); assert.throws(() => styleOf({ style: '' }), /모르는 그림체/);
    const counts = {};
    for (const f of frames) {
        if ('style' in f) assert.ok(f.style !== '일러스트' && GEULKKU_STYLES.includes(f.style), `${f.id} 그림체 ${f.style}`);
        const style = f.style ?? '일러스트', slug = STYLE_SLUG[style];
        counts[style] = (counts[style] ?? 0) + 1;
        const tail = /^(halloween|concept)-/.test(f.id) ? new RegExp(`^(halloween|concept)-${slug}-[a-z]+$`) : new RegExp(`-${slug}-\\d+$`);   // 할로윈 확장: halloween-<꼬리>-<원본 열쇠> · 내장 심플 30: concept-sp-<원본 열쇠>
        assert.equal(tail.test(f.id), !!slug, `${f.id} 그림체 id 꼬리`);
    }
    // 심플 · 다꾸 · 무테 확장(11-04): 시리즈 53 + 할로윈 31 + 컨셉 66 + 세계관 24 + 캐릭터 40 = 214씩 · 심플은 테마 내장 30(옛 내장 컨셉 30 과 같은 주제)을 더해 244
    assert.deepEqual(counts, { 일러스트: 183, 다꾸: 214, 무테: 214, 심플: 244 });
    const sp30 = frames.filter(f => f.id.startsWith('concept-sp-'));
    assert.deepEqual(sp30.map(f => f.id), CONCEPT_FRAMES.map(f => f.id.replace(/^concept-/, 'concept-sp-')), '내장 심플 30 은 옛 내장 컨셉 30 과 같은 차례 · 열쇠');
    assert.deepEqual(sp30.map(f => [f.label.replace(/\(눌러서 열기\)$/, ''), f.category]), CONCEPT_FRAMES.map(f => [f.label, f.category]), '내장 심플 30 은 같은 이름 · 분류(event · thing · genre)');
    // 할로윈 확장 셋은 원본 31 과 같은 열쇠(같은 주제끼리 id 가 맞아요) · 다꾸는 도장 · 라벨 글(labels { stamp, tag })만 — 시안의 열쇠(key)는 안 넘겨요
    const keys = style => frames.filter(f => f.id.startsWith(`halloween-${STYLE_SLUG[style]}-`)).map(f => f.id.split('-').slice(2).join('-'));
    assert.equal(keys('심플').length, 31); assert.deepEqual(keys('다꾸'), keys('심플')); assert.deepEqual(keys('무테'), keys('심플'));
    for (const f of frames) if (f.labels) { assert.equal(f.style, '다꾸', `${f.id} labels 는 다꾸만`); assert.deepEqual(Object.keys(f.labels), ['stamp', 'tag'], `${f.id} labels 칸`); }
    assert.equal(frames.filter(f => f.labels).length, 214, '다꾸 214 모두 도장 · 라벨 글');
    // 테마(mart-import checkItem · readMart)는 style 칸을 몰라도 깨지지 않고, 받은 글꾸에 남기지 않아요
    const f = frames[0];
    for (const style of [...GEULKKU_STYLES, '모르는 값', 7, null]) {
        const { item, reason } = checkItem({ kind: 'geulkku', ...f, style });
        assert.ok(item, `${style}: ${reason}`); assert.ok(!('style' in item), '받은 글꾸에 그림체 칸이 남지 않아요');
    }
    const got = readMart(JSON.stringify({ 'bl-mart': 1, items: [{ kind: 'geulkku', ...f, id: 'zz-mt-1', style: '무테' }] }));
    assert.equal(got.error, ''); assert.equal(got.items.length, 1); assert.equal(got.skipped.length, 0);
    // 변환기 · 생성기 연결
    const conv = read('tools/mart/convert-sian.mjs'), build = read('tools/mart-build.mjs');
    assert.match(conv, /styleOf\(frame, src\.style \?\? STYLE_DEFAULT\)/, '변환기: 틀 style → 시안 파일 style → 기본');
    assert.match(conv, /\.\.\.\(style !== STYLE_DEFAULT \? \{ style \} : \{\}\)/, '변환기: 기본이 아니면 style 칸을 넘겨요');
    assert.match(conv, /file: '시안4-시리즈-무테-만들기\.mjs', \.\.\.SERIES, style: '무테', optional: true/);
    assert.match(conv, /file: '시안4-시리즈-다꾸-만들기\.mjs', \.\.\.SERIES, style: '다꾸', optional: true/);
    assert.match(conv, /file: '시안4-시리즈-심플-만들기\.mjs', \.\.\.SERIES, style: '심플', optional: true/);
    assert.equal((build.match(/style: styleOf\(frame\)/g) ?? []).length, 2, '생성기: 시안 · 할로윈 항목에 그림체');
    assert.match(build, /style: STYLE_DEFAULT, desc:/, '생성기: 내장 30 은 일러스트');
    assert.match(build, /const geulkkuJson = \{ _: framesJson\._, built: framesJson\.built, categories: geulkku\.categories, styles: geulkkuStyles, items: geulkku\.items \};/);
    assert.match(build, /const entry = \{ kind: 'geulkku', id: frame\.id, label: frame\.label, emoji: frame\.emoji, template: frame\.template, colors: frame\.colors, messages: frame\.messages \|\| 'box', tail: frame\.tail \|\| '', \.\.\.\(frame\.type \? \{ type: frame\.type \} : \{\}\) \};/, '받기 항목(entry)에는 그림체를 안 넣어요');
});

await test('살균: 183종 전부 테마 가져오기 검사(checkTemplate · checkItem)를 그대로 통과 · 네 자리 한 번씩 · 64KB 이하', () => {
    for (const f of frames) {
        const checked = checkTemplate(f.template);
        assert.equal(checked.ok, true, `${f.id}: ${checked.reason}`);
        assert.equal(checked.html, f.template, `${f.id}: 검사가 고쳐 쓰지 않아요`);
        for (const slot of ['head', 'body', 'info', 'tail']) assert.equal(f.template.split(`{{${slot}}}`).length - 1, 1, `${f.id} {{${slot}}}`);
        assert.ok(f.template.length <= TEMPLATE_MAX, `${f.id} ${f.template.length}B`);
        const { item, reason } = checkItem({ kind: 'geulkku', ...f });
        assert.ok(item, `${f.id}: ${reason}`);
        assert.equal(item.template, f.template); assert.equal(item.tail, f.tail); assert.equal(item.messages, f.id.startsWith('s-transport-') ? 'station' : 'box');
        for (const role of TEMPLATE_ROLES) assert.equal(item.colors[role], f.colors[role], `${f.id} 색 ${role} 이 받을 때 바뀌어요`);
    }
});

await test('설계 §4 금지 · 변환 규칙: 태그 10가지만(+details · summary) · 움직임은 공용 bl-* 만 · 표본 이름 · 날짜 · {{user}} 가 장식 글에 안 남음', () => {
    for (const f of frames) {
        const t = f.template;
        const tags = new Set([...t.matchAll(/<([a-z0-9]+)/gi)].map(m => m[1].toLowerCase()));
        for (const tag of tags) assert.ok(['div', 'span', 'p', 'b', 'i', 'em', 'strong', 'br', 'details', 'summary'].includes(tag), `${f.id} <${tag}>`);
        assert.ok(!/@keyframes|url\(|expression\(|position:\s*fixed|behavior|\\|&/i.test(withoutSvgData(t) ?? 'url('), `${f.id} 금지 값`);   // 1.0.1 그림 부품(svg 데이터 주소)만 허용
        for (const [, v] of t.matchAll(/animation(?:-name)?:([^;"]*)/g)) for (const name of v.match(/\bbl-[a-z]+(?:-[a-z]+)*\b/g) ?? []) assert.ok(MOTION_NAMES.includes(name), `${f.id} 키프레임 ${name}`);
        assert.ok(!/ (class|id|on[a-z]+|href|src)=/i.test(withoutSvgData(t) ?? ''), `${f.id} 금지 속성`);
        for (const [, kind] of t.matchAll(/data-bl-egg="([^"]*)"/g)) assert.ok(EGG_KINDS.includes(kind), `${f.id} 반응 ${kind}`);
        assert.ok(!t.includes('Seraphina') && !t.includes('세라피나 · 숲 오두막') && !/2026\.1[01]\.(31|04)/.test(t) && !t.includes('{{user}}'), `${f.id} 표본 글이 남았어요`);
        assert.ok(!/ data-bl-(?!egg=)[a-z]+/.test(t), `${f.id} 시안 표식이 남았어요`);
        // 메시지를 품은 상자는 처음부터 펼친 채(open) · 장식 켜고 끄기(summary 에 data-bl-egg 만 · 메시지 없음)는 닫힌 채 — 열어 두면 반응이 켜진 채 시작해요
        for (const m of t.matchAll(/<details([^>]*)>/g)) {
            const start = m.index, end = t.indexOf('</details>', start), hasBody = t.indexOf('{{body}}', start) > start && t.indexOf('{{body}}', start) < t.lastIndexOf('</details>');
            const inner = t.slice(start, end);
            if (/\{\{body\}\}/.test(t.slice(start, t.lastIndexOf('</details>'))) && !/^<details[^>]*><summary[^>]*data-bl-egg/.test(inner)) assert.match(m[1], /^ open=""/, `${f.id} 메시지 상자는 처음부터 펼친 채`);
            else if (/^<details[^>]*><summary[^>]*data-bl-egg[^>]*>[^<]*<\/summary><\/details>/.test(t.slice(start))) assert.doesNotMatch(m[1], /open/, `${f.id} 장식 켜고 끄기는 닫힌 채`);
            void hasBody;
        }
    }
    const moving = frames.filter(f => /animation:bl-/.test(f.template)).length, pressing = frames.filter(f => /data-bl-egg=/.test(f.template)).length, opening = frames.filter(f => /<details/.test(f.template));
    assert.ok(moving >= 175 && pressing >= 170, `움직임 ${moving} · 반응 ${pressing}`);
    for (const id of ['char-asmodeus-2', 'char-guya-1', 'char-seraph-2', 'world-adrian-2', 'world-gangho-6']) assert.match(frames.find(f => f.id === id).template, /<details open="" style="[^"]*"><summary style="display:block;list-style:none;[^"]*">[\s\S]*?<\/summary><div style="margin-top:10px">\{\{body\}\}<\/div><\/details>/, `${id} 열림 상자 안에 메시지`);
    assert.ok(opening.length >= 20, `열림형 ${opening.length}`);   // 1.0.2: 시안 원본 대개편으로 열림형이 21 쯤(세계관 · 인물 5 + 시리즈 · 컨셉)
    for (const f of opening) { const t = f.template; const a = t.indexOf('<details'), b = t.indexOf('{{body}}'), c = t.lastIndexOf('</details>'); if (!/<summary[^>]*data-bl-egg/.test(t.slice(a, a + 400))) assert.ok(a < b && b < c, `${f.id} 메시지가 접는 상자 안에`); }
});

await test('움직임 · 반응 살균(checkTemplate): bl- 이름만 · data-bl-egg 는 고정 목록만 · details/summary · open="" 허용 · 다른 data-* · 이름 · url( 은 거절', async () => {
    const S = '{{head}}{{body}}{{info}}{{tail}}';
    const ok = t => checkTemplate(t).ok;
    assert.ok(ok(`<div style="animation:bl-pulse 2s ease-in-out infinite">${S}</div>`));
    assert.ok(ok(`<div style="animation:bl-x 1s cubic-bezier(.3,1,.3,1) 2 alternate both">${S}</div>`), '이름이 bl- 면 키워드 · 숫자 · 함수는 괜찮아요');
    assert.ok(ok(`<div style="animation-name:bl-spin, bl-hue;animation-duration:2s">${S}</div>`));
    assert.ok(!ok(`<div style="animation:spin 2s">${S}</div>`), '공용 아닌 이름');
    assert.ok(!ok(`<div style="animation-name:wobble">${S}</div>`));
    assert.ok(!ok(`<div style="animation:bl-a 1s url(x)">${S}</div>`), 'url');
    // 1.0.1 그림 부품: 로그 복사 소독(safeCss)도 그림만 든 svg 데이터 주소는 남기고, 나쁜 것은 통째로 none · 다른 data 주소는 그대로 걷어요
    const { safeCss } = await load('src/log-copy-sanitize.js');
    const { svgDoc, svgUrl } = await load('src/log-copy-concept-kit.js');
    const pic = svgUrl(svgDoc(10, 10, '<circle cx="5" cy="5" r="4" fill="#c4223f"/>'));
    assert.equal(safeCss(`width:10px;background:${pic} center/100% 100% no-repeat`), `width:10px;background:${pic} center/100% 100% no-repeat`, '소독이 그림 부품을 남겨요');
    assert.equal(safeCss(`background:${svgUrl(svgDoc(10, 10, '<script>alert(1)</script>'))} center`), 'background:none center', '스크립트 든 svg 는 none');
    assert.ok(!/url\(/.test(safeCss("background:url('data:text/html,x')")), '다른 data 주소는 걷어요');
    assert.equal(safeCss('color:red\u00010\u0001'), 'color:red0', '맡김 표시 흉내는 지워요');
    assert.ok(ok(`<details open=""><summary data-bl-egg="bounce" style="list-style:none">x</summary>${S}</details>`));
    for (const kind of EGG_KINDS) assert.ok(ok(`<span data-bl-egg="${kind}">${S}</span>`), kind);
    assert.ok(!ok(`<span data-bl-egg="boom">${S}</span>`));
    assert.ok(!ok(`<span data-bl-x="spin">${S}</span>`), '다른 data-*');
    assert.ok(!ok(`<div open="">${S}</div>`), 'open 은 details 에만');
    assert.ok(!ok(`<details ontoggle="x">${S}</details>`));
});

await test('테마 CSS: 키프레임 14(+반응용 bl-hue) · 반응 10가지(:active · :hover · details[open]) · 움직임 줄이기 — lazy 시트 · 미리보기 칸 · HTML 복사 <style> 이 한 원본', () => {
    for (const name of ['bl-fall', 'bl-float', 'bl-drift', 'bl-twinkle', 'bl-pulse', 'bl-sway', 'bl-spin', 'bl-flicker', 'bl-wave', 'bl-rise', 'bl-shimmer', 'bl-ticker', 'bl-bounce', 'bl-breathe']) assert.ok(MOTION_NAMES.includes(name), name);
    const css = motionCss();
    for (const kind of EGG_KINDS) { assert.ok(css.includes(`[data-bl-egg="${kind}"]:active`) && css.includes(`details[open]>summary[data-bl-egg="${kind}"]`) && css.includes(`[data-bl-egg="${kind}"]:hover`), kind); }
    assert.match(css, /@media \(hover:hover\),\(hover:none\)\{/, 'PC 올려 두기 · 폰 탭(:hover 가 남아요)'); assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{[^}]*animation:none!important\}\}$/);
    assert.ok(read('css/74-log-copy-motion.css').includes(css), 'css/74 = motionCss() (lazy 시트 · 채팅)');
    assert.match(read('tools/build-css.cjs'), /'74-log-copy-motion\.css'\]\);/, '첫 화면 밖(SPLIT_LAZY)');
    assert.ok(read('src/style-lazy.gen.css').includes('@keyframes bl-breathe') && !read('style.css').includes('@keyframes bl-breathe'), 'lazy 시트에만');
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /<style>html\{scrollbar-width:none\}[^`]*\$\{motionCss\(\)\}<\/style><\/head>/, '미리보기 칸');
    assert.match(sheet, /const html = motionStyleFor\(shown\) \+ shown;/, '테마 HTML 복사도 맨 앞 <style>');
    assert.match(read('src/log-copy-sanitize.js'), /name !== 'data-bl-egg'/, '복사 소독이 반응 표시는 남겨요');
    assert.equal(motionStyleFor('<div style="color:red">x</div>'), '', '안 쓰면 안 붙여요');
    const only = motionStyleFor('<div style="animation:bl-spin 6s linear infinite" data-bl-egg="wiggle">x</div>');
    assert.match(only, /^<style>@keyframes bl-sway\{[^}]*\}[^]*@keyframes bl-spin\{|^<style>@keyframes bl-spin\{/);
    assert.ok(only.includes('bl-sway') && !only.includes('bl-twinkle') && only.includes('[data-bl-egg]{cursor:pointer'), '쓰는 것만');
});

await test('컨셉 30(옛 내장 · 마트 일러스트) · 할로윈 31 도 장식이 움직이고(신문 빼고) 편지 봉투 · 택배 상자는 눌러 열려요', () => {
    for (const f of CONCEPT_FRAMES) {
        const html = renderLog(SAMPLE, { shape: f.id, ui: UI, fields: { title: 'T' }, size: 'm' });
        if (f.id === 'concept-news') { assert.ok(!/animation:bl-/.test(html)); continue; }
        assert.match(html, /animation:bl-[a-z]+/, `${f.id} 움직임`);
        if (['concept-letter', 'concept-parcel'].includes(f.id)) assert.match(html, /<details open="" style="[^"]*display:block;margin:0[^"]*"><summary style="[^"]*list-style:none/, `${f.id} 열림`);
    }
    // 할로윈 31(10월 31일 · 처음 13 + 1.0.1 18): 덧붙인 이모지 없이 틀이 가진 부품(눈 · 붕대 자락 · 잎 · 촛불 · 박쥐 · 거미 · 모자 · 리본 · 창문 · 꼬리 …)을 움직이고 그 부품을 누르게 — 틀마다 반응 부품 둘 이상
    const build = read('tools/mart-build.mjs');
    const hw = build.slice(build.indexOf('const HALLOWEEN_MOTION = {'), build.indexOf('};', build.indexOf('const HALLOWEEN_MOTION = {')));
    assert.ok(!/decor:|sprinkle:|mascot:/.test(hw), '할로윈에 덧붙인 이모지 없음');
    assert.match(hw, /'halloween-coffin': HW\(\{ open: \['', '/); assert.match(hw, /'halloween-house': HW\(\{ open: \['', '/); assert.match(hw, /'halloween-door': HW\(\{ open: \['', '/);   // 1.0.1 대개편: 열기 칩은 글만
    assert.match(build, /const HALLOWEEN_NOTE = '🎃 10월 31일 · 할로윈 31종';/, '할로윈 카드 한 줄');
    const shapes = read('tools/mart/geulkku-halloween.mjs');
    const shapeBodies = [...shapes.matchAll(/^    (\w+): \(k, p, ui\) => \{([\s\S]*?)^    \},/gm)];
    assert.equal(shapeBodies.length, 31, '할로윈 모양 조각 31');
    for (const [, name, body] of shapeBodies) {
        const eggs = [...body.matchAll(/egg: '([a-z]+)'/g)].map(m => m[1]);
        assert.ok(eggs.length >= 2 && eggs.every(e => EGG_KINDS.includes(e)), `${name} 반응 부품 ${eggs.length}`);
        assert.ok(/anim: ['`]bl-[a-z]+/.test(body), `${name} 움직이는 부품`);
    }
    // 대기 힌트(제 움직임 없는 반응 장식) · 미리보기 머리 · 마트 카드 한 줄
    const css = motionCss();
    assert.match(css, /@keyframes bl-egg-hint\{/); assert.match(css, /\[data-bl-egg\]:not\(\[style\*="animation"\]\):not\(\[style\*="transform"\]\)\{animation:bl-egg-hint 6s ease-in-out 1s 3\}/);   // 1.0.1 대개편: 6초에 한 번 · 세 번만 · 엇갈려
    assert.match(read('src/log-copy-sheet.js'), /data-lc-egg hidden>✨ 장식을 눌러 보세요</);
    assert.match(motionStyleFor('<span data-bl-egg="spin">x</span>'), /@keyframes bl-egg-hint/);
    // 표본 글: 대사 · 속마음 · 강조 · 형광펜 · 취소선 · 기울임 · 작은 글 · 소제목 · 구분선 · 상태 줄 + 표본 화면 색으로 그려요
    for (const want of ["say('", "think('", "bold('", "marker('", "del('", "lean('", "small('【", "heading('", 'rule,']) assert.ok(read('tools/mart/sample.mjs').includes(want), `표본 ${want}`);   // 표본은 tools/mart/sample.mjs(부품 고르기 도구와 같이 써요)
    assert.ok(build.includes('screen: SAMPLE_SCREEN') && build.includes("from './mart/sample.mjs'"), '마트 미리보기는 표본 화면 색으로');
});

await test('받기 JSON: 한 번에 넣을 수 있는 만큼(60개)씩 꾸러미로 읽혀요 · 거른 것 0', () => {
    for (let i = 0; i < frames.length; i += MART_ITEMS_MAX) {
        const part = frames.slice(i, i + MART_ITEMS_MAX).map(({ category, categoryLabel, ...f }) => ({ kind: 'geulkku', ...f }));
        const got = readMart(JSON.stringify({ 'bl-mart': 1, items: part }));
        assert.equal(got.error, ''); assert.equal(got.skipped.length, 0, JSON.stringify(got.skipped)); assert.equal(got.items.length, part.length);
    }
});

await test('그리기: 표본 글을 끼우면 자리 표시가 다 채워지고 메시지 셋 · 꼬리 기본 글이 들어가요', () => {
    for (const f of frames) {
        const { item } = checkItem({ kind: 'geulkku', ...f });
        const html = renderLog(SAMPLE, { template: item, ui: UI, fields: { title: 'Seraphina', mark: 'LOG' }, size: 'm' });
        assert.ok(!/\{\{(head|body|info|tail)\}\}/.test(html), `${f.id} 빈 자리`);
        assert.equal((html.match(/data-bl-msg/g) || []).length, 3, `${f.id} 메시지 셋`);
        assert.ok(html.includes('Seraphina'), `${f.id} 제목`);
        const tailText = f.tail.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        assert.ok(html.includes(tailText) || html.includes(f.tail), `${f.id} 꼬리 「${f.tail}」`);
    }
});

await test('글자 대비: 메시지 칸(panel · panel2) 위 본문 · 이름 · 대사 · 속마음 · 강조 · 흐린 글 4.5 이상 · 제목 4.5 · LOG 알약 4.5', () => {
    for (const f of frames) {
        const k = f.colors;
        for (const bg of ['panel', 'panel2']) for (const ink of ['text', 'name', 'dialogue', 'thought', 'emphasis', 'muted']) assert.ok(contrast(k[ink], k[bg]) >= 4.5, `${f.id} ${ink}/${bg} ${contrast(k[ink], k[bg]).toFixed(2)}`);
        assert.ok(contrast(k.text, k.mark) >= 4.5, `${f.id} 형광펜`);
        assert.ok(contrast(k.faceText, k.face) >= 4.5, `${f.id} 제목 ${contrast(k.faceText, k.face).toFixed(2)}`);
        assert.ok(contrast(k.onAccent, k.accent) >= 4.5, `${f.id} LOG 알약`);
        assert.ok(contrast(k.chipText, k.chip) >= 4.5, `${f.id} 알약`);
    }
});

await test('꾸밈 색(11-04 「글자 꾸미기 효과가 다 보여야 함」): 대사 · 속마음 · 강조가 본문색과 · 서로 뚜렷이 다르고 · 형광펜이 칸 바탕과 다르고 그 위 대사(대사 배경 띠) 4.5 · 표본 · 흉내 알약 · 반응', async () => {
    const { de00, hexRgb, DE_BODY, DE_PAIR, MARK_DE, INK_CONTRAST } = await load('tools/mart/geulkku-inks.mjs');
    const d = (a, b) => de00(hexRgb(a), hexRgb(b));
    for (const f of frames) {
        const k = f.colors;
        for (const r of ['dialogue', 'thought', 'emphasis']) assert.ok(d(k[r], k.text) >= DE_BODY - 0.01, `${f.id} ${r} 본문과 ΔE ${d(k[r], k.text).toFixed(1)}`);
        for (const [a, b] of [['dialogue', 'thought'], ['dialogue', 'emphasis'], ['thought', 'emphasis']]) assert.ok(d(k[a], k[b]) >= DE_PAIR - 0.01, `${f.id} ${a}/${b} ΔE ${d(k[a], k[b]).toFixed(1)}`);
        for (const bg of ['panel', 'panel2']) assert.ok(d(k.mark, k[bg]) >= MARK_DE - 0.01, `${f.id} 형광펜/${bg} ΔE ${d(k.mark, k[bg]).toFixed(1)}`);
        assert.ok(contrast(k.dialogue, k.mark) >= INK_CONTRAST, `${f.id} 대사 배경 띠 위 대사 ${contrast(k.dialogue, k.mark).toFixed(2)}`);
    }
    // 표본: 소제목은 대사 화면 색(강조색 굵게) · 여행자 「고마워요.」는 대사 배경 띠(테마 대사 모양 「형광펜」 꼴)
    const sample = read('tools/mart/sample.mjs');
    assert.match(sample, /const heading = t => \(\{[^\n]*'font-weight': '700', color: S\.dialogue/);
    assert.match(sample, /para\(sayBand\('"고마워요\."'\)/);
    // 할로윈 31 도 mart-build 가 같은 규칙으로 벌려요
    assert.match(read('tools/mart-build.mjs'), /const k = spreadInks\(base, \{ given: \{ dialogue: base\.dialogue, thought: base\.thought, emphasis: base\.emphasis, mark: base\.mark \}/);
    // 흉내 알약: 표본 칸 값(Argon · 천사깡 …)도 걷어요
    assert.match(read('tools/mart/convert-sian.mjs'), /const FAKE_PILLS = \[\.\.\.new Set\(\[FIELDS\.mark, FIELDS\.char, FIELDS\.model, FIELDS\.prompt, /);
    // 반응: 부품이 없는 두 틀(카페 소와레 영수증 · 설렘) 말고는 모두 둘 이상
    const few = frames.filter(f => (f.template.match(/data-bl-egg=/g) ?? []).length < 2).map(f => f.id);
    assert.deepEqual(few, ['world-hunter-5', 'c-mood-1']);
});

await test('연결: mart-build 가 이 파일을 글꾸 마트에 올리고 · 테마 시작 묶음(src/)은 이 파일을 모름', () => {
    const build = read('tools/mart-build.mjs');
    assert.match(build, /const SIAN_FILE = 'tools\/mart\/geulkku-sian\.json'/);
    assert.match(build, /const sian = sianItems\(\);\s*items\.push\(\.\.\.sian\.items\); categories\.push\(\.\.\.sian\.categories\.filter\(/);
    for (const file of fs.readdirSync(path.join(root, 'src'), { recursive: true })) {
        if (!/\.(m?js|css|html|json)$/.test(file)) continue;
        assert.ok(!fs.readFileSync(path.join(root, 'src', file), 'utf8').includes('geulkku-sian'), `src/${file} 가 시안 글꾸를 불러요`);
    }
});

const SIAN = process.env.BL_SIAN_DIR || '';   // 시안 원본 폴더(공개 저장소에 경로를 적지 않아요)
// 11-05 1.0.1 관문: 시안 원본 대조는 이 PC 에서 BL_SIAN_CHECK=1 로 켤 때만 — 원본을 다시 그리는 동안 express · 출하 준비(check777)가 막히지 않게
if (process.env.BL_SIAN_CHECK === '1' && SIAN && fs.existsSync(path.join(SIAN, '시안3-만들기.mjs'))) {
    await test('(로컬) 시안 원본에서 다시 옮겨도 같아요(convert-sian.mjs --check)', () => {
        const r = spawnSync(process.execPath, [path.join(root, 'tools/mart/convert-sian.mjs'), '--check', '--sian', SIAN], { encoding: 'utf8' });
        assert.equal(r.status, 0, r.stderr || r.stdout);
    });
} else console.log('SKIP 시안 원본 대조는 BL_SIAN_CHECK=1 · BL_SIAN_DIR(원본 폴더)를 줄 때만 돌아요');

await test('머리(1.0.1 · 11-04): 큰 제목 「Title」 + 알약 셋 「깡통 · 모델 · 프롬프트」(앞 낱말 작게 · 값 굵게 · 옛 LOG 알약 색) — 칸이 비면 그 알약은 숨어요 · 편집용 꼴에 칸마다 주석', async () => {
    const { FIELDS, UI: SUI, SAMPLE: S2, SAMPLE_SCREEN } = await load('tools/mart/sample.mjs');
    const { prettyLogHtml } = await load('src/log-copy-pretty.js');
    assert.equal(FIELDS.title, 'Title'); assert.equal(FIELDS.char, '세라피나'); assert.equal(FIELDS.model, 'Argon'); assert.equal(FIELDS.prompt, '천사깡');
    for (const id of ['concept-subway', 'concept-birthday']) {
        const html = renderLog(S2, { shape: id, ui: SUI, fields: FIELDS, size: 'm', screen: SAMPLE_SCREEN });
        for (const [key, label, value] of [['char', '깡통', '세라피나'], ['model', '모델', 'Argon'], ['prompt', '프롬프트', '천사깡']]) {
            assert.match(html, new RegExp(`>${label}</span><span data-f="${key}" style="[^"]*font-weight:650[^"]*">${value.replace(/[.]/g, '[.]')}</span></span>`), `${id} ${label} 알약`);
        }
        assert.match(html, /data-f="title"[^>]*>Title</, `${id} 큰 제목 Title`);
        const pretty = prettyLogHtml(html, { label: id, fields: false });
        for (const label of ['깡통', '모델', '프롬프트', '제목']) assert.ok(pretty.includes(`<!-- ${label} (글자만 바꿔요) -->`), `${id} 주석 ${label}`);
        const bare = renderLog(S2, { shape: id, ui: SUI, fields: { ...FIELDS, model: '', prompt: '' }, size: 'm', screen: SAMPLE_SCREEN });
        assert.ok(!/data-f="model"|data-f="prompt"/.test(bare) && /data-f="char"/.test(bare), `${id} 빈 칸 알약은 숨겨요`);
    }
    const sheet = read('src/log-copy-sheet.js');
    assert.ok(sheet.includes("title: model.chatTitle || 'Title', mark: 'LOG', char: model.charName || model.chatName, model: names.model, prompt: names.prompt"), '확장은 지금 채팅 값으로 채워요');
    assert.ok(sheet.includes('data-lc="tags" aria-pressed="true"'), '알약 셋 끄고 켜기');
    assert.ok(read('src/log-copy-capture.js').includes('charName: String(character?.name'), '깡통 = 캐릭터 이름');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
