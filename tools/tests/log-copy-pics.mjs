// 11-14 로그 복사 「글 속 그림」 — 고른 글의 그림을 그 메시지 맨 앞에(사진 꼴: 둥근 모서리 · 칸 폭 가득) · 실리태번 주소는 깡통에 올린 주소로만 · 번호표 숨김 규칙.
//   그림이 없으면 복사 글이 한 글자도 안 바뀌어요(모든 틀).
//   node tools/tests/log-copy-pics.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('log-copy-pics');

const P = await load('src/log-copy-pics.js');
const { renderLog, PRESETS } = await load('src/log-copy-presets.js');
const { nodesHtml, logHtml } = await load('src/log-copy-render.js');
const { liftForCopy } = await load('src/log-copy-lift.js');
const { SIMPLE_FRAMES } = await load('src/log-copy-simple.js');
const setMod = await load('src/log-copy-simple-set.js');
const { BASIC_IDS } = await load('src/log-copy-basic.js');

const ORIGIN = 'http://127.0.0.1:8000';
const LOCAL = `${ORIGIN}/characters/someone/smile.png`;
const LOCAL2 = `${ORIGIN}/user/images/someone/gen_1.png`;
const PUBLIC = 'https://example.org/art/scene.webp';
const KK = 'https://img.kkangtong.xyz/post-images/uploads/aaaa-bbbb.jpg';
const KK2 = 'https://img.kkangtong.xyz/post-images/uploads/cccc-dddd.jpg';

const SCREEN = { color: 'rgb(225, 225, 229)', 'font-family': 'serif', 'font-size': '15px', 'line-height': '24px' };
const band = (rgb, text) => ({ t: 'el', block: false, tag: 'span', style: { 'background-image': `linear-gradient(transparent 5%, rgba(${rgb}, 0.35) 5%, rgba(${rgb}, 0.35) 100%, transparent 100%)` }, children: [{ t: 'text', text }] });
const para = (...children) => ({ t: 'el', block: true, tag: 'div', style: { ...SCREEN }, children });
const w = text => ({ t: 'text', text });
const msg = (name, user, nodes, pics) => ({ index: 0, user, name, nameStyle: {}, time: null, font: { ...SCREEN }, bubble: null, nodes, ...(pics ? { pics: pics.map(src => ({ src })) } : {}) });
const MODEL = {
    chatName: '가', userName: '나', base: { ...SCREEN, bg: 'rgb(28, 30, 33)' }, images: [],
    messages: [
        msg('가', false, [para(band('0, 160, 140', '「등불을 켤게요.」')), para(w('그는 문을 열었다.'))], [LOCAL]),
        msg('나', true, [para(band('200, 120, 0', '「응.」'))]),
        msg('가', false, [para(w('바람이 불었다. ')), para(band('0, 160, 140', '「들어와요.」'))], [LOCAL2, PUBLIC, LOCAL]),
    ],
};
const PLAIN = { ...MODEL, messages: MODEL.messages.map(({ pics, ...m }) => m) };
const count = (html, needle) => html.split(needle).length - 1;
const IN_P = /<p\b[^>]*>(?:(?!<\/p>)[\s\S])*?class="blq-pic"/;   // 여는 <p> 와 그 </p> 사이에 그림 칸(붙인 곳에서 문단이 쪼개져요)

await test('올릴 그림 · 바로 넣는 그림 가르기: 실리태번 주소 · data: · http · 내부망은 올리고, 밖 공개 https 만 그대로', () => {
    assert.equal(P.needsUpload(LOCAL, ORIGIN), true);
    assert.equal(P.needsUpload('https://my-st.example.net/characters/a.png', 'https://my-st.example.net'), true, '실리태번을 공개 주소로 열어도 같은 곳이면 올려요');
    assert.equal(P.needsUpload('data:image/png;base64,AAAA', ORIGIN), true);
    assert.equal(P.needsUpload('http://example.org/a.png', ORIGIN), true);
    for (const host of ['192.168.0.5', '10.1.2.3', '172.20.0.1', '100.100.1.1', 'localhost', 'pc.local', 'box.tail1234.ts.net', '[::1]']) assert.equal(P.needsUpload(`https://${host}/a.png`, ORIGIN), true, host);
    assert.equal(P.needsUpload(PUBLIC, ORIGIN), false);
    assert.equal(P.needsUpload(KK, ORIGIN), false);
    const list = P.picList(MODEL, ORIGIN);
    assert.deepEqual(list.map(p => [p.upload, p.n]), [[true, 1], [true, 2], [false, 0]], '같은 주소는 한 번 · 올릴 그림만 번호');
});

await test('붙인 주소 없으면: 올릴 그림은 빠지고 공개 주소만 · 아무 그림도 없으면 모델 그대로', () => {
    const none = P.attachPics(PLAIN, { origin: ORIGIN });
    assert.equal(none, PLAIN, '그림 없는 로그는 같은 객체');
    const onlyLocal = { ...PLAIN, messages: [msg('가', false, [para(w('글'))], [LOCAL])] };
    assert.equal(P.attachPics(onlyLocal, { origin: ORIGIN }), onlyLocal, '주소를 안 붙이면 모델 그대로(복사 글 그대로)');
    const got = P.attachPics(MODEL, { origin: ORIGIN });
    assert.deepEqual(got.messages.map(m => m.nodes.filter(n => n.t === 'pic').map(n => n.src)), [[], [], [PUBLIC]]);
    assert.equal(P.attachPics(MODEL, { origin: ORIGIN, off: true }), MODEL, '끄면 그대로');
    assert.equal(P.attachPics(MODEL, { origin: ORIGIN, allow: () => false }).messages[2].nodes.some(n => n.t === 'pic'), false, '이름 숨김으로 막힌 공개 주소는 빼요');
});

await test('붙인 주소 차례 = 올릴 그림 번호 차례 · 같은 그림은 같은 주소 · 메시지 맨 앞', () => {
    const got = P.attachPics(MODEL, { origin: ORIGIN, codes: [KK, KK2] });
    const pics = got.messages.map(m => m.nodes.filter(n => n.t === 'pic').map(n => n.src));
    assert.deepEqual(pics, [[KK], [], [KK2, PUBLIC, KK]]);
    for (const m of got.messages) { const i = m.nodes.findIndex(n => n.t !== 'pic'); assert.ok(m.nodes.slice(0, i < 0 ? m.nodes.length : i).every(n => n.t === 'pic')); }
    assert.equal(MODEL.messages[0].nodes.length, 2, '받은 모델은 안 바뀌어요');
    const half = P.attachPics(MODEL, { origin: ORIGIN, codes: [KK] });
    assert.deepEqual(half.messages[2].nodes.filter(n => n.t === 'pic').map(n => n.src), [PUBLIC, KK], '2번을 아직 안 붙였으면 그 그림만 빠져요');
});

await test('그림 칸 HTML: 둥근 모서리 · 칸 폭 가득 · 줄 높이 0 · alt 는 「업로드 이미지」 · 위험한 주소는 빈 글', () => {
    const html = P.picHtml({ src: KK });
    assert.match(html, /^<div class="blq-pic" data-bl-pic style="[^"]*line-height:0[^"]*text-indent:0[^"]*"><img src="https:\/\/img\.kkangtong\.xyz\/[^"]+" alt="업로드 이미지" loading="lazy" style="display:block;width:100%;max-width:100%;height:auto;margin:0;border-radius:8px"><\/div>$/);
    assert.equal(P.picHtml({ src: 'javascript:alert(1)' }), '');
    assert.equal(P.picHtml({ src: '/characters/a.png' }), '');
    assert.ok(!P.picHtml({ src: 'https://x.org/a.png?"><script>' }).includes('"><script>'), '주소 안 따옴표는 이스케이프');
});

await test('「그대로」 · 내장 틀 · 깡통 로그 틀: 그림 칸이 메시지 맨 앞에(첫 메시지면 로그 상자 맨 위 쪽) · 그림 없으면 글 그대로', () => {
    const withPics = P.attachPics(MODEL, { origin: ORIGIN, codes: [KK, KK2] });
    const ids = PRESETS.filter(p => !p.images && !p.basic && !p.simple).map(p => p.id);
    assert.ok(ids.length >= 4, '깡통 로그 셋 · 그대로 · 상태창');
    const colors = { bg: '#1c1e21', surface: '#24262a', text: '#e1e1e5', muted: '#9a9da6', line: '#33363b', accent: '#7ab8ff', marker: '#7ab8ff', pop: '#ffcc66', raised: '#2a2c30' };
    for (const shape of ['plain', ...ids]) {
        const o = { shape, colors: shape === 'plain' ? null : colors, mode: 'dark' };
        const base = renderLog(PLAIN, o), withNone = renderLog({ ...MODEL }, o), html = renderLog(withPics, o);
        assert.equal(withNone, base, `${shape}: pics 자료만 있고 붙인 그림이 없으면 글 그대로`);
        assert.equal(count(html, 'class="blq-pic"'), 4, `${shape}: 그림 칸 넷(1 + 3)`);
        assert.ok(html.indexOf(KK) < html.indexOf('등불을 켤게요'), `${shape}: 첫 메시지 그림이 그 글 앞`);
        assert.ok(html.indexOf(KK2) > html.indexOf('응.') && html.indexOf(KK2) < html.indexOf('바람이 불었다'), `${shape}: 셋째 메시지 그림은 그 메시지 앞`);
    }
});

await test('받은 심플 글꾸 · 블루레몬 추천 28틀 × 낮 · 밤: 그림 줄이 메시지 앞 · 표지(rows) 걷으면 같은 글 · 그림 없으면 글 그대로', async () => {
    const { stripRowMarks } = await load('src/log-copy-spoiler.js');
    const withPics = P.attachPics(MODEL, { origin: ORIGIN, codes: [KK, KK2] });
    let n = 0;
    for (const f of SIMPLE_FRAMES) for (const mode of ['dark', 'light']) {
        const mine = { id: `t-${f.key}`, name: f.label, frame: f, set: { blGeulkku: 2 } };
        const o = { simple: mine, setMod, mode, fields: { title: '제목' }, names: true, lemonLink: true };
        assert.equal(renderLog(MODEL, o), renderLog(PLAIN, o), `${f.key} ${mode}: 붙인 그림이 없으면 그대로`);
        const html = renderLog(withPics, o);
        assert.equal(count(html, 'class="blq-pic"'), 4, `${f.key} ${mode}`);
        assert.ok(html.indexOf(KK) < html.indexOf('등불을 켤게요'), `${f.key}: 첫 메시지 그림이 글 앞`);
        assert.ok(html.indexOf(KK2) < html.indexOf('바람이 불었다'), `${f.key}: 셋째 메시지 그림이 글 앞`);
        assert.ok(!IN_P.test(html), `${f.key}: 그림 칸이 <p> 안에 들어가지 않아요`);
        assert.equal(stripRowMarks(renderLog(withPics, { ...o, rows: true })), html, `${f.key} ${mode}: 미리보기 표지를 걷으면 복사 글과 같아요`);
        n++;
    }
    assert.equal(n, SIMPLE_FRAMES.length * 2);
    // 블루레몬 추천 판(마트 틀 — 줄 갈래 · 칸 묶음 · 두 쪽 틀 포함)
    const { loadPicks } = await load('src/log-copy-picks.js');
    const picks = await loadPicks();
    assert.ok(picks.length >= 20, `추천 판 ${picks.length}`);
    for (const p of picks) for (const mode of ['dark', 'light']) {
        const o = { simple: { id: p.id, name: p.name, frame: p.frame, set: { blGeulkku: 2 } }, setMod, mode, fields: { title: '제목' }, names: true, lemonLink: true };
        assert.equal(renderLog(MODEL, o), renderLog(PLAIN, o), `${p.id} ${mode}: 그대로`);
        const html = renderLog(withPics, o);
        assert.equal(count(html, 'class="blq-pic"'), 4, `${p.id} ${mode}`);
        assert.ok(!IN_P.test(html), `${p.id}: <p> 안 그림 칸 0`);
        assert.ok(html.indexOf(KK) < html.indexOf('등불을 켤게요'), `${p.id}: 첫 그림이 글 앞`);
        assert.equal(stripRowMarks(renderLog(withPics, { ...o, rows: true })), html, `${p.id} ${mode}: 표지 걷으면 같아요`);
    }
});

await test('기본 글꾸 새 틀(갤러리 빼고): 지문 자리 그림은 그림 칸으로 · <p> 안에 남는 그림 칸 0 · 남은 표지 0 · 그림 없으면 글 그대로', () => {
    const withPics = P.attachPics(MODEL, { origin: ORIGIN, codes: [KK, KK2] });
    const placedBy = new Map();
    for (const id of BASIC_IDS.filter(x => !x.startsWith('gallery'))) for (const mode of ['dark', 'light']) {
        const o = { shape: id, mode };
        assert.equal(renderLog(MODEL, o), renderLog(PLAIN, o), `${id} ${mode}`);
        const html = renderLog(withPics, o);
        assert.ok(!html.includes('<!--blpic:'), `${id}: 표지가 남지 않아요`);
        assert.ok(!IN_P.test(html), `${id}: <p> 안 그림 칸 0`);
        const placed = count(html, 'class="blq-pic"');
        placedBy.set(id, placed);
        if (placed) assert.ok(html.indexOf(KK) < html.indexOf('등불을 켤게요'), `${id}: 그림이 글 앞`);
    }
    console.log('  기본 글꾸 새 틀 그림 칸 수(4 가 다 들어간 것):', [...placedBy].map(([k, v]) => `${k} ${v}`).join(' · '));
});

await test('갤러리 틀 · 마크다운 · 글만: 글 속 그림 노드를 넣어도 깨지지 않아요(마크다운 · 글에는 그림 줄 없음)', async () => {
    const { logMarkdown, logText } = await load('src/log-copy-render.js');
    const withPics = P.attachPics(MODEL, { origin: ORIGIN, codes: [KK, KK2] });
    assert.equal(logMarkdown(withPics), logMarkdown(PLAIN));
    assert.equal(logText(withPics), logText(PLAIN));
    assert.ok(nodesHtml(withPics.messages[0].nodes).startsWith('<div class="blq-pic"'));
    assert.ok(logHtml(withPics).includes(KK));
});

await test('검토 보1 · 사2: 붙인 코드도 같은 검사 — 실리태번 · 내부망 · IP · file: · data: · 상대 주소는 거절(번호 자리는 지켜요) · 깡통 · 공개 https 만', () => {
    for (const host of ['mypc', 'nas.home.arpa', 'box.localdomain', '[::ffff:192.168.0.1]', '[2001:db8::1]', '8.8.8.8', 'printer.lan']) assert.equal(P.needsUpload(`https://${host}/a.png`, ORIGIN), true, host);
    assert.equal(P.needsUpload('https://user:pw@example.org/a.png', ORIGIN), true, '주소 안 사용자 이름');
    assert.equal(P.needsUpload('https://127.0.0.1:9443/a.png', 'http://127.0.0.1:8000'), true, '실리태번과 같은 호스트(다른 문)');
    const bads = [`${ORIGIN}/characters/Someone/smile.png`, 'http://192.168.0.5:8000/characters/Someone/smile.png', 'file:///C:/pics/a.png', 'data:image/png;base64,AAAA', '/characters/a.png', 'https://192.168.0.5/a.png'];
    for (const code of bads) {
        const got = P.attachPics(MODEL, { origin: ORIGIN, codes: [code, KK2] });
        const srcs = got.messages.flatMap(m => m.nodes.filter(n => n.t === 'pic').map(n => n.src));
        assert.ok(!srcs.includes(code), `${code} 는 안 들어가요`);
        assert.ok(srcs.includes(KK2), `${code}: 뒤 번호(2번)는 제자리`);
        const plan = P.picPlan(MODEL, { origin: ORIGIN, codes: [code, KK2] });
        assert.deepEqual(plan.bad, [1], code);
        assert.equal(plan.items.find(x => x.n === 1).why, 'bad');
    }
    assert.equal(P.attachPics(MODEL, { origin: ORIGIN, codes: [KK, KK2], allow: s => s !== KK }).messages[0].nodes.some(n => n.t === 'pic'), false, '이름 숨김은 붙인 코드에도');
    assert.equal(P.picPlan(MODEL, { origin: ORIGIN, codes: [KK], allow: s => s !== PUBLIC }).items.find(x => !x.upload).why, 'hidden', '칸 요약용 판단');
});

await test('코드 칸 글 읽기: <img> 코드 차례 그대로 · 거를 주소도 자리 지킴 · 따옴표 셋 · 줄 주소', () => {
    assert.deepEqual(P.codesFrom(`<p><img src="${KK}" class="uploaded-image"></p><img alt=x src='file:///C:/a.png'><img src=${KK2}>`), [KK, 'file:///C:/a.png', KK2]);
    assert.deepEqual(P.codesFrom(`${KK}\n http://192.168.0.5/a.png \n글 한 줄\n${KK2}`), [KK, 'http://192.168.0.5/a.png', KK2]);
    assert.deepEqual(P.codesFrom(`<img src="${KK}?a=1&amp;b=2">`), [`${KK}?a=1&b=2`]);
    assert.deepEqual(P.codesFrom(''), []);
});

await test('검토 보2: 지문만 있는 메시지(메신저 틀 포함) · 사7: 원본 크기를 알면 aspect-ratio', () => {
    const only = { ...PLAIN, messages: [msg('가', false, [para(w('첫 지문.')), para(w('둘째 지문.'))], [LOCAL]), msg('나', true, [para(w('내 지문.'))], [LOCAL2])] };
    only.messages[0].pics[0] = { src: LOCAL, w: 800, h: 600 };
    const got = P.attachPics(only, { origin: ORIGIN, codes: [KK, KK2] });
    for (const id of BASIC_IDS.filter(x => !x.startsWith('gallery'))) for (const mode of ['dark', 'light']) {
        const html = renderLog(got, { shape: id, mode });
        assert.equal(count(html, 'class="blq-pic"'), 2, `${id} ${mode}: 둘 다 들어가요`);
        assert.ok(!IN_P.test(html), `${id}: <p> 안 0`);
        assert.ok(!html.includes('<!--blpic:'), `${id}: 표지 0`);
        assert.ok(html.indexOf(KK) < html.indexOf('첫 지문.') && html.indexOf(KK2) < html.indexOf('내 지문.'), `${id}: 글 앞`);
        assert.ok(html.includes('aspect-ratio:auto 800/600'), `${id}: 비율`);
        if (id === 'messenger') assert.ok(/첫 지문\.<br>둘째 지문\./.test(html), '메신저: 말풍선 글 줄은 그대로');
    }
    assert.ok(!P.picHtml({ src: KK }).includes('aspect-ratio'), '크기를 모르면 예전 그대로');
    assert.ok(P.picHtml({ src: KK, w: 832, h: 1216 }).includes('aspect-ratio:auto 832/1216;'));
});

await test('검토 보3: 글 없이 그림만 있는 메시지 — 그림이 들어가면 그림만으로 그려요(모든 틀) · 안 들어가면 빈 메시지로 남아도 깨지지 않아요', () => {
    const pic = { ...PLAIN, messages: [PLAIN.messages[0], msg('가', false, [], [LOCAL2]), PLAIN.messages[1]] };
    const got = P.attachPics(pic, { origin: ORIGIN, codes: [KK] });
    assert.equal(got.messages[1].nodes.length, 1);
    const colors = { bg: '#1c1e21', surface: '#24262a', text: '#e1e1e5', muted: '#9a9da6', line: '#33363b', accent: '#7ab8ff', marker: '#7ab8ff', pop: '#ffcc66', raised: '#2a2c30' };
    for (const shape of ['plain', 'kkangtong', 'kkangtong-mini', 'kkangtong-deep', 'status', ...BASIC_IDS.filter(x => !x.startsWith('gallery'))]) {
        const html = renderLog(got, { shape, colors: shape === 'plain' ? null : colors, mode: 'dark' });
        assert.equal(count(html, 'class="blq-pic"'), 1, shape);
        assert.ok(html.indexOf(KK) > html.indexOf('등불을 켤게요') && html.indexOf(KK) < html.indexOf('응.'), `${shape}: 둘째 자리`);
        assert.ok(renderLog({ ...pic, messages: pic.messages.map(m => (m.nodes.length ? m : { ...m, name: '' })) }, { shape, colors: shape === 'plain' ? null : colors, mode: 'dark' }).length > 0, `${shape}: 빈 메시지`);
    }
    for (const f of SIMPLE_FRAMES) {
        const html = renderLog(got, { simple: { id: 't', name: f.label, frame: f, set: { blGeulkku: 2 } }, setMod, mode: 'dark', fields: { title: '제목' } });
        assert.equal(count(html, 'class="blq-pic"'), 1, f.key);
    }
});

await test('복사 글 머리 <style>: 그림 칸이 있을 때만 깡통 번호표 숨김 규칙(그림 칸 안만 — 갤러리 번호표 규칙은 그대로)', () => {
    const withPics = P.attachPics(MODEL, { origin: ORIGIN, codes: [KK, KK2] });
    const a = liftForCopy(renderLog(withPics, { shape: 'plain' }));
    assert.ok(a.head.includes(P.PIC_RULE), '규칙 있음');
    assert.ok(a.full.includes('class="blq-pic"'));
    assert.ok(P.PIC_RULE.split('}').filter(Boolean).every(r => r.startsWith('.blq-pic ')), '그림 칸 안으로만 좁혀요');
    const b = liftForCopy(renderLog(PLAIN, { shape: 'plain' }));
    assert.ok(!b.head.includes('image-number'), '그림이 없으면 규칙 없음(글 그대로)');
});

done();
