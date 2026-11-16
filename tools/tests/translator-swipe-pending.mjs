// 번역 1.5.9 새 답을 만드는 스와이프 — 자동 번역이 옛 글의 번역을 '...' 위에 다시 그리지 않는다.
//   실리태번은 새 답 스와이프에서 swipe_id 만 새 칸(= swipes 길이)으로 올리고 mes 는 옛 글인 채 본문을 '...' 로 바꾼 뒤 MESSAGE_SWIPED 를 낸다.
//   예전 문지기(isGeneratingSwipe)는 화면 글자가 정확히 '...' 인지만 봐서, 다른 확장이 그 순간 본문에 조각(상태 띠 · 표식)을 붙이면 지나쳤고
//   옛 글의 번역(캐시)을 꺼내 다시 그렸다 — 요청은 나갔는데 첫 토큰까지 화면이 옛 번역문 그대로였다(「첫 스와이프가 안 넘어감 · 멈추고 두 번째는 됨」).
//   index.js 의 isGeneratingSwipe · translateIncomingMessage 를 잘라 내 가짜 env 위에서 돌린다 (네트워크 없음 · 지어낸 글만).
//   node tools/tests/translator-swipe-pending.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const src = read('src/addons/translator/index.js');

function cut(source, name) {
    const at = source.search(new RegExp(`\\n(?:async )?function ${name}\\(`));
    assert.ok(at >= 0, 'missing ' + name);
    return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2);
}

const CHAT = [];
const calls = [];
const SHOWN = new Map();   // 메시지 번호 → 본문(.mes_text)의 자식 노드들
const STATE = { processor: null, generating: false };
const textNode = text => ({ nodeType: 3, textContent: text });
const element = (text, cls = '') => ({ nodeType: 1, textContent: text, classList: { contains: name => cls.split(' ').includes(name) } });
const env = {
    Node: { COMMENT_NODE: 8 },
    document: {
        querySelectorAll: selector => { const id = Number(/mesid="(\d+)"/.exec(selector)?.[1]); return SHOWN.has(id) ? [{ childNodes: SHOWN.get(id) }] : []; },
        get body() { return { dataset: STATE.generating ? { generating: 'true' } : {} }; },
    },
    getContext: () => ({ chat: CHAT, streamingProcessor: STATE.processor }),
    cutByWatchdog: () => false,
    autoSkipReason: () => null,
    hideStaleTranslation: () => Promise.resolve(false),
    translateMessage: (id, force, source) => { calls.push([id, force, source]); return Promise.resolve(); },
    console: { info() {}, warn() {} },
    toastr: { info() {} },
};
const api = new Function('env', `with (env) {
    ${cut(src, 'isGeneratingSwipe')}
    ${cut(src, 'translateIncomingMessage')}
    return { isGeneratingSwipe, translateIncomingMessage };
}`)(env);

let pass = 0, fail = 0;
async function test(name, fn) {
    CHAT.length = 0; SHOWN.clear(); calls.length = 0; STATE.processor = null; STATE.generating = false;
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const OLD = 'The fog never lifted over the harbor.';
const reply = (extra = {}) => { const m = { name: '미나', is_user: false, mes: OLD, extra: {}, swipe_id: 0, swipes: [OLD], ...extra }; CHAT.push(m); return m; };

await test('새 답 스와이프(swipe_id = swipes 길이 · mes 는 옛 글): 다른 확장이 본문에 조각을 붙여 화면 글이 "..." 이 아니어도 자동 번역하지 않는다', async () => {
    const m = reply({ swipe_id: 1 });                                  // 실리태번이 새 칸으로 올린 직후
    SHOWN.set(0, [textNode('...'), element('상태 띠', 'status-strip')]);   // 다른 확장의 조각
    assert.equal(api.isGeneratingSwipe(0), true);
    await api.translateIncomingMessage(0);
    assert.deepEqual(calls, [], '옛 글의 번역을 다시 붙이면 안 돼요');
    assert.equal(m.mes, OLD);
});

await test('새 답 스와이프: 본문이 통째로 다시 그려져 옛 글이 보여도(다른 확장의 다시 그리기) 자동 번역하지 않는다', async () => {
    reply({ swipe_id: 2, swipes: [OLD, 'second'] });
    SHOWN.set(0, [element(OLD)]);
    await api.translateIncomingMessage(0);
    assert.deepEqual(calls, []);
});

await test('이미 있는 스와이프로 넘김(swipe_id 가 swipes 안) · 스와이프가 없는 메시지: 예전처럼 자동 번역한다', async () => {
    reply({ swipe_id: 1, swipes: [OLD, 'A second reply.'], mes: 'A second reply.' });
    SHOWN.set(0, [element('A second reply.')]);
    await api.translateIncomingMessage(0);
    assert.deepEqual(calls, [[0, false, 'auto']]);
    calls.length = 0;
    const plain = { name: '미나', is_user: false, mes: OLD, extra: {} }; CHAT.push(plain);
    SHOWN.set(1, [element(OLD)]);
    await api.translateIncomingMessage(1);
    assert.deepEqual(calls, [[1, false, 'auto']]);
});

await test('답이 저장된 뒤(새 칸이 채워짐): 그 답은 자동 번역한다', async () => {
    reply({ swipe_id: 1, swipes: [OLD, 'A fresh reply.'], mes: 'A fresh reply.' });
    SHOWN.set(0, [element('A fresh reply.')]);
    STATE.processor = { messageId: 0, isFinished: true, isStopped: false };
    await api.translateIncomingMessage(0);
    assert.deepEqual(calls, [[0, false, 'auto']]);
});

await test('예전 문지기도 그대로: 화면이 "..." · "…" · 번역 진행 표시가 붙은 "..." · 스트리밍 중이면 건너뛴다', async () => {
    reply();
    for (const nodes of [[textNode('...')], [textNode('…')], [element('번역 중 · 7초', 'llmt-progress'), textNode('...')], [{ nodeType: 8, textContent: 'c' }, textNode(' ... ')]]) {
        SHOWN.set(0, nodes);
        assert.equal(api.isGeneratingSwipe(0), true, JSON.stringify(nodes.map(n => n.textContent)));
    }
    SHOWN.set(0, [element('Half a rep')]);
    STATE.processor = { messageId: 0, isFinished: false, isStopped: false };
    assert.equal(api.isGeneratingSwipe(0), true);
    STATE.processor = null;
    assert.equal(api.isGeneratingSwipe(0), false);
});

await test('출시 점검(release-check.yml)에 이 시험이 들어 있다', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/translator-swipe-pending\.mjs \./);
});

console.log(`translator-swipe-pending: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
