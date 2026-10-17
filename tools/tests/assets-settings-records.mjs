// 캐릭터 에셋 — 사용자 설정을 바꾸는 길 (state.js · presets.js · index.js 의 이어서 쓰기 씨앗)
//   1) 처음 켤 때 옛 확장(character-assets) 설정 옮기기: 손대지 않은 옛 기본 규칙 → 새 기본, 번호 키 · 중복 · 빈 이름 정리, 한 번만 저장
//   2) 망가진 저장 값 바로잡기 · 사용자가 끈 스위치는 그대로 · 사용법 접기는 한 번만
//   3) 꺼 둔 그림 (setDisabled · pruneDisabled — 확장자만 바뀐 그림은 새 이름으로 따라감) · 경량화 기록 (prune/forget/copyOptimized)
//   4) 프리셋 · 불러온 폴더 편집 (이름 다듬기 · 만들기 · 이름 검사 · 지우기 · 순서 · 링크) 과 읽기 전용 계산이 설정을 만들지 않는 것
//   5) 이어서 쓰기 때 채팅 메시지 extra.eh_seed 를 한 번만 남기기 (index.js 의 GENERATION_STARTED 처리기를 원문에서 잘라 실행)
// 실리태번 모듈은 import 줄을 떼고 값으로 넣는다 (character-assets-prompt.mjs 와 같은 방식). 네트워크 · 파일 쓰기 없음.
//   node tools/tests/assets-settings-records.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let moduleId = 0;
const bindings = globalThis.__assetRecordsTest = {};
/** src/addons/assets/<name> 을 import 줄 없이 읽고, 넘긴 값을 그 이름으로 묶어 새 모듈로 연다 (부를 때마다 새 인스턴스) */
async function load(name, imports = {}, tail = '') {
    const id = ++moduleId;
    bindings[id] = imports;
    const source = read(`src/addons/assets/${name}`).replace(/^import\s[^\n]*(?:\n|$)/gm, '');
    const prelude = `const {${Object.keys(imports).join(',')}} = globalThis.__assetRecordsTest[${id}];\n`;
    return import('data:text/javascript;base64,' + Buffer.from(prelude + source + tail).toString('base64'));
}
const P = await import(pathToFileURL(path.join(root, 'src/addons/assets/presets.js')).href);

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n' + String(error.stack || error).replace(/data:text\/javascript;base64,[\w+/=]+/g, 'data:…')); }
}

async function stateOf(ext = {}) {
    let saves = 0;
    const context = { characters: [{ avatar: 'Nova.png' }], characterId: 0, groupId: null };
    const S = await load('state.js', { extension_settings: ext, getContext: () => context, saveSettingsDebounced: () => { saves++; } },
        '\nexport const __legacyPrompt = LEGACY_DEFAULT_PROMPT;\n');
    return { S, ext, context, get saves() { return saves; } };
}
const key = (folder, file) => JSON.stringify([folder, file]);

// ---------- 1) 옛 확장 설정 옮기기
await test('옮기기: 손대지 않은 옛 기본 규칙은 (줄바꿈 · 빈칸 · ` 가 달라도) 새 기본 규칙으로, 빈 규칙도 새 기본', async () => {
    const probe = await stateOf();
    const legacy = probe.S.__legacyPrompt;
    assert.ok(legacy.length > 200, '옛 기본 규칙을 원문에서 읽었다');
    for (const old of [legacy, legacy.replace(/\n/g, '\r\n   '), legacy.replace(/`/g, ' '), '   ', '']) {
        const f = await stateOf({ 'character-assets': { imagePrompt: old } });
        f.S.initSettings();
        assert.equal(f.S.settings().prompt, f.S.DEFAULT_PROMPT, JSON.stringify(old.slice(0, 30)));
        assert.equal(f.S.settings().migratedFrom, 'character-assets');
    }
    const custom = await stateOf({ 'character-assets': { imagePrompt: legacy + '\nAlso keep it short.' } });
    custom.S.initSettings();
    assert.equal(custom.S.settings().prompt, legacy + '\nAlso keep it short.', '한 줄이라도 고친 규칙은 그대로 옮긴다');
});

await test('옮기기: 꺼 둔 그림은 폴더 키만 (번호 키 · 망가진 항목 버림), 중복 · 빈 이름 · 글자가 아닌 값 정리, 크기 small/medium, 스위치는 참/거짓일 때만', async () => {
    const f = await stateOf({ 'character-assets': {
        renderer: { enabled: 'yes', randomAsset: false },
        gallerySettings: { gridSize: 'small' },
        characterAssets: {
            0: { disabledAssets: ['by-number.png'] },
            12: { disabledAssets: ['also-number.png'] },
            Nova: { disabledAssets: ['a.png', 'a.png', '', 7, null, 'b.png'] },
            Orbit: { disabledAssets: [] },
            Broken: null,
            Text: 'not an object',
            Quill: { disabledAssets: 'c.png' },
        },
    } });
    f.S.initSettings();
    const s = f.S.settings();
    assert.deepEqual(s.disabled, { Nova: ['a.png', 'b.png'] });
    assert.equal(s.thumbSize, 's');
    assert.equal(s.renderEnabled, true, '참/거짓이 아닌 옛 값은 무시하고 기본 켬');
    assert.equal(s.randomGroups, false);
    assert.equal(f.saves, 1, '처음 만들 때 한 번 저장');
    const medium = await stateOf({ 'character-assets': { gallerySettings: { gridSize: 'medium' } } });
    medium.S.initSettings();
    assert.equal(medium.S.settings().thumbSize, 'm');
});

await test('옮기기는 처음 한 번뿐: 옛 설정이 없으면 기본값만 (migratedFrom 없음), 이미 있는 새 설정은 옛 설정이 나중에 생겨도 덮지 않음', async () => {
    const ext = {};
    const f = await stateOf(ext);
    f.S.initSettings();
    assert.equal(ext.esetham.prompt, f.S.DEFAULT_PROMPT);
    assert.equal('migratedFrom' in ext.esetham, false);
    assert.deepEqual(ext.esetham.disabled, {});
    assert.equal(f.saves, 1);
    ext.esetham.prompt = 'Mine {{img_keywords_autogen}}';
    ext['character-assets'] = { imagePrompt: 'Old rules', characterAssets: { Nova: { disabledAssets: ['x.png'] } } };
    const before = ext.esetham;
    f.S.initSettings();
    assert.equal(ext.esetham, before, '같은 객체를 그대로 쓴다');
    assert.equal(ext.esetham.prompt, 'Mine {{img_keywords_autogen}}');
    assert.deepEqual(ext.esetham.disabled, {});
    assert.equal(f.saves, 1, '두 번째 초기화는 저장하지 않는다');
});

// ---------- 2) 저장 값 바로잡기
await test('망가진 저장 값은 기본으로, 사용자가 끈 스위치 · 고른 값은 그대로; 사용법 접기는 6.2.0 에 한 번만', async () => {
    const ext = { esetham: { prompt: 42, promptEnabled: false, promptPlacement: 'sideways', renderEnabled: false, randomGroups: false, onceOnly: false,
        thumbSize: 'xl', guideOpen: true, disabled: ['a.png'], presets: 'x', links: null, pick: { enabled: 'yes', count: 99, connection: 'mystery' } } };
    const f = await stateOf(ext);
    f.S.initSettings();
    const s = ext.esetham;
    assert.equal(s.prompt, f.S.DEFAULT_PROMPT);
    assert.equal(s.promptEnabled, false); assert.equal(s.renderEnabled, false); assert.equal(s.randomGroups, false); assert.equal(s.onceOnly, false);
    assert.equal(s.promptPlacement, 'auto'); assert.equal(s.thumbSize, 'm');
    assert.deepEqual(s.disabled, {}); assert.deepEqual(s.presets, {}); assert.deepEqual(s.links, {});
    assert.equal(s.pick.enabled, false); assert.equal(s.pick.count, 4); assert.equal(s.pick.connection, 'current');
    assert.equal(s.guideOpen, false, '6.2.0: 지금 쓰는 사람도 한 번은 접는다'); assert.equal(s.guideFolded620, true);
    s.guideOpen = true; f.S.initSettings();
    assert.equal(s.guideOpen, true, '그 뒤에는 사용자가 연 대로');
    const fresh = await stateOf({ esetham: { thumbSize: 'l', promptPlacement: 'manual' } });
    fresh.S.initSettings();
    assert.equal(fresh.ext.esetham.onceOnly, true, '1.1.4 전 설정에는 없던 값 → 기본 켬');
    assert.equal(fresh.ext.esetham.thumbSize, 'l'); assert.equal(fresh.ext.esetham.promptPlacement, 'manual');
});

// ---------- 3) 꺼 둔 그림 · 경량화 기록
await test('setDisabled: 끄기 · 켜기 · 마지막 하나를 켜면 폴더 키를 지움 · 폴더/파일 이름이 비면 아무것도 안 함 (저장도 없음)', async () => {
    const f = await stateOf({ esetham: {} });
    f.S.initSettings();
    const base = f.saves, s = f.S.settings();
    f.S.setDisabled('Nova', 'a.png', true); f.S.setDisabled('Nova', 'b.png', true); f.S.setDisabled('Nova', 'a.png', true);
    assert.deepEqual(s.disabled.Nova, ['a.png', 'b.png']);
    assert.deepEqual([...f.S.disabledSet('Nova')], ['a.png', 'b.png']);
    f.S.setDisabled('Nova', 'a.png', false);
    assert.deepEqual(s.disabled.Nova, ['b.png']);
    f.S.setDisabled('Nova', 'b.png', false);
    assert.equal('Nova' in s.disabled, false, '빈 목록은 남기지 않는다');
    assert.equal(f.saves - base, 5);
    f.S.setDisabled('', 'a.png', true); f.S.setDisabled('Nova', '', true);
    assert.equal(f.saves - base, 5); assert.deepEqual(s.disabled, {});
    assert.equal(f.S.disabledSet('').size, 0);
});

await test('pruneDisabled (1.3.1): 확장자만 바뀐 그림은 새 이름으로 (WebP 우선) · 사라진 파일은 버림 · 겹치면 하나 · 바뀐 게 없으면 저장 안 함', async () => {
    const f = await stateOf({ esetham: {} });
    f.S.initSettings();
    const s = f.S.settings();
    s.disabled.Nova = ['smile.png', 'calm.jpg', 'gone.png', 'keep.png', 'calm.png'];
    let saves = f.saves;
    f.S.pruneDisabled('Nova', ['smile.webp', 'calm.jpg', 'calm.webp', 'keep.png', 'other.png']);
    assert.deepEqual(s.disabled.Nova, ['smile.webp', 'calm.jpg', 'keep.png', 'calm.webp'],
        '그대로 있는 이름은 그대로, 없어진 calm.png 는 같은 이름의 WebP 로, gone.png 는 버림');
    assert.equal(f.saves, saves + 1);
    saves = f.saves;
    f.S.pruneDisabled('Nova', ['smile.webp', 'calm.jpg', 'calm.webp', 'keep.png']);
    assert.equal(f.saves, saves, '이미 맞으면 저장하지 않는다');
    s.disabled.Orbit = ['a.png', 'a.jpg'];
    f.S.pruneDisabled('Orbit', ['a.webp']);
    assert.deepEqual(s.disabled.Orbit, ['a.webp'], '두 옛 이름이 한 새 이름으로 → 하나만');
    s.disabled.Quill = ['x.png'];
    f.S.pruneDisabled('Quill', ['y.png']);
    assert.equal('Quill' in s.disabled, false, '모두 사라지면 키를 지운다');
    s.disabled.Quill = ['x.png'];
    f.S.pruneDisabled('Quill', []);
    assert.deepEqual(s.disabled.Quill, ['x.png'], '빈 목록(못 읽었을 수 있음)으로는 절대 정리하지 않는다');
});

await test('경량화 기록: pruneOptimized 는 그 폴더의 없는 파일만 · forgetOptimized 는 고른 파일 또는 그 폴더 전부 (하위 프리셋은 남김) · 망가진 키는 건드리지 않음', async () => {
    const f = await stateOf({ esetham: {} });
    f.S.initSettings();
    const s = f.S.settings();
    s.optimizedImages = { [key('Nova', 'a.webp')]: 'h1', [key('Nova', 'b.webp')]: 'h2', [key('Nova/Season', 'a.webp')]: 'h3', [key('Orbit', 'a.webp')]: 'h4', 'not json': 'h5', [JSON.stringify(['Nova'])]: 'h6' };
    let saves = f.saves;
    f.S.pruneOptimized('Nova', []);
    assert.equal(Object.keys(s.optimizedImages).length, 6, '빈 목록으로는 지우지 않는다'); assert.equal(f.saves, saves);
    f.S.pruneOptimized('Nova', ['a.webp', 'c.png']);
    assert.deepEqual(Object.keys(s.optimizedImages).sort(), [key('Nova', 'a.webp'), key('Nova/Season', 'a.webp'), key('Orbit', 'a.webp'), 'not json', JSON.stringify(['Nova'])].sort());
    assert.equal(f.saves, saves + 1);
    saves = f.saves;
    f.S.pruneOptimized('Nova', ['a.webp']);
    assert.equal(f.saves, saves, '바뀐 게 없으면 저장 안 함');
    f.S.forgetOptimized('Orbit', ['zzz.webp']);
    assert.equal(s.optimizedImages[key('Orbit', 'a.webp')], 'h4');
    f.S.forgetOptimized('Nova');
    assert.equal(s.optimizedImages[key('Nova', 'a.webp')], undefined);
    assert.equal(s.optimizedImages[key('Nova/Season', 'a.webp')], 'h3', "'Nova' 를 지워도 'Nova/Season' 기록은 남는다");
    assert.equal(s.optimizedImages['not json'], 'h5');
    f.S.forgetOptimized('Nova/Season', ['a.webp']);
    assert.equal(s.optimizedImages[key('Nova/Season', 'a.webp')], undefined);
    delete s.optimizedImages;
    saves = f.saves;
    f.S.forgetOptimized('Nova'); f.S.pruneOptimized('Nova', ['a.png']);
    assert.equal(f.saves, saves, '기록이 없으면 아무 일도 없다');
});

await test('copyOptimized: 같은 바이트를 옮긴 새 자리에 기록을 복사 · 기록 없는 파일로 덮으면 새 자리 기록을 지움 · 같은 자리 · 같은 값은 그대로', async () => {
    const f = await stateOf({ esetham: {} });
    f.S.initSettings();
    const s = f.S.settings();
    let saves = f.saves;
    f.S.copyOptimized('Nova', 'a.webp', 'Nova/Season', 'a.webp');
    assert.equal(s.optimizedImages, undefined, '기록 칸이 없으면 만들지 않는다'); assert.equal(f.saves, saves);
    s.optimizedImages = { [key('Nova', 'a.webp')]: 'h1', [key('Nova/Season', 'b.png')]: 'old' };
    f.S.copyOptimized('Nova', 'a.webp', 'Nova/Season', 'a.webp');
    assert.equal(s.optimizedImages[key('Nova/Season', 'a.webp')], 'h1');
    assert.equal(s.optimizedImages[key('Nova', 'a.webp')], 'h1', '원본 기록은 지우기가 성공한 뒤 따로 정리한다');
    assert.equal(f.saves, saves + 1);
    saves = f.saves;
    f.S.copyOptimized('Nova', 'a.webp', 'Nova/Season', 'a.webp');
    f.S.copyOptimized('Nova', 'a.webp', 'Nova', 'a.webp');
    assert.equal(f.saves, saves, '같은 값 · 같은 자리는 저장하지 않는다');
    f.S.copyOptimized('Nova', 'plain.png', 'Nova/Season', 'b.png');
    assert.equal(key('Nova/Season', 'b.png') in s.optimizedImages, false, '경량화 안 된 파일로 덮어썼으면 옛 기록은 거짓이 된다');
    assert.equal(f.saves, saves + 1);
});

// ---------- 4) 프리셋 · 불러온 폴더
await test('cleanPresetName: 못 쓰는 글자 · 앞의 점 · 끝의 점과 빈칸(1.3.2) 빼기, 40자에서 잘린 이모지 반쪽 떼기(10-06), 빈칸 하나로', () => {
    assert.equal(P.cleanPresetName('Sum/mer:*?"<>|\\'), 'Summer');
    assert.equal(P.cleanPresetName('..hidden'), 'hidden');
    assert.equal(P.cleanPresetName('art.'), 'art');
    assert.equal(P.cleanPresetName('art. . '), 'art');
    assert.equal(P.cleanPresetName('  two   words  '), 'two words');
    assert.equal(P.cleanPresetName('\x00ab\x1fc'), 'abc');
    const cut = P.cleanPresetName('a'.repeat(39) + '\u{1F600}tail');
    assert.equal(cut, 'a'.repeat(39));
    assert.doesNotThrow(() => encodeURIComponent(cut), '잘린 이름으로도 주소를 만들 수 있어야 읽고 지울 수 있다');
    assert.equal(P.cleanPresetName(null), '');
});

await test('addPreset: 원본을 앞에 두고 새 프리셋을 뒤에 · 빈 이름 · 원본 이름 · 대소문자만 다른 같은 이름은 막고 설정을 안 바꿈', () => {
    const store = {};
    const made = P.addPreset(store, 'Nova', '  Winter. ');
    assert.equal(made.name, 'Winter'); assert.equal(made.enabled, true); assert.match(made.id, /^p[0-9a-z]+$/);
    assert.deepEqual(store.presets.Nova.map(item => [item.id === P.BASE_ID ? 'base' : 'new', item.name]), [['base', ''], ['new', 'Winter']]);
    const snapshot = JSON.stringify(store);
    for (const bad of ['', '///', '원본', 'winter', 'WINTER']) assert.throws(() => P.addPreset(store, 'Nova', bad), Error, bad);
    assert.equal(JSON.stringify(store), snapshot);
});

await test('checkRename (1.4.0): 원본 · 없는 프리셋 · 같은 이름 · 대소문자만 바꾸기(윈도우 · 안드로이드에서 같은 폴더) · 다른 프리셋과 겹침은 막고, 설정은 읽기만', () => {
    const store = {};
    const winter = P.addPreset(store, 'Nova', 'Winter');
    P.addPreset(store, 'Nova', 'Spring');
    const snapshot = JSON.stringify(store);
    assert.throws(() => P.checkRename(store, 'Nova', P.BASE_ID, 'Other'), /원본/);
    assert.throws(() => P.checkRename(store, 'Nova', 'missing', 'Other'), /찾지 못/);
    assert.throws(() => P.checkRename(store, 'Nova', winter.id, 'Winter'), /같은 이름/);
    assert.throws(() => P.checkRename(store, 'Nova', winter.id, 'winter'), /대소문자/);
    assert.throws(() => P.checkRename(store, 'Nova', winter.id, 'spring'), /이미 있어요/);
    assert.throws(() => P.checkRename(store, 'Nova', winter.id, '원본'), /원본/);
    assert.throws(() => P.checkRename(store, 'Nova', winter.id, '..'), /이름을 넣어/);
    assert.equal(P.checkRename(store, 'Nova', winter.id, ' Frost. '), 'Frost');
    assert.equal(JSON.stringify(store), snapshot, '검사는 이름을 바꾸지 않는다 (파일을 다 옮긴 뒤에 부르는 쪽이 바꾼다)');
});

await test('removePreset · movePreset: 원본은 못 지움 · 없는 id 는 false · 순서는 끝을 넘지 않음', () => {
    const store = {};
    const a = P.addPreset(store, 'Nova', 'A'), b = P.addPreset(store, 'Nova', 'B');
    const order = () => store.presets.Nova.map(item => item.name || 'base');
    assert.equal(P.removePreset(store, 'Nova', P.BASE_ID), false);
    assert.equal(P.removePreset(store, 'Nova', 'missing'), false);
    assert.equal(P.movePreset(store, 'Nova', P.BASE_ID, -1), false);
    assert.equal(P.movePreset(store, 'Nova', b.id, +1), false);
    assert.equal(P.movePreset(store, 'Nova', 'missing', -1), false);
    assert.equal(P.movePreset(store, 'Nova', b.id, -5), true, '여러 칸을 줘도 한 칸');
    assert.deepEqual(order(), ['base', 'B', 'A']);
    assert.equal(P.removePreset(store, 'Nova', a.id), true);
    assert.deepEqual(order(), ['base', 'B']);
    assert.equal(P.findPreset(store, 'Nova', a.id), null);
});

await test('presetsOf 고치기: 망가진 항목 빼기 · 없는 원본은 맨 앞에 · 원본 이름은 빈칸 · 개발 중 값(shared) 지우기 · 원본만 남으면 무조건 켬(1.2.1)', () => {
    const store = { presets: { Nova: [null, 'x', { id: 'pa', name: 'A', enabled: false, shared: true }, { id: 'nameless' }, { id: P.BASE_ID, name: 'renamed', enabled: false }] } };
    const list = P.presetsOf(store, 'Nova');
    assert.deepEqual(list.map(item => [item.id, item.name, item.enabled]), [['pa', 'A', false], [P.BASE_ID, '', false]]);
    assert.equal('shared' in list[0], false);
    assert.equal(P.presetsOf(store, 'Nova'), store.presets.Nova, '같은 배열을 돌려주므로 고치면 설정에 바로 남는다');
    P.removePreset(store, 'Nova', 'pa');
    assert.equal(P.presetsOf(store, 'Nova')[0].enabled, true, '원본을 끈 채 프리셋을 지우면 다시 켤 길이 없었다');
    const missing = { presets: { Orbit: [{ id: 'pb', name: 'B' }] } };
    assert.deepEqual(P.presetsOf(missing, 'Orbit').map(item => item.id), [P.BASE_ID, 'pb']);
    const broken = { presets: ['x'] };
    P.presetsOf(broken, 'Nova');
    assert.ok(!Array.isArray(broken.presets) && Array.isArray(broken.presets.Nova));
});

await test('링크: 자기 자신 · 망가진 링크 빼기 · 같은 것 두 번 안 넣기 · 빼기 · 켜짐은 이 카드 값 (주인 쪽과 따로)', () => {
    const store = { presets: { Nova: [{ id: P.BASE_ID, name: '', enabled: true }, { id: 'pw', name: 'Winter', enabled: false }] },
        links: { Orbit: [{ owner: 'Orbit', presetId: P.BASE_ID }, { owner: 7, presetId: 'x' }, null, { owner: 'Nova', presetId: 'pw' }] } };
    assert.deepEqual(P.linksOf(store, 'Orbit'), [{ owner: 'Nova', presetId: 'pw', enabled: true }]);
    assert.equal(P.addLink(store, 'Orbit', 'Nova', 'pw'), false, '이미 있음');
    assert.equal(P.addLink(store, 'Orbit', 'Orbit', P.BASE_ID), false, '자기 폴더');
    assert.equal(P.addLink(store, 'Orbit', 'Nova', ''), false);
    assert.equal(P.addLink(store, 'Orbit', 'Nova', P.BASE_ID), true);
    const sources = P.sourcesFor(store, 'Orbit');
    assert.deepEqual(sources.map(item => [item.key, item.own, item.preset.enabled]), [['Orbit', true, true], ['Nova', false, true], ['Nova/Winter', false, true]],
        '불러온 폴더는 주인 쪽 순서대로, 켜짐은 링크 값 (주인 쪽 Winter 는 꺼져 있어도)');
    assert.equal(store.presets.Nova[1].enabled, false, '주인 쪽 값은 그대로');
    assert.equal(P.removeLink(store, 'Orbit', 'Nova', 'pw'), true);
    assert.equal(P.removeLink(store, 'Orbit', 'Nova', 'pw'), false);
    store.links.Orbit.push({ owner: 'Nova', presetId: 'deleted' });
    assert.deepEqual(P.sourcesFor(store, 'Orbit').map(item => item.key), ['Orbit', 'Nova'], '주인이 지운 프리셋은 건너뛴다');
    assert.equal(store.links.Orbit.length, 2, '링크 자체는 남긴다');
});

await test('sourcesFor 는 읽기만 한 캐릭터에 빈 설정을 만들지 않고, 저장된 프리셋은 편집에 쓰는 원래 객체를 돌려준다', () => {
    const store = { presets: { Nova: [{ id: P.BASE_ID, name: '', enabled: true }, { id: 'pw', name: 'Winter', enabled: true }] }, links: {} };
    const plain = P.sourcesFor(store, 'Quill');
    assert.deepEqual(plain.map(item => item.key), ['Quill']);
    assert.equal('Quill' in store.presets, false); assert.equal('Quill' in store.links, false);
    const own = P.sourcesFor(store, 'Nova');
    assert.equal(own[1].preset, store.presets.Nova[1]);
    own[1].preset.name = 'Frost';
    assert.equal(P.sourcesFor(store, 'Nova')[1].key, 'Nova/Frost');
    assert.deepEqual(P.sourcesFor(store, ''), []);
});

await test('mergeAssets (1.3.1): 꺼진 폴더는 빼고, 확장자만 다른 같은 이름은 위 폴더가 이김, 한 폴더 안에서는 둘 다 둠', () => {
    const a = (file, folder) => ({ file, base: file.replace(/\.[^.]+$/, ''), folder });
    const merged = P.mergeAssets([
        { preset: { enabled: true }, assets: [a('smile.png', 'Nova/Winter'), a('twin.png', 'Nova/Winter'), a('twin.jpg', 'Nova/Winter')] },
        { preset: { enabled: false }, assets: [a('hidden.png', 'Nova/Off')] },
        { preset: { enabled: true }, assets: [a('Smile.webp', 'Nova'), a('calm.png', 'Nova'), a('twin.webp', 'Nova')] },
        null,
    ]);
    assert.deepEqual(merged.map(item => `${item.folder}:${item.file}`), ['Nova/Winter:smile.png', 'Nova/Winter:twin.png', 'Nova/Winter:twin.jpg', 'Nova:calm.png']);
});

// ---------- 5) 이어서 쓰기 씨앗 (index.js)
await test('이어서 쓰기(1.4.2): 마지막 메시지 extra.eh_seed 에 첫 시각을 한 번만 — 다시 이어 써도 그대로, 다른 요청 · 미리보기 · 그림 없는 캐릭터 · extra 없음은 손대지 않음', () => {
    const src = read('src/addons/assets/index.js').replace(/\r\n/g, '\n');
    const marker = 'eventSource.on(event_types.GENERATION_STARTED, ';
    const start = src.indexOf(marker);
    assert.ok(start >= 0, 'GENERATION_STARTED 처리기를 찾았다');
    const end = src.indexOf('\n});', start);
    const handlerText = src.slice(start + marker.length, end + 2);
    const runtime = { folder: 'Nova', assets: [{ file: 'smile.png' }] };
    let chat = [];
    const handler = new Function('runtime', 'getContext', 'activeEntry', `return (${handlerText});`)(runtime, () => ({ chat }), context => (context?.groupId ? null : runtime));   // 1.6.9 activeEntry: 1:1 은 runtime

    chat = [{ mes: 'Hi', extra: {} }, { mes: 'Once upon', send_date: 'first-time', extra: { api: 'x' } }];
    handler('continue', {}, false);
    assert.equal(chat[1].extra.eh_seed, 'first-time');
    chat[1].send_date = 'later-time';
    handler('append', {}, false); handler('appendFinal', {}, false);
    assert.equal(chat[1].extra.eh_seed, 'first-time', '이미 있는 씨앗은 덮지 않는다');
    assert.equal(chat[0].extra.eh_seed, undefined, '마지막 메시지만');

    chat = [{ mes: 'A', extra: {} }, { mes: 'B', extra: {} }];
    handler('continue', {}, false);
    assert.equal(chat[1].extra.eh_seed, '1', 'send_date 가 없으면 메시지 번호');

    for (const [type, dry] of [['normal', false], ['swipe', false], ['regenerate', false], ['quiet', false], ['continue', true]]) {
        chat = [{ mes: 'A', send_date: 't', extra: {} }];
        handler(type, {}, dry);
        assert.equal('eh_seed' in chat[0].extra, false, `${type} ${dry}`);
    }
    chat = [{ mes: 'A', send_date: 't' }];
    handler('continue', {}, false);
    assert.equal('extra' in chat[0], false, 'extra 를 새로 만들지 않는다');
    chat = [{ mes: 'A', send_date: 't', extra: {} }];
    runtime.assets = [];
    handler('continue', {}, false);
    assert.equal('eh_seed' in chat[0].extra, false, '그림이 없는 캐릭터의 채팅에는 남기지 않는다');
    runtime.assets = [{ file: 'smile.png' }]; runtime.folder = '';
    handler('continue', {}, false);
    assert.equal('eh_seed' in chat[0].extra, false);
    chat = [];
    assert.doesNotThrow(() => handler('continue', {}, false), '빈 채팅');
});

delete globalThis.__assetRecordsTest;
console.log(`assets-settings-records: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
