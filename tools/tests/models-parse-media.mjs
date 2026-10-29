// 모델 등록 애드온 — 실리태번 기본 목록을 읽으려고 index.html 을 파싱할 때 미디어 태그를 빼요 (perf-heap 10-30)
// 실제 브라우저(리그 · 힙 스냅숏)에서: DOMParser 문서 안의 <audio id="audio_message_sound"> 가 RemotePlayback 「할 일 남음」으로 남아
//   파싱한 index.html 문서 전체(노드 약 1.75만)를 세션 내내 붙잡았어요 — 「장면 뒤 노드 · 힙」의 테마 몫.
// 여기서는 ① withoutMedia 가 <audio> · <video> 여는 태그만 빼고 select · option 은 글자 그대로 두는지 ② offer.js 가 그 결과를 파싱하는지 봐요.
// 실행: node tools/tests/models-parse-media.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/models');
const core = await import(pathToFileURL(path.join(dir, 'offer-core.js')).href);
assert.equal(typeof core.withoutMedia, 'function', 'offer-core.js 에 withoutMedia 가 있어요');

// 실리태번 1.19 index.html 의 미디어 세 곳과 공급자 select 를 본뜬 글(지어낸 이름)
const selects = [
    '<select id="model_openai_select">\n    <optgroup label="GPT-4o">\n        <option value="gpt-4o">gpt-4o</option>\n        <option value="gpt-4o-mini">gpt-4o-mini</option>\n    </optgroup>\n</select>',
    '<select id="model_claude_select"><option value="claude-sample-a">claude-sample-a</option><option value="claude-sample-b">claude-sample-b</option></select>',
];
const html = `<!DOCTYPE html><html><head><title>SillyTavern</title></head><body>
<audio id="audio_message_sound" src="sounds/message.mp3" hidden></audio>
<div id="chat"></div>
${selects[0]}
<template id="message_template"><div class="mes"><div class="mes_media_wrapper"><video class="mes_video" controls preload="metadata"></video>
<AUDIO class="mes_audio" preload="auto" hidden></AUDIO></div></div></template>
<div id="sheld"><textarea id="send_textarea"></textarea></div>
${selects[1]}
<p>audio 와 video 라는 낱말 · &lt;audio&gt; 글자는 그대로 · <audiograph-x>그대로</audiograph-x></p>
</body></html>`;
const out = core.withoutMedia(html);
assert.ok(!/<(?:audio|video)\b/i.test(out), '여는 미디어 태그가 하나도 남지 않아요');
for (const s of selects) assert.ok(out.includes(s), 'select · option 은 글자 그대로');
assert.ok(out.includes('<div id="chat"></div>') && out.includes('<textarea id="send_textarea"></textarea>'), '다른 마크업은 그대로');
assert.ok(out.includes('&lt;audio&gt;') && out.includes('<audiograph-x>그대로</audiograph-x>'), '낱말 · 이스케이프된 글 · 이름이 audio 로 시작하는 다른 태그는 건드리지 않아요');
assert.equal(out.length, html.length - '<audio id="audio_message_sound" src="sounds/message.mp3" hidden>'.length - '<video class="mes_video" controls preload="metadata">'.length - '<AUDIO class="mes_audio" preload="auto" hidden>'.length, '뺀 것은 여는 태그 세 개뿐');
assert.equal(core.withoutMedia(null), '');
assert.equal(core.withoutMedia('<select id="x"><option value="a">a</option></select>'), '<select id="x"><option value="a">a</option></select>');

// offer.js: 기본 목록 읽기는 미디어를 뺀 글을 파싱해요 (DOMParser 를 쓰는 다른 자리도 index.html 전체를 그대로 파싱하지 않아요)
const offer = fs.readFileSync(path.join(dir, 'offer.js'), 'utf8');
assert.match(offer, /import \{[^}]*\bwithoutMedia\b[^}]*\} from '\.\/offer-core\.js'/, 'offer.js 가 withoutMedia 를 가져와요');
const parses = [...offer.matchAll(/parseFromString\(([^,]+),/g)].map(m => m[1].trim());
assert.ok(parses.length >= 1, 'offer.js 가 index.html 을 파싱해요');
assert.deepEqual(parses.filter(a => a !== 'withoutMedia(html)'), [], `파싱하는 글은 모두 withoutMedia(html) 이어야 해요: ${parses.join(' · ')}`);

console.log('models-parse-media: 통과 (미디어 여는 태그만 뺌 · select 그대로 · offer.js 가 뺀 글을 파싱)');
