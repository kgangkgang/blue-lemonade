// TTS 1.9.1 한 문단 이어 읽기 — src/addons/tts/src/text.js (paragraphs · markParagraphs · markJoins · joinSpeech · firstNameIn) ·
//   player.js (sourcesOf · buildJobs 화자 · finishJobs join · tapJobs 묶음 펼치기 · lineJobs) · clickplay.js (findClickedItalic · segmentForHit · tapSegments) ·
//   pregen.js nextLine · settings.js · ui.js. 같은 문단에서 서술로만 끊긴 같은 화자의 대사 · 말 기울임을 한 요청으로 —
//   자동 읽기 · 누르기 · 미리 만들기가 같은 글 · 같은 캐시 열쇠인지, 끄면 1.9.0 그대로인지 본다.
//   node tools/tests/tts-join.mjs <테마 루트>   (공개 저장소는 '.')
// 실리태번 모듈은 data: 스텁. 네트워크 · 실제 엔진 요청 없음 (작업 · 열쇠만 만든다). 인물 · 문장은 모두 지어낸 것.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsJoinTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: '하람', name2: '은하' } };
let fetches = 0;
globalThis.fetch = async () => { fetches++; throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__ttsJoinTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}
export const main_api = 'openai';
export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = [];
export function getContext() { return T.ctx; }
export function saveMetadataDebounced() {}`),
    'popup.js': js(`export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 };
export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
export async function callGenericPopup() { return null; }`),
    'utils.js': js(`export function getStringHash(s) { let h = 0; for (const c of String(s ?? '')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
export function splitRecursive(t) { return [String(t ?? '')]; }`),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    if (parent.includes('/addons/tts/')) {
        const base = spec.split('/').pop();
        if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { st: ST } });

const mod = (name) => import(pathToFileURL(path.join(root, name)).href);
const S = await mod('settings.js');
const P = await mod('player.js');
const C = await mod('clickplay.js');
const X = await mod('text.js');
const PG = await mod('pregen.js');
const { settings } = S;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ---------- 목소리 · 메시지 (지어낸 인물: 은하 = 보낸 캐릭터, 도윤 = 다른 캐릭터, 하람 = 나)
const gv = (voiceId, name) => ({ uid: `minimax:${voiceId}`, provider: 'minimax', voiceId, name, lang: '', group: 'g', aliases: [], params: {}, mix: [] });
function reset(extra = {}) {
    const s = settings();
    s.enabled = true;
    s.voices = [gv('v_eunha', '은하 목소리'), gv('v_doyun', '도윤 목소리'), gv('v_haram', '하람 목소리')];
    s.char_map = { 은하: 'minimax:v_eunha', 도윤: 'minimax:v_doyun' };
    s.default_voice = 'minimax:v_eunha';
    s.user_voice = 'minimax:v_haram'; s.narrator_voice = ''; s.prefer_provider = '';
    s.emotion_strength = 'normal';
    s.routes = { dialogue: 'character', narration: 'skip', action: 'skip', thought: 'skip', user_dialogue: 'user' };
    s.read_preset = 'dialogue';
    s.no_dialogue_fallback = 'narration';
    s.join_paragraph = true;
    s.pregen = 'off';
    s.text_source = 'display';
    s.listen_lang = 'auto';
    s.pron_dict = ''; s.mute_words = '';
    s.max_chars = 3000;
    s.wait_translation = 'off';
    s.extras = 'off';
    s.analysis = { ...s.analysis, enabled: false };
    s.providers = { minimax: { key: 'mm-test-key-000000000000000000000000000000000000', host: 'https://api.minimax.io', model: 'speech-2.8-hd' } };
    Object.assign(s, extra);
    T.ctx.chatMetadata = {};
}
function message(text, { name = '은하', display = null } = {}) {
    const mes = { name, is_user: false, mes: text, extra: display ? { display_text: display } : {}, swipe_id: 0 };
    T.ctx.chat.length = 0; T.ctx.chat.push(mes);
    T.ctx.name1 = '하람'; T.ctx.name2 = name;
    return mes;
}
const auto = () => P._forTest.autoJobs(0);
const view = (jobs) => jobs.map(j => [j.voice.voiceId, j.text]);

// 소설체 문단: 기울임이 그 문단 인물의 말 · 속마음, 사이에 서술
const PHONE = '*잠깐만,* 은하는 수화기 너머로 손을 들었다. *지금 뭐라고 했어?* 그녀는 숨을 골랐다. *내일 아침 일곱 시라고!*';
const CLOSET = '*글쎄,* 하람은 옷장 문을 열며 생각했다. *그냥 산책이니까 편한 옷이면 되겠지.*';
const QUOTES = '"좋아." 도윤이 웃었다. "가자."';
const RP = '"응." *그녀가 고개를 끄덕인다.*';
const NOVEL = [PHONE, CLOSET, QUOTES, RP].join('\n\n');

// ---------- text.js
await test('paragraphs 를 안 주면 조각은 1.9.0 그대로 (새 칸 없음) · 주면 조각 수 · 갈래 · 글은 같고 칸만 더함 (원문 ↔ 번역문 짝 · 분석 번호 그대로)', () => {
    const base = X.segmentMessage(NOVEL, { knownNames: ['은하', '도윤'], userName: '하람', charName: '은하' });
    assert.ok(base.every(g => !('para' in g) && !('speech' in g) && !('paraName' in g) && !('join' in g)));
    const on = X.segmentMessage(NOVEL, { knownNames: ['은하', '도윤'], userName: '하람', charName: '은하', paragraphs: true });
    assert.deepEqual(on.map(g => [g.kind, g.text, g.line]), base.map(g => [g.kind, g.text, g.line]));
    const paired = X.pairSegments(base, on);
    assert.deepEqual(paired.map(g => g.kind), base.map(g => g.kind));
});
await test('말 기울임(speech): 서술이 사이에 낀 소설체 문단의 *…* 만 — 따옴표 대사가 있거나 서술이 없는 RP 체 *행동* 은 그대로', () => {
    const g = X.segmentMessage(NOVEL, { knownNames: ['은하', '도윤'], userName: '하람', charName: '은하', paragraphs: true });
    const acts = g.filter(x => x.kind === 'action');
    assert.deepEqual(acts.filter(x => x.speech).map(x => x.text), ['잠깐만,', '지금 뭐라고 했어?', '내일 아침 일곱 시라고!', '글쎄,', '그냥 산책이니까 편한 옷이면 되겠지.']);
    assert.equal(acts.find(x => x.text === '그녀가 고개를 끄덕인다.').speech, undefined, '따옴표 대사가 있는 문단의 *행동*');
    const allItalic = X.segmentMessage('*그녀가 창가로 걸어가 밖을 내다본다.*', { paragraphs: true });
    assert.equal(allItalic[0].speech, undefined, '서술이 모두 기울임');
    assert.deepEqual([...new Set(g.map(x => x.para))].length, 4, '빈 줄 문단 4개');
    const html = X.segmentMessage('<p>*하나,* 은하가 말했다.</p><p>*둘.* 도윤이 답했다.</p>', { paragraphs: true, knownNames: ['은하', '도윤'] });
    const [a, b] = html.filter(x => x.kind === 'action');
    assert.notEqual(a.para, b.para, '<p> 도 문단 경계');
    assert.deepEqual([a.paraName, b.paraName], ['은하', '도윤']);
});
await test('paraName: 그 문단 서술에 처음 나오는 아는 이름 (낱말 머리 · 조사는 붙어도 · 로마자는 낱말 끝까지) — 대사 · 말 기울임에만', () => {
    assert.equal(X.firstNameIn('도윤은 은하를 보았다', ['은하', '도윤']), '도윤');
    assert.equal(X.firstNameIn('하은하는 웃었다', ['은하']), null, '다른 이름 속 글자');
    assert.equal(X.firstNameIn('Mikaela smiled at Mika', ['Mika']), 'Mika', 'Mikaela 속 Mika 는 아님');
    assert.equal(X.firstNameIn('은 하나', ['은']), null, '한 글자 이름은 보지 않음');
    assert.equal(X.firstNameIn('은하와 은하수', ['은하', '은하수']), '은하');
    const g = X.segmentMessage(NOVEL, { knownNames: ['은하', '도윤'], userName: '하람', charName: '은하', paragraphs: true });
    assert.deepEqual(g.filter(x => x.paraName).map(x => [x.text, x.paraName]), [
        ['잠깐만,', '은하'], ['지금 뭐라고 했어?', '은하'], ['내일 아침 일곱 시라고!', '은하'], ['글쎄,', '하람'], ['그냥 산책이니까 편한 옷이면 되겠지.', '하람'], ['좋아.', '도윤'], ['가자.', '도윤']]);
});
await test('markJoins: 같은 문단의 대사 · 말 기울임 묶음 — 읽는 서술 · 속마음 글이 끼거나 문단이 바뀌면 끊김 · 앞글자로 원문 / 번역문 구분', () => {
    const g = X.markJoins(X.segmentMessage(NOVEL, { paragraphs: true }), {}, 'o');
    const ids = (k) => g.filter(x => x.text && (x.kind === 'dialogue' || x.speech)).map(x => x.join).filter(Boolean);
    assert.deepEqual(ids(), ['o1', 'o1', 'o1', 'o2', 'o2', 'o3', 'o3', 'o4']);
    const read = X.markJoins(X.segmentMessage(NOVEL, { paragraphs: true }), { narration: 'character' }, 'd');
    assert.deepEqual(read.filter(x => x.join).map(x => x.join), ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'], '서술을 읽으면 지금 순서 그대로 (하나씩)');
    const th = X.markJoins(X.segmentMessage('"하나." <true_thoughts character="은하">조용하네.</true_thoughts> "둘."', { paragraphs: true, routes: { thought: 'character' } }), { thought: 'character' });
    assert.deepEqual(th.filter(x => x.join).map(x => x.join), ['1', '2'], '속마음 글이 끼면 끊김');
    const marker = X.markJoins(X.segmentMessage('"하나." <true_thoughts character="은하">조용하네.</true_thoughts> "둘."', { paragraphs: true }), {});
    assert.deepEqual(marker.filter(x => x.join).map(x => x.join), ['1', '1'], '읽지 않는 속마음(이름표)만 끼면 이어짐');
    const plain = X.markJoins(X.segmentMessage(NOVEL, {}), {});
    assert.ok(plain.every(x => !x.join), 'paragraphs 없이 나눈 조각은 묶지 않음');
});
await test('joinSpeech: 쉼표 · 문장부호 · 닫는 글자 뒤는 띄어쓰기 하나, 글자로 끝나면 쉼표 + 띄어쓰기', () => {
    assert.equal(X.joinSpeech('잠깐만,', '지금 뭐라고 했어?'), '잠깐만, 지금 뭐라고 했어?');
    assert.equal(X.joinSpeech('좋아.', '가자.'), '좋아. 가자.');
    assert.equal(X.joinSpeech('정말', '그만해'), '정말, 그만해');
    assert.equal(X.joinSpeech('Wait…', 'what?'), 'Wait… what?');
    assert.equal(X.joinSpeech('', '하나'), '하나');
});

// ---------- 자동 읽기 (player)
await test('자동 읽기: 문단마다 한 요청 — 말 기울임은 보낸 캐릭터(문단 속 이름) 목소리, 내 이름이면 내 목소리, 따옴표 대사는 문단 속 이름의 목소리 · RP 체 *행동* 은 안 읽음', () => {
    reset();
    message(NOVEL);
    const jobs = auto();
    assert.deepEqual(view(jobs), [
        ['v_eunha', '잠깐만, 지금 뭐라고 했어? 내일 아침 일곱 시라고!'],
        ['v_haram', '글쎄, 그냥 산책이니까 편한 옷이면 되겠지.'],
        ['v_doyun', '좋아. 가자.'],
        ['v_eunha', '응.'],
    ]);
    assert.equal(jobs[0].parts.length, 3, '강조는 조각마다 (화면에서 셋을 차례로 찾음)');
    assert.deepEqual(jobs[0].parts.map(p => p.seg.text), ['잠깐만,', '지금 뭐라고 했어?', '내일 아침 일곱 시라고!']);
    assert.ok(jobs.every(j => j.key), '캐시 열쇠');
    assert.equal(fetches, 0);
});
await test('서술을 읽는 설정이면 지금 순서 그대로 (이어 붙이지 않음) · 끄면(join_paragraph false) 1.9.0 그대로 — 기울임은 *행동*, 대사는 줄마다 · 보낸 쪽 목소리', () => {
    reset({ routes: { dialogue: 'character', narration: 'character', action: 'skip', thought: 'skip', user_dialogue: 'user' } });
    message(QUOTES);
    assert.deepEqual(auto().map(j => j.text), ['좋아.', '도윤이 웃었다.', '가자.']);
    reset({ join_paragraph: false });
    message(NOVEL);
    assert.deepEqual(view(auto()), [['v_eunha', '좋아.'], ['v_eunha', '가자.'], ['v_eunha', '응.']]);
});
await test('같은 문단의 다른 사람 대사는 잇지 않음 (줄 앞 이름) · 감정이 다르면 잇지 않음 · 긴 묶음은 600자에서 끊음', () => {
    reset();
    message('은하: 「가자.」\n도윤: 「응.」\n은하: 「서두르자.」');
    assert.deepEqual(view(auto()), [['v_eunha', '가자.'], ['v_doyun', '응.'], ['v_eunha', '서두르자.']]);
    message('<shout>"멈춰!"</shout> 은하가 외쳤다. "괜찮아."');
    assert.equal(auto().length, 2, '태그 감정이 다른 이웃');
    const long = Array.from({ length: 12 }, (_, i) => `"${'가'.repeat(60)} ${i}." 은하가 말했다.`).join(' ');
    message(long);
    const jobs = auto();
    assert.ok(jobs.length >= 2 && jobs.every(j => j.text.length <= 600), jobs.map(j => j.text.length).join(','));
});
await test('번역문: 화면 글(번역문)의 문단으로 묶고 원문은 강조 짝 · 읽을 글이 원문이면 원문의 문단으로', () => {
    reset();
    const orig = '*Wait,* Eunha raised her hand. *What did you say?*\n\n"Fine." Doyun smiled. "Let\'s go."';
    const disp = '*잠깐만,* 은하가 손을 들었다. *지금 뭐라고 했어?*\n\n"좋아." 도윤이 웃었다. "가자."';
    message(orig, { display: disp });
    assert.deepEqual(view(auto()), [['v_eunha', '잠깐만, 지금 뭐라고 했어?'], ['v_doyun', '좋아. 가자.']]);
    assert.equal(auto()[0].parts[0].alt?.text, 'Wait,', '원문 짝 (강조 검색용)');
    settings().text_source = 'original';
    settings().char_map = { ...settings().char_map, Eunha: 'minimax:v_eunha', Doyun: 'minimax:v_doyun' };
    assert.deepEqual(view(auto()), [['v_eunha', 'Wait, What did you say?'], ['v_doyun', "Fine. Let's go."]]);
});

// ---------- 누르기 · 미리 만들기 (같은 열쇠)
await test('누르기: 말 기울임을 누르면 그 문단의 말 기울임을 차례대로 모아 한 번에 — 자동 읽기 · 미리 만들기와 같은 글 · 같은 열쇠', () => {
    reset();
    const mes = message(NOVEL);
    const autoJobs = auto();
    const hit = C.segmentForHit(mes, { kind: 'action', text: '지금 뭐라고 했어?', raw: '지금 뭐라고 했어?', line: 0 });
    assert.equal(hit.kind, 'action'); assert.equal(hit.speech, true); assert.equal(hit.actionIndex, 1);
    const tap = P.lineJobs(0, mes, [hit]).jobs;
    assert.deepEqual(view(tap), [view(autoJobs)[0]]);
    assert.equal(tap[0].key, autoJobs[0].key, '자동 읽기와 같은 캐시 열쇠');
    const last = C.segmentForHit(mes, { kind: 'action', text: '내일 아침 일곱 시라고!', raw: '내일 아침 일곱 시라고!', line: 0 });
    assert.equal(P.lineJobs(0, mes, [last]).jobs[0].key, autoJobs[0].key, '마지막 조각을 눌러도 같은 묶음');
    // 1.9.2 그냥 *행동* 도 누르면 읽는다 (누른 건 듣고 싶은 것 — 속마음의 길로, 자동 읽기에는 안 낌)
    const act = C.segmentForHit(mes, { kind: 'action', text: '그녀가 고개를 끄덕인다.', raw: '그녀가 고개를 끄덕인다.', line: 6 });
    assert.ok(act && !act.speech && P.lineJobs(0, mes, [act]).jobs.length === 1, '그냥 *행동* 도 누르면 읽음 (1.9.2)');
    assert.ok(!auto().some(j => j.text.includes('끄덕')), '자동 읽기에는 그대로 안 낌');
});
await test('누르기: 「」 · "…" 대사를 눌러도 같은 문단 같은 사람의 대사를 이어서 · 다른 사람 대사는 빼고 누른 사람 것만', () => {
    reset();
    let mes = message(NOVEL);
    const seg = C.segmentForHit(mes, { kind: 'dialogue', text: '가자.', raw: '가자.', quoted: '"가자."', line: 4 });
    const tap = P.lineJobs(0, mes, [seg]).jobs;
    assert.deepEqual(view(tap), [['v_doyun', '좋아. 가자.']]);
    assert.equal(tap[0].key, auto()[2].key);
    mes = message('은하: 「가자.」\n도윤: 「응.」\n은하: 「서두르자.」');
    const mid = C.segmentForHit(mes, { kind: 'dialogue', text: '응.', raw: '응.', quoted: '「응.」', line: 1, speakerHint: '도윤' });
    assert.deepEqual(view(P.lineJobs(0, mes, [mid]).jobs), [['v_doyun', '응.']]);
});
await test('미리 만들기: 누를 줄(tapSegments)에 말 기울임도 · 묶음은 한 번만 만들고 자동 읽기와 같은 열쇠 · 「다음 한 줄」은 묶음 다음으로', () => {
    reset();
    const mes = message(NOVEL);
    const segs = C.tapSegments(mes);
    assert.deepEqual(segs.map(x => x.text), ['잠깐만,', '지금 뭐라고 했어?', '내일 아침 일곱 시라고!', '글쎄,', '그냥 산책이니까 편한 옷이면 되겠지.', '좋아.', '가자.', '응.']);
    const pre = P.lineJobs(0, mes, segs).jobs;
    assert.deepEqual(pre.map(j => j.key), auto().map(j => j.key), '미리 만든 소리 = 자동 읽기 · 누르기 소리');
    const next = PG.nextLine(segs, segs[2]);
    assert.equal(next.text, '글쎄,', '묶음의 마지막 조각 다음 = 다음 문단');
    assert.equal(PG.nextLine(segs, { ...segs[0] }).text, '지금 뭐라고 했어?', '말 기울임도 한 줄로 셈');
});
await test('누른 기울임 찾기 (가짜 화면): em 안 글자를 누르면 그 기울임 · em 밖이면 null', () => {
    const el = (tagName, kids = []) => { const e = { nodeType: 1, tagName, childNodes: kids, parentNode: null, style: {}, hidden: false, getAttribute: () => null }; for (const k of kids) k.parentNode = e; return e; };
    const tx = (v) => ({ nodeType: 3, nodeValue: v, parentNode: null });
    const inEm = tx('지금 뭐라고 했어?'), plainText = tx(' 그녀는 숨을 골랐다. ');
    const root = el('DIV', [el('P', [el('EM', [tx('잠깐만,')]), tx(' 은하는 손을 들었다. '), el('EM', [inEm]), plainText])]);
    let caret = { offsetNode: inEm, offset: 3 };
    globalThis.document = {
        caretPositionFromPoint: () => caret,
        createTreeWalker(r, _show, filter) {
            const list = [];
            const walk = (n) => { for (const c of n.childNodes || []) { if (c.nodeType === 1 && filter(c) === 2) continue; list.push(c); walk(c); } };
            walk(r);
            let i = 0;
            return { nextNode: () => list[i++] || null };
        },
    };
    try {
        const hit = C.findClickedItalic(root, 10, 10);
        assert.deepEqual({ kind: hit.kind, text: hit.text }, { kind: 'action', text: '지금 뭐라고 했어?' });
        caret = { offsetNode: plainText, offset: 2 };
        assert.equal(C.findClickedItalic(root, 10, 10), null);
    } finally { delete globalThis.document; }
});

// ---------- 소리 대본 · 듣는 언어 (효과음 자동 찾기 · 듣는 언어를 켠 설정에서도 같은 열쇠)
const SS = await mod('script-store.js');
const L = await mod('listen.js');
await test('소리 대본으로 읽는 답장: 쉼 · 효과음 줄이 끼지 않은 이웃 대사 줄만 잇고, 누르기 묶음도 같은 자리에서 끊겨 같은 열쇠', () => {
    reset();
    const mes = message(NOVEL);
    const base = P.scriptRows(0);
    assert.deepEqual(base.map(r => r.text), ['잠깐만,', '지금 뭐라고 했어?', '내일 아침 일곱 시라고!', '글쎄,', '그냥 산책이니까 편한 옷이면 되겠지.', '좋아.', '가자.', '응.'], '대본 줄은 조각마다 (편집 단위 그대로)');
    const rows = [...base.slice(0, 2), { id: 'p-1', kind: 'pause', text: '', sourceIndex: base[2].sourceIndex, gapMs: 300, enabled: true }, ...base.slice(2)];
    mes.extra.lemon_voice_script = { version: 1, fingerprint: SS.scriptFingerprint(mes), savedAt: 1, rows: SS.normalizeRows(rows) };
    const scene = P._forTest.sceneJobs(0, P.scriptRows(0), { effects: false }).filter(j => !j.sceneKind);
    assert.deepEqual(scene.map(j => j.text), ['잠깐만, 지금 뭐라고 했어?', '내일 아침 일곱 시라고!', '글쎄, 그냥 산책이니까 편한 옷이면 되겠지.', '좋아. 가자.', '응.']);
    const tapOf = (text) => P.lineJobs(0, mes, [C.segmentForHit(mes, { kind: 'action', text, raw: text, line: 0 })]).jobs.map(j => j.key);
    assert.deepEqual(tapOf('잠깐만,'), [scene[0].key], '쉼 앞 묶음');
    assert.deepEqual(tapOf('내일 아침 일곱 시라고!'), [scene[1].key], '쉼 뒤 줄은 따로');
    assert.deepEqual(tapOf('글쎄,'), [scene[2].key]);
    // 고친 줄은 잇지 않음 (대본 편집 그대로)
    const edited = base.map((r, i) => (i === 1 ? { ...r, text: '지금 뭐라고?' } : r));
    mes.extra.lemon_voice_script = { version: 1, fingerprint: SS.scriptFingerprint(mes), savedAt: 2, rows: SS.normalizeRows(edited) };
    assert.deepEqual(P._forTest.sceneJobs(0, P.scriptRows(0), { effects: false }).slice(0, 3).map(j => j.text), ['잠깐만,', '지금 뭐라고?', '내일 아침 일곱 시라고!']);
    delete mes.extra.lemon_voice_script;
});
await test('듣는 언어(일본어): 옮긴 글끼리 이어서 한 요청 · 누르기도 같은 열쇠 · 아직 못 옮긴 줄과는 잇지 않음', async () => {
    reset({ listen_lang: 'ja' });
    const API = { calls: [], async translateForSpeech(lines) { this.calls.push([...lines]); return lines.map(x => `[ja]${x}`); }, speechReady: () => ({ ok: true }), speechModelTag: () => 'direct|custom|mock' };
    globalThis[Symbol.for('blue-lemonade.translator')] = API;
    T.ext.salty = { addons: { translator: true } };
    L._forTest.reset();
    try {
        const mes = message(PHONE);
        const before = auto();
        assert.ok(before.every(j => j.listenPending));
        assert.equal(before.length, 1, '못 옮긴 줄끼리는 원문으로 이어서 (옮긴 뒤 다시 만든다)');
        await L.fill(P._forTest.listenNeeds(0, mes), 'ja');
        assert.equal(API.calls.length, 1);
        assert.deepEqual(API.calls[0], ['잠깐만,', '지금 뭐라고 했어?', '내일 아침 일곱 시라고!'], '옮기기는 조각마다 (한 요청)');
        const jobs = auto();
        assert.deepEqual(jobs.map(j => j.text), ['[ja]잠깐만, [ja]지금 뭐라고 했어? [ja]내일 아침 일곱 시라고!']);
        assert.ok(jobs.every(j => !j.listenPending && j.listen?.target === 'ja'));
        const hit = C.segmentForHit(mes, { kind: 'action', text: '잠깐만,', raw: '잠깐만,', line: 0 });
        assert.deepEqual(P.lineJobs(0, mes, [hit]).jobs.map(j => j.key), [jobs[0].key]);
    } finally { delete globalThis[Symbol.for('blue-lemonade.translator')]; delete T.ext.salty; }
});

// ---------- 대사 분석이 기울임을 가름 (말 · 속마음 · 서술 + 주인) — 가짜 분석 엔진 (fetch 흉내, 실제 요청 0)
const A = await mod('analysis.js');
const THINK = '「가자.」 도윤이 말했다. *정말 괜찮을까.*';
const STORY = [NOVEL, THINK].join('\n\n');
const ANALYSIS = { enabled: true, engine: 'compat', base: 'https://mock.invalid/v1', key: 'mock-only', model: 'm', emotion: true, translate: false, speaker: true, when: 'auto', context_chars: 1200 };
async function withEngine(reply, fn) {
    const requests = [];
    const real = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        if (String(url) !== 'https://mock.invalid/v1/chat/completions') throw new Error('시험 중 다른 요청: ' + url);
        const body = JSON.parse(init.body);
        requests.push(body);
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply(body)) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }));
    };
    try { return await fn(requests); } finally { globalThis.fetch = real; }
}
const promptOf = (body) => body.messages.map(m => m.content).join('\n');
await test('분석 프롬프트: 서술이 있는 문단의 기울임만 짧게 더함 (RP 체 *행동* 문단은 안 물음) · 기울임을 안 물으면 1.9.0 과 글자까지 같은 프롬프트', () => {
    reset({ analysis: { ...settings().analysis, ...ANALYSIS } });
    const mes = message(STORY);
    const built = A.buildPrompt(mes, { italics: true, speaker: true, emotion: true, translate: false });
    assert.deepEqual(built.italics.map(x => [x.j, x.text]), [[0, '잠깐만,'], [1, '지금 뭐라고 했어?'], [2, '내일 아침 일곱 시라고!'], [3, '글쎄,'], [4, '그냥 산책이니까 편한 옷이면 되겠지.'], [5, '그녀가 고개를 끄덕인다.'], [6, '정말 괜찮을까.']], 'j = 원문 기울임 순번 (1.9.2 산문체 메시지면 서술 없는 문단의 기울임도 물음)');
    assert.match(built.user, /\[\*0\] "잠깐만,"/);
    assert.match(built.user, /¶ 은하는 수화기 너머로 손을 들었다\./, '문단 서술 발췌');
    assert.match(built.user, /Known speakers: .*하람/, '나도 후보');
    assert.match(built.user, /"italics":\[\{"j":0,"kind":"speech"/);
    const at = built.user.indexOf('Italic fragments');
    const section = built.user.slice(at, built.user.indexOf('\n\n', at));
    assert.ok(section.length < 500, `기울임 칸 ${section.length}자`);
    assert.equal(section.split('\n').length, 1 + 7 + 4, '조각 7 + 문단 발췌 4 (서술 없는 문단은 앞 서술 문단 — 1.9.2)');
    assert.match(section, /¶ \(before\) 도윤이 웃었다\.\n\[\*5\]/);
    const off = A.buildPrompt(mes, { italics: false, speaker: true, emotion: true, translate: false });
    assert.ok(!/Italic|italics/.test(off.user) && off.italics.length === 0);
    const plain = A.composePrompt({ lines: off.lines, needs: off.needs, emotion: true, charName: '은하', userName: '하람' });
    assert.equal(A.composePrompt({ lines: off.lines, needs: off.needs, emotion: true, charName: '은하', userName: '하람', italics: [] }).user, plain.user);
    const only = A.buildPrompt(message(PHONE), { italics: true, speaker: true, emotion: true, translate: false });
    assert.equal(only.empty, false, '대사 없이 기울임만 있어도 묻는다');
    assert.ok(!only.user.includes('Dialogue lines:'), '빈 대사 칸은 안 적음');
});
await test('분석이 가른 대로 읽기: 말 · 속마음은 그 주인의 목소리(나 · 전화 너머 사람도), 서술은 안 읽음 · 같은 주인끼리만 이어서 · 「」 대사와 속마음 기울임도 이어서 · 누르기도 같은 열쇠', async () => {
    reset({ analysis: { ...settings().analysis, ...ANALYSIS } });
    const mes = message(STORY);
    const reply = () => ({
        segs: [{ i: 0, emotion: 'neutral', speaker: '도윤' }, { i: 1, emotion: 'neutral', speaker: '도윤' }, { i: 2, emotion: 'neutral', speaker: '은하' }, { i: 3, emotion: 'neutral', speaker: '도윤' }],
        italics: [{ j: 0, kind: 'speech', speaker: '은하' }, { j: 1, kind: 'speech', speaker: '은하' }, { j: 2, kind: 'speech', speaker: '도윤' },
            { j: 3, kind: 'thought', speaker: '하람' }, { j: 4, kind: 'narration' }, { j: 6, kind: 'thought', speaker: '도윤' }],
    });
    await withEngine(reply, async (requests) => {
        assert.equal(P.analysisWanted(0, mes, settings(), { quiet: true }), true);
        const a = await A.analyzeMessage(0);
        assert.equal(requests.length, 1, '분석 요청 한 번 (기울임은 같은 요청에)');
        assert.match(promptOf(requests[0]), /\[\*6\] "정말 괜찮을까\."/);
        assert.deepEqual(a.italics.map(x => [x.j, x.kind, x.speaker || '']), [[0, 'speech', '은하'], [1, 'speech', '은하'], [2, 'speech', '도윤'], [3, 'thought', '하람'], [4, 'narration', ''], [5, '', ''], [6, 'thought', '도윤']]);   // 1.9.2 j 5 도 물음 (답이 없으면 '' — 다시 안 물음: italicsTried)
        assert.equal(P.analysisWanted(0, mes, settings(), { quiet: true }), false, '받은 뒤엔 다시 안 물음');
    });
    const jobs = auto();
    assert.deepEqual(view(jobs), [
        ['v_eunha', '잠깐만, 지금 뭐라고 했어?'],
        ['v_doyun', '내일 아침 일곱 시라고!'],   // 전화 너머 사람의 말 = 그 사람 목소리 (같은 문단이어도 다른 주인은 따로)
        ['v_haram', '글쎄,'],                    // 내 속마음 = 내 목소리 · 「서술」로 가른 기울임은 안 읽음
        ['v_doyun', '좋아. 가자.'],
        ['v_eunha', '응.'],
        ['v_doyun', '가자. 정말 괜찮을까.'],      // 「」 대사 + 같은 사람의 속마음 기울임
    ]);
    const tap = (text) => P.lineJobs(0, mes, [C.segmentForHit(mes, { kind: 'action', text, raw: text, line: 0 })]).jobs.map(j => j.key);
    assert.deepEqual(tap('지금 뭐라고 했어?'), [jobs[0].key]);
    assert.deepEqual(tap('내일 아침 일곱 시라고!'), [jobs[1].key]);
    assert.deepEqual(tap('정말 괜찮을까.'), [jobs[5].key], '따옴표 대사가 있는 문단이어도 분석이 말 · 속마음이라 하면 누를 수 있음');
    const narr = C.segmentForHit(mes, { kind: 'action', text: '그냥 산책이니까 편한 옷이면 되겠지.', raw: '…', line: 2 });
    assert.deepEqual(view(P.lineJobs(0, mes, [narr]).jobs), [['v_haram', '그냥 산책이니까 편한 옷이면 되겠지.']], '1.9.2 서술로 가른 기울임도 누르면 읽음 — 그 문단 시점 인물(하람)의 목소리');
});
await test('분석 없음 · 옛 분석(기울임 칸 없음) · 글이 바뀐 답은 이름 규칙으로 (다시 묻지 않음) · 번역문은 기울임 수가 같으면 같은 차례로', async () => {
    reset({ analysis: { ...settings().analysis, ...ANALYSIS } });
    let mes = message(NOVEL);
    mes.extra.lemon_voice = { analysis: { hash: A.hash(mes.mes), swipe: 0, langs: [], speaker: true, segs: [0, 1, 2].map(i => ({ i, h: 'x', emotion: 'neutral', text: {} })), sfx: [] } };
    assert.equal(P.analysisWanted(0, mes, settings(), { quiet: true }), false, '1.9.0 분석은 그대로 씀 (기울임 때문에 다시 사지 않음)');
    assert.equal(auto()[0].text, '잠깐만, 지금 뭐라고 했어? 내일 아침 일곱 시라고!', '이름 규칙');
    mes.extra.lemon_voice.analysis.italics = [{ j: 0, kind: 'narration', h: 'stale' }];
    assert.equal(auto()[0].text, '잠깐만, 지금 뭐라고 했어? 내일 아침 일곱 시라고!', '글 해시가 다른 답은 무시');
    const disp = '*Wait,* Eunha raised her hand. *What did you say?*';
    mes = message('*잠깐만,* 은하가 손을 들었다. *지금 뭐라고 했어?*', { display: disp });
    mes.extra.lemon_voice = { analysis: { hash: A.hash(mes.mes), swipe: 0, langs: [], speaker: true, segs: [], sfx: [],
        italics: [{ j: 0, h: A.hash(A.normText('잠깐만,')), kind: 'narration' }, { j: 1, h: A.hash(A.normText('지금 뭐라고 했어?')), kind: 'speech', speaker: '도윤' }] } };
    assert.deepEqual(view(auto()), [['v_doyun', 'What did you say?']], '번역문(화면 글)에도 같은 차례로');
});

// ---------- 1.9.2 문단 전체가 기울임인 속마음 (서술 문단 사이 한 줄 기울임 — 1.9.1 은 묻지도 읽지도 않았다)
const MIND = [
    '은하는 창문을 열었다. 도윤이 마당에 서 있었다.',
    '*Why is he standing out there?!*',
    '도윤이 손을 흔들었다.',
    '*The wind howled through the trees.*',
    '*I should go down and ask.*',
].join('\n\n');
await test('1.9.2 이름 규칙: 산문체 메시지의 문단 전체 기울임 — 1인칭 · 자문 · 감탄은 속마음으로 자동 읽기 (주인 = 앞 서술 문단의 첫 아는 이름), 3인칭 장면 묘사는 안 읽음 · RP 체 메시지는 그대로', () => {
    reset();
    message(MIND);
    assert.deepEqual(view(auto()), [['v_eunha', 'Why is he standing out there?!'], ['v_doyun', 'I should go down and ask.']]);
    const segs = X.segmentMessage(MIND, { paragraphs: true, knownNames: ['은하', '도윤'] }).filter(g => g.kind === 'action');
    assert.deepEqual(segs.map(g => [!!g.inner, g.paraName || '', g.povName || '']), [[true, '은하', '은하'], [false, '', '도윤'], [true, '도윤', '도윤']]);
    assert.equal(X.italicCandidates(X.segmentMessage(MIND, { paragraphs: true })).length, 3, '산문체 — 모든 기울임이 분석 후보');
    const RP = '*She smiles at him.*\n\n"Hello." *She waves.*\n\n*Why is it so cold?!*';
    message(RP);
    assert.deepEqual(auto().map(j => j.text), ['Hello.'], 'RP 체 (기울이지 않은 서술이 없음): 기울임은 예전처럼 행동');
    assert.equal(X.italicCandidates(X.segmentMessage(RP, { paragraphs: true })).length, 0, 'RP 체는 분석에도 안 물음');
    assert.ok(['Are you kidding me?!', 'I knew it.', '私の負けね。', '내가 왜 여기 있지', '저 사람 누구야?'].every(X.innerLike));
    assert.ok(!['The rain kept falling.', 'She smiled softly.', '제발 그만'].some(X.innerLike));
});
await test('1.9.2 누르기: 속마음 기울임은 물론, 장면 묘사 기울임 · 분석이 「서술」이라 한 기울임도 누르면 읽음 (그 장면 시점 인물의 목소리 · 속마음의 길)', () => {
    reset();
    const mes = message(MIND);
    const tap = (text) => P.lineJobs(0, mes, [C.segmentForHit(mes, { kind: 'action', text, raw: text, line: 0 })]).jobs;
    assert.deepEqual(view(tap('Why is he standing out there?!')), [['v_eunha', 'Why is he standing out there?!']]);
    assert.equal(tap('Why is he standing out there?!')[0].key, auto()[0].key, '자동 읽기와 같은 소리');
    assert.deepEqual(view(tap('The wind howled through the trees.')), [['v_doyun', 'The wind howled through the trees.']], '앞 서술 문단의 이름');
    mes.extra.lemon_voice = { analysis: { hash: A.hash(mes.mes), swipe: 0, langs: [], speaker: true, segs: [], sfx: [], italicsTried: ['0:x', '1:x', '2:x'],
        italics: [0, 1, 2].map(j => ({ j, h: A.hash(A.normText(['Why is he standing out there?!', 'The wind howled through the trees.', 'I should go down and ask.'][j])), kind: 'narration' })) } };
    reset({ analysis: { ...settings().analysis, enabled: false } });
    assert.ok(!auto().some(j => /Why is he/.test(j.text)), '분석이 서술이라 하면 자동 읽기에선 빠짐');
    assert.deepEqual(view(tap('Why is he standing out there?!')), [['v_eunha', 'Why is he standing out there?!']], '그래도 누르면 읽음');
});
await test('1.9.2 보충 요청: 1.9.1 분석에 답이 없는 후보(문단 전체 기울임)와 속마음처럼 보이는데 「서술」이라 한 조각만 기울임만 묻는 작은 요청 한 번 — 다시 안 보냄 · 프롬프트에 속마음 기준과 앞 서술 문단', async () => {
    reset({ analysis: { ...settings().analysis, ...ANALYSIS } });
    const mes = message('은하는 창문을 열었다. *Hm,* 도윤이 마당에 서 있었다.\n\n*Why is he standing out there?!*\n\n*The wind howled through the trees.*\n\n*Are you kidding me?!*');
    const h = (t) => A.hash(A.normText(t));
    // 1.9.1 이 남긴 분석: 서술 있는 문단의 j 0 만 물었고(속마음), 1.9.2 후보 j 1 · 2 · 3 은 답이 없다
    mes.extra.lemon_voice = { analysis: { hash: A.hash(mes.mes), swipe: 0, langs: [], speaker: true, segs: [], sfx: [], italics: [{ j: 0, h: h('Hm,'), kind: 'speech', speaker: '은하' }] } };
    assert.deepEqual(A.italicsToFill(mes, A.getAnalysis(0)), [1, 2, 3]);
    assert.equal(P.analysisWanted(0, mes, settings(), { quiet: true }), true, '보충이 남았으면 분석을 부름');
    const reply = () => ({ segs: [], italics: [{ j: 1, kind: 'thought', speaker: '은하' }, { j: 2, kind: 'narration' }, { j: 3, kind: 'narration' }] });
    await withEngine(reply, async (requests) => {
        await A.analyzeMessage(0);
        assert.equal(requests.length, 1, '보충 요청 한 번');
        const prompt = promptOf(requests[0]);
        assert.ok(!prompt.includes('[*0]') && /\[\*1\] "Why is he standing out there\?!"/.test(prompt), '답이 없는 조각만');
        assert.ok(!prompt.includes('Dialogue lines:') && !prompt.includes('Korean translation'), '작게 (대사 칸 · 번역문 없이)');
        assert.match(prompt, /first person/);
        assert.match(prompt, /¶ \(before\) 은하는 창문을 열었다\. 도윤이 마당에 서 있었다\./, '앞 서술 문단');
        const a = A.getAnalysis(0);
        assert.deepEqual(a.italics.map(x => [x.j, x.kind]), [[0, 'speech'], [1, 'thought'], [2, 'narration'], [3, 'narration']]);
        assert.deepEqual(A.italicsToFill(mes, a), [], '물어본 조각은 다시 안 물음 (j 3 이 속마음처럼 보여도 한 번만)');
        assert.equal(P.analysisWanted(0, mes, settings(), { quiet: true }), false);
        await A.analyzeMessage(0);
        assert.equal(requests.length, 1, '다시 안 보냄');
    });
    assert.deepEqual(auto().map(j => j.text), ['Hm,', 'Why is he standing out there?!'], '분석 답대로 (j 3 은 분석이 서술이라 해 자동으로는 안 읽음 — 누르면 읽음)');
    // 「서술」이라 한 1.9.1 답인데 이름 규칙은 속마음 → 한 번 다시 묻는다
    const m2 = message('은하는 창문을 열었다.\n\n*Are you kidding me?!*');
    m2.extra.lemon_voice = { analysis: { hash: A.hash(m2.mes), swipe: 0, langs: [], speaker: true, segs: [], sfx: [], italics: [{ j: 0, h: h('Are you kidding me?!'), kind: 'narration' }] } };
    assert.deepEqual(A.italicsToFill(m2, A.getAnalysis(0)), [0]);
});

// ---------- 읽는 대사 강조가 따옴표부터 따옴표까지 (여는 따옴표가 한 획으로 잘려 보이던 것)
const HC = await mod('highlight-colors.js');
await test('강조 범위: 대사 · 속마음 · 말 기울임은 바로 앞 여는 따옴표 · 바로 뒤 닫는 따옴표까지 (빈칸 하나까지) · 따옴표가 없거나 다른 글자면 그대로', () => {
    const w = (flat, text) => { const a = flat.indexOf(text); const r = HC.widenToQuotes(flat, a, a + text.length - 1); return flat.slice(r.a, r.b + 1); };
    assert.equal(w('"너처럼 할 말을 이렇게" 그가 웃었다.', '너처럼 할 말을 이렇게'), '"너처럼 할 말을 이렇게"');
    assert.equal(w('그가 말했다. “잠깐만, 지금 뭐라고?”', '잠깐만, 지금 뭐라고?'), '“잠깐만, 지금 뭐라고?”');
    assert.equal(w('「가자.」『응.』«Oui.»‘네.’＂예.＂', '응.'), '『응.』');
    assert.equal(w('「가자.」『응.』«Oui.»‘네.’＂예.＂', 'Oui.'), '«Oui.»');
    assert.equal(w('" 띄운 대사 " 끝', '띄운 대사'), '" 띄운 대사 "');
    assert.equal(w('잠깐만, 그가 손을 들었다.', '잠깐만,'), '잠깐만,', '따옴표 없음');
    assert.equal(w('(괄호 대사) 끝', '괄호 대사'), '괄호 대사', '괄호는 따옴표가 아님');
    assert.equal(w('"첫 문단 끝', '첫 문단 끝'), '"첫 문단 끝', '닫는 따옴표가 없는 여러 문단 대사의 첫 문단');
    const p = fs.readFileSync(path.join(root, 'player.js'), 'utf8');
    const rf = p.slice(p.indexOf('function rangesFor'), p.indexOf('function findRange'));
    assert.match(rf, /x\.kind === 'dialogue' \|\| x\.kind === 'thought' \|\| \(x\.kind === 'action' && x\.speech\)/, '서술은 넓히지 않음 (곧은 " 는 앞 대사의 닫는 따옴표일 수 있다)');
    assert.match(p, /const \{ a, b \} = quotes \? widenToQuotes\(index\.flat, at, at \+ n\.length - 1\)/, '글자(DOM)는 그대로, 범위만');
});

// ---------- 연결 · 설정 · 가벼움
await test('설정: join_paragraph 기본 켬 · 읽을 부분 카드에 스위치 · 다른 확장의 「누른 대사만」은 넓히지 않음 · 스트리밍은 줄마다', () => {
    assert.equal(S.DEFAULTS.join_paragraph, true);
    const ui = fs.readFileSync(path.join(root, 'ui.js'), 'utf8');
    assert.match(ui, /\{ key: 'join_paragraph', label: '한 문단 이어 읽기', type: 'toggle'/);
    const p = fs.readFileSync(path.join(root, 'player.js'), 'utf8');
    assert.match(p, /return speakSegments\(id, segs, \{ expand: false \}\);/);
    const stream = p.slice(p.indexOf('export function onStreamProgress'), p.indexOf('// ---------- 공개: 내려받기'));
    assert.ok(!/join: true/.test(stream), '스트리밍 읽기는 줄마다');
    const cp = fs.readFileSync(path.join(root, 'clickplay.js'), 'utf8');
    assert.match(cp, /\|\| findClickedItalic\(mesText, e\.clientX, e\.clientY\);/, '대화문이 아니면 기울임');
});
await test('가볍게: 바뀐 파일에 새 상주 관찰자 · 타이머 없음 (text.js · clickplay.js 는 하나도 없음)', () => {
    for (const f of ['text.js', 'clickplay.js']) assert.ok(!/MutationObserver|setInterval|setTimeout|requestAnimationFrame/.test(fs.readFileSync(path.join(root, f), 'utf8')), f);
    const p = fs.readFileSync(path.join(root, 'player.js'), 'utf8');
    const part = (a, b) => p.slice(p.indexOf(a), p.indexOf(b, p.indexOf(a)));
    for (const body of [part('function sourcesOf', 'function safeSegment'), part('function buildJobs', 'function paramsFor'), part('const canJoin', 'function fitShout'),
        part('function finishJobs', '// ---------- 합성'), part('function tapJobs', 'export function lineJobs'), part('export function lineJobs', 'function tapSfxJobs')]) {
        assert.ok(body.length > 50 && !/MutationObserver|setInterval|setTimeout|requestAnimationFrame|addEventListener/.test(body), body.slice(0, 40));
    }
});
await test('버전 1.9.2 이상: version.js · manifest · style.css · README 첫 줄이 같은 판', () => {   // 1.9.3 판이 올라가도 깨지지 않게
    const read = (f) => fs.readFileSync(path.join(theme, 'src/addons/tts', f), 'utf8');
    const version = read('version.js').match(/TTS_VERSION = '([\d.]+)'/)[1];
    assert.ok(version.localeCompare('1.9.2', undefined, { numeric: true }) >= 0, version);
    assert.equal(JSON.parse(read('manifest.json')).version, version);
    assert.ok(read('style.css').includes(`--lv-css-version: "${version}";`));
    assert.equal(read('README.md').split('\n')[0], `# TTS ${version}`);
    assert.match(read('README.md'), /## 1\.9\.2 문단 전체가 기울임인 속마음/);
    assert.match(read('README.md'), /## 1\.9\.1 한 문단 이어 읽기/);
});

console.log(`\ntts-join: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
