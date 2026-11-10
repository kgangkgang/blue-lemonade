// 로그 복사 — 떠 온 로그 자료 → 인라인 style HTML · 글꾸 틀 · 마크다운 · 글 (DOM 없는 부분)
//   node tools/tests/log-copy.mjs <테마 루트>
// 화면에서 떠 오기(log-copy-capture.js) · 소독(log-copy-sanitize.js)은 브라우저가 필요해 리그 시험(log-copy-browser.js)이 맡아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const { renderLog, PRESETS, logMarkdown, logText, timeLabel, dateLabel } = await load('src/log-copy-presets.js');
const { logHtml, styleAttr } = await load('src/log-copy-render.js');
const { fontStack } = await load('src/log-copy-capture.js');

// 화면에서 떠 온 모양 (밤 팔레트 · 리디바탕 · 자간 -2.5%) — 세라피나와 나눈 두 메시지
const font = { color: 'rgb(219, 226, 235)', 'font-family': "'RIDIBatang', serif", 'font-size': '15.5px', 'font-weight': '400', 'font-style': 'normal', 'letter-spacing': '-0.39px', 'line-height': '27.13px' };
const block = (children, style = {}) => ({ t: 'el', block: true, tag: 'div', kind: 'p', style: { ...font, 'margin-bottom': '12px', ...style }, children });
const span = (text, style, kind = null) => ({ t: 'el', block: false, tag: 'span', kind, style, children: [{ t: 'text', text }] });
const T = text => ({ t: 'text', text });
const model = {
    chatName: 'Seraphina', userName: 'Lemon',
    base: { bg: 'rgb(20, 31, 46)', ...font },
    messages: [
        { index: 0, user: false, name: 'Seraphina', nameStyle: { color: 'rgb(147, 201, 255)', 'font-family': "'Pretendard', sans-serif", 'font-size': '16px', 'font-weight': '650', 'letter-spacing': '-0.4px' }, time: Date.UTC(2026, 9, 31, 6, 12), font, bubble: null,
            nodes: [block([span('"어서 와요, 숲의 손님."', { color: 'rgb(243, 247, 252)', 'background-image': 'linear-gradient(transparent 55%, rgba(96, 169, 255, 0.35) 55%, rgba(96, 169, 255, 0.35) 94%, transparent 94%)' }), T(' '), span('그녀가 미소 지었다.', { color: 'rgb(164, 199, 237)', 'font-style': 'italic' }, 'em')], { 'text-indent': '15.5px' }),
                block([T('여기는 '), span('안전', { color: 'rgb(255, 232, 115)', 'font-weight': '700' }, 'strong'), T('해요.'), { t: 'br' }, T('조금 쉬어요.')])] },
        { index: 1, user: true, name: 'Lemon', nameStyle: { color: 'rgb(171, 186, 206)', 'font-family': "'Pretendard', sans-serif", 'font-size': '16px', 'font-weight': '650', 'letter-spacing': '-0.4px' }, time: Date.UTC(2026, 9, 31, 7, 0), font, bubble: { 'background-color': 'rgb(40, 56, 77)', 'border-radius': '12px' },
            nodes: [block([T('*고마워.* '), span('지운 말', { 'text-decoration-line': 'line-through' }, 'del')]), { t: 'el', block: true, tag: 'div', kind: 'quote', style: { ...font, 'border-left': '3px solid rgb(147, 201, 255)', 'padding-left': '12px' }, children: [block([T('인용한 줄')])] }] },
    ],
};
const night = { bg: 'rgb(20, 31, 46)', surface: 'rgb(28, 41, 59)', raised: 'rgb(40, 56, 77)', text: 'rgb(219, 226, 235)', muted: 'rgb(171, 186, 206)', faint: 'rgb(133, 150, 173)', accent: 'rgb(147, 201, 255)', pop: 'rgb(255, 232, 115)', line: 'rgba(184, 201, 224, 0.08)', marker: 'rgba(96, 169, 255, 0.35)', onAccent: '#0B1216' };
const salt = { bg: 'rgb(249, 252, 255)', surface: 'rgb(253, 254, 255)', raised: 'rgb(229, 241, 255)', text: 'rgb(34, 45, 58)', muted: 'rgb(86, 107, 131)', faint: 'rgb(98, 117, 139)', accent: 'rgb(36, 119, 211)', pop: 'rgb(57, 142, 232)', line: 'rgba(31, 50, 71, 0.07)', marker: 'rgba(62, 177, 255, 0.27)', onAccent: '#FFFFFF' };
const ui = { family: "'Pretendard', sans-serif", tracking: '-0.025em' };
const fields = { title: 'Seraphina', mark: 'LOG', model: 'claude-opus-5-5', prompt: '내 프리셋', date: dateLabel(Date.UTC(2026, 9, 31, 6, 12)), from: 'Lemon', tail: '#세라피나 #숲', info: '숲속 오두막에서' };

/** 붙여 넣을 HTML 규칙: class · <style> · <script> · on* · CSS 변수 · javascript: 없음, 모든 요소가 style 만 */
function inlineOnly(html, label) {
    const bare = html.replace(/ data-f="[a-z]+"/g, '').replace(/ data-bl-[a-z]+(?:="[^"]*")?/g, '');   // 미리보기 표시 — 복사할 때 소독(sanitizeTree)이 걷어요
    assert.ok(!/\sclass=/i.test(bare), `${label}: class 없음`);
    assert.ok(!/<style|<script|<link|<iframe/i.test(bare), `${label}: style · script 태그 없음`);
    assert.ok(!/\son[a-z]+=/i.test(bare), `${label}: on* 없음`);
    assert.ok(!/var\(--/.test(bare), `${label}: CSS 변수 없음`);
    assert.ok(!/javascript:/i.test(bare), `${label}: javascript: 없음`);
    for (const m of bare.matchAll(/<([a-z]+)((?:\s[^>]*)?)>/g)) {
        const attrs = m[2].replace(/\sstyle="[^"]*"/, '').trim();
        const homeLink = m[1] === 'a' && attrs === 'href="https://kkangtong.xyz/posts/157369" target="_blank" rel="noopener noreferrer" title="블루레몬에이드"';   // 1.1.2 레몬 틀의 레몬 그림 → 블루레몬에이드 소개 글
        assert.ok(!attrs || homeLink || /^(?:open(?:="")?|aria-hidden="true")?$/.test(attrs), `${label}: <${m[1]}> 는 style 만 (${attrs})`);   // 1.0.1 눌러 접는 상자는 open=""
    }
    return bare;
}

await test('그대로: 글 조각마다 계산된 모양(색 · 글꼴 · 자간 · 줄 간격 · 띠 · 기울임 · 굵기 · 들여쓰기)이 인라인으로', () => {
    const html = inlineOnly(logHtml(model), '그대로');
    assert.match(html, /^<div style="box-sizing:border-box;max-width:100%;background-color:rgb\(20, 31, 46\);color:rgb\(219, 226, 235\);font-family:'RIDIBatang', serif;font-size:15\.5px;font-weight:400;letter-spacing:-0\.39px;line-height:27\.13px/);
    assert.match(html, /<span style="color:rgb\(243, 247, 252\);background-image:linear-gradient\(transparent 55%, rgba\(96, 169, 255, 0\.35\) 55%/, '대사 색 + 형광펜 띠');
    assert.match(html, /<span style="color:rgb\(164, 199, 237\);font-style:italic">그녀가 미소 지었다\.<\/span>/, '속마음 기울임 색');
    assert.match(html, /<span style="color:rgb\(255, 232, 115\);font-weight:700">안전<\/span>/, '강조 색 · 굵기');
    assert.match(html, /text-indent:15\.5px/, '들여쓰기');
    assert.match(html, /<span style="text-decoration-line:line-through">지운 말<\/span>/);
    assert.match(html, /<div style="color:rgb\(147, 201, 255\);font-family:'Pretendard', sans-serif;font-size:16px;font-weight:650;letter-spacing:-0\.4px;line-height:1\.4;margin:0 0 4px">Seraphina<\/div>/, '이름 줄 · 이름 색');
    assert.match(html, /background-color:rgb\(40, 56, 77\);border-radius:12px;padding:8px 12px/, '말풍선 바탕은 그 메시지에만');
    assert.match(html, /margin:0 0 27\.13px/, '메시지 사이 빈 줄 = 줄 높이 하나');
    assert.ok(!/margin-bottom:12px">조금/.test(html));
    assert.match(logHtml(model, { names: false }), /^<div[^>]*><div data-bl-msg style="margin:0 0 27\.13px"><div style="color:rgb\(219/, '이름 줄 빼기');
    assert.match(logHtml(model, { gap: false }), /margin:0 0 8px/, '빈 줄 끄기');
});

await test('메시지 첫 문단 위 · 마지막 문단 아래 여백은 빼요 (빈 줄 설정이 메시지 사이를 정함)', () => {
    const html = logHtml(model);
    const second = html.split('여기는 ')[0];
    assert.ok(/text-indent:15\.5px/.test(second));
    const lastBlock = html.match(/<div style="[^"]*">여기는 /)[0];
    assert.ok(!/margin-bottom/.test(lastBlock), '마지막 문단 아래 여백 없음');
});

await test('글꼴: 화면 글꼴 이름 그대로 + 일반 대체 글꼴', () => {
    assert.equal(fontStack('"RIDIBatang", "Noto Sans KR"'), "'RIDIBatang', 'Noto Sans KR', serif");
    assert.equal(fontStack('Pretendard, sans-serif'), 'Pretendard, sans-serif');
    assert.equal(fontStack('"Galmuri11"'), "'Galmuri11', sans-serif");
    assert.equal(fontStack(''), 'sans-serif');
    assert.equal(fontStack('x"><script>'), "x'script, sans-serif");
});

await test(`글꾸 틀 ${PRESETS.length}가지: 인라인만 · 폭 100% 안 · 안쪽만 스크롤 · 팔레트 값만`, () => {
    assert.ok(PRESETS.length >= 16 && PRESETS.length <= 80, `프리셋 ${PRESETS.length}개`);
    assert.equal(new Set(PRESETS.map(p => p.id)).size, PRESETS.length);
    for (const preset of PRESETS) {
        for (const [name, colors] of [['밤', night], ['낮', salt]]) {
            const html = renderLog(model, { shape: preset.id, colors: preset.id === 'plain' ? null : colors, ui, fields });
            const bare = inlineOnly(html, `${preset.label}/${name}`);
            // 내장 심플 글꾸(틈 템플릿 · 1.0.1 11-04)는 마트 글꾸와 같은 자료라 바깥 칸 꼴은 시안 그대로 — 폭은 max-width 로 화면 안(마트 시험 mart-geulkku-64 가 살균 · 대비를 봐요)
            if (preset.template) assert.match(bare, /^<div style="[^"]*max-width:\d+px/, `${preset.label}: 맨 바깥은 최대 폭이 있어요`);
            else assert.match(bare, /^<div style="(?:color:[^;]+;)?box-sizing:border-box;max-width:100%/, `${preset.label}: 맨 바깥은 화면 폭을 안 넘어요`);
            assert.ok(bare.includes('어서 와요, 숲의 손님.'), `${preset.label}: 로그가 들어가요`);
            if (preset.id === 'plain' || preset.own) continue;   // 할로윈(전용 색)은 아래 할로윈 시험이
            assert.ok(/overflow-y:auto/.test(bare), `${preset.label}: 안쪽 스크롤`);
            assert.ok(/scrollbar-width:none/.test(bare), `${preset.label}: 스크롤바 숨김`);
            // 틀에 쓴 색은 그 팔레트 값 · 화면 로그의 색뿐 (새 색 없음)
            const allowed = new Set([...Object.values(colors), '#0B1216', '#FFFFFF', 'rgb(219, 226, 235)', 'rgb(243, 247, 252)', 'rgb(164, 199, 237)', 'rgb(255, 232, 115)', 'rgb(147, 201, 255)', 'rgb(171, 186, 206)', 'rgb(20, 31, 46)', 'rgb(40, 56, 77)', 'rgba(96, 169, 255, 0.35)'].map(c => c.toLowerCase()));
            for (const m of bare.matchAll(/(?:color|background-color|border(?:-[a-z]+)?):\s*(?:\d+px solid )?((?:rgba?\([^)]*\)|#[0-9a-f]{3,8}))/gi)) {
                assert.ok(allowed.has(m[1].toLowerCase()), `${preset.label}/${name}: 팔레트 · 화면 밖 색 ${m[1]}`);
            }
            assert.ok(!/gradient/.test(bare.replace(/background-image:linear-gradient\(transparent [^;"]*/g, '')), `${preset.label}: 그라데이션 없음(형광펜 띠 말고)`);
        }
    }
});

await test('틀 칸: 제목 · 알약(모델 · 프롬프트 · LOG) · 꼬리 · 접는 추가 정보 · 비우면 안 넣음', () => {
    const html = renderLog(model, { shape: 'card', colors: night, ui, fields });
    assert.match(html, /<span data-f="model" style="(?:color:[^;]+;)?display:inline-block;box-sizing:border-box;max-width:100%;height:20px;margin:0 8px 8px 0;padding:0 8px;vertical-align:middle;border:1px solid rgba\(184, 201, 224, 0\.08\);border-radius:10px;color:rgb\(171, 186, 206\);font-family:'Pretendard', sans-serif;font-size:12px;font-weight:400;letter-spacing:-0\.025em;line-height:18px/, '판 알약 규격');
    assert.match(html, /<details style="(?:color:[^;]+;)?display:block;[^"]*"><summary style="(?:color:[^;]+;)?display:block;list-style:none;/);
    assert.ok(html.includes('#세라피나 #숲'));
    const empty = renderLog(model, { shape: 'card', colors: night, ui, fields: { title: 'Seraphina' } });
    assert.ok(!/<details|data-f="model"|data-f="tail"/.test(empty), '빈 칸은 안 넣어요');
    for (const preset of PRESETS) assert.ok(renderLog(model, { shape: preset.id, colors: night, ui, fields: {} }).length > 100, `${preset.label}: 칸이 다 비어도 그려요`);
});

await test('메신저: 내 말 오른쪽 포인트 면 · 상대 왼쪽 면 · 대비 낮은 글자색은 팔레트 글자색 · 시간 줄', () => {
    const html = renderLog(model, { shape: 'messenger', colors: salt, ui, fields });
    const mine = html.slice(html.lastIndexOf('text-align:right'));
    assert.match(mine, /background-color:rgb\(36, 119, 211\)/);
    assert.match(mine, /color:#FFFFFF/);
    const theirs = html.slice(html.indexOf('text-align:left;'));
    assert.match(theirs, /border-radius:16px 16px 16px 4px;background-color:rgb\(229, 241, 255\)/);
    assert.ok(!/color:rgb\(219, 226, 235\)/.test(theirs.split('text-align:right')[0]), '밤 화면 글자색(밝음)은 낮 말풍선에서 팔레트 글자색으로');
    assert.match(html, /max-width:400px/);
    assert.ok(html.includes(timeLabel(model.messages[0].time)), '가운데 시간 줄');
    assert.equal(timeLabel(new Date(2026, 9, 31, 15, 7).getTime()), '10월 31일 오후 3:07');
    assert.equal(timeLabel(new Date(2026, 9, 31, 0, 5).getTime()), '10월 31일 오전 12:05');
});

await test('마크다운: 색은 빼고 굵게 · 기울임 · 취소선 · 인용 · 줄바꿈만', () => {
    const md = logMarkdown(model);
    assert.match(md, /^\*\*Seraphina\*\*\n\n/);
    assert.ok(md.includes('"어서 와요, 숲의 손님." *그녀가 미소 지었다.*'), md);
    assert.ok(md.includes('여기는 **안전**해요.  \n조금 쉬어요.'), md);
    assert.ok(md.includes('\\*고마워.\\* ~~지운 말~~'), '원래 별표는 글자로 · 취소선');
    assert.ok(md.includes('> 인용한 줄'));
    assert.ok(!/rgb\(|style=/.test(md));
    assert.ok(logMarkdown(model, { names: false }).startsWith('"어서'));
});

await test('글만: 이름 줄 + 문단 줄바꿈', () => {
    const text = logText(model);
    assert.ok(text.startsWith('Seraphina\n"어서 와요, 숲의 손님." 그녀가 미소 지었다.\n여기는 안전해요.\n조금 쉬어요.\n\nLemon\n*고마워.* 지운 말\n인용한 줄\n'), JSON.stringify(text));
});

await test('style 값 안전: 따옴표 · 꺾쇠 · 중괄호 · 쌍반점은 값에서 빠져요', () => {
    assert.equal(styleAttr({ 'font-family': '"A"; } <x>', color: 'red', 'Bad Key': 'x', empty: '' }), "font-family:'A'  x;color:red");
});

await test('연결: 시작 그래프 밖 · 도구 줄 · 설정 · 검색 사전', () => {
    const index = read('index.js');
    assert.match(index, /\['startLogCopy', \(\) => import\('\.\/src\/log-copy\.js'\)/, '3층(유휴)에서 받아요');
    assert.match(read('src/log-copy.js'), /import\('\.\/log-copy-sheet\.js'\)/, '시트는 처음 쓸 때');
    assert.match(read('src/log-copy-sheet.js'), /sandbox="allow-same-origin"/, '미리보기는 스크립트 없는 sandbox');
    assert.match(read('src/log-copy-sheet.js'), /writeClipboard\(html, withCommentSlots\(prettyLogHtml\(insertHead\(copyBody\(result\(\{ marks: true \}\)\)\.html, lifted\.head\)/, '복사 = 서식 + 그 HTML 코드 글자(1.0.1 사람이 고치기 쉬운 꼴 — log-copy-pretty.mjs · 1.1.2 그림 주소는 맨 앞 <style> 로 — log-copy-lift.mjs)');
    assert.match(read('src/settings.js'), /logCopy: \{ on: true, shape: 'card'/);
    assert.match(read('src/panel.js'), /toggle\('logCopy\.on'/);
    assert.match(read('src/settings-search.js'), /'로그 복사','로그 복사 서식 복사 그대로 복사/);
    assert.match(read('src/addons/bookmarks/selection-chip.js'), /accepts: target => target\.single === true/, '북마크는 한 메시지 선택만');
});

// ── 바꾸기 · 이름 숨김 · 역할 색 다시 계산 · 숨긴 글 마크다운 ──
const { transformLog, recolorLog, maskNode } = await load('src/log-copy-words.js');
const flat = n => (n.t === 'text' ? n.text : (n.children || []).map(flat).join(''));
const msgText = m => m.nodes.map(flat).join('|');

await test('바꾸기: 조각 경계에 걸친 낱말도 · 서식(형광펜 · 색 칸) 유지 · 대소문자 무시 · 원본 자료는 그대로', () => {
    // 「안전」은 강조 조각, 「해요」는 바깥 조각 → 「안전해」를 찾으면 두 조각에 걸쳐요
    const { model: out, replaced } = transformLog(model, { rules: [{ from: '안전해', to: '편안해' }, { from: 'SERAPHINA', to: '숲지기' }] });
    assert.equal(replaced, 1);
    assert.ok(msgText(out.messages[0]).includes('여기는 편안해요.'), msgText(out.messages[0]));
    const strong = JSON.stringify(out.messages[0].nodes).match(/"font-weight":"700"\},"children":\[\{"t":"text","text":"([^"]*)"/);
    assert.equal(strong?.[1], '편안해', '바뀐 글은 낱말이 시작한 조각(강조 색 칸)에');
    assert.equal(out.messages[0].name, '숲지기', '이름 줄도 바꿔요');
    assert.ok(msgText(model.messages[0]).includes('안전'), '원본 자료는 안 바뀌어요');
    const band = transformLog(model, { rules: [{ from: '숲의 손님', to: '여행자' }] }).model;
    assert.match(JSON.stringify(band.messages[0].nodes), /"background-image":"linear-gradient[^"]*"\},"children":\[\{"t":"text","text":"\\"어서 와요, 여행자\.\\""\}/, '형광펜 띠 칸 안 글자만 바뀌어요');
});

await test('바꾸기: 바로 뒤 조사를 바꾼 말 받침에 맞춰요 (번역기 particleFor 재사용)', () => {
    const one = (text, rules) => msgText(transformLog({ ...model, messages: [{ ...model.messages[0], nodes: [{ t: 'el', block: true, tag: 'div', kind: 'p', style: {}, children: [{ t: 'text', text }] }] }] }, { rules }).model.messages[0]);
    assert.equal(one('미나가 웃었다. 미나는 미나를 봤다.', [{ from: '미나', to: '코르빈' }]), '코르빈이 웃었다. 코르빈은 코르빈을 봤다.');
    assert.equal(one('코르빈이 미나와 코르빈으로', [{ from: '코르빈', to: '미나' }]), '미나가 미나와 미나로');
    assert.equal(one('Mina는 mina를', [{ from: 'mina', to: '세라' }]), '세라는 세라를');
    assert.equal(one('한 줄', [{ from: '', to: 'x' }]), '한 줄', '빈 찾을 말은 무시');
});

await test('이름 숨김: 이름 줄 · 본문 속 이름 · 원래 글자 0 · 가림 모양(○○ · 모자이크 · 색 칸)', () => {
    const { model: out, hidden } = transformLog(model, { hide: { names: ['Seraphina', 'Lemon', '숲'], mask: 'auto' } });
    assert.ok(hidden >= 3);
    assert.equal(out.messages[0].name, '', '숨긴 이름이 화자 줄이면 ○○ 대신 비워요(11-03)');
    assert.equal(out.messages[1].name, '');
    assert.ok(!JSON.stringify(out).match(/Seraphina|Lemon|숲/), '원래 이름 글자가 어디에도 남지 않아요');
    assert.ok(msgText(out.messages[0]).includes('어서 와요, ○○의 손님.'));
    const tape = maskNode('세라피나', { mask: 'tape', dark: true });
    assert.equal(tape.children[0].text, '　'.repeat(4));
    assert.equal(tape.style['background-color'], '#b5cfe5', '채팅 캡처 테이프 색 그대로');
    assert.equal(maskNode('세라', { mask: 'mosaic' }).text, '▒▒');
    assert.equal(maskNode('세라', { mask: 'black', style: { customColor: true, color: '#86b5d5' } }).style['background-color'], '#86b5d5', '직접 고른 가림 색');
    const html = renderLog(transformLog(model, { hide: { names: ['Seraphina', '숲'], mask: 'black' } }).model, { shape: 'card', colors: night, ui, fields: { title: '○○' } });
    assert.ok(!html.includes('Seraphina'));
    assert.match(html, /background-color:#111318;color:#111318;border-radius:4px">　/);
    const md = logMarkdown(transformLog(model, { hide: { names: ['Seraphina'], mask: 'auto' }, rules: [{ from: '안전', to: '편안' }] }).model);
    assert.ok(!md.startsWith('**○○**') && !/\*\*(Seraphina|○○)\*\*/.test(md) && md.includes('**편안**') && !md.includes('Seraphina'), '숨긴 이름의 이름 줄은 아예 빠져요(11-03): ' + md);
});

await test('이름 숨김: 틀 칸(부제목 · 꼬리 · 추가 정보)과 그림 alt 에도 이름이 남지 않아요 · 모든 틀', () => {
    const named = { ...structuredClone(model), chatName: 'Seraphina', userName: '손님', images: [{ src: 'https://example.com/a.png', alt: 'Seraphina 그림' }] };
    const hidden = transformLog(named, { hide: { names: ['Seraphina'], mask: 'auto' } });
    const fields = hidden.rewriteFields({ title: 'Seraphina', subtitle: 'Seraphina의 기록', tail: 'Seraphina 끝', info: 'Seraphina 정보', from: 'Seraphina', mark: 'LOG', model: 'm', prompt: 'p', date: 'd', page: '1' });
    const images = hidden.rewriteImages([{ src: 'https://example.com/b.png', alt: 'Seraphina 둘째' }]);
    assert.equal(fields.subtitle, '○○의 기록');
    assert.equal(hidden.model.images[0].alt, '○○ 그림', '채팅에서 잡은 그림');
    assert.equal(images[0].alt, '○○ 둘째', '붙여 넣은 그림');
    for (const preset of PRESETS) {
        const html = renderLog(hidden.model, { shape: preset.id, colors: night, ui, fields, images });
        assert.ok(!html.includes('Seraphina'), `${preset.id} 에 이름이 남았어요`);
    }
    const sheet = fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8');
    assert.match(sheet, /const fields = shown\.rewriteFields\(state\.fields\);/, '시트가 모든 칸을 거쳐요');
    assert.match(sheet, /images: shown\.rewriteImages\(state\.images\)/, '붙여 넣은 그림도 거쳐요');
});

await test('색 칩: 다른 에이드면 로그 역할 색(본문 · 대사 · 속마음 · 강조 · 형광펜 · 인용 막대 · 내 메시지 면)도 그 팔레트 값 · 고정 색은 그대로 · 대비 3 이상', () => {
    const tokens = p => ({ bg: p.bg, surface: p.surface, raised: p.raised, text: p.text, muted: p.muted, accent: p.accent, line: p.line, marker: p.marker, dialogue: p.dialogue, em: p.em, strong: p.strong });
    const nightT = { ...tokens(night), dialogue: 'rgb(243, 247, 252)', em: 'rgb(164, 199, 237)', strong: 'rgb(255, 232, 115)' };
    const saltT = { ...tokens(salt), dialogue: 'rgb(20, 30, 42)', em: 'rgb(51, 111, 166)', strong: 'rgb(34, 100, 165)' };
    const fixed = structuredClone(model);
    fixed.messages[0].nodes[1].children.push({ t: 'el', block: false, tag: 'span', kind: null, style: { color: 'rgb(200, 30, 120)' }, children: [{ t: 'text', text: '고정' }] });
    const out = recolorLog(fixed, nightT, saltT);
    const json = JSON.stringify(out);
    assert.equal(out.base.bg, 'rgb(249, 252, 255)', '채팅 바탕 = 그 팔레트 바탕');
    assert.equal(out.base.color, 'rgb(34, 45, 58)', '본문 = 그 팔레트 본문');
    assert.ok(json.includes('"color":"rgb(20, 30, 42)"'), '대사');
    assert.ok(json.includes('"color":"rgb(51, 111, 166)"'), '속마음');
    assert.ok(json.includes('"color":"rgb(34, 100, 165)"'), '강조');
    assert.ok(json.includes('rgba(62, 177, 255, 0.27) 55%'), '형광펜 띠');
    assert.ok(json.includes('"border-left":"3px solid rgb(36, 119, 211)"'), '인용 막대 = 포인트');
    assert.equal(out.messages[1].bubble['background-color'], 'rgb(229, 241, 255)', '내 메시지 면 = 한 단계 밝은 면');
    assert.ok(json.includes('"color":"rgb(200, 30, 120)"'), '직접 고른 고정 색은 그대로');
    const { contrast } = { contrast: (a, b) => { const L = c => { const [r, g, bl] = c.match(/\d+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; }; const [h, l] = [L(a), L(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); } };
    for (const m of json.matchAll(/"color":"(rgb\([^)]*\))"/g)) assert.ok(contrast(m[1], out.base.bg) >= 3 || m[1] === 'rgb(229, 241, 255)', `대비 낮은 글자색 ${m[1]}`);
    assert.deepEqual(recolorLog(model, nightT, nightT).messages[0].nodes, model.messages[0].nodes, '같은 팔레트면 그대로');
});

await test('숨긴 글: 마크다운은 「(숨긴 글: …)」 · 서식 유지 · 글만에는 그대로', () => {
    const spoiled = structuredClone(model);
    spoiled.messages[0].nodes[1].children = [{ t: 'text', text: '여기는 ' }, { t: 'el', block: false, tag: 'span', kind: 'spoiler', style: {}, children: [{ t: 'el', block: false, tag: 'span', kind: 'strong', style: {}, children: [{ t: 'text', text: '비밀' }] }, { t: 'text', text: ' 장소' }] }, { t: 'text', text: '예요.' }];
    const md = logMarkdown(spoiled);
    assert.ok(md.includes('여기는 (숨긴 글: **비밀** 장소)예요.'), md);
    assert.ok(logText(spoiled).includes('여기는 비밀 장소예요.'));
    const src = read('src/log-copy-spoiler.js');
    assert.match(src, /'<details|make\(doc, 'details'/, 'details · summary — 스크립트 없이 눌러 펼침');
    assert.match(src, /blsp-/, '꾸밈 블록 클래스는 고유 접두사');
    assert.match(src, /make\(doc, inline \? 'span' : 'div', 'blsp-b', 'display:none'\)/, '꾸밈 블록이 지워져도 흐린 사본은 안 보여요(원래 글 새지 않음)');
});

await test('분류: 칩 하나에 그 분류 모양만 · 할로윈은 1.0.1 에 글꾸 마트로(내 글꾸) · 내 글꾸는 「내 글꾸」 · 모든 프리셋에 분류', async () => {
    const { CATEGORIES, presetsIn, categoryOf } = await load('src/log-copy-presets.js');
    // 1.0.1(11-04): 틀이 있는 분류만 칩 — 내장 심플 30(기념일 7 · 사물 11 · 장르 12)이라 세 칩이 모두 서요
    // 1.0.9: 반응 글꾸 4종(봉투 열기 · 초대장 · 쪽 넘기기 · 통통 카드)이 「반응」 칩으로
    assert.deepEqual(CATEGORIES.map(c => c.id), ['basic', 'talk', 'paper', 'event', 'thing', 'genre', 'react', 'scene', 'xmas', 'gallery', 'mine']);
    for (const p of PRESETS) assert.ok(CATEGORIES.some(c => c.id === p.category && c.id !== 'mine'), `${p.id} 분류`);
    assert.deepEqual(presetsIn('halloween'), [], '할로윈 13종은 테마 기본에서 빠졌어요(글꾸 마트 → 내 글꾸)');
    for (const c of CATEGORIES) assert.ok(!presetsIn(c.id, []).some(id => id.startsWith('halloween')), `${c.label} 에는 할로윈 없음`);
    assert.equal(presetsIn('basic')[0], 'plain', '「기본」 첫 칩은 그대로');
    assert.deepEqual(presetsIn('mine', [{ id: 'c1' }, { id: 'c2' }]), ['c1', 'c2']);
    assert.equal(categoryOf('c1'), 'mine', '분류 없는 저장 글꾸는 내 글꾸');
    assert.equal(categoryOf('gallery-grid'), 'gallery');
    const all = CATEGORIES.flatMap(c => presetsIn(c.id, []));
    assert.equal(new Set(all).size, PRESETS.length, '프리셋은 분류 하나에 한 번씩');
    assert.match(read('src/log-copy-sheet.js'), /class="salty-seg bl-screen-chips bl-lc-cats"/, '분류 칩은 설정창 화면 칩과 같은 공용 부품');
    assert.match(read('src/settings.js'), /category: 'basic'/, '처음은 「기본」');
});

await test('할로윈 31종(1.0.1 글꾸 마트 · 10월 31일 · 틈 템플릿으로 그려요): 데이터 한 줄 + 모양 조각 · 안쪽 글자 · 바탕까지 컨셉 색 · 역할 대비 · 지워진 꼴 · 인라인 · 외부 주소 없음', async () => {
    const { conceptModel } = await load('src/log-copy-presets.js');
    const { MART_CONCEPT_COLORS: BUILT_IN, drawConcept } = await load('tools/mart/geulkku-concept30.mjs');   // 옛 내장 컨셉 30(1.0.1 11-04 마트 「일러스트」로)
    const { MART_HALLOWEEN_COLORS, MART_HALLOWEEN_SHAPES, MART_HALLOWEEN_FRAMES } = await load('tools/mart/geulkku-halloween.mjs');
    const { checkTemplate, withoutSvgData } = await load('src/log-copy-template.js');
    const CONCEPT_COLORS = { ...BUILT_IN, ...MART_HALLOWEEN_COLORS }, CONCEPT_FRAMES = MART_HALLOWEEN_FRAMES, SHAPES = MART_HALLOWEEN_SHAPES;
    const SLOT = { head: '{{head}}', body: '{{body}}', info: '{{info}}', tail: '{{tail}}' };
    const asTemplate = f => { const template = SHAPES[f.shape](CONCEPT_COLORS[f.colors], SLOT, ui); assert.ok(checkTemplate(template).ok, `${f.id}: 틈 템플릿이 가져오기 검사를 통과 ${checkTemplate(template).reason ?? ''}`); return { id: f.id, template, colors: CONCEPT_COLORS[f.colors], messages: f.messages, tail: f.tail }; };
    const src = read('tools/mart/geulkku-concept30.mjs');
    assert.match(src, /전용 색은 이 분류들에만 — 사용자 결정 「할로윈만 할로윈색」/);
    assert.match(src, /export function drawConcept\(model, o, frame\)/, '컨셉 틀은 데이터 한 줄 + 공용 그리기 하나');
    const hw = CONCEPT_FRAMES.map(f => ({ id: f.id, own: f.colors }));
    assert.equal(hw.length, 31, '할로윈 31종(10월 31일)');
    assert.equal(new Set(hw.map(f => f.id)).size, 31, '할로윈 id 겹침 없음');
    assert.ok(PRESETS.filter(p => !['event', 'thing', 'genre', 'react', 'scene', 'xmas'].includes(p.category)).every(p => !p.own), '컨셉 분류(+ 1.0.9 반응 · 1.1.0 장면 · 1.1.1 연말) 밖은 전용 색 없음');
    assert.ok(PRESETS.filter(p => p.own).every(p => p.template), '전용 색 틀은 내장 심플 글꾸(틈 템플릿)뿐');
    const L = (hex) => { const n = hex.replace('#', ''); const v = [0, 2, 4].map(i => Number.parseInt(n.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const ratio = (a, b) => { const [h, l] = [L(a), L(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
    for (const [name, k] of Object.entries(CONCEPT_COLORS)) {
        for (const bg of ['panel', 'panel2']) for (const fg of ['text', 'dialogue', 'thought', 'emphasis', 'name', 'muted']) assert.ok(ratio(k[fg], k[bg]) >= 4.5, `${name}: ${fg} / ${bg} ${ratio(k[fg], k[bg]).toFixed(2)}`);
        assert.ok(ratio(k.dialogue, k.mark) >= 4.5 && ratio(k.text, k.mark) >= 4.5, `${name}: 형광펜 바탕 위 대사 · 본문 ${ratio(k.dialogue, k.mark).toFixed(2)}`);
        for (const fg of ['faceText', 'faceMuted']) assert.ok(ratio(k[fg], k.face) >= 4.5, `${name}: ${fg} / face ${ratio(k[fg], k.face).toFixed(2)}`);
        assert.ok(ratio(k.chipText, k.chip) >= 4.5, `${name}: 알약 ${ratio(k.chipText, k.chip).toFixed(2)}`);
        assert.ok(ratio(k.onAccent, k.accent) >= 4.5, `${name}: LOG 알약 ${ratio(k.onAccent, k.accent).toFixed(2)}`);
        assert.ok(ratio(k.quoteBar, k.panel) >= 3, `${name}: 인용 막대 ${ratio(k.quoteBar, k.panel).toFixed(2)}`);
        assert.ok(!['#0a060d', '#7b2cbf', '#ff7518', '#d4a373', '#9d4edd'].some(x => Object.values(k).includes(x)), `${name}: 받은 글꾸 색 값 없음`);
    }
    const nightT = { bg: night.bg, surface: night.surface, raised: night.raised, text: 'rgb(219, 226, 235)', dialogue: 'rgb(243, 247, 252)', em: 'rgb(164, 199, 237)', strong: 'rgb(255, 232, 115)', muted: night.muted, accent: night.accent, marker: night.marker, line: night.line };
    const norm = v => { const m = String(v).match(/rgba?\(([^)]*)\)/); if (m) { const [r, g, b] = m[1].split(/[ ,/]+/).map(Number); return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join(''); } return String(v).toLowerCase(); };
    const outputs = new Map();
    for (const p of hw) {
        const frame = CONCEPT_FRAMES.find(f => f.id === p.id);
        assert.ok(SHAPES[frame.shape], `${p.id}: 모양 조각 ${frame.shape}`);
        const html = renderLog(model, { template: asTemplate(frame), ui, fields, screen: nightT });
        outputs.set(p.id, html);
        inlineOnly(html.replace(/ aria-hidden="true"/g, ''), p.id);
        const plain = withoutSvgData(html);   // 1.0.1 그림 부품 url('data:image/svg+xml,…')(그림만)은 허용 — 그 밖의 주소는 0
        assert.ok(plain !== null && !/https?:|url\(/.test(plain), `${p.id}: 외부 그림 · 글꼴 주소 없음(그림 부품은 svg 데이터 주소만)`);
        assert.ok(!/해피 할로윈|hw-/.test(html), `${p.id}: 받은 글꾸 문구 · 클래스 없음`);
        const k = CONCEPT_COLORS[p.own];
        assert.ok(html.includes('어서 와요, 숲의 손님.'), `${p.id}: 글 내용 그대로`);
        assert.ok(html.includes('letter-spacing:-0.39px'), `${p.id}: 자간 그대로`);
        assert.ok(html.includes('font-style:italic') && html.includes('line-through'), `${p.id}: 기울임 · 취소선 모양 그대로`);
        // 안쪽까지 컨셉 색: 화면 색(밤 본문 · 대사 · 속마음)이 남지 않고 컨셉 역할 색이 들어가요
        for (const screenInk of ['rgb(219, 226, 235)', 'rgb(243, 247, 252)', 'rgb(164, 199, 237)']) assert.ok(!html.includes(`color:${screenInk}`), `${p.id}: 화면 색 ${screenInk} 이 남았어요`);
        for (const role of ['text', 'dialogue', 'thought']) assert.ok(html.toLowerCase().includes(k[role]) || html.includes(`rgb(${[1, 3, 5].map(i => Number.parseInt(k[role].slice(i, i + 2), 16)).join(', ')})`), `${p.id}: 안쪽 ${role} 색`);
        const allowed = new Set([...Object.values(k).map(x => x.toLowerCase()), '#ffffff']);
        for (const m of html.matchAll(/(?:^|[;"])\s*(?:color|background-color):\s*(#[0-9a-f]{6}|rgba?\([^)]*\))/gi)) assert.ok(allowed.has(norm(m[1])), `${p.id}: 컨셉 색 묶음 밖 색 ${m[1]}`);
        // 편집기가 clip-path · transform · 그라데이션을 지운 꼴: 글 칸 바탕 · 글자색은 그대로라 대비 시험(아래)과 같은 값
        const stripped = html.replace(/clip-path:[^;"]*;?/g, '').replace(/transform:[^;"]*;?/g, '').replace(/background-image:[^;"]*;?/g, '');
        assert.ok(stripped.includes('어서 와요, 숲의 손님.') && stripped.length > 500, `${p.id}: 지운 꼴도 글이 그대로`);
    }
    assert.equal(new Set(outputs.values()).size, hw.length, '틀마다 다르게');
    assert.equal(new Set(CONCEPT_FRAMES.map(f => f.shape)).size, CONCEPT_FRAMES.length, '모양 조각이 틀마다 달라요(액자 하나에 색만 바꾼 것 아님)');
    assert.match(outputs.get('halloween-ghost'), /border-radius:18px 18px 18px 6px/, '유령: 메시지마다 말풍선');
    assert.match(outputs.get('halloween-candy'), /polygon\(0 0, 100% 35%/, '사탕: 메시지마다 사탕 포장');
    assert.match(outputs.get('halloween-coffin'), /clip-path:polygon\(24% 0/, '관: 육각 관 윤곽');
    // 데이터 한 줄만 더하면 그려져요 (1.0.1 기념일 길)
    const extra = { id: 'x-test', label: '시험', emoji: '🎂', category: 'event', colors: 'birthday', shape: 'birthday', messages: 'wrap', tail: '🎉' };
    const drawn = drawConcept(model, { ui, fields, height: 420, names: true, gap: true }, extra);
    inlineOnly(drawn.replace(/ aria-hidden="true"/g, ''), 'x-test');
    assert.ok(drawn.includes('polygon(0 0, 100% 35%') && drawn.includes('어서 와요'), '데이터 한 줄로 생일 모양 · 사탕 포장 메시지');
    assert.equal(conceptModel(model, CONCEPT_COLORS.mummy, null).base.bg, CONCEPT_COLORS.mummy.panel, '메시지 칸 바탕 = 컨셉 칸 색');
    assert.match(read('src/log-copy-sheet.js'), /const plain = !!custom\(\) \|\| !!ownColors\(state\.shape\)/, '할로윈 틀에서는 에이드 색 칩을 숨겨요');
});

await test('갤러리 넷: 가로 넘김(overflow-x) · 폴라로이드 · 격자 · 격자 폴라로이드(부제목 · 기록 날짜) · 사진 없으면 안내', () => {
    const images = [{ src: 'https://example.com/a.png', alt: '숲' }, { src: 'https://example.com/b.jpg', alt: '' }, { src: 'https://example.com/c.webp', alt: '"><b>x</b>' }];
    for (const id of ['gallery-strip', 'gallery-strip-polaroid', 'gallery-grid', 'gallery-grid-polaroid']) {
        const html = renderLog(model, { shape: id, colors: salt, ui, fields: { ...fields, subtitle: '세라피나의 기록' }, images });
        inlineOnly(html.replace(/<img [^>]*>/g, ''), id);
        assert.equal((html.match(/<img /g) || []).length, 3, `${id}: 사진 셋`);
        assert.ok(!/<b>/.test(html), `${id}: 사진 설명의 따옴표 · 꺾쇠가 속성 · 태그를 깨지 않아요`);
        if (id.startsWith('gallery-strip')) assert.match(html, /display:flex;gap:8px;overflow-x:auto/, '가로 스크롤 칸 (PC 는 Shift+휠)');
        else assert.match(html, /display:grid;grid-template-columns:repeat\(auto-fill/);
        if (id.includes('polaroid')) assert.match(html, /padding:8px 8px 4px/);
        if (id === 'gallery-grid-polaroid') { assert.ok(html.includes('기록 날짜 · ')); assert.ok(html.includes('세라피나의 기록')); }
        assert.ok(renderLog(model, { shape: id, colors: salt, ui, fields }).includes('사진 코드나 주소를 붙여 넣으면'), '사진 없으면 안내');
    }
});

await test('줄 끊김은 화면 값 그대로 (keep-all 을 덧대지 않아요 — 양쪽 맞춤 줄의 낱말 사이가 벌어지지 않게)', () => {
    const normal = structuredClone(model);
    normal.base['word-break'] = 'normal';
    for (const m of normal.messages) m.font['word-break'] = 'normal';
    for (const p of PRESETS) {
        const html = renderLog(normal, { shape: p.id, colors: p.id === 'plain' ? null : night, ui, fields, images: [{ src: 'https://example.com/a.png', alt: '' }] });
        // 1.0.1 대개편: 머리 제목 · 꼬리말 · 날짜 같은 틀 글에는 keep-all(한국어 낱말 중간 꺾임 막기)을 줘요 — 메시지 글에는 덧대지 않아요
        assert.ok(!/data-bl-msg[^>]*style="[^"]*word-break:keep-all|word-break:keep-all[^"]*"[^>]*>(?:<[^>]+>)*[^<]*(?:어서 와요|조금 쉬어요|숲속 오두막에서)/.test(html), `${p.label}: 메시지 글에 keep-all 없음`);
    }
    assert.match(logHtml(normal), /word-break:normal/, '화면의 word-break 를 옮겨요');
    assert.match(read('src/log-copy-capture.js'), /'word-break': \/\^\(normal\|keep-all\|break-all\|break-word\)\$\/\.test\(style\.wordBreak\)/);
});

await test('붙인 곳 네 조건(어두운 바탕 + 흰 글자 · 밝은 바탕 + 검정 글자 · 그 둘에서 style · class 지운 꼴 · 실리태번 채팅 안)에서 모든 글자 대비 4.5 · 장식 3 — 틀 목록 전부', async () => {
    const { parseColor, compose, contrast: ratio } = await load('src/shared/ink-paint.js');
    const toC = v => parseColor(String(v ?? '').trim());
    /** HTML 글 → 글 조각마다 (글자색 · 바로 뒤 바탕) 대비 — 상속은 붙인 곳 글자색(host.ink)에서 시작해요(인라인 color 가 없으면 그 색이 그대로 걸려요) */
    function audit(html, host, { strip = false } = {}) {
        let src = String(html);
        if (strip) src = src.replace(/<style[\s\S]*?<\/style>/g, '').replace(/\sclass="[^"]*"/g, '');
        const stack = [{ ink: toC(host.ink), bg: toC(host.bg) }];
        const bad = [];
        const VOID = new Set(['img', 'br', 'col', 'hr', 'input', 'meta', 'wbr', 'source']);
        const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s[^<>]*?)?)(\/?)>|([^<]+)/g;
        for (const m of src.matchAll(re)) {
            if (m[5] !== undefined) {
                const text = m[5].replace(/&[a-z#0-9]+;/gi, 'x').replace(/[\s　]+/g, '');
                if (!text) continue;
                const top = stack[stack.length - 1];
                const emoji = /^[\p{Extended_Pictographic}‍️·─\-—.\s]+$/u.test(text);
                const need = emoji ? 3 : 4.5;
                const r = ratio(top.ink, top.bg);
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
            const hidden = /(?:^|;)\s*display:\s*none/.test(style);
            let bg = parent.bg;
            const own = bgV && toC(bgV);
            if (own && own.a > 0.01) bg = own.a >= 0.999 ? own : compose(own, parent.bg);
            let ink = inkV ? toC(inkV) : parent.ink;
            if (ink && ink.a < 0.999) ink = compose(ink, bg);
            stack.push({ ink: hidden ? bg : ink, bg, hidden });
        }
        return bad;
    }
    const hosts = [
        { id: '어두운 게시판', bg: '#121212', ink: '#ffffff' },
        { id: '밝은 게시판', bg: '#ffffff', ink: '#000000' },
        { id: '실리태번 채팅(밤)', bg: night.bg, ink: night.text },
        { id: '실리태번 채팅(낮)', bg: salt.bg, ink: salt.text },
    ];
    const failures = [];
    // 화면에서 일부러 옅게 칠한 글자(취소선 채움 55% 같은 것)도 붙인 곳에서는 4.5 이상으로
    const faint = structuredClone(model);
    faint.messages[1].nodes[0].children.push({ t: 'el', block: false, tag: 'span', kind: 'del', style: { color: 'rgb(70, 80, 95)', 'text-decoration-line': 'line-through' }, children: [{ t: 'text', text: '옅은 글' }] });
    // 내장 심플 글꾸(틈 템플릿)는 마트 글꾸와 같은 자료 — 장식 글(트랙 시간 · 도장 글)은 시안의 옅은 색 그대로라 여기서 빼고, 역할 색 대비는 mart-geulkku-64 가 봐요
    for (const preset of PRESETS.filter(p => !p.template)) for (const [pname, colors] of [['밤', night], ['낮', salt]]) {
        const html = renderLog(faint, { shape: preset.id, colors: preset.id === 'plain' ? null : colors, ui, fields, images: [{ src: 'https://example.com/a.png', alt: '세라피나' }] });
        for (const host of hosts) for (const strip of [false, true]) {
            const bad = audit(html, host, { strip });
            if (bad.length) failures.push(`${preset.label}/${pname}/${host.id}${strip ? '/style·class 지움' : ''}: ${bad.slice(0, 3).join(' · ')}`);
        }
    }
    assert.deepEqual(failures, [], `안 보이는(대비 낮은) 글자: ${failures.length}건`);
    // 글자 요소마다 인라인 color — 상속 · 꾸밈 블록에 기대는 글자 0
    for (const preset of PRESETS) {
        const html = renderLog(model, { shape: preset.id, colors: night, ui, fields });
        for (const m of html.matchAll(/<(div|span|td|summary|details|tr|table)( [^>]*)?>/g)) assert.match(m[0], /style="(?:[^"]*;)?color:/, `${preset.label}: 글자색 없는 요소 ${m[0].slice(0, 60)}`);
        // 내장 심플(틈 템플릿)의 글 없는 장식 조각(aria-hidden · 빈 요소 — 소인 · 도장 고리)은 옅어도 돼요(글자가 아니에요)
        const glyphs = preset.template ? html.replace(/<(span|div|i) aria-hidden="true"[^>]*><\/\1>/g, '') : html;
        assert.ok(!/opacity:|-webkit-text-fill-color|background-clip:\s*text/.test(glyphs), `${preset.label}: 투명 · 흐린 글자 없음`);
    }
});

await test('1.0.9 「레몬」 틀 제목 앞은 🍋 이모지가 아니라 테마 레몬 그림(fa-lemon 윤곽 svg) — 소독을 지나도 남아요', async () => {
    const { safeCss } = await load('src/log-copy-sanitize.js');
    const html = renderLog(model, { shape: 'lemon', colors: night, ui, fields });
    assert.ok(!html.includes('🍋'), '이모지 없음');
    const style = html.match(/<span style="([^"]*FFE23C[^"]*)"><\/span>/i)?.[1];
    assert.ok(style, '레몬 그림 칸');
    assert.ok(html.indexOf(style) < html.indexOf('Seraphina'), '제목 앞에 와요');
    assert.match(style, /url\('data:image\/svg\+xml,/);
    assert.equal(safeCss(style), style, '붙여 넣기 소독에서 그대로');
});
await test('11-09 닫힌 채 시작하는 반응 글꾸(봉투 · 초대장): 틀 원본은 닫힘 · 미리보기만 펼침(data-bl-peek) · 복사 글(shutPeek · 소독)은 다시 닫힘', async () => {
    const { shutPeek, peekTemplate } = await load('src/log-copy-presets.js');
    const { BUILTIN_TEMPLATES } = await load('src/log-copy-builtin.gen.js');
    const { checkTemplate } = await load('src/log-copy-template.js');
    for (const id of ['c-react-sp-1', 'c-react-sp-2']) {
        const t = BUILTIN_TEMPLATES.find(x => x.id === id);
        assert.ok(t && /<details style="/.test(t.template) && !/<details[^>]*\sopen=/.test(t.template), `${id}: 원본(복사 · 테마용 · 담기)은 닫힌 채`);
        assert.ok(checkTemplate(t.template).ok, `${id}: 받은 글꾸 규칙 그대로`);
        const html = renderLog(model, { shape: id, ui, fields });
        assert.equal((html.match(/<details open="" data-bl-peek=""/g) ?? []).length, 1, `${id}: 미리보기는 펼침`);
        const out = shutPeek(html);
        assert.ok(!shutPeek(html.replace('<details open="" data-bl-peek=""', '<details data-bl-peek=""')).includes('data-bl-peek'), `${id}: 미리보기에서 닫은 뒤 복사해도 표시가 안 남아요`);
        assert.ok(!/<details[^>]*\sopen=/.test(out) && !out.includes('data-bl-peek'), `${id}: 복사 글은 닫힘`);
    }
    // 처음부터 펼친 틀(편지 · 소포)과 자리에 끼운 부품은 그대로
    for (const id of ['concept-sp-letter', 'concept-sp-parcel']) assert.ok(!renderLog(model, { shape: id, ui, fields }).includes('data-bl-peek'), `${id}: 펼친 채 그대로`);
    assert.equal(peekTemplate('<div>{{info}}</div>'), '<div>{{info}}</div>');
    assert.equal(peekTemplate('<details open="" style="a">'), '<details open="" style="a">');
    // 1.1.0 값 없는 open(이미 열린 상자)에는 표시를 붙이지 않아요 — 붙이면 복사(result · shutPeek)에서 원래 열린 상자가 닫혔어요 · data-open 은 open 이 아니에요
    for (const t of ['<details open><summary>a</summary></details>', '<details class="e" open>x</details>', '<details\nopen>x</details>', '<details open/>']) assert.equal(peekTemplate(t), t, t);
    assert.equal(peekTemplate('<details data-open="1">x</details>'), '<details open="" data-bl-peek="" data-open="1">x</details>');
    // 복사 소독은 미리보기 표시(data-bl-peek)를 걷어요 — 혹시 남아도 붙인 곳엔 안 가요
    const sheet = fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8');
    assert.match(sheet, /details\[data-bl-peek\][\s\S]{0,120}removeAttribute\('open'\)/, '로그 복사 창 결과(result)에서 다시 닫아요');
    // 1.1.0 창을 닫을 때 남은 대기(규칙 · 그림 주소 · 글자색 · 되돌리기)를 모두 걷어요
    const onClose = /dialog\.addEventListener\('close', \(\) => \{([^\n]*)\}, \{ once: true \}\)/.exec(sheet)?.[1] ?? '';
    for (const t of ['ruleTimer', 'imageTimer', 'inkTimer', 'hist.timer']) assert.ok(onClose.includes(`clearTimeout(${t})`), `닫을 때 ${t} 를 걷어요`);
});

await test('이름 숨김: 가림 글자를 직접 정해요(word) · 제목 · 보낸 이 칸이 숨긴 이름이면 비워요', () => {
    const named = { ...model, chatName: 'Seraphina', userName: 'Lemon' };
    const { model: out } = transformLog(named, { hide: { names: ['Seraphina', 'Lemon', '숲'], mask: 'auto', word: '아무개' } });
    assert.ok(msgText(out.messages[0]).includes('어서 와요, 아무개의 손님.'), '본문 속 이름은 정한 글자로: ' + msgText(out.messages[0]));
    assert.equal(out.chatName, '', '제목 칸');
    assert.equal(out.userName, '', '보낸 이 칸');
    assert.equal(maskNode('세라', { mask: 'auto', word: '아무개' }).text, '아무개');
    assert.equal(maskNode('세라', { mask: 'auto', word: '' }).text, '○○', '빈 글자면 기본 ○○');
});
console.log(`log-copy: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
