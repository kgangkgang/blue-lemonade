// 1.1.3 로그 복사 「심플」 새 틀 28 전부 — 그리기 · 복사 글 · 소독 · 대사 수(1 · 2 · 10 · 30줄)별 규칙
//   ① 28틀 × (원래 색 · 민트 · 노랑 · 빨강 · 보라) × 낮밤: <style> 하나 · 자리표 0 · 「✎」 주석(겹침 0) · 소독기 통과(주석 · details · 클래스 그대로) · 복사 글
//   ② 대사 수별: 깨지지 않음(태그 짝 · 자리표 · 화자 글자마다 띠 색) · 03 바인더 쪽 나누기 · 05 숨은 한 줄 · 11 · 15 · 17 둘째 소품 색 · 13 형광 띠 · 처음엔 닫힌 틀
//   node tools/tests/log-copy-simple-frames.mjs .
import { assert, load, suite } from './_t.mjs';
import { sanitizedBy } from './_simple-dom.mjs';
const { test, done } = suite('log-copy-simple-frames');

const { SIMPLE_FRAMES, drawSimple, checkFrame } = await load('src/log-copy-simple.js');
const tone = await load('src/log-copy-simple-tone.js');
const { toneLadder } = await load('src/shared/char-tone.js');
const { parseColor } = await load('src/shared/ink-paint.js');
const { liftForCopy, LOG_MARK } = await load('src/log-copy-lift.js');
const { motionStyleFor } = await load('src/log-copy-motion.js');
const { sanitizeTree, safeCss } = await load('src/log-copy-sanitize.js');
const sanitized = sanitizedBy(sanitizeTree);

const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': 'serif', 'font-size': '15px', 'line-height': '24px' };
const band = (hex, text) => { const c = parseColor(hex); return { t: 'el', block: false, tag: 'span', style: { 'background-image': `linear-gradient(transparent 5%, rgba(${c.r}, ${c.g}, ${c.b}, 0.35) 5%, rgba(${c.r}, ${c.g}, ${c.b}, 0.35) 100%, transparent 100%)` }, children: [{ t: 'text', text }] }; };
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children });
const words = text => ({ t: 'text', text });
const msg = (name, nodes) => ({ index: 0, user: false, name, nameStyle: {}, time: null, font: { ...SCREEN }, bubble: null, nodes });
const model = messages => ({ messages, base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, chatTitle: '', charName: '' });
const COLORS = { mint: '#3ccfbf', yellow: '#f0d878', red: '#d9363e', purple: '#b799e8' };
const PEOPLE = [['주연', '#3ccfbf'], ['상대', '#f0d878'], ['셋째', '#b799e8'], ['넷째', null]];
/** 대사 n줄 로그: 사람은 1줄 → 1명 · 2줄 → 2명 · 10줄 → 3명 · 30줄 → 4명(넷째는 색 없음) · 메시지마다 지문 한 줄 + 대사 한 줄 · 주인공 글이 가장 길어요 */
const linesModel = (n, colors = PEOPLE) => {
    const people = colors.slice(0, n === 1 ? 1 : n === 2 ? 2 : n === 10 ? 3 : 4);
    return model(Array.from({ length: n }, (_, i) => {
        const [name, K] = people[i % people.length];
        const say = `「${name}의 ${i + 1}번째 말.」`;
        return msg(name, [para(words(`${i + 1}번째 지문${i % people.length === 0 ? ' — 주인공이라 조금 더 길게 적어요.' : ''}`)), para(K ? band(K, say) : words(say))]);
    }));
};
const sampleModel = (K, K2) => model([
    msg('이름', [para(words('옥상 문을 밀자 젖은 바닥 냄새가 먼저 올라왔다. 이름은 난간에 기대어 하늘을 올려다보았다.')), para(K ? band(K, '「여기 있을 줄 알았어.」') : words('「여기 있을 줄 알았어.」'))]),
    msg('친구', [para(words('친구는 고개를 끄덕였다.')), para(K2 ? band(K2, '「응.」') : words('「응.」'))]),
]);
const styleOf = html => html.match(/<style>([\s\S]*?)<\/style>/)[1];
const balanced = (html) => {
    const body = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<!--[\s\S]*?-->/g, '');
    const stack = [];
    for (const [, close, name] of body.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/g)) {
        if (['br', 'img', 'hr', 'input'].includes(name)) continue;
        if (!close) stack.push(name); else if (stack.pop() !== name) return false;
    }
    return stack.length === 0;
};
const second0 = f => tone.speakerColorsOf(tone.simpleFrameInfo(f.html).color_css)[f.second];

await test('28틀 × (원래 색 · 다른 색 넷) × 낮밤 그리기: 등록 점검 통과 · <style> 하나(감싸는 div 첫 자식) · 자리표 0 · 태그 짝 · 낮밤 뿌리 · ① 기본 규칙 그대로 · safeCss 통과', () => {
    let n = 0;
    for (const f of SIMPLE_FRAMES) {
        assert.deepEqual(checkFrame(f), [], f.key);
        const base0 = styleOf(f.html).replace(/^\n/, '').split('\n\n')[0];
        for (const [name, K] of [['orig', null], ...Object.entries(COLORS)]) for (const mode of ['light', 'dark']) {
            const label = `${f.key} ${name} ${mode}`;
            const { html, cv } = drawSimple(f, sampleModel(K, K ? second0(f) : null), { mode, fields: { title: '제목' } });
            assert.equal((html.match(/<style\b/g) ?? []).length, 1, label);
            assert.match(html, /^<div class="gk [^"]*"><style>/, label);
            assert.ok(!/\{\{[^}]*\}\}/.test(html), `${label} 자리표 0`);
            assert.ok(balanced(html), `${label} 태그 짝`);
            const root = html.match(/^<div class="([^"]*)"/)[1].split(' ');
            assert.deepEqual(root.filter(c => tone.SIMPLE_CONTRACT && ['gk-tl', 'gk-td', 'gk-tx', 'gk-tn-d', 'gk-tn-n'].includes(c)), f.roots[mode].split(' '), `${label} 뿌리`);
            assert.ok(root.includes(cv) && root.includes(`gk-${f.key}`), label);
            assert.equal(root.includes('gk-noaud'), /gk-noaud/.test(f.html.match(/^<div class="([^"]*)"/)[1]), `${label} 소리 없는 판 표시`);
            assert.equal(styleOf(html).replace(/^\n/, '').split('\n\n')[0], base0, `${label} ① 그대로`);
            assert.equal(safeCss(styleOf(html)), styleOf(html), `${label} safeCss`);
            if (name === 'orig') assert.equal(cv, tone.simpleFrameInfo(f.html).cvClass, `${label} 원래 색은 이식판 색 이름`);
            else assert.equal(cv, `gk-cv-${K.slice(1)}`, label);
            n++;
        }
    }
    assert.equal(n, 28 * 5 * 2);
});

await test('다른 색이면 이식판 주인공 색의 톤 사다리 값이 ② ③ 에서 사라져요(사다리 밖 고정값 — 08 밤 · q09 영수증 종이 — 은 그대로)', () => {
    for (const f of SIMPLE_FRAMES) for (const mode of ['light', 'dark']) {
        const { html } = drawSimple(f, sampleModel(COLORS.mint, second0(f)), { mode });
        const color = styleOf(html).replace(/^\n/, '').split('\n\n').slice(1).join('\n').toLowerCase();
        const old = Object.values(toneLadder(f.sample)).filter(hex => !Object.values(toneLadder(second0(f))).includes(hex));
        for (const hex of old) assert.ok(!color.includes(hex) && !color.includes(`%23${hex.slice(1)}`), `${f.key} ${mode} ${hex} 남음`);
    }
});

await test('복사 글(28틀 × 낮밤 × 원래 색 · 민트): liftForCopy 뒤 <style> 하나 · 위아래 코멘트 빈칸 · 안내 한 줄 · ✎ 주석(이식판이 단 q09 · q10 주석과 안 겹침 · 15 공 빛 조각엔 안 닮) · 줄 하나에 항목 하나', () => {
    for (const f of SIMPLE_FRAMES) for (const K of [null, COLORS.mint]) for (const mode of ['light', 'dark']) {
        const label = `${f.key} ${K ?? 'orig'} ${mode}`;
        const { html } = drawSimple(f, sampleModel(K, K ? second0(f) : null), { mode, fields: { title: '제목' } });
        const { full } = liftForCopy(html, motionStyleFor(html));
        assert.equal((full.match(/<style\b/g) ?? []).length, 1, label);
        assert.match(full, new RegExp(`^<p><br></p><div class="gk [^"]*${LOG_MARK}"><style>`), label);
        assert.ok(full.endsWith('</div><p><br></p>'), label);
        assert.equal((full.match(/<!-- ▲ 위 스타일 칸은/g) ?? []).length, 1, `${label} 안내 하나`);
        assert.ok(full.includes(`</style>\n${tone.MARK_HEAD}\n`), `${label} 안내가 <style> 바로 뒤`);
        const marks = full.match(/<!-- ✎ [^>]*-->/g) ?? [];
        assert.ok(marks.filter(m => m === '<!-- ✎ 대사 -->').length === 2 && marks.filter(m => m === '<!-- ✎ 화자 이름 -->').length === 2 && marks.includes('<!-- ✎ 제목 -->'), `${label} ✎ ${marks.length}`);
        assert.ok(!/<!--\s*✎[^>]*-->\s*<!--\s*✎/.test(full), `${label} ✎ 겹침 0`);
        assert.ok(!/<!-- ✎[^>]*-->\s*(?:<!--[^>]*-->\s*)?<!-- ✎/.test(full.replace(/\n/g, ' ').replace(/<!-- (?!✎)[^>]*-->/g, '')), `${label} 이웃 ✎ 0`);
        assert.equal(marks.includes('<!-- ✎ 숨은 한 줄(찻물이 차면 나와요) -->'), !!f.hidden, `${label} 숨은 한 줄 주석은 05 만`);
        for (const line of full.split('</style>')[1].split('\n')) assert.ok(line.length < 4000 || /gk-(hd|top|rl|kx|ft|zc|sea|wv)|<details|<span class="gk-(bc|tc)/.test(line), `${label} 긴 줄은 소품 줄뿐 ${line.slice(0, 80)}`);
    }
});

await test('소독기를 지나도 28틀 글이 한 글자도 안 바뀌어요(낮 · 밤): 「✎」 · 안내 주석 · details · summary · class · <style>', () => {
    for (const f of SIMPLE_FRAMES) for (const mode of ['light', 'dark']) {
        const { html } = drawSimple(f, linesModel(10), { mode, fields: { title: '제목', hidden: '숨은 말' } });
        const out = sanitized(html);
        assert.equal(out, html, `${f.key} ${mode}`);
        assert.ok(out.includes(tone.MARK_HEAD) && out.includes('<!-- ✎ 대사 -->') && /<details\b/.test(out) === /<details\b/.test(f.html), f.key);
    }
});

// ── 대사 수별 규칙 ───────────────────────────────────────────────
for (const n of [1, 2, 10, 30]) {
    await test(`대사 ${n}줄: 28틀 × 낮밤 — 깨지지 않음(태그 짝 · 자리표 0 · 대사 줄 ${n}개) · 화자 글자마다 그 띠 색 규칙이 두 바탕에 다 있어요 · 이름 줄은 사람이 둘 이상일 때만`, () => {
        for (const f of SIMPLE_FRAMES) for (const mode of ['light', 'dark']) {
            const label = `${f.key} ${n}줄 ${mode}`;
            const { html, letters } = drawSimple(f, linesModel(n), { mode, fields: { title: '제목' } });
            assert.ok(balanced(html) && !/\{\{[^}]*\}\}/.test(html), label);
            assert.equal((html.match(/<p class="gk-dl"/g) ?? []).length, n, label);
            assert.equal((html.match(/<p class="gk-nr">/g) ?? []).length, n, label);
            assert.equal((html.match(/<p class="gk-nm /g) ?? []).length, n === 1 ? 0 : n, `${label} 이름 줄`);
            const want = [f.main, f.second, ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(x => x !== f.main && x !== f.second)].slice(0, letters.size);
            assert.deepEqual([...letters.values()], want, `${label} 글자 차례`);
            const css = styleOf(html);
            const image = /\.gk-d[A-Z]\{background-image:/.test(css);
            for (const X of letters.values()) {
                if (image) assert.ok(new RegExp(`\\.gk-d${X}\\{background-image:url\\('data:image/svg\\+xml,`).test(css), `${label} ${X} 그림 띠`);
                else for (const base of ['gk-tl', f.roots.dark.split(' ')[0]]) assert.ok(new RegExp(`\\.${base} \\.gk-d${X}\\{background-color:`).test(css), `${label} ${X} ${base} 띠`);
                if (n > 1) for (const base of ['gk-tl', f.roots.dark.split(' ')[0]]) assert.ok(new RegExp(`\\.${base} \\.gk-nm\\.gk-n${X}[,{]`).test(css), `${label} ${X} ${base} 이름 색`);
            }
            const delays = [...html.matchAll(/ease-out ([\d.]+)s both/g)].map(m => Number(m[1]));
            if (/\{\{지연\}\}/.test(f.rows.대사)) assert.ok(delays.length === n && delays.every(d => d >= 0.2 && d <= 1.2), `${label} 지연 상한`);
        }
    });
}

await test('03 바인더(2쪽 고정): 메시지 하나(지문 + 대사) → 줄 경계에서 한 쪽씩 · 2줄 → 한 줄씩 · 10 · 30줄 → 메시지 경계에서 반씩(두 쪽 다 이름 줄로 시작) · 쪽 번호 글은 그대로', () => {
    const f = SIMPLE_FRAMES.find(x => x.key === 'k3');
    assert.equal(f.pages, 2);
    for (const n of [1, 2, 10, 30]) {
        const { html } = drawSimple(f, linesModel(n), { marks: false });
        const [p1, p2] = [...html.matchAll(/<div class="gk-lg gk-p([12])">\n?([\s\S]*?)<\/div>/g)].map(m => m[2].trim().split('\n').filter(Boolean));
        const talk = list => list.filter(l => l.startsWith('<p class="gk-dl"')).length;
        if (n === 1) { assert.ok(p1.length === 1 && p1[0].startsWith('<p class="gk-nr">'), '첫 쪽 지문'); assert.equal(talk(p2), 1, '둘째 쪽 대사'); }
        else {
            assert.equal(talk(p1) + talk(p2), n);
            assert.ok(Math.abs(talk(p1) - talk(p2)) <= 1, `${n}줄 반씩 ${talk(p1)}/${talk(p2)}`);
            assert.ok(p1[0].startsWith('<p class="gk-nm ') && p2[0].startsWith('<p class="gk-nm '), `${n}줄 두 쪽 다 이름 줄로 시작`);
        }
        assert.ok(html.includes('<span class="gk-n1">1 / 2</span><span class="gk-n2">2 / 2</span>'));
    }
});

await test('05 티백 숨은 한 줄: fields.hidden 이 있으면 그 글(이스케이프) · 없으면 빈 칸 + 「✎ 숨은 한 줄」 주석 · 로그 줄은 로그 칸에만', () => {
    const f = SIMPLE_FRAMES.find(x => x.key === 'k5');
    assert.equal(f.hidden, true);
    for (const n of [1, 30]) {
        const blank = drawSimple(f, linesModel(n), {}).html;
        assert.ok(blank.includes('<!-- ✎ 숨은 한 줄(찻물이 차면 나와요) --><span class="gk-hl"></span>'), `${n}줄 빈 칸`);
        assert.ok(drawSimple(f, linesModel(n), { fields: { hidden: '<b>사실은</b> 기다렸다' } }).html.includes('<span class="gk-hl">&lt;b&gt;사실은&lt;/b&gt; 기다렸다</span>'));
    }
    assert.ok(!SIMPLE_FRAMES.filter(x => x.key !== 'k5').some(x => x.hidden || x.html.includes('{{숨은줄}}')), '숨은 한 줄은 05 만(15 요람의 gk-hl 은 공 빛 조각)');
});

await test('11 실 전화 컵 · 15 요람 공 · 17 바람개비 날개(화자 둘 색 소품): 첫째 = 주인공 색 · 둘째 = 상대 색(상대가 없거나 색을 모르면 시안 그대로) · 셋째부터는 소품 없이 띠 · 이름만', () => {
    const pink = toneLadder('#ff5fa2'), yellow = toneLadder('#f0d878'), mint = toneLadder('#3ccfbf');
    const probes = { k11: ['.gk-c2 .gk-b5{background-color:', 'c500'], k15: ['.gk-bb{background-color:', 'c500'], k17: ['.gk-w2{background-color:', 'c500'] };
    const firstProbe = { k11: ['.gk-c1 .gk-b5{background-color:', 'c500'], k15: ['.gk-ba{background-color:', 'c500'], k17: ['.gk-w1{background-color:', 'c500'] };
    for (const [key, [sel, step]] of Object.entries(probes)) {
        const f = SIMPLE_FRAMES.find(x => x.key === key);
        for (const n of [1, 2, 10, 30]) {
            const css = styleOf(drawSimple(f, linesModel(n), { mode: 'light' }).html);
            assert.ok(css.includes(`${sel}${n === 1 ? pink[step] : yellow[step]}}`), `${key} ${n}줄 둘째 소품 ${n === 1 ? '시안 분홍' : '상대 노랑'}`);
            assert.ok(css.includes(`${firstProbe[key][0]}${mint[firstProbe[key][1]]}}`), `${key} ${n}줄 첫째 소품 주인공 민트`);
        }
        const unknown = styleOf(drawSimple(f, linesModel(2, [['주연', '#3ccfbf'], ['상대', null]]), { mode: 'light' }).html);
        assert.ok(unknown.includes(`${sel}${pink[step]}}`), `${key} 상대 색을 모르면 시안 분홍`);
    }
    // 15 요람: 공이 칠 때 띠 번쩍임(키프레임)도 그 화자 색으로
    const k15 = styleOf(drawSimple(SIMPLE_FRAMES.find(x => x.key === 'k15'), linesModel(2), { mode: 'light' }).html);
    assert.ok(/@keyframes gk-ba-tl\{[^}]*rgba\(60,207,191,/.test(k15) && /@keyframes gk-bb-tl\{[^}]*rgba\(240,216,120,/.test(k15), '15 띠 번쩍임 키프레임 색');
});

await test('13 형광펜: 대사 띠는 화자마다 그림 띠(셋째부터는 주인공 그림 띠를 그 사람 색으로) · 1 · 30줄에서도 「첫 줄 · 나머지 줄」 차례 규칙 그대로 · 띠 바탕색 규칙 0', () => {
    const f = SIMPLE_FRAMES.find(x => x.key === 'k13');
    for (const n of [1, 2, 10, 30]) {
        const css = styleOf(drawSimple(f, linesModel(n), { mode: 'dark' }).html);
        assert.ok(css.includes('.gk-k13:has(.gk-kx[open]) .gk-dl~.gk-dl .gk-d{transition-delay:1.15s}'), `${n}줄 차례 규칙`);
        assert.ok(!/\.gk-d[A-Z]\{background-color:(?!transparent)/.test(css), `${n}줄 띠 바탕색 규칙 0`);
        assert.ok(css.includes('rgb%2860,207,191%29'), `${n}줄 주인공 민트 그림 띠`);
        if (n >= 10) assert.ok(/\.gk-dC\{background-image:[^}]*rgb%28183,153,232%29/.test(css) && css.includes('.gk-k13 .gk-dC{background-color:transparent;background-repeat:no-repeat;background-position:0 0;background-size:0% 100%;'), `${n}줄 셋째 보라 그림 띠 · 처음엔 0% 로 숨었다가 열면 그어져요`);
        if (n === 30) assert.ok(/\.gk-dD\{background-image:[^}]*rgb%28139,142,150%29/.test(css), '넷째(색 없음) 무채 그림 띠');
    }
});

await test('처음엔 닫힌 틀(01 · 08 · 09 · 10 · 14 · 18 · q06): 여는 칸은 grid 0fr → 1fr · details 라 줄 수와 상관없이 다 펼쳐져요(높이 고정 · max-height 0) · 미리보기 열림 표시는 첫 details 하나', () => {
    const closed = SIMPLE_FRAMES.filter(f => f.open).map(f => f.key);
    assert.deepEqual(closed, ['k1', 'k8', 'k09', 'k10', 'k14', 'k18', 'q06']);
    for (const f of SIMPLE_FRAMES) {
        const css = styleOf(f.html);
        assert.ok(!/max-(?:height|block-size)\s*:/.test(css), `${f.key} max-height 없음`);
        const { html } = drawSimple(f, linesModel(30), {});
        const peeked = tone.peekSimple(html, f.peek);
        assert.equal((peeked.match(/data-bl-peek/g) ?? []).length, f.peek && /<details\b/.test(html) ? 1 : 0, f.key);
    }
});

done();
