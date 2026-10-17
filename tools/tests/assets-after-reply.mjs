// 테마 6.1.9 (캐릭터 에셋 1.6.0) 답장 뒤 다른 모델이 고르기 — 자리 고르기 · 넣기 · 고르는 글 · 대답 읽기 · 기록 · 화면 상태 · 연결 판정.
// slots.js 는 그대로, pick.js 는 실리태번 모듈만 흉내 내서 (계정 · 키 · 사용자 데이터 없음, 요청 0).
//   node tools/tests/assets-after-reply.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(theme, rel), 'utf8');
const url = rel => pathToFileURL(path.join(theme, rel)).href;
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;

const S = await import(url('src/addons/assets/slots.js'));
const RW = await import(url('src/addons/rewrite/core.js'));
const TX = await import(url('src/addons/tts/src/text.js'));

// pick.js 가 읽는 실리태번 모듈 흉내
const T = globalThis.__assetsPickTest = { ext: { salty: { addons: { assets: true }, usageMode: 'both' }, esetham: {} }, secrets: {}, oai: { custom_url: '' }, profiles: [] };
const G = 'const T=globalThis.__assetsPickTest;';
const stubs = {
    'script.js': data('export const getRequestHeaders=()=>({}); export const substituteParams=t=>String(t??""); export function saveSettingsDebounced(){} export function extractMessageFromData(d){return d?.content?.filter?.(p=>p.type==="text")?.map(p=>p.text)?.join("\\n\\n")??d?.choices?.[0]?.message?.content??"";}'),
    'extensions.js': data(G + 'export const extension_settings=T.ext; export const getContext=()=>({});'),
    'custom-request.js': data('export const ChatCompletionService={async processRequest(){throw Error("Unexpected request")}};'),
    'openai.js': data(G + 'export const oai_settings=T.oai;'),
    'secrets.js': data(G + 'export const SECRET_KEYS={OPENAI:"api_key_openai",CLAUDE:"api_key_claude",CUSTOM:"api_key_custom"}; export const secret_state=T.secrets;'),
    'shared.js': data(G + 'export const ConnectionManagerRequestService={getSupportedProfiles:()=>T.profiles,async sendRequest(){throw Error("Unexpected request")}};'),
};
register(data(`let D;export function initialize(d){D=d}export async function resolve(spec,ctx,next){const base=spec.split('/').pop();if(String(ctx.parentURL||'').includes('/addons/assets/')&&spec.startsWith('../../../')&&D[base])return {url:D[base],shortCircuit:true};return next(spec,ctx)}`), { data: stubs });
const P = await import(url('src/addons/assets/pick.js'));
const ST = await import(url('src/addons/assets/state.js'));

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }

const REPLY = [
    '<tracker> 🌃 11:34 PM | Bedroom | Clear </tracker>', '', '<prose>',
    'The plan lasts forty minutes.', '',
    'He pushes the blanket off his face.', '',
    '<true_thoughts character="Z">無理。</true_thoughts>', '',
    'He props himself up and listens.', '',
    '<span style="color:#3ccfbf">「……お前……」</span>', '',
    'He whispers it like a scolding.', '',
    '<quiet><span style="color:#e6a">「静かに」</span></quiet>', '',
    'He wraps his hand around the mug.', '',
    '“Fine,” she said.', '</prose>',
].join('\n');
const AUTOPIC = '<span class="autopic-image-slot" data-autopic-slot="ap-1">[AutoPic 이미지]</span>';
let seq = 0;
const ids = () => `as${String(++seq).padStart(3, '0')}`;

// ---------- 경계 · 대사
await test('boundaries: only blank lines inside <prose>, outside other tags, between two paragraphs of text', () => {
    const b = S.paragraphBoundaries(REPLY);
    assert.equal(b.length, 8);
    assert.ok(b.every(x => x.at > REPLY.indexOf('<prose>') && x.at < REPLY.indexOf('</prose>')), 'the tracker before <prose> is not a candidate');
    assert.deepEqual(S.paragraphBoundaries('<details>\nA\n\nB\n</details>\n\nC'), [{ at: '<details>\nA\n\nB\n</details>'.length, next: 'C' }], 'not inside an open tag');
    assert.equal(S.paragraphBoundaries('A\n\n```\nx\n\ny\n```\n\nB').length, 2, 'not inside a code fence');
    assert.equal(S.paragraphBoundaries(`A\n\n${AUTOPIC}\n\nB`).length, 0, 'a paragraph that is only a picture slot is neither before nor after');
});
// 6.5.3 과일 답: 상태창 + <content>…</content> — 예전엔 안쪽 경계가 모두 「태그 안」이라 상태창 뒤 한 자리만 (설정 4장 → 1장)
await test('Fruit replies: boundaries inside <content>, not the status bar; four slots before dialogue', () => {
    const fruit = ['<status_bar>', '日期：10月14日', '', '时间：07:55', '</status_bar>', '', '<content>',
        'The fork paused.', '', '<excited><span style="color:#424C59">「私、」</span></excited>', '', 'He nodded.', '',
        '<span style="color:#e63946">「ええ」</span>', '', 'She laughed.', '', '<span style="color:#424C59">「へへ」</span>', '',
        'He sipped.', '', '<span style="color:#e63946">「です」</span>', '', 'Morning.', '</content>'].join('\n');
    const b = S.paragraphBoundaries(fruit);
    assert.equal(b.length, 8);
    assert.ok(b.every(x => x.at > fruit.indexOf('<content>') && x.at < fruit.indexOf('</content>')), 'only inside <content>');
    const spots = S.slotSpots(fruit, 4);
    assert.equal(spots.length, 4);
    assert.ok(spots.every(at => S.isDialogueStart(b.find(x => x.at === at).next)), 'every slot is before a line of dialogue');
});
await test('dialogue starts: brackets, quotes, colour spans (also inside <quiet>), font colour, name: 「, Deus #hex; not thoughts or narration', () => {
    for (const yes of ['「hi」', '『hi』', '“Fine,” she said.', '"Hey."', '<span style="color:#3ccfbf">「……」</span>', '<quiet><span style="color:#e6a">「静かに」</span></quiet>',
        '<font color="#f00">"x"</font>', '*<span style="color: red">「x」</span>*', '미나: 「안녕」', '미나「안녕」', '#e63946 "Look."', '<shout>“Run!”</shout>']) assert.ok(S.isDialogueStart(yes), yes);
    for (const no of ['He nodded.', '<true_thoughts character="Z">無理。</true_thoughts>', '<think>plan</think>', '*He sighs.*', '<span class="x">text</span>', '', '   ']) assert.ok(!S.isDialogueStart(no), JSON.stringify(no));
});
await test('slotSpots: evenly among dialogue boundaries, 1–4, all boundaries when no dialogue, none when no boundary', () => {
    const b = S.paragraphBoundaries(REPLY), dialogue = b.filter(x => S.isDialogueStart(x.next)).map(x => x.at);
    assert.equal(dialogue.length, 3);
    assert.deepEqual(S.slotSpots(REPLY, 2), [dialogue[0], dialogue[1]]);
    assert.deepEqual(S.slotSpots(REPLY, 1), [dialogue[1]], 'one picture goes to the middle dialogue');
    assert.deepEqual(S.slotSpots(REPLY, 9), dialogue, 'clamped to 4 and never more than there are spots');
    assert.deepEqual(S.slotSpots(REPLY, 0), [dialogue[1]], 'below 1 → 1');
    const narration = 'A.\n\nB.\n\nC.\n\nD.';
    assert.equal(S.slotSpots(narration, 2).length, 2, 'no dialogue → among all boundaries');
    assert.deepEqual(S.slotSpots('One paragraph only.', 2), []);
    assert.deepEqual(S.slotSpots(`A.\n\n${AUTOPIC}\n\n「hi」`, 2), [], 'never next to a picture slot');
});

// ---------- 넣기 · 고르는 글
await test('insertSlots puts each slot as its own paragraph, ids in text order; every reader sees the same markup', () => {
    seq = 0;
    const spots = S.slotSpots(REPLY, 2);
    const { text, ids: made } = S.insertSlots(REPLY, spots, ids);
    assert.deepEqual(S.slotIds(text), made);
    for (const id of made) assert.ok(text.includes(`\n\n${S.slotMarkup(id)}\n\n`), 'own paragraph');
    assert.equal(text.replace(/<span class="bl-asset-slot" data-asset-slot="[\w-]+"><\/span>\n\n/g, ''), REPLY, 'nothing else changed');
    assert.equal((text.match(S.PROTECT_RE) || []).length, 2, 'the translator protect rule matches the markup');
    assert.equal((text.match(RW.SLOT_RE) || []).length, 2, 'the rewrite add-on masks it as a picture slot');
    assert.equal((text.match(TX.SLOT_RE) || []).length, 2, 'TTS blanks it');
    assert.equal(S.slotSpots(text, 2).filter(at => !spots.includes(at)).length >= 0, true);
});
await test('markedReply marks the slots to fill in order and drops other picture slots', () => {
    const text = `A.\n\n${S.slotMarkup('x1')}\n\n「hi」\n\n${AUTOPIC}\n\nB.\n\n${S.slotMarkup('x2')}\n\n“yo”\n\n${S.slotMarkup('old')}\n\nC.`;
    const out = S.markedReply(text, ['x1', 'x2']);
    assert.equal(out, 'A.\n\n[ASSET 1]\n\n「hi」\n\nB.\n\n[ASSET 2]\n\n“yo”\n\nC.');
});
await test('pickPrompt: rules, list, marker count and answer format; no slot markup sent; previous message trimmed', () => {
    const [system, user] = S.pickPrompt({ rules: S.rulesForPicker('Use {{img_keywords_autogen}} for {{charkey}}.', 'Mina'), list: 'Mina_smile.png, Mina_angry.png', reply: 'A.\n\n[ASSET 1]\n\n「hi」\n\n[ASSET 2]\n\n“yo”', count: 2, previous: `Go.\n\n${AUTOPIC}`, character: 'Mi"na' });
    assert.match(system.content, /2 markers, \[ASSET 1\] to \[ASSET 2\]/);
    assert.match(system.content, /<available_images>\nMina_smile\.png, Mina_angry\.png\n<\/available_images>/);
    assert.match(system.content, /Use \(see <available_images>\) for Mina\./, 'the list is not sent twice');
    assert.match(system.content, /1: filename\.ext\n2: filename\.ext\nWrite none in place of a file name only when no character from <available_images> is in that moment\.$/, '6.4.1 every example is a file name; none only below');
    assert.match(system.content, /Give every marker an image while a character from <available_images> is in the scene\./, '6.4.1 fill the markers');
    assert.match(system.content, /If the speaker has no images, pick the character from <available_images> they talk to or who reacts\./);
    assert.doesNotMatch(system.content, /If no image clearly fits, answer none\./, 'the old easy way out is gone');
    assert.doesNotMatch(system.content, /The user's own character/, 'no persona line without a persona name');
    const withPersona = S.pickPrompt({ list: 'Mina_smile.png', reply: 'x', persona: ' Rowan\n' })[0].content;
    assert.match(withPersona, /The user's own character is Rowan\. When they speak, pick one of their images if <available_images> has any; otherwise pick the character from <available_images> who listens or reacts in that moment\./);
    assert.match(read('src/addons/assets/after-reply.js'), /persona: context\.name1 \|\| '',/);
    assert.ok(!JSON.stringify([system, user]).includes('autopic') && !JSON.stringify([system, user]).includes('data-asset-slot'));
    assert.match(user.content, /<previous_message>\nGo\.\n<\/previous_message>/);
    assert.match(user.content, /<finished_reply speaker="Mina">/);
    assert.match(S.pickPrompt({ reply: 'x', count: 1 })[0].content, /one marker, \[ASSET 1\],/);
});
await test('parsePicks: n: name / none, {{img::}} and quotes stripped, the last answer wins, thinking ignored, missing → null', () => {
    assert.deepEqual(S.parsePicks('1: Mina_smile.png\n2: none', 2), ['Mina_smile.png', '']);
    assert.deepEqual(S.parsePicks('<think>1: Mina_cry.png</think>\nmaybe 1: x\n1: {{img::Mina_smile.png}}\n2. "Mina_angry.webp".', 3), ['Mina_smile.png', 'Mina_angry.webp', null]);
    assert.deepEqual(S.parsePicks('[ASSET 1]: `Mina_a.png`\nASSET 2) 없음\n5: Mina_x.png', 2), ['Mina_a.png', '']);
    assert.deepEqual(S.parsePicks('Sorry, no images.', 2), [null, null]);
    assert.deepEqual(S.parsePicks('- 1: Mina_b.png', 1), ['Mina_b.png']);
});

// ---------- 기록 · 화면
await test('recordsFromPicks: known names kept, unknown → nothing (asked noted), a repeat without variants → nothing, missing → error', () => {
    const info = name => ({ 'mina_smile.png': { file: 'Mina_smile.png', variants: false }, 'mina_cry': { file: 'Mina_cry-1.png', variants: true } })[name.toLowerCase()] ?? null;
    const r = S.recordsFromPicks(['a', 'b', 'c', 'd', 'e', 'f'], ['Mina_smile.png', 'mina_smile.png', 'Mina_cry', 'Mina_cry', 'Nope.png', null], info);
    assert.deepEqual(r.a, { name: 'Mina_smile.png', pending: false });
    assert.deepEqual(r.b, { name: '', pending: false, repeat: 'Mina_smile.png' });
    assert.equal(r.c.name, 'Mina_cry-1.png'); assert.equal(r.d.name, 'Mina_cry-1.png', 'a group with variants may appear twice');
    assert.deepEqual(r.e, { name: '', pending: false, asked: 'Nope.png' });
    assert.deepEqual(r.f, { name: '', pending: false, error: 'missing' });
    assert.deepEqual(S.recordsFromPicks(['x'], [''], info).x, { name: '', pending: false });
});
await test('writeRecords: current swipe → extra and its swipe_info mirror; another swipe → only that swipe_info; slots gone from the text are pruned', () => {
    const mes = { mes: `A\n\n${S.slotMarkup('s1')}\n\nB`, swipe_id: 1, swipes: ['old', `A\n\n${S.slotMarkup('s1')}\n\nB`], swipe_info: [{ extra: {} }, { extra: {} }], extra: { [S.RECORD_KEY]: { gone: { name: 'x' } } } };
    S.writeRecords(mes, 1, { s1: { name: '', pending: true } });
    assert.deepEqual(mes.extra[S.RECORD_KEY], { s1: { name: '', pending: true } }, 'the old record is pruned');
    assert.deepEqual(mes.swipe_info[1].extra[S.RECORD_KEY], { s1: { name: '', pending: true } });
    assert.notEqual(mes.swipe_info[1].extra[S.RECORD_KEY], mes.extra[S.RECORD_KEY], 'separate objects');
    mes.swipe_id = 0; mes.mes = 'old';
    S.writeRecords(mes, 1, { s1: { name: 'Mina_smile.png', pending: false } });
    assert.equal(mes.swipe_info[1].extra[S.RECORD_KEY].s1.name, 'Mina_smile.png', 'swiped away → written to that swipe only');
    assert.equal(mes.extra[S.RECORD_KEY].s1.pending, true, 'the shown swipe is untouched');
});
await test('slotView: picture, waiting, interrupted (pending but not running) and failure show a retry, empty shows nothing', () => {
    assert.deepEqual(S.slotView({ name: 'Mina_smile.png' }), { state: 'img', name: 'Mina_smile.png' });
    assert.deepEqual(S.slotView({ name: '', pending: true }, true), { state: 'wait' });
    assert.deepEqual(S.slotView({ name: '', pending: true }, false), { state: 'retry', reason: '고르다 끊겼어요' });
    assert.deepEqual(S.slotView({ name: '', pending: false, error: 'missing' }), { state: 'retry', reason: '대답이 모자랐어요' });
    assert.deepEqual(S.slotView({ name: '', pending: false, error: '시간 안에 답이 없어요' }).state, 'retry');
    assert.deepEqual(S.slotView({ name: '', pending: false }), { state: 'none' });
    assert.deepEqual(S.slotView(undefined), { state: 'none' });
});

// ---------- 연결 판정 (pick.js)
await test('pickActive: off by default; needs the image prompt, the add-on, the switch and a decided direct/profile connection', () => {
    const store = T.ext.esetham;
    ST.normalizePick(store);
    assert.equal(store.pick.enabled, false); assert.equal(store.pick.connection, 'current'); assert.equal(store.pick.count, 2);
    assert.equal(P.pickActive(store), false, 'default off');
    store.pick.enabled = true;
    assert.equal(P.pickActive(store), false, '「지금 연결」 = the main model as before');
    store.pick.connection = 'direct'; store.pick.provider = 'custom'; store.pick.customModels.custom = 'cheap-model'; store.pick.models.custom = 'custom';
    assert.match(P.connectionProblem(store.pick), /Custom 주소/);
    store.pick.customUrl = 'http://127.0.0.1:5001/v1/';
    assert.equal(P.connectionProblem(store.pick), '');
    assert.equal(P.pickActive(store), true);
    assert.equal(P.customEndpoint(store.pick).url, 'http://127.0.0.1:5001/v1', 'trailing slash dropped');
    store.promptEnabled = false; assert.equal(P.pickActive(store), false, 'image prompt off'); store.promptEnabled = true;
    T.ext.salty.addons.assets = false; assert.equal(P.pickActive(store), false, 'add-on off'); T.ext.salty.addons.assets = true;
    store.pick.customUrl = ''; T.oai.custom_url = 'http://127.0.0.1:5002/v1';
    assert.equal(P.connectionProblem(store.pick), '', 'empty address follows SillyTavern\'s Custom address');
    store.pick.provider = 'openai'; store.pick.models.openai = 'gpt-x';
    assert.match(P.connectionProblem(store.pick), /OpenAI API 키/);
    T.secrets.api_key_openai = true; assert.equal(P.connectionProblem(store.pick), '');
    store.pick.connection = 'profile'; assert.match(P.connectionProblem(store.pick), /연결 프로필/);
    store.pick.profileId = 'p1'; T.profiles.push({ id: 'p1', name: 'Cheap' });
    assert.equal(P.pickActive(store), true); assert.equal(P.connectionLabel(store.pick), 'Cheap');
    store.pick.count = 9; ST.normalizePick(store); assert.equal(store.pick.count, 4);
    store.pick = 'broken'; ST.normalizePick(store); assert.equal(store.pick.enabled, false, 'a broken value becomes the defaults');
});

// ---------- 연결 · 원문 검사
await test('wiring: slots are inserted synchronously on MESSAGE_RECEIVED (on, after the rewrite add-on); the main model gets no rules while picking', () => {
    const ar = read('src/addons/assets/after-reply.js');
    assert.match(ar, /eventSource\.on\(event_types\.MESSAGE_RECEIVED, onMessageReceived\)/);
    assert.ok(!/makeFirst\(event_types\.MESSAGE_RECEIVED/.test(ar), 'not before the rewrite add-on');
    const body = ar.slice(ar.indexOf('export function onMessageReceived'), ar.indexOf('void fill(id, message, ids, swipe);'));
    assert.ok(!/\bawait\b/.test(body), 'no await before the slots are in the text');
    assert.match(ar, /protect\?\.\('character-asset-slots', PROTECT_RE, \{ noFold: true \}\)/);
    assert.match(read('src/addons/assets/index.js'), /setupAfterReply\(\);/);
    const prompt = read('src/addons/assets/prompt.js');
    assert.match(prompt, /status\.enabled && !status\.pick && status\.placement === 'auto'/);
    assert.match(prompt, /status\.enabled && !status\.pick && status\.placement === 'manual'/);
});
await test('review 6.1.9: slots never reach the main model; copied slots without a record are dropped; continue/command/extension replies get none; ~~~ fences and CRLF', () => {
    const slot = S.slotMarkup('asabc123');
    const text = `Para one.\n\n${slot}\n\n"Hello."`;
    assert.equal(S.stripSlotsForPrompt(text), 'Para one.\n\n"Hello."', 'the inserted shape goes away whole');
    assert.equal(S.stripSlotsForPrompt(`A ${slot} B`), 'A  B', 'a stray slot inside a line is removed too');
    assert.equal(S.stripSlotsForPrompt('no slots'), 'no slots');
    const copied = S.dropUnknownSlots(text, { asother: { name: '' } });
    assert.deepEqual(copied.unknown, ['asabc123']);
    assert.equal(copied.text, 'Para one.\n\n"Hello."');
    assert.deepEqual(S.dropUnknownSlots(text, { asabc123: { name: 'x.png' } }).unknown, [], 'a slot with a record is ours');
    for (const type of ['continue', 'append', 'appendFinal', 'command', 'extension', 'quiet', 'impersonate', 'first_message']) assert.equal(S.skipReplyType(type), true, type);
    for (const type of ['normal', 'swipe', 'regenerate', '']) assert.equal(S.skipReplyType(type), false, type);
    const fenced = 'Before.\n\n~~~\ncode line\n\n"not dialogue"\n~~~\n\n"Real line."';
    assert.ok(S.paragraphBoundaries(fenced).every(b => !/not dialogue/.test(b.next)), 'no boundary inside a ~~~ block');
    const crlf = 'Narration here.\r\n\r\n"Spoken line."\r\n\r\nMore narration.';
    assert.ok(S.paragraphBoundaries(crlf).length >= 1, 'CRLF blank lines are paragraph boundaries');
    const after = read('src/addons/assets/after-reply.js');
    assert.match(after, /eventSource\.on\(event_types\.CHAT_COMPLETION_PROMPT_READY, stripChatPrompt\)/, 'chat completion prompt is cleaned');
    assert.match(after, /eventSource\.on\(event_types\.GENERATE_AFTER_COMBINE_PROMPTS, stripTextPrompt\)/, 'text completion / generateRaw prompt is cleaned');
    assert.match(after, /dropUnknownSlots\(message\.mes/, 'copied slots are dropped before inserting');
    assert.match(read('src/addons/assets/pick.js'), /getSupportedProfiles\(\)\.some\(p => p\.id === pick\.profileId\)/, 'a deleted profile is a problem');
});
await test('model switch lists the picker connection; version stamps agree; empty slots are hidden by data attribute', () => {
    const targets = read('src/addons/modelswitch/targets.js');
    assert.match(targets, /settings: \(\) => \{ const p = extension_settings\.esetham\?\.pick; return isObj\(p\) && p\.enabled && p\.connection !== 'current' \? p : null; \}/, 'listed only while picking with its own connection (review 6.1.9)');
    assert.match(targets, /const KNOWN = \[translator, translatorFallback, prompt, promptFallback, memory, rewrite, rewriteFallback, assets, assetsFallback\];/);   // 6.2.9 검열되면 다른 모델로
    assert.match(targets, /'esetham'/);
    const v = read('src/addons/assets/state.js').match(/VERSION = '([\d.]+)'/)[1];
    assert.ok(read('src/addons/assets/style.css').includes(`--eh-css-version: "${v}";`));
    assert.equal(v, '1.6.9');
    const css = read('src/addons/assets/style.css');
    assert.ok(css.includes('#chat .mes_text p[data-eh-slot-only]:not(:has(> [data-asset-slot]:not(:empty))) { display: none; }'), 'only a paragraph that holds nothing but slots is hidden');
    assert.ok(!css.includes(':not(:has(> :not([data-asset-slot])))'), 'a paragraph with text is never hidden');
    assert.ok(!/\.bl-asset-slot\b/.test(css), 'never by class (SillyTavern prefixes message classes with custom-)');
    const render = read('src/addons/assets/render.js');
    assert.match(render, /span\[data-asset-slot\]/);
    assert.match(render, /document\.addEventListener\(type, onRetryClick, true\)/, 'retry is taken before TTS taps');
    assert.match(render, /if \(!event\.type\.startsWith\('touch'\)\) event\.preventDefault\(\);/, 'a cancelled touchend would stop the phone click');
    assert.match(render, /if \(!spans\.length \|\| !settings\(\)\.renderEnabled\) return;/, '「채팅에 그림 표시」 off → slots are not drawn');
});
await test('rewrite and TTS treat an asset slot as a picture slot: masked as a break, not a segment, rebased like a slot line', () => {
    const slot = S.slotMarkup('as1');
    const text = `He pushed up his glasses.\n\n${slot}\n\n「hi」`;
    const masked = RW.maskProtected(text);
    assert.equal(masked.length, text.length);
    assert.equal(masked[text.indexOf(slot)], '\n');
    assert.equal(RW.rebaseSlotLines('A glasses.\n\n「hi」', `A glasses.\n\n${slot}\n\n「hi」`, 'A scarf.\n\n「hi」'), `A scarf.\n\n${slot}\n\n「hi」`);
    assert.equal(TX.blankSlots(text).includes('asset'), false);
    assert.ok(!TX.segmentMessage(text, { final: true }).some(g => /asset/.test(g.text + (g.raw || ''))));
});

console.log(JSON.stringify({ passed, failed, mockOnly: true }, null, 2));
process.exitCode = failed ? 1 : 0;
