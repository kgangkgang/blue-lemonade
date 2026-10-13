// 캐릭터 로어북 연결 점검 (2026-10-13). 지금 채팅 캐릭터의 카드가 가리키는 로어북이 목록에 없거나(이름이 바뀜 · 지워짐),
// 카드에 들어 있는 로어북을 가져오지 않았으면 위쪽 책 아이콘(#WIDrawerIcon)에 빨간 점 하나만 붙인다. 글자 · 팝업 · 알림 없음.
// 고치면(연결 · 가져오기 · 이름 맞추기) 바로 사라진다. 로어북을 쓰지 않는 캐릭터(카드에 아무것도 없음)는 정상이라 점이 없다.
// 점 모양은 css/51-integrations.css — 테마가 꺼져 있으면 보이지 않는다.

const DOT_CLASS = 'bl-wi-unlinked';
const EVENTS = ['APP_READY', 'CHAT_CHANGED', 'CHARACTER_EDITED', 'CHARACTER_RENAMED', 'CHARACTER_DELETED', 'GROUP_UPDATED',
    'WORLDINFO_SETTINGS_UPDATED', 'WORLDINFO_UPDATED', 'SETTINGS_UPDATED',
    // 로어북 이름을 바꾼 뒤 「연결을 고칠까요?」에 예 → 실리태번은 카드만 바꾸고 이벤트 없이 끝난다 (1:1 은 편집 창을 다시 열고, 그룹은 아무것도 없음)
    // → 편집 창이 열릴 때 · 답을 만들기 시작할 때도 다시 본다 (배열 몇 개만 보므로 가볍다)
    'CHARACTER_EDITOR_OPENED', 'GENERATION_STARTED'];

function hasEntries(book) {
    const entries = book?.entries;
    if (Array.isArray(entries)) return entries.length > 0;
    return !!entries && typeof entries === 'object' && Object.keys(entries).length > 0;
}

/** 실리태번 getCharaFilename 과 같은 이름 (아바타 파일 이름에서 확장자만 뺌) — 추가 로어북(charLore)은 이 이름으로 묶인다 */
function fileNameOf(character) {
    return String(character?.avatar ?? '').replace(/\.[^/.]+$/, '');
}

/**
 * 카드 하나의 로어북 연결 상태.
 * '' 정상 · 'missing' 카드가 가리키는 로어북이 목록에 없음 · 'extra' 추가 로어북이 목록에 없음 · 'embedded' 카드에 든 로어북을 가져오지 않음.
 * worldNames 가 아직 없으면(설정을 읽기 전) 모르는 것으로 보고 ''.
 */
export function loreLinkProblem(character, worldNames, charLore = []) {
    if (!character || !Array.isArray(worldNames)) return '';
    const names = new Set(worldNames);
    const world = character.data?.extensions?.world;
    const linked = typeof world === 'string' && world !== '';
    if (linked && !names.has(world)) return 'missing';
    const file = fileNameOf(character);
    const extra = file && Array.isArray(charLore) ? charLore.find(item => item?.name === file)?.extraBooks : null;
    const extraNames = Array.isArray(extra) ? extra.filter(name => typeof name === 'string' && name !== '') : [];
    if (extraNames.some(name => !names.has(name))) return 'extra';
    // 실리태번 자신의 「카드 로어북 가져오기」 안내와 같은 조건(카드에 로어북이 들어 있는데 연결된 로어북이 없음). 항목이 없는 빈 책은 뺀다.
    // 추가 로어북으로 붙여 둔 것도 연결이다 (실리태번은 추가 로어북을 기본 연결과 똑같이 켠다).
    // 목록용 얕은 카드(lazyLoadCharacters)에는 들어 있는 로어북이 실려 오지 않아 알 수 없으므로 점을 붙이지 않는다
    if (!linked && !extraNames.length && !character.shallow && hasEntries(character.data?.character_book)) return 'embedded';
    return '';
}

/** 지금 채팅에서 로어북이 쓰일 캐릭터: 1:1 이면 그 캐릭터, 그룹이면 꺼 두지 않은 멤버 모두 */
export function chatCharacters(ctx) {
    const list = Array.isArray(ctx?.characters) ? ctx.characters : [];
    const groupId = ctx?.groupId;
    if (groupId !== undefined && groupId !== null && groupId !== '') {
        const group = (Array.isArray(ctx.groups) ? ctx.groups : []).find(item => String(item?.id) === String(groupId));
        const off = new Set(Array.isArray(group?.disabled_members) ? group.disabled_members : []);
        const members = Array.isArray(group?.members) ? group.members : [];
        return members.filter(avatar => !off.has(avatar)).map(avatar => list.find(character => character?.avatar === avatar)).filter(Boolean);
    }
    const id = ctx?.characterId;
    const one = id === undefined || id === null || id === '' ? undefined : list[Number(id)];
    return one ? [one] : [];
}

export function loreLinkBroken(ctx, worldNames, charLore) {
    return chatCharacters(ctx).some(character => loreLinkProblem(character, worldNames, charLore) !== '');
}

let started = false;

/**
 * 테마 화면이 켜질 때 한 번 (index.js startThemeRuntime). 채팅 · 카드 · 로어북 설정이 바뀔 때마다 다시 본다 — 배열 몇 개만 보므로 가볍다.
 * 로어북을 만들거나 · 이름을 바꾸거나 · 지울 때는 실리태번이 이벤트 없이 편집 목록(select)만 다시 채우므로 그 목록을 지켜본다.
 * 인자는 시험용 (기본값이 실제 실리태번).
 */
export async function startWorldInfoLinkMark({
    getContext = () => globalThis.SillyTavern?.getContext?.(),
    loadWorldInfo = () => import('../../../../world-info.js'),
    doc = globalThis.document,
    delay = 150,
} = {}) {
    if (started) return;
    started = true;
    let worldInfo = null;
    try { worldInfo = await loadWorldInfo(); } catch (error) { console.warn('[Blue Lemonade] 로어북 연결 점검', error); }
    const ctx0 = getContext();
    if (!ctx0?.eventSource || !ctx0?.event_types) return;
    let timer = 0;
    const refresh = () => {
        timer = 0;
        const icon = doc?.getElementById?.('WIDrawerIcon');
        if (!icon) return;
        let broken = false;
        try {
            const ctx = getContext();
            // 모듈의 목록이 먼저: 설정을 읽기 전엔 undefined 라 점이 없다 (getWorldInfoNames 는 그때 빈 배열을 돌려줘 모든 연결이 끊긴 것처럼 보인다)
            const names = Array.isArray(worldInfo?.world_names) ? worldInfo.world_names : (worldInfo ? null : ctx?.getWorldInfoNames?.());
            broken = loreLinkBroken(ctx, names, worldInfo?.world_info?.charLore);
        } catch (error) {
            console.warn('[Blue Lemonade] 로어북 연결 점검', error);
        }
        icon.classList.toggle(DOT_CLASS, broken);
    };
    const schedule = () => { if (!timer) timer = setTimeout(refresh, delay); };
    for (const name of EVENTS) if (ctx0.event_types[name]) ctx0.eventSource.on(ctx0.event_types[name], schedule);
    doc?.getElementById?.('WIDrawerIcon')?.addEventListener?.('click', schedule);   // 점을 보고 서랍을 열 때도 다시 본다 (고친 뒤 이벤트가 없던 경우)
    const worldList = doc?.getElementById?.('world_editor_select');
    if (worldList && typeof MutationObserver === 'function') new MutationObserver(schedule).observe(worldList, { childList: true });
    schedule();
}
