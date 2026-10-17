// 캐릭터 에셋 — 서버의 그림 파일을 바꾸는 길 (지우면 되돌릴 수 없는 것들)
//   1) assets.js renameAsset: 새 이름으로 올린 뒤 옛 파일 지우기 · 대소문자만 다른 기존 파일 · 옛 파일을 못 지우면 partial · 못 올리면 그대로
//   2) panel.js 프리셋 이름 바꾸기(renamePresetFlow): 새 폴더에 전부 올린 뒤에만 옛 폴더를 지움 · 꺼짐/경량화 기록 · 다른 카드의 링크 유지,
//      하나라도 못 올리면 올린 사본을 치우고 그만둠 · 다시 읽기 실패/빈 목록/확장자만 다른 쌍둥이/대소문자만 바꾸기는 손대지 않음
//   3) panel.js 프리셋 지우기(deletePresetFlow): 취소 · 지우기 실패 시 프리셋 남김 · 확인 중 캐릭터가 바뀌면 그만둠
//   4) panel.js 고른 그림 옮기기(bulkMove) · 지우기(bulkDelete): 꺼짐 상태를 그 파일이 가지고 감(10-06), 덮어쓴 같은 이름의 꺼짐은 지움, 쌍둥이는 옮기지 않음
//   5) store.js 다시 읽기: 확장자만 바뀐 그림의 꺼짐을 새 이름으로 · 없는 파일의 경량화 기록 정리
// 실리태번 /api/sprites 는 메모리 속 가짜 서버 (올리기는 같은 이름(확장자 무관)을 먼저 지우고, 지우기도 같은 이름을 모두 지운다 — 실리태번과 같은 규칙).
// panel.js 는 import 줄을 떼고 값으로 넣은 뒤, 모듈 안의 흐름 함수를 그대로 내보내 부른다. 네트워크 · 디스크 쓰기 없음.
//   node tools/tests/assets-file-flows.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const presets = await import(pathToFileURL(path.join(root, 'src/addons/assets/presets.js')).href);
const names = await import(pathToFileURL(path.join(root, 'src/addons/assets/names.js')).href);

let moduleId = 0;
const bindings = globalThis.__assetFileFlowsTest = {};
/** import 줄의 이름들 (중괄호 안 · as 별칭 포함) */
function importedNames(source) {
    const out = [];
    for (const match of source.matchAll(/^import\s+\{([^}]*)\}\s+from\s/gm)) {
        for (const part of match[1].split(',')) {
            const name = part.trim();
            if (name) out.push((/\s+as\s+(\w+)$/.exec(name) || [, name])[1]);
        }
    }
    return out;
}
/** src/addons/assets/<name> 을 import 줄 없이 읽고, 넘긴 값을 그 이름으로 묶어 새 모듈로 연다. 넘기지 않은 이름은 부르면 터지는 가짜 */
async function load(name, imports = {}, tail = '') {
    const id = ++moduleId;
    const raw = read(`src/addons/assets/${name}`).replace(/\r\n/g, '\n');
    const wanted = [...new Set([...importedNames(raw), ...Object.keys(imports)])];
    bindings[id] = new Proxy(imports, { get: (target, key) => key in target ? target[key] : () => { throw new Error(`시험에서 부르지 않을 함수: ${String(key)}`); } });
    const source = raw.replace(/^import\s[^\n]*(?:\n|$)/gm, '');
    const prelude = `const {${wanted.join(',')}} = globalThis.__assetFileFlowsTest[${id}];\n`;
    return import('data:text/javascript;base64,' + Buffer.from(prelude + source + tail).toString('base64'));
}

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n' + String(error.stack || error).replace(/data:text\/javascript;base64,[\w+/=]+/g, 'data:…')); }
}
async function quiet(fn) {
    const saved = [console.error, console.warn];
    console.error = console.warn = () => {};
    try { return await fn(); } finally { [console.error, console.warn] = saved; }
}

// ── 가짜 실리태번 /api/sprites ──
function makeServer() {
    const folders = new Map();
    const writes = [];
    const fail = { list: new Set(), upload: new Set(), delete: new Set() };
    const baseOf = file => { const at = file.lastIndexOf('.'); return at > 0 ? file.slice(0, at) : file; };
    const dir = folder => { if (!folders.has(folder)) folders.set(folder, new Map()); return folders.get(folder); };
    const server = {
        writes, fail,
        put(folder, file, text = `${folder}:${file}`) { dir(folder).set(file, new TextEncoder().encode(text)); },
        files: folder => [...(folders.get(folder)?.keys() ?? [])].sort(),
        text: (folder, file) => new TextDecoder().decode(folders.get(folder).get(file)),
        drop(folder, file) { folders.get(folder)?.delete(file); },
        async fetch(url, init = {}) {
            const u = new URL(url, 'https://st.invalid');
            if (u.pathname === '/api/sprites/get') {
                const name = u.searchParams.get('name');
                if (fail.list.has(name)) return new Response('', { status: 500 });
                return Response.json(server.files(name).map(file => ({ label: baseOf(file), path: `/characters/${name}/${file}` })));
            }
            if (u.pathname === '/api/sprites/upload') {
                const form = init.body, folder = form.get('name'), label = form.get('spriteName') || form.get('label'), file = form.get('avatar');
                const target = label + (/\.[^.]*$/.exec(file.name)?.[0] ?? '');
                if (fail.upload.has(`${folder}|${target}`)) return new Response('', { status: 500 });
                const bytes = new Uint8Array(await file.arrayBuffer());
                for (const name of [...dir(folder).keys()]) if (baseOf(name) === label) dir(folder).delete(name);
                dir(folder).set(target, bytes);
                writes.push(['upload', folder, target]);
                return new Response('{}', { status: 200 });
            }
            if (u.pathname === '/api/sprites/delete') {
                const { name: folder, label, spriteName } = JSON.parse(init.body);
                const base = spriteName || label;
                if (fail.delete.has(`${folder}|${base}`)) return new Response('', { status: 500 });
                if (!folders.has(folder)) return new Response('', { status: 404 });
                for (const name of [...dir(folder).keys()]) if (baseOf(name) === base) dir(folder).delete(name);
                writes.push(['delete', folder, base]);
                return new Response('', { status: 200 });
            }
            if (u.pathname.startsWith('/characters/')) {
                const parts = u.pathname.slice('/characters/'.length).split('/').map(decodeURIComponent);
                const file = parts.pop(), bytes = folders.get(parts.join('/'))?.get(file);
                return bytes ? new Response(new Blob([bytes], { type: 'image/png' })) : new Response('', { status: 404 });
            }
            throw new Error('예상 밖 요청: ' + url);
        },
    };
    return server;
}

// ── 실제 state · assets · store · panel 을 한 벌로 묶는다 ──
async function harness() {
    const server = makeServer();
    globalThis.fetch = server.fetch;
    const events = [];
    globalThis.document = Object.assign(new EventTarget(), { activeElement: null });
    document.addEventListener('char-assets:deleted', event => events.push(event.detail));
    const ext = {}, toasts = [], answers = { input: [], confirm: [], pick: [] };
    const context = { characters: [{ avatar: 'Nova.png', name: 'Nova' }, { avatar: 'Orbit.png', name: 'Orbit' }], characterId: 0, groupId: null };
    let saves = 0;
    const state = await load('state.js', { extension_settings: ext, getContext: () => context, saveSettingsDebounced: () => { saves++; } });
    state.initSettings();
    const assets = await load('assets.js', { getRequestHeaders: () => ({}), formatKeywordList: names.formatKeywordList });
    const store = await load('store.js', { ...state, ...assets, ...presets, setIndex: () => {}, clearIndex: () => {}, setMemberIndex: () => {}, clearMemberIndexes: () => {} });
    const answer = (list, label) => async (...args) => {
        if (!list.length) throw new Error(`${label} 에 줄 대답이 없어요: ${args[0]}`);
        const next = list.shift();
        return typeof next === 'function' ? next(...args) : next;
    };
    const panel = await load('panel.js', {
        ...state, ...store, ...assets, ...presets, getContext: () => context, PROVIDERS: {},
        toast: (kind, message) => { toasts.push([kind, message]); },
        inputDialog: answer(answers.input, 'inputDialog'), confirmDialog: answer(answers.confirm, 'confirmDialog'), pickDialog: answer(answers.pick, 'pickDialog'),
    }, '\nexport { renamePresetFlow, deletePresetFlow, bulkMove, bulkDelete, selected };\n'
        + 'export function __panelTest(element, key) { if (element) root = element; if (key !== undefined) activeKey = key; return activeKey; }\n');
    const busy = [];
    panel.__panelTest({ classList: { toggle: (name, on) => busy.push(on) } });
    return { server, ext, context, state, assets, store, panel, toasts, answers, events, busy, get saves() { return saves; }, settings: () => state.settings() };
}
const key = (folder, file) => JSON.stringify([folder, file]);

/** Nova: 원본(smile.png) + Season(s1, s2) · s2 꺼짐 · 경량화 기록 · Orbit 카드가 Season 을 불러 씀 */
async function withSeason() {
    const h = await harness();
    h.server.put('Nova', 'smile.png'); h.server.put('Nova/Season', 's1.png'); h.server.put('Nova/Season', 's2.png');
    const s = h.settings();
    s.presets.Nova = [{ id: presets.BASE_ID, name: '', enabled: true }, { id: 'pseason', name: 'Season', enabled: true }];
    s.disabled['Nova/Season'] = ['s2.png'];
    s.optimizedImages = { [key('Nova/Season', 's1.png')]: 'hash-s1', [key('Nova', 'smile.png')]: 'hash-smile' };
    s.links.Orbit = [{ owner: 'Nova', presetId: 'pseason', enabled: true }];
    await h.store.reload();
    assert.deepEqual(h.store.runtime.sources.map(source => source.key), ['Nova', 'Nova/Season']);
    return h;
}

// ---------- 1) renameAsset
await test('renameAsset: 새 이름으로 같은 바이트를 올린 뒤(그 사이 afterUpload) 옛 파일을 지움 · 대소문자만 다른 기존 파일도 지움', async () => {
    const h = await harness();
    h.server.put('Nova', 'smile.png', 'smile-bytes'); h.server.put('Nova', 'bee.png', 'bee-bytes');
    let list = await h.assets.fetchAssets('Nova');
    const seen = [];
    await h.assets.renameAsset(list.find(a => a.file === 'smile.png'), 'grin', { afterUpload: () => seen.push(h.server.files('Nova')) });
    assert.deepEqual(seen, [['bee.png', 'grin.png', 'smile.png']], '새 파일이 생긴 직후, 옛 파일을 지우기 전에 부른다');
    assert.deepEqual(h.server.files('Nova'), ['bee.png', 'grin.png']);
    assert.equal(h.server.text('Nova', 'grin.png'), 'smile-bytes');
    list = await h.assets.fetchAssets('Nova');
    const bee = list.find(a => a.file === 'bee.png');
    await h.assets.renameAsset(list.find(a => a.file === 'grin.png'), 'Bee', { taken: bee });
    assert.deepEqual(h.server.files('Nova'), ['Bee.png'], '서버는 대소문자까지 같은 이름만 지우므로 bee.png 는 여기서 지운다');
    assert.equal(h.server.text('Nova', 'Bee.png'), 'smile-bytes');
});

await test('renameAsset: 옛 파일을 못 지우면 partial 오류 (새 파일은 남음) · 올리기가 실패하면 옛 파일 그대로, afterUpload 도 안 부름', async () => {
    const h = await harness();
    h.server.put('Nova', 'smile.png', 'smile-bytes');
    let asset = (await h.assets.fetchAssets('Nova'))[0];
    h.server.fail.delete.add('Nova|smile');
    await assert.rejects(h.assets.renameAsset(asset, 'grin'), error => error.partial === true && /smile\.png/.test(error.message));
    assert.deepEqual(h.server.files('Nova'), ['grin.png', 'smile.png']);
    h.server.fail.delete.clear();
    asset = (await h.assets.fetchAssets('Nova')).find(a => a.file === 'smile.png');
    h.server.fail.upload.add('Nova|calm.png');
    let called = false;
    await assert.rejects(h.assets.renameAsset(asset, 'calm', { afterUpload: () => { called = true; } }), error => !error.partial);
    assert.equal(called, false);
    assert.deepEqual(h.server.files('Nova'), ['grin.png', 'smile.png']);
    await assert.rejects(h.assets.uploadImage('Nova', new File(['x'], 'notes.txt'), 'notes'), /지원하지 않는 형식/);
    await assert.rejects(h.assets.uploadImage('Nova', new File(['x'], 'a.png'), ' /:* '), /비어 있어요/);
    assert.equal(h.server.writes.filter(w => w[0] === 'upload').length, 1, '거른 파일은 서버에 보내지 않는다');
});

// ---------- 2) 프리셋 이름 바꾸기
await test('프리셋 이름 바꾸기: 새 폴더에 전부 올린 뒤 옛 폴더를 지움 · 같은 id · 꺼짐/경량화 기록이 새 폴더로 · 다른 카드의 링크도 새 폴더를 읽음', async () => {
    const h = await withSeason();
    h.answers.input.push('Winter');
    await h.panel.renamePresetFlow('Nova/Season');
    assert.deepEqual(h.server.files('Nova/Season'), []);
    assert.deepEqual(h.server.files('Nova/Winter'), ['s1.png', 's2.png']);
    assert.equal(h.server.text('Nova/Winter', 's1.png'), 'Nova/Season:s1.png', '같은 바이트');
    const kinds = h.server.writes.map(w => w[0]);
    assert.ok(kinds.lastIndexOf('upload') < kinds.indexOf('delete'), '지우기는 모두 올린 다음');
    const s = h.settings();
    assert.deepEqual(s.presets.Nova.map(p => [p.id, p.name]), [[presets.BASE_ID, ''], ['pseason', 'Winter']]);
    assert.deepEqual(s.disabled['Nova/Winter'], ['s2.png']); assert.equal('Nova/Season' in s.disabled, false);
    assert.deepEqual(s.optimizedImages, { [key('Nova/Winter', 's1.png')]: 'hash-s1', [key('Nova', 'smile.png')]: 'hash-smile' });
    assert.deepEqual(presets.sourcesFor(s, 'Orbit').map(src => src.key), ['Orbit', 'Nova/Winter']);
    assert.deepEqual(h.store.runtime.sources.map(src => src.key), ['Nova', 'Nova/Winter']);
    assert.doesNotMatch(h.store.runtime.keywords, /s2\.png/, '꺼 둔 그림은 이름을 바꿔도 AI 목록에 새지 않는다');
    assert.match(h.store.runtime.keywords, /s1\.png/);
    assert.equal(h.toasts.at(-1)[0], 'success');
    assert.deepEqual(h.busy, [true, false]);
});

await test('프리셋 이름 바꾸기: 하나라도 못 올리면 새 폴더의 사본을 치우고 그만둠 — 옛 폴더 · 이름 · 꺼짐 · 기록 그대로', async () => {
    const h = await withSeason();
    const before = JSON.stringify(h.settings());
    h.server.fail.upload.add('Nova/Winter|s2.png');
    h.answers.input.push('Winter');
    await quiet(() => h.panel.renamePresetFlow('Nova/Season'));
    assert.deepEqual(h.server.files('Nova/Season'), ['s1.png', 's2.png']);
    assert.deepEqual(h.server.files('Nova/Winter'), [], '먼저 올린 s1 사본은 지운다');
    assert.equal(JSON.stringify(h.settings()), before);
    assert.equal(h.toasts.at(-1)[0], 'error');
    assert.deepEqual(h.busy, [true, false], '바쁨 표시는 풀린다');
});

await test('프리셋 이름 바꾸기 거절: 다시 읽기 실패 · 빈 목록(못 읽었을 수 있음) · 확장자만 다른 쌍둥이 · 대소문자만 바꾸기 · 원본 · 불러온 폴더 → 서버도 설정도 그대로', async () => {
    const tries = [
        ['다시 읽기 실패', h => { h.server.fail.list.add('Nova/Season'); h.answers.input.push('Winter'); }, 'Nova/Season'],
        ['빈 목록', h => { h.server.drop('Nova/Season', 's1.png'); h.server.drop('Nova/Season', 's2.png'); h.answers.input.push('Winter'); }, 'Nova/Season'],
        ['쌍둥이', h => { h.server.put('Nova/Season', 's1.jpg'); h.answers.input.push('Winter'); }, 'Nova/Season'],
        ['대소문자만', h => { h.answers.input.push('season'); }, 'Nova/Season'],
        ['취소', h => { h.answers.input.push(null); }, 'Nova/Season'],
        ['원본', () => {}, 'Nova'],
    ];
    for (const [label, arrange, target] of tries) {
        const h = await withSeason();
        arrange(h);
        const before = JSON.stringify(h.settings()), files = [h.server.files('Nova'), h.server.files('Nova/Season')];
        await quiet(() => h.panel.renamePresetFlow(target));
        assert.deepEqual(h.server.writes, [], `${label}: 서버에 쓰지 않음`);
        assert.equal(JSON.stringify(h.settings()), before, `${label}: 설정 그대로`);
        assert.deepEqual([h.server.files('Nova'), h.server.files('Nova/Season')], files, label);
        assert.equal(h.answers.input.length, 0, `${label}: 준비한 대답을 다 썼다`);
    }
    const h = await withSeason();
    h.context.characterId = 1; await h.store.reload();
    assert.deepEqual(h.store.runtime.sources.map(src => [src.key, src.own]), [['Orbit', true], ['Nova/Season', false]]);
    await h.panel.renamePresetFlow('Nova/Season');
    assert.deepEqual(h.server.writes, [], '불러온 남의 폴더는 이 카드에서 이름을 바꾸지 않는다');
    assert.equal(h.settings().presets.Nova[1].name, 'Season');
});

// ---------- 3) 프리셋 지우기
await test('프리셋 지우기: 취소하면 그대로 · 확인하면 그림 · 프리셋 · 꺼짐 · 그 폴더 기록만 지우고 원본 기록은 남김, 지운 파일을 알림', async () => {
    const h = await withSeason();
    h.panel.__panelTest(undefined, 'Nova/Season');
    h.answers.confirm.push(false);
    await h.panel.deletePresetFlow();
    assert.deepEqual(h.server.writes, []); assert.equal(h.settings().presets.Nova.length, 2);
    h.answers.confirm.push(text => { assert.match(text, /그림 2장/); return true; });
    await h.panel.deletePresetFlow();
    const s = h.settings();
    assert.deepEqual(h.server.files('Nova/Season'), []);
    assert.deepEqual(h.server.files('Nova'), ['smile.png'], '원본 폴더는 건드리지 않는다');
    assert.deepEqual(s.presets.Nova.map(p => p.id), [presets.BASE_ID]);
    assert.equal('Nova/Season' in s.disabled, false);
    assert.deepEqual(s.optimizedImages, { [key('Nova', 'smile.png')]: 'hash-smile' });
    assert.deepEqual(h.events, [{ folder: 'Nova/Season', files: ['s1.png', 's2.png'] }]);
    assert.equal(h.panel.__panelTest(undefined), 'Nova', '보던 폴더는 원본으로');
});

await test('프리셋 지우기: 한 장이라도 못 지우면 프리셋 · 꺼짐 목록은 남김 · 확인하는 사이 캐릭터가 바뀌면 하나도 안 지움 · 원본은 못 지움', async () => {
    const h = await withSeason();
    h.panel.__panelTest(undefined, 'Nova/Season');
    h.server.fail.delete.add('Nova/Season|s2');
    h.answers.confirm.push(true);
    await quiet(() => h.panel.deletePresetFlow());
    assert.deepEqual(h.server.files('Nova/Season'), ['s2.png']);
    assert.equal(h.settings().presets.Nova.length, 2);
    assert.deepEqual(h.settings().disabled['Nova/Season'], ['s2.png']);
    assert.equal(h.settings().optimizedImages[key('Nova/Season', 's1.png')], undefined, '지운 s1 의 기록만 정리');
    assert.equal(h.toasts.at(-1)[0], 'error');

    const g = await withSeason();
    g.panel.__panelTest(undefined, 'Nova/Season');
    g.answers.confirm.push(async () => { g.context.characterId = 1; await g.store.reload(); return true; });
    await g.panel.deletePresetFlow();
    assert.deepEqual(g.server.writes, []);
    assert.deepEqual(g.server.files('Nova/Season'), ['s1.png', 's2.png']);
    assert.equal(g.settings().presets.Nova.length, 2);

    const b = await withSeason();
    b.panel.__panelTest(undefined, 'Nova');
    await b.panel.deletePresetFlow();
    assert.deepEqual(b.server.writes, []); assert.equal(b.answers.confirm.length, 0);
});

// ---------- 4) 고른 그림 옮기기 · 지우기
await test('고른 그림 옮기기: 꺼짐은 옮긴 파일이 가지고 감 · 덮어쓴 같은 이름(calm.jpg)의 꺼짐은 지움(10-06) · 경량화 기록 복사 · 쌍둥이는 그대로', async () => {
    const h = await withSeason();
    h.server.put('Nova', 'calm.png'); h.server.put('Nova', 'twin.png'); h.server.put('Nova', 'twin.jpg'); h.server.put('Nova/Season', 'calm.jpg');
    const s = h.settings();
    s.disabled.Nova = ['smile.png']; s.disabled['Nova/Season'] = ['calm.jpg', 's2.png'];
    await h.store.reload();
    h.panel.__panelTest(undefined, 'Nova');
    for (const group of ['smile', 'calm', 'twin']) h.panel.selected.add(group);
    h.answers.pick.push((text, options) => { assert.deepEqual(options.map(o => o.value), ['Nova/Season']); return 'Nova/Season'; });
    await h.panel.bulkMove();
    assert.deepEqual(h.server.files('Nova'), ['twin.jpg', 'twin.png'], '확장자만 다른 쌍둥이는 옮기지 않는다 (서버가 한쪽을 지워 버린다)');
    assert.deepEqual(h.server.files('Nova/Season'), ['calm.png', 's1.png', 's2.png', 'smile.png']);
    assert.equal(h.server.text('Nova/Season', 'smile.png'), 'Nova:smile.png');
    assert.equal('Nova' in s.disabled, false, '옛 폴더의 꺼짐은 지운다');
    assert.deepEqual([...s.disabled['Nova/Season']].sort(), ['s2.png', 'smile.png'], 'calm.png 는 켜진 채로 — 덮어쓴 calm.jpg 의 꺼짐을 물려받지 않는다');
    assert.equal(s.optimizedImages[key('Nova/Season', 'smile.png')], 'hash-smile');
    assert.equal(s.optimizedImages[key('Nova', 'smile.png')], undefined);
    assert.equal(h.panel.selected.size, 0);
    assert.ok(h.toasts.some(([kind, text]) => kind === 'warning' && /twin/.test(text)));
    assert.ok(h.toasts.some(([kind, text]) => kind === 'success' && /2장/.test(text)));
    assert.match(h.store.runtime.keywords, /calm\.png/); assert.doesNotMatch(h.store.runtime.keywords, /smile\.png/);
});

await test('고른 그림 옮기기: 올리기에 실패한 그림은 원래 폴더에 그대로 (지우지 않음) · 고른 게 쌍둥이뿐이면 아무것도 안 함', async () => {
    const h = await withSeason();
    h.server.put('Nova', 'calm.png');
    h.settings().disabled.Nova = ['calm.png'];
    await h.store.reload();
    h.panel.__panelTest(undefined, 'Nova');
    h.panel.selected.add('calm'); h.panel.selected.add('smile');
    h.server.fail.upload.add('Nova/Season|calm.png');
    h.answers.pick.push('Nova/Season');
    await quiet(() => h.panel.bulkMove());
    assert.deepEqual(h.server.files('Nova'), ['calm.png']);
    assert.deepEqual(h.server.files('Nova/Season'), ['s1.png', 's2.png', 'smile.png']);
    assert.deepEqual(h.settings().disabled.Nova, ['calm.png'], '못 옮긴 그림의 꺼짐은 그대로');

    const g = await withSeason();
    g.server.put('Nova', 'smile.jpg');
    await g.store.reload();
    g.panel.__panelTest(undefined, 'Nova');
    g.panel.selected.add('smile');
    await g.panel.bulkMove();
    assert.deepEqual(g.server.writes, []); assert.equal(g.answers.pick.length, 0);
});

await test('고른 그림 지우기: 확장자만 다른 같은 이름까지 세어 묻고 함께 지움 · 꺼짐 · 경량화 기록 정리 · 취소하면 그대로', async () => {
    const h = await harness();
    h.server.put('Nova', 'a.png'); h.server.put('Nova', 'a.webp'); h.server.put('Nova', 'b.png');
    const s = h.settings();
    s.randomGroups = false;
    s.disabled.Nova = ['a.webp', 'b.png'];
    s.optimizedImages = { [key('Nova', 'a.webp')]: 'hash-a' };
    await h.store.reload();
    h.panel.__panelTest(undefined, 'Nova');
    h.panel.selected.add('a.png');
    h.answers.confirm.push(false);
    await h.panel.bulkDelete();
    assert.deepEqual(h.server.files('Nova'), ['a.png', 'a.webp', 'b.png']);
    h.panel.selected.add('a.png');
    h.answers.confirm.push(text => { assert.match(text, /2장/); assert.match(text, /1장도 함께/); return true; });
    await h.panel.bulkDelete();
    assert.deepEqual(h.server.files('Nova'), ['b.png']);
    assert.deepEqual(s.disabled.Nova, ['b.png']);
    assert.deepEqual(s.optimizedImages, {});
    assert.deepEqual(h.events.at(-1), { folder: 'Nova', files: ['a.png', 'a.webp'] });
});

// ---------- 5) store.js 다시 읽기
await test('다시 읽기: PC 에서 WebP 로 바꾼 그림의 꺼짐은 새 이름으로 따라가고, 사라진 파일의 경량화 기록만 정리', async () => {
    const h = await harness();
    h.server.put('Nova', 'smile.webp'); h.server.put('Nova', 'calm.png');
    const s = h.settings();
    s.disabled.Nova = ['smile.png'];
    s.optimizedImages = { [key('Nova', 'gone.webp')]: 'h1', [key('Nova', 'smile.webp')]: 'h2', [key('Orbit', 'gone.webp')]: 'h3' };
    await h.store.reload();
    assert.deepEqual(s.disabled.Nova, ['smile.webp']);
    assert.deepEqual(Object.keys(s.optimizedImages).sort(), [key('Nova', 'smile.webp'), key('Orbit', 'gone.webp')].sort());
    assert.doesNotMatch(h.store.runtime.keywords, /smile/);
    h.server.fail.list.add('Nova');
    await quiet(() => h.store.reload());
    assert.deepEqual(s.disabled.Nova, ['smile.webp'], '못 읽으면 정리하지 않는다');
});

delete globalThis.__assetFileFlowsTest;
console.log(`assets-file-flows: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
