// 7.0.4 프롬프트 관리자 「채팅 기록」 목록의 「끼운 글」 줄에 출처를 덧붙인다 — src/prompt-history-label.js collectSources · findSources · insertedLabel,
//   src/promptlist.js 배선. 이름은 실행 중의 값(extension_prompts · 프리셋 프롬프트 · 설치된 확장 manifest · 켜진 월드 인포)에서만.
//   지어낸 확장 · 프롬프트 · 항목 이름만 쓴다. node tools/tests/prompt-injected-source.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { collectSources, findSources, insertedLabel, knownSourceName, extensionNameFor } = await import(pathToFileURL(path.join(root, 'src/prompt-history-label.js')).href);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

// 지어낸 실행 중 값 (실리태번 모양 그대로)
const extensionPrompts = {
    '1_memory': { value: 'Summary so far: the travellers reached the harbor town.', position: 1, depth: 6, role: 0 },
    '2_floating_prompt': { value: "[Author's note: keep the mood quiet and {{char}} polite.]", position: 1, depth: 4, role: 0 },
    'customDepthWI_4_0': { value: 'The lighthouse was built two hundred years ago.\nThe harbor closes at dusk during storms.', position: 1, depth: 4, role: 0 },
    'pebble_notes_inject': { value: '[Pinned note: the red boat belongs to the keeper.]', position: 1, depth: 2, role: 0 },
    'mystery_key_xyz': { value: '[Unknown helper text that nobody registered a name for.]', position: 1, depth: 1, role: 0 },
    'not_in_chat': { value: '[Story string text placed before the chat.]', position: 0, depth: 0, role: 0 },
    'DEPTH_PROMPT': { value: '[Character note: speaks in short sentences.]', position: 1, depth: 4, role: 0 },
    'empty_one': { value: '', position: 1, depth: 0, role: 0 },
};
const presetPrompts = [
    { identifier: 'abc-1', name: 'Scene Rules', content: 'Describe the weather in one line before each reply.', injection_position: 1, injection_depth: 0 },
    { identifier: 'main', name: 'Main Prompt', content: 'You are a helpful narrator.', injection_position: 0 },
];
const extensions = [
    { folder: 'memory', name: 'Summarize' },
    { folder: 'third-party/SillyTavern-Pebble-Notes', name: 'Pebble Notes' },
    { folder: 'third-party/blue-lemonade', name: 'Blue Lemonade' },
];
const wiEntries = [
    { comment: 'Lighthouse history', content: 'The lighthouse was built two hundred years ago.' },
    { comment: 'Storm rule', content: 'The harbor closes at dusk during storms.' },
    { comment: 'Unrelated entry', content: 'Dragons live far to the east.' },
];
const sources = collectSources({ presetPrompts, extensionPrompts, extensions, wiEntries, substitute: s => s.replace('{{char}}', 'Rex') });
const label = content => insertedLabel(findSources(content, sources));

t('실리태번 내장 열쇠는 한국어 이름 (작가의 노트 · 요약 · 캐릭터 노트 · 월드 인포 깊이 · 벡터 · /inject)', () => {
    assert.equal(knownSourceName('2_floating_prompt'), '작가의 노트');
    assert.equal(knownSourceName('1_memory'), '요약');
    assert.equal(knownSourceName('3_vectors'), '벡터 검색');
    assert.equal(knownSourceName('4_vectors_data_bank'), '데이터 뱅크');
    assert.equal(knownSourceName('DEPTH_PROMPT_2'), '캐릭터 노트');
    assert.equal(knownSourceName('customDepthWI_7_1'), '월드 인포 (깊이 7)');
    assert.equal(knownSourceName('customDepthWI', { depth: 3 }), '월드 인포 (깊이 3)');
    assert.equal(knownSourceName('script_inject_mood'), '/inject mood');
    assert.equal(knownSourceName('someone_else'), null);
});

t('다른 확장 열쇠 → 설치된 확장의 manifest 이름 (폴더 · 이름과 맞춰 봄, 내장 확장과는 헛맞지 않음, 못 찾으면 null)', () => {
    assert.equal(extensionNameFor('pebble_notes_inject', extensions), 'Pebble Notes');
    assert.equal(extensionNameFor('Pebble-Notes', extensions), 'Pebble Notes');
    assert.equal(extensionNameFor('memory_helper_extra', extensions), null, '내장 memory 에 포함 맞추기를 하지 않는다');
    assert.equal(extensionNameFor('memory', extensions), 'Summarize', '정확히 같으면 내장도');
    assert.equal(extensionNameFor('mystery_key_xyz', extensions), null);
    assert.equal(extensionNameFor('x', [{ folder: 'third-party/no-manifest', name: '' }]), null);
    assert.equal(extensionNameFor('no_manifest', [{ folder: 'third-party/no-manifest', name: '' }]), 'no-manifest', 'manifest 이름이 없으면 폴더 이름');
});

t('출처 목록: 깊이(IN_CHAT)인 것만 · 빈 값 빼고 · 프리셋은 깊이 프롬프트만 · 월드 인포는 켜진 항목 제목', () => {
    const labels = sources.map(s => s.label);
    assert.deepEqual(labels, ['프리셋: Scene Rules', '요약', '작가의 노트', '월드 인포 (깊이 4): Lighthouse history, Storm rule', 'Pebble Notes', 'mystery_key_xyz', '캐릭터 노트']);
});

t('줄 이름: 하나 · 여럿(글에 나온 차례) · 둘 넘으면 「외 N」 · 매크로 치환 뒤 글 · 못 찾으면 「끼운 글」', () => {
    assert.equal(label("[Author's note: keep the mood quiet and Rex polite.]"), '끼운 글 · 작가의 노트');
    // 실리태번은 같은 깊이 · 역할을 한 줄로: 프리셋 글 먼저, 확장 글은 열쇠 차례
    const joined = ["Describe the weather in one line before each reply.", "[Author's note: keep the mood quiet and Rex polite.]", 'The lighthouse was built two hundred years ago.\nThe harbor closes at dusk during storms.', '[Character note: speaks in short sentences.]'].join('\n');
    assert.equal(label(joined), '끼운 글 · 프리셋: Scene Rules · 작가의 노트 외 2');
    assert.equal(label('[Pinned note: the red boat belongs to the keeper.]'), '끼운 글 · Pebble Notes');
    assert.equal(label('[Unknown helper text that nobody registered a name for.]'), '끼운 글 · mystery_key_xyz', '이름을 못 찾으면 열쇠 그대로');
    assert.equal(label('Something nobody here wrote at all.'), '끼운 글');
    assert.equal(label('[Story string text placed before the chat.]'), '끼운 글', '깊이 아닌 확장 글은 후보가 아니다');
    assert.equal(insertedLabel([]), '끼운 글');
});

t('짧은 출처 글은 줄 전체와 같을 때만 (흔한 낱말에 헛맞지 않게)', () => {
    const tiny = collectSources({ extensionPrompts: { tiny_key: { value: 'ok', position: 1 } } });
    assert.deepEqual(findSources('ok', tiny), ['tiny_key']);
    assert.deepEqual(findSources('this is ok for now', tiny), []);
});

t('배선: promptlist 가 끼운 글 줄에만 출처를 찾고(실행 중 extension_prompts · 프리셋 · 확장 manifest · WORLD_INFO_ACTIVATED) · 공개 코드에 다른 확장 이름 표 없음 · CI', () => {
    const src = read('src/promptlist.js');
    assert.match(src, /import \{ alignHistory, chatCandidates, labelOf, collectSources, findSources, insertedLabel \} from '\.\/prompt-history-label\.js';/);
    assert.match(src, /labels\[i\]\?\.kind === 'inserted' \? insertedLabel\(findSources\(items\[i\]\.content, sources\)\) : labelOf\(labels\[i\]\)/);
    assert.match(src, /extensionPrompts: ctx\?\.extensionPrompts \|\| \{\}/);
    assert.match(src, /host\.getExtensionManifest\?\.\(folder\)\?\.display_name/);
    assert.match(src, /promptManager\?\.serviceSettings\?\.prompts/);
    assert.match(src, /WORLD_INFO_ACTIVATED, rememberWorldInfo/);
    const lib = read('src/prompt-history-label.js');
    const table = lib.slice(lib.indexOf('const KNOWN_KEYS'), lib.indexOf('export function knownSourceName'));
    for (const key of table.matchAll(/\[\/\^([^/]+)\//g)) assert.match(key[1], /^(?:2_floating_prompt|1_memory|3_vectors|4_vectors_data_bank|DEPTH_PROMPT|customDepthWI|script_inject_|QUIET_PROMPT|blue_lemonade_character_assets)/, `표에 실리태번 · 이 테마 것만: ${key[1]}`);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/prompt-injected-source\.mjs \./);
});

console.log(`prompt-injected-source: ${n} passed, 0 failed`);
