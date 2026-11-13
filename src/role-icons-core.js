// 7.9.3 단추 아이콘 바꾸기 — 같은 역할 단추(닫기 · 되돌리기 · 찾기 …)의 아이콘을 역할마다 하나로 바꾼다.
//
// 이 파일은 화면(DOM) 없이 도는 부분만: 역할 목록 · 저장값 검사 · SVG 정리 · 그림 파일 확인 · CSS 만들기.
// 화면에 거는 일은 role-icons.js, 설정 창은 role-icons-ui.js. 시험: tools/tests/role-icons.mjs
//
// 저장: 설정 roleIcons = { <역할 id>: 값 문자열 } — 바꾼 역할만 담는다(비어 있으면 아무 CSS 도 안 만든다 = 화면 그대로).
//   'fa:s:<이름>:<글자번호>'   Font Awesome 실선(s) · 브랜드(b) — 실리태번이 싣는 글꼴 그대로, 글자 번호는 16진수만
//   'tx:<글자>'               이모지 · 글자 한두 개
//   'im:data:image/…;base64,…' 내 그림(PNG · WebP · 정리한 SVG), 파일 64KB 까지 — 원래 색 그대로
// 한 역할을 바꾸면 그 역할의 단추가 테마 곳곳(설정 창 머리 도구 줄 · 애드온 창 · 번역 창 …)에서 한꺼번에 바뀐다:
//   아래 ROLES 의 선택자가 「그 역할」 한 곳이다. 크기 · 누르는 칸 · 자리 · 이름(aria-label)은 단추 그대로 두고 그림만 바꾼다.
//
// 화면 단추까지: 상단 서랍(연결 · AI 응답 설정 · 고급 서식 · 월드 인포 · 사용자 설정 · 배경 · 확장 · 페르소나 · 캐릭터) · 입력줄(옵션 ≡ · 요술봉 ·
//   보내기 · 이어 쓰기 · 대신 쓰기 · 멈춤) · 내장 애드온 단추(전개 지시 깃털 · 보내기 번역 말풍선)도 역할이다(group 으로 묶음, size:'host' = 단추 글자 크기를 따른다).
//   확장이 더한 단추(요술봉 메뉴 항목 · 입력줄 아이콘 · 메시지 단추 …)는 이름을 코드에 두지 않고 「화면에서 고르기」(role-icons-pick.js)로 골라
//   설정 pickedIcons = { <열쇠 해시>: { key, label, icon?, value? } } 에 담는다. 열쇠(key)는 「어디|무엇으로|값」 — 새로고침 · 확장 껐다 켬 뒤에도 같은 단추를 다시 찾는다.
//   CSS 는 role-icons-pick.js 가 그 단추에 단 data-bl-pick="<해시>" 표식으로 건다(요술봉 메뉴처럼 다시 그려지는 곳은 MutationObserver 가 바뀐 곳만 다시 단다).

import { lineIconUrl } from './icons.js';   // 상단 서랍 · 입력줄의 기본 그림 = 테마 선 아이콘 그대로
import { ROLE_ICON_MAX_BYTES, ROLE_ICON_MAX_DATA, tidyPickedIcons, parseRoleIcon, bytesToBase64, sanitizeSvg } from './role-icons-tidy.js';
// 1.1.5: 설정을 읽을 때 쓰는 정리(저장값 검사 · 고른 단추 열쇠 · SVG 정리)는 role-icons-tidy.js 로 — 시작 묶음에는 그쪽만 들어요. 예전 이름은 여기서 그대로 내보내요
export { ROLE_ICON_MAX_BYTES, ROLE_ICON_MAX_DATA, ROLE_TEXT_MAX, PICK_MAX, PICK_LABEL_MAX, ROLE_IDS, parsePickKey, pickSlug, tidyPick, tidyPickedIcons, graphemes, cleanRoleText, parseRoleIcon, faValue, textValue, tidyRoleIcons, bytesToBase64, sanitizeSvg } from './role-icons-tidy.js';

export const PICK_ATTR = 'data-bl-pick';           // 고른 단추(또는 그 안의 아이콘 칸)에 다는 표식
export const PICK_INLINE_ATTR = 'data-bl-pick-inline';   // 글자 옆 svg · img 아이콘일 때: 단추 자체에 달고 아이콘 자리에 새 그림을 끼운다

// 테마가 그리는 창들 — 「이름표(aria-label)로 찾는」 단추는 이 안에서만 (다른 확장 · 실리태번 단추는 건드리지 않는다)
const ROOTS = ':is(.salty-panel, .bl-tool-dialog, .bl-credits-dialog, .bl-notice-dialog, .bl-fruit-icon-picker, .bl-fruit-option-help, .bl-ft-dialog, .bl-notes-dialog, .bl-sticky, .bl-translator-dialog, .bl-assets-dialog, .bl-ctsi-dialog, .bl-direction-dialog, .bl-mermaid-dialog, .bl-pbind-dialog, .bl-capture-dialog, .bl-dialogue-tildes, .bl-chat-graph, .bl-first-run, .bl-embedded-settings, .blzi-dialog, .llmt-check-board, .llmt-selection, .pt-help-dialog, #pt-panel, #cg-panel, .cg-root, .cg-viewer, .eh-root, .po-dialog, .rl-root, .pa-hub)';
const labels = (...names) => names.map(n => `[aria-label="${n}"]`).join(', ');
const inRoots = (...names) => `${ROOTS} :is(button, summary, [role="button"]):is(${labels(...names)})`;
// 애드온이 실리태번 팝업으로 뜰 때 머리의 × (css/85-addon-unify.css 와 같은 선택자)
const ST_POPUP_CLOSE = 'dialog.popup:has(> .popup-body > .popup-content > :is(#lv_settings, .bwr_settings, #model_register_settings, #model-switch-settings, .po-dialog, .pa-hub, .rl-root, #regex-link-settings)) > .popup-button-close';
const PREVIEW = id => `.bl-roleicon-preview[data-bl-role="${id}"]`;

const svg = (sw, d) => `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='black' stroke-width='${sw}' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='${d}'/%3E%3C/svg%3E")`;

/**
 * 역할 14개 (design-system components/icon-button.css 의 .ds-tool[data-role] 와 같은 id · 같은 기본 선 그림).
 *   swap  : 단추 자체를 칸으로 — 단추 안 글자 · 아이콘은 투명하게 두고(크기 그대로) 그 가운데에 새 그림
 *   inline: 글자와 같이 있는 단추(「설정 선택 ≡ 이름」) — 안의 선 그림 하나만 새 그림으로
 */
export const ROLES = [
    { id: 'close', label: '닫기', glyph: svg(1.8, 'M3 3l14 14M17 3 3 17'),
      swap: ['.salty-panel .bl-settings-close', '.salty-panel .bl-editor-directory-head > [data-act="editor-catalog-close"]', '.bl-credits-dialog > header > button', '.pt-help-dialog > header > button',
          `${ROOTS} :is(header, [class*="head"], [class*="top"]) :is(button, [role="button"]):is([aria-label="닫기"], [aria-label$=" 닫기"])`,
          '#pt-panel #pt-panel-close', '#cg-panel .cg-icon-btn[data-act="close"]', '.llmt-check-head > .llmt-check-x', ST_POPUP_CLOSE] },
    { id: 'back', label: '뒤로', glyph: svg(2, 'M12.5 5 7.5 10l5 5'), swap: [inRoots('뒤로'), '.rl-root .rl-back'] },
    { id: 'prev', label: '이전', glyph: svg(2, 'M12.5 5 7.5 10l5 5'), swap: [inRoots('이전', '이전 그림', '이전 표본')] },
    { id: 'next', label: '다음', glyph: svg(2, 'M7.5 5l5 5-5 5'), swap: [inRoots('다음', '다음 그림', '다음 표본')] },
    { id: 'undo', label: '되돌리기', glyph: svg(1.7, 'M8.4 5H10A6.2 6.2 0 1 1 5.62 6.82M10.9 2.5 8.4 5l2.5 2.5'), swap: ['.bl-editor .bl-editor-actions > [data-act="history-undo"]', inRoots('되돌리기')] },
    { id: 'redo', label: '다시 실행', glyph: svg(1.7, 'M11.6 5H10A6.2 6.2 0 1 0 14.38 6.82M9.1 2.5 11.6 5 9.1 7.5'), swap: ['.bl-editor .bl-editor-actions > [data-act="history-redo"]', inRoots('다시 실행')] },
    { id: 'reset', label: '처음 값', glyph: svg(1.7, 'M8.4 5H10A6.2 6.2 0 1 1 5.62 6.82M10.9 2.5 8.4 5l2.5 2.5'), swap: ['.bl-editor .bl-setting-reset', ':is(.salty-panel, .bl-ft-dialog) .bl-view-resize > button:not(.bl-view-toggle)', inRoots('기본값으로')] },
    { id: 'search', label: '찾기', glyph: svg(1.8, 'M9 3.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11ZM13 13l4 4'), swap: ['.bl-editor .bl-editor-actions > [data-act="editor-search"]', inRoots('검색', '찾기', '메모에서 찾기')] },
    { id: 'fullscreen', label: '전체 화면', glyph: svg(1.8, 'M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4'), swap: ['.salty-panel .bl-settings-expand:not([aria-pressed="true"])'] },
    { id: 'fullscreen-exit', label: '작은 창', glyph: svg(1.8, 'M7 3v4H3M13 3v4h4M17 13h-4v4M3 13h4v4'), swap: ['.salty-panel .bl-settings-expand[aria-pressed="true"]'] },
    { id: 'menu', label: '목록', glyph: svg(1.8, 'M3 5h14M3 10h14M3 15h14'), swap: [inRoots('메모 목록', '채팅 목록')], inline: ['.bl-editor .bl-settings-toprow .bl-editor-choose'] },
    { id: 'more', label: '더 보기', glyph: svg(2.6, 'M4 10h.01M10 10h.01M16 10h.01'), swap: ['.salty-panel .salty-style-more', '#pt-panel .pt-more-actions > summary', 'body.salty #WorldInfo .bl-wi-actions > summary'] },
    { id: 'plus', label: '추가', glyph: svg(1.8, 'M10 3v14M3 10h14'), swap: [inRoots('새 메모', '용어집에 넣기')] },
    { id: 'check', label: '확인', glyph: svg(2, 'M3.5 10.5 8 15 16.5 5'), swap: [inRoots('넣기')] },
    // ── 화면 단추 — 실리태번 상단 서랍 아이콘(id 는 실리태번 index.html 그대로). 기본 그림 = 테마 선 아이콘(icons.js). size:'host' = 그 단추의 글자 크기를 따른다
    { id: 'api', label: '연결', group: 'top', size: 'host', glyph: lineIconUrl('plug'), swap: ['#API-status-top'] },
    { id: 'preset', label: 'AI 응답 설정', group: 'top', size: 'host', glyph: lineIconUrl('sliders'), swap: ['#leftNavDrawerIcon'] },
    { id: 'format', label: '고급 서식', group: 'top', size: 'host', glyph: lineIconUrl('type'), swap: ['#advanced-formatting-button .drawer-icon'] },
    { id: 'worldinfo', label: '월드 인포', group: 'top', size: 'host', glyph: lineIconUrl('book'), swap: ['#WIDrawerIcon'] },
    { id: 'usersettings', label: '사용자 설정', group: 'top', size: 'host', glyph: lineIconUrl('gear'), swap: ['#user-settings-button .drawer-icon'] },
    { id: 'background', label: '배경', group: 'top', size: 'host', glyph: lineIconUrl('image'), swap: ['#backgrounds-button .drawer-icon'] },
    { id: 'extensions', label: '확장', group: 'top', size: 'host', glyph: lineIconUrl('blocks'), swap: ['#extensions-settings-button .drawer-icon'] },
    { id: 'persona', label: '페르소나', group: 'top', size: 'host', glyph: lineIconUrl('smile'), swap: ['#persona-management-button .drawer-icon'] },
    { id: 'characters', label: '캐릭터', group: 'top', size: 'host', glyph: lineIconUrl('card'), swap: ['#rightNavDrawerIcon'] },
    // ── 입력줄
    { id: 'options', label: '옵션 메뉴', group: 'bottom', size: 'host', glyph: lineIconUrl('menu'), swap: ['#options_button'] },
    { id: 'wand', label: '요술봉', group: 'bottom', size: 'host', glyph: lineIconUrl('sparkle'), swap: ['#extensionsMenuButton'] },
    { id: 'send', label: '보내기', group: 'bottom', size: 'host', glyph: lineIconUrl('send'), swap: ['#send_but'] },
    { id: 'continue', label: '이어 쓰기', group: 'bottom', size: 'host', glyph: lineIconUrl('next'), swap: ['#mes_continue'] },
    { id: 'impersonate', label: '대신 쓰기', group: 'bottom', size: 'host', glyph: lineIconUrl('userpen'), swap: ['#mes_impersonate'] },
    { id: 'stop', label: '멈춤', group: 'bottom', size: 'host', glyph: lineIconUrl('stop'), swap: ['#rightSendForm > #mes_stop'] },
    // ── 내장 애드온이 입력줄에 더하는 단추
    { id: 'direction', label: '전개 지시', group: 'addon', size: 'host', glyph: lineIconUrl('feather'), swap: ['#jj-button'] },
    { id: 'translate-input', label: '보내기 번역', group: 'addon', size: 'host', glyph: lineIconUrl('bubble'), swap: ['#llm_translate_input_button'] },
];
// 미리보기 칸(설정 창 목록 · 고르기 창 머리)도 같은 역할 — 역할 선택자에 끼워 두면 바꾼 그림이 저절로 보인다
for (const role of ROLES) { role.group ||= 'tool'; role.size ||= 'tool'; role.swap.push(PREVIEW(role.id)); }
export const roleLabel = id => ROLES.find(r => r.id === id)?.label || id;
/** 설정 창 묶음 순서 · 이름 (group 값 → 이름). 'picked' 는 화면에서 고른 단추 */
export const ROLE_GROUPS = [['tool', '창 도구'], ['top', '상단 서랍'], ['bottom', '입력줄'], ['addon', '애드온 단추'], ['picked', '내 단추']];
export const rolesIn = group => ROLES.filter(r => r.group === group);

/** 고른 단추 묶음 → 설정 창 줄에 쓰는 역할 모양 [{ id:'@<해시>', label, icon, value, key }] */
export function pickedRoles(map) {
    return Object.entries(tidyPickedIcons(map)).map(([slug, e]) => ({ id: `@${slug}`, slug, label: e.label, icon: e.icon || '', value: e.value || '', key: e.key, group: 'picked', size: 'host' }));
}

// ───────── 그림 파일 ─────────
/** 파일 앞 바이트로 종류 확인 (확장자 · 브라우저가 알려 준 종류는 믿지 않는다) */
export function sniffImage(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
    if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
    const head = new TextDecoder('utf-8', { fatal: false }).decode(b.subarray(0, 1024)).replace(/^\ufeff/, '').trimStart();
    if (/^(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(head)) return 'image/svg+xml';
    return '';
}
const encodeText = text => bytesToBase64(new TextEncoder().encode(text));

/**
 * 올린 그림 파일(바이트) → 저장값 'im:…' 또는 오류 { error }.
 * PNG · WebP 는 그대로, SVG 는 sanitizeSvg 로 새로 쓴 것만 (스크립트 · 바깥 참조 · 글꼴 · 스타일 시트 없이).
 */
export function imageFileValue(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!b.length) return { error: '빈 파일이에요' };
    if (b.length > ROLE_ICON_MAX_BYTES) return { error: `그림은 ${ROLE_ICON_MAX_BYTES / 1024}KB 까지예요 (이 파일은 ${Math.ceil(b.length / 1024)}KB)` };
    const mime = sniffImage(b);
    if (!mime) return { error: 'PNG · SVG · WebP 그림만 넣을 수 있어요' };
    if (mime !== 'image/svg+xml') return { value: `im:data:${mime};base64,${bytesToBase64(b)}` };
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return { error: 'SVG 글자 모양(UTF-8)을 읽지 못했어요' }; }
    const clean = sanitizeSvg(text);
    if (!clean) return { error: '그릴 수 있는 모양이 없거나 읽을 수 없는 SVG 예요' };
    const value = `im:data:image/svg+xml;base64,${encodeText(clean)}`;
    return value.length > ROLE_ICON_MAX_DATA + 3 ? { error: '정리한 SVG 가 너무 커요' } : { value };
}


// ───────── CSS ─────────
const cssString = text => `"${[...text].map(ch => `\\${ch.codePointAt(0).toString(16)} `).join('').trimEnd()}"`;
// 철칙 §2 「같은 역할 단추는 같은 크기」: 창 도구 줄은 잉크 ≈12.5 — 선 그림 상자 16 · Font Awesome 12.5. 그림 · 글자도 같은 잉크 크기로.
// 화면 단추(size:'host')는 그 단추의 글자 크기(1em)를 상자로, 잉크는 .8em — 테마 선 아이콘(24칸 안 17)과 같은 비율이라 옆 단추와 크기가 맞는다
export const ROLE_TOKENS = { '--bl-role-box': '16px', '--bl-role-fa': '12.5px', '--bl-role-img': '12.5px', '--bl-role-text': '13px', '--bl-role-hbox': '1em', '--bl-role-hink': '.8em' };
const SIZES = {
    tool: { box: 'var(--bl-role-box)', fa: 'var(--bl-role-fa)', img: 'var(--bl-role-img)', text: 'var(--bl-role-text)' },
    host: { box: 'var(--bl-role-hbox)', fa: 'var(--bl-role-hink)', img: 'var(--bl-role-hink)', text: 'var(--bl-role-hink)' },
};

function glyphRules(icon, size = SIZES.tool) {
    if (icon.kind === 'fa') return `content:"\\${icon.code}"!important;background:none!important;font:${icon.family === 'brands' ? '400' : '900'} ${size.fa}/1 "${icon.family === 'brands' ? 'Font Awesome 6 Brands' : 'Font Awesome 6 Free'}"!important;`;
    if (icon.kind === 'text') return `content:${cssString(icon.text)}!important;background:none!important;font-style:normal!important;font-weight:400!important;font-size:${size.text}!important;line-height:1!important;font-family:var(--salty-font-ui)!important;`;
    return `content:""!important;background:url("${icon.url}") center/contain no-repeat!important;width:${size.img}!important;height:${size.img}!important;`;
}
// 단추 가운데 칸: 원래 ::before 가 무엇을 그리던(선 그림 마스크 · × 글자 · 빈 칸) 모두 덮어쓰고 새 그림만
const box = size => `display:flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:${size.box}!important;height:${size.box}!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;text-shadow:none!important;transform:none!important;opacity:1!important;visibility:visible!important;pointer-events:none!important;letter-spacing:0!important;text-indent:0!important;text-transform:none!important;white-space:nowrap!important;color:inherit!important;-webkit-text-fill-color:currentColor!important;-webkit-mask:none!important;mask:none!important;filter:none!important;animation:none!important;`;
const SWAP_PLACE = 'position:absolute!important;inset:0!important;margin:auto!important;';
const INLINE_PLACE = 'position:static!important;inset:auto!important;margin:0!important;flex:none!important;order:-1!important;';
// 글자 옆 svg · img 아이콘을 바꿀 때(고른 단추): 아이콘은 숨기고 새 그림을 글자 앞에 끼운다
const PICK_INLINE_PLACE = 'position:static!important;inset:auto!important;margin:0 .4em 0 0!important;flex:none!important;order:-1!important;vertical-align:-.125em!important;';
// 선택자 앞 html:not(#bl-ri) — 맞는 요소는 그대로, 무게(특이도)만 아이디 하나만큼 올려 테마의 같은 자리 규칙보다 앞선다
const BOOST = 'html:not(#bl-ri)';

function swapRules(label, swap, icon, size) {
    const glyph = glyphRules(icon, size);
    return [`/* ${label} */`,
        `:where(${swap}){position:relative}`,
        `${BOOST} :is(${swap}){-webkit-text-fill-color:transparent!important;text-shadow:none!important}`,
        `${BOOST} :is(${swap})>*{visibility:hidden!important}`,
        `${BOOST} :is(${swap})::before{${SWAP_PLACE}${box(size)}${glyph}}`];
}

/** roleIcons(+ pickedIcons) → CSS 글. 바꾼 역할이 없으면 '' (그러면 <style> 도 만들지 않는다) */
export function buildRoleCss(map, picks) {
    const rules = [];
    for (const role of ROLES) {
        const icon = parseRoleIcon(map?.[role.id]);
        if (!icon) continue;
        const size = SIZES[role.size] || SIZES.tool;
        rules.push(...swapRules(role.id, role.swap.join(', '), icon, size));
        if (role.inline?.length) {
            const inline = role.inline.join(', ');
            rules.push(`${BOOST} :is(${inline})>svg{display:none!important}`,
                `${BOOST} :is(${inline})::before{${INLINE_PLACE}${box(size)}${glyphRules(icon, size)}}`);
        }
    }
    // 화면에서 고른 단추 — role-icons-pick.js 가 단 표식으로. 미리보기 칸(data-bl-role="@<해시>")도 같이
    for (const [slug, entry] of Object.entries(tidyPickedIcons(picks))) {
        const icon = parseRoleIcon(entry.value);
        if (!icon) continue;
        const glyph = glyphRules(icon, SIZES.host);
        rules.push(...swapRules(`pick ${slug}`, `[${PICK_ATTR}="${slug}"], ${PREVIEW(`@${slug}`)}`, icon, SIZES.host),
            `${BOOST} [${PICK_INLINE_ATTR}="${slug}"]>:is(svg,img){display:none!important}`,
            `${BOOST} [${PICK_INLINE_ATTR}="${slug}"]::before{${PICK_INLINE_PLACE}${box(SIZES.host)}${glyph}}`);
    }
    if (!rules.length) return '';
    const tokens = Object.entries(ROLE_TOKENS).map(([k, v]) => `${k}:${v}`).join(';');
    return `/* Blue Lemonade 단추 아이콘 (설정 › 테마 › 단추 아이콘) */\n:root{${tokens}}\n${rules.join('\n')}\n`;
}
