// 6.6.9 대사만 보기 — ··· 메뉴에 단추 하나. 화면(dialogue-view.js)은 단추를 처음 누를 때 불러온다.
// 감시자 · 타이머 없음: 실리태번 메시지 틀(#message_template)에 단추를 넣어 두면 새로 그리는 메시지가 틀째 복제해 간다.
//   이미 그려진 메시지에는 켤 때 한 번만 넣는다. 끄면 틀과 채팅에서 모두 뗀다.
// 클래스 mes_dialogue_only 는 메시지 버튼 고정(mes-pins.js pinKey)이 알아보는 이름이라 이름 줄로 꺼낼 수도 있다.
const KEY = 'mes_dialogue_only';
const LABEL = '대사만 보기';
let active = false, bound = false, view = null;
// 테마의 얇은 선 아이콘(css/11-chrome.css 의 --salty-mi-*)을 쓸 때 다른 메뉴 단추처럼 말풍선 선 아이콘으로 — 메뉴 안이든 이름 줄에 고정했든
const ICON = `body.salty.salty-icons-line #chat .mes .${KEY}::before{content:""!important;display:inline-block;width:1em;height:1em;vertical-align:-.125em;background-color:currentColor;-webkit-mask:var(--salty-mi-chatdots) center/contain no-repeat;mask:var(--salty-mi-chatdots) center/contain no-repeat}`;

function make() {
    const el = document.createElement('div');
    el.className = `mes_button ${KEY} fa-solid fa-comments interactable`;
    el.title = LABEL;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', LABEL);
    return el;
}
/** 메시지(또는 틀) 하나의 ··· 메뉴에 단추가 없으면 넣는다 — 고정으로 이름 줄에 꺼내 둔 것도 있는 것으로 친다 */
function place(mes) {
    const menu = mes?.querySelector?.('.mes_buttons > .extraMesButtons');
    if (menu && !mes.querySelector(`.${KEY}`)) menu.append(make());
}
function open(el) {
    const id = Number(el.closest('.mes')?.getAttribute('mesid'));
    if (!Number.isInteger(id) || id < 0) return;
    view ??= import('./dialogue-view.js').catch((error) => { view = null; throw error; });
    view.then(m => m.openDialogueView(id)).catch((error) => {
        console.warn('[Blue Lemonade] 대사만 보기', error);
        window.toastr?.warning?.('대사만 보기를 열지 못했어요. 새로고침 후 다시 눌러 주세요.');
    });
}
function onClick(event) {
    const el = active && event.target?.closest?.(`#chat .${KEY}`);
    if (el) open(el);
}
function onKey(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const el = active && event.target?.closest?.(`#chat .${KEY}`);
    if (!el) return;
    event.preventDefault();
    open(el);
}

/** features.js syncFeatures 가 설정이 바뀔 때마다 부른다 */
export function syncDialogueOnly(on) {
    // applyAll 은 슬라이더를 끌면 프레임마다 돈다 — 켬 · 끔이 바뀔 때만 훑는다
    if (!!on === active && (!active || document.querySelector(`#message_template .${KEY}`))) return;
    active = !!on;
    const template = document.querySelector('#message_template .mes');
    if (!active) {
        document.querySelectorAll(`#message_template .${KEY}, #chat .${KEY}, style[data-bl-dialogue-icon]`).forEach(el => el.remove());
        return;
    }
    if (!document.querySelector('style[data-bl-dialogue-icon]')) {
        const style = document.createElement('style');
        style.dataset.blDialogueIcon = '1';
        style.textContent = ICON;
        document.head.append(style);
    }
    if (!bound) {
        bound = true;
        document.addEventListener('click', onClick);
        document.addEventListener('keydown', onKey);
    }
    place(template);
    document.querySelectorAll('#chat > .mes').forEach(place);
}
