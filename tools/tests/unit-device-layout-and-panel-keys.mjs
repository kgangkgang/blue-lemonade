// 기기별 배치 (src/device-layout-options.js) · 확장 창 이름표 옮기기 (src/addons/order/panel-keys.js)
//   node tools/tests/unit-device-layout-and-panel-keys.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-device-layout-and-panel-keys');
const dl = await load('src/device-layout-options.js');
const pk = await load('src/addons/order/panel-keys.js');

// ── device-layout-options.js ──
const base = () => ({ type: { size: 16, lineHeight: 1.6, align: 'left' }, markdown: { size: 15, space: 1 }, chat: { personaTall: false, userSize: 14 }, em: { size: 100 }, profile: { mode: 'a', width: 80 }, userProfile: { mode: 'b' }, palette: 'keep-me' });

await test('deviceKind: matchMedia 가 없으면 pc, 있으면 그 결과를 따라요', () => {
    const had = globalThis.matchMedia;
    try {
        delete globalThis.matchMedia;
        assert.equal(dl.deviceKind(), 'pc');
        globalThis.matchMedia = q => ({ matches: q === dl.DEVICE_QUERY });
        assert.equal(dl.deviceKind(), 'mobile');
        globalThis.matchMedia = () => ({ matches: false });
        assert.equal(dl.deviceKind(), 'pc');
    } finally { if (had) globalThis.matchMedia = had; else delete globalThis.matchMedia; }
});

await test('LAYOUT_PATHS: 겹침 없고, 팔레트 · 글꼴 같은 모습 값은 들어 있지 않아요', () => {
    assert.equal(new Set(dl.LAYOUT_PATHS).size, dl.LAYOUT_PATHS.length);
    for (const p of dl.LAYOUT_PATHS) assert.doesNotMatch(p, /^(palette|fonts|gradients|colorOverrides)/);
    assert.ok(dl.LAYOUT_PATHS.includes('type.size') && dl.LAYOUT_PATHS.includes('profile.width') && dl.LAYOUT_PATHS.includes('userProfile.mode'));
});

await test('installedTouchMode: 터치가 있고 거친 포인터이며 홈 화면 앱일 때만 참', () => {
    const win = ({ touch = 1, coarse = true, standalone = true, nav = false } = {}) => ({
        navigator: { maxTouchPoints: touch, standalone: nav },
        matchMedia: q => ({ matches: q === '(pointer: coarse)' ? coarse : q === '(display-mode: standalone)' ? standalone : false }),
    });
    assert.equal(dl.installedTouchMode(win()), true);
    assert.equal(dl.installedTouchMode(win({ touch: 0 })), false);
    assert.equal(dl.installedTouchMode(win({ coarse: false })), false);
    assert.equal(dl.installedTouchMode(win({ standalone: false })), false);
    assert.equal(dl.installedTouchMode(win({ standalone: false, nav: true })), true, 'iOS navigator.standalone');
});

await test('syncDeviceLayout: 꺼져 있으면 값을 그대로 두고 칸만 만들어요', () => {
    const s = base();
    dl.syncDeviceLayout(s, 'pc');
    assert.deepEqual(s.deviceLayouts, { on: false, pc: {}, mobile: {} });
    assert.equal(s.type.size, 16);
});

await test('syncDeviceLayout: 모양이 틀린 deviceLayouts 는 다시 만들어요', () => {
    for (const bad of [null, [], 'x', 5]) { const s = base(); s.deviceLayouts = bad; dl.syncDeviceLayout(s, 'pc'); assert.deepEqual(s.deviceLayouts, { on: false, pc: {}, mobile: {} }); }
    const s = base(); s.deviceLayouts = { on: 'yes', pc: 5, mobile: [] };
    dl.syncDeviceLayout(s, 'pc');
    assert.equal(s.deviceLayouts.on, false, 'true 가 아닌 켬 값은 꺼짐');
    assert.deepEqual([s.deviceLayouts.pc, s.deviceLayouts.mobile], [{}, {}]);
});

await test('syncDeviceLayout: 켜면 이 기기 배치를 지금 값으로 시작하고, 기기를 바꾸면 각자 값이 따로 놀아요', () => {
    const s = base();
    dl.syncDeviceLayout(s, 'pc');
    s.deviceLayouts.on = true;
    dl.syncDeviceLayout(s, 'pc');
    assert.equal(s.deviceLayouts.pc.type.size, 16);
    assert.equal(s.deviceLayouts.mobile.type.size, 16);
    s.type.size = 20;
    dl.saveDeviceLayout(s);
    assert.equal(s.deviceLayouts.pc.type.size, 20);
    assert.equal(s.deviceLayouts.mobile.type.size, 16);
    dl.syncDeviceLayout(s, 'mobile');
    assert.equal(s.type.size, 16, '폰으로 가면 폰 값');
    s.type.size = 12;
    dl.saveDeviceLayout(s);
    dl.syncDeviceLayout(s, 'pc');
    assert.equal(s.type.size, 20, 'PC 로 돌아오면 PC 값');
    assert.equal(s.deviceLayouts.mobile.type.size, 12);
    assert.equal(s.palette, 'keep-me');
});

await test('syncDeviceLayout: 같은 기기로 다시 불러도 값은 그대로 (멱등)', () => {
    const s = base();
    dl.syncDeviceLayout(s, 'pc'); s.deviceLayouts.on = true; dl.syncDeviceLayout(s, 'pc');
    s.type.size = 22; dl.saveDeviceLayout(s);
    dl.syncDeviceLayout(s, 'pc'); dl.syncDeviceLayout(s, 'pc');
    assert.equal(s.type.size, 22);
});

await test('syncDeviceLayout: 담긴 값이 타입이 다르거나 NaN 이면 건너뛰어요 (설정 값을 깨뜨리지 않아요)', () => {
    const s = base();
    dl.syncDeviceLayout(s, 'pc'); s.deviceLayouts.on = true; dl.syncDeviceLayout(s, 'pc');
    dl.syncDeviceLayout(s, 'mobile');
    s.deviceLayouts.pc = { type: { size: 'huge', lineHeight: NaN, align: 'right' } };
    dl.syncDeviceLayout(s, 'pc');
    assert.equal(s.type.size, 16, '글자는 숫자 칸에 못 들어가요');
    assert.equal(s.type.lineHeight, 1.6, 'NaN 은 못 들어가요');
});

await test('saveDeviceLayout: 켜지 않았으면 아무것도 저장하지 않아요', () => {
    const s = base();
    dl.syncDeviceLayout(s, 'pc');
    s.type.size = 30;
    dl.saveDeviceLayout(s);
    assert.deepEqual(s.deviceLayouts.pc, {});
    assert.doesNotThrow(() => dl.saveDeviceLayout({}));
});

await test('layoutMergeView: 꺼져 있으면 그대로 돌려주는 함수와 settle', () => {
    const s = base();
    const view = dl.layoutMergeView(s);
    const other = { a: 1 };
    assert.equal(view(other), other);
    assert.equal(typeof view.settle, 'function');
    assert.doesNotThrow(() => dl.layoutMergeView(null).settle());
});

await test('layoutMergeView: 서버 사본의 위 칸 값을 「그쪽에 담긴 이 기기 배치」로 바꿔 견줘요', () => {
    const s = base();
    dl.syncDeviceLayout(s, 'pc'); s.deviceLayouts.on = true; dl.syncDeviceLayout(s, 'pc');
    s.type.size = 18;
    const view = dl.layoutMergeView(s);
    const remote = base();
    remote.type.size = 99;   // 다른 기기(폰)가 저장한 위 칸 값
    remote.deviceLayouts = { on: true, pc: { type: { size: 17 } }, mobile: { type: { size: 99 } } };
    const out = view(remote);
    assert.equal(out.type.size, 17, '서버 사본의 PC 배치 값');
    assert.equal(remote.type.size, 99, '원본은 건드리지 않아요');
    assert.equal(out.type.lineHeight, 1.6, '서버가 모르는 칸은 이 탭 값 = 바뀐 것 없음');
    const empty = base(); empty.deviceLayouts = { on: true, pc: {}, mobile: {} };
    assert.equal(view(empty), empty, '그쪽이 배치를 비웠으면 그대로');
    const off = base(); off.deviceLayouts = { on: false, pc: {}, mobile: {} };
    assert.equal(view(off), off);
});

// ── panel-keys.js (가짜 요소: id · classList · parentElement · tagName) ──
const el = ({ id = '', cls = [], tag = 'DIV', parent = null } = {}) => ({ id, classList: Object.assign(new Set(cls), { contains(n) { return this.has(n); } }), tagName: tag, parentElement: parent });
const box = (id) => el({ id, cls: ['extension_container'] });

await test('legacyKeyOf: id → class(정렬) → 태그 순으로 이름표를 만들어요', () => {
    assert.equal(pk.legacyKeyOf(el({ id: 'abc', cls: ['x'] })), 'id:abc');
    assert.equal(pk.legacyKeyOf(el({ cls: ['zz', 'aa'] })), 'cls:aa.zz');
    assert.equal(pk.legacyKeyOf(el({ tag: 'SECTION' })), 'tag:section');
});

await test('keyOf: 공용 틀 class 뿐인 창은 바깥 칸 id 로 부르고, 자기 class 가 있으면 예전 그대로', () => {
    const b = box('my_ext');
    assert.equal(pk.keyOf(el({ cls: ['inline-drawer'], parent: b })), 'id:my_ext');
    assert.equal(pk.keyOf(el({ cls: ['inline-drawer', 'wide100p'], parent: b })), 'id:my_ext');
    assert.equal(pk.keyOf(el({ cls: ['inline-drawer', 'regex_settings'], parent: b })), 'cls:inline-drawer.regex_settings');
    assert.equal(pk.keyOf(el({ id: 'own', cls: ['inline-drawer'], parent: b })), 'id:own');
    assert.equal(pk.keyOf(el({ cls: ['inline-drawer'], parent: el() })), 'cls:inline-drawer', '바깥 칸이 없으면 예전 이름표');
    assert.equal(pk.keyOf(el({ cls: ['inline-drawer'], parent: box('') })), 'cls:inline-drawer', '바깥 칸에 id 가 없으면 예전 이름표');
});

await test('containerOf: 부모가 .extension_container 일 때만', () => {
    const b = box('x');
    assert.equal(pk.containerOf(el({ parent: b })), b);
    assert.equal(pk.containerOf(el({ parent: el() })), null);
    assert.equal(pk.containerOf(el()), null);
    assert.equal(pk.containerOf(null), null);
});

await test('ambiguousLegacyKey: 공용 class 뿐인 cls: · 모든 tag: 이름표만 「어느 창인지 모름」', () => {
    for (const k of ['cls:inline-drawer', 'cls:inline-drawer.wide100p#3', 'tag:div', 'tag:div#2', 'cls:extension_container.flex-container']) assert.equal(pk.ambiguousLegacyKey(k), true, k);
    for (const k of ['cls:regex_settings', 'cls:inline-drawer.regex_settings', 'id:abc', '', null, undefined, 'plain']) assert.equal(pk.ambiguousLegacyKey(k), false, String(k));
});

await test('migrateKeys: 목록 안의 이름표를 바꾸고 중복은 하나로, 바꾼 수를 돌려줘요', () => {
    const map = new Map([['cls:inline-drawer', 'id:a'], ['cls:inline-drawer#2', 'id:b'], ['id:c', 'id:c']]);
    const pinned = ['cls:inline-drawer', 'id:c', 'cls:inline-drawer#2', 'id:a'];
    const n = pk.migrateKeys(map, [pinned]);
    assert.deepEqual(pinned, ['id:a', 'id:c', 'id:b']);
    assert.equal(n, 2, '이름이 바뀐 것만 세고 중복 정리는 세지 않아요');
});

await test('migrateKeys: 배열이 아닌 칸은 넘어가고, 바꿀 게 없으면 0', () => {
    const list = ['id:x'];
    assert.equal(pk.migrateKeys(new Map(), [null, 'x', list]), 0);
    assert.deepEqual(list, ['id:x']);
});

await test('migrateKeys: 스위치 객체도 옮기되 새 이름표에 이미 값이 있으면 그 값을 지키고 예전 칸만 지워요', () => {
    const map = new Map([['cls:inline-drawer', 'id:a'], ['cls:inline-drawer#2', 'id:b']]);
    const sw = { 'cls:inline-drawer': true, 'cls:inline-drawer#2': true, 'id:b': false };
    const n = pk.migrateKeys(map, [], sw);
    assert.deepEqual(sw, { 'id:a': true, 'id:b': false });
    assert.equal(n, 2);
});

await test('migrateKeys drop: 어느 창도 못 가리키는 모호한 예전 이름표만 빼요 (구체적인 이름표는 남김)', () => {
    const map = new Map([['cls:inline-drawer', 'id:a']]);
    const order = ['cls:inline-drawer', 'cls:inline-drawer#2', 'cls:regex_settings', 'id:z'];
    const sw = { 'cls:inline-drawer#3': true, 'cls:regex_settings': true };
    const n = pk.migrateKeys(map, [order], sw, { drop: true });
    assert.deepEqual(order, ['id:a', 'cls:regex_settings', 'id:z']);
    assert.deepEqual(sw, { 'cls:regex_settings': true });
    assert.equal(n, 3);
    const keep = ['cls:inline-drawer#2'];
    assert.equal(pk.migrateKeys(new Map(), [keep]), 0, 'drop 이 아니면 남겨 둬요');
    assert.deepEqual(keep, ['cls:inline-drawer#2']);
});

done();
