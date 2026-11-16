// 1.6.1 미트볼 「상태창 만들기」 화면의 「채팅 읽기」 고르기(src/mb-read.js · 한 번만 적용은 src/mb-prompt.js armOnce)
//   ① 고르기 값 ↔ 단계 · 「AI k회」 읽기 · 어림 한 줄(상한에 걸리면 줄임 안내) ② 만들기 창의 추가 지시 칸이 그려지면 머리줄 안에 고르기 하나(평소 단계가 골라져 있음 · 두 번 안 놓음 · 1.6.2 화면 높이 그대로)
//   ③ 다른 것을 고르면 이번 한 번만 적용 → 요청이 보이면 끝을 미루고 → 조용해지면 평소 단계로 ④ 평소 값으로 다시 고르면 거둠 · 창을 닫으면 거둠
//   ⑤ 「원작 그대로 보기」 · 테마 꺼짐이면 안 보임(시트 · hidden) · 연결
//   node tools/tests/mb-read.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const P = await import(pathToFileURL(path.join(root, 'src/mb-prompt.js')).href);
const fresh = () => import(pathToFileURL(path.join(root, 'src/mb-read.js')).href + `?t=${Math.random()}`);
const tick = async (k = 6) => { for (let i = 0; i < k; i++) await new Promise(r => setTimeout(r, 0)); };

// ── 작은 가짜 문서 ─────────────────────────────
class El {
    constructor(doc, tag) { this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.nodeType = 1; this.kids = []; this.parent = null; this.cls = []; this.attrs = {}; this.textContent = ''; this.hidden = false; this.value = ''; }
    set className(v) { this.cls = String(v).split(/\s+/).filter(Boolean); } get className() { return this.cls.join(' '); }
    get classList() { return { contains: c => this.cls.includes(c), add: c => { if (!this.cls.includes(c)) this.cls.push(c); } }; }
    get children() { return this.kids; }
    after(k) { k.parent = this.parent; this.parent.kids.splice(this.parent.kids.indexOf(this) + 1, 0, k); }
    setAttribute(k, v) { this.attrs[k] = v; }
    append(...kids) { for (const k of kids) { k.parent = this; this.kids.push(k); } }
    insertBefore(k, ref) { k.parent = this; this.kids.splice(this.kids.indexOf(ref), 0, k); }
    matches(sel) { return sel.split(',').map(s => s.trim()).some(s => (s.startsWith('.') ? this.cls.includes(s.slice(1)) : this.tagName === s.toUpperCase())); }
    closest(sel) { for (let at = this; at; at = at.parent) if (at.matches(sel)) return at; return null; }
    querySelector(sel) { for (const k of this.kids) { if (k.matches(sel)) return k; const r = k.querySelector(sel); if (r) return r; } return null; }
    contains(x) { for (let at = x; at; at = at.parent) if (at === this) return true; return false; }
}
const makeDoc = () => {
    const doc = { on: {}, watchers: [] };
    doc.createElement = tag => new El(doc, tag);
    doc.body = new El(doc, 'body');
    doc.addEventListener = (type, fn) => { (doc.on[type] ||= []).push(fn); };
    doc.fire = (type, ev) => { for (const fn of doc.on[type] || []) fn(ev); };
    doc.watch = (el, spec, fn) => { doc.watchers.push(fn); };
    return doc;
};
/** 만들기 창(2.8.0 꼴): dialog > .ss-wizard > .ss-card.ss-found(캐릭터 · 유저 · 로어북 · 채팅 줄) + section.ss-sec(머리줄 + textarea.ss-w-ins) + .ss-row-btns(.ss-w-cost) · found=false 면 요약 칸 없는 꼴 */
const wizard = (doc, cost = 'AI 3회 (세계 핵심 1 + 묶음 2 · 기능 4개) · 보통 1~2분', found = false) => {
    const dlg = doc.createElement('dialog'), wz = doc.createElement('div'), sec = doc.createElement('section'), head = doc.createElement('div'), ta = doc.createElement('textarea'), btns = doc.createElement('div'), c = doc.createElement('small');
    wz.className = 'ss-wizard'; sec.className = 'ss-sec'; head.className = 'ss-sec-h'; ta.className = 'ss-in ss-w-ins'; btns.className = 'ss-row-btns'; c.className = 'ss-hint ss-w-cost'; c.textContent = cost;
    let card = null, chatRow = null;
    if (found) {
        card = doc.createElement('div'); card.className = 'ss-card ss-found';
        for (const [k, v] of [['캐릭터', 'A'], ['유저', 'B'], ['로어북', '없음'], ['채팅', '16개']]) { const d = doc.createElement('div'), sp = doc.createElement('span'), b = doc.createElement('b'); sp.textContent = k; b.textContent = v; d.append(sp, b); card.append(d); if (k === '채팅') chatRow = d; }
        wz.append(card);
    }
    sec.append(head, ta); btns.append(c); wz.append(sec, btns); dlg.append(wz); doc.body.append(dlg);
    return { dlg, wz, card, chatRow, sec, head, ta, cost: c };
};
const chatOf = (lens = [900, 1200, 30000]) => ({ chat: lens.map((len, i) => ({ name: 'A', is_user: false, mes: 'x'.repeat(len) + i })) });

await ok('① 고르기 값 ↔ 단계 · 「AI k회」 읽기 · 어림 한 줄', async () => {
    const m = await fresh();
    assert.deepEqual(['off', 'light', 'last', 'recent', 'all', undefined].map(m.pickOf), ['base', 'base', 'last', 'recent', 'all', 'base']);
    assert.deepEqual([m.levelFor('base', 'off'), m.levelFor('base', 'light'), m.levelFor('base', 'all'), m.levelFor('last', 'off'), m.levelFor('all', 'light')], ['off', 'light', 'off', 'last', 'all']);
    assert.deepEqual(m.PICKS.map(p => p[1]), ['기본(앞 700자씩)', '마지막 답 전체', '최근 답 여러 개', '채팅 전체', '기억 요약(매 턴 요약 + 그 뒤 원문)']);
    assert.deepEqual(m.PICKS.map(p => m.SHORT[p[0]]), ['기본', '마지막 답', '최근 답', '채팅 전체', '기억 요약']);
    assert.ok(Math.max(...Object.values(m.SHORT).map(t => t.length)) === '채팅 전체'.length, '고르기 폭이 1.6.2 그대로(가장 긴 짧은 글 길이 같음)'); assert.equal(m.pickOf('memo'), 'memo'); assert.equal(m.levelFor('memo', 'off'), 'memo');                // 머리줄에는 짧은 글(폰 384 에서 남는 폭)
    assert.equal(m.aiCalls('AI 3회 (세계 핵심 1 + 묶음 2 · 기능 4개) · 보통 1~2분'), 3); assert.equal(m.aiCalls('AI 0회 · 토큰 0'), 0); assert.equal(m.aiCalls(''), 0);
    const c = chatOf();
    assert.equal(m.costLine('base', { mbPrompt: 'off' }, c, 'AI 3회', P), '채팅 3개 · 더 드는 토큰 없음');
    const last = m.costLine('last', { mbPrompt: 'off' }, c, 'AI 3회', P);
    const one = P.estimate('last', c);
    assert.match(last, /^채팅 3개 · 요청 1회 약 [\d,.만]+ 토큰 더 · 이번 만들기 약 [\d,.만]+ 토큰 더\(AI 3회\)$/); assert.ok(one > 7000);
    assert.ok(!m.costLine('last', { mbPrompt: 'off' }, c, '', P).includes('이번 만들기'));               // 「AI k회」 를 못 읽으면 요청 1회 값만
    const capped = m.costLine('all', { mbPrompt: 'off', mbPromptCap: 3000 }, chatOf([9000, 9000, 9000]), 'AI 2회', P);
    assert.match(capped, /^메시지 2\/3개 · [\d,.만]+자 · 약 [\d,.만]+ 토큰 · 1개는 앞 1,000자만 · 1개는 뺌 — 상한 3,000에 맞춤 · 요청 1회 약 /);
    assert.match(m.costLine('all', { mbPrompt: 'off' }, c, 'AI 2회', P), /^메시지 3\/3개 · [\d,.만]+자 · 약 [\d,.만]+ 토큰 — 다 실어요 · 요청 1회 약 .+\(AI 2회\)$/);
    assert.equal(m.costLine('memo', { mbPrompt: 'off' }, c, 'AI 2회', P), '이 채팅에 매 턴 기억 요약이 없어요');
    assert.equal(m.costLine('all', {}, c, 'AI 2회', null), '');
});

const mem = new Map(); let clock = 1000000;
const storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: k => { mem.delete(k); } };
const DEF = 'You are a test world builder.\nReturn JSON only.\n';   // 시험용으로 지어낸 기본 문구(원작 글 아님)
const macros = {};   // 문구 모듈은 매크로를 한 번만 등록해요 — 시험 내내 같은 표
const world = usual => {
    const set = {}; const toasts = [];
    const c = { extensionSettings: { statussim: set }, saveSettingsDebounced() { }, registerMacro: (name, fn) => { macros[name] = fn; }, chat: chatOf().chat };
    globalThis.SillyTavern = { getContext: () => c };
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
    globalThis.toastr = { info: t => toasts.push(t), warning: t => toasts.push(t) };
    Date.now = () => clock;
    // 문구 모듈을 감싸 기본 문구를 시험 값으로(그 확장 주소를 읽지 않게)
    const Pw = { ...P, armOnce: o => P.armOnce({ ...o, def: DEF }), endOnce: o => P.endOnce({ ...o, def: DEF }) };
    return { c, set, macros, toasts, Pw, chat: { mbPrompt: usual } };
};

await ok('② 추가 지시 칸이 그려지면 머리줄 안에 고르기 하나 — 평소 단계가 골라져 있고 어림이 적혀요 · 신호가 또 와도 하나 · 다른 칸 · 다른 신호는 무시 · 작가 노트 단추가 먼저면 그 앞', async () => {
    const m = await fresh(); const doc = makeDoc(); const w = world('recent'); await P.syncMbPrompt('recent', 9, 2000, { c: w.c, retry: false }).catch(() => null);
    assert.equal(m.startMbRead(doc, { watch: doc.watch, settings: async () => ({ chat: w.chat }), load: async () => w.Pw }), true); assert.equal(m.startMbRead(doc), false);
    const z = wizard(doc);
    doc.fire('animationstart', { animationName: 'other', target: z.ta }); await tick(); assert.equal(z.sec.querySelector('.bl-mb-read'), null);
    doc.fire('animationstart', { animationName: m.ANIM, target: doc.createElement('div') }); await tick(); assert.equal(z.sec.querySelector('.bl-mb-read'), null);
    doc.fire('animationstart', { animationName: m.ANIM, target: z.ta }); doc.fire('animationstart', { animationName: m.ANIM, target: z.ta }); await tick();
    assert.equal(z.head.kids.filter(k => k.cls.includes('bl-mb-read')).length, 1);
    assert.deepEqual(z.sec.kids.map(k => k.cls[0]), ['ss-sec-h', 'bl-mb-read-cost', 'ss-in']);               // 입력칸 위에는 어림 줄만(비면 높이 0)
    assert.deepEqual(z.head.kids.map(k => k.cls[0]), ['bl-mb-read']);                                       // 고르기는 머리줄 안
    const row = z.sec.querySelector('.bl-mb-read'); const sel = row.querySelector('.bl-mb-read-sel'); const costEl = z.sec.querySelector('.bl-mb-read-cost');
    assert.equal(row.tagName, 'LABEL'); assert.equal(row.kids[0].textContent, '읽기');
    assert.equal(row.hidden, true); assert.equal(costEl.hidden, true); assert.equal(sel.value, 'recent'); assert.equal(sel.kids.length, 5);
    assert.deepEqual(sel.kids.map(o => o.textContent), ['기본', '마지막 답', '최근 답', '채팅 전체', '기억 요약']); assert.equal(sel.kids[0].title, '기본(앞 700자씩)');
    assert.match(costEl.textContent, /^채팅 3개 · 요청 1회 약 .+ · 이번 만들기 약 .+\(AI 3회\)$/);
    z.cost.textContent = 'AI 5회 (세계 핵심 1 + 묶음 4)'; doc.fire('click', { target: z.cost }); await tick();   // 기능을 바꾸면 어림도 다시
    assert.match(costEl.textContent, /\(AI 5회\)$/);
    // 작가 노트 넣기(src/mb-note.js)가 먼저 머리줄 끝에 놓였으면 그 앞에
    const z2 = wizard(doc); const note = doc.createElement('div'); note.className = 'ss-sec-r bl-mb-note-r'; z2.head.append(note);
    doc.fire('animationstart', { animationName: m.ANIM, target: z2.ta }); await tick();
    assert.deepEqual(z2.head.kids.map(k => k.cls[0]), ['bl-mb-read', 'ss-sec-r']);
    // 1.6.2 맨 위 요약 칸이 있으면 「채팅 N개」 줄 오른쪽(줄에 겹쳐 높이 그대로) · 어림 줄은 요약 칸 바로 아래 · 머리줄과 입력칸 위에는 안 놓음
    const z3 = wizard(doc, undefined, true);
    doc.fire('animationstart', { animationName: m.ANIM, target: z3.ta }); await tick();
    const r3 = z3.chatRow.kids.at(-1);
    assert.deepEqual(r3.cls, ['bl-mb-read', 'bl-mb-read-at']); assert.ok(z3.chatRow.cls.includes('bl-mb-read-host'));
    assert.deepEqual(z3.wz.kids.map(k => k.cls.at(-1)), ['ss-found', 'bl-mb-read-cost-top', 'ss-sec', 'ss-row-btns']);
    assert.equal(z3.head.kids.length, 0); assert.deepEqual(z3.sec.kids.map(k => k.cls[0]), ['ss-sec-h', 'ss-in']);
    assert.match(z3.wz.kids[1].textContent, /\(AI 3회\)$/);
    assert.equal(m.ANIM, /export const ANIM = '([^']+)'/.exec(read('src/mb-note.js'))[1]);
});

await ok('③ 다른 것을 고르면 이번 한 번만 — 요청이 보이면 끝을 미루고 · 조용해지면 평소 단계로(알림) · 「마지막 답 전체」 도 요청을 알아채요', async () => {
    mem.clear(); const m = await fresh(); const doc = makeDoc(); const w = world('light');
    await P.syncMbPrompt('light', 9, 2000, { c: w.c, retry: false }).catch(() => null); await P.syncPrompt('light', { c: w.c, def: DEF }); w.toasts.length = 0;   // 평소 단계를 문구 모듈에 알려 둠(그 확장 주소가 없는 시험이라 뜨는 알림은 버려요)
    m.startMbRead(doc, { watch: doc.watch, settings: async () => ({ chat: w.chat }), load: async () => w.Pw });
    const z = wizard(doc); doc.fire('animationstart', { animationName: m.ANIM, target: z.ta }); await tick();
    const sel = z.sec.querySelector('.bl-mb-read-sel'); assert.equal(sel.value, 'base');
    const costEl = z.sec.querySelector('.bl-mb-read-cost'); assert.equal(costEl.textContent, '');            // 「기본」 이면 고르기 한 줄만(어림 줄 없음)
    sel.value = 'last'; doc.fire('change', { target: sel }); await tick();
    assert.ok(costEl.textContent.startsWith('채팅 3개 · 요청 1회 약 ') && costEl.textContent.endsWith('(AI 3회)'));                                // 다른 것을 고르면 어림 줄이 나타나요
    assert.equal(P.onceLevel(), 'last'); assert.equal(mem.get(P.ONCE_LV_KEY), 'last'); assert.equal(Number(mem.get(P.ONCE_KEY)), clock + P.ONCE_WAIT);
    assert.ok(w.set.prompts[P.KEY].includes(`{{${P.MACRO}}}`)); assert.equal(w.toasts.length, 0);            // 조용히 걸려요
    const text = w.macros[P.MACRO](); assert.ok(text.startsWith('A: ') && text.length > 29000 && !text.includes('\n\nA: '), '마지막 답 하나만 · 전체');
    assert.equal(Number(mem.get(P.ONCE_KEY)), clock + P.ONCE_IDLE);                                            // 요청이 보였어요
    clock += P.ONCE_IDLE + 1; assert.equal(P.onceLevel(), '');
    await P.endOnce({ c: w.c, def: DEF });
    assert.equal(P.levelOf(w.set.prompts[P.KEY]), 'light'); assert.equal(mem.has(P.ONCE_KEY), false); assert.equal(mem.has(P.ONCE_LV_KEY), false);
    assert.match(w.toasts.at(-1), /「마지막 답 전체」 로 1번 보냈어요/);
});

await ok('④ 평소 값으로 다시 고르면 바로 거둬요 · 만들기 창을 닫으면 거둬요(기본 쪽은 조용히)', async () => {
    mem.clear(); const m = await fresh(); const doc = makeDoc(); const w = world('recent');
    await P.syncMbPrompt('recent', 9, 2000, { c: w.c, retry: false }).catch(() => null); await P.syncPrompt('recent', { c: w.c, def: DEF }); w.toasts.length = 0;
    m.startMbRead(doc, { watch: doc.watch, settings: async () => ({ chat: w.chat }), load: async () => w.Pw });
    const z = wizard(doc); doc.fire('animationstart', { animationName: m.ANIM, target: z.ta }); await tick();
    const sel = z.sec.querySelector('.bl-mb-read-sel');
    sel.value = 'all'; doc.fire('change', { target: sel }); await tick();
    assert.equal(P.onceLevel(), 'all'); assert.equal(P.levelOf(w.set.prompts[P.KEY]), 'all'); assert.equal(mem.has(P.ONCE_LV_KEY), false);
    sel.value = 'recent'; doc.fire('change', { target: sel }); await tick();
    assert.equal(P.onceLevel(), ''); assert.equal(P.levelOf(w.set.prompts[P.KEY]), 'recent'); assert.equal(w.toasts.length, 0);
    sel.value = 'base'; doc.fire('change', { target: sel }); await tick();                                     // 평소보다 가볍게: 이번만 덧붙임 없이
    assert.equal(z.sec.querySelector('.bl-mb-read-cost').textContent, '');                                     // 「기본」 으로 돌리면 어림 줄이 다시 사라져요
    assert.equal(P.onceLevel(), 'off'); assert.equal(P.levelOf(w.set.prompts?.[P.KEY] ?? DEF), 'off');
    doc.watchers[0]([{ removedNodes: [doc.createElement('div')] }]); await tick(); assert.equal(P.onceLevel(), 'off');   // 다른 것이 빠진 것은 무시
    doc.watchers[0]([{ removedNodes: [z.dlg] }]); await tick();
    assert.equal(P.onceLevel(), ''); assert.equal(P.levelOf(w.set.prompts[P.KEY]), 'recent'); assert.equal(w.toasts.length, 0);
});

await ok('⑤ 「원작 그대로 보기」 · 테마 꺼짐이면 안 보여요 · 연결(미트볼 문 · 문구 모듈은 창이 뜰 때 · 설정 설명 한 줄)', () => {
    const css = read('src/ext-status.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = css.split('\n').filter(l => l.includes('.bl-mb-read'));
    assert.ok(rules.length >= 5); for (const l of rules) assert.ok(l.startsWith('body.salty:not([data-bl-ext-raw]) .ss-scope .bl-mb-read'), l);
    const src = read('src/mb-read.js');
    assert.ok(src.includes('row.hidden = true'));
    assert.ok(css.includes('.bl-mb-read-cost:empty { display: none; }'));
    assert.match(rules.find(l => l.includes('.bl-mb-read.bl-mb-read-at {')), /position: absolute; top: 50%;.*transform: translateY\(-50%\)/);   // 요약 칸 줄에 겹쳐요(줄 높이 그대로)
    const sel = rules.find(l => l.includes('.bl-mb-read-sel {')); assert.match(sel, /height: 30px; min-height: 30px;/);   // 머리줄의 작은 단추(30)보다 높지 않게 — 만들기 화면 높이 그대로
    assert.ok(rules.some(l => l.includes('.bl-mb-read + .bl-mb-note-r { margin-left: 0; }')));                                     // 빈 어림 줄은 자리를 안 차지해요                                                             // 규칙이 안 걸리면 숨은 채
    assert.ok(!/^import .*mb-prompt/m.test(src) && src.includes("import('./mb-prompt.js')"));               // 문구 모듈은 만들기 창이 뜰 때 받아요
    assert.ok(!/new MutationObserver|setInterval|setTimeout|chat_metadata/.test(src));
    const gate = read('index.js').split('\n').find(line => line.includes("import('./src/mb-read.js')"));
    assert.ok(gate && gate.indexOf("getElementById('ss-settings')") < gate.indexOf('mb-read.js'));
    assert.ok(read('src/panel.js').includes('미트볼의 상태창 만들기 화면에서도 고를 수 있어요'));
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/mb-read.mjs .'));
});
await ok('⑥ 1.6.3 기억 요약(없으면 알리고 되돌림) · 채팅 전체가 상한을 넘으면 고르는 순간 미리 알림 · 보내면 어림 줄이 「보냈어요 N번 — 요청마다 …」 · 끝 알림에도 실은 양', async () => {
    mem.clear(); const m = await fresh(); const doc = makeDoc(); const w = world('off');
    await P.syncMbPrompt('off', 9, 2000, { c: w.c, retry: false }).catch(() => null); await P.syncPrompt('off', { c: w.c, def: DEF }); w.toasts.length = 0;
    w.c.chat = chatOf([9000, 9000, 900]).chat;
    m.startMbRead(doc, { watch: doc.watch, settings: async () => ({ chat: { ...w.chat, mbPromptCap: 3000 } }), load: async () => w.Pw });
    const z = wizard(doc, undefined, true); doc.fire('animationstart', { animationName: m.ANIM, target: z.ta }); await tick();
    const sel = z.chatRow.querySelector('.bl-mb-read-sel'), costEl = z.wz.kids[1];
    assert.equal(sel.value, 'base'); assert.equal(costEl.textContent, '');
    sel.value = 'memo'; doc.fire('change', { target: sel }); await tick();                                       // 요약 없는 채팅
    assert.equal(sel.value, 'base'); assert.equal(P.onceLevel(), ''); assert.equal(costEl.textContent, ''); assert.match(w.toasts.at(-1), /매 턴 기억 요약이 없어요.*고르기를 되돌렸어요/);
    w.c.chatMetadata = { memoria: { turns: [{ mesId: 0, summary: 'First turn summary.' }, { mesId: 1, summary: 'Second turn summary.' }] } };   // 시험용으로 지어낸 요약
    sel.value = 'memo'; doc.fire('change', { target: sel }); await tick();
    assert.equal(P.onceLevel(), 'memo'); assert.match(costEl.textContent, /^기억 요약 2개\(메시지 #0~#1\) · 그 뒤 메시지 1개는 원문 · [\d,]+자 · 약 [\d,]+ 토큰 · 요청 1회 약 .+\(AI 3회\)$/);
    assert.equal(w.macros[P.MACRO_MEMO](), `[#0] First turn summary.\n[#1] Second turn summary.\n\n--- AFTER THE LAST SUMMARY (full text) ---\nA: ${'x'.repeat(900)}2`);
    assert.match(costEl.textContent, /^보냈어요 1번 — 요청마다 기억 요약 2개\(메시지 #0~#1\)/);
    const n0 = w.toasts.length; sel.value = 'all'; doc.fire('change', { target: sel }); await tick();
    assert.equal(P.onceLevel(), 'all'); assert.equal(w.toasts.length, n0 + 1);
    assert.match(w.toasts.at(-1), /^미리 알려요: 채팅 전체가 요청 1회 상한\(약 3,000 토큰\)을 넘어요 — 메시지 3\/3개 · .+ · 오래된 1개는 기억 요약으로\. 원문을 다 넣으려면 /);
    assert.match(costEl.textContent, /^메시지 3\/3개 · .+ · 오래된 1개는 기억 요약으로 — 상한 3,000에 맞춤 · 요청 1회 약 /);
    w.macros[P.MACRO_ALL](); assert.match(costEl.textContent, /^보냈어요 1번 — 요청마다 메시지 3\/3개 · /);
    doc.watchers[0]([{ removedNodes: [z.dlg] }]); await tick();
    assert.equal(P.onceLevel(), ''); assert.match(w.toasts.at(-1), /^채팅 전체를 실어 1번 보냈어요 — 요청마다 메시지 3\/3개 · .+\. 미트볼 문구를 원래 단계로 돌려놨어요\.$/);
    delete w.c.chatMetadata;
});
console.log(`mb-read: ${n}개 통과`);
