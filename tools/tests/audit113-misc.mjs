// 코드 감사 2차 · 1.1.3 로 미룬 그 밖 항목(G5 ~ G11) — 고치기 전에는 항목마다 실패했어요.
//   node tools/tests/audit113-misc.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

await test('G5 장면 소리: 「화면 밖에서도」를 끄면 숨는 순간 소리가 없었어도 숨은 탭에서 새로 시작하지 않아요', async () => {
    class Param { constructor(v) { this.value = v; } setValueAtTime(v) { this.value = v; return this; } linearRampToValueAtTime(v) { this.value = v; return this; } exponentialRampToValueAtTime(v) { this.value = v; return this; } cancelScheduledValues() { return this; } }
    class Node { constructor(ctx, type) { this.ctx = ctx; this.type = type; } connect(d) { return d; } disconnect() {} start() {} stop() {} }
    class FakeContext {
        constructor() { this.sampleRate = 48000; this.currentTime = 0; this.state = 'suspended'; this.destination = new Node(this, 'destination'); }
        createGain() { const n = new Node(this, 'gain'); n.gain = new Param(1); return n; }
        createBiquadFilter() { const n = new Node(this, 'biquad'); n.frequency = new Param(350); n.Q = new Param(1); return n; }
        createOscillator() { const n = new Node(this, 'osc'); n.frequency = new Param(440); return n; }
        createBufferSource() { const n = new Node(this, 'source'); n.playbackRate = new Param(1); return n; }
        createBuffer(c, length, rate) { const data = new Float32Array(length); return { numberOfChannels: c, length, sampleRate: rate, getChannelData: () => data }; }
        async decodeAudioData() { return { decoded: true }; }
        async resume() { this.state = 'running'; }
        async suspend() { this.state = 'suspended'; }
    }
    const doc = Object.assign(new EventTarget(), { hidden: false });
    const ss = await import(pathToFileURL(path.join(root, 'src/scene-sound.js')).href);
    ss._forTest.setHost({
        AudioContext: () => FakeContext, doc: () => doc, now: () => 1e6, random: () => 0.5,
        fetch: async () => ({ ok: false, status: 404 }), setTimeout: () => 0, clearTimeout: () => {},
        weather: async () => ({ weatherState: () => ({ current: null }) }),
        context: () => ({ eventSource: { on() {} }, event_types: { CHARACTER_MESSAGE_RENDERED: 'cmr', CHAT_CHANGED: 'cc' } }),
    });
    const settle = async () => { for (let i = 0; i < 8; i++) await new Promise(r => setTimeout(r, 0)); };
    const cfg = { on: true, volume: 100, background: false };
    await ss.syncSceneSound(true, cfg, { weather: 'off', weather2: 'off' }, true); await settle();
    doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
    await ss.syncSceneSound(true, cfg, { weather: 'rain', weather2: 'off' }, true); await settle();
    assert.equal(ss.sceneSoundState().kind, null);    // 고치기 전: rain
    assert.equal(ss.sceneSoundState().resting, true);
    doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); await settle();
    assert.equal(ss.sceneSoundState().resting, false);
    assert.equal(ss.sceneSoundState().kind, 'rain', '돌아오면 이어져요');
});

await test('G6 북마크: 캐릭터 없이 창을 열려다 돌아가면 잡은 미리보기 규칙을 놓아요(코드 꼴)', () => {
    const src = read('src/addons/bookmarks/panel.js');
    const open = src.slice(src.indexOf('export async function openPanel('), src.indexOf('\n}\n', src.indexOf('export async function openPanel(')));
    const hold = open.indexOf('holdPreviewRules()'), noOwner = open.indexOf("toastr.info('캐릭터나 그룹 채팅을 먼저 열어 주세요.'");
    assert.ok(hold > 0 && noOwner > hold);
    const branch = open.slice(noOwner, open.indexOf('return;', noOwner));
    assert.match(branch, /if \(!view\.open && holdingPreviewRules\) \{ holdingPreviewRules = false; releasePreviewRules\(\); \}/);   // 고치기 전: 놓지 않고 return
});

await test('G7 조판을 끌 때 한자 · 가나 마디로 갈린 대사 머리(.bl-quote-lead)도 풀고 걷은 공백을 되돌려요(코드 꼴)', () => {
    const src = read('src/typography.js');
    const off = src.slice(src.indexOf('export function syncTypography('), src.indexOf('typesetRoot(document);', src.indexOf('export function syncTypography(')));
    const loop = off.slice(off.indexOf('for(const [node,value] of originals){'));
    assert.doesNotMatch(loop, /^for\(const \[node,value\] of originals\)\{\s*if\(!node\.isConnected\)continue;/);   // 고치기 전: 떨어진 node 는 그냥 건너뜀
    assert.match(loop, /if\(!node\.isConnected\)\{if\(value\.lead\?\.isConnected&&value\.lead\.textContent===value\.prefix\)value\.lead\.replaceWith\(document\.createTextNode\(value\.before\.slice\(0,value\.before\.length-value\.after\.length\)\)\);continue;\}/);
    // 되돌린 글: 「 + 걷은 공백 + 첫 글자 (뒤 글은 .bl-cjk 를 풀면 그대로)
    const text = '「  こんにちは世界」', cleaned = text.replace(/^([「『“"])[ \t　]+(?=\S)/u, '$1'), prefix = [...cleaned].slice(0, 2).join(''), after = cleaned.slice(prefix.length);
    assert.equal(text.slice(0, text.length - after.length) + after, text);
});

await test('G10 CSS 바구니: 앞에 다른 조각이 있는 칸의 :is(태그.a, .b) 를 펼쳐 깨진 선택자를 만들지 않아요', async () => {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { bucketize } = require(path.join(root, 'tools/css-bucket.cjs'));
    const lib = require(path.join(root, 'tools/css-lib.cjs'));
    const { tokens } = require(path.join(root, 'tools/css-key.cjs'));
    const broken = sel => lib.compounds(sel).some(c => tokens(c.split('::')[0]).some((t, i) => i > 0 && t.kind === 'tag'));
    const out = css => bucketize(css).text.trim().split('{')[0].replace(/\s+/g, ' ').trim();
    for (const css of ['body.salty :not(.x):is(span.a, .b){color:red}', 'body.salty *:is(i.a, .b){color:red}', 'body.salty :where(.q):is(i.fa, .b)::before{color:red}'])
        assert.ok(!lib.topSplit(out(css)).some(broken), `${css} → ${out(css)}`);   // 고치기 전: :not(.x)span.a · *i.a
    // 태그 없는 갈래는 예전처럼 펼쳐요
    assert.equal(out('body.salty div:is(.a, .b){color:red}'), 'body.salty div.a, body.salty div.b');
});

await test('CI 등록', () => {
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/audit113-misc.mjs .'));
});
console.log(`audit113-misc: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
