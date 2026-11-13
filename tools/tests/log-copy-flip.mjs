// 로그 복사 「전환 넣기」(복사 글의 해 · 달 낮밤 전환) — DOM 없는 부분
//   ① 공용 함수 사본(src/log-copy-day-night.js)이 글꾸 마트 mart/day-night.js 와 같은 글인지(해시 잠금) — 마트에서 만든 글과 테마에서 만든 글의 전환이 똑같이 움직이게
//   ② 되는 글꾸(블루레몬 추천 32판 · 받은 심플 글꾸 · 기본 글꾸 새 틀 18) / 안 되는 글꾸(깡통 로그 틀 묶음 · 한 판뿐인 틀 · 붙여 넣은 HTML) 가르기
//   ③ 복사 글에 전환이 하나 · 두 번 달리지 않음 · 서식 글과 코드 글 둘 다 · 코멘트 범위 표시는 바깥 뿌리로 · 알약에 보이는 글자 없음
//   ④ 기본 글꾸 새 틀 이름 맞춤이 기대는 약속(그 이름은 선택자에만 · 뿌리 밖에 낮밤 class 없음)
//   ⑤ 꺼 두면 복사 글을 만드는 길이 그대로(시트가 켰을 때만 지나요) · 늦게 받기 · 시작 그래프 밖 · 설정 꼴 그대로
//   화면(깡통 붙임 흉내에서 낮 → 밤 → 낮의 계산된 색 · 크기)은 tools/tests/log-copy-flip-browser.mjs(헤드리스 브라우저가 있을 때).
//   node tools/tests/log-copy-flip.mjs <테마 루트>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assert, root, load, suite } from './_t.mjs';

const t = suite('log-copy-flip');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const flip = await load('src/log-copy-flip.js');
const { addToggle } = await load('src/log-copy-day-night.js');
const { renderLog, PRESETS } = await load('src/log-copy-presets.js');
const { BASIC_IDS } = await load('src/log-copy-basic.js');
const { loadPicks, pickEntry } = await load('src/log-copy-picks.js');
const { readMart, addMartItems } = await load('src/mart-import.js');
const setMod = await load('src/log-copy-simple-set.js');
const caps = await load('src/geulkku-mart/caps-table.js');
const { liftForCopy, copyBody, insertHead, withCommentSlots, byteSize, POST_LIMIT } = await load('src/log-copy-lift.js');
const { prettyLogHtml } = await load('src/log-copy-pretty.js');
const { stripRowMarks } = await load('src/log-copy-spoiler.js');
const { motionStyleFor } = await load('src/log-copy-motion.js');
const picks = await loadPicks();
const more = JSON.parse(read('tools/tests/fixtures/mart-more-sample.json'));

const text = s => ({ t: 'text', text: s });
const band = s => ({ t: 'el', block: false, style: { 'background-image': 'linear-gradient(#ffd, #ffd)' }, children: [text(s)] });
const MODEL = { base: { color: '#dddddd', bg: '#111111' }, chatTitle: '비 그친 뒤', messages: [
    { name: '깡통', time: 1, nodes: [text('창밖을 보았다.'), { t: 'br' }, band('「비가 그쳤네.」')] },
    { name: '깡캐', time: 2, nodes: [band('「응, 나가 볼까?」'), { t: 'hr' }, text('그리고 지문.')] },
    { name: '셋째', time: 3, nodes: [text('셋째 사람 지문.'), { t: 'hr' }, band('「셋째 대사.」')] },
] };
const lookup = name => ({ 깡통: '#e05a5a', 깡캐: '#3c9b5f' })[name] ?? null;
const FIELDS = { title: '비 그친 뒤', mark: 'LOG', model: '모델', prompt: '프롬프트', char: '깡통' };
const other = mode => (mode === 'light' ? 'dark' : 'light');
// 시트가 그리는 그대로(log-copy-sheet.js draw 의 두 갈래)
const simpleDraw = (mine, mode, o = {}) => renderLog(o.model ?? MODEL, { simple: mine, setMod, caps: caps.capsRow(mine.frame.key), mode, lookup, fields: { title: FIELDS.title }, names: true, lemonLink: !!o.lemon, rows: true });
const basicDraw = (shape, mode, o = {}) => renderLog(o.model ?? MODEL, { shape, fields: FIELDS, images: o.images ?? [], names: true, lemonLink: !!o.lemon, mode, lookup, info: o.info ?? 'off', height: o.height ?? '', marks: true });
// 시트의 복사 글 두 벌(글자 길 — 서식 · 코드)
const pack = (html, simple, label = '틀') => {
    const shown = simple ? stripRowMarks(html) : html, lifted = liftForCopy(shown, motionStyleFor(shown));
    return { full: lifted.full, code: withCommentSlots(prettyLogHtml(insertHead(copyBody(shown).html, lifted.head), { label, head: '' })) };
};
const received = (key) => {
    const raw = more.items[key], s = { logCopy: { custom: [] } };
    const got = readMart(JSON.stringify({ 'bl-mart': 1, items: [{ kind: 'geulkku-simple', v: 1, id: `simple-${key}`, key, name: raw.name, html: raw.html, set: { blGeulkku: 2 } }] }));
    assert.equal(got.items.length, 1, `${key}: ${got.skipped.map(x => x.reason).join(' · ')}`);
    addMartItems(s, got.items);
    return JSON.parse(JSON.stringify(s.logCopy.custom[0]));
};
const wraps = h => (h.match(/<div class="gkt gkt-/g) || []).length;
const styles = h => (h.match(/<style\b/g) || []).length;
/** 되는 글꾸 하나를 낮 · 밤 처음 판으로: 계획이 서고 · 복사 글 두 벌에 전환이 하나씩 · 다시 걸면 거절 */
const good = (where, draw, simple) => {
    for (const mode of ['light', 'dark']) {
        const now = draw(mode), { full, code } = pack(now, simple);
        const plan = flip.flipPlan({ now, other: draw(other(mode)), mode, full });
        assert.ok(plan, `${where} ${mode}: 전환 계획`);
        assert.equal(plan.mode, mode);
        assert.ok(plan.tone.light.length && plan.tone.dark.length, `${where}: 낮밤 class`);
        assert.ok(plan.add > 5000 && plan.add < 9500, `${where} ${mode}: 늘어난 바이트 ${plan.add}`);
        assert.equal(plan.over, false);
        for (const [kind, src] of [['서식', full], ['코드', code]]) {
            const out = flip.flipCopy(src);
            assert.ok(out, `${where} ${mode} ${kind}: 전환이 달려요`);
            assert.equal(wraps(out), 1, `${where} ${kind}: 전환 뿌리 하나`);
            assert.equal((out.match(/<details class="gkt-k">/g) || []).length, 1, `${where} ${kind}: 알약 하나`);
            assert.equal(styles(out), styles(src), `${where} ${kind}: <style> 수 그대로`);
            assert.equal(flip.flipCopy(out), null, `${where} ${kind}: 두 번 달리지 않아요`);
            assert.ok(out.startsWith('<p><br></p>') && out.endsWith('<p><br></p>'), `${where} ${kind}: 위아래 코멘트 빈칸 그대로`);
            // 코멘트 글줄 규칙은 「.content 직속 로그 틀(blq-log)」을 봐요 — 표시는 전환을 감싼 바깥 뿌리에 하나만
            assert.match(out, /<div class="gkt gkt-[kq]\d+ blq-log">/, `${where} ${kind}: 바깥 뿌리에 blq-log`);
            assert.equal((out.replace(/<style>[\s\S]*?<\/style>/g, '').match(/blq-log/g) || []).length, 1, `${where} ${kind}: blq-log 하나`);
            assert.ok(byteSize(out) - byteSize(src) > 5000);
        }
    }
};

await t.test('① 공용 함수 사본: 글꾸 마트 mart/day-night.js(허브 전환.mjs)와 같은 글 — 고칠 때는 허브 원본 · 마트 · 테마 셋을 같이 바꾸고 이 해시를 고쳐요', () => {
    const body = read('src/log-copy-day-night.js').replace(/\r\n/g, '\n');
    assert.equal(crypto.createHash('sha256').update(body).digest('hex'), '5fc107499709327dfd539a0322755c43b5af5d3fe406657e5fd8c7efa5cef684');
    assert.equal(typeof addToggle, 'function');
    // 11-13 해 · 달 둘 다 테마 파랑(고른 쪽 = 옅은 파랑 칸 + 파랑 아이콘 · 안 고른 쪽 = 바탕 없는 회색) — 해만 따로 칠하는 값(호박색 해 · 흰 칸)이 남으면 실패
    assert.ok(!/#E8A100|#FFFFFF|#2F3742|#D5DDE7|#4A5564/i.test(body), '해 전용 색(호박색 해 · 흰 칸 · 그 테)이 남았어요');
});

await t.test('② 되는 글꾸: 블루레몬 추천 32판 × 낮밤 — 계획이 서고 복사 글(서식 · 코드)에 전환 하나 · 다시 걸면 거절 · 코멘트 표시는 바깥 뿌리', () => {
    assert.equal(picks.length, 32);
    for (const p of picks) good(p.id, mode => simpleDraw(pickEntry(picks, [], p.id, () => ({ custom: [] })), mode, { lemon: true }), true);
});

await t.test('② 되는 글꾸: 마트에서 받은 심플 글꾸 표본 9틀(받는 길 그대로) × 낮밤', () => {
    assert.equal(Object.keys(more.items).length, 9);
    for (const key of Object.keys(more.items)) { const mine = received(key); good(key, mode => simpleDraw(mine, mode), true); }
});

await t.test('② 되는 글꾸: 기본 글꾸 새 틀 18 × 정보 칸(끔 · 칩 · 탭) × 낮밤 — 탭을 켠 글은 알약이 탭 띠 오른쪽 끝(창 틀만 틀 위)', () => {
    assert.equal(BASIC_IDS.length, 18);
    for (const id of BASIC_IDS) for (const info of ['off', 'chip', 'tab']) {
        good(`${id} ${info}`, mode => basicDraw(id, mode, { info, lemon: true }), false);
        const out = flip.flipCopy(pack(basicDraw(id, 'light', { info }), false).full);
        const band = /\.gkt-b\{[^}]*margin:0 auto -41px/.test(out);
        assert.equal(band, info === 'tab' && id !== 'window', `${id} ${info}: 알약 자리 ${band ? '탭 띠' : '틀 위'}`);
        assert.doesNotMatch(out.replace(/<style>[\s\S]*?<\/style>/g, ''), /class="[^"]*(?:^|[\s"])(?:kb\d{3}|tl|td|tn-n|tn-d|tx|tq|gi-tab)(?:[\s"])/, `${id}: 본문에 옛 이름이 안 남아요`);
    }
});

await t.test('② 안 되는 글꾸: 깡통 로그 틀 묶음 · 한 판 규칙뿐인 틀 · 붙여 넣은 HTML · 틀 뿌리 없는 글 — 계획 없음(억지로 뒤집지 않아요)', () => {
    for (const id of ['kkangtong', 'kkangtong-mini', 'kkangtong-deep']) {
        assert.ok(PRESETS.some(p => p.id === id), id);
        const draw = mode => renderLog(MODEL, { shape: id, colors: null, ui: { family: 'sans-serif', tracking: '0' }, fields: {}, images: [], names: true, mode, lookup });
        const now = draw('light');
        assert.equal(flip.flipCopy(liftForCopy(now, '').full), null, `${id}: 복사 글에 안 달려요`);
        assert.equal(flip.flipPlan({ now, other: draw('dark'), mode: 'light', full: liftForCopy(now, '').full }), null, `${id}: 계획 없음`);
    }
    const one = '<div class="gk gk-tl gk-k1"><style>.gk-k1{max-width:640px}\n.gk-k1.gk-tl p{color:#111}</style><p>낮 판뿐</p></div>';
    assert.equal(flip.flipCopy(one), null, '밤 판 규칙이 없는 틀');
    assert.equal(flip.flipPlan({ now: one, other: one, mode: 'light', full: one }), null);
    assert.equal(flip.flipCopy('<div class="my-box"><style>.my-box{color:red}</style><p>붙여 넣은 HTML</p></div>'), null, '붙여 넣은 HTML');
    assert.equal(flip.flipCopy('<p>글만</p>'), null);
    assert.equal(flip.flipCopy(''), null);
    // 낮 판 · 밤 판의 본문이 다르면(뿌리 class 말고도 갈리면) 한 벌로 못 바꿔요
    const p = pickEntry(picks, [], 'simple-k1', () => ({ custom: [] })), L = simpleDraw(p, 'light'), D = simpleDraw(p, 'dark');
    assert.ok(flip.twoTone(L, D));
    assert.equal(flip.twoTone(L, D.replace('창밖을', '창 밖을')), null);
    assert.equal(flip.twoTone(L, L), null, '같은 판 둘은 낮밤 class 가 안 갈려요');
    assert.equal(flip.flipPlan({ now: L, other: D.replace('창밖을', '창 밖을'), mode: 'light', full: pack(L, true).full }), null);
});

await t.test('③ 알약: 보이는 글자 없이 해 · 달 그림만 · 이름은 aria-label · title 에만 · 미리보기 알약은 details 가 아닌 같은 class 칸', () => {
    const p = pickEntry(picks, [], 'simple-k13', () => ({ custom: [] })), now = simpleDraw(p, 'light'), { full } = pack(now, true);
    const out = flip.flipCopy(full), bar = out.slice(out.indexOf('<div class="gkt-b">'), out.indexOf('</details></div>') + 16);
    assert.equal(bar.replace(/<[^>]*>/g, '').trim(), '', '알약 안에 글자가 없어요');
    assert.match(bar, /<summary class="gkt-t" aria-label="낮 · 밤 바꾸기" title="낮 · 밤 바꾸기">/);
    assert.doesNotMatch(bar, /<(?:input|button|svg|script)\b|\sid=|\sfor=|\sstyle=/, '깡통이 지우는 것(id · 스크립트 · 인라인 그림)을 안 써요');
    assert.match(out, /mask-image:url\('data:image\/svg\+xml,/, '해 · 달 그림은 <style> 규칙의 mask-image');
    assert.doesNotMatch(out, /@import|@font-face|https?:\/\/(?!www\.w3\.org)[^'")\s]*\.(?:woff2?|ttf|css)/, '웹폰트 · 바깥 스타일 없음');
    const plan = flip.flipPlan({ now, other: simpleDraw(p, 'dark'), mode: 'light', full });
    assert.match(plan.pill, /^<div class="gkt-b"><div class="gkt-k"><span class="gkt-t" role="button" aria-pressed="false" aria-label="낮 · 밤 바꾸기" title="낮 · 밤 바꾸기">/);
    assert.doesNotMatch(plan.pill, /<details|<summary/, '미리보기 알약은 소품 details 를 세는 길에 안 섞여요');
    assert.equal(plan.pill.replace(/<[^>]*>/g, '').trim(), '');
    assert.ok(plan.css.startsWith(`.${plan.key}.${plan.key}.${plan.key}{display:block`) && plan.css.includes('.gkt-t{'), '알약 규칙은 복사 글의 것 그대로');
    assert.match(flip.flipNote(plan), /^복사 글 \+\d\.\dKB\(모두 \d+\.\dKB\)$/);
});

await t.test('③ 처음 판 = 고른 밝기: 낮 판을 받으면 닫힘 = 낮 · 밤 판을 받으면 닫힘 = 밤 / 깡통 글 하나 크기(약 240KB)를 넘으면 over', () => {
    const p = pickEntry(picks, [], 'simple-k1', () => ({ custom: [] }));
    for (const mode of ['light', 'dark']) {
        const now = simpleDraw(p, mode), out = flip.flipCopy(pack(now, true).full), K = /gkt-k\d+/.exec(out)[0];
        const day = new RegExp(`\\.${K}\\.${K}\\.${K}(:not\\(:has\\(\\.gkt-k\\[open\\]\\)\\)|:has\\(\\.gkt-k\\[open\\]\\)) \\.gkt-t \\.gkt-d,[^{]*\\{background-color:#D6E6F7`).exec(out);
        assert.ok(day, mode);
        assert.ok(new RegExp(`\\.gkt-t \\.gkt-d \\.gkt-i,[^{]*\\.gkt-t \\.gkt-n \\.gkt-i\\{background-color:#2264A5`).test(out), `${mode}: 해 · 달 고른 쪽 아이콘이 같은 파랑`);
        assert.ok(!/#E8A100/i.test(out), `${mode}: 호박색 해가 남았어요`);
        assert.equal(day[1].startsWith(':not'), mode === 'light', `${mode}: 해 칸이 켜지는 쪽`);
    }
    const long = { ...MODEL, messages: Array.from({ length: 900 }, (_, i) => ({ name: i % 2 ? '깡캐' : '깡통', time: i, nodes: [text(`「${'가나다라마바사아자차카타파하'.repeat(6)} ${i}」`)] })) };
    const now = simpleDraw(p, 'light', { model: long }), full = pack(now, true).full;
    const plan = flip.flipPlan({ now, other: simpleDraw(p, 'dark', { model: long }), mode: 'light', full });
    assert.ok(byteSize(full) > POST_LIMIT - 4000, `큰 글 ${byteSize(full)}`);
    assert.equal(plan.over, true);
    assert.match(flip.flipNote(plan), /^전환을 넣으면 \d+\.\dKB — 깡통 글 하나\(약 240KB\)에 안 들어가요$/);
});

await t.test('④ 기본 글꾸 새 틀 이름 맞춤의 약속: 그 이름(kbNNN · tl · td · tn-n · tn-d · tx · tq · gi-tab)은 틀 규칙의 선택자에만 · 낮밤 class 는 뿌리에만 · 다른 틀은 안 건드려요', () => {
    const NAME = /\.(?:kb\d{3}|tl|td|tn-n|tn-d|tx|tq|gi-tab)(?![\w-])/g;
    for (const id of BASIC_IDS) for (const info of ['off', 'chip', 'tab']) for (const height of ['', 'm']) {
        const h = basicDraw(id, 'light', { info, height, lemon: true, images: [{ src: 'https://x.test/a.png', alt: '사진' }] }), css = h.match(/<style>([\s\S]*?)<\/style>/)[1];
        let heads = '', vals = '', i = 0, key = 0;   // 선택자 머리 / 그 밖(선언 값 · @ 머리 · 키프레임 안)
        while (i < css.length) {
            const open = css.indexOf('{', i), close = css.indexOf('}', i);
            if (open === -1 && close === -1) break;
            if (open !== -1 && (close === -1 || open < close)) { const head = css.slice(i, open); if (!/^\s*@/.test(head) && !key) heads += `${head}\n`; else vals += head; if (/^\s*@(?:-webkit-)?keyframes/.test(head)) key = 1; else if (key) key++; i = open + 1; }
            else { vals += css.slice(i, close); if (key) key--; i = close + 1; }
        }
        assert.equal((vals.match(NAME) || []).length, 0, `${id} ${info}: 선언 값 · 키프레임 안에 그 이름이 있어요 — basicNames 를 다시 봐요`);
        for (const one of heads.split(/[\n,]/)) { const s = one.trim(), first = s.split(/[\s>+~]/)[0]; assert.doesNotMatch(s.slice(first.length), /\.(?:tl|td|tn-n|tn-d)(?![\w-])/, `${id}: 뿌리 밖 낮밤 class — ${s.slice(0, 60)}`); }
        const body = h.replace(/<style>[\s\S]*?<\/style>/, ''), inner = [...body.matchAll(/\sclass="([^"]*)"/g)].slice(1).flatMap(m => m[1].split(/\s+/));
        assert.ok(!inner.some(c => /^(?:tl|td|tn-n|tn-d|kb\d{3})$/.test(c)), `${id}: 본문 안쪽에 낮밤 · 열쇠 class`);
        assert.match(h, /^<div class="gk tl tn-d kb\d{3}[ "]/, `${id}: 밝은 판 뿌리`);
        assert.match(basicDraw(id, 'dark', { info, height }), /^<div class="gk td tn-n kb\d{3}[ "]/, `${id}: 어두운 판 뿌리`);
    }
    const mapped = flip.basicNames(pack(basicDraw('card', 'dark', { info: 'tab' }), false).full);
    assert.match(mapped, /<div class="gk gk-td gk-tn-n gk-k0429 [^"]*gk-gi-tab[^"]*blq-log"/);
    assert.match(mapped, /<details class="gk-tx"><summary class="gk-tq"/);
    assert.ok(mapped.includes('.content:has(>.blq-log)>p,.blq-cm{'), '틀 규칙 앞(코멘트 글줄 규칙)은 그대로');
    assert.equal(flip.basicNames(pack(simpleDraw(pickEntry(picks, [], 'simple-k1', () => ({ custom: [] })), 'light'), true).full), null, '마트 틀은 그대로 넘겨요');
    assert.equal(flip.basicNames('<p>글</p>'), null);
});

await t.test('⑤ 꺼 두면 그대로: 복사 글을 만드는 식은 손대지 않고(packPlain) 켰을 때만 그 뒤에 전환 · 굳히기 건너뛰기 · 알약 걷기도 켰을 때만 · 조각은 켠 사람만 받아요', () => {
    const sheet = read('src/log-copy-sheet.js');
    assert.match(sheet, /const packPlain = \(\) => \{\s*const shown = result\(\);/);
    assert.match(sheet, /const copyPack = \(\) => \{\s*const pack = packPlain\(\);\s*if \(!pack \|\| !flipOn\(\)\) return pack;\s*const a = flipMod\.flipCopy\(pack\.html\), b = flipMod\.flipCopy\(pack\.code\);\s*return a && b \? \{ html: a, code: b \} : pack;\s*\};/, '둘 다 달릴 때만 · 아니면 원래 글 그대로');
    assert.match(sheet, /const flipOn = \(\) => state\.flipLive && !!state\.flipPlan && !!flipMod;/);
    assert.match(sheet, /const pin = !basicOn\(\) && !flipOn\(\);/, '전환을 싣는 글만 글자색 굳히기를 건너뛰어요');
    assert.match(sheet, /if \(flipOn\(\)\) flipMod\.flipStrip\(body, state\.flipPlan\);/);
    assert.match(sheet, /const flipFull = text => \(flipOn\(\) \? flipMod\.flipCopy\(text\) \?\? text : text\);/);
    assert.match(sheet, /if \(state\.flip && flipMod && again\) \{/, '켰고 두 판이 있는 갈래일 때만 계획을 세워요');
    assert.match(sheet, /flip: !!flipMod, flipPlan: null, flipDrawn: false, flipLive: false/, '켜 둔 사람만(조각을 받았을 때만) 켠 채로 시작');
    // 늦게 받기: 정적 import 없음 · 켜 둔 사람만 창을 열 때 · 아니면 처음 켤 때
    assert.equal((sheet.match(/log-copy-flip\.js'/g) || []).length, 1);
    assert.match(sheet, /flipMod = await import\('\.\/log-copy-flip\.js'\)/);
    assert.match(sheet, /if \(flipSaved\(\)\) await needFlip\(\);/);
    for (const f of fs.readdirSync(path.join(root, 'src')).filter(n => n.endsWith('.js') && !['log-copy-flip.js', 'log-copy-sheet.js', 'build-info.js'].includes(n))) {   // build-info.js 는 설치 무결성 표(파일 이름 목록)라 빼요 — 다른 시험(log-copy-mine · fa-free-icons)과 같아요
        assert.ok(!/log-copy-(?:flip|day-night)\.js/.test(read(`src/${f}`)), `${f}: 전환 조각을 부르면 안 돼요(시작 그래프 밖)`);
    }
    assert.ok(!/log-copy-(?:flip|day-night)/.test(read('index.js')));
    // 기억은 이 기기(localStorage) — 설정 꼴 · 다듬기는 그대로
    assert.ok(!/flip/i.test(read('src/settings.js').match(/logCopy: \{[^}]*\}/)[0]), '설정 기본값에 새 칸 없음');
    assert.match(sheet, /const FLIP_KEY = 'bl-lc-flip';/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/log-copy-flip\.mjs \./);
});

t.done();
