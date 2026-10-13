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
    { id: 'openai', label: 'OpenAI', kind: 'select' }, { id: 'claude', label: 'Claude', kind: 'select' }, { id: 'makersuite', label: 'Google AI Studio', kind: 'select' },
    { id: 'vertexai', label: 'Google Vertex AI', kind: 'select' }, { id: 'openrouter', label: 'OpenRouter', kind: 'select', wiped: true }, { id: 'custom', label: 'Custom', kind: 'custom', wiped: true },
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

await ok('1.1.7 pruneStep: 기본 목록에 있는 등록은 빼고 적어 둠 · 기본 목록에서 다시 빠지면 되돌림 · 못 읽으면 그대로', () => {
    const native = new Set(['in', 'old']);
    assert.deepEqual(core.pruneStep(['in', 'mine'], native, []), { keep: ['mine'], gone: ['in'], back: [], memo: ['in'] });
    assert.deepEqual(core.pruneStep(['mine'], native, ['in']), { keep: ['mine'], gone: [], back: [], memo: ['in'] }, '아직 기본 목록에 있으면 그대로 적어 둠');
    assert.deepEqual(core.pruneStep(['mine'], new Set(['old']), ['in']), { keep: ['mine', 'in'], gone: [], back: ['in'], memo: [] }, '기본 목록에서 빠지면 등록 끝으로 되돌림');
    assert.deepEqual(core.pruneStep(['in'], null, ['x']), { keep: ['in'], gone: [], back: [], memo: ['x'] }, '못 읽으면 아무것도 안 바꿈');
    assert.deepEqual(core.pruneStep(['in'], new Set(), []), { keep: ['in'], gone: [], back: [], memo: [] });
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
const prelude = `const T=globalThis.__mrOffer;const {pickNew,pruneStep,withAdded,withOffered}=T.core;const SOURCES=T.SOURCES;const TITLE='모델 등록';
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

await ok('1.1.7 pruneNative: 실리태번 기본 목록(index.html 원본)에 들어온 등록은 빼고 · 다시 빠지면 되돌림 · 받아 오는 목록 · Custom 은 그대로', async () => {
    T.store.sources = { claude: ['claude-in-st', 'claude-mine'], openrouter: ['x/in-list'], custom: ['c-in'], vertexai: ['gemini-only-mine'] };
    T.store.picks = {};
    T.store.pruned = {};
    T.applied = [];
    const lists = { claude: new Set(['claude-in-st', 'claude-old']), openrouter: new Set(['x/in-list']), custom: new Set(['c-in']), vertexai: new Set(['gemini-old']) };
    assert.deepEqual(await M.pruneNative(lists), [{ source: 'claude', gone: ['claude-in-st'], back: [] }]);
    assert.deepEqual(T.store.sources, { claude: ['claude-mine'], openrouter: ['x/in-list'], custom: ['c-in'], vertexai: ['gemini-only-mine'] });
    assert.deepEqual(T.store.pruned, { claude: ['claude-in-st'] });
    assert.deepEqual(T.applied, ['claude'], '바뀐 공급자 메뉴만 다시 넣는다');
    assert.deepEqual(await M.pruneNative(lists), [], '두 번째는 할 일 없음');
    lists.claude = new Set(['claude-old']);
    assert.deepEqual(await M.pruneNative(lists), [{ source: 'claude', gone: [], back: ['claude-in-st'] }], '실리태번 목록에서 다시 빠지면 되돌린다');
    assert.deepEqual(T.store.sources.claude, ['claude-mine', 'claude-in-st']);
    assert.deepEqual(T.store.pruned, {});
    T.store.sources.claude = ['claude-in-st'];
    assert.deepEqual(await M.pruneNative({}), [], '그 공급자 목록을 못 읽으면 건드리지 않는다');
    assert.deepEqual(T.store.sources.claude, ['claude-in-st']);
});

await ok('부르는 자리: 실리태번 로딩 뒤 한 번 (index.js) · 설정 기본값 (state.js) · 스타일', async () => {
    const index = await fs.readFile(path.join(dir, 'index.js'), 'utf8');
    assert.match(index, /^import \{ offerNewModels, pruneNative \} from '\.\/offer\.js';$/m);
    assert.match(index, /offerWhenReady\(\);/);
    assert.ok(index.indexOf('pruneNative()') > 0 && index.indexOf('pruneNative()') < index.indexOf('offerNewModels()'), '정리 먼저, 그다음 묻기');
    const panel = await fs.readFile(path.join(dir, 'panel.js'), 'utf8');
    assert.match(panel, /\(await builtInLists\(\)\)\?\.\[sourceId\]\?\.has\(name\)/, '등록 창: 기본 목록에 있는 이름은 넣지 않는다');
    const offerSrc = await fs.readFile(path.join(dir, 'offer.js'), 'utf8');
    assert.match(offerSrc, /new DOMParser\(\)\.parseFromString\(html, 'text\/html'\)/, '기본 목록은 index.html 원본에서');
    const state = await fs.readFile(path.join(dir, 'state.js'), 'utf8');
    assert.match(state, /offered: \{\}/);
    assert.match(state, /store\.offered = \{\};/);
    assert.match(state, /store\.pruned = \{\};/);
    assert.ok(!/live-models/.test(state.replace(/\/\/.*$/gm, '')), 'state.js 는 live-models.js 를 불러오지 않는다');
    const css = await fs.readFile(path.join(dir, 'style.css'), 'utf8');
    assert.match(css, /\.mr-offer \{/);
});

delete globalThis.__mrOffer;
delete globalThis.document;
console.log(`PASS model-register offer (${n})`);
