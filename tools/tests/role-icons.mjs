// 7.9.3 단추 아이콘 바꾸기 — 저장 · 불러오기 · ↺ · 백업(설정 파일) · SVG 정리 · 크기 제한 · CSS 만들기 · 바꾸지 않으면 화면 그대로.
//   node tools/tests/role-icons.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const load = rel => import(pathToFileURL(path.join(root, rel)));
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], characterId: undefined, saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };

const core = await load('src/role-icons-core.js');
const { DEFAULTS, getSettings, resetSettings } = await load('src/settings.js');
const diff = await load('src/settings-differences.js');
const { STYLE_KEYS } = await load('src/styles.js');
const gen = await load('src/role-icons-fa.gen.js');

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const svgValue = s => `im:data:image/svg+xml;base64,${b64(s)}`;
const PNG = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'));
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x1a, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c, 0x0d, 0, 0, 0, 0x2f, 0, 0, 0, 0x10, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, 0]);
const loadSettings = value => { ctx.extensionSettings.salty = structuredClone(value); return getSettings(); };

await t('역할 14개: 디자인 시스템 .ds-tool[data-role] 와 같은 id, 이름이 겹치지 않는다', () => {
    assert.deepEqual(core.ROLE_IDS, ['close', 'back', 'prev', 'next', 'undo', 'redo', 'reset', 'search', 'fullscreen', 'fullscreen-exit', 'menu', 'more', 'plus', 'check']);
    assert.equal(new Set(core.ROLES.map(r => r.label)).size, 14);
    for (const role of core.ROLES) {
        assert.ok(role.swap.length >= 2, role.id);
        assert.ok(role.swap.includes(`.bl-roleicon-preview[data-bl-role="${role.id}"]`), `${role.id} 미리보기 칸도 같은 역할`);
        assert.ok(!role.swap.some(sel => /^\s*html\b/.test(sel)), `${role.id}: 선택자가 html 로 시작하면 앞에 붙는 무게 올리기와 안 맞는다`);
        assert.match(role.glyph, /^url\("data:image\/svg\+xml,/);
    }
});

await t('아무것도 안 바꾸면: 기본값은 빈 칸, CSS 는 빈 글 (화면 · 문서 그대로)', () => {
    assert.deepEqual(DEFAULTS.roleIcons, {});
    assert.equal(core.buildRoleCss({}), '');
    assert.equal(core.buildRoleCss(undefined), '');
    assert.equal(core.buildRoleCss({ close: 'fa:s:bad"}:f00d', nope: 'tx:★' }), '', '잘못된 값 · 모르는 역할은 규칙을 만들지 않는다');
    const s = loadSettings(structuredClone(DEFAULTS));
    assert.deepEqual(s.roleIcons, {});
    assert.equal(diff.changedSettings(s).filter(c => c.path.startsWith('roleIcons')).length, 0);
});

await t('저장 · 불러오기: 올바른 값은 그대로, 열 번 다시 불러도 같다', () => {
    const icons = { close: 'fa:s:star:f005', search: 'tx:★', more: 'fa:b:github:f09b', undo: `im:data:image/png;base64,${Buffer.from(PNG).toString('base64')}` };
    let s = loadSettings({ ...structuredClone(DEFAULTS), roleIcons: icons });
    assert.deepEqual(s.roleIcons, icons);
    const first = JSON.stringify(s.roleIcons);
    for (let i = 0; i < 10; i++) s = loadSettings(JSON.parse(JSON.stringify(s)));
    assert.equal(JSON.stringify(s.roleIcons), first);
});

await t('불러오기 정리: 모르는 역할 · 깨진 값 · 위험한 SVG · 너무 큰 값은 버린다', () => {
    const evil = svgValue('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><path d="M0 0h10v10z"/></svg>');
    const huge = `im:data:image/png;base64,${'A'.repeat(core.ROLE_ICON_MAX_DATA + 100)}`;
    const s = loadSettings({ ...structuredClone(DEFAULTS), roleIcons: { close: 'fa:s:star:f005', __proto__x: 'tx:a', back: 'tx:', prev: 'tx:★★★', next: evil, undo: huge, redo: 'fa:s:x:zzzz', reset: 'im:data:image/gif;base64,R0lG', search: 42 } });
    assert.deepEqual(s.roleIcons, { close: 'fa:s:star:f005' });
    assert.deepEqual(loadSettings({ ...structuredClone(DEFAULTS), roleIcons: 'x' }).roleIcons, {});
    assert.deepEqual(loadSettings({ ...structuredClone(DEFAULTS), roleIcons: ['tx:a'] }).roleIcons, {});
});

await t('↺ 처음 값: 역할 하나만 지우고, 변경한 설정 목록 · 경로 · 이름이 맞다', () => {
    const s = loadSettings({ ...structuredClone(DEFAULTS), roleIcons: { close: 'fa:s:star:f005', search: 'tx:★' } });
    const changed = diff.changedSettings(s).filter(c => c.path.startsWith('roleIcons'));
    assert.deepEqual(changed.map(c => c.path), ['roleIcons.close', 'roleIcons.search']);
    assert.ok(diff.settingChanged(s, 'roleIcons.close'));
    assert.deepEqual(diff.settingRoute('roleIcons.close'), { tab: 'theme', sub: 'icons' });
    assert.equal(diff.settingDefault(s, 'roleIcons.nope').allowed, false);
    assert.equal(diff.settingDefault(s, 'roleIcons.close.x').allowed, false);
    assert.equal(diff.resetSetting(s, 'roleIcons.close'), true);
    assert.deepEqual(s.roleIcons, { search: 'tx:★' });
    assert.equal(diff.settingChanged(s, 'roleIcons.close'), false);
});

await t('백업: 테마 설정 파일 내보내기에 담기고, 가져오면 되살아난다 · 테마 모습 초기화는 비우고 애드온 초기화는 남긴다', () => {
    const icons = { close: 'fa:s:star:f005', menu: 'tx:🍋' };
    const s = loadSettings({ ...structuredClone(DEFAULTS), roleIcons: icons });
    const file = JSON.stringify({ saltySettings: true, version: 2, settings: s });   // panel.js case 'export' 와 같은 모양
    ctx.extensionSettings.salty = structuredClone(DEFAULTS);
    assert.deepEqual(getSettings().roleIcons, {});
    ctx.extensionSettings.salty = structuredClone(JSON.parse(file).settings);       // panel.js 가져오기와 같은 길
    assert.deepEqual(getSettings().roleIcons, icons);
    resetSettings({ addons: true });
    assert.deepEqual(getSettings().roleIcons, icons, '애드온만 되돌리면 단추 아이콘은 남는다');
    resetSettings({ look: true });
    assert.deepEqual(getSettings().roleIcons, {}, '테마 모습 초기화는 단추 아이콘도 처음 값으로');
    assert.ok(!STYLE_KEYS.includes('roleIcons'), '스타일 · 공유 코드에는 담지 않는다 (캐릭터 모습이 아니라 화면 단추 취향)');
});

await t('SVG 정리: 스크립트 · 이벤트 · 바깥 참조 · 스타일 시트 · foreignObject · image 를 걷고 모양만 새로 쓴다', () => {
    const dirty = `<?xml version="1.0"?><!-- 주석 --><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="24" height="24" onload="alert(1)">
  <style>@import url(https://example.invalid/x.css); path{fill:red}</style>
  <script type="text/javascript">alert(2)</script>
  <foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(3)"/></div></foreignObject>
  <image href="https://example.invalid/a.png" width="10" height="10"/>
  <a href="javascript:alert(4)"><path d="M1 1h2"/></a>
  <defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs>
  <path d="M2 2h20v20z" fill="url(#g)" stroke="url(https://example.invalid/#x)" style="fill-opacity:.5;behavior:url(x.htc)" onclick="x()"/>
  <use xlink:href="#g"/><use href="https://example.invalid/sprite.svg#a"/>
  <circle cx="12" cy="12" r="4" fill="currentColor"/>
</svg>`;
    const clean = core.sanitizeSvg(dirty);
    assert.ok(clean, '정리 결과가 있다');
    for (const bad of ['script', 'alert', 'onload', 'onclick', 'onerror', 'foreignObject', '<image', '<a', 'example.invalid', '@import', '<style', 'javascript', 'behavior', 'xlink', 'DOCTYPE', '<?xml', '<!--']) assert.ok(!clean.includes(bad), `남으면 안 됨: ${bad} → ${clean}`);
    assert.ok(clean.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(clean.includes('viewBox="0 0 24 24"'), 'viewBox 가 없으면 폭 · 높이로 만든다');
    assert.ok(clean.includes('fill="url(#g)"'), '문서 안 #id 참조(그라데이션)는 남긴다');
    assert.ok(clean.includes('<use href="#g"/>'), '안쪽 use 는 href 로 남긴다');
    assert.ok(clean.includes('style="fill-opacity:.5"'));
    assert.equal(core.sanitizeSvg(clean), clean, '두 번 정리해도 같다 (불러올 때 다시 정리해 비교하므로)');
});

await t('SVG 거절: 엔티티 · CDATA · 뿌리가 svg 아님 · 그릴 모양 없음 · 닫히지 않음 · 뿌리 밖 요소', () => {
    assert.equal(core.sanitizeSvg('<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'), null);
    assert.equal(core.sanitizeSvg('<svg><![CDATA[x]]><path d="M0 0"/></svg>'), null);
    assert.equal(core.sanitizeSvg('<html><svg><path d="M0 0"/></svg></html>'), null);
    assert.equal(core.sanitizeSvg('<svg viewBox="0 0 1 1"><script>x</script></svg>'), null);
    assert.equal(core.sanitizeSvg('<svg><path d="M0 0">'), null);
    assert.equal(core.sanitizeSvg('<svg><path d="M0 0"/></svg><script>x</script>'), null);
    assert.equal(core.sanitizeSvg('<svg><path d="M0 0"/></svg>junk'), null);
});

await t('그림 파일: 64KB 한도 · 앞 바이트로 종류 확인 · PNG · WebP 그대로 · SVG 는 정리해서', () => {
    assert.match(core.imageFileValue(PNG).value, /^im:data:image\/png;base64,iVBORw0KGgo/);
    assert.match(core.imageFileValue(WEBP).value, /^im:data:image\/webp;base64,UklGR/);
    const big = new Uint8Array(core.ROLE_ICON_MAX_BYTES + 1); big.set(PNG);
    assert.match(core.imageFileValue(big).error, /64KB/);
    assert.ok(core.imageFileValue(new Uint8Array(core.ROLE_ICON_MAX_BYTES - 10).fill(32).map((v, i) => i < PNG.length ? PNG[i] : v)).value, '한도 안쪽은 들어간다');
    assert.match(core.imageFileValue(Buffer.from('GIF89a....')).error, /PNG · SVG · WebP/);
    assert.match(core.imageFileValue(Buffer.from('<html><script>x</script></html>')).error, /PNG · SVG · WebP/);
    assert.match(core.imageFileValue(new Uint8Array()).error, /빈 파일/);
    const svg = core.imageFileValue(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>x</script><rect width="10" height="10" fill="#fc0"/></svg>'));
    assert.ok(svg.value.startsWith('im:data:image/svg+xml;base64,'));
    const decoded = Buffer.from(svg.value.split(',')[1], 'base64').toString('utf8');
    assert.ok(!decoded.includes('script') && decoded.includes('fill="#fc0"'), '원래 색 그대로');
    assert.ok(core.parseRoleIcon(svg.value), '정리한 SVG 는 다시 불러와도 통과');
    assert.match(core.imageFileValue(Buffer.from('<svg viewBox="0 0 1 1"><script>x</script></svg>')).error, /SVG/);
});

await t('글자 · 이모지: 한두 개만, 따옴표 · 꺾쇠 · 제어 문자는 받지 않는다', () => {
    assert.equal(core.textValue(' ★ '), 'tx:★');
    assert.equal(core.textValue('가나'), 'tx:가나');
    assert.equal(core.textValue('👨‍👩‍👧'), 'tx:👨‍👩‍👧', '이어 붙인 이모지는 하나');
    assert.equal(core.textValue('1️⃣'), 'tx:1️⃣');
    for (const bad of ['', '   ', '가나다', '"', "'", '<', 'a\\', '\u0007', '‮가', 'x\ny']) assert.equal(core.textValue(bad), '', JSON.stringify(bad));
});

await t('CSS: 역할 선택자 한 곳에 · Font Awesome · 글자는 16진 이스케이프 · 그림은 원래 색 · 크기는 철칙 잉크 ≈12.5', () => {
    const css = core.buildRoleCss({ close: 'fa:s:star:f005', search: 'tx:★', more: 'fa:b:github:f09b', undo: core.imageFileValue(PNG).value });
    assert.ok(css.includes('content:"\\f005"!important') && css.includes('"Font Awesome 6 Free"'));
    assert.ok(css.includes('content:"\\f09b"!important') && css.includes('"Font Awesome 6 Brands"'));
    assert.ok(css.includes('content:"\\2605"!important'), '글자는 이스케이프로만 들어간다');
    assert.ok(css.includes('background:url("data:image/png;base64,'), '그림은 마스크가 아니라 배경 = 원래 색');
    assert.ok(css.includes('--bl-role-fa:12.5px') && css.includes('--bl-role-box:16px'));
    assert.ok(css.includes('.bl-editor .bl-editor-actions > [data-act="history-undo"]'), '되돌리기: 설정 창 머리 도구 줄');
    assert.ok(css.includes('[aria-label$=" 닫기"]') && css.includes('.popup-button-close'), '닫기: 애드온 창 · 번역 창 머리 ×');
    assert.ok(!/redo|history-redo/.test(css), '안 바꾼 역할은 규칙이 없다');
    // 줄마다 중괄호가 짝이 맞는다 (값이 규칙을 깨고 나가지 않는다)
    for (const line of css.split('\n').filter(l => l && !l.startsWith('/*'))) assert.equal((line.match(/\{/g) || []).length, (line.match(/\}/g) || []).length, line.slice(0, 80));
    assert.ok(!/@import|expression|javascript/i.test(css));
});

await t('Font Awesome 목록: 실리태번 글꼴의 글자 번호 · 테마에서 쓰는 묶음이 목록 안에 있다', () => {
    const parse = text => new Map(text.split(';').map(row => { const [code, names] = row.split(':'); return [code, names.split(',')]; }));
    const solid = parse(gen.SOLID), brands = parse(gen.BRANDS);
    assert.ok(solid.size > 1300 && brands.size > 400, `${solid.size} · ${brands.size}`);
    assert.ok(solid.get('f00d').includes('xmark'));
    assert.ok(brands.get('f09b').includes('github'));
    for (const code of [...solid.keys(), ...brands.keys()]) assert.match(code, /^[0-9a-f]{2,5}$/);
    for (const id of gen.USED.split(',')) assert.ok((id[0] === 's' ? solid : brands).has(id.slice(1)), id);
    for (const [code, names] of solid) assert.ok(core.parseRoleIcon(core.faValue('solid', names[0], code)), names[0]);
});

await t('화면에 걸기: 바꾼 역할이 없으면 <style> 을 만들지 않고, 바꾸면 하나 · 되돌리면 지운다', async () => {
    const nodes = new Map();
    globalThis.document = {
        getElementById: id => nodes.get(id) || null,
        createElement: () => ({ id: '', textContent: '', remove() { nodes.delete(this.id); } }),
        head: { appendChild: el => nodes.set(el.id, el) },
    };
    const { syncRoleIcons } = await load('src/role-icons.js');
    syncRoleIcons({});
    assert.equal(nodes.size, 0);
    syncRoleIcons({ close: 'fa:s:star:f005' });
    assert.ok(nodes.get('bl-role-icons').textContent.includes('\\f005'));
    syncRoleIcons({ close: 'fa:s:star:f005' });
    syncRoleIcons({});
    assert.equal(nodes.size, 0);
    delete globalThis.document;
});

await t('설정 창 연결: 단추 아이콘 칸 · 검색 색인 · 적용(applyAll) · 기본값', () => {
    const panel = fs.readFileSync(path.join(root, 'src/panel.js'), 'utf8');
    assert.ok(panel.includes("['icons', '단추 아이콘']"));
    assert.ok(panel.includes("if (sub === 'icons') return roleIconsMarkup("));
    assert.ok(fs.readFileSync(path.join(root, 'src/settings-search.js'), 'utf8').includes("['theme','icons','단추 아이콘'"));
    assert.ok(fs.readFileSync(path.join(root, 'src/apply.js'), 'utf8').includes('syncRoleIcons('));
    const css = fs.readFileSync(path.join(root, 'css/49-role-icons.css'), 'utf8');
    for (const sel of css.match(/^[^\s/*@}][^{]*\{/gm) || []) assert.match(sel, /\.bl-(roleicon|icon)|\.bl-iconadd/, `49 는 새 클래스만: ${sel}`);
});

console.log(`role-icons: ${n}개 통과`);
