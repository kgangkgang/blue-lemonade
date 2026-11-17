// 1.6.0 미트볼 문구: 블루레몬 추천(src/mb-prompt.js) — 그 확장의 「생성 시스템 프롬프트」 설정 값 끝에 테마 줄을 덧붙이고, 되돌리면 그 줄만 떼요.
//   적용 · 되돌리기 왕복이 글자 하나 안 틀리게 · 손으로 고친 문구 보존 · 그 확장이 없거나 자리를 못 찾으면 건너뜀 · 테마에 원작 문구를 담지 않음.
//   node tools/tests/mb-prompt.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };
const M = await import(pathToFileURL(path.join(root, 'src/mb-prompt.js')).href);

const DEF = 'You are a test world builder.\nReturn JSON only. {outLang}\n';   // 시험용으로 지어낸 기본 문구(원작 글 아님)
const mk = (prompts) => { let saves = 0; const c = { extensionSettings: { statussim: prompts === undefined ? {} : { prompts } }, saveSettingsDebounced: () => { saves++; } }; return { c, saves: () => saves, set: c.extensionSettings.statussim }; };

await ok('기본 문구 위에: 적용 → 끝에 덧붙음 · 되돌리기 → 고친 문구 칸이 비워짐(기본값 상태)', async () => {
    const { c, set, saves } = mk();
    for (const lv of ['light', 'last', 'recent', 'all']) {
        const r = await M.syncPrompt(lv, { c, def: DEF });
        assert.deepEqual([r.ok, r.changed], [true, true]);
        const text = set.prompts[M.KEY];
        assert.ok(text.startsWith(DEF + '\n\n=== BLUE LEMONADE NOTE ===\n'), lv); assert.equal(M.levelOf(text), lv); assert.equal(M.strip(text), DEF);
        assert.equal(text.includes('{{lastCharMessage}}'), lv === 'last'); assert.equal(text.includes(`{{${M.MACRO}}}`), lv === 'recent'); assert.equal(text.includes(`{{${M.MACRO_ALL}}}`), lv === 'all');
        assert.equal((text.match(/=== BLUE LEMONADE NOTE ===/g) || []).length, 1, '단계를 바꿔도 한 덩어리만');
    }
    assert.equal((await M.syncPrompt('all', { c, def: DEF })).changed, false, '같은 단계를 또 맞추면 그대로');
    const r = await M.syncPrompt('off', { c, def: DEF });
    assert.equal(r.changed, true); assert.equal(M.KEY in set.prompts, false); assert.ok(saves() >= 5);
    assert.equal((await M.syncPrompt('off', { c, def: DEF })).changed, false);
});
await ok('손으로 고친 문구 위에: 왕복하면 글자 하나 안 틀리고 그대로 남아요(끝 빈칸 · 줄바꿈까지)', async () => {
    for (const mine of ['내가 고친 문구예요.\n둘째 줄  \n\n', 'A', DEF + ' ', '끝에 빈 줄\n\n\n']) {
        const { c, set } = mk({ [M.KEY]: mine, 'gen.core': '다른 칸' });
        await M.syncPrompt('last', { c, def: DEF });
        assert.ok(set.prompts[M.KEY].startsWith(mine + '\n\n=== BLUE LEMONADE NOTE ==='));
        assert.ok(!/\[d:/.test(set.prompts[M.KEY]), '손으로 고친 글에는 기본 문구 지문을 안 적어요');
        await M.syncPrompt('light', { c, def: DEF }); await M.syncPrompt('off', { c, def: DEF });
        assert.equal(set.prompts[M.KEY], mine); assert.equal(set.prompts['gen.core'], '다른 칸', '다른 칸은 안 건드려요');
    }
});
await ok('적용한 뒤 사용자가 앞부분을 더 고쳐도 되돌릴 때 그 글이 살아요', async () => {
    const { c, set } = mk();
    await M.syncPrompt('light', { c, def: DEF });
    set.prompts[M.KEY] = 'EXTRA LINE\n' + set.prompts[M.KEY];
    await M.syncPrompt('off', { c, def: DEF });
    assert.equal(set.prompts[M.KEY], 'EXTRA LINE\n' + DEF);
});
await ok('원작이 기본 문구를 바꾸면: 기본 문구 위에 붙여 둔 것은 새 기본 문구로 옮기고, 되돌리면 칸이 비워져요', async () => {
    const { c, set } = mk();
    await M.syncPrompt('light', { c, def: DEF });
    const NEW = DEF + 'One more default line.\n';
    await M.syncPrompt('light', { c, def: NEW });
    assert.ok(set.prompts[M.KEY].startsWith(NEW + '\n\n=== BLUE LEMONADE NOTE ===')); assert.equal(M.strip(set.prompts[M.KEY]), NEW);
    await M.syncPrompt('off', { c, def: NEW }); assert.equal(M.KEY in set.prompts, false);
});
await ok('그 확장이 없거나(설정 없음) · 기본 문구를 못 읽으면(다른 판) 아무것도 안 바꿔요', async () => {
    const none = { extensionSettings: {}, saveSettingsDebounced() { throw new Error('저장하면 안 돼요'); } };
    assert.deepEqual(await M.syncPrompt('last', { c: none, def: DEF }), { ok: false, changed: false, why: 'none', level: 'last' });
    const { c, set, saves } = mk({ [M.KEY]: '고친 글' });
    for (const bad of [null, '', 5]) assert.equal((await M.syncPrompt('last', { c, def: bad })).why, 'shape');
    assert.equal(set.prompts[M.KEY], '고친 글'); assert.equal(saves(), 0);
    const odd = mk(); odd.set.prompts = 'x'; assert.equal((await M.syncPrompt('last', { c: odd.c, def: DEF })).why, 'shape');
    assert.equal((await M.syncPrompt('엉뚱한 값', { c, def: DEF })).level, 'off');
});
await ok('기본 문구 읽기: 그 확장이 띄운 주소 그대로만 · 못 찾으면 null(모듈을 한 벌 더 띄우지 않아요)', async () => {
    const doc = src => ({ querySelectorAll: () => src.map(s => ({ src: s, getAttribute: () => s })) });
    const seen = [];
    const load = async url => { seen.push(url); return { PROMPT_MAP: { [M.KEY]: { text: DEF } } }; };
    assert.equal(await M.readDefault(doc(['http://x/scripts/extensions/third-party/other/index.js', 'http://x/scripts/extensions/third-party/meatballstats/index.js']), load), DEF);
    assert.deepEqual(seen, ['http://x/scripts/extensions/third-party/meatballstats/src/prompts.js']);
    assert.equal(await M.readDefault(doc(['http://x/a/index.js']), load), null);
    assert.equal(await M.readDefault(doc(['http://x/scripts/extensions/third-party/meatballstats/index.js?v=2']), load), null);
    assert.equal(await M.readDefault(doc(['http://x/scripts/extensions/third-party/meatballstats/index.js']), async () => ({ PROMPT_MAP: {} })), null);
    assert.equal(await M.readDefault(doc(['http://x/scripts/extensions/third-party/meatballstats/index.js']), async () => { throw new Error('없음'); }), null);
});
await ok('최근 답 글: 눈 감긴 답 제외 · 꾸밈 태그 · 상태 블록 걷어냄 · 가장 새 답만 전체 · 오래된 것부터', async () => {
    const long = 'L'.repeat(5000);
    const c = { chat: [
        { name: 'A', is_user: false, mes: 'old0' },
        { name: 'U', is_user: true, mes: '<b>hi</b> there' },
        { name: 'A', is_user: false, is_system: true, mes: 'HIDDEN SECRET' },
        { name: 'A', is_user: false, mes: `<span style="color:red">one</span> two\n\n\n\nthree ${long}` },
        { name: 'A', is_user: false, mes: `<span class="x">NEW</span> text ${long}\n<meatball>\naff: X +1\n</meatball><style>.a{}</style>` },
        { name: 'U', is_user: true, mes: 'after the last reply' },
    ] };
    const t = M.recentText(c, 2, 500);
    assert.ok(!t.includes('HIDDEN') && !t.includes('<') && !t.includes('aff: X') && !t.includes('old0') && !t.includes('after the last'));
    assert.ok(t.startsWith('U: hi there\n\nA: one two\n\nthree L'));
    assert.ok(t.includes('A: NEW text ' + long), '가장 새 답은 전체');
    assert.ok(t.indexOf('one two') < t.indexOf('NEW text')); assert.ok(/three L{400,494}…/.test(t), '앞 메시지는 자른 글');
    assert.equal(M.recentText({ chat: [{ is_user: true, mes: 'u' }] }), ''); assert.equal(M.recentText({}), '');
    assert.ok(M.recentText(c, 0, 500).startsWith('A: NEW text'));
});
await ok('토큰 어림: 단계가 올라갈수록 늘고, 적용 안 함은 0', async () => {
    const c = { chat: [{ name: 'A', is_user: false, mes: 'x'.repeat(8000) }, { name: 'A', is_user: false, mes: 'y'.repeat(20000) }] };
    const e = lv => M.estimate(lv, c, 9, 2000);
    assert.equal(e('off'), 0); assert.ok(e('light') > 60 && e('light') < 400); assert.ok(e('last') > e('light') + 4500); assert.ok(e('recent') > e('last'));
    assert.equal(M.tokens('가나다라'), 2); assert.equal(M.tokens('abcdefgh'), 2);
});
await ok('맞추기: 「최근 답 여러 개」 는 매크로를 한 번 등록 · 그 확장이 아직 없으면 조금 뒤 한 번 더', async () => {
    const reg = []; const { c, set } = mk();
    c.registerMacro = (k, fn) => reg.push([k, fn]); c.chat = [{ name: 'A', is_user: false, mes: 'body text' }];
    globalThis.SillyTavern = { getContext: () => c };
    globalThis.__blReg = reg;
    const doc = { querySelectorAll: () => [] };   // 주소를 못 찾음 → shape
    const timers = []; const st = globalThis.setTimeout; globalThis.setTimeout = (fn, ms) => { timers.push(ms); return 1; };
    try {
        const r = await M.syncMbPrompt('recent', 3, 800, { c, doc });
        assert.equal(r.why, 'shape'); assert.deepEqual(timers, [4000]); assert.deepEqual(reg.map(x => x[0]), [M.MACRO, M.MACRO_ALL, M.MACRO_MEMO]); assert.equal(reg[0][1](), 'A: body text'); assert.equal(reg[1][1](), 'A: body text'); assert.equal(reg[2][1](), '', '기억 요약이 없으면 빈 글');
        await M.syncMbPrompt('all', 3, 800, { c, doc }); assert.equal(reg.length, 3, '두 번 등록 안 해요');
    } finally { globalThis.setTimeout = st; }
    assert.equal(set.prompts, undefined);
});
await ok('테마에 원작 문구를 담지 않아요 · 연결 · 기본 적용 안 함', async () => {
    const src = fs.readFileSync(path.join(root, 'src/mb-prompt.js'), 'utf8');
    assert.ok(!/world-builder|PROMPT_DEFS|OUTPUT JSON SHAPE/.test(src)); assert.ok(!/MutationObserver|setInterval|\.emit\(/.test(src));
    const apply = fs.readFileSync(path.join(root, 'src/apply.js'), 'utf8'), set = fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8'), panel = fs.readFileSync(path.join(root, 'src/panel.js'), 'utf8');
    assert.ok(apply.includes("lateSync('mbPrompt', () => import('./mb-prompt.js'), want.has('salty') && (lv !== 'off' || once)"));
    assert.ok(set.includes("s.chat.mbPrompt = 'off'") && set.includes("mbPrompt: 'off', mbPromptCount: 9, mbPromptChars: 2000, mbPromptCap: 0,"));
    assert.ok(panel.includes("seg('chat.mbPrompt', [['off', '적용 안 함'], ['light', '가볍게'], ['last', '마지막 답 전체'], ['recent', '최근 답 여러 개'],"));
    for (const f of ['src/settings-labels.js', 'src/settings-search.js']) assert.ok(fs.readFileSync(path.join(root, f), 'utf8').includes('chat.mbPrompt'), f);
});
await ok('채팅 전체: 보이는 메시지 전부(내 메시지 포함 · 이름 · 차례대로) · 눈 감긴 메시지 · 꾸밈 태그 · 상태 블록 제외', async () => {
    const c = { chat: [
        { name: 'A', is_user: false, mes: 'first <i>reply</i>' },
        { name: 'U', is_user: true, mes: 'my line' },
        { name: 'A', is_user: false, is_system: true, mes: 'HIDDEN SECRET' },
        { name: 'A', is_user: false, mes: '<span style="color:red">second</span> reply\n<meatball>\naff: X +1\n</meatball>', extra: { reasoning: 'THINKING' } },
        { name: 'U', is_user: true, mes: 'last word' },
        { name: 'A', is_user: false, mes: '<style>.x{}</style>' },
    ] };
    const r = M.allText(c, 0);
    assert.equal(r.text, 'A: first reply\n\nU: my line\n\nA: second reply\n\nU: last word');
    assert.deepEqual([r.count, r.total, r.cut, r.dropped], [4, 4, 0, 0]); assert.equal(r.tokens, r.full);
    assert.deepEqual(M.allText({}, 0), { text: '', count: 0, total: 0, summarized: 0, cut: 0, dropped: 0, hidden: 0, hiddenSum: 0, memo: 0, chars: 0, fullChars: 0, tokens: 0, full: 0 });
    assert.deepEqual([r.hidden, r.hiddenSum, r.summarized, r.chars], [1, 0, 0, r.text.length]);
});
await ok('채팅 전체 상한: 넘으면 오래된 메시지부터 앞 1,000자로 · 그래도 넘으면 오래된 것부터 빼고 · 가장 새 메시지는 남겨요', async () => {
    const big = i => ({ name: 'A', is_user: false, mes: String.fromCharCode(97 + i).repeat(7000) });   // 한 개 약 2,000 토큰
    const c = { chat: [big(0), big(1), big(2), big(3)] };
    const free = M.allText(c, 0); assert.ok(free.tokens > 7900 && free.cut === 0);
    const some = M.allText(c, 5000);   // 앞 둘만 줄이면 맞아요
    assert.ok(some.tokens <= 5000); assert.deepEqual([some.count, some.cut, some.dropped], [4, 2, 0]); assert.equal(some.full, free.tokens);
    assert.ok(some.text.startsWith('A: ' + 'a'.repeat(M.HEAD_CHARS) + '…\n\nA: ' + 'b'.repeat(M.HEAD_CHARS) + '…\n\nA: ' + 'c'.repeat(7000)));
    const tight = M.allText(c, 2500);  // 앞 셋을 줄여도 넘어요 → 오래된 것부터 빼요
    assert.ok(tight.tokens <= 2500); assert.ok(tight.dropped >= 1); assert.ok(tight.text.endsWith('d'.repeat(7000)), '가장 새 메시지는 전체');
    const tiny = M.allText(c, 10); assert.equal(tiny.count, 1); assert.ok(tiny.text.endsWith('d'.repeat(7000)));
    assert.equal(M.estimate('all', c, 9, 2000, 5000), M.estimate('light') + some.tokens);
    assert.ok(M.tokensSafe('가나다라') >= 3 && M.tokensSafe('日本語') === 3 && M.tokensSafe('abcdefg') === 2, '넉넉한 어림');
});
await ok('이번 한 번만: 걸면 채팅 전체 줄 · 요청이 보이면 끝을 미루고 · 때가 되면 원래 단계로 돌려놓고 알려요 · 거두기', async () => {
    const reg = []; const { c, set } = mk();
    c.registerMacro = (k, fn) => reg.push([k, fn]); c.chat = [{ name: 'A', is_user: false, mes: 'body text' }];
    globalThis.SillyTavern = { getContext: () => c };
    const mem = new Map(); globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
    const toasts = []; const toast = { info: m => toasts.push(m), warning: m => toasts.push('!' + m) };
    const st = globalThis.setTimeout, ct = globalThis.clearTimeout, real = Date.now; let clock = 1000000; const timers = [];
    globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; globalThis.clearTimeout = () => { }; Date.now = () => clock;
    try {
        await M.syncMbPrompt('light', 9, 2000, { c, def: DEF, doc: { querySelectorAll: () => [] }, retry: false, toast }).catch(() => { });
        await M.syncPrompt('light', { c, def: DEF });   // 원래 단계 = 가볍게
        assert.equal(await M.armOnce({ c, toast, def: DEF }), true);
        assert.equal(M.levelOf(set.prompts[M.KEY]), 'all'); assert.equal(M.onceActive(), true); assert.equal(Number(mem.get(M.ONCE_KEY)), clock + M.ONCE_WAIT);
        assert.equal(await M.endOnce({ c, toast, def: DEF }), false, '때가 안 됐으면 그대로');
        const all = (reg.length ? reg : globalThis.__blReg).find(x => x[0] === M.MACRO_ALL)[1];
        clock += 60000; assert.equal(all(), 'A: body text'); assert.equal(Number(mem.get(M.ONCE_KEY)), clock + M.ONCE_IDLE, '요청이 보이면 그 뒤 한동안으로');
        clock += 30000; all();
        clock += M.ONCE_IDLE + 1; assert.equal(M.onceActive(), false);
        assert.equal(await M.endOnce({ c, toast, def: DEF }), true);
        assert.equal(M.levelOf(set.prompts[M.KEY]), 'light', '원래 단계로'); assert.equal(mem.has(M.ONCE_KEY), false); assert.ok(/2번 보냈어요/.test(toasts.at(-1)));
        // 누르고 아무것도 안 만들면 10분 뒤 거둬요
        await M.armOnce({ c, toast, def: DEF }); clock += M.ONCE_WAIT + 1;
        assert.equal(await M.endOnce({ c, toast, def: DEF }), true); assert.ok(/생성이 없어서/.test(toasts.at(-1))); assert.equal(M.levelOf(set.prompts[M.KEY]), 'light');
        // 거두기(바로)
        await M.armOnce({ c, toast, def: DEF }); assert.equal(await M.endOnce({ c, toast, def: DEF, force: true }), true); assert.equal(M.levelOf(set.prompts[M.KEY]), 'light');
        assert.equal(await M.endOnce({ c, toast, def: DEF, force: true }), false);
    } finally { globalThis.setTimeout = st; globalThis.clearTimeout = ct; Date.now = real; delete globalThis.localStorage; }
});
await ok('채팅 전체 연결: 단계 다섯 · 고를 때 확인 창(취소하면 안 바뀜) · 한 번만 단추 · 상한 설정 · 새로 고친 뒤에도 돌려놓게 표시를 봄', async () => {
    const panel = fs.readFileSync(path.join(root, 'src/panel.js'), 'utf8'), apply = fs.readFileSync(path.join(root, 'src/apply.js'), 'utf8'), set = fs.readFileSync(path.join(root, 'src/settings.js'), 'utf8');
    assert.deepEqual(M.LEVELS, ['off', 'light', 'last', 'recent', 'all', 'memo']);   // memo 는 만들기 화면의 이번 한 번만(설정 단계 고르기 · 저장 값 검사에는 없음)
    assert.ok(!panel.includes("['memo'") && !set.includes("'all', 'memo'].includes(s.chat.mbPrompt)"));
    assert.ok(panel.includes("['recent', '최근 답 여러 개'], ['all', '채팅 전체']], 'off'"));
    const i = panel.indexOf("if (path === 'chat.mbPrompt' && value === 'all' && String(current) !== 'all' && !(await askConfirm("), j = panel.indexOf('update(st => setPath(st, path, typeof current', i);
    assert.ok(i > 0 && j > i && /\)\)\) break;/.test(panel.slice(i, j)), '확인 창에서 취소하면 설정을 안 바꿔요');
    assert.ok(panel.includes('data-act="mb-prompt-once"') && panel.includes("case 'mb-prompt-once':") && panel.includes("slider('chat.mbPromptCap'"));
    assert.ok(apply.includes("localStorage.getItem('bl-mb-prompt-once')") && apply.includes('{ cap: s.chat.mbPromptCap }'));
    assert.ok(set.includes("range('mbPromptCap', 0, 1000000, 0)") && set.includes("'recent', 'all'].includes(s.chat.mbPrompt)"));
});
// ── 1.6.1 줄 꼴 규칙(본편 출력 규칙 · 별도 분석 문구에 붙는 한 덩이) ──
const RDEF = { 'inj.output': 'Test output rule. Values in Korean, names exactly as above.', 'inj.ultra.output': 'Test short rule. Keys: {keys}', 'ai.analyze': 'Test tracker.' };   // 시험용으로 지어낸 기본 문구(원작 글 아님)
await ok('줄 꼴 규칙: 세 칸 끝에 한 덩이 · 떼면 칸이 비워짐 · 손으로 고친 문구는 그대로 · 두 번 붙지 않아요', async () => {
    const { c, set } = mk();
    let r = await M.syncRules(true, { c, defs: RDEF });
    assert.deepEqual([r.ok, r.changed, r.keys], [true, 3, M.RULE_KEYS]);
    for (const k of M.RULE_KEYS) { assert.ok(set.prompts[k].startsWith(RDEF[k] + '\n[BL LINE RULES] ')); assert.equal(M.stripRules(set.prompts[k]), RDEF[k]); assert.equal(set.prompts[k].split('[BL LINE RULES]').length, 2); }
    assert.equal((await M.syncRules(true, { c, defs: RDEF })).changed, 0);                 // 같은 글이면 안 건드려요
    r = await M.syncRules(false, { c, defs: RDEF });
    assert.equal(r.changed, 3); for (const k of M.RULE_KEYS) assert.ok(!(k in set.prompts));   // 기본값 상태로
    const mine = 'MY OWN RULE  \n'; const h = mk({ 'inj.output': mine, 'gen.system': 'keep me' });
    await M.syncRules(true, { c: h.c, defs: RDEF });
    assert.ok(h.set.prompts['inj.output'].startsWith(mine + '\n[BL LINE RULES] ')); assert.ok(!/ d:[0-9a-f]{8}\]$/.test(h.set.prompts['inj.output']));   // 손으로 고친 글 위에는 지문 없이
    h.set.prompts['inj.output'] = 'EDITED AFTER ' + h.set.prompts['inj.output'];
    await M.syncRules(false, { c: h.c, defs: RDEF });
    assert.equal(h.set.prompts['inj.output'], 'EDITED AFTER ' + mine); assert.equal(h.set.prompts['gen.system'], 'keep me');
});
await ok('줄 꼴 규칙: 판을 올려 글이 바뀌면 옛 덩이를 떼고 새로 · 원작이 기본 문구를 바꾸면 새 기본 문구로 · 없는 칸 · 못 읽음은 건너뜀', async () => {
    const old = '[BL LINE RULES] an older wording of the same rules. [/BL LINE RULES d:' + M.mark8(RDEF['inj.output']) + ']';
    const { c, set } = mk({ 'inj.output': RDEF['inj.output'] + '\n' + old });
    await M.syncRules(true, { c, defs: RDEF });
    assert.ok(!set.prompts['inj.output'].includes('older wording')); assert.equal(set.prompts['inj.output'], RDEF['inj.output'] + '\n' + M.ruleBlock(M.mark8(RDEF['inj.output'])));
    const NEW = { ...RDEF, 'inj.output': 'Test output rule, second edition.' };
    await M.syncRules(true, { c, defs: NEW });
    assert.equal(set.prompts['inj.output'], NEW['inj.output'] + '\n' + M.ruleBlock(M.mark8(NEW['inj.output'])));
    await M.syncRules(false, { c, defs: NEW }); assert.ok(!('inj.output' in set.prompts));
    const part = mk(); const r = await M.syncRules(true, { c: part.c, defs: { 'ai.analyze': 'Only this one.' } });
    assert.deepEqual([r.changed, r.keys], [1, ['ai.analyze']]);
    assert.equal((await M.syncRules(true, { c: mk().c, defs: null })).ok, false); assert.equal((await M.syncRules(true, { c: {}, defs: RDEF })).ok, false);
    assert.equal((await M.syncRules(true, { c: mk().c, doc: { querySelectorAll: () => [] } })).ok, false);   // 그 확장 주소를 못 찾으면 안 읽어요
});
await ok('줄 꼴 규칙의 글: 그 확장이 읽는 줄 꼴에 맞는 예시(새 값만 · 한 줄에 한 사람) · 문구 자리표시({낱말})와 안 부딪혀요 · 단계와 같이 붙고 같이 떼요', async () => {
    const b = M.ruleBlock();
    for (const line of ['period: Night', 'loc: Corner bakery', 'npc: Mira | florist next door']) {
        assert.ok(b.includes('"' + line + '"'));
        const m = /^\s*([^:：\n]{1,24}?)\s*[:：]\s*(.+?)\s*$/.exec(line); assert.ok(m && !/->|,/.test(m[2]));   // 「키: 값」 한 줄 · 화살표 · 쉼표로 여럿 없음
    }
    assert.ok(!/\{[a-z][a-zA-Z0-9_]*\}/.test(b)); assert.ok(!b.includes('\n')); assert.ok(M.ruleTokens() > 40 && M.ruleTokens() < 160);
    const src = fs.readFileSync(path.join(root, 'src/mb-prompt.js'), 'utf8');
    assert.ok(src.includes("if (r.ok) await syncRules(state.level !== 'off', { c, doc })"));                     // 「가볍게」 부터 모든 단계 · 「적용 안 함」 이면 떼요
    assert.ok(src.includes("await syncRules(state.level !== 'off', { c, doc }).catch(() => null);\n    if (quiet) return true;"));   // 「이번 한 번만」 이 끝나면 원래 단계대로
    const panel = fs.readFileSync(path.join(root, 'src/panel.js'), 'utf8');
    assert.ok(panel.includes('mbRuleTokens()') && panel.includes('esc(mbRuleBlock())'));                         // 설정 줄: 본편 답마다 어림 · 덧붙는 글 보기
});
// ── 1.6.3 기억 요약 · 채팅 전체가 넘칠 때 요약으로 · 실은 양 ──
// 시험용으로 지어낸 기억 자료(그 확장들의 저장 모양만 흉내 · 원작 글 아님)
const memoriaMeta = () => ({ memoria: { version: 1, turns: [
    { id: 't2', mesId: 2, turnIndex: 3, summary: 'Day 2: the courier lost the parcel.' },
    { id: 't0', mesId: 0, turnIndex: 1, summary: 'Day 1: the courier arrived at the harbor.' },
    { id: 't1', mesId: 1, turnIndex: 2, summary: '', failed: false },
    { id: 'tx', mesId: 3, turnIndex: 4, summary: 'broken', failed: true },
] } });
const elephantMeta = () => ({ long_memory: { timeline: [
    { id: 'c1', tier: 'chapter', from: 0, to: 3, title: 'Chapter one', text: 'Whole chapter.' },
    { id: 'e2', tier: 'episode', from: 2, to: 3, title: 'Lost parcel', text: 'The parcel went missing.' },
], archive: [
    { id: 'e1', kind: 'timeline', from: 0, to: 1, title: 'Arrival', text: 'The courier arrived.' },
    { id: 'l1', kind: 'ledger', from: 1, to: 1, title: 'Item: key', text: 'not a turn summary' },
    { id: 's0', kind: 'timeline', from: -1, to: 3, title: 'Story so far', text: 'saga' },
] } });
await ok('기억 요약 읽기: 메모리아 꼴(턴마다 · 빈 것 · 실패 뺌 · 차례대로) · 코끼리 꼴(가장 잘게 쪼갠 덩이 · 장 · 줄거리 · 장부 뺌) · 둘 다 있으면 턴마다 쪽만 · 없으면 빈 목록', async () => {
    const a = M.memoEntries({ chatMetadata: memoriaMeta() });
    assert.equal(a.source, 'memoria'); assert.deepEqual(a.list.map(e => [e.from, e.to]), [[0, 0], [2, 2]]);
    const b = M.memoEntries({ chatMetadata: elephantMeta() });
    assert.equal(b.source, 'long_memory'); assert.deepEqual(b.list.map(e => [e.from, e.to, e.text]), [[0, 1, 'Arrival: The courier arrived.'], [2, 3, 'Lost parcel: The parcel went missing.']]);
    assert.equal(M.memoEntries({ chatMetadata: { ...memoriaMeta(), ...elephantMeta() } }).source, 'memoria');
    assert.deepEqual(M.memoEntries({ chatMetadata: {} }), { list: [], source: '' }); assert.deepEqual(M.memoEntries({}), { list: [], source: '' });
    assert.deepEqual(M.memoEntries({ chat_metadata: memoriaMeta() }).list.length, 2, '옛 이름(chat_metadata)도');
});
await ok('채팅 전체 + 기억 요약: 숨긴 메시지는 요약이 있으면 그 자리에 · 상한을 넘으면 오래된 메시지부터 그 요약으로(요약이 없으면 앞 1,000자) · 점자 빈칸은 띄어쓰기로 · 실은 양', async () => {
    const big = (i, extra = {}) => ({ name: 'A', is_user: false, mes: String.fromCharCode(97 + i).repeat(7000), ...extra });
    const chat = [big(0), big(1), big(2, { is_system: true }), big(3), { name: 'U', is_user: true, mes: 'go⠀now' }];
    const c = { chat, chatMetadata: memoriaMeta() };
    const free = M.allText(c, 0);
    assert.ok(free.text.includes('[Summary #2] Day 2: the courier lost the parcel.') && !free.text.includes('c'.repeat(50)), '숨긴 #2 는 요약으로');
    assert.ok(free.text.endsWith('U: go now'), '점자 빈칸 → 띄어쓰기');
    assert.deepEqual([free.count, free.total, free.hidden, free.hiddenSum, free.summarized, free.cut, free.dropped, free.memo], [4, 4, 1, 1, 0, 0, 0, 2]);
    const fit = M.allText(c, 3000);   // #0 을 요약으로 바꾸고 · 요약 없는 #1 은 앞 1,000자
    assert.ok(fit.tokens <= 3000); assert.ok(fit.text.startsWith('[Summary] A: Day 1: the courier arrived at the harbor.\n\nA: ' + 'b'.repeat(M.HEAD_CHARS) + '…'));
    assert.deepEqual([fit.count, fit.summarized, fit.cut, fit.dropped], [4, 1, 1, 0]); assert.ok(fit.text.includes('d'.repeat(7000)), '요약 없는 새 메시지는 원문');
    assert.equal(M.fillLine('all', fit), `메시지 4/4개 · ${Math.round(fit.chars).toLocaleString('ko-KR')}자 · 약 ${fit.tokens.toLocaleString('ko-KR')} 토큰 · 오래된 1개는 기억 요약으로 · 1개는 앞 1,000자만 · 숨긴 메시지 1개는 요약 1개로`);
    // 코끼리 꼴: 한 덩이가 #0~#1 을 덮으면 #0 자리에 한 번만 · #1 은 합쳐짐(실린 셈)
    const e = M.allText({ chat: [big(0), big(1), big(3), big(4)], chatMetadata: elephantMeta() }, 3500);
    assert.ok(e.text.startsWith('[Summary] A: Arrival: The courier arrived.\n\n[Summary] A: Lost parcel: The parcel went missing.\n\nA: e')); assert.equal((e.text.match(/Arrival/g) || []).length, 1);
    assert.deepEqual([e.count, e.summarized, e.dropped, e.tokens <= 3500], [4, 3, 0, true]);
});
await ok('기억 요약 단계: 요약을 차례대로([#N]) + 마지막 요약 뒤 메시지는 원문 · 요약이 없으면 빈 글 · 문구 덩어리 · 알아보기 · 어림', async () => {
    const chat = [{ name: 'A', mes: 'one' }, { name: 'A', mes: 'two' }, { name: 'A', mes: 'three' }, { name: 'U', is_user: true, mes: 'four' }, { name: 'A', is_system: true, mes: 'hidden five' }, { name: 'A', mes: 'six' }];
    const r = M.memoText({ chat, chatMetadata: memoriaMeta() }, 0);
    assert.equal(r.text, '[#0] Day 1: the courier arrived at the harbor.\n[#2] Day 2: the courier lost the parcel.\n\n--- AFTER THE LAST SUMMARY (full text) ---\nU: four\n\nA: six');
    assert.deepEqual([r.count, r.first, r.last, r.tail, r.source], [2, 0, 2, 2, 'memoria']);
    assert.equal(M.fillLine('memo', r), `기억 요약 2개(메시지 #0~#2) · 그 뒤 메시지 2개는 원문 · ${r.chars}자 · 약 ${r.tokens} 토큰`);
    assert.deepEqual(M.memoText({ chat }, 0).count, 0); assert.equal(M.memoText({ chat }).text, ''); assert.equal(M.fillLine('memo', { count: 0 }), '이 채팅에 매 턴 기억 요약이 없어요');
    assert.ok(M.block('memo').includes(`{{${M.MACRO_MEMO}}}`)); assert.equal(M.levelOf(M.block('memo')), 'memo'); assert.equal(M.levelOf(M.block('all')), 'all');
    assert.equal(M.estimate('memo', { chat, chatMetadata: memoriaMeta() }), M.estimate('light') + r.tokens);
});
await ok('이번 한 번만 끝 알림에 실은 양: 「채팅 전체를 실어 N번 보냈어요 — 요청마다 메시지 a/b개 · …」 · 기억 요약도', async () => {
    const reg = []; const { c, set } = mk();
    c.registerMacro = (k, fn) => reg.push([k, fn]); c.chat = [{ name: 'A', is_user: false, mes: 'body text' }, { name: 'A', is_system: true, mes: 'old' }]; c.chatMetadata = { memoria: { turns: [{ mesId: 1, summary: 'Old part summary.' }] } };
    globalThis.SillyTavern = { getContext: () => c };
    const mem = new Map(); globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
    const toasts = []; const toast = { info: m => toasts.push(m), warning: m => toasts.push('!' + m) };
    const st = globalThis.setTimeout, ct = globalThis.clearTimeout; globalThis.setTimeout = () => 1; globalThis.clearTimeout = () => { };
    try {
        await M.armOnce({ c, toast, def: DEF, quiet: true });
        const fills = []; const off = M.onFill(f => fills.push(f));
        const all = (reg.length ? reg : globalThis.__blReg).find(x => x[0] === M.MACRO_ALL)[1];
        assert.equal(all(), 'A: body text\n\n[Summary #1] Old part summary.'); all();
        assert.equal(fills.length, 2); assert.deepEqual(M.onceInfo().seen, 2); assert.equal(M.onceInfo().fill.count, 1); off();
        assert.equal(await M.endOnce({ c, toast, def: DEF, force: true }), true);
        assert.match(toasts.at(-1), /^채팅 전체를 실어 2번 보냈어요 — 요청마다 메시지 1\/1개 · \d+자 · 약 \d+ 토큰 · 숨긴 메시지 1개는 요약 1개로\. 미트볼 문구를 원래 단계로 돌려놨어요\.$/);
        await M.armOnce({ c, toast, def: DEF, quiet: true, level: 'memo' }); assert.equal(M.onceLevel(), 'memo'); assert.equal(M.levelOf(set.prompts[M.KEY]), 'memo'); assert.equal(mem.get(M.ONCE_LV_KEY), 'memo');
        const memo = (reg.length ? reg : globalThis.__blReg).find(x => x[0] === M.MACRO_MEMO)[1];
        assert.equal(memo(), '[#1] Old part summary.');
        await M.endOnce({ c, toast, def: DEF, force: true }); assert.match(toasts.at(-1), /^「기억 요약」 으로 1번 보냈어요 — 요청마다 기억 요약 1개\(메시지 #1~#1\)/);
    } finally { globalThis.setTimeout = st; globalThis.clearTimeout = ct; delete globalThis.localStorage; }
});
// ── 1.6.5 상한 기본 0(없음) · 옛 기본 12만 옮기기 · 모델 한도 알림 ──
await ok('1.6.5 상한 기본 0: 새로 깐 사람 0 · 저장값이 옛 기본 12만이면 한 번 0 으로(표시 mbPromptCapV) · 손으로 넣은 다른 값은 그대로 · 옮긴 뒤 다시 12만을 고르면 그대로', async () => {
    assert.equal(M.DEFAULT_CAP, 0); assert.equal(M.OLD_DEFAULT_CAP, 120000);
    const { getSettings } = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
    const load = saved => { const ext = saved === undefined ? {} : { salty: saved }; globalThis.SillyTavern = { getContext: () => ({ extensionSettings: ext }) }; return getSettings().chat; };
    const fresh = load(undefined); assert.deepEqual([fresh.mbPromptCap, fresh.mbPromptCapV], [0, 2]);
    const old = load({ chat: { mbPromptCap: 120000 } }); assert.deepEqual([old.mbPromptCap, old.mbPromptCapV], [0, 2]);
    const mine = load({ chat: { mbPromptCap: 50000 } }); assert.deepEqual([mine.mbPromptCap, mine.mbPromptCapV], [50000, 2]);
    const again = load({ chat: { mbPromptCap: 120000, mbPromptCapV: 2 } }); assert.equal(again.mbPromptCap, 120000, '옮긴 뒤 사용자가 다시 고른 12만은 그대로');
    const none = load({ chat: {} }); assert.equal(none.mbPromptCap, 0);
    delete globalThis.SillyTavern;
});
await ok('1.6.5 모델 한도: 미트볼이 기본 연결이면 실리태번 연결의 맥락 값(채팅 완성은 openai_max_context) · 연결 프로필을 쓰면 모름(0) · 넘는 게 확실할 때만(적게 잡는 어림) · 상한 0 이면 다 실음', async () => {
    const big = { chat: [{ name: 'A', mes: 'x'.repeat(40000) }] };   // 적게 잡아 1만 토큰
    assert.equal(M.modelLimit({ mainApi: 'openai', chatCompletionSettings: { openai_max_context: 8000 }, extensionSettings: { statussim: {} } }), 8000);
    assert.equal(M.modelLimit({ mainApi: 'textgenerationwebui', maxContext: 4096 }), 4096);
    assert.equal(M.modelLimit({ mainApi: 'openai', chatCompletionSettings: { openai_max_context: 8000 }, extensionSettings: { statussim: { profGen: 'p1' } } }), 0, '따로 연결 프로필 — 모름');
    assert.equal(M.modelLimit({}), 0); assert.equal(M.modelLimit(null), 0);
    const c = { ...big, mainApi: 'openai', chatCompletionSettings: { openai_max_context: 8000 } };
    assert.equal(M.overModel(M.allText(big, 0).text, c), 8000);
    assert.equal(M.overModel(M.allText(big, 0).text, { ...c, chatCompletionSettings: { openai_max_context: 1000000 } }), 0);
    assert.equal(M.overModel('짧은 글', { mainApi: 'openai' }), 0, '한도를 모르면 말 안 함');
    const r = M.allText(big); assert.deepEqual([r.count, r.summarized, r.cut, r.dropped, r.chars], [1, 0, 0, 0, 40003], '기본(상한 0) — 원문 그대로');
});
await ok('1.6.5 「지금 상태로」 지시: 덧붙는 덩어리마다(가볍게부터) 이야기가 흘렀으면 처음이 아니라 이야기 끝의 상태로 · 「시작」 을 「지금」 으로 읽게 · 첫 메시지부터 끝까지 · 자리표시({낱말})와 안 부딪혀요', async () => {
    for (const lv of ['light', 'last', 'recent', 'all', 'memo']) { const b = M.block(lv); assert.ok(b.includes('NOT A NEW STORY') && b.includes('at the END of the story text') && b.includes('"starting values"') && b.includes('from the first message to the last'), lv); assert.ok(!/\{[a-z][a-zA-Z0-9_]*\}/.test(b.replace(/\{\{[^}]+\}\}/g, '')), lv); }
});
await ok('1.6.5 변화 장: 답마다 남은 상태 변화 줄(extra.statussim)을 사람마다 합치고(쉼표 · 세로줄 여럿) · 마지막 장소 · 시간 · 사건 차례 · 숨긴 메시지 · 고르지 않은 스와이프는 빼요 · 채팅 전체 · 기억 요약 매크로 맨 앞에', async () => {
    const op = (sw, ...ops) => ({ bySwipe: { [sw]: ops } });
    const chat = [   // 시험용으로 지어낸 줄
        { name: 'A', mes: 'one', swipe_id: 0, extra: { statussim: op(0, ['aff', 'Mira +2, Joon +1'], ['trust', 'Mira +3'], ['loc', 'Harbor'], ['event', 'Met at the harbor.']) } },
        { name: 'A', mes: 'two', is_system: true, extra: { statussim: op(0, ['aff', 'Mira +50']) } },
        { name: 'A', mes: 'three', swipe_id: 1, extra: { statussim: { bySwipe: { 0: [['aff', 'Mira +40']], 1: [['aff', 'Mira +4 | Joon -2'], ['period', 'Night'], ['place', 'Home'], ['event', 'Walked home.']] } } } },
        { name: 'U', is_user: true, mes: 'four' },
    ];
    const l = M.opsLedger({ chat });
    assert.deepEqual([l.msgs, l.people, l.events], [2, 2, 2]);
    assert.ok(l.text.includes('Mira: aff +6, trust +3; Joon: aff -1, trust 0'), l.text);
    assert.ok(l.text.includes('Latest location: Home (#2)') && l.text.includes('Latest time of day: Night (#2)') && l.text.includes('#0 Met at the harbor.\n#2 Walked home.'));
    { const { sums, ...rest } = M.opsLedger({ chat: [{ name: 'A', mes: 'x' }] }); assert.deepEqual(rest, { text: '', people: 0, events: 0, msgs: 0 }); assert.equal(sums.size, 0); }
    assert.deepEqual([...l.sums], [['Mira', { aff: 6, trust: 3 }], ['Joon', { aff: -1, trust: 0 }]]);
    const reg = []; const c = { chat, registerMacro: (k, fn) => reg.push([k, fn]), extensionSettings: { statussim: {} }, chatMetadata: { memoria: { turns: [{ mesId: 0, summary: 'S0.' }] } } };
    globalThis.SillyTavern = { getContext: () => c };
    const fn = k => (reg.length ? reg : globalThis.__blReg).find(x => x[0] === k)?.[1];
    if (!fn(M.MACRO_ALL)) await M.syncMbPrompt('off', 9, 2000, { c, retry: false, doc: { querySelectorAll: () => [] } }).catch(() => null);
    const all = fn(M.MACRO_ALL)(), memo = fn(M.MACRO_MEMO)();
    assert.ok(all.startsWith('--- STATUS CHANGES RECORDED DURING THE STORY') && all.includes('\n\n--- STORY TEXT ---\nA: one'));
    assert.ok(memo.startsWith('--- STATUS CHANGES RECORDED') && memo.includes('--- STORY TEXT ---\n[#0] S0.'));
    delete globalThis.SillyTavern;
});
await ok('1.6.5 버그 사냥 6차: 「기억 요약」 이 상한을 안 넘어요(요약 머리가 넘치면 뒤 원문은 가장 새 것만 · 그래도 넘치면 오래된 요약부터 빼요 · 가장 새 요약은 남김) · 알림 · 주석(is_system · 다른 종류)은 숨긴 수에 안 세요', async () => {
    const turns = Array.from({ length: 40 }, (_, i) => ({ mesId: i, summary: `Turn ${i} summary ${'s'.repeat(300)}` }));   // 지어낸 요약 40개(하나 약 90 토큰)
    const chat = [...Array.from({ length: 40 }, (_, i) => ({ name: 'A', mes: `m${i}` })), { name: 'A', mes: 'x'.repeat(3000) }, { name: 'U', is_user: true, mes: 'y'.repeat(700) }];
    const c = { chat, chatMetadata: { memoria: { turns } } };
    const free = M.memoText(c, 0); assert.deepEqual([free.count, free.dropped, free.tail], [40, 0, 2]);
    const r = M.memoText(c, 2000);
    assert.ok(r.tokens <= 2000, `어림 ${r.tokens} 이 상한 2,000 을 넘어요`);
    assert.ok(r.dropped > 0 && r.count === 40 - r.dropped && r.first === r.dropped, JSON.stringify({ ...r, text: 0 }));
    assert.ok(r.text.includes('Turn 39 summary') && !r.text.includes('Turn 0 summary'), '가장 새 요약은 남기고 오래된 것부터');
    assert.ok(r.text.endsWith('y'.repeat(700)), '가장 새 원문은 그대로');
    assert.match(M.fillLine('memo', r), /· 상한 때문에 오래된 요약 \d+개는 뺌 · /);
    const n0 = M.memoText({ chat: [{ name: 'A', mes: 'a' }], chatMetadata: { memoria: { turns: [{ mesId: 0, summary: 'S.' }] } } }, 5);
    assert.deepEqual([n0.count, n0.dropped], [1, 0], '요약 하나는 늘 남겨요');
    const sys = { chat: [
        { name: 'A', mes: 'story one' },
        { name: 'System', is_system: true, mes: 'help text', extra: { type: 'help' } },
        { name: 'System', is_system: true, mes: 'a comment', extra: { type: 'comment' } },
        { name: 'System', is_system: false, mes: 'narration line', extra: { type: 'narrator' } },
        { name: 'A', is_system: true, mes: 'hidden reply' },
        { name: 'System', is_system: true, mes: 'hidden narration', extra: { type: 'narrator' } },
    ] };
    const a = M.allText(sys, 0);
    assert.deepEqual([a.hidden, a.total], [2, 2], '숨긴 것은 눈 감긴 답 · 내레이션 둘만 · 알림 · 주석은 세지도 싣지도 않아요');
    assert.equal(a.text, 'A: story one\n\nSystem: narration line');
});
await ok('1.6.5 관계 숫자 바로잡기: 적용 뒤 애정 · 우정이 변화 합보다 낮으면 그 합까지(음수 합은 그만큼 아래로) · 이미 따르면 그대로 · 합 없는 사람 그대로 · 바뀐 사람만 단계 자동(−1) · 이름표의 직함으로도 맞춰요 · 「채팅 전체」 · 「기억 요약」 일 때만 · 적용 안 하면 안 해요', async () => {
    const op = (...ops) => ({ statussim: { bySwipe: { 0: ops } } });   // 시험용으로 지어낸 변화 줄
    const chat = [
        { name: 'A', mes: 'a', swipe_id: 0, extra: op(['aff', 'Mira +9, Chief +7'], ['trust', 'Mira +4']) },
        { name: 'A', mes: 'b', swipe_id: 0, extra: op(['aff', 'Mira +8 | Joon -6'], ['trust', 'Joon -3, Ria +2']) },
    ];
    const mk2 = () => ({ chat, saveMetadata() { this.saved = (this.saved || 0) + 1; }, chatMetadata: { statussim: { base: { data: { rel: { user: [
        { name: 'Mira', aff: 4, trust: 25, stage: 2 },            // 애정 4 < 합 17 → 17 · 우정 25 ≥ 4 → 그대로
        { name: 'Joon', aff: 2, trust: 1, stage: 1 },             // 합 −6 · −3 → 아래로
        { name: 'Bo', label: 'Office Chief', aff: 1, trust: 3, stage: 0 },   // 이름표의 직함으로 맞춤(합 7)
        { name: 'Ria', aff: 5, trust: 9, stage: 1 },              // 우정 합 2 — 이미 더 높음 → 그대로
        { name: 'Kai', aff: 0, trust: 0, stage: 0 },              // 변화 줄 없음 → 그대로
    ] } } }, origin: { data: { rel: { user: [{ name: 'Mira', aff: 4, trust: 25, stage: 2 }] } } } } } });
    const c = mk2(); const r = M.reconcileRel(c); const u = c.chatMetadata.statussim.base.data.rel.user;
    assert.deepEqual(u.map(x => [x.name, x.aff, x.trust, x.stage]), [['Mira', 17, 25, -1], ['Joon', -6, -3, -1], ['Bo', 7, 3, -1], ['Ria', 5, 9, 1], ['Kai', 0, 0, 0]]);
    assert.deepEqual(r.changed.map(x => x.name), ['Mira', 'Joon', 'Bo']); assert.equal(r.checked, 4);
    assert.deepEqual(c.chatMetadata.statussim.origin.data.rel.user[0], { name: 'Mira', aff: 17, trust: 25, stage: -1 });
    assert.equal(M.reconcileRel(c).changed.length, 0, '두 번 해도 그대로');
    // 창이 닫힌 뒤: 기준 자료가 새것으로 바뀌었을 때만 · 단계가 all · memo 일 때만
    const toasts = []; const toast = { success: m => toasts.push('ok ' + m), info: m => toasts.push('i ' + m) }; let refreshed = 0; const core = { app: { refreshNow: () => refreshed++ } };
    const c2 = mk2(); const before = c2.chatMetadata.statussim.base;
    assert.equal(await M.afterWizard({ before, level: 'all', c: c2, toast, waitMs: 20, step: 5, core }), null, '적용 안 함 — 그대로');
    assert.equal(await M.afterWizard({ before: null, level: 'recent', c: c2, toast, waitMs: 20, step: 5, core }), null, '「최근 답」 은 안 해요');
    const nb = structuredClone(before); setTimeout(() => { c2.chatMetadata.statussim.base = nb; }, 10);
    const res = await M.afterWizard({ before, level: 'all', c: c2, toast, waitMs: 500, step: 5, core });
    assert.equal(res.changed.length, 3); assert.equal(nb.data.rel.user[0].aff, 17); assert.equal(c2.saved, 1); assert.equal(refreshed, 1);
    assert.match(toasts.at(-1), /^ok 관계 숫자를 채팅 기록\(3명\)에 맞췄어요/);
    const c3 = mk2(); M.reconcileRel(c3); const b3 = c3.chatMetadata.statussim.base; c3.chatMetadata.statussim.base = structuredClone(b3);
    await M.afterWizard({ before: b3, level: 'memo', c: c3, toast, waitMs: 50, step: 5, core }); assert.match(toasts.at(-1), /^i 관계 숫자가 채팅 기록을 따라요\(4명 확인\)/);
});
await ok('1.6.5 진짜 모델 다시 넣기에서 찾은 것: 직함이 다른 사람 이름표에도 들어 있으면 그 사람을 안 올려요(이름 · 별칭이 같은 사람이 있으면 그 사람만) · 시간대는 마지막 시간대 글을 그 확장 달력 시간대로', async () => {
    const sums = new Map([['Captain', { aff: 14, trust: 3 }], ['Chief', { aff: 5, trust: 1 }]]);   // 지어낸 이름
    const list = [{ name: 'Captain', label: 'Boss' }, { name: 'Ozz', label: 'The very first Captain' }, { name: 'Raf', label: 'Office Chief' }, { name: 'Tam', label: 'Chief of staff' }];
    assert.deepEqual(M.sumFor(list[0], sums, list), { aff: 14, trust: 3 }, '이름이 같으면 그 사람');
    assert.equal(M.sumFor(list[1], sums, list), null, '다른 사람 이름인 직함이 이름표에 있어도 안 맞춰요');
    assert.equal(M.sumFor(list[2], sums, list), null, '같은 직함이 이름표에 둘이면 안 맞춰요');
    assert.deepEqual(M.sumFor(list[2], sums, [list[2]]), { aff: 5, trust: 1 }, '한 명뿐이면 맞춰요');
    const T = ['새벽', '아침', '낮', '저녁', '밤', '심야'];
    assert.deepEqual(['Evening -> Night', 'Late Night', 'Noon', 'Morning', 'dusk', '심야', 'Teatime'].map(x => M.timeOfDay(x, T)), ['밤', '심야', '낮', '아침', '저녁', '심야', null]);
    assert.equal(M.timeOfDay('Night', ['Morning', 'Night']), 'Night');
    const c = { chat: [{ name: 'A', mes: 'a', swipe_id: 0, extra: { statussim: { bySwipe: { 0: [['period', 'Evening -> Night'], ['aff', 'Captain +14']] } } } }],
        chatMetadata: { statussim: { base: { data: { calendar: { time: '아침', times: T }, rel: { user: [{ name: 'Captain', aff: 3, trust: 0, stage: 0 }, { name: 'Ozz', label: 'The very first Captain', aff: 0, trust: 8, stage: 0 }] } } } } } };
    const r = M.reconcileRel(c);
    assert.deepEqual(r.time, { from: '아침', to: '밤' }); assert.deepEqual(c.chatMetadata.statussim.base.data.rel.user.map(x => [x.name, x.aff, x.trust]), [['Captain', 14, 0], ['Ozz', 0, 8]]);
});
await ok('1.6.6 프로필 채우기: 변화 줄이 남은 사람인데 프로필이 없으면 관계 칸 이름표 · 메모로 짧은 프로필(npc) · 이미 있으면(이름 · 별칭) 안 더해요 · 변화 줄 없는 사람은 안 더해요 · 변화 장에 「모두 프로필」 안내', async () => {
    const op = (...ops) => ({ statussim: { bySwipe: { 0: ops } } });   // 시험용으로 지어낸 줄
    const chat = [{ name: 'A', mes: 'a', swipe_id: 0, extra: op(['aff', 'Mira +3, Joon +2, Bo +1']) }];
    const c = { chat, chatMetadata: { statussim: {
        base: { data: { profile: { mode: 'detailed', list: [{ name: 'Me', role: 'user', summary: 'x', fields: [] }, { name: 'Mira', role: 'main', summary: 'm', fields: [{ k: 'a', v: 'b' }] }, { name: 'Jo', aliases: ['Joon'], role: 'main', summary: 'j', fields: [] }] },
            rel: { user: [{ name: 'Mira', aff: 3, trust: 0, stage: 0 }, { name: 'Joon', aff: 2, trust: 0, stage: 0 }, { name: 'Bo', label: 'Baker', memo: 'Gave her bread.', aff: 1, trust: 0, stage: 0 }, { name: 'Kai', label: 'Stranger', memo: 'Passed by.', aff: 0, trust: 0, stage: 0 }] } } },
        origin: { data: { profile: { list: [] } } } } } };
    c.chatMetadata.statussim.base.data.rel.user[1].aliases = ['Jo'];
    const r = M.reconcileRel(c);
    assert.deepEqual(r.added, ['Bo']);
    assert.deepEqual(c.chatMetadata.statussim.base.data.profile.list.at(-1), { name: 'Bo', role: 'npc', summary: 'Baker — Gave her bread.', fields: [], home: '', sched: '', blFill: 1 });
    assert.equal(c.chatMetadata.statussim.origin.data.profile.list.length, 1);
    assert.deepEqual(M.reconcileRel(c).added, [], '두 번 해도 한 번만');
    assert.ok(M.opsLedger({ chat }).text.includes('Profiles: write a profile (role "main") for EVERY person in the relationship changes above'));
});
// 1.6.8 이름 칸이 직함으로 나오던 것(진짜 모델 시험) — 시험용으로 지어낸 이름 · 직함 · 로어북이에요
const LORE = { entries: {   // 지어낸 로어북: 「Captain」 은 두 사람 항목의 열쇠 · 「Warden」 은 한 사람만 · 「Harbor」 는 사람 없는 설정 항목 · 「Pip」 은 Mira 항목에 든 다른 이(동물)
    0: { key: ['Captain', 'Mira', '/mi+ra/i'] },
    1: { key: ['Captain', 'Joon', 'old guard'] },
    2: { key: ['Warden', 'Bo'] },
    3: { key: ['Harbor', 'Docks'] },
    4: { key: ['Pip', 'Mira'] },
    5: { key: ['Keeper', 'Ria'] }, 6: { key: ['Keeper', 'Harbor'] },
} };
const loreCtx = (extra = {}) => ({ characterId: 0, characters: [{ name: 'Narrator', avatar: 'n.png', data: { extensions: { world: 'book-a' } } }], getCurrentChatId: () => 'chat-1', name1: 'Me',
    loadWorldInfo: async n => (n === 'book-a' ? structuredClone(LORE) : null), ...extra });
await ok('1.6.8 직함 → 이름 짝: 같은 직함을 둘이 가지면 정하지 않아요 · 한 사람만 가지면 그 사람 · 이름과 직함이 같으면 이름 그대로 · 사람 없는 항목이 섞이면 모름 · 정규식 열쇠는 안 써요', async () => {
    const base = { data: { rel: { user: [{ name: 'Mira' }, { name: 'Joon' }, { name: 'Bo' }, { name: 'Ria' }, { name: 'Chief', label: 'Head of the Watch' }] }, profile: { list: [{ name: 'Me', role: 'user' }, { name: 'Tam', aliases: ['Tammy'] }] } } };
    const c = loreCtx();
    const known = M.knownNames(c, base);
    assert.deepEqual([...known.values()], ['Mira', 'Joon', 'Bo', 'Ria', 'Chief', 'Tam', 'Narrator'], '사용자 이름(프로필 user)은 빼요');
    const sets = M.keySets([LORE], base);
    const h = w => M.holdersOf(w, known, sets);
    assert.deepEqual(h('Captain'), { self: false, names: ['Mira', 'Joon'], unknown: 0 }); assert.equal(M.onlyHolder(h('Captain')), '', '둘이면 안 정해요');
    assert.equal(M.onlyHolder(h('warden')), 'Bo', '한 사람만 — 대소문자 무시');
    assert.deepEqual(h('Chief'), { self: true, names: ['Chief'], unknown: 0 }, '그 이름의 사람이 있으면 다른 사람 이름표의 직함과 같아도 이름 그대로'); assert.equal(M.onlyHolder(h('Chief')), '');
    assert.equal(M.onlyHolder(h('Tammy')), 'Tam', '상태창 별칭 묶음도 열쇠로');
    assert.deepEqual(h('Keeper'), { self: false, names: ['Ria'], unknown: 1 }); assert.equal(M.onlyHolder(h('Keeper')), '', '사람 없는 항목에도 있으면 모름');
    assert.equal(M.onlyHolder(h('Harbor')), '', '사람 없는 설정 항목뿐이면 모름');
    assert.deepEqual(h('mi+ra'), { self: false, names: [], unknown: 0 }, '정규식 열쇠는 빼요');
    assert.equal(M.onlyHolder(M.holdersOf('Warden', new Map(), sets)), '', '아는 이름이 없으면 안 정해요');
});
await ok('1.6.8 변화 장에 이름 짝: 한 사람 직함이면 「이름 (written as 직함)」 · 여럿이면 후보와 「직함을 쓰지 말 것」 · 이름이면 그대로 · 그 사람 이름도 변화 줄에 따로 있으면 짝 안 지음 · 쓸 이름 목록 · 로어북을 못 받았으면 예전 꼴', async () => {
    const op = (...ops) => ({ statussim: { bySwipe: { 0: ops } } });
    const chat = [{ name: 'A', mes: 'a', swipe_id: 0, extra: op(['aff', 'Captain +5, Warden +3, Chief +2, Pip +1, Mira +1'], ['trust', 'Captain +2']) }];
    const base = { data: { rel: { user: [{ name: 'Mira' }, { name: 'Joon' }, { name: 'Bo' }, { name: 'Chief' }] } } };
    const c = loreCtx({ chat, chatMetadata: { statussim: { base } } });
    const plain = M.opsLedger({ ...c, getCurrentChatId: () => 'other-chat' }).text;
    assert.ok(plain.includes('Captain: aff +5, trust +2; Warden: aff +3, trust 0'), '로어북을 받기 전엔 짝 없이(이름 목록만)');
    await M.primeBooks(c);
    const t = M.opsLedger(c).text;
    assert.ok(t.includes('"Captain" (a title or nickname shared in the lorebook by Mira, Joon — write the real name of the one the story means, never "Captain"): aff +5, trust +2'), t);
    assert.ok(t.includes('Bo (written as "Warden"): aff +3, trust 0'), t);
    assert.ok(t.includes('; Chief: aff +2, trust 0'), '이름과 직함이 같은 사람은 그대로');
    assert.ok(t.includes('; Pip: aff +1, trust 0'), '그 사람(Mira) 이름도 변화 줄에 있으면 짝 안 지어요');
    assert.ok(t.includes('Real names already used for these people (current panel) — keep exactly these names in the "name" fields; a title goes in the label, never in the name: Mira, Joon, Bo, Chief'), '카드 이름은 목록에 안 넣어요');
    assert.deepEqual([...M.opsLedger(c).sums.keys()], ['Captain', 'Warden', 'Chief', 'Pip', 'Mira'], '바로잡기에 쓰는 합은 적힌 이름 그대로');
    const none = M.opsLedger({ chat }).text; assert.ok(none.includes('Captain: aff +5') && !none.includes('Real names'), '상태창 · 카드가 없으면 예전 꼴');
});
await ok('1.6.8 만든 뒤 이름 칸 바로잡기: 직함이 정확히 한 사람 것이고 그 사람 칸이 따로 없을 때만(관계 · 짝 · 프로필 · origin) · 같은 직함 둘이면 · 이름과 직함이 같으면 · 그 사람 칸이 있으면 · 두 직함이 한 사람으로 모이면 · 그 사람도 변화 줄에 따로 있으면 그대로', async () => {
    const before = { data: { rel: { user: [{ name: 'Mira' }, { name: 'Joon' }, { name: 'Bo' }, { name: 'Ria' }, { name: 'Chief' }] }, profile: { list: [{ name: 'Me', role: 'user' }] } } };
    const mk3 = (rel, prof = [], pairs = [], ops = []) => {
        const c = loreCtx({ chat: [{ name: 'A', mes: 'a', swipe_id: 0, extra: { statussim: { bySwipe: { 0: ops } } } }], chatMetadata: { statussim: {
            base: { data: { rel: { user: rel.map(n => ({ name: n, aff: 1, trust: 1 })), pairs }, profile: { list: [{ name: 'Me', role: 'user' }, ...prof.map(n => ({ name: n, role: 'main' }))] } } },
            origin: { data: { rel: { user: rel.map(n => ({ name: n })), pairs: structuredClone(pairs) }, profile: { list: prof.map(n => ({ name: n })) } } } } } });
        return c;
    };
    const names = c => [c.chatMetadata.statussim.base.data.rel.user.map(r => r.name), c.chatMetadata.statussim.base.data.profile.list.map(r => r.name)];
    await M.primeBooks(loreCtx());
    { const c = mk3(['Warden', 'Mira'], ['Warden'], [{ a: 'Warden', b: 'Mira' }]); const r = M.renameTitles(c, { before });
        assert.deepEqual(r, [{ from: 'Warden', to: 'Bo' }]); assert.deepEqual(names(c), [['Bo', 'Mira'], ['Me', 'Bo']]);
        assert.deepEqual(c.chatMetadata.statussim.base.data.rel.pairs[0], { a: 'Bo', b: 'Mira' }); assert.equal(c.chatMetadata.statussim.origin.data.rel.user[0].name, 'Bo'); assert.equal(c.chatMetadata.statussim.origin.data.profile.list[0].name, 'Bo');
        assert.equal(c.chatMetadata.statussim.base.data.rel.user[0].aff, 1, '숫자 · 다른 칸은 그대로'); assert.deepEqual(M.renameTitles(c, { before }), [], '두 번 해도 한 번만'); }
    { const c = mk3(['Captain', 'Mira']); assert.deepEqual(M.renameTitles(c, { before }), []); assert.deepEqual(names(c)[0], ['Captain', 'Mira'], '같은 직함 둘(사람 섞임 위험) — 그대로'); }
    { const c = mk3(['Captain']); assert.deepEqual(M.renameTitles(c, { before }), [], '둘 중 한 사람 칸이 비어 있어도 그대로'); }
    { const c = mk3(['Chief', 'Mira']); assert.deepEqual(M.renameTitles(c, { before }), [], '이름과 직함이 같은 사람 — 그대로'); }
    { const c = mk3(['Warden', 'Bo']); assert.deepEqual(M.renameTitles(c, { before }), []); assert.deepEqual(names(c)[0], ['Warden', 'Bo'], '그 사람 칸이 따로 있으면 합치지 않아요'); }
    { const c = mk3(['Warden'], ['Bo']); assert.deepEqual(M.renameTitles(c, { before }), [], '프로필에만 그 사람이 있어도 그대로'); }
    { const lore2 = { entries: { 0: { key: ['Warden', 'Bo'] }, 1: { key: ['Gatekeeper', 'Bo'] } } };
        const c = mk3(['Warden', 'Gatekeeper']); assert.deepEqual(M.renameTitles(c, { before, books: [lore2] }), [], '두 직함이 한 사람으로 모이면 둘 다 그대로'); }
    { const c = mk3(['Pip', 'Joon'], [], [], [['aff', 'Pip +1, Mira +2']]); assert.deepEqual(M.renameTitles(c, { before }), [], '그 사람(Mira)도 변화 줄에 따로 있으면 그대로'); }
    { const c = mk3(['Warden']); assert.deepEqual(M.renameTitles(c, { before, books: [] }), [], '로어북이 없으면 그대로');
        assert.deepEqual(M.renameTitles(c, { before: null }), [], '만들기 전 상태창이 없고 카드 이름뿐이면 그대로'); }
});
await ok('1.6.8 창이 닫힌 뒤: 숫자를 직함 이름으로 맞춘 다음 이름을 바꾸고 알려요 · 같은 직함 둘이면 이름은 그대로 두고 숫자만', async () => {
    const op = (...ops) => ({ statussim: { bySwipe: { 0: ops } } });
    const before = { data: { rel: { user: [{ name: 'Mira' }, { name: 'Bo' }, { name: 'Joon' }] } } };
    const mkc = rel => { const c = loreCtx({ chat: [{ name: 'A', mes: 'a', swipe_id: 0, extra: op(['aff', 'Warden +9, Captain +7']) }], saveMetadata() { this.saved = (this.saved || 0) + 1; }, chatMetadata: { statussim: { base: before } } });
        setTimeout(() => { c.chatMetadata.statussim.base = { data: { rel: { user: rel.map(n => ({ name: n, aff: 0, trust: 0, stage: 0 })) } } }; }, 10); return c; };
    const toasts = []; const toast = { success: m => toasts.push('ok ' + m), info: m => toasts.push('i ' + m) }; const core = { app: { refreshNow() { } } };
    const c = mkc(['Warden', 'Captain', 'Mira']);
    const res = await M.afterWizard({ before, level: 'all', c, toast, waitMs: 500, step: 5, core });
    assert.deepEqual(res.renamed, [{ from: 'Warden', to: 'Bo' }]);
    assert.deepEqual(c.chatMetadata.statussim.base.data.rel.user.map(r => [r.name, r.aff]), [['Bo', 9], ['Captain', 7], ['Mira', 0]], '숫자는 직함 이름으로 맞춘 뒤 이름만 바꿔요 · 같은 직함 둘은 그대로');
    assert.match(toasts.at(-1), /이름 칸에 직함으로 적힌 1명은 카드 · 로어북 이름으로 바꿨어요\(Warden → Bo\)\. 「Captain」는 여러 사람의 직함이라\(후보 Mira · Joon\) 누구인지 몰라 그대로 뒀어요/);
});
await ok('1.6.8 프로필 채우기 전 같은 사람 확인: 관계 칸이 직함으로만 적혀 있고 그 직함이 로어북에서 프로필 있는 사람과 같이 나오면 안 더해요(같은 직함 여럿 · 한 명 모두) · 로어북 없으면 다른 프로필 글에 그 낱말이 나오면 안 더해요 · 상관없는 사람은 더해요(표식)', async () => {
    const op = (...ops) => ({ statussim: { bySwipe: { 0: ops } } });
    const mkp = (relNames, profs, chatId) => loreCtx({ getCurrentChatId: () => chatId, chat: [{ name: 'A', mes: 'a', swipe_id: 0, extra: op(['aff', relNames.map(n => `${n} +2`).join(', ')]) }], chatMetadata: { statussim: { base: { data: {
        profile: { list: [{ name: 'Me', role: 'user', summary: '' }, ...profs] }, rel: { user: relNames.map(n => ({ name: n, label: 'Boss', memo: 'Kind to her.', aff: 0, trust: 0, stage: 0 })) } } } } } });
    { const c = mkp(['Captain', 'Kai'], [{ name: 'Mira', role: 'main', summary: 'm', fields: [] }, { name: 'Joon', role: 'npc', summary: 'j', fields: [] }], 'p1'); await M.primeBooks(c);
        assert.deepEqual(M.reconcileRel(c).added, ['Kai'], '같은 직함 여럿(둘 다 프로필 있음) — 직함 칸은 안 더하고 상관없는 사람만'); assert.equal(c.chatMetadata.statussim.base.data.profile.list.at(-1).blFill, 1); }
    { const c = mkp(['Warden'], [{ name: 'Bo', role: 'main', summary: 'b', fields: [] }], 'p2'); await M.primeBooks(c);
        assert.deepEqual(M.reconcileRel(c).added, [], '한 명만 가진 직함 — 그 사람 프로필이 있으면 안 더해요'); }
    { const c = mkp(['Warden'], [{ name: 'Mira', role: 'main', summary: 'm', fields: [] }], 'p3'); await M.primeBooks(c);
        assert.deepEqual(M.reconcileRel(c).added, ['Warden'], '그 직함의 사람이 상태창에 없으면 더해요'); }
    { const c = mkp(['Warden', 'Kai'], [{ name: 'Bo', role: 'main', summary: 'The gentle Warden of the gate.', fields: [] }], 'p4'); c.loadWorldInfo = async () => null; await M.primeBooks(c);
        assert.deepEqual(M.reconcileRel(c).added, ['Kai'], '로어북이 없으면 다른 프로필 글에 그 낱말이 나오면 안 더해요'); }
});
await ok('1.6.8 이미 생긴 중복 정리: 블루레몬이 더한 프로필(표식 · 1.6.6 꼴)만 · 같은 사람으로 확인될 때만 지워요(같은 직함 여럿이어도 모두 프로필이 있으면 · 한 명이면) · 사용자 · AI 프로필은 그대로 · 모르는 항목이 섞이면 그대로 · 알림 한 줄', async () => {
    const row = n => ({ name: n, label: 'Boss', memo: 'Kind to her.', aff: 0, trust: 0, stage: 0 });
    const old166 = n => ({ name: n, role: 'npc', summary: 'Boss — Kind to her.', fields: [], home: '', sched: '' });   // 1.6.6 이 더한 꼴(표식 전)
    const mkd = (profs, rel, chatId) => loreCtx({ getCurrentChatId: () => chatId, saveMetadata() { this.saved = (this.saved || 0) + 1; }, chatMetadata: { statussim: {
        base: { data: { profile: { list: [{ name: 'Me', role: 'user' }, ...profs] }, rel: { user: rel.map(row) } } },
        origin: { data: { profile: { list: structuredClone(profs) }, rel: { user: rel.map(row) } } } } } });
    const names = c => c.chatMetadata.statussim.base.data.profile.list.map(p => p.name);
    { const c = mkd([{ name: 'Mira', role: 'main', summary: 'm', fields: [] }, { name: 'Joon', role: 'npc', summary: 'Old guard.', fields: [] }, old166('Captain')], ['Captain', 'Mira'], 'd1'); await M.primeBooks(c);
        assert.deepEqual(M.dedupeFilled(c), ['Captain'], '같은 직함 둘 — 둘 다 프로필이 있으니 누구든 중복'); assert.deepEqual(names(c), ['Me', 'Mira', 'Joon']); assert.deepEqual(c.chatMetadata.statussim.origin.data.profile.list.map(p => p.name), ['Mira', 'Joon']); }
    { const c = mkd([{ name: 'Mira', role: 'main', summary: 'm', fields: [] }, old166('Captain')], ['Captain', 'Mira'], 'd2'); await M.primeBooks(c);
        assert.deepEqual(M.dedupeFilled(c), [], '같은 직함의 다른 사람(Joon) 프로필이 없으면 — 그 사람일 수 있어 그대로'); }
    { const c = mkd([{ name: 'Bo', role: 'main', summary: 'b', fields: [] }, { ...old166('Warden'), blFill: 1, summary: 'edited later' }], ['Warden'], 'd3'); await M.primeBooks(c);
        assert.deepEqual(M.dedupeFilled(c), ['Warden'], '한 명 직함 · 표식 있음(요약을 바꿨어도)'); }
    { const user = { name: 'Warden', role: 'npc', summary: 'My own note.', fields: [], home: '', sched: '' };
        const c = mkd([{ name: 'Bo', role: 'main', summary: 'b', fields: [] }, user], ['Warden'], 'd4'); await M.primeBooks(c);
        assert.deepEqual(M.dedupeFilled(c), [], '사용자가 쓴 프로필(표식 없고 1.6.6 꼴이 아님) — 그대로'); }
    { const ai = { name: 'Warden', role: 'npc', summary: 'Boss — Kind to her.', fields: [{ k: 'Job', v: 'Guard' }] };
        const c = mkd([{ name: 'Bo', role: 'main', summary: 'b', fields: [] }, ai], ['Warden'], 'd5'); await M.primeBooks(c); assert.deepEqual(M.dedupeFilled(c), [], '칸이 있는 프로필(AI · 사용자) — 그대로'); }
    { const c = mkd([{ name: 'Ria', role: 'main', summary: 'r', fields: [] }, old166('Keeper')], ['Keeper'], 'd6'); await M.primeBooks(c);
        assert.deepEqual(M.dedupeFilled(c), [], '사람 없는 설정 항목에도 나오는 낱말 — 그대로'); }
    { const c = mkd([{ name: 'Bo', role: 'main', summary: 'b', fields: [] }, old166('Warden')], ['Warden'], 'd7'); c.loadWorldInfo = async () => null; await M.primeBooks(c);
        assert.deepEqual(M.dedupeFilled(c), [], '로어북이 없으면 안 지워요'); }
    { const c = mkd([{ name: 'Mira', role: 'main', summary: 'm', fields: [] }, old166('Kai')], ['Kai'], 'd8'); await M.primeBooks(c); assert.deepEqual(M.dedupeFilled(c), [], '상관없는 사람 — 그대로'); }
    const toasts = []; let refreshed = 0;
    const c = mkd([{ name: 'Bo', role: 'main', summary: 'b', fields: [] }, old166('Warden')], ['Warden'], 'd9');
    assert.deepEqual(await M.cleanupDupes({ c, toast: { info: m => toasts.push(m) }, core: { app: { refreshNow: () => refreshed++ } } }), ['Warden']);
    assert.equal(c.saved, 1); assert.equal(refreshed, 1); assert.match(toasts[0], /블루레몬이 더했던 프로필 1개를 정리했어요\(Warden\)\. 직접 만든 프로필은 그대로예요\./);
    assert.deepEqual(await M.cleanupDupes({ c, toast: { info: m => toasts.push(m) }, core: null }), [], '채팅마다 한 번'); assert.equal(toasts.length, 1);
});
await ok('1.6.8 진짜 모델 시험에서 찾은 것: 앞 판 상태창에 직함이 이름으로 남아 있어도(직함 줄 · 이름 줄 둘 다) 둘 이상 사람 항목에 나오는 낱말은 이름으로 안 넘겨요 · 자기 항목에만 나오는 이름은 그대로 · 후보 둘이면 바꾸지 않고 알림에 후보를 적어요', async () => {
    const base = { data: { rel: { user: [{ name: 'Captain' }, { name: 'Mira' }, { name: 'Joon' }, { name: 'Bo' }] } } };
    const sets = M.keySets([LORE], base);
    assert.deepEqual([...M.knownNames(loreCtx(), base, sets).values()], ['Mira', 'Joon', 'Bo', 'Narrator'], '두 사람 항목에 나오는 낱말(직함)은 빼요');
    assert.deepEqual([...M.knownNames(loreCtx(), base, sets, { cards: false }).values()], ['Mira', 'Joon', 'Bo']);
    assert.deepEqual([...M.knownNames(loreCtx(), base).values()], ['Captain', 'Mira', 'Joon', 'Bo', 'Narrator'], '열쇠 묶음이 없으면 예전 그대로');
    const op = (...ops) => ({ statussim: { bySwipe: { 0: ops } } });
    const c = loreCtx({ getCurrentChatId: () => 'r1', chat: [{ name: 'A', mes: 'a', swipe_id: 0, extra: op(['aff', 'Captain +5']) }], chatMetadata: { statussim: { base } } }); await M.primeBooks(c);
    const t = M.opsLedger(c).text;
    assert.ok(t.includes('"Captain" (a title or nickname shared in the lorebook by Mira, Joon') && t.includes('never in the name: Mira, Joon, Bo\n'), t);
    const toasts = []; const toast = { success: m => toasts.push(m), info: m => toasts.push(m) };
    setTimeout(() => { c.chatMetadata.statussim.base = { data: { rel: { user: [{ name: 'Captain', aff: 5, trust: 0, stage: 0 }, { name: 'Mira', aff: 0, trust: 0, stage: 0 }, { name: 'Bo', aff: 0, trust: 0, stage: 0 }] } } }; }, 10);
    const res = await M.afterWizard({ before: base, level: 'all', c, toast, waitMs: 500, step: 5, core: null });
    assert.deepEqual(res.renamed, []); assert.deepEqual(res.renamed.unsure, [{ name: 'Captain', of: ['Mira', 'Joon'] }]);
    assert.equal(c.chatMetadata.statussim.base.data.rel.user[0].name, 'Captain', '후보 둘(한 명은 새 상태창에 없어도) — 그대로');
    assert.match(toasts.at(-1), /「Captain」는 여러 사람의 직함이라\(후보 Mira · Joon\) 누구인지 몰라 그대로 뒀어요 — 미트볼에서 이름을 고쳐 주세요\.$/);
});
await ok('1.6.8 재현에서 찾은 것: 중복 정리 알림은 채팅마다 한 번(같은 프로필이 되살아나 다시 지워도 · 동시에 둘이 불려도) · 바로잡기 알림의 시간대는 화면이 한국어면 한국어로 · 조사 맞춤', async () => {
    const old166 = n => ({ name: n, role: 'npc', summary: 'Boss — Kind to her.', fields: [], home: '', sched: '' });
    const c = loreCtx({ getCurrentChatId: () => 'once-1', saveMetadata() { }, chatMetadata: { statussim: { base: { data: { profile: { list: [{ name: 'Bo', role: 'main', summary: 'b', fields: [] }, old166('Warden')] }, rel: { user: [{ name: 'Warden', label: 'Boss', memo: 'Kind to her.' }] } } } } } });
    const toasts = []; const toast = { info: m => toasts.push(m) };
    const [a, b] = await Promise.all([M.cleanupDupes({ c, toast, core: null }), M.cleanupDupes({ c, toast, core: null })]);
    assert.deepEqual([a, b], [['Warden'], []], '동시에 불려도 한 번만 정리');
    c.chatMetadata.statussim.base.data.profile.list.push(old166('Warden'));   // 그 확장이 화면 자료로 되살린 때
    assert.deepEqual(await M.cleanupDupes({ c, toast, core: null, force: true }), ['Warden'], '되살아나면 다시 정리하되');
    assert.equal(toasts.length, 1, '알림은 한 번만');
    const ko = { getCurrentLocale: () => 'ko-kr' }, en = { getCurrentLocale: () => 'en-us' };
    assert.deepEqual(['Morning', 'Late Night', 'Evening', 'Noon', '밤', 'Teatime'].map(t => M.timeLabel(t, ko)), ['아침', '심야', '저녁', '낮', '밤', 'Teatime']);
    assert.equal(M.timeLabel('Morning', en), 'Morning', '한국어 화면이 아니면 그대로');
    const op = (...ops) => ({ statussim: { bySwipe: { 0: ops } } });
    const T = ['Dawn', 'Morning', 'Night'];
    const cx = { getCurrentLocale: () => 'ko-kr', chat: [{ name: 'A', mes: 'a', swipe_id: 0, extra: op(['period', 'Night -> Morning'], ['aff', 'Mira +1']) }], chatMetadata: { statussim: { base: { data: { calendar: { time: 'Night', times: T }, rel: { user: [{ name: 'Mira', aff: 5, trust: 0, stage: 0 }] } } } } } };
    const before = cx.chatMetadata.statussim.base; setTimeout(() => { cx.chatMetadata.statussim.base = structuredClone(before); }, 10);
    const tt = []; await M.afterWizard({ before, level: 'all', c: cx, toast: { info: m => tt.push(m), success: m => tt.push(m) }, waitMs: 500, step: 5, core: null });
    assert.match(tt.at(-1), /시간대도 채팅의 마지막 시간대 「아침」으로 맞췄어요\./); assert.equal(cx.chatMetadata.statussim.base.data.calendar.time, 'Morning', '달력 값은 그 확장 이름 그대로');
});
await ok('1.6.9 이미 만든 상태창의 직함 줄 · 이름 줄 합치기: 직함이 두 사람 항목에 나와도 관계 칸 자기 글에 그 직함이 든 사람이 정확히 하나면 그 사람 · 그 확장 「합치기」 기록 그대로 · 채팅마다 한 번 · 다른 사람은 안 합쳐요', async () => {
    const rel = (n, label, memo, aff = 0, trust = 0) => ({ name: n, label, memo, aff, trust, stage: -1, met: '', bond: false });
    const filled = (r) => ({ name: r.name, role: 'npc', summary: `${r.label} — ${r.memo}`, fields: [], home: '', sched: '' });
    const pro = (n, summary) => ({ name: n, role: 'main', summary, fields: [{ k: 'Age', v: '30' }] });
    // 지어낸 자료: Captain(직함 줄) · Mira(진짜 이름 줄 — 메모에 「Captain」) · Joon(예전 Captain — 프로필 요약에만) · Pip(Mira 항목에 든 고양이)
    const mk = (over = {}, id = 'm' + Math.random()) => {
        const cap = rel('Captain', 'Boss', 'Her kind, distracted boss.', 15, 13);
        const user = over.rel || [cap, rel('Joon', 'Old Guard', 'Gave her a honey drop.', 0, 8), rel('Pip', '', "Mira's two-tailed cat.", 0, 0), rel('Mira', '', 'Gentle director, called only "Captain" by the staff.', 0, 0)];
        const prof = over.prof || [{ name: 'Me', role: 'user', summary: 'Mira the Captain\'s secretary.' }, pro('Mira', 'Gentle director known as the Captain.'), pro('Joon', 'Former Captain, now an adviser.'), filled(cap)];
        return loreCtx({ getCurrentChatId: () => id, saveMetadata() { this.saved = (this.saved || 0) + 1; }, chat: [{}, {}, {}], chatMetadata: { statussim: { base: { data: { rel: { user, pairs: [{ a: 'Bo', b: 'Captain' }] }, profile: { list: prof } } }, adjust: over.adjust || [], tr: { Captain: '캡틴', Mira: '미라' } } }, ...(over.ctx || {}) });
    };
    { const c = mk(); await M.primeBooks(c);
        assert.deepEqual(M.titleMerges(c), [{ from: 'Captain', to: 'Mira' }], 'Joon 요약의 「Former Captain」 은 안 봐요(관계 칸 자기 글만)');
        assert.deepEqual(M.mergeTitles(c, { now: () => 1000 }), [{ from: 'Captain', to: 'Mira' }]);
        assert.deepEqual(c.chatMetadata.statussim.adjust, [{ at: 3, t: 1000, ops: [['_merge', 'Captain => Mira']], label: '🔗 Captain → Mira 합침' }], '그 확장 「합치기」 단추와 같은 기록(메시지에 안 묶음)');
        assert.deepEqual(M.titleMerges(c), [], '이미 합친 이름은 다시 안 합쳐요'); }
    { const c = mk({ rel: [rel('Captain', 'Boss', 'Her boss.'), rel('Joon', 'Old Guard', 'The old Captain, still proud.'), rel('Mira', '', 'Called "Captain" by staff.')] }); await M.primeBooks(c);
        assert.deepEqual(M.titleMerges(c), [], '두 후보 다 자기 글에 그 직함 — 못 정해요'); }
    { const c = mk({ rel: [rel('Captain', 'Boss', 'Her boss.'), rel('Joon', 'Old Guard', 'x'), rel('Mira', '', 'Director.')] }); await M.primeBooks(c);
        assert.deepEqual(M.titleMerges(c), [], '자기 글에 그 직함이 든 후보가 없으면 그대로'); }
    { const c = mk({ rel: [rel('Pip', '', "Mira's cat."), rel('Mira', '', 'Owns Pip, a cat.')] }); await M.primeBooks(c);
        assert.deepEqual(M.titleMerges(c), [], '그 줄 글에 후보 이름이 나오면(후보의 고양이) — 다른 이라 안 합쳐요'); }
    { const c = mk({ rel: [rel('Keeper', '', 'x'), rel('Ria', '', 'The Keeper of the docks.')] }); await M.primeBooks(c);
        assert.deepEqual(M.titleMerges(c), [], '사람 없는 설정 항목에도 나오는 낱말 — 그대로'); }
    { const c = mk({ prof: [pro('Captain', 'Real person named Captain.'), pro('Mira', 'm')] }); await M.primeBooks(c);
        assert.deepEqual(M.titleMerges(c), [], '그 이름의 진짜 프로필(사람 · AI 가 쓴 것)이 있으면 그 사람이에요'); }
    { const c = mk({ ctx: { name1: 'Captain' } }); await M.primeBooks(c); assert.deepEqual(M.titleMerges(c), [], '사용자 이름이면 그대로'); }
    { const c = mk(); c.loadWorldInfo = async () => null; await M.primeBooks(c); assert.deepEqual(M.titleMerges(c), [], '로어북이 없으면 그대로'); }
    { const c = mk({ adjust: [{ at: 2, t: 5, set: { mod: 'rel', data: { user: [rel('Captain', 'Boss', 'Her boss.'), rel('Mira', '', 'Known as "Captain".')] } } }] }); await M.primeBooks(c);
        assert.deepEqual(M.titleMerges(c), [{ from: 'Captain', to: 'Mira' }], '칸 통째 편집 기록이 있으면 그 줄로 봐요'); }
    { const c = mk({ adjust: [{ at: 2, t: 5, set: { mod: 'rel', data: { user: [rel('Mira', '', 'x')], alias: { captain: 'Mira' } } } }] }); await M.primeBooks(c);
        assert.deepEqual(M.titleMerges(c), [], '그 확장 이름 표에 이미 있으면(합친 뒤) 그대로'); }
    // 채팅을 열 때: 중복 프로필 정리 + 합치기 · 저장 · 새로고침 · 알림 한 번(화면 번역 이름으로)
    const c = mk({}, 'open-1'); const toasts = []; let refreshed = 0;
    const gone = await M.cleanupDupes({ c, toast: { info: m => toasts.push(m) }, core: { app: { refreshNow: () => refreshed++ } } });
    assert.deepEqual([...gone], ['Captain'], '블루레몬이 더한 Captain 프로필도 정리'); assert.deepEqual(gone.merged, [{ from: 'Captain', to: 'Mira' }]);
    assert.equal(c.saved, 1); assert.equal(refreshed, 1); assert.equal(toasts.length, 2);
    assert.match(toasts[1], /^관계 칸에 같은 사람이 직함 줄과 이름 줄로 나뉘어 있어 합쳤어요\(캡틴 → 미라\)\. 미트볼 「합치기」 와 같아요 — 애정 · 우정은 두 줄을 더하고, 앞으로 「캡틴」으로 적힌 변화도 그 사람에게 가요\. 관리 탭 되돌리기로 되돌릴 수 있어요\.$/);
    assert.deepEqual(await M.cleanupDupes({ c, toast: { info: m => toasts.push(m) }, core: null }), [], '채팅마다 한 번'); assert.equal(toasts.length, 2);
    assert.equal(c.chatMetadata.statussim.base.data.rel.user.length, 4, '기준 자료의 줄은 그대로(합치기는 그 확장이 계산할 때 — 되돌릴 수 있게)');
});
await ok('버그 사냥 9: 합치기를 사용자가 되돌리면(그 확장이 기록을 뺌) 다음에 채팅을 열어도 · 만들기 뒤에도 다시 안 합쳐요 · 장부는 채팅 메타데이터에', async () => {
    const rel = (n, label, memo) => ({ name: n, label, memo, aff: 0, trust: 0, stage: -1 });
    const c = loreCtx({ getCurrentChatId: () => 'undo-1', chat: [{}, {}], saveMetadata() { }, chatMetadata: { statussim: { base: { data: { rel: { user: [rel('Captain', 'Boss', 'x'), rel('Joon', 'Guard', 'y'), rel('Mira', '', 'Called "Captain" by staff.')] }, profile: { list: [] } } }, adjust: [] } } });
    await M.primeBooks(c);
    assert.deepEqual(M.mergeTitles(c, { now: () => 1 }), [{ from: 'Captain', to: 'Mira' }]);
    assert.deepEqual(c.chatMetadata.bl_mb_merged, ['Captain']);
    c.chatMetadata.statussim.adjust.splice(0, 1);   // 그 확장 되돌리기(undoAt · undoLast)는 기록을 통째로 빼요
    assert.deepEqual(M.titleMerges(c), [], '되돌린 합치기는 다시 안 해요');
    assert.deepEqual(M.mergeTitles(c), []); assert.equal(c.chatMetadata.statussim.adjust.length, 0);
});
await ok('버그 사냥 9: 로어북을 받는 사이 채팅이 바뀌면(같은 캐릭터 · 다른 채팅 로어북) 받은 것을 새 채팅 것으로 남기지 않아요 — 앞 채팅 로어북으로 새 채팅 사람을 합치던 것', async () => {
    const rel = (n, label, memo) => ({ name: n, label, memo, aff: 0, trust: 0, stage: -1 });
    let cur = 'race-a', release; const gate = new Promise(r => { release = r; });
    const books = { 'card-z': { entries: {} }, 'chat-a': { entries: { 0: { key: ['Captain', 'Mira'] }, 1: { key: ['Captain', 'Joon'] } } }, 'chat-b': { entries: {} } };
    const mk = wi => ({ characterId: 0, characters: [{ name: 'Narrator', avatar: 'n.png', data: { extensions: { world: 'card-z' } } }], getCurrentChatId: () => cur, name1: 'Me', chat: [{}, {}],
        loadWorldInfo: async n => { if (n === 'chat-a') await gate; return structuredClone(books[n]); },
        chatMetadata: { world_info: wi, statussim: { base: { data: { rel: { user: [rel('Captain', 'Boss', 'x'), rel('Joon', 'Guard', 'y'), rel('Mira', '', 'Called "Captain" by staff.')] }, profile: { list: [] } } }, adjust: [] } } });
    const a = mk('chat-a'), p = M.primeBooks(a);
    cur = 'race-b'; const b = mk('chat-b');
    release(); await p;
    assert.deepEqual(M.titleMerges(b), [], 'B 채팅에는 그 로어북이 없어요 — 안 합쳐요');
    await M.primeBooks(b); assert.deepEqual(M.titleMerges(b), [], 'B 로어북으로 받으면 그대로');
});
await ok('버그 사냥 9: 채팅 열 때 정리가 기다리는 사이 채팅이 바뀌면 그만두고(앞 채팅 자료를 고쳐 놓고 새 채팅을 저장 · 알리던 것) 그 채팅을 다시 열면 해요', async () => {
    const old166 = n => ({ name: n, role: 'npc', summary: 'Boss — Kind to her.', fields: [], home: '', sched: '' });
    let cur = 'tidy-a', release; const gate = new Promise(r => { release = r; });
    const c = loreCtx({ getCurrentChatId: () => cur, saveMetadata() { this.saved = (this.saved || 0) + 1; }, loadWorldInfo: async n => { await gate; return n === 'book-a' ? structuredClone(LORE) : null; },
        chatMetadata: { statussim: { base: { data: { profile: { list: [{ name: 'Bo', role: 'main', summary: 'b', fields: [] }, old166('Warden')] }, rel: { user: [{ name: 'Warden', label: 'Boss', memo: 'Kind to her.' }] } } } } } });
    const toasts = []; const p = M.cleanupDupes({ c, toast: { info: m => toasts.push(m) }, core: null });
    await new Promise(r => setTimeout(r, 5)); cur = 'tidy-b'; release();
    assert.deepEqual([...await p], [], '바뀐 뒤엔 손대지 않아요'); assert.equal(c.saved, undefined); assert.equal(toasts.length, 0);
    assert.deepEqual(c.chatMetadata.statussim.base.data.profile.list.map(x => x.name), ['Bo', 'Warden']);
    cur = 'tidy-a'; assert.deepEqual([...await M.cleanupDupes({ c, toast: { info: m => toasts.push(m) }, core: null })], ['Warden'], '다시 열면 정리해요');
});
await ok('버그 사냥 9: 만들기 창을 닫고 곧 다른 채팅으로 가거나 · 채팅을 바꿔 창이 치워지면 그 채팅 상태창을 「새로 적용됨」 으로 보고 고치지 않아요', async () => {
    const op = (...ops) => ({ statussim: { bySwipe: { 0: ops } } });
    const baseA = { data: { rel: { user: [{ name: 'Mira', aff: 0, trust: 0, stage: 0 }] } } };
    const mkc = (id, base, ops) => ({ getCurrentChatId: () => id, chat: [{ name: 'x', mes: 'a', swipe_id: 0, extra: op(ops) }], chatMetadata: { statussim: { base } }, saveMetadata() { this.saved = 1; } });
    const cA = mkc('aw-a', baseA, ['aff', 'Mira +3']);
    const kai = () => ({ data: { rel: { user: [{ name: 'Kai', aff: 2, trust: 0, stage: 3 }] } } });
    const keep = globalThis.SillyTavern; const toast = { success() { }, info() { } };
    try {
        { const cB = mkc('aw-b', kai(), ['aff', 'Kai +40']); let cur = cA; globalThis.SillyTavern = { getContext: () => cur };
            setTimeout(() => { cur = cB; }, 20);
            assert.equal(await M.afterWizard({ before: baseA, level: 'all', toast, waitMs: 300, step: 5, core: null }), null, '기다리는 사이 다른 채팅으로');
            assert.deepEqual([cB.chatMetadata.statussim.base.data.rel.user[0].aff, cB.saved], [2, undefined]); }
        { const cB = mkc('aw-b', kai(), ['aff', 'Kai +40']); globalThis.SillyTavern = { getContext: () => cB };
            assert.equal(await M.afterWizard({ before: baseA, level: 'all', chat: M.chatKey(cA), toast, waitMs: 50, step: 5, core: null }), null, '부를 때 이미 다른 채팅(창이 채팅 바꾸기로 치워짐)');
            assert.equal(cB.chatMetadata.statussim.base.data.rel.user[0].aff, 2); }
        { let cur = cA; globalThis.SillyTavern = { getContext: () => cur };
            setTimeout(() => { cA.chatMetadata.statussim.base = { data: { rel: { user: [{ name: 'Mira', aff: 0, trust: 0, stage: 0 }] } } }; }, 10);
            const r = await M.afterWizard({ before: baseA, level: 'all', chat: M.chatKey(cA), toast, waitMs: 300, step: 5, core: null });
            assert.deepEqual(r.changed.map(x => x.to), [[3, 0]], '같은 채팅에서 적용되면 그대로 바로잡아요'); }
    } finally { globalThis.SillyTavern = keep; }
});
console.log(`mb-prompt: ${n}개 통과`);
