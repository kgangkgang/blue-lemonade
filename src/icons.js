// 얇은 선 아이콘 (24×24, 선 1.6). 기존 Font Awesome 글자 대신 CSS mask로 그림.
// body.salty.salty-icons-line 일 때만 적용.
const ICONS = {
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    plug: '<path d="M9 3v4M15 3v4M7 7h10v3.5a5 5 0 0 1-10 0V7zM12 15.5V21"/>',
    type: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
    book: '<path d="M12 6.5C10 5 7 4.5 4 5v13.5c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5V20"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4.5 17.5 4.5-4 3.5 3 3-2.5 4 3.5"/>',
    blocks: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.8 14.3c1.8 1.9 4.6 1.9 6.4 0M9.5 10h.01M14.5 10h.01"/>',
    card: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="11" r="2.1"/><path d="M6 16.3c.7-1.6 1.8-2.4 3-2.4s2.3.8 3 2.4M14.5 10h3.5M14.5 13.5h2.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h11"/>',
    sparkle: '<path d="M11 4l1.7 4.8 4.8 1.7-4.8 1.7L11 17l-1.7-4.8-4.8-1.7 4.8-1.7z"/><path d="M18.5 15v4.5M16.25 17.25h4.5"/>',
    send: '<path d="M19.3 4.7 3.7 10.9c-.8.3-.7 1.4.1 1.6l5.5 1.9 1.9 5.5c.2.8 1.3.9 1.6.1l6.5-15.3zM9.3 14.4l4.6-4.6"/>',
    next: '<path d="M5 12h13M13 6.5 18.5 12 13 17.5"/>',
    // 짧은 선의 둥근 끝에 기대지 않고 실제 면적으로 그린다 (모바일 마스크 렌더러 호환).
    more: '<g fill="#000" stroke="none"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></g>',
    pencil: '<path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-4-4l-10 10v4zM13.5 7.5l3 3"/>',
    chevron: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
    feather: '<path d="M20.2 3.8c-6.4.3-11.4 4-12.8 10.1L7 17l3.1-.4c6.2-1.3 9.8-6.4 10.1-12.8zM3.8 20.2l9.9-9.9M12.2 12.9h4.3"/>',
    stop: '<rect x="7.5" y="7.5" width="9" height="9" rx="1.8" fill="#000"/>',
    // 명령(스크립트) 실행 버튼: 생성 멈춤(꽉 찬 네모)과 달리 선으로만
    pause: '<path d="M9.5 7.5v9M14.5 7.5v9"/>',
    play: '<path d="M9 7.2v9.6c0 .8.9 1.2 1.5.8l6.9-4.8c.6-.4.6-1.2 0-1.6l-6.9-4.8C9.9 6 9 6.4 9 7.2z"/>',
    halt: '<rect x="7.25" y="7.25" width="9.5" height="9.5" rx="2"/>',
    userpen: '<circle cx="10" cy="8" r="3.4"/><path d="M4 19.5c.7-3.2 3-5 6-5 1 0 2 .2 2.8.6M15.3 20.2l.4-2.4 3.6-3.6a1.35 1.35 0 0 1 1.9 1.9l-3.6 3.6z"/>',
};
const STROKE = { more: 3, send: 2, pause: 2.4, play: 2, halt: 2.1 };
const BASE_STROKE = 1.8;

const TARGETS = [
    ['#leftNavDrawerIcon', 'sliders'],
    ['#API-status-top', 'plug'],
    ['#advanced-formatting-button .drawer-icon', 'type'],
    ['#WIDrawerIcon', 'book'],
    ['#user-settings-button .drawer-icon', 'gear'],
    ['#backgrounds-button .drawer-icon', 'image'],
    ['#extensions-settings-button .drawer-icon', 'blocks'],
    ['#persona-management-button .drawer-icon', 'smile'],
    ['#rightNavDrawerIcon', 'card'],
    ['#options_button', 'menu'],
    ['#extensionsMenuButton', 'sparkle'],
    ['#send_but', 'send'],
    ['#mes_continue', 'next'],
    ['#mes_impersonate', 'userpen'],
    ['#mes_stop i', 'stop'],
    ['#rightSendForm > .stscript_pause > i', 'pause'],
    ['#rightSendForm > .stscript_continue > i', 'play'],
    ['#rightSendForm > .stscript_stop > i', 'halt'],
    // 전개지시 확장의 깃털 버튼 · 깃털 창 제목
    ['#jj-button i', 'feather'],
    ['#jj-popup .jj-popup-title i', 'feather'],
    // 이 두 줄만 미리보기 갈고리(.salty-preview)를 같이 잡는다 — 이 CSS 는 iconsCss() 가 문자열로 만들어
    // style.css 복제 생성기가 볼 수 없어서, 넓히지 않으면 설정 창 미리보기에서 아이콘이 안 바뀐다.
    // :is() 의 특이도는 인자 중 최대값이라 (1,4,1) 그대로 — 실제 채팅 동작은 바뀌지 않는다
    [':is(#chat, .salty-preview) .mes .extraMesButtonsHint', 'more'],
    [':is(#chat, .salty-preview) .mes .mes_edit', 'pencil'],
    ['#rm_button_characters', 'menu'],
    // 설정 칸 여닫기: 까만 동그라미 대신 얇은 꺾쇠 (열리면 CSS에서 뒤집음)
    ['.inline-drawer-icon', 'chevron'],
];

function svgUrl(name) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="${STROKE[name] || BASE_STROKE}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

let cache = '';

/** 아이콘 CSS 한 덩이 (한 번만 만들어 둠). 넣고 빼기는 apply.js — 테마를 끄면 비움 */
export function iconsCss() {
    if (cache) return cache;
    const scope = 'body.salty.salty-icons-line';
    const vars = Object.keys(ICONS).map(n => `--salty-ico-${n}: ${svgUrl(n)};`).join('\n');
    const all = TARGETS.map(([sel]) => `${scope} ${sel}::before`).join(',\n');
    const each = TARGETS.map(([sel, n]) => `${scope} ${sel}::before { -webkit-mask-image: var(--salty-ico-${n}); mask-image: var(--salty-ico-${n}); }`).join('\n');
    cache = `:root {\n${vars}\n}\n${all} {\n  content: "" !important;\n  display: inline-block;\n  width: 1em;\n  height: 1em;\n  vertical-align: -0.125em;\n  background-color: currentColor;\n  -webkit-mask-position: center; mask-position: center;\n  -webkit-mask-size: contain; mask-size: contain;\n  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;\n}\n${each}`;
    return cache;
}
