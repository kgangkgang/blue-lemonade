// 7.9.3 단추 아이콘 바꾸기 — 저장 · 불러오기 · ↺ · 백업(설정 파일) · SVG 정리 · 크기 제한 · CSS 만들기 · 바꾸지 않으면 화면 그대로.
// 8.0.8 화면 단추 역할(상단 서랍 · 입력줄 · 애드온) · 화면에서 고르기(열쇠 만들기 · 다시 찾기 · 표식 · 누르기, 가짜 DOM) · 옛 설정 호환.
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

await t('역할: 창 도구 14(디자인 시스템 .ds-tool[data-role] 와 같은 id) + 8.0.8 상단 서랍 9 · 입력줄 6 · 애드온 2, 이름이 겹치지 않는다', () => {
    assert.deepEqual(core.ROLE_IDS.slice(0, 14), ['close', 'back', 'prev', 'next', 'undo', 'redo', 'reset', 'search', 'fullscreen', 'fullscreen-exit', 'menu', 'more', 'plus', 'check']);
    assert.deepEqual(core.rolesIn('top').map(r => r.id), ['api', 'preset', 'format', 'worldinfo', 'usersettings', 'background', 'extensions', 'persona', 'characters']);
    assert.deepEqual(core.rolesIn('bottom').map(r => r.id), ['options', 'wand', 'send', 'continue', 'impersonate', 'stop']);
    assert.deepEqual(core.rolesIn('addon').map(r => r.id), ['direction', 'translate-input']);
    assert.equal(core.ROLE_IDS.length, 31);
    assert.equal(new Set(core.ROLES.map(r => r.label)).size, 31);
    assert.deepEqual(core.ROLE_GROUPS.map(g => g[0]), ['tool', 'top', 'bottom', 'addon', 'picked']);
    assert.ok(core.rolesIn('tool').every(r => r.size === 'tool') && [...core.rolesIn('top'), ...core.rolesIn('bottom'), ...core.rolesIn('addon')].every(r => r.size === 'host'), '화면 단추는 그 단추의 글자 크기를 따른다');
    // 실리태번 index.html 의 실제 요소(id) — 상단 서랍 · 입력줄
    for (const [id, sel] of [['api', '#API-status-top'], ['preset', '#leftNavDrawerIcon'], ['worldinfo', '#WIDrawerIcon'], ['characters', '#rightNavDrawerIcon'], ['options', '#options_button'], ['wand', '#extensionsMenuButton'], ['send', '#send_but'], ['continue', '#mes_continue'], ['stop', '#rightSendForm > #mes_stop'], ['direction', '#jj-button'], ['translate-input', '#llm_translate_input_button']]) assert.ok(core.ROLES.find(r => r.id === id).swap.includes(sel), `${id}: ${sel}`);
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

await t('8.0.8 CSS: 화면 단추(상단 · 입력줄 · 애드온)는 단추 글자 크기 1em 상자 · 잉크 .8em, 선택자는 실리태번 id 그대로', () => {
    const css = core.buildRoleCss({ send: 'fa:s:star:f005', api: 'tx:★', stop: core.imageFileValue(PNG).value, close: 'fa:s:xmark:f00d' });
    assert.ok(css.includes('--bl-role-hbox:1em') && css.includes('--bl-role-hink:.8em'));
    const line = id => css.split('\n').find(l => l.startsWith(`html:not(#bl-ri) :is(${id}`) && l.includes('::before{'));
    assert.ok(line('#send_but').includes('width:var(--bl-role-hbox)!important') && line('#send_but').includes('var(--bl-role-hink)/1 "Font Awesome 6 Free"'), '보내기: 1em 상자 · .8em 글꼴');
    assert.ok(line('#API-status-top').includes('font-size:var(--bl-role-hink)!important'), '연결: 글자도 .8em');
    assert.ok(line('#rightSendForm > #mes_stop').includes('width:var(--bl-role-hink)!important'), '멈춤 그림: .8em');
    assert.ok(line('.salty-panel .bl-settings-close').includes('width:var(--bl-role-box)!important') && line('.salty-panel .bl-settings-close').includes('var(--bl-role-fa)/1'), '창 도구는 그대로 16 · 12.5');
    assert.ok(!css.includes('#extensionsMenuButton'), '안 바꾼 역할은 규칙이 없다');
});

await t('8.0.8 고른 단추 열쇠: 모양 검사 · 해시는 늘 같고 경로에 쓸 수 있다 · 설정 정리는 올바른 칸만', () => {
    for (const key of ['#extensionsMenu|id|translate_chat', '#extensionsMenu|title|번역', '#chat|cls|mes_translate', '#rightSendForm|data|act=open', '|nth|3', '#extensionsMenu|text|Blue Lemonade']) assert.ok(core.parsePickKey(key), key);
    for (const bad of ['', 'x', 'a|b', '#m|xx|v', '#m|id|1bad', '#m|id|has space', 'div|id|a', '#m|nth|x', '#m|data|BAD=1', '#m|title|<b>', '#m|title|' + 'a'.repeat(200), 42, null]) assert.equal(core.parsePickKey(bad), null, JSON.stringify(bad));
    const slug = core.pickSlug('#extensionsMenu|title|번역');
    assert.match(slug, /^p[0-9a-z]{7}$/);
    assert.equal(core.pickSlug('#extensionsMenu|title|번역'), slug);
    assert.notEqual(core.pickSlug('#extensionsMenu|title|번역2'), slug);
    assert.ok(diff.settingDefault({}, `pickedIcons.${slug}`).allowed && !diff.settingDefault({}, 'pickedIcons.bad').allowed && !diff.settingDefault({}, `pickedIcons.${slug}.value`).allowed);
    const good = { key: '#extensionsMenu|title|번역', label: '번역', icon: 'fa-solid fa-language', value: 'tx:★' };
    const map = { [slug]: good, [core.pickSlug('|id|send_but')]: { key: '|id|send_but', label: '보내기' }, wrong: { key: '#extensionsMenu|title|번역', label: 'x' }, [core.pickSlug('bad key')]: { key: 'bad key' }, [core.pickSlug('|id|a')]: { key: '|id|a', label: 'a', value: 'nope', icon: 'javascript:x' } };
    const tidy = core.tidyPickedIcons(map);
    assert.deepEqual(Object.keys(tidy).sort(), [slug, core.pickSlug('|id|send_but'), core.pickSlug('|id|a')].sort());
    assert.deepEqual(tidy[slug], good);
    assert.deepEqual(tidy[core.pickSlug('|id|a')], { key: '|id|a', label: 'a' }, '깨진 값 · 위험한 아이콘 이름은 버리고 칸은 남긴다');
    assert.equal(core.tidyPickedIcons(tidy), tidy, '이미 정리된 것은 같은 객체');
    assert.deepEqual(core.tidyPickedIcons('x'), {});
    assert.deepEqual(core.tidyPickedIcons([good]), {});
    const many = {}; for (let i = 0; i < core.PICK_MAX + 5; i++) { const k = `|id|b${i}`; many[core.pickSlug(k)] = { key: k, label: 'b' }; }
    assert.equal(Object.keys(core.tidyPickedIcons(many)).length, core.PICK_MAX, `${core.PICK_MAX}개까지`);
    const roles = core.pickedRoles(tidy);
    assert.equal(roles.length, 3);
    assert.deepEqual(roles.find(r => r.slug === slug), { id: `@${slug}`, slug, label: '번역', icon: 'fa-solid fa-language', value: 'tx:★', key: good.key, group: 'picked', size: 'host' });
});

await t('8.0.8 고른 단추 CSS: 표식 [data-bl-pick="<해시>"] · 글자 옆 svg 아이콘용 data-bl-pick-inline · 미리보기 칸, 값 없는 칸은 규칙 없음', () => {
    const slug = core.pickSlug('#extensionsMenu|title|번역'), slug2 = core.pickSlug('|id|send_but');
    const css = core.buildRoleCss({}, { [slug]: { key: '#extensionsMenu|title|번역', label: '번역', value: 'fa:s:language:f1ab' }, [slug2]: { key: '|id|send_but', label: '보내기' } });
    assert.ok(css.includes(`[data-bl-pick="${slug}"], .bl-roleicon-preview[data-bl-role="@${slug}"]`), '표식 + 미리보기 칸');
    assert.ok(css.includes(`[data-bl-pick-inline="${slug}"]>:is(svg,img){display:none!important}`));
    assert.ok(css.includes(`[data-bl-pick-inline="${slug}"]::before{position:static!important`));
    assert.ok(css.includes('content:"\\f1ab"!important') && css.includes('var(--bl-role-hink)/1'));
    assert.ok(!css.includes(slug2), '값을 아직 안 고른 단추는 규칙이 없다');
    assert.equal(core.buildRoleCss({}, { [slug2]: { key: '|id|send_but', label: '보내기' } }), '', '값 있는 칸이 하나도 없으면 빈 글');
    assert.equal(core.buildRoleCss(undefined, undefined), '');
    for (const line of css.split('\n').filter(l => l && !l.startsWith('/*'))) assert.equal((line.match(/\{/g) || []).length, (line.match(/\}/g) || []).length, line.slice(0, 80));
});

await t('8.0.8 저장 · 불러오기: pickedIcons 는 옛 설정(없음)에서 빈 칸, 올바른 칸은 그대로, ↺ 는 그 단추를 목록에서 뺀다 · 테마 모습 초기화는 비운다', () => {
    const slug = core.pickSlug('#extensionsMenu|title|번역');
    const picks = { [slug]: { key: '#extensionsMenu|title|번역', label: '번역', value: 'tx:★' } };
    const old = structuredClone(DEFAULTS); delete old.pickedIcons;   // 8.0.7 까지의 설정 파일
    assert.deepEqual(loadSettings(old).pickedIcons, {});
    let s = loadSettings({ ...structuredClone(DEFAULTS), pickedIcons: picks, roleIcons: { close: 'fa:s:star:f005' } });
    assert.deepEqual(s.pickedIcons, picks);
    for (let i = 0; i < 5; i++) s = loadSettings(JSON.parse(JSON.stringify(s)));
    assert.deepEqual(s.pickedIcons, picks);
    assert.deepEqual(loadSettings({ ...structuredClone(DEFAULTS), pickedIcons: { [slug]: { key: 'bad', label: 'x' }, zz: 1 } }).pickedIcons, {});
    const changed = diff.changedSettings(s).filter(c => c.path.startsWith('pickedIcons') || c.path.startsWith('roleIcons'));
    assert.deepEqual(changed.map(c => c.path), ['roleIcons.close', `pickedIcons.${slug}`]);
    assert.deepEqual(diff.settingRoute(`pickedIcons.${slug}`), { tab: 'theme', sub: 'icons' });
    assert.ok(diff.settingChanged(s, `pickedIcons.${slug}`));
    assert.equal(diff.resetSetting(s, `pickedIcons.${slug}`), true);
    assert.deepEqual(s.pickedIcons, {});
    assert.deepEqual(s.roleIcons, { close: 'fa:s:star:f005' }, '역할 아이콘은 그대로');
    s = loadSettings({ ...structuredClone(DEFAULTS), pickedIcons: picks });
    resetSettings({ addons: true });
    assert.deepEqual(getSettings().pickedIcons, picks, '애드온만 되돌리면 남는다');
    resetSettings({ look: true });
    assert.deepEqual(getSettings().pickedIcons, {}, '테마 모습 초기화는 비운다');
    assert.ok(!STYLE_KEYS.includes('pickedIcons'));
});

// ───────── 가짜 DOM — 화면에서 고르기(role-icons-pick.js)를 브라우저 없이 ─────────
// 선택자는 pick 모듈이 쓰는 만큼만: 쉼표 목록 · 자손( ) · 자식(>) · 태그 · * · #id · .클래스 · [속성="값"] · [속성] · :scope
function makeDom() {
    class Node { constructor(type) { this.nodeType = type; this.parentElement = null; this.parentNode = null; } }
    class Text extends Node { constructor(text) { super(3); this.nodeValue = text; } get textContent() { return this.nodeValue; } }
    class El extends Node {
        constructor(doc, tag) { super(1); this.ownerDocument = doc; this.localName = tag; this.attrs = new Map(); this.childNodes = []; this.hidden = false; this.listeners = []; }
        get id() { return this.attrs.get('id') || ''; } set id(v) { this.attrs.set('id', v); }
        get className() { return this.attrs.get('class') || ''; } set className(v) { this.attrs.set('class', v); }
        get classList() {
            const self = this; const list = () => self.className.split(/\s+/).filter(Boolean);
            return { contains: c => list().includes(c), add: c => { if (!list().includes(c)) self.className = [...list(), c].join(' '); }, remove: c => { self.className = list().filter(x => x !== c).join(' '); }, [Symbol.iterator]: () => list()[Symbol.iterator]() };
        }
        get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
        getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; } setAttribute(n, v) { this.attrs.set(n, String(v)); } removeAttribute(n) { this.attrs.delete(n); } hasAttribute(n) { return this.attrs.has(n); }
        get children() { return this.childNodes.filter(n => n.nodeType === 1); } get firstElementChild() { return this.children[0] || null; }
        get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
        append(...nodes) { for (const n of nodes) { n.parentElement = this; n.parentNode = this; this.childNodes.push(n); } return this; }
        remove() { if (this.parentElement) { this.parentElement.childNodes = this.parentElement.childNodes.filter(n => n !== this); this.parentElement = null; } }
        set innerHTML(html) { this.childNodes = []; parseInto(this.ownerDocument, this, html); }
        contains(el) { for (let p = el; p; p = p.parentElement) if (p === this) return true; return false; }
        matches(sel) { return matchList(this, sel, this); }
        closest(sel) { for (let p = this; p; p = p.parentElement) if (matchList(p, sel, p)) return p; return null; }
        querySelectorAll(sel) { const out = []; const walk = n => { for (const c of n.children) { if (matchList(c, sel, this)) out.push(c); walk(c); } }; walk(this); return out; }
        querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
        addEventListener(type, fn) { this.listeners.push([type, fn]); } removeEventListener(type, fn) { this.listeners = this.listeners.filter(l => l[0] !== type || l[1] !== fn); }
    }
    const parts = s => { const out = []; let depth = 0, cur = ''; for (const ch of s) { if (ch === '[') depth++; if (ch === ']') depth--; if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); };
    function matchCompound(el, c, scope) {
        if (!el || el.nodeType !== 1) return false;
        for (const m of c.matchAll(/:scope|\*|#[\w-]+|\.[\w-]+|\[[^\]]+\]|[a-z][\w-]*/gi)) {
            const tok = m[0];
            if (tok === ':scope') { if (el !== scope) return false; }
            else if (tok === '*') { /* 아무 요소 */ }
            else if (tok[0] === '#') { if (el.id !== tok.slice(1)) return false; }
            else if (tok[0] === '.') { if (!el.classList.contains(tok.slice(1))) return false; }
            else if (tok[0] === '[') { const a = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(tok); if (!a || !el.hasAttribute(a[1]) || (a[2] !== undefined && el.getAttribute(a[1]) !== a[2])) return false; }
            else if (el.localName !== tok.toLowerCase()) return false;
        }
        return true;
    }
    function matchComplex(el, sel, scope) {
        const tokens = sel.replace(/\s*>\s*/g, ' > ').trim().split(/\s+/);
        let i = tokens.length - 1, cur = el;
        if (!matchCompound(cur, tokens[i--], scope)) return false;
        while (i >= 0) {
            if (tokens[i] === '>') { cur = cur.parentElement; if (!matchCompound(cur, tokens[i - 1], scope)) return false; i -= 2; }
            else { let p = cur.parentElement; while (p && !matchCompound(p, tokens[i], scope)) p = p.parentElement; if (!p) return false; cur = p; i--; }
        }
        return true;
    }
    const matchList = (el, sel, scope) => parts(sel).some(s => matchComplex(el, s, scope));
    function parseInto(doc, parent, html) {
        const re = /<(\/?)([a-z][\w-]*)([^>]*?)(\/?)>|([^<]+)/gi;
        const stack = [parent];
        for (const m of html.matchAll(re)) {
            if (m[5] !== undefined) { if (m[5].trim()) stack.at(-1).append(new Text(m[5])); continue; }
            if (m[1]) { stack.pop(); continue; }
            const el = new El(doc, m[2]);
            for (const a of m[3].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) el.setAttribute(a[1], a[2] ?? '');
            stack.at(-1).append(el);
            if (!m[4] && !['img', 'input'].includes(m[2])) stack.push(el);
        }
    }
    const doc = { nodeType: 9, listeners: [] };
    doc.createElement = tag => new El(doc, tag);
    doc.documentElement = new El(doc, 'html'); doc.body = new El(doc, 'body'); doc.documentElement.append(doc.body);
    doc.querySelectorAll = sel => doc.documentElement.querySelectorAll(sel); doc.querySelector = sel => doc.querySelectorAll(sel)[0] || null;
    doc.getElementById = id => doc.querySelectorAll(`#${id}`)[0] || null;
    doc.addEventListener = (t, fn) => doc.listeners.push([t, fn]); doc.removeEventListener = (t, fn) => { doc.listeners = doc.listeners.filter(l => l[0] !== t || l[1] !== fn); };
    doc.dispatch = (type, target) => { let stopped = false; const ev = { type, target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() { stopped = true; }, key: type === 'keydown' ? target : undefined }; for (const [t, fn] of [...doc.listeners]) if (t === type && !stopped) fn(ev); return ev; };
    doc.contains = () => true;
    doc.html = html => { doc.body.innerHTML = html; return doc; };
    return doc;
}
const PAGE = `<div id="top-settings-holder"><div id="sys-settings-button" class="drawer"><div class="drawer-toggle"><div id="API-status-top" class="drawer-icon fa-solid fa-plug-circle-exclamation" title="API Connections"></div></div></div></div>
<div id="chat"><div class="mes"><div class="mes_buttons"><div class="mes_button extraMesButtonsHint fa-solid fa-ellipsis" title="Message Actions"></div><div class="extraMesButtons"><div title="번역" class="mes_button mes_translate fa-solid fa-language interactable"></div><div title="복사" class="mes_button mes_copy fa-solid fa-copy interactable"></div></div></div></div>
<div class="mes"><div class="mes_buttons"><div class="extraMesButtons"><div title="번역" class="mes_button mes_translate fa-solid fa-language interactable"></div></div></div></div></div>
<div id="form_sheld"><div id="nonQRFormItems"><div id="leftSendForm"><div id="options_button" class="fa-solid fa-bars interactable"></div><div id="extensionsMenuButton" class="fa-solid fa-magic-wand-sparkles"></div><div class="fa-solid fa-phone interactable" title="스마트폰"></div></div>
<div id="rightSendForm"><div id="llm_translate_input_button" class="interactable" title="입력 번역"><i class="fa-solid fa-comment-dots"></i></div><div class="interactable" data-act="open-notes"><i class="fa-solid fa-book"></i></div><div class="interactable"><svg></svg></div><div id="send_but" class="fa-solid fa-paper-plane interactable" title="Send"></div></div></div></div>
<div id="extensionsMenu"><div id="translate_wand_container" class="extension_container"><div id="translate_chat" class="list-group-item flex-container"><div class="fa-solid fa-language extensionsMenuExtensionButton"></div><span>Translate Chat</span></div></div>
<div class="extension_container"><div class="list-group-item flex-container interactable"><div class="fa-fw fa-solid fa-star extensionsMenuExtensionButton"></div><span>별자리 열기</span></div><div class="list-group-item flex-container interactable"><svg></svg><span>그림 단추</span></div><div class="list-group-item flex-container interactable"><span>글자뿐</span></div><div class="list-group-item flex-container interactable"><span>글자뿐</span></div></div></div>
<div id="x-1234567"><button class="menu_button"><i class="fa-solid fa-gear"></i></button></div>`;

const pickMod = await load('src/role-icons-pick.js');
await t('8.0.8 화면에서 고르기 — 열쇠 만들기: id → data → title → (메시지) 클래스 → 글자 → 몇 번째, 이름 · 아이콘도 같이', () => {
    const doc = makeDom().html(PAGE);
    const d = sel => pickMod.describePick(doc.querySelector(sel));
    // id 가 있으면 id (어디는 안정된 id 를 가진 가장 가까운 조상)
    assert.deepEqual([d('#send_but').key, d('#send_but').label, d('#send_but').icon], ['#rightSendForm|id|send_but', 'Send', 'fa-solid fa-paper-plane']);
    assert.equal(d('#API-status-top').key, '#sys-settings-button|id|API-status-top');
    assert.equal(d('#translate_chat > span').key, '#translate_wand_container|id|translate_chat', '항목 안 글자를 눌러도 항목');
    assert.equal(d('#translate_chat > .extensionsMenuExtensionButton').key, '#translate_wand_container|id|translate_chat', '항목 안 아이콘 칸을 눌러도 항목');
    // data-* → title → 글자
    assert.deepEqual([d('[data-act="open-notes"]').key, d('[data-act="open-notes"]').icon], ['#rightSendForm|data|act=open-notes', 'fa-solid fa-book']);
    assert.deepEqual([d('[title="스마트폰"]').key, d('[title="스마트폰"]').label], ['#leftSendForm|title|스마트폰', '스마트폰']);
    assert.deepEqual([d('#llm_translate_input_button > i').key, d('#llm_translate_input_button > i').icon], ['#rightSendForm|id|llm_translate_input_button', 'fa-solid fa-comment-dots']);
    const star = doc.querySelectorAll('#extensionsMenu .list-group-item')[1];
    assert.deepEqual([pickMod.describePick(star).key, pickMod.describePick(star).label, pickMod.describePick(star).icon], ['#extensionsMenu|text|별자리 열기', '별자리 열기', 'fa-solid fa-star']);
    // 메시지 안 단추는 클래스(모든 메시지에 되풀이)
    assert.deepEqual([d('.mes_translate').key, d('.mes_translate').label], ['#chat|cls|mes_translate', '번역']);
    assert.equal(d('.mes_copy').key, '#chat|cls|mes_copy');
    // 아무 표시도 없는 것 · 같은 글자가 둘인 것은 몇 번째
    const svgOnly = doc.querySelectorAll('#rightSendForm > div')[2];
    assert.equal(pickMod.describePick(svgOnly).key, '#rightSendForm|nth|2');
    const same = doc.querySelectorAll('#extensionsMenu .list-group-item')[3];
    assert.equal(pickMod.describePick(same).key, '#extensionsMenu|text|글자뿐', '같은 글자 둘 — 첫째를 찾는다(글자가 열쇠)');
    // 생성된 번호가 든 id 는 어디로 안 쓴다
    assert.equal(d('#x-1234567 button').key, '|nth|' + doc.body.querySelectorAll(pickMod.CANDIDATES).indexOf(doc.querySelector('#x-1234567 button')));
    assert.equal(pickMod.describePick(doc.querySelector('#chat')), null, '단추가 아닌 곳은 없음');
    for (const r of [d('#send_but'), d('.mes_translate'), pickMod.describePick(star)]) assert.ok(core.parsePickKey(r.key), r.key);
});

await t('8.0.8 화면에서 고르기 — 다시 찾기: 같은 열쇠로 같은 단추(여럿이면 전부), 새로 붙은 가지 안에서만도', () => {
    const doc = makeDom().html(PAGE);
    const f = key => pickMod.findByKey(doc, key);
    const same = (got, want, msg) => assert.ok(got.length === want.length && got.every((e, i) => e === want[i]), `${msg || ''} 찾은 것 ${got.map(e => e.id || e.className).join(',')} ≠ ${want.map(e => e.id || e.className).join(',')}`);
    same(f('#rightSendForm|id|send_but'), [doc.querySelector('#send_but')]);
    same(f('#rightSendForm|data|act=open-notes'), [doc.querySelector('[data-act="open-notes"]')]);
    same(f('#leftSendForm|title|스마트폰'), [doc.querySelector('[title="스마트폰"]')]);
    same(f('#chat|cls|mes_translate'), [...doc.querySelectorAll('.mes_translate')], '메시지마다 하나씩 둘');
    same(f('#extensionsMenu|text|별자리 열기'), [doc.querySelectorAll('#extensionsMenu .list-group-item')[1]]);
    same(f('#rightSendForm|nth|2'), [doc.querySelectorAll('#rightSendForm > div')[2]]);
    same(f('#extensionsMenu|title|없는 것'), []);
    same(f('#없는곳|id|send_but'), [], '어디가 없으면 없음');
    same(f('bad'), []);
    // 새로 붙은 가지(요술봉 메뉴가 다시 그려짐 · 새 메시지)에서만 찾기
    const mes = doc.createElement('div'); mes.className = 'mes'; mes.innerHTML = '<div class="mes_buttons"><div class="extraMesButtons"><div title="번역" class="mes_button mes_translate fa-solid fa-language interactable"></div></div></div>';
    doc.querySelector('#chat').append(mes);
    same(pickMod.findByKey(doc, '#chat|cls|mes_translate', mes), [mes.querySelector('.mes_translate')], '새 가지 안의 것만');
    same(pickMod.findByKey(doc, '#chat|cls|mes_translate', doc.querySelector('#extensionsMenu')), [], '다른 가지면 없음');
    same(pickMod.findByKey(doc, '#rightSendForm|id|send_but', mes), [], 'id 단추도 그 가지 밖이면 없음');
});

await t('8.0.8 화면에서 고르기 — 표식: 글자 옆 아이콘 칸에, svg 아이콘은 단추에 inline 표식, 감시는 고른 게 있을 때만 · 뺀 단추는 표식을 걷는다', () => {
    const doc = makeDom().html(PAGE);
    let observer = null;
    globalThis.MutationObserver = class { constructor(cb) { this.cb = cb; observer = this; } observe(target, opts) { this.target = target; this.opts = opts; } disconnect() { observer = null; } };
    const picks = {};
    for (const key of ['#extensionsMenu|text|별자리 열기', '#chat|cls|mes_translate', '#rightSendForm|id|send_but', '#extensionsMenu|text|그림 단추']) picks[core.pickSlug(key)] = { key, label: 'x', value: 'tx:★' };
    pickMod.syncPicks(picks, doc);
    const star = doc.querySelectorAll('#extensionsMenu .list-group-item')[1];
    assert.equal(star.querySelector('.extensionsMenuExtensionButton').getAttribute('data-bl-pick'), core.pickSlug('#extensionsMenu|text|별자리 열기'), '글자 옆 아이콘 칸에');
    assert.equal(star.getAttribute('data-bl-pick'), null);
    const pic = doc.querySelectorAll('#extensionsMenu .list-group-item')[2];
    assert.equal(pic.getAttribute('data-bl-pick-inline'), core.pickSlug('#extensionsMenu|text|그림 단추'), 'svg 아이콘 + 글자는 단추에 inline 표식');
    assert.equal(doc.querySelector('#send_but').getAttribute('data-bl-pick'), core.pickSlug('#rightSendForm|id|send_but'));
    assert.deepEqual([...doc.querySelectorAll('.mes_translate')].map(e => e.getAttribute('data-bl-pick')), Array(2).fill(core.pickSlug('#chat|cls|mes_translate')));
    assert.ok(observer && observer.target === doc.body && observer.opts.childList && observer.opts.subtree, '감시 켜짐');
    assert.deepEqual(pickMod.pickState().slugs.length, 4);
    // 새 메시지가 붙으면 그 가지만 다시
    const mes = doc.createElement('div'); mes.className = 'mes'; mes.innerHTML = '<div class="mes_buttons"><div class="extraMesButtons"><div title="번역" class="mes_button mes_translate fa-solid fa-language interactable"></div></div></div>';
    doc.querySelector('#chat').append(mes);
    observer.cb([{ addedNodes: [mes] }]);
    assert.equal(mes.querySelector('.mes_translate').getAttribute('data-bl-pick'), core.pickSlug('#chat|cls|mes_translate'));
    // 같은 값으로 다시 불러도(슬라이더마다 applyAll) 다시 찾지 않는다 — 표식을 손으로 지워 보면 그대로
    doc.querySelector('#send_but').removeAttribute('data-bl-pick');
    pickMod.syncPicks(picks, doc);
    assert.equal(doc.querySelector('#send_but').getAttribute('data-bl-pick'), null, '바뀐 게 없으면 손대지 않는다');
    // 하나를 빼면 그 표식만 걷고 나머지는 다시 단다
    const less = { ...picks }; delete less[core.pickSlug('#extensionsMenu|text|별자리 열기')];
    pickMod.syncPicks(less, doc);
    assert.equal(star.querySelector('.extensionsMenuExtensionButton').getAttribute('data-bl-pick'), null);
    assert.equal(doc.querySelector('#send_but').getAttribute('data-bl-pick'), core.pickSlug('#rightSendForm|id|send_but'));
    // 모두 빼면 표식 0 · 감시 끔
    pickMod.syncPicks({}, doc);
    assert.equal(doc.querySelectorAll('[data-bl-pick]').length + doc.querySelectorAll('[data-bl-pick-inline]').length, 0);
    assert.equal(observer, null);
    assert.deepEqual(pickMod.pickState(), { observing: false, slugs: [] });
    pickMod.syncPicks(undefined, doc);
    delete globalThis.MutationObserver;
});

await t('8.0.8 화면에서 고르기 — 누르기: 단추를 누르면 열쇠가 나오고 동작은 막힘, 메뉴 여는 단추는 그대로 열림, 취소 · Esc', () => {
    const doc = makeDom().html(PAGE);
    const got = [];
    let cancelled = 0;
    pickMod.startPicking({ doc, onPick: r => got.push(r), onCancel: () => cancelled++ });
    assert.ok(pickMod.isPicking() && doc.documentElement.classList.contains('bl-roleicon-picking') && doc.body.querySelector('.bl-roleicon-pickbar'));
    let ev = doc.dispatch('click', doc.querySelector('#extensionsMenuButton'));
    assert.equal(ev.defaultPrevented, false, '요술봉은 열려야 하니 막지 않는다');
    assert.equal(got.length, 0);
    ev = doc.dispatch('click', doc.querySelector('#chat'));
    assert.equal(ev.defaultPrevented, false, '단추가 아닌 곳은 그대로');
    ev = doc.dispatch('click', doc.querySelector('#translate_chat > span'));
    assert.equal(ev.defaultPrevented, true, '단추 동작은 막는다');
    assert.deepEqual(got, [{ key: '#translate_wand_container|id|translate_chat', label: 'Translate Chat', icon: 'fa-solid fa-language', slug: core.pickSlug('#translate_wand_container|id|translate_chat') }]);
    assert.ok(!pickMod.isPicking() && !doc.body.querySelector('.bl-roleicon-pickbar') && !doc.documentElement.classList.contains('bl-roleicon-picking'), '고르면 끝');
    assert.equal(doc.listeners.length, 0, '듣기도 걷는다');
    pickMod.startPicking({ doc, onPick: r => got.push(r), onCancel: () => cancelled++ });
    doc.dispatch('click', doc.body.querySelector('.bl-roleicon-pickbar button'));
    assert.equal(cancelled, 1);
    pickMod.startPicking({ doc, onPick: r => got.push(r), onCancel: () => cancelled++ });
    doc.dispatch('keydown', 'Escape');
    assert.equal(cancelled, 2);
    assert.equal(got.length, 1);
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
    assert.ok(fs.readFileSync(path.join(root, 'src/apply.js'), 'utf8').includes('syncRoleIcons(') && fs.readFileSync(path.join(root, 'src/apply.js'), 'utf8').includes('syncPicks('), '8.0.8 고른 단추 표식도 applyAll 에서');
    const ui = fs.readFileSync(path.join(root, 'src/role-icons-ui.js'), 'utf8');
    for (const act of ['role-icon-pick', 'role-icon-reset-all', 'role-icon-open']) assert.ok(ui.includes(`'${act}'`), act);
    assert.ok(ui.includes('data-md-fold="icons:${group}"'), '묶음은 접히고 panel.js 가 여닫은 것을 기억한다');
    const css = fs.readFileSync(path.join(root, 'css/49-role-icons.css'), 'utf8');
    for (const sel of css.match(/^[^\s/*@}][^{]*\{/gm) || []) assert.match(sel, /\.bl-(roleicon|icon)|\.bl-iconadd/, `49 는 새 클래스만: ${sel}`);
});

console.log(`role-icons: ${n}개 통과`);
