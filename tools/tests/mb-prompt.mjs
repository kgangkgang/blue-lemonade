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
    assert.ok(set.includes("s.chat.mbPrompt = 'off'") && set.includes("mbPrompt: 'off', mbPromptCount: 9, mbPromptChars: 2000, mbPromptCap: 120000,"));
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
    assert.ok(set.includes("range('mbPromptCap', 0, 1000000, 120000)") && set.includes("'recent', 'all'].includes(s.chat.mbPrompt)"));
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
console.log(`mb-prompt: ${n}개 통과`);
