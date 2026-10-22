// 번역 · TTS 문단 맞추기의 경계 더 (tts/src/text.js) — 원문 함께 보기에서 번역문만 읽기(speechDisplay)의 덜 쓰인 칸 · 짝 없는 닫는 태그 ·
//   겹친 칸 · 원문 칸만 있는 줄, 이어 읽기 묶음(markJoins)에서 말 기울임 표시가 행동 조각에만 듣는지. 지어낸 문장 · 이름만, 네트워크 없음.
//   node tools/tests/tts-display-edges.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const X = await import(pathToFileURL(path.join(root, 'src/addons/tts/src/text.js')).href);
let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const OPEN = '<details class="llm-translator-details ';
const fold = (sum, body, mode = 'mode-folded') => `${OPEN}${mode}"><summary class="s">${sum}</summary>${body}</details>`;
const unf = (t, o) => `<span class="translated_text mode-unfolded">${t}</span><br><span class="original_text mode-unfolded">${o}</span>`;
const ORIG_ONLY = (o) => `<br><span class="original_text mode-unfolded">${o}</span>`;

test('speechDisplay: 스트리밍 중 덜 쓰인 여는 태그(> 없음)는 그대로 두고 앞 칸만 바꾼다', () => {
    const half = `${OPEN}mode-fol`;
    assert.equal(X.speechDisplay(half), half);
    assert.equal(X.speechDisplay(`${fold('「어서 와」', '"Welcome."')}\n${half}`), `「어서 와」\n${half}`);
});

test('speechDisplay: 앞에 짝 없는 </details> 가 있어도 덜 쓰인 칸에서 멈춘다', () => {
    const text = `미나가 문을 열었다.</details>\n${OPEN}mode-original-first`;
    assert.equal(X.speechDisplay(text), text);
    const closed = `상태 끝</details>\n${fold('“Wait, Rex!”', '「待って、レックス!」', 'mode-original-first')}`;
    assert.equal(X.speechDisplay(closed), '상태 끝</details>\n「待って、レックス!」');
});

test('speechDisplay: 요약이 안 닫힌 칸은 건드리지 않고 다음 칸으로', () => {
    const broken = `${OPEN}mode-folded"><summary>번역 끝</details>`;
    assert.equal(X.speechDisplay(broken), broken);
    assert.equal(X.speechDisplay(`${broken}\n${fold('둘째 줄', 'second')}`), `${broken}\n둘째 줄`);
});

test('speechDisplay: 번역문 안에 같은 모양 칸이 들어 있으면 한 겹만 벗긴다', () => {
    const inner = fold('안쪽 번역', 'inner');
    assert.equal(X.speechDisplay(fold(inner, 'outer')), inner, '접기');
    assert.equal(X.speechDisplay(fold('outer', inner, 'mode-original-first')), inner, '원문 먼저');
    assert.equal(X.speechDisplay(`앞 줄\n${fold('outer', inner, 'mode-original-first')}\n${fold('마지막', 'last')}`), `앞 줄\n${inner}\n마지막`, '뒤 칸은 그대로 이어서 바꾼다');
});

test('speechDisplay: 펼침 — 원문 칸만 있는 줄은 빈 줄, 번역문 칸이 줄 머리에 있으면 벗긴다', () => {
    assert.equal(X.speechDisplay(ORIG_ONLY('*She smiles.*')), '');
    assert.equal(X.speechDisplay(`${unf('*그녀가 웃는다.*', '*She smiles.*')}\n${ORIG_ONLY('"Hi."')}\n그냥 줄`), '*그녀가 웃는다.*\n\n그냥 줄');
    assert.equal(X.speechDisplay(`> ${unf('<span style="color:#7ab">「좋아」</span>', '<span style="color:#7ab">"Fine."</span>')}`), '> <span style="color:#7ab">「좋아」</span>', '색 span 은 번역문 안에 남는다');
});

test('speechDisplay: 숫자 · 거짓 값도 글로', () => {
    assert.equal(X.speechDisplay(0), '0');
    assert.equal(X.speechDisplay(false), 'false');
    assert.equal(X.speechDisplay(undefined), '');
});

test('markJoins: 말 기울임 표시(speech)는 행동 조각에만 — 서술 · 속마음에 붙어도 묶지 않는다', () => {
    const seg = (kind, para, extra = {}) => ({ kind, para, text: 'x', ...extra });
    const segs = [seg('dialogue', 0), seg('narration', 0, { speech: true }), seg('thought', 0, { speech: true }), seg('dialogue', 0)];
    X.markJoins(segs, { narration: 'skip' });
    assert.deepEqual(segs.map(s => s.join ?? null), ['1', null, null, '2'], '속마음 글이 끼어 끊긴다');
    const act = [seg('dialogue', 3), seg('action', 3, { speech: true, inner: true }), seg('dialogue', 3)];
    X.markJoins(act, {}, 'm');
    assert.deepEqual(act.map(s => s.join ?? null), ['m1', 'm1', 'm1']);
});

console.log(`tts-display-edges: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
