// 7.0.4 「끼운 글 · 프리셋: …」 이름표가 프롬프트 관리자 목록과 같은 번역 이름을 쓰는지 — 프리셋 파일의 이름은 원문 그대로이고,
//   목록에는 켜진 번역 스크립트 사전(src/scripts/prompt-engine.js)이 번역을 칠한다. 이름표도 같은 lookup 을 읽기만 하고,
//   없으면 한글화 패널(src/addons/prompt) 캐시의 제목 번역, 그것도 없으면 원래 이름. 지어낸 사전 · 이름만.
//   node tools/tests/prompt-translated-name.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };

// 사전을 등록하면 엔진이 문서를 지켜보기 시작한다 — 시험에선 빈 문서 · 빈 관찰자
globalThis.MutationObserver = class { observe() {} disconnect() {} };
const doc = { getElementById: () => null, body: { contains: () => false, children: [] }, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
const { createPromptEngine } = await load('src/scripts/prompt-engine.js');

await t('번역 스크립트 사전: 목록에 칠하는 것과 같은 lookup 을 읽기만 (id · 이름 · 빈칸과 이모지 변형 표시 무시) · 없으면 null', () => {
    const engine = createPromptEngine(doc);
    assert.equal(engine.title('prompts', 'x', '🧩 Lantern Aura 2.0'), null, '사전이 없으면 null');
    const off = engine.register('sample', { prompts: [{ name: '🧩 Lantern Aura 2.0', title: '🧩 등불 기운 2.0' }, { name: 'Tide Rules', id: 'tide-1', title: '물때 규칙' }] });
    assert.equal(engine.title('prompts', 'x', '🧩 Lantern Aura 2.0'), '🧩 등불 기운 2.0');
    assert.equal(engine.title('prompts', 'x', '🧩️ Lantern  Aura2.0'), '🧩 등불 기운 2.0', '빈칸 · 이모지 변형 표시가 달라도 (목록과 같은 정규화)');
    assert.equal(engine.title('prompts', 'tide-1', 'Tide Rules'), '물때 규칙');
    assert.equal(engine.title('prompts', 'x', 'Nobody Knows'), null);
    off();
    assert.equal(engine.title('prompts', 'x', '🧩 Lantern Aura 2.0'), null, '사전을 끄면 원래대로');
});

await t('이름표: 보이는 이름 함수가 주면 그것 · 비었거나 오류면 원래 이름', async () => {
    const { collectSources } = await load('src/prompt-history-label.js');
    const presetPrompts = [
        { identifier: 'p1', name: '🧩 Lantern Aura 2.0', content: 'Beauty draws attention but does not stop the world.', injection_position: 1 },
        { identifier: 'p2', name: 'Tide Rules', content: 'Describe the tide in one line before each reply.', injection_position: 1 },
        { identifier: 'p3', name: 'Broken Finder', content: 'This one makes the name finder throw an error.', injection_position: 1 },
    ];
    const names = { p1: '🧩 등불 기운 2.0', p2: '   ' };
    const labels = collectSources({ presetPrompts, presetName: p => { if (p.identifier === 'p3') throw Error('x'); return names[p.identifier]; } }).map(s => s.label);
    assert.deepEqual(labels, ['프리셋: 🧩 등불 기운 2.0', '프리셋: Tide Rules', '프리셋: Broken Finder']);
    assert.deepEqual(collectSources({ presetPrompts: presetPrompts.slice(0, 1) }).map(s => s.label), ['프리셋: 🧩 Lantern Aura 2.0'], '함수가 없으면 원래 이름 (7.0.4 앞과 같음)');
});

await t('배선: 엔진 title · runtime 의 translatedPromptName · 한글화 패널 translatedPromptTitle(캐시, 읽기만) · 목록 먼저 그다음 캐시 · CI', () => {
    assert.match(read('src/scripts/prompt-engine.js'), /const title = \(kind, id, name\) => lookup\(kind, id, name\)\?\.title \?\? null;\n\s+return \{title,register\(id,data\)\{/);
    assert.match(read('src/scripts/runtime.js'), /export const translatedPromptName=\(id,name\)=>translations\.title\('prompts',id,name\);/);
    const addon = read('src/addons/prompt/index.js');
    assert.match(addon, /export function translatedPromptTitle\(identifier, presetName = ''\) \{\n\s+try \{ return getTranslatedTitle\(presetNs\(presetName\), String\(identifier\)\) \|\| null; \} catch \{ return null; \}\n\}/);
    const list = read('src/promptlist.js');
    const runtimeAt = list.indexOf("import('./scripts/runtime.js')"), addonAt = list.indexOf("import('./addons/prompt/index.js')");
    assert.ok(runtimeAt > 0 && addonAt > runtimeAt, '목록에 칠하는 사전이 먼저, 한글화 패널 캐시는 다음');
    assert.match(list, /if \(ctx\?\.extensionSettings\?\.salty\?\.addons\?\.prompt\) \{/, '한글화 패널이 꺼져 있으면 불러오지 않는다');
    assert.match(list, /presetName: await presetNamer\(ctx\),/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/prompt-translated-name\.mjs \./);
});

console.log(`prompt-translated-name: ${n} passed, 0 failed`);
