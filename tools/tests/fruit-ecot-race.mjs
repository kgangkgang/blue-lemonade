// 6.6.5 과일의 마음 ECoT 스크립트와의 경쟁 — 답 머리 "[RE:]\n<ECoT>…</ECoT>" 는 MESSAGE_RECEIVED 다음 차례에 추론으로 옮겨진다.
// 그 전에 답을 읽는 자동 기능이 생각 글을 쓰지 않는지 본다.
// node tools/tests/fruit-ecot-race.mjs [repo root]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const load = file => import(pathToFileURL(path.join(root, file)).href);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };

// 과일 ECoT 스크립트(果实之心 ECoT 模块 v20261003.1)의 splitReasoning 과 같은 자르기 — 마지막 끝 태그 뒤 글을 본문으로
const ENDS = ['</ECoT>', '</thinking>', '</think>', '<!-- End of The ECoT -->', '<!-- End the ECoT -->'];
function ecotCut(mes) {
    const lower = mes.toLocaleLowerCase();
    let end = -1;
    for (const tag of ENDS) { const at = lower.lastIndexOf(tag.toLocaleLowerCase()); if (at >= 0) end = Math.max(end, at + tag.length); }
    return end < 0 ? mes : mes.slice(end).trim();
}

const THINKING = '[RE:]\n<ECoT>\n[语言检定]\n本轮旁白用English，对话用日本語。正文写在<content>中，状态栏放最前面。\n\n先想情节：她把小猫捧在胸前，会说“谢谢部长！”。\n\n「台词」要有温度。\n</ECoT>';
const BODY = '<status_bar>\n日期：10月17日\n时间：傍晚 18:12\n</status_bar>\n\n<content>\nShe was so happy that her heels tapped the floor.\n\n<span style="color:#424C59">「わあ、かわいいです！」</span>\n\nBram laughed and took another bite.\n\n<span style="color:#7fe03c">「ははっ、大げさだなぁ。」</span>\n\nShe hugged the cat to her chest.\n\n<span style="color:#424C59">「ありがとうございます！」</span>\n</content>';
const RAW = `${THINKING}\n${BODY}`;

await test('assets: splitThinking matches the ECoT script cut and only for a leading thinking block', async () => {
    const S = await load('src/addons/assets/slots.js');
    const { head, body } = S.splitThinking(RAW);
    assert.equal(head + body, RAW);
    assert.equal(body.trim(), ecotCut(RAW));
    assert.deepEqual(S.splitThinking(BODY), { head: '', body: BODY }, 'no thinking block → untouched');
    for (const lead of ['<think>plan</think>\n', '<thinking>plan</thinking>\n', '[RE:]\n<ECoT>plan<!-- End of The ECoT -->\n', '  <ECoT>plan</ECoT>']) {
        assert.equal(S.splitThinking(lead + BODY).body.trim(), BODY, lead);
    }
    // 본문 가운데의 </think> 언급은 생각 블록이 아니다 (글 맨 앞이 생각 블록이 아님)
    const mid = `${BODY}\n\nShe wrote "</think>" on the board.`;
    assert.deepEqual(S.splitThinking(mid), { head: '', body: mid });
});

await test('assets: slots are placed in the story even when the thinking mentions <content>, and survive the ECoT cut', async () => {
    const S = await load('src/addons/assets/slots.js');
    // 고치기 전 동작: 원문 전체를 보면 생각 속 「<content>」 언급이 이야기 칸으로 잡혀 자리가 생각 블록 안으로 들어간다
    const naive = S.insertSlots(RAW, S.slotSpots(RAW, 3), (n => () => `asold${n++}`)(0));
    assert.ok(naive.ids.length > 0 && naive.ids.every(id => !ecotCut(naive.text).includes(id)), 'reproduces the bug: every slot is inside the thinking and is cut away');
    // 고친 동작 (after-reply.js onMessageReceived 와 같은 순서)
    const { head, body } = S.splitThinking(RAW);
    const inserted = S.insertSlots(body, S.slotSpots(body, 3), (n => () => `asnew${n++}`)(0));
    const text = head + inserted.text;
    assert.equal(inserted.ids.length, 3);
    assert.ok(text.startsWith(THINKING), 'the thinking head is untouched');
    const visible = ecotCut(text);
    for (const id of inserted.ids) assert.ok(visible.includes(id), `slot ${id} stays in the visible reply after the cut`);
    assert.ok(S.isDialogueStart(visible.split(S.slotMarkup(inserted.ids[0]))[1].replace(/^\s+/, '')), 'slot sits before a dialogue paragraph');
});

await test('assets: the picker model never receives the thinking text', async () => {
    const S = await load('src/addons/assets/slots.js');
    const reply = S.markedReply(S.splitThinking(RAW).body, []);
    assert.ok(!/ECoT|语言检定|\[RE:\]/.test(reply), reply.slice(0, 80));
    const after = read('src/addons/assets/after-reply.js');
    assert.match(after, /const \{ head, body \} = splitThinking\(message\.mes\);/);
    assert.match(after, /hasAssetTag\(body\)/);
    assert.match(after, /slotSpots\(body, pickSettings\(\)\.count\)/);
    assert.match(after, /text = head \+ inserted\.text/);
    assert.match(after, /markedReply\(splitThinking\(textOf\(message, swipe\)\)\.body, ids\)/);
    assert.ok(!/slotSpots\(message\.mes/.test(after) && !/markedReply\(textOf\(/.test(after), 'no path (auto insert, ··· reroll) reads the raw reply any more');
    assert.equal((after.match(/splitThinking\(message\.mes\)/g) || []).length, 2, 'auto insert and reroll both split the thinking head');
});

await test('assets: an {{img::}} mention inside the thinking does not suppress slots', async () => {
    const S = await load('src/addons/assets/slots.js');
    const raw = RAW.replace('先想情节', '不要写{{img::name}}，先想情节');
    assert.ok(S.hasAssetTag(raw) && !S.hasAssetTag(S.splitThinking(raw).body));
});

await test('message-work: thinkingHeadEnd / dropThinkingHead follow the ECoT script cut', async () => {
    const W = await load('src/message-work.js');
    assert.equal(W.dropThinkingHead(RAW).trim(), ecotCut(RAW));
    assert.equal(W.dropThinkingHead(BODY), BODY);
    assert.equal(W.thinkingHeadEnd(BODY), -1);
    assert.equal(W.thinkingHeadEnd('[RE:]\n<ECoT>still thinking', { open: true }), '[RE:]\n<ECoT>still thinking'.length, 'streaming: unfinished thinking is all thinking');
    assert.equal(W.thinkingHeadEnd('[RE:]\n<ECoT>still thinking'), -1, 'final text without an end tag is left alone');
    assert.equal(W.dropThinkingHead('<ECoT>a</ECoT>b</think>c'), 'c', 'last end tag of any kind, like the script');
    assert.equal(W.dropThinkingHead('본문 <think>x</think> 끝'), '본문 <think>x</think> 끝', 'only a leading block');
});

await test('TTS: the thinking head is never segmented (final, streaming, stream count stays aligned after the cut)', async () => {
    const X = await load('src/addons/tts/src/text.js');
    const texts = segs => segs.map(seg => seg.text).filter(Boolean);
    const raw = X.segmentMessage(RAW, { final: true }), cut = X.segmentMessage(ecotCut(RAW), { final: true });
    assert.ok(!texts(raw).some(t => /谢谢部长|语言检定|RE:/.test(t)), 'no thinking line is read: ' + texts(raw).slice(0, 3).join(' | '));
    assert.deepEqual(texts(raw), texts(cut), 'raw (before the cut) and cut replies read the same lines');
    assert.deepEqual(raw.filter(seg => seg.kind === 'dialogue').map(seg => seg.text), cut.filter(seg => seg.kind === 'dialogue').map(seg => seg.text));
    // 스트리밍: 끝 태그 전에는 아무것도 읽지 않고, 다 온 뒤 센 수 = 잘린 뒤 수 (onStreamEnd 의 from = stream.queued 가 본문 앞줄을 건너뛰지 않게)
    assert.deepEqual(texts(X.segmentMessage(THINKING.slice(0, THINKING.indexOf('</ECoT>')), { final: false })), []);
    assert.equal(X.segmentMessage(RAW + '\n', { final: false }).length, X.segmentMessage(ecotCut(RAW) + '\n', { final: false }).length);
    assert.equal(X.blankThinkingHead(RAW).length, RAW.length, 'positions are kept');
    const mid = `${BODY}\n\n<think>“不是开头的思考”</think>`;
    assert.equal(X.blankThinkingHead(mid), mid);
});

await test('notification preview and background window use the visible reply', async () => {
    const notify = read('src/reply-notify.js'), bg = read('src/background-window.js');
    assert.match(notify, /import \{ dropThinkingHead \} from '\.\/message-work\.js';/);
    assert.match(notify, /const text = dropThinkingHead\(String\(last\.mes \|\| ''\)\)/);
    assert.match(bg, /import \{ dropThinkingHead \} from '\.\/message-work\.js';/);
    assert.match(bg, /const shown = dropThinkingHead\(state\.preview\); if \(shown !== state\.preview\) \{ state\.chars = shown\.length; state\.preview = shown; \}/);
    // 실리태번: 스트리밍 끝에 정지 버튼을 내리며(GENERATION_ENDED, 기다리지 않음) 그 뒤에 MESSAGE_RECEIVED 를 보낸다 — 알림은 자르기 전 글을 본다
    const W = await load('src/message-work.js');
    const preview = W.dropThinkingHead(RAW).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    assert.ok(preview.startsWith('日期') && !/RE:|语言检定/.test(preview));
});

await test('version stamps: assets 1.6.8, TTS 1.8.8', async () => {
    assert.match(read('src/addons/assets/state.js'), /VERSION = '1\.6\.8'/);
    assert.ok(read('src/addons/assets/style.css').includes('--eh-css-version: "1.6.8";'));
    assert.match(read('src/addons/tts/version.js'), /TTS_VERSION = '1\.8\.8'/);
    assert.ok(read('src/addons/tts/style.css').includes('--lv-css-version: "1.8.8";'));
    assert.match(read('src/addons/tts/manifest.json'), /"version": "1\.8\.8"/);
});

console.log(`fruit-ecot-race: ${passed} passed, 0 failed`);
