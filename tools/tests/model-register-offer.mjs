// 모델 등록 1.1.6 — 업데이트 뒤 「새 모델을 추가할까요?」 (src/addons/models/offer-core.js · offer.js)
// 고정 목록 공급자만 · 실리태번 메뉴에 있거나 등록했거나 이미 물어본 이름은 빼고 · 체크한 것만 등록 · 한 번 물어본 이름은 다시 묻지 않음
// 실행: node tools/tests/model-register-offer.mjs .   (jsdom 없이 작은 DOM 흉내로)
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/models');
const core = await import(pathToFileURL(path.join(dir, 'offer-core.js')).href);
let n = 0;
async function ok(name, fn) { await fn(); n++; }

const SOURCES = [
    { id: 'openai', label: 'OpenAI' }, { id: 'claude', label: 'Claude' }, { id: 'makersuite', label: 'Google AI Studio' },
    { id: 'vertexai', label: 'Google Vertex AI' }, { id: 'openrouter', label: 'OpenRouter' }, { id: 'custom', label: 'Custom' },
];

await ok('고정 목록 공급자만 · 메뉴/등록/물어본 이름은 빼고 · 새것 순서 그대로', () => {
    const data = {
        claude: { known: ['claude-new-b', 'claude-new-a', 'claude-old', ' claude-new-a '], page: ['claude-old', 'claude-reg'], registered: ['claude-reg', 'claude-mine'], offered: [] },
        vertexai: { known: ['gemini-new', 'gemini-asked'], page: ['gemini-old'], registered: [], offered: ['gemini-asked'] },
        makersuite: { known: ['gemini-new'], page: [], registered: [], offered: [] },
        openrouter: { known: ['x/new'], page: ['x/old'], registered: [], offered: [] },
        custom: { known: ['c-new'], page: ['c-old'] },
        openai: { known: ['gpt-old'], page: ['gpt-old'] },
    };
    const groups = core.pickNew(SOURCES, id => data[id]);
    assert.deepEqual(groups, [
        { source: 'claude', label: 'Claude', models: ['claude-new-b', 'claude-new-a'] },
        { source: 'vertexai', label: 'Google Vertex AI', models: ['gemini-new'] },
    ], '메뉴를 못 읽은 AI Studio · 목록을 받아 오는 OpenRouter · Custom · 새것 없는 OpenAI 는 빠진다');
    assert.deepEqual(core.pickNew(SOURCES, () => null), []);
    assert.ok(core.FIXED_SOURCES.includes('vertexai') && !core.FIXED_SOURCES.includes('openrouter'));
});

await ok('물어본 이름 적기 · 등록 끝에 붙이기', () => {
    const groups = [{ source: 'claude', models: ['a', 'b'] }, { source: 'vertexai', models: ['g'] }];
    assert.deepEqual(core.withOffered({ claude: ['old'] }, groups), { claude: ['old', 'a', 'b'], vertexai: ['g'] });
    assert.deepEqual(core.withOffered(null, groups), { claude: ['a', 'b'], vertexai: ['g'] });
    assert.deepEqual(core.withOffered([], []), {});
    const before = { claude: ['old'] };
    core.withOffered(before, groups);
    assert.deepEqual(before, { claude: ['old'] }, '받은 객체는 그대로');
    assert.deepEqual(core.withAdded(['mine', 'a'], ['a', 'b']), ['mine', 'a', 'b']);
});

// ---------- offer.js 흐름: import 줄을 빼고 흉내 낸 실리태번 · 상태를 붙여 불러온다
class El {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.className = ''; this.textContent = ''; this.type = ''; this.checked = false; this.value = ''; }
    append(...nodes) { this.children.push(...nodes); }
    *walk() { for (const child of this.children) { yield child; yield* child.walk(); } }
}
globalThis.document = { createElement: tag => new El(tag) };

const T = globalThis.__mrOffer = {
    core, SOURCES,
    known: {}, page: {}, store: { sources: {}, picks: {}, offered: {} },
    saves: 0, applied: [], popups: [], answer: 1, onPopup: null,
};
const prelude = `const T=globalThis.__mrOffer;const {pickNew,withAdded,withOffered}=T.core;const SOURCES=T.SOURCES;const TITLE='모델 등록';
const POPUP_RESULT={AFFIRMATIVE:1,NEGATIVE:0,CANCELLED:null};const POPUP_TYPE={TEXT:1,CONFIRM:2};
const LM={get KNOWN(){return T.known;},pageModels:id=>T.page[id]??[]};
const settings=()=>T.store;const saveSettings=()=>{T.saves++;};const modelsOf=id=>T.store.sources[id]??[];
const setModels=(id,list)=>{T.store.sources[id]=[...list];T.saves++;return list;};const applyOne=id=>{T.applied.push(id);};
const callGenericPopup=async(content,type,input,options)=>{T.popups.push({content,type,options});if(T.onPopup)await T.onPopup(content);return T.answer;};
`;
const source = (await fs.readFile(path.join(dir, 'offer.js'), 'utf8')).replace(/^import .*;$/gm, '');
assert.ok(!/^import /m.test(source), 'offer.js 의 import 줄은 한 줄씩 ; 로 끝나야 이 시험이 뺄 수 있다');
const M = await import('data:text/javascript;base64,' + Buffer.from(prelude + source).toString('base64'));
const boxesOf = content => [...content.walk()].filter(el => el.tagName === 'INPUT');
const textOf = content => [...content.walk()].map(el => el.textContent).filter(Boolean);

await ok('새 모델이 없으면 팝업 없음', async () => {
    T.known = { claude: ['claude-old'], vertexai: ['gemini-old'] };
    T.page = { claude: ['claude-old'], vertexai: ['gemini-old'] };
    assert.deepEqual(await M.offerNewModels(), []);
    assert.equal(T.popups.length, 0);
    assert.equal(T.saves, 0, '아무것도 적지 않는다');
});

await ok('묻고 · 체크한 것만 등록 끝에 · 뺀 것도 물어본 것으로 · 다시 묻지 않음', async () => {
    T.known = { claude: ['claude-new-b', 'claude-new-a', 'claude-old'], vertexai: ['gemini-argon', 'gemini-old'], openrouter: ['x/new'] };
    T.page = { claude: ['claude-old'], vertexai: ['gemini-old'], openrouter: ['x/old'] };
    T.store.sources = { claude: ['claude-mine'] };
    T.onPopup = content => {
        assert.equal(content.className, 'mr-offer');
        const boxes = boxesOf(content);
        assert.deepEqual(boxes.map(box => [box.value, box.checked, box.type]), [['claude-new-b', true, 'checkbox'], ['claude-new-a', true, 'checkbox'], ['gemini-argon', true, 'checkbox']], '처음엔 모두 체크');
        assert.deepEqual(textOf(content).slice(0, 2), ['새 모델을 추가할까요?', 'Claude']);
        assert.ok(textOf(content).includes('Google Vertex AI') && !textOf(content).includes('OpenRouter'));
        boxes[1].checked = false;
    };
    const added = await M.offerNewModels();
    const popup = T.popups.at(-1);
    assert.equal(popup.type, 2);
    assert.equal(popup.options.okButton, '추가');
    assert.equal(popup.options.cancelButton, '안 함');
    assert.deepEqual(added, [{ source: 'claude', models: ['claude-new-b'] }, { source: 'vertexai', models: ['gemini-argon'] }]);
    assert.deepEqual(T.store.sources, { claude: ['claude-mine', 'claude-new-b'], vertexai: ['gemini-argon'] }, '등록한 것 뒤에 붙는다');
    assert.deepEqual(T.applied, ['claude', 'vertexai'], '메뉴에 바로 넣는다');
    assert.deepEqual(T.store.offered, { claude: ['claude-new-b', 'claude-new-a'], vertexai: ['gemini-argon'] }, '뺀 것도 다시 묻지 않는다');
    T.onPopup = null;
    const count = T.popups.length;
    assert.deepEqual(await M.offerNewModels(), []);
    assert.equal(T.popups.length, count, '같은 이름으로는 다시 묻지 않는다');
});

await ok('「안 함」이면 등록 없이 물어본 것만 적고, 다음 업데이트의 새 이름만 다시 묻는다', async () => {
    T.known.claude = ['claude-next', ...T.known.claude];
    T.answer = 0;
    T.applied = [];
    const before = JSON.stringify(T.store.sources);
    assert.deepEqual(await M.offerNewModels(), []);
    assert.deepEqual(boxesOf(T.popups.at(-1).content).map(box => box.value), ['claude-next'], '새로 생긴 이름만');
    assert.equal(JSON.stringify(T.store.sources), before);
    assert.deepEqual(T.applied, []);
    assert.ok(T.store.offered.claude.includes('claude-next'));
    T.answer = null;
    T.known.vertexai = ['gemini-next', ...T.known.vertexai];
    assert.deepEqual(await M.offerNewModels(), [], '닫기(Esc)도 안 함과 같다');
    assert.ok(T.store.offered.vertexai.includes('gemini-next'));
});

await ok('묻는 동안 또 부르면 팝업은 하나', async () => {
    T.known.claude = ['claude-twice', ...T.known.claude];
    T.answer = 1;
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    T.onPopup = () => gate;
    const count = T.popups.length;
    const first = M.offerNewModels();
    assert.deepEqual(await M.offerNewModels(), []);
    release();
    assert.deepEqual(await first, [{ source: 'claude', models: ['claude-twice'] }]);
    assert.equal(T.popups.length, count + 1);
    T.onPopup = null;
});

await ok('부르는 자리: 실리태번 로딩 뒤 한 번 (index.js) · 설정 기본값 (state.js) · 스타일', async () => {
    const index = await fs.readFile(path.join(dir, 'index.js'), 'utf8');
    assert.match(index, /^import \{ offerNewModels \} from '\.\/offer\.js';$/m);
    assert.match(index, /offerWhenReady\(\);/);
    const state = await fs.readFile(path.join(dir, 'state.js'), 'utf8');
    assert.match(state, /offered: \{\}/);
    assert.match(state, /store\.offered = \{\};/);
    assert.ok(!/live-models/.test(state.replace(/\/\/.*$/gm, '')), 'state.js 는 live-models.js 를 불러오지 않는다');
    const css = await fs.readFile(path.join(dir, 'style.css'), 'utf8');
    assert.match(css, /\.mr-offer \{/);
});

delete globalThis.__mrOffer;
delete globalThis.document;
console.log(`PASS model-register offer (${n})`);
