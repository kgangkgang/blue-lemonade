// 1.9.4 환영 화면 다듬기 (src/welcome-tidy.js) — jsdom 으로.
//   node tools/tests/welcome-tidy.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools` 로 불러요.
// 11-21 폰 제보: 기본 인사가 「… 물어보세요! *** *팁:* 아무 캐릭터나 …」 한 줄로 · 최근 채팅 미리보기에 <span style="…"> 날것.
//   리그에서 실리태번 messageFormatting 이 그 프리셋의 줄 잇기 정규식으로 똑같이 깨진 HTML 을 내는 것을 확인했어요(아래 BROKEN 이 그 HTML).
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const dom = new JSDOM('<!doctype html><html><body><div id="chat"></div></body></html>');
const { window } = dom;
for (const k of ['document', 'MutationObserver', 'Node']) globalThis[k] = window[k];
const W = await import(pathToFileURL(path.join(root, 'src/welcome-tidy.js')).href);
const doc = window.document;
const tick = () => new Promise(r => setTimeout(r, 0));
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  통과  ${name}`); }
    catch (error) { fail++; console.log(`  실패  ${name}\n${error?.stack || error}`); }
}

const KO = {
    [W.GREETING_KEY]: 'API에 연결돼 있다면 저에게 뭐든 물어보세요!',
    [W.HINT_KEY]: '**팁:** 아무 캐릭터나 「더 보기...」 메뉴에서 환영 화면 도우미로 정할 수 있어요.',
};
const translate = k => KO[k] ?? k;
const KO_MES = KO[W.GREETING_KEY] + W.RULE + KO[W.HINT_KEY];
const BROKEN = '<p>API에 연결돼 있다면 저에게 뭐든 물어보세요! *** *<em>팁:</em>* 아무 캐릭터나 <q><span class="bl-quote-lead">「더</span> 보기…」</q> 메뉴에서 환영 화면 도우미로 정할 수 있어요.</p>';
const GOOD = '<p>API에 연결돼 있다면 저에게 뭐든 물어보세요!</p>\n<hr>\n<p><strong>팁:</strong> 아무 캐릭터나 <q>「더 보기…」</q> 메뉴에서 환영 화면 도우미로 정할 수 있어요.</p>';
function mesEl(html, { id = 0, type = 'assistant_message' } = {}) {
    const el = doc.createElement('div');
    el.className = 'mes'; el.setAttribute('mesid', String(id));
    if (type) el.setAttribute('type', type);
    el.innerHTML = `<div class="mes_block"><div class="mes_text">${html}</div></div>`;
    return el;
}
const shape = el => [...el.querySelector('.mes_text').children].map(c => c.tagName.toLowerCase() + (c.querySelector('strong') ? '>strong' : '')).join(',');

await test('기본 인사 글: 영어 · 지금 언어 둘 다', () => {
    const set = W.defaultGreetings(translate);
    assert.ok(set.has(W.GREETING_KEY + W.RULE + W.HINT_KEY));
    assert.ok(set.has(KO_MES));
    assert.equal(W.defaultGreetings(() => { throw new Error('x'); }).size, 1);
});

await test('깨진 기본 인사(줄 잇기 정규식 뒤) → 문단 · 가로줄 · 굵은 「팁:」 문단', () => {
    const el = mesEl(BROKEN);
    assert.equal(W.tidyGreeting(el, { mes: KO_MES, extra: { type: 'assistant_message' } }, W.defaultGreetings(translate)), 'fixed');
    assert.equal(shape(el), 'p,hr,p>strong');
    const body = el.querySelector('.mes_text');
    assert.equal(body.querySelector('strong').textContent, '팁:');
    assert.equal(body.children[0].textContent, KO[W.GREETING_KEY]);
    assert.equal(body.children[2].textContent, '팁: 아무 캐릭터나 「더 보기...」 메뉴에서 환영 화면 도우미로 정할 수 있어요.');
    assert.ok(!/\*/.test(body.textContent), '별표가 남으면 안 돼요');
});

await test('실리태번 그리기 함수가 있으면 문단을 따로 그려 가로줄로 이어요(따옴표 · 말줄임표 순정 그대로)', () => {
    const seen = [];
    const format = text => { seen.push(text); return '<p>' + text.replace(/\*\*(.+?)\*\*/, '<strong>$1</strong>').replace('「더 보기...」', '<q>「더 보기…」</q>') + '</p>'; };
    const el = mesEl(BROKEN);
    assert.equal(W.tidyGreeting(el, { mes: KO_MES, extra: { type: 'assistant_message' } }, W.defaultGreetings(translate), format), 'fixed');
    assert.deepEqual(seen, [KO[W.GREETING_KEY], KO[W.HINT_KEY]], '줄바꿈 없는 문단 하나씩');
    assert.equal(shape(el), 'p,hr,p>strong');
    assert.equal(el.querySelector('q')?.textContent, '「더 보기…」');
    // 그리기가 이상하면(가로줄 · 굵게 없음 · 오류) 손으로 만든 꼴로
    for (const bad of [() => '', () => { throw new Error('x'); }, text => `<p>${text}</p>`]) {
        const e2 = mesEl(BROKEN);
        assert.equal(W.tidyGreeting(e2, { mes: KO_MES, extra: { type: 'assistant_message' } }, W.defaultGreetings(translate), bad), 'fixed');
        assert.equal(shape(e2), 'p,hr,p>strong');
    }
});

await test('영어 기본 인사도 같은 꼴', () => {
    const el = mesEl('<p>If you\'re connected to an API, try asking me something! *** *<em>Hint:</em>* Set any …</p>');
    assert.equal(W.tidyGreeting(el, { mes: W.GREETING_KEY + W.RULE + W.HINT_KEY, extra: { type: 'assistant_message' } }, W.defaultGreetings(translate)), 'fixed');
    assert.equal(shape(el), 'p,hr,p>strong');
    assert.equal(el.querySelector('strong').textContent, 'Hint:');
});

await test('이미 가로줄이 있으면(프리셋 정규식 없음) 그대로', () => {
    const el = mesEl(GOOD); const before = el.innerHTML;
    assert.equal(W.tidyGreeting(el, { mes: KO_MES, extra: { type: 'assistant_message' } }, W.defaultGreetings(translate)), 'ok');
    assert.equal(el.innerHTML, before);
});

await test('도우미로 정한 캐릭터의 첫 메시지 · 다른 메시지 · 편집 중은 안 건드려요', () => {
    const set = W.defaultGreetings(translate);
    for (const [msg, html] of [
        [{ mes: '안녕!\n***\n**나** 는 도우미', extra: { type: 'assistant_message' } }, '<p>안녕! *** *<em>나</em>* 는 도우미</p>'],
        [{ mes: KO_MES, extra: {} }, BROKEN],
        [{ mes: KO_MES }, BROKEN],
        [undefined, BROKEN],
        [{ mes: KO_MES, extra: { type: 'assistant_message' } }, '<textarea class="edit_textarea"></textarea>'],
    ]) {
        const el = mesEl(html); const before = el.innerHTML;
        assert.equal(W.tidyGreeting(el, msg, set), 'skip');
        assert.equal(el.innerHTML, before);
    }
});

await test('미리보기: 태그만 떼고 글은 그대로', () => {
    assert.equal(W.plainPreview('<span style="color:#424C59">「……잠깐만」</span> She doesn’t move'), '「……잠깐만」 She doesn’t move');
    assert.equal(W.plainPreview('...le="color:#424C59">「あ」</span> 그 뒤'), '... 「あ」 그 뒤');
    assert.equal(W.plainPreview('<div><style>.a{color:red}</style><b>굵게</b> 끝</div>'), '굵게 끝');
    assert.equal(W.plainPreview('<!-- 숨김 -->보임 <br/>다음'), '보임 다음');
    assert.equal(W.plainPreview('<sola_hud mood="calm">x</sola_hud> 끝'), 'x 끝');
    const plain = '*톡.* She sets the cup down'; assert.equal(W.plainPreview(plain), plain);
    const prose = '3 < 5 그리고 7 > 2 — 화살표 -> 그대로'; assert.equal(W.plainPreview(prose), prose);
    assert.equal(W.plainPreview(''), ''); assert.equal(W.plainPreview(null), null);
});

await test('켜면: 새로 붙는 환영 화면 · 기본 인사만 고치고 다른 메시지 본문은 그대로', async () => {
    const chat = doc.getElementById('chat');
    globalThis.SillyTavern = { getContext: () => ({ translate, chat: [{ mes: KO_MES, extra: { type: 'assistant_message' } }, { mes: KO_MES, extra: {} }] }) };
    const off = W.installWelcomeTidy(chat);
    const panel = doc.createElement('div'); panel.className = 'welcomePanel';
    panel.innerHTML = '<div class="recentChat"><div class="chatMessage" title="&lt;i&gt;속&lt;/i&gt; 말">&lt;span style="color:#424C59"&gt;「대사」&lt;/span&gt; 이어서</div></div><div class="recentChat"><div class="chatMessage">그냥 글</div></div>';
    chat.append(panel);
    const greet = mesEl(BROKEN, { id: 0 }); chat.append(greet);
    const other = mesEl(BROKEN, { id: 1, type: null }); chat.append(other);
    await tick();
    const boxes = panel.querySelectorAll('.chatMessage');
    assert.equal(boxes[0].textContent, '「대사」 이어서');
    assert.equal(boxes[0].getAttribute('title'), '속 말');
    assert.equal(boxes[1].textContent, '그냥 글');
    assert.equal(shape(greet), 'p,hr,p>strong');
    assert.equal(other.querySelector('.mes_text').innerHTML, BROKEN, '일반 메시지 본문은 안 건드려요');
    off();
    const again = mesEl(BROKEN, { id: 0 }); chat.append(again); await tick();
    assert.equal(again.querySelector('.mes_text').innerHTML, BROKEN, '끄면 안 봐요');
    chat.replaceChildren();
});

await test('켤 때 이미 떠 있던 환영 화면도 한 번 봐요', async () => {
    const chat = doc.getElementById('chat');
    const greet = mesEl(BROKEN, { id: 0 }); chat.append(greet);
    W.installWelcomeTidy(chat); await tick();
    assert.equal(shape(greet), 'p,hr,p>strong');
    W.uninstallWelcomeTidy(); chat.replaceChildren();
});

console.log(`welcome-tidy: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
