// 1.0.3 QR 책장 (src/qr-shelf-core.js · src/qr-shelf-keep.js · src/qr-shelf.js · layout.js 책 단추): 순수 계산 + 가짜 브라우저(leak-dom)에서 창 열기.
//   · 저장값 다듬기 · 이름표(세트 + QR id) · 전역 · 채팅 · 캐릭터 세트 모으기(QR 에서 숨긴 것 빼기) · 칸 · 찾기
//   · AI 정리: 빈 칸만 · 보낼 개수 상한 · 답 읽기(빈 칸만 채움 · 번호 틀린 줄 버림) · 묻고 나서만 보냄 · 미리 보기에서 고치고 채우기 · 되돌리기
//   · 누르면 창을 닫고 QR 의 execute() · 최근 · 즐겨찾기 · 숨기기
//   · 보관함 창구: 없으면 칸 숨김 · 받았을 때만 채팅에서 빼기 · 못 받으면 그대로 · 듣기는 한 번 걸고 바로 뗌
//   · 기본 끔 · 켜기만으로는 모듈을 받지 않음(시작 그래프 밖 · features.js 에 없음 · 누를 때 동적 import)
//   node tools/tests/qr-shelf.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const core = await import(url('src/qr-shelf-core.js'));
const K = (set, id) => core.keyOf(set, id);

// 지어낸 QR 세트 (실제 사용자 자료 아님)
const runs = [];
function makeQr(id, label, message, extra = {}) { return { id, label, message, title: '', icon: '', isHidden: false, ...extra, execute() { runs.push(label); return Promise.resolve(); } }; }
function makeSettings() {
    const daily = { name: '일상', qrList: [makeQr(1, '인사', '/echo 안녕하세요'), makeQr(2, '날씨', '/gen 오늘 날씨를 한 줄로', { title: '날씨 한 줄' }), makeQr(3, '숨김 도우미', '/setvar x', { isHidden: true })] };
    const lore = { name: '세계 설정', qrList: [makeQr(1, '지도', '/gen 대륙 지도를 설명해 줘'), makeQr(2, '연표', '/gen 연표 요약', { icon: 'fa-scroll' })] };
    const bot = { name: '봇 전용', qrList: [makeQr(7, '상태', '/gen 지금 상태창')] };
    return {
        isEnabled: true,
        config: { setList: [{ set: daily, isVisible: true }, { set: lore, isVisible: false }] },
        chatConfig: { setList: [{ set: bot, isVisible: true }] },
        charConfig: { setList: [{ set: daily, isVisible: true }] },
    };
}

// ───────── 순수 계산 ─────────
await test('다듬기: 깨진 값 · 긴 글 · 이상한 열쇠는 버리고 표시 칸만 · 최근은 12개 · 중복 없음', () => {
    const raw = { on: true, items: { [K('일상', 1)]: { n: '  인사  하기 ' + 'ㄱ'.repeat(60), d: 'x', c: '일상', f: true, h: 'yes', extra: 1 }, nosep: { n: 'x' }, __proto__: { n: 'p' }, [K('a', 2)]: { f: false }, [K('b', 3)]: 'junk' },
        recent: [K('일상', 1), K('일상', 1), 'bad', ...Array.from({ length: 20 }, (_, i) => K('s', i))] };
    const s = core.tidyStore(raw);
    assert.equal(s.on, true);
    assert.deepEqual(Object.keys(s.items), [K('일상', 1)]);
    assert.equal(s.items[K('일상', 1)].n.length, 40); assert.match(s.items[K('일상', 1)].n, /^인사 하기 /);
    assert.equal(s.items[K('일상', 1)].f, true); assert.equal('h' in s.items[K('일상', 1)], false, '참/거짓만'); assert.equal('extra' in s.items[K('일상', 1)], false);
    assert.equal(s.recent.length, 12); assert.equal(new Set(s.recent).size, 12);
    assert.deepEqual(core.tidyStore(null), { on: false, items: {}, recent: [] });
});
await test('setMeta: 빈 칸은 지우고 다 비면 항목째 지움 · 바뀌었을 때만 true', () => {
    const s = core.tidyStore({});
    assert.equal(core.setMeta(s, K('a', 1), { n: '이름', f: true }), true);
    assert.equal(core.setMeta(s, K('a', 1), { n: '이름' }), false);
    core.setMeta(s, K('a', 1), { n: '', f: false });
    assert.deepEqual(s.items, {});
    assert.equal(core.setMeta(s, '__proto__', { n: 'x' }), false);
});
await test('모으기: 전역 · 채팅 · 캐릭터 세트(줄에서 감춘 세트도) · QR 에서 숨긴 것은 빼고 · 같은 세트가 둘이면 한 번 · 채팅 · 캐릭터 몫은 이 봇', () => {
    const items = core.collect(makeSettings());
    assert.deepEqual(items.map(i => i.label), ['인사', '날씨', '지도', '연표', '상태']);
    assert.equal(items.find(i => i.label === '인사').bot, true, '캐릭터에도 묶인 일상 세트');
    assert.equal(items.find(i => i.label === '지도').bot, false);
    assert.equal(items.find(i => i.label === '상태').bot, true);
    assert.equal(items.find(i => i.label === '연표').icon, 'fa-scroll');
    assert.equal(items[0].key, K('일상', 1));
    assert.deepEqual(core.collect(undefined), []);
    assert.equal(core.collect({ config: { setList: [{ set: { name: 'x', qrList: [makeQr(1, 'a', 'b', { icon: 'fa-x" onclick="y' })] } }] } })[0].icon, '', '아이콘 이름이 이상하면 버림');
});
await test('칸 · 찾기: 즐겨찾기 · 최근 · 전체는 늘 · 이 봇 · 세계관 · 카테고리 · 미분류는 든 것이 있을 때만 · 숨긴 것은 전체 칸 「숨긴 것 보기」에서만', () => {
    const items = core.collect(makeSettings());
    const s = core.tidyStore({ items: { [K('세계 설정', 1)]: { c: '세계관', f: true }, [K('세계 설정', 2)]: { c: '세계관' }, [K('일상', 2)]: { c: '일상', d: '오늘 날씨' }, [K('봇 전용', 7)]: { h: true } }, recent: [K('일상', 2), K('없음', 1)] });
    const tabs = core.tabsFor(s, items);
    assert.deepEqual(tabs.map(t => t.id), ['fav', 'recent', 'bot', 'world', 'cat:일상', 'none', 'all']);
    assert.deepEqual(tabs.map(t => t.count), [1, 1, 2, 2, 1, 1, 4]);
    const labels = list => list.map(i => i.label);
    assert.deepEqual(labels(core.listFor(s, items, 'bot')), ['인사', '날씨'], '숨긴 상태는 빠짐');
    assert.deepEqual(labels(core.listFor(s, items, 'world')), ['지도', '연표']);
    assert.deepEqual(labels(core.listFor(s, items, 'recent')), ['날씨'], '없어진 QR 은 건너뜀');
    assert.deepEqual(labels(core.listFor(s, items, 'all')), ['인사', '날씨', '지도', '연표']);
    assert.deepEqual(labels(core.listFor(s, items, 'all', { showHidden: true })), ['인사', '날씨', '지도', '연표', '상태']);
    assert.deepEqual(labels(core.search(s, items, '날씨')), ['날씨']);
    assert.deepEqual(labels(core.search(s, items, '대륙')), ['지도'], '내용으로도');
    assert.deepEqual(labels(core.search(s, items, '상태')), [], '숨긴 것은 찾기에서도 빠짐');
    assert.deepEqual(core.tabsFor(core.tidyStore({}), []).map(t => t.id), ['fav', 'recent', 'all']);
    assert.equal(core.nameOf(s, items[1]), '날씨'); assert.equal(core.descOf(s, items[1]), '오늘 날씨'); assert.equal(core.descOf(s, items[0]), '/echo 안녕하세요');
});
await test('AI 정리 거리: 이름 · 설명 · 카테고리 중 빈 것이 있는 QR(숨긴 것 빼고) · 60개씩 · 보내는 글은 세트 · 이름표 · 내용 앞 240자', () => {
    const many = { config: { setList: [{ set: { name: '큰 세트', qrList: Array.from({ length: 70 }, (_, i) => makeQr(i, `q${i}`, 'x'.repeat(500))) } }] } };
    const items = core.collect(many);
    const s = core.tidyStore({ items: { [K('큰 세트', 0)]: { n: 'a', d: 'b', c: 'c' }, [K('큰 세트', 1)]: { h: true } } });
    const { list, rest } = core.aiTargets(s, items);
    assert.equal(list.length, 60); assert.equal(rest, 8); assert.equal(list[0].label, 'q2');
    const msgs = core.aiMessages(s, list.slice(0, 2), ['전투']);
    assert.equal(msgs.length, 2); assert.equal(msgs[0].role, 'system');
    assert.match(msgs[1].content, /카테고리 목록: 세계관, 전투/);
    assert.match(msgs[1].content, /^1 \| 큰 세트 \| q2 \| x{240}$/m);
    assert.ok(!msgs[1].content.includes('x'.repeat(241)));
    assert.equal(core.aiResponseTokens(1), 400); assert.equal(core.aiResponseTokens(60), 3720); assert.equal(core.aiResponseTokens(500), 4000);
});
await test('AI 답 읽기: 코드 울타리 · 생각 칸이 붙어도 · 이미 적힌 칸은 그대로 · 번호가 틀리거나 겹친 줄은 버림 · 글 길이 자름', () => {
    const items = core.collect(makeSettings());
    const s = core.tidyStore({ items: { [K('일상', 2)]: { n: '내 날씨' } } });
    const targets = [items[0], items[1]];
    const text = '<think>음</think>```json\n{"items":[{"i":1,"name":"인사말","desc":"반갑게 인사해요","cat":"일상"},{"i":2,"name":"덮으면 안 됨","desc":"날씨 한 줄","cat":"일상"},{"i":9,"name":"x"},{"i":1,"name":"두 번"}]}\n```';
    const { rows, dropped } = core.aiParse(text, s, targets);
    assert.deepEqual(rows.map(r => [r.n, r.d, r.c]), [['인사말', '반갑게 인사해요', '일상'], ['내 날씨', '날씨 한 줄', '일상']]);
    assert.equal(dropped, 2);
    assert.equal(core.aiParse('[{"i":1,"name":"' + 'ㄱ'.repeat(99) + '"}]', s, targets).rows[0].n.length, 40);
    assert.deepEqual(core.aiParse('답을 못 했어요', s, targets).rows, []);
});

// ───────── 보관함 창구 ─────────
const keepMod = await import(url('src/qr-shelf-keep.js'));
await test('보관함 창구 찾기: 없음 · keep 없음 · available() false · 던짐은 null · 이름표 30자', () => {
    const g = {};
    assert.equal(keepMod.keeper(g), null);
    g[keepMod.KEEPER] = { label: '보관함' }; assert.equal(keepMod.keeper(g), null);
    g[keepMod.KEEPER] = { keep() {}, available: () => false }; assert.equal(keepMod.keeper(g), null);
    g[keepMod.KEEPER] = { keep() {}, available() { throw new Error('x'); } }; assert.equal(keepMod.keeper(g), null);
    g[keepMod.KEEPER] = { keep() {}, label: ' 내 상자 ' }; assert.ok(keepMod.keeper(g)); assert.equal(keepMod.keeperLabel(keepMod.keeper(g)), '내 상자');
    assert.equal(keepMod.keeperLabel({}), '보관함');
    assert.deepEqual(['보관함', '상자', '서랍', 'Box'].map(keepMod.toward), ['보관함으로', '상자로', '서랍으로', 'Box(으)로']);
});

// ───────── 가짜 브라우저 ─────────
const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, qrShelf: { on: true, items: {}, recent: [] } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
const quiet = () => {}; console.warn = quiet; console.info = quiet;
const settle = async (ms = 40) => { await dom.clock.advance(ms); for (let i = 0; i < 10; i++) await null; };
const toasts = [];
globalThis.toastr = { info: (m) => { toasts.push(['info', m]); return null; }, success: (m) => { toasts.push(['success', m]); return null; }, warning: (m) => { toasts.push(['warning', m]); return null; }, error() {}, clear() {} };

await test('보관함으로: 누른 뒤 처음 붙는 AI 답만 · 사용자 · 시스템 · 옛 메시지는 건너뜀 · 받으면 실리태번 삭제 함수로 빼고 · 듣기는 바로 뗌', async () => {
    ctx.chat = [{ mes: '옛 답', is_user: false }];
    const kept = [], deleted = [];
    ctx.deleteMessage = async id => { deleted.push(id); ctx.chat.splice(id, 1); };
    const before = eventSource.count();
    const k = { label: '상자', keep: async entry => { kept.push(entry); return true; } };
    keepMod.watchReply({ ctx, keep: k, title: '날씨 한 줄', label: '날씨', toast: globalThis.toastr });
    assert.equal(eventSource.count(), before + 2, '사건 두 개만');
    await eventSource.emit(ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, 0);
    ctx.chat.push({ mes: '내 말', is_user: true }); await eventSource.emit(ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, 1);
    ctx.chat.push({ mes: '알림', is_system: true }); await eventSource.emit(ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, 2);
    assert.equal(kept.length, 0);
    ctx.chat.push({ mes: '오늘은 맑아요', name: '해설', is_user: false }); await eventSource.emit(ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, 3);
    await settle();
    assert.equal(kept.length, 1); assert.equal(kept[0].text, '오늘은 맑아요'); assert.equal(kept[0].title, '날씨 한 줄'); assert.equal(kept[0].source, 'blue-lemonade.qr-shelf');
    assert.deepEqual(deleted, [3]);
    assert.equal(eventSource.count(), before, '다 뗌');
    assert.match(toasts.at(-1)[1], /상자에 넣고 채팅에서는 뺐어요/);
});
await test('보관함으로: 못 받으면(false · 오류) 채팅에 그대로 · 채팅이 바뀌면 그냥 뗌 · 2분 지나면 뗌', async () => {
    ctx.chat = []; const deleted = [];
    ctx.deleteMessage = async id => { deleted.push(id); };
    const before = eventSource.count();
    keepMod.watchReply({ ctx, keep: { keep: async () => false }, toast: globalThis.toastr });
    ctx.chat.push({ mes: '답', is_user: false }); await eventSource.emit(ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, 0); await settle();
    assert.deepEqual(deleted, []); assert.match(toasts.at(-1)[1], /채팅에 그대로/);
    keepMod.watchReply({ ctx, keep: { keep: async () => { throw new Error('x'); } }, toast: globalThis.toastr });
    ctx.chat.push({ mes: '답2', is_user: false }); await eventSource.emit(ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, 1); await settle();
    assert.deepEqual(deleted, []);
    const kept = [];
    keepMod.watchReply({ ctx, keep: { keep: async e => { kept.push(e); return true; } } });
    await eventSource.emit(ctx.eventTypes.CHAT_CHANGED);
    ctx.chat.push({ mes: '다른 채팅 답', is_user: false }); await eventSource.emit(ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, 2); await settle();
    assert.equal(kept.length, 0);
    keepMod.watchReply({ ctx, keep: { keep: async e => { kept.push(e); return true; } } });
    await settle(keepMod.WAIT_MS + 10);
    assert.equal(eventSource.count(), before);
});

// 실리태번 Popup 흉내: TEXT 는 complete 까지 · CONFIRM(ask)은 askAnswer 로 바로
let askAnswer = true; const asked = [];
class FakePopup {
    constructor(content, type, value, options = {}) { this.content = content; this.type = type; this.options = options; this.dlg = document.createElement('dialog'); this.dlg.className = 'popup'; }
    show() {
        if (this.type === ctx.POPUP_TYPE.CONFIRM) { asked.push(this.content.textContent); return Promise.resolve(askAnswer ? ctx.POPUP_RESULT.AFFIRMATIVE : ctx.POPUP_RESULT.NEGATIVE); }
        this.dlg.append(this.content); document.body.append(this.dlg); this.options.onOpen?.(this);
        return new Promise(r => { this._r = r; });
    }
    complete(v) { this.dlg.remove(); this._r?.(v); }
}
ctx.Popup = FakePopup; ctx.POPUP_RESULT.CANCELLED = null;
ctx.onlineStatus = 'gpt-test'; ctx.mainApi = 'textgenerationwebui';
globalThis.quickReplyApi = { settings: makeSettings() };
const shelf = await import(url('src/qr-shelf.js'));
const sent = [];
shelf._forTest.send.raw = async (messages, n) => { sent.push({ messages, n }); return JSON.stringify({ items: messages[1].content.split('\n').filter(l => /^\d+ \|/.test(l)).map(l => ({ i: Number(l.split(' |')[0]), name: `이름${l.split(' |')[0]}`, desc: '설명', cat: '일상' })) }); };
const R = () => shelf._forTest.root;
const click = el => { assert.ok(el, '누를 것이 없음'); el.dispatchEvent(new Event('click', { bubbles: true })); };
const rowOf = label => [...R().querySelectorAll('.bl-qrs-row')].find(r => r.querySelector('.bl-qrs-run b')?.textContent === label);
const tabOf = id => R().querySelector(`[data-tab="${id}"]`);
let opening = shelf.openQrShelf(); await settle();

await test('창 열기: CSS 는 열 때 받음 · 칸 줄 · 전체 칸에 QR 다섯 · 보관함 창구가 없으면 그 칸이 없음', () => {
    assert.ok(document.getElementById('bl-qr-shelf-style'));
    assert.ok(R().closest('dialog')?.classList.contains('bl-qrs-dialog'));
    assert.deepEqual([...R().querySelectorAll('.bl-qrs-tabs [data-tab]')].map(b => b.dataset.tab), ['fav', 'recent', 'bot', 'none', 'all']);
    assert.equal(tabOf('all').getAttribute('aria-selected'), 'true');
    assert.equal(R().querySelectorAll('.bl-qrs-row').length, 5);
    click(rowOf('인사').querySelector('[data-act="edit"]'));
    assert.ok(R().querySelector('.bl-qrs-editing [name="n"]'));
    assert.equal(R().querySelector('.bl-qrs-editing [name="k"]'), null, '창구 없음 → 보관함 칸 없음');
    click(R().querySelector('[data-act="cancel"]'));
});
await test('즐겨찾기 · 고치기: 테마 설정에만 적고 QR 원본은 그대로 · 카테고리를 주면 그 칸이 생김 · 숨기면 목록에서 빠짐', () => {
    click(rowOf('지도').querySelector('[data-act="fav"]'));
    assert.equal(settings.qrShelf.items[K('세계 설정', 1)].f, true);
    click(rowOf('지도').querySelector('[data-act="edit"]'));
    const ed = R().querySelector('.bl-qrs-editing');
    ed.querySelector('[name="n"]').value = '대륙 지도'; ed.querySelector('[name="d"]').value = '대륙을 한눈에'; ed.querySelector('[name="c"]').value = '세계관';
    click(ed.querySelector('[data-act="save"]'));
    assert.deepEqual(settings.qrShelf.items[K('세계 설정', 1)], { n: '대륙 지도', d: '대륙을 한눈에', c: '세계관', f: true });
    assert.equal(globalThis.quickReplyApi.settings.config.setList[1].set.qrList[0].label, '지도', '원본 이름표 그대로');
    assert.ok(tabOf('world'));
    click(tabOf('world')); assert.deepEqual([...R().querySelectorAll('.bl-qrs-run b')].map(b => b.textContent), ['대륙 지도']);
    click(tabOf('all'));
    click(rowOf('상태').querySelector('[data-act="edit"]'));
    const ed2 = R().querySelector('.bl-qrs-editing'); ed2.querySelector('[name="h"]').checked = true;
    click(ed2.querySelector('[data-act="save"]'));
    assert.equal(rowOf('상태'), undefined);
    const hid = R().querySelector('[data-act="hidden"]'); assert.equal(hid.hidden, false); click(hid);
    assert.ok(rowOf('상태')?.classList.contains('bl-qrs-hidden'));
    click(hid);
});
await test('찾기: 칸과 상관없이 · 내용으로도', () => {
    const input = R().querySelector('.bl-qrs-search');
    input.value = '연표'; input.dispatchEvent(new Event('input', { bubbles: true }));
    assert.deepEqual([...R().querySelectorAll('.bl-qrs-run b')].map(b => b.textContent), ['연표']);
    assert.equal(R().querySelector('.bl-qrs-tabs [aria-selected="true"]'), null, '찾는 동안은 고른 칸 없음');
    input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true }));
});
await test('AI 정리: 묻고(개수 · 토큰 · 모델) 취소하면 안 보냄 · 확인하면 한 번 보내고 미리 보기 · 고치고 체크를 풀고 채우기 · 원래 적힌 칸은 그대로', async () => {
    askAnswer = false;
    click(R().querySelector('[data-act="ai"]')); await settle();
    assert.equal(sent.length, 0); assert.match(asked.at(-1), /빈 QR 3개를 지금 연결\(gpt-test\)에 한 번 보내요/); assert.match(asked.at(-1), /토큰/);
    askAnswer = true;
    click(R().querySelector('[data-act="ai"]')); await settle();
    assert.equal(sent.length, 1, '한 번만'); assert.equal(sent[0].n, core.aiResponseTokens(3));
    const prev = [...R().querySelectorAll('.bl-qrs-prev')];
    assert.equal(prev.length, 3);
    const first = prev[0].querySelector('[data-ai="n"]'); first.value = '반가운 인사'; first.dispatchEvent(new Event('input', { bubbles: true }));
    const off = prev[1].querySelector('[data-ai-use]'); off.checked = false; off.dispatchEvent(new Event('change', { bubbles: true }));
    click(R().querySelector('[data-act="ai-apply"]'));
    assert.deepEqual(settings.qrShelf.items[K('일상', 1)], { n: '반가운 인사', d: '설명', c: '일상' });
    assert.equal(settings.qrShelf.items[K('일상', 2)], undefined, '체크를 푼 줄은 안 채움');
    assert.equal(settings.qrShelf.items[K('세계 설정', 1)].n, '대륙 지도', '이미 다 적힌 QR 은 보내지도 않음');
    assert.ok(!sent[0].messages[1].content.includes('대륙을 한눈에'));
    assert.ok(!sent[0].messages[1].content.includes('지금 상태창'), '숨긴 QR 은 안 보냄');
    assert.ok(tabOf('cat:일상'));
});
await test('누르기: 창을 닫은 뒤 그 QR 의 execute() · 최근 칸 맨 앞', async () => {
    click(rowOf('이름3').querySelector('[data-act="run"]'));   // 연표 — AI 가 붙인 이름
    await opening; await settle();
    assert.equal(R(), null, '창 닫힘');
    assert.deepEqual(runs, ['연표']);
    assert.equal(settings.qrShelf.recent[0], K('세계 설정', 2));
    assert.equal(document.querySelector('.bl-qrs'), null);
});
await test('1.1.3 AI 정리 답을 기다리는 중 창을 닫았다 다시 열어도 두 번 보내지 않고, 옛 답이 새 창을 덮지 않아요(감사 G4)', async () => {
    const keep = shelf._forTest.send.raw, before = sent.length, rejected = [];
    const onReject = e => rejected.push(e);
    process.on('unhandledRejection', onReject);
    let release;
    shelf._forTest.send.raw = async (messages, n) => { sent.push({ messages, n }); await new Promise(r => { release = r; }); return JSON.stringify({ items: [{ i: 1, name: '옛 답', desc: '옛', cat: '옛' }] }); };
    try {
        opening = shelf.openQrShelf(); await settle();
        click(R().querySelector('[data-act="ai"]')); await settle();
        assert.equal(sent.length, before + 1);
        shelf.openQrShelf(); await opening; await settle();       // 닫기
        assert.equal(R(), null);
        opening = shelf.openQrShelf(); await settle();            // 다시 열고 또 누름
        click(R().querySelector('[data-act="ai"]')); await settle();
        assert.equal(sent.length, before + 1, '두 번째 유료 요청이 나가지 않아요');   // 고치기 전: 한 번 더
        assert.match(toasts.at(-1)[1], /아직 기다리는 중/);
        release(); await settle();
        assert.equal(shelf._forTest.state.ai, null, '옛 답이 새 창을 덮지 않아요');
        assert.equal(shelf._forTest.state.busy, false);
        assert.deepEqual(rejected, [], '잡히지 않은 거부 없음');
        shelf.openQrShelf(); await opening; await settle();
    } finally { shelf._forTest.send.raw = keep; process.off('unhandledRejection', onReject); }
});
await test('보관함 창구가 열려 있으면: 고치기에 「답을 ○○으로」 · 표시한 QR 을 누르면 답 하나를 넘기고 채팅에서 뺌', async () => {
    const kept = [];
    globalThis[keepMod.KEEPER] = { label: '시험 상자', keep: async e => { kept.push(e.text); return { id: 'r1' }; } };
    opening = shelf.openQrShelf(); await settle();
    click(rowOf('반가운 인사').querySelector('[data-act="edit"]'));
    const ed = R().querySelector('.bl-qrs-editing');
    assert.match(ed.textContent, /답을 시험 상자로/);
    ed.querySelector('[name="k"]').checked = true; click(ed.querySelector('[data-act="save"]'));
    assert.equal(settings.qrShelf.items[K('일상', 1)].k, true);
    ctx.chat = []; const deleted = []; ctx.deleteMessage = async id => { deleted.push(id); };
    click(rowOf('반가운 인사').querySelector('[data-act="run"]'));
    await opening; await settle();
    assert.deepEqual(runs, ['연표', '인사']);
    ctx.chat.push({ mes: '안녕하세요!', is_user: false }); await eventSource.emit(ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, 0); await settle();
    assert.deepEqual(kept, ['안녕하세요!']); assert.deepEqual(deleted, [0]);
    delete globalThis[keepMod.KEEPER];
    assert.equal(dom.errors.length, 0, dom.errors.map(String).join('\n'));
});

// ───────── 켜고 끄기 · 시작 비용 ─────────
await test('기본 끔 · 켜기만으로는 받지 않음: 시작 그래프 밖 · features.js 에 없음 · 책 단추를 누를 때만 동적 import · 제로 · 같은 확장이 켜져 있으면 쉼', () => {
    assert.match(read('src/settings.js'), /qrShelf: \{ on: false, items: \{\}, recent: \[\] \}/);
    assert.doesNotMatch(read('src/features.js'), /qr-shelf/);
    const layout = read('src/layout.js');
    assert.match(layout, /import\('\.\/qr-shelf\.js'\)\.then\(m => m\.openQrShelf\(\)\)/);
    assert.doesNotMatch(layout, /^import .*qr-shelf/m);
    for (const f of ['index.js', 'src/apply.js', 'src/layout.js', 'src/settings.js', 'src/panel.js']) assert.doesNotMatch(read(f), /from '\.\/(src\/)?qr-shelf/, f);
    assert.match(layout, /classList\.contains\('salty-qr-shelf'\)/);
    assert.match(read('src/apply.js'), /s\.qrShelf\?\.on === true && s\.usageMode !== 'extensions' && !restingFor\('qrShelf'\)\) want\.add\('salty-qr-shelf'\)/);
    assert.match(read('src/usage-mode.js'), /qrShelf: off\(s\.qrShelf\)/);
    assert.match(read('src/ext-presence.js'), /qrShelf: \['qrshelf'\]/);
});
await test('CSS: 책 단추 모양 · 접어도 남음 · 창 모양은 따로 받는 파일 · 폰 누름 칸 44 · 팔레트 변수만', () => {
    const qrbar = read('css/35-qr-bar.css');
    assert.match(qrbar, /#qr--bar > :not\(#bl-qr-fold, #bl-qr-shelf\) \{ display: none !important; \}/);
    assert.match(qrbar, /#bl-qr-shelf \{ position: relative;/);
    assert.match(read('style.css'), /#bl-qr-shelf/, 'build-css 로 다시 만들어야 함');
    const css = read('src/qr-shelf.css').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(read('style.css'), /\.bl-qrs-row/, '창 모양은 시작 CSS 에 없음');
    assert.match(css, /@media \(pointer: coarse\)[\s\S]*width: max\(100%, 44px\); height: max\(100%, 44px\)/);
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, '임의 색 없음');
});
await test('설정 줄 · 찾기 · 되돌리기 이름 · 길게 누르기 설명 · CI 목록', () => {
    assert.match(read('src/panel.js'), /row\('QR 책장', toggle\('qrShelf\.on', s\.qrShelf\?\.on === true\)/);
    assert.match(read('src/settings-search.js'), /\['chat','screen','QR 책장',[^\n]*'qrShelf\.on'\]/);
    assert.match(read('src/settings-labels.js'), /'qrShelf\.on':'QR 책장'/);
    const help = read('src/longpress-help-data.js');
    for (const k of ['"bl-qr-shelf"', '"bl-qrs-ai"', '"bl-qrs-fav"', '"bl-qrs-edit-btn"']) assert.ok(help.includes(k), k);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/qr-shelf\.mjs \./);
    assert.match(read('CHANGELOG.md'), /QR 책장이 생겼어요\(기본 꺼짐\)/);
});

console.log(`qr-shelf: ${passed}개 통과`);
process.exit(0);
