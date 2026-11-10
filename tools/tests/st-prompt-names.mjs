// 1.1.2 실리태번 기본 프롬프트 항목 이름 사전(src/scripts/st-prompt-names.js)
//   프리셋이 그대로 둔 기본 칸 이름을 프롬프트 목록에서 한글로 보여 주되, 열쇠는 실리태번 본체의 기본 이름뿐이고(프리셋 고유 이름 · 본문 · 정규식 없음),
//   끄면 원문 그대로이며, 프리셋 사전이 먼저이고, 시작 때 받지 않는지 확인해요. 목록에 칠하는 것과 같은 lookup(src/scripts/prompt-engine.js)을 써요.
//   node tools/tests/st-prompt-names.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { scriptCode } from './script-code.mjs';

const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
const doc = { getElementById: () => null, body: { contains: () => false, children: [] }, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} };
const { createPromptEngine } = await load('src/scripts/prompt-engine.js');
const dict = (await load('src/scripts/st-prompt-names.js')).default;
const FILE = 'src/scripts/st-prompt-names.js';
const hangul = /[가-힣]/;
const norm = s => s.normalize('NFKC').replace(/[︎️\s]/g, '');

// 실리태번 본체(public/scripts/PromptManager.js)의 기본 프롬프트 id → 이름. 사전의 열쇠는 이 표와 글자까지 같아야 해요.
const ST_DEFAULT = {
    main: 'Main Prompt', nsfw: 'Auxiliary Prompt', dialogueExamples: 'Chat Examples', jailbreak: 'Post-History Instructions',
    chatHistory: 'Chat History', worldInfoAfter: 'World Info (after)', worldInfoBefore: 'World Info (before)', enhanceDefinitions: 'Enhance Definitions',
    charDescription: 'Char Description', charPersonality: 'Char Personality', scenario: 'Scenario', personaDescription: 'Persona Description',
};
const EXPECT = {
    'Main Prompt': '메인 프롬프트', 'World Info (before)': '월드 인포 (앞)', 'World Info (after)': '월드 인포 (뒤)', 'Persona Description': '페르소나 설명',
    'Char Description': '캐릭터 설명', 'Char Personality': '캐릭터 성격', 'Scenario': '시나리오', 'Chat Examples': '예시 대화', 'Chat History': '채팅 기록',
    'Auxiliary Prompt': '보조 프롬프트', 'Post-History Instructions': '기록 뒤 지시', 'Enhance Definitions': '설정 보강',
};

await t('형식: 프롬프트 이름만 담은 순수 사전이에요 (정규식 · 부분 일치 없음, 우선순위는 프리셋 사전 20 아래)', () => {
    assert.deepEqual(Object.keys(dict).sort(), ['priority', 'prompts']);
    assert.ok(dict.priority > 0 && dict.priority < 20);
    for (const e of dict.prompts) {
        assert.deepEqual(Object.keys(e).sort(), ['desc', 'id', 'name', 'title'], e.name);
        for (const k of ['id', 'name', 'title', 'desc']) assert.ok(typeof e[k] === 'string' && e[k].trim(), `${e.name} ${k}`);
        assert.ok(hangul.test(e.title) && !/[A-Za-z]/.test(e.title), `제목 한글: ${e.title}`);
        assert.ok(hangul.test(e.desc) && e.desc.length <= 80 && /요\.$/.test(e.desc), `설명은 짧은 해요체 한 줄: ${e.name}`);
    }
});
await t('열쇠 일치: 열쇠는 실리태번 기본 항목 12개의 id · 이름과 글자까지 같아요 (프리셋 고유 이름 없음)', () => {
    assert.equal(dict.prompts.length, 12);
    assert.deepEqual(Object.fromEntries(dict.prompts.map(e => [e.id, e.name])), ST_DEFAULT);
});
await t('중복 없음: 같은 id · 같은 이름 · 같은 제목이 두 번 나오지 않아요', () => {
    for (const pick of [e => e.id, e => norm(e.name), e => e.title]) assert.equal(new Set(dict.prompts.map(pick)).size, dict.prompts.length);
});
await t('켜면 한글: 기본 항목 12개가 id 가 있든 없든(이름만 같아도) 정한 한글 제목으로 보여요', () => {
    const engine = createPromptEngine(doc), off = engine.register('st-names', dict);
    for (const [id, name] of Object.entries(ST_DEFAULT)) {
        assert.equal(engine.title('prompts', id, name), EXPECT[name], name);
        assert.equal(engine.title('prompts', 'some-other-id', name), EXPECT[name], `${name} (이름만)`);
    }
    off();
});
await t('끄면 원문: 사전을 내리면 번역 이름이 없어요 (목록은 원문 그대로)', () => {
    const engine = createPromptEngine(doc), off = engine.register('st-names', dict);
    assert.equal(engine.title('prompts', 'chatHistory', 'Chat History'), '채팅 기록');
    off();
    for (const [id, name] of Object.entries(ST_DEFAULT)) assert.equal(engine.title('prompts', id, name), null, name);
});
await t('남의 이름은 안 건드려요: 꾸밈이 붙은 이름 · 다른 이름 · 정규식 이름은 그대로예요', () => {
    const engine = createPromptEngine(doc), off = engine.register('st-names', dict);
    for (const name of ['⟡ Chat History ⟡', 'Chat History 2', 'My Scenario', 'World Info', 'scenario']) assert.equal(engine.title('prompts', null, name), null, name);
    assert.equal(engine.title('regex', null, 'Scenario'), null);
    // 사용자가 붙인 메모는 기존 규칙대로 따라가요: 「원문 (메모)」 → 「번역 (메모)」
    assert.equal(engine.title('prompts', null, 'Scenario (내 것)'), '시나리오 (내 것)');
    off();
});
await t('프리셋 사전이 먼저: 솔라 · 데우스 · 과일 사전에 같은 이름이 있으면 등록 순서와 상관없이 그쪽 제목이 보여요', async () => {
    for (const id of ['sola', 'deus', 'fruit']) {
        let preset; new Function('BlueLemonade', await scriptCode(root, id))({ translate: v => { preset = v; } });
        assert.ok(preset.priority > dict.priority, id);
        const alone = createPromptEngine(doc); alone.register(id, preset);
        for (const order of [[['st-names', dict], [id, preset]], [[id, preset], ['st-names', dict]]]) {
            const engine = createPromptEngine(doc); for (const [key, data] of order) engine.register(key, data);
            for (const [pid, name] of Object.entries(ST_DEFAULT)) {
                // 프리셋 사전에 글자까지 같은 이름이 있을 때만 그쪽이 먼저예요. 「원문 (메모)」 꼴로 어림잡은 제목(예: 솔라의 World Info + (before))보다는 이 사전의 정확한 이름이 먼저예요.
                const own = alone.titleExact('prompts', pid, name);
                assert.equal(engine.title('prompts', pid, name), own ?? EXPECT[name], `${id} · ${name}`);
            }
        }
    }
});
await t('배선: 「실리태번 한글화」를 켤 때만 걸고, 서랍 문이 열릴 때 받고, 끌 때 내려요', () => {
    const runtime = read('src/scripts/runtime.js');
    assert.match(runtime, /install\(apiFor\(id,cleanups\),realm\.window\);\r?\n\s*if\(id==='korean'\)basicPromptNames\(cleanups\);/);
    const body = runtime.slice(runtime.indexOf('function basicPromptNames(cleanups){'), runtime.indexOf('async function startOne('));
    assert.match(body, /cleanups\.push\(\(\)=>\{gone=true;off\?\.\(\);off=null;\}\);/);
    assert.match(body, /onGate\('drawer',\(\)=>\{if\(!gone\)import\('\.\/st-prompt-names\.js'\)\.then\(module=>\{if\(!gone\)off=translations\.register\('st-names',module\.default\);\}\)/);
});
await t('시작 용량: 사전은 실행기의 늦은 import 한 곳에서만 받아요 (정적 import 0)', () => {
    const hits = [];
    const walk = dir => { for (const d of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const rel = `${dir}/${d.name}`; if (d.isDirectory()) { if (!/vendor|node_modules/.test(d.name)) walk(rel); } else if (d.name.endsWith('.js') && d.name !== 'build-info.js' && read(rel).includes('st-prompt-names.js')) hits.push(rel); } };
    walk('src'); if (read('index.js').includes('st-prompt-names.js')) hits.push('index.js');
    assert.deepEqual(hits, ['src/scripts/runtime.js']);   // build-info.js 는 파일 지문 목록이라 빼요
    const runtime = read('src/scripts/runtime.js');
    assert.equal(runtime.split("import('./st-prompt-names.js')").length - 1, 1);
    assert.ok(!/^\s*import[^(\n]*st-prompt-names\.js/m.test(runtime), '정적 import 가 아니에요');
});
await t('출처: 사전 머리와 출처 문서 · 설정창 출처 창에 실리태번 본체(AGPL-3.0) 줄이 있어요', () => {
    const head = read(FILE).split('export default')[0];
    assert.match(head, /SillyTavern\/SillyTavern/); assert.match(head, /AGPL-3\.0/);
    const notices = read('THIRD-PARTY-NOTICES.md').split('\n').find(line => line.includes(FILE));
    assert.ok(notices && /SillyTavern\/SillyTavern/.test(notices) && /AGPL-3\.0/.test(notices), 'THIRD-PARTY-NOTICES.md');
    assert.match(read('src/credits.js'), /실리태번 기본 프롬프트 항목 이름/);
});
await t('CI 에 등록돼 있어요', () => {
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/st-prompt-names.mjs .'));
});
console.log(`st-prompt-names: ${n} passed`);
