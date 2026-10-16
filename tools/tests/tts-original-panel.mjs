// TTS 원문 칸 (src/addons/tts/src/playback-details.js playbackOriginalIn) — 가상 문장.
// 1.9.3 메시지 원문과 직접 견준다 · 1.9.4 TTS 가 옮겨 읽은 줄(listen · translated)만 칸
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const D = await import(pathToFileURL(path.join(root, 'src/addons/tts/src/playback-details.js')).href);
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const job = (originalText, spoken, extra = {}) => ({ text: spoken, parts: [{ seg: { text: originalText }, original: { text: originalText, ...(extra.fromDisplay ? { fromDisplay: true } : {}) }, text: spoken }], ...(extra.listen ? { listen: { src: 'x', target: 'ja' } } : {}), ...(extra.translated ? { translated: true } : {}) });
const SRC = 'She looked up.\n\n<span style="color:#3ccfbf">「おっ、ミナ発見〜！今日から総務部も定時退勤ウィークなんだって？いいじゃんいいじゃん！」</span>\n\nRex waved.';
const SPOKEN = 'おっ、ミナ発見~!今日から総務部も定時退勤ウィークなんだって？いいじゃんいいじゃん!';
check('spoken text is the original: no panel, never the screen translation', () => {
    const r = D.playbackOriginalIn(job('오, 미나 발견~! 오늘부터 총무부도 정시 퇴근 위크라면서요? 좋네 좋네!', SPOKEN), SRC);
    assert.equal(r.text, '');
});
check('TTS reads the screen translation as is (did not translate): no panel', () => {
    const r = D.playbackOriginalIn(job('おはよう、レックス。', '좋은 아침, 렉스.'), 'Mina said 「おはよう、レックス。」');
    assert.equal(r.text, '');
});
check('the "original" pair is screen text (not in the source) while TTS translates: not called the original', () => {
    const r = D.playbackOriginalIn(job('좋은 아침이에요, 렉스.', 'おはようございます、レックスさん。', { listen: true }), 'Mina said "Good morning, Rex."');
    assert.equal(r.text, '좋은 아침이에요, 렉스.'); assert.equal(r.title, D.ORIGINAL_MISSING_LISTEN);
});
check('TTS translated from the real original (listen or voice language): original title', () => {
    for (const extra of [{ listen: true }, { translated: true }]) {
        const r = D.playbackOriginalIn(job('Good morning, Rex.', 'おはようございます、レックスさん。', extra), 'Mina said "Good morning, Rex."');
        assert.equal(r.text, 'Good morning, Rex.'); assert.equal(r.title, '지금 읽는 대사의 원문');
    }
});
check('joined parts that are each in the source: no panel', () => {
    const src = '「今日はとても静かな朝だね」と彼は言った。少し間があって、「でも嵐が来る気がするんだよ」';
    const j = { text: '今日はとても静かな朝だね、でも嵐が来る気がするんだよ', parts: [{ seg: { text: '오늘은' }, original: { text: '오늘은' }, text: '今日はとても静かな朝だね' }, { seg: { text: '하지만' }, original: { text: '하지만' }, text: 'でも嵐が来る気がするんだよ' }] };
    assert.equal(D.playbackOriginalIn(j, src).text, '');
});
check('no source (external message): panel only when TTS translated', () => {
    assert.equal(D.playbackOriginalIn(job('좋은 아침.', 'おはよう。'), '').text, '');
    const j = job('좋은 아침.', 'おはよう。', { listen: true });
    assert.deepEqual(D.playbackOriginalIn(j, ''), { text: D.playbackOriginal(j), title: D.playbackOriginalTitle(j) });
    assert.equal(D.playbackOriginalIn({ sceneKind: 'sfx', parts: [] }, SRC).text, '');
});
console.log(`tts-original-panel: ${passed} passed, 0 failed`);
