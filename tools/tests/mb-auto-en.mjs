// 1.6.6 미트볼 「한국어로 저장된 칸을 영어 저장으로 바꾸기」 를 묻지 않고 바로(src/mb-auto-en.js)
//   ① 그 창(제목 · 첫 문장 · /ss-undo)만 알아봐요 — 다른 창 · 다른 제목 · 비슷한 글은 그대로 물어요
//   ② 표식이 on 이면 창을 안 띄우고 「네」(AFFIRMATIVE) + 알림 한 줄(칸 수 · 번역 모델 횟수) ③ off 면 원래 창 그대로(끄면 다시 물어요 · 누를 때마다 봐요)
//   ④ 공용 Popup · Popup.show 는 그대로(문맥 객체만 얹은 것) · 만들기(new) · 다른 static · 다른 창 종류는 원래 것
//   ⑤ 감싸개는 한 번만 · 이름은 안쪽 함수 것 ⑥ 미트볼 2.8.0 의 실제 글 꼴(번역 모델 / 실리 기본 번역 (토큰 0))
//   node tools/tests/mb-auto-en.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const M = await import(pathToFileURL(path.join(root, 'src/mb-auto-en.js')).href);
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };

// 미트볼 2.8.0 src/translate.js convertToEnglish 의 글 꼴(esc 한 who 를 괄호 안에)
const ask = (count, who) => `한국어로 저장된 ${count}칸을 영어 저장으로 바꿔요 (${who}).<br><br>• 지금 보이는 한국어는 <b>화면 번역으로 그대로 남아요</b> — 화면은 거의 그대로고, AI에게만 영어로 가요.<br>• 칸마다 「되돌리기」(<code>/ss-undo</code>)로 되돌릴 수 있어요. 걱정되면 먼저 관리 탭 › 세이브나 전체 백업을 해 두세요.<br>• 다시 누르면 멈춰요.`;

function makeHost() {
    const asked = [];
    class Popup { constructor(content) { this.content = content; } static util = { popups: [] }; }
    Popup.show = {
        confirm: async (header, text) => { asked.push(['confirm', header, text]); return 0; },
        input: async (header) => { asked.push(['input', header]); return 'x'; },
    };
    const shared = Popup.show;
    function getContext() { return { Popup, POPUP_RESULT: { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null }, n: Math.random() }; }
    return { host: { getContext }, asked, Popup, shared, getContext };
}
const makeDoc = (value = 'on') => { const doc = { body: { attrs: { 'data-bl-mb-auto-en': value }, getAttribute(k) { return this.attrs[k] ?? null; } } }; return doc; };

await ok('그 창만 알아봐요(제목 · 첫 문장 · /ss-undo)', () => {
    assert.deepEqual(M.matchAsk('미트볼 상태창', ask(2, '번역 모델 2회')), { count: 2, who: '번역 모델 2회' });
    assert.deepEqual(M.matchAsk('미트볼 상태창', ask(3, '실리 기본 번역 (토큰 0)')), { count: 3, who: '실리 기본 번역 (토큰 0)' });
    assert.equal(M.matchAsk('다른 제목', ask(2, '번역 모델 2회')), null);
    assert.equal(M.matchAsk('미트볼 상태창', '이 채팅의 상태창을 지울까요?'), null);
    assert.equal(M.matchAsk('미트볼 상태창', '한국어로 저장된 2칸을 영어 저장으로 바꿔요'), null, '/ss-undo 안내가 없으면 그 창이 아니에요');
    assert.equal(M.matchAsk('미트볼 상태창', `앞말 ${ask(2, '번역 모델 2회')}`), null, '첫 문장이 아니면 아니에요');
    assert.equal(M.matchAsk('미트볼 상태창', null), null);
    assert.match(M.noticeText({ count: 2, who: '번역 모델 2회' }), /^한국어로 저장된 2칸을 영어 저장으로 바꾸는 중이에요 \(번역 모델 2회\)\./);
});

await ok('켬: 창 없이 「네」 + 알림 한 줄 · 공용 Popup 은 그대로', async () => {
    const h = makeHost(); const doc = makeDoc('on'); const notes = [];
    const inner = h.host.getContext;
    assert.equal(M.startMbAutoEn({ host: () => h.host, doc, notify: hit => notes.push(hit), force: true }), true);
    assert.equal(h.host.getContext.name, inner.name, '이름은 안쪽 함수 것');
    const c = h.host.getContext();
    assert.equal(await c.Popup.show.confirm('미트볼 상태창', ask(2, '번역 모델 2회')), 1);
    assert.deepEqual(notes, [{ count: 2, who: '번역 모델 2회' }]);
    assert.equal(h.asked.length, 0, '원래 창이 안 떴어요');
    // 다른 창은 그대로 물어요
    assert.equal(await c.Popup.show.confirm('미트볼 상태창', '이 채팅의 상태창을 지울까요?'), 0);
    assert.equal(await c.Popup.show.input('미트볼 상태창'), 'x');
    assert.equal(h.asked.length, 2);
    // 공용 객체는 그대로 · 만들기 · static 은 원래 것
    assert.equal(h.Popup.show, h.shared); assert.equal(typeof h.Popup.show.confirm, 'function');
    assert.equal(await h.Popup.show.confirm('미트볼 상태창', ask(1, 'x')), 0, '공용 Popup 으로 부르면 그대로 물어요');
    const made = new c.Popup('글'); assert.ok(made instanceof h.Popup); assert.equal(made.content, '글');
    assert.equal(c.Popup.util, h.Popup.util);
    assert.equal(h.getContext().Popup, h.Popup, '공용 getContext 결과(감싸기 전 함수)는 그대로');
});

await ok('끔: 예전처럼 물어요 · 다시 켜면 바로(누를 때마다 표식을 봐요)', async () => {
    const h = makeHost(); const doc = makeDoc('off'); const notes = [];
    M.startMbAutoEn({ host: () => h.host, doc, notify: hit => notes.push(hit), force: true });
    const c = h.host.getContext();
    assert.equal(c.Popup, h.Popup, '끈 동안에는 문맥 객체도 받은 그대로');
    assert.equal(await c.Popup.show.confirm('미트볼 상태창', ask(2, '번역 모델 2회')), 0);
    assert.equal(h.asked.length, 1); assert.equal(notes.length, 0);
    doc.body.attrs['data-bl-mb-auto-en'] = 'on';
    const c2 = h.host.getContext();
    assert.equal(await c2.Popup.show.confirm('미트볼 상태창', ask(2, '번역 모델 2회')), 1);
    assert.equal(h.asked.length, 1); assert.equal(notes.length, 1);
    // 창을 받은 뒤 끄면(같은 문맥 객체라도) 다시 물어요
    doc.body.attrs['data-bl-mb-auto-en'] = 'off';
    assert.equal(await c2.Popup.show.confirm('미트볼 상태창', ask(2, '번역 모델 2회')), 0);
    assert.equal(h.asked.length, 2);
});

await ok('감싸개는 한 번만 · 표식 없는 문서(테마 꺼짐)는 받은 그대로', async () => {
    const h = makeHost();
    assert.equal(M.startMbAutoEn({ host: () => h.host, doc: makeDoc('on'), notify: () => {}, force: true }), true);
    const once = h.host.getContext;
    assert.equal(M.startMbAutoEn({ host: () => h.host, doc: makeDoc('on'), notify: () => {}, force: true }), false, '이미 감싼 함수는 또 감싸지 않아요');
    assert.equal(h.host.getContext, once);
    assert.equal(M.startMbAutoEn({ host: () => h.host, doc: makeDoc('on'), notify: () => {} }), false, '처음 건 뒤에는 다시 안 걸어요');
    const h2 = makeHost();
    M.startMbAutoEn({ host: () => h2.host, doc: { body: { getAttribute: () => null } }, notify: () => {}, force: true });
    assert.equal(h2.host.getContext().Popup, h2.Popup);
});

await ok('미트볼 2.8.0 원작의 창 글과 같은 꼴(사본이 있으면 대조)', () => {
    const file = [process.env.MB_SRC].filter(Boolean).find(f => { try { return fs.statSync(f).isFile(); } catch { return false; } });   // MB_SRC = 그 확장의 src/translate.js(읽기만)
    if (!file) { console.log('   (원작 사본 없음 — 글 꼴만 시험)'); return; }
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(src.includes('Popup.show.confirm(TITLE, `한국어로 저장된 ${ids.length}칸을 영어 저장으로 바꿔요 (${esc(who)}).<br>'), '원작의 창 글 앞머리가 바뀌었어요 — matchAsk 를 다시 맞춰요');
    assert.ok(src.includes('<code>/ss-undo</code>'));
});

// 1.7.4 관계 칸의 한국어가 원작 날짜 꼴(「101년 April 4일」 — 영어 저장에서도 dateStr 이 「년 · 월 · 일」 로 찍어요)뿐이면 자동으로 「네」 하지 않아요.
//   바꾸면 관계 칸이 통째로 저장돼 그 뒤 감긴 답 · 지운 답이 숫자에서 안 빠져요 — 그리고 다음 생활 기록이 또 날짜를 찍어 고리가 돼요.
await ok('날짜 꼴 알아보기: 「년 · 월 · 일」 · 한 글자 요일만 섞인 글', () => {
    assert.equal(M.dateOnly('Kingdom Year 12년 March 3일 (Tue)'), true);
    assert.equal(M.dateOnly('12년 3월 3일 (화)'), true);
    assert.equal(M.dateOnly('Year 5년 Frostmonth(2월) 9일 (Mon)'), true);
    assert.equal(M.dateOnly('노엘과 저녁을 먹었다'), false);
    assert.equal(M.dateOnly('12년 3월 3일 시장에서'), false, '날짜 말고 다른 한국어가 있으면 진짜 한국어');
});
const P = (id, texts) => ({ id, texts });
await ok('정하기: 관계 칸 날짜뿐이면 건너뛰기 · 진짜 한국어는 「네」 · 같은 채팅 같은 내용은 한 번만 · 모르면 예전처럼 「네」', () => {
    const seen = new Set();
    assert.equal(M.decide([P('rel', ['Year 3년 May 1일 (Fri)'])], seen, 'chat-a').act, 'skip');
    assert.equal(M.decide([P('rel', ['Year 3년 May 1일 (Fri)', '드레스를 골랐다'])], seen, 'chat-a').act, 'yes', '관계 칸에 진짜 한국어');
    assert.equal(M.decide([P('rel', ['Year 3년 May 1일 (Fri)', '드레스를 골랐다'])], seen, 'chat-a').act, 'ask', '같은 내용은 두 번째부터 원작 창');
    assert.equal(M.decide([P('rel', ['Year 3년 May 1일 (Fri)', '드레스를 골랐다'])], seen, 'chat-b').act, 'yes', '다른 채팅은 따로');
    assert.equal(M.decide([P('calendar', ['봄 축제'])], seen, 'chat-a').act, 'yes', '다른 칸 · 새 내용');
    assert.equal(M.decide([P('rel', ['Year 3년 May 2일 (Sat)']), P('memo', ['열쇠는 서랍에'])], seen, 'chat-a').act, 'yes', '진짜 한국어 칸이 있으면 「네」');
    assert.equal(M.decide(null, seen, 'chat-a').act, 'yes', '칸을 못 읽으면 예전처럼');
    assert.equal(M.decide([], seen, 'chat-a').act, 'yes');
});
await ok('켬 + 관계 칸 날짜뿐: 창 없이 「아니오」 + 건너뛴 알림 · 두 번째 같은 진짜 한국어는 원작 창', async () => {
    const h = makeHost(); const doc = makeDoc('on'); const notes = [], skips = [];
    let now = [P('rel', ['Year 3년 May 1일 (Fri)'])];
    M.startMbAutoEn({ host: () => h.host, doc, notify: hit => notes.push(hit), skipNote: s => skips.push(s), panels: async () => now, chatKey: () => 'chat-z', force: true });
    const c = h.host.getContext();
    assert.equal(await c.Popup.show.confirm('미트볼 상태창', ask(1, '번역 모델 1회')), 0, '아니오(원작이 그만둬요)');
    assert.equal(h.asked.length, 0); assert.equal(notes.length, 0); assert.equal(skips.length, 1);
    now = [P('profile', ['머리끈'])];
    assert.equal(await c.Popup.show.confirm('미트볼 상태창', ask(1, '번역 모델 1회')), 1); assert.equal(notes.length, 1);
    assert.equal(await c.Popup.show.confirm('미트볼 상태창', ask(1, '번역 모델 1회')), 0, '같은 채팅 같은 내용이면 원작 창(여기선 가짜가 0)');
    assert.equal(h.asked.length, 1); assert.equal(notes.length, 1);
});

// 1.8.6 흰 깜빡임 · 렉: 감싸개가 SillyTavern 전역 getContext 자리에 걸리면, 감싸개 안의 on() → upHas('autoen') 의 기본 문맥(ctx())이
//   다시 감싸개를 불러 스택이 넘칠 때까지 되풀이했어요(층마다 실리 getContext 를 진짜로 한 번씩 · 1.8.1 ~ 1.8.5 채팅 열기 수십 초).
await ok('1.8.6 전역 자리에 걸어도 getContext 한 번 = 안쪽 한 번(되돌아 들어오지 않아요)', async () => {
    const was = globalThis.SillyTavern;
    try {
        for (const withKey of [false, true]) {
            const h = makeHost(); let calls = 0; const settings = withKey ? { statussim: { enabled: true, trConvertAsk: true } } : { statussim: { enabled: true } };
            const st = { getContext() { calls++; return { ...h.getContext(), extensionSettings: settings }; } };
            globalThis.SillyTavern = st;
            assert.equal(M.startMbAutoEn({ host: () => globalThis.SillyTavern, doc: makeDoc('on'), notify: () => {}, force: true }), true);
            const c = st.getContext();
            assert.equal(calls, 1, `안쪽 getContext 를 ${calls}번 불렀어요`);
            // 원작 2.9.1+ 가 「바꾸기 전에 묻기」(trConvertAsk)를 가진 판이면 원작에 맡겨 창을 안 가로채요 · 없으면 예전처럼 얹어요
            if (withKey) assert.equal(c.Popup, h.Popup, '원작에 맡겼으면 Popup 그대로');
            else assert.notEqual(c.Popup, h.Popup, '원작 설정이 없으면 얹어요');
            for (let i = 0; i < 50; i++) st.getContext();
            assert.equal(calls, 51);
        }
    } finally { globalThis.SillyTavern = was; }
});

const src = fs.readFileSync(path.join(root, 'src/mb-auto-en.js'), 'utf8');
await ok('그 확장 파일 · 공용 객체에 쓰지 않아요(정적)', () => {
    assert.doesNotMatch(src, /Popup\.show\s*=|\.show\.confirm\s*=/);
    assert.doesNotMatch(src, /setInterval|MutationObserver/);
});
console.log(`mb-auto-en: ${n} ok`);
