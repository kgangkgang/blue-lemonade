// 1.7.7 미트볼 원작이 넣은 기능 알아보기 — 블루레몬이 얹어 주던 기능을 미트볼 상태창 2.9.0 이 스스로 갖게 됐어요.
//   11-18 사용자 「미트볼 업데이트 된 거 보니까 블루레몬에서 추가한 기능 좀 가져간 거 같거든 … 그런 부분은 블루레몬에서 없애줘. 대신에 그 기능들에 버그 있거나 이러면 블루레몬에서 좀 보완해주고」
//   그 확장이 가진 기능은 그 확장에 맡기고(두 겹으로 돌지 않게), 테마는 그 기능에서 손을 떼요. 옛 판(2.8.0 까지)에서는 테마 것이 그대로 돌아요.
//   · 알아보는 법: 그 확장의 설정 칸(extensionSettings.statussim)에 그 기능의 설정 키가 있나를 봐요 — 그 확장은 켜질 때 기본값을 전부 채워 두니, 키가 있으면 그 판이 그 기능을 가진 거예요.
//     그 확장이 꺼져 있거나 없으면 「없음」이에요. 설정 키는 판을 내려도(2.9.0 → 2.8.0) 저장 파일에 남으니, 그 확장 설정 칸 머리에 찍힌 판 번호(테마가 「확인한 판」을 볼 때 읽는 자리)가
//     보이면 그 판이 그 기능이 생긴 판(since)보다 옛 판일 때는 「없음」으로 봐요. 판 번호를 못 읽으면 키만 봐요.
//   · 옮기기(한 번): 사용자가 테마 스위치로 정해 둔 값이 그 확장의 처음 값과 다르면 그 확장 설정에 한 번 옮겨요 — 손수 끈 기능이 판 올림으로 다시 켜지거나, 켜 둔 기능이 꺼지지 않게.
//     알림은 없어요. 옮겼는지는 테마 설정 chat.mbMoved(열쇠 목록)에 적어, 그 뒤 사용자가 그 확장 설정을 바꾸면 그 값을 그대로 따라요(다시 덮지 않아요).
//     쓰는 곳은 그 확장이 화면 체크 칸으로 바꾸는 것과 같은 설정 값 하나씩뿐이에요(그 확장 파일 · 채팅 자료는 안 건드려요).
//   시험: tools/tests/mb-upstream.mjs
import { setHanded, syncOffAttr, offAttrValue } from './mb-switch-core.js';
import { ctx } from './mb-util.js';   // 1.9.2 공용 맥락 읽기
const META = 'statussim';

/**
 * 원작에 맡긴 기능 표. 열쇠 = 테마 스위치 열쇠(src/mb-switch.js) · key = 그 확장 설정 키 · on = 그 값이 「켜짐」인가
 *   tab · label = 그 확장 설정 칸에서 켜고 끄는 자리(레몬 탭 안내 줄) · part = 일부만 맡겼어요(테마가 모자란 곳을 아직 메워요 — note 글)
 */
export const UP = {
    back: { key: 'backClose', on: v => v !== false, since: '2.9.0', tab: '다른 확장과 같이 쓰기', label: '폰 뒤로 가기로 미트볼 창 닫기' },
    ask: { key: 'askDelete', on: v => v !== false, since: '2.9.0', tab: '다른 확장과 같이 쓰기', label: '되돌릴 수 없는 지우기는 한 번 물어보기' },
    note: { key: 'genNote', on: v => v === true, since: '2.9.0', tab: '확장 AI', label: '생성 때 이 채팅의 작가 노트도 읽기' },
    read: { key: 'genRead', on: () => true, since: '2.9.0', tab: '확장 AI', label: '생성 때 채팅 읽는 방식', part: '만들기 화면에는 미트볼에 없는 「기억 요약」 고르기만 남겨요' },
    // 2.9.1(원작 766314d · 0112545 「블루레몬 개조를 원작에」 · d61af0b1): 사용자가 작가에게 넘긴 블루레몬 개조를 원작이 가져갔어요 — 같은 일은 원작에 맡겨요
    //   css: 맞춤 시트 묶음(@mb 열쇠)을 원작에 맡긴 동안 끔 표식(data-bl-mb-off)에 같이 적어요 — 시트 · 모듈이 「끈 스위치」와 똑같이 손을 떼요(offAttrValue)
    //   always: 원작에 설정이 없고 늘 켜져 있어요(판을 알아보는 표지로 2.9.1 부터 늘 채워지는 키 popX 를 봐요)
    album: { key: 'albumBtn', on: v => v !== false, since: '2.9.1', tab: '데이터 · 화면', label: '답마다 「추억 앨범에 담기」 단추', css: true },
    autoen: { key: 'trConvertAsk', on: v => v === false, since: '2.9.1', tab: '상태창 언어 · 번역', label: '「한국어 칸을 영어 저장으로」 바꾸기 전에 묻기(끄면 바로 바꿔요)' },
    helpers: { key: 'popX', on: () => true, since: '2.9.1', always: true, label: '설정 찾기(서랍 맨 위) · 맨 위로 단추', css: true },
    grid: { key: 'popX', on: () => true, since: '2.9.1', always: true, label: '이름표 → 값 두 열(짝 칸)', css: true },
    trend: { key: 'popX', on: () => true, since: '2.9.1', always: true, label: '변화 그래프 사람 색 · 가까운 색 점선 · 범례 강조', css: true },   // 테마가 다시 그리던 판은 원작 새 그래프(선을 g 안에 · hsl 색)를 못 읽어 선이 빠졌어요 — 원작 그래프에 맡겨요
    blur: { key: 'blurFx', on: v => v !== false, since: '2.9.1', tab: '데이터 · 화면', label: '옆 서랍 · 알림 뒤 흐림 효과', part: '창 안 굴림 가장자리 흐림 끄기 · 면 색은 블루레몬이 계속해요' },
};
/** 원작에 맡겨 맞춤 시트 묶음을 끄는 열쇠(지금 그 확장이 그 기능을 가진 것만) — offAttrValue(src/mb-switch.js)가 끔 표식에 더해요 */
export function upCssKeys(c = ctx(), doc = globalThis.document) {
    return Object.keys(UP).filter(name => UP[name].css && !UP[name].part && upHas(name, c, doc));
}
setHanded(() => upCssKeys());   // 끔 표식(offAttrValue)이 이 모듈이 받힌 뒤부터 맡긴 묶음을 같이 적어요
export const UP_KEYS = Object.keys(UP);
/**
 * 같은 뜻의 설정이 그 확장에도 생겼지만 테마 것을 그대로 두는 것 — 레몬 탭에 한 줄로 알려요(옮기지도 걷지도 않아요).
 *   눈 감긴 답: 그 확장의 「숨긴 답 빼기」(hideSkip)는 기본 끔이고, 테마의 「접기」로 감긴 답 · 통째 저장 뒤의 몫(「눈 감기 · 삭제 바로 반영」)을 못 봐요.
 *   둘 다 켜도 두 번 빼지 않아요(그 확장은 테마 표식이 있는 답에는 제 표식을 안 적어요).
 */
export const UP_ALSO = {
    hidden: { key: 'hideSkip', since: '2.9.0', note: '미트볼 2.9.0 에도 같은 뜻의 설정이 생겼어요(다른 확장과 같이 쓰기 › 「눈 단추로 직접 숨긴 AI 답은 상태 계산에서 빼기」 · 기본 끔) — 테마 것은 접은 답과 통째 저장 뒤의 몫까지 빼서 그대로 둬요 · 둘 다 켜도 두 번 빼지 않아요 · 미트볼 「데이터 보호」를 켜면 테마 표식이 안 먹으니 그때는 미트볼 것을 켜요' },
};
/** 그 확장에도 같은 뜻의 설정이 있나(안내 줄을 보일 때) */
export function upAlso(name, c = ctx(), doc = globalThis.document) {
    const u = UP_ALSO[name], s = upSettings(c);
    if (!u || !s || s.enabled === false || !Object.hasOwn(s, u.key)) return '';
    const ver = upVersion(doc);
    return ver && older(ver, u.since) ? '' : u.note;
}

/** 그 확장의 설정 칸(없으면 null) */
export function upSettings(c = ctx()) {
    const s = c?.extensionSettings?.[META];
    return s && typeof s === 'object' ? s : null;
}
/** 그 확장 설정 칸 머리에 찍힌 판 번호(「v2.9.0」 → '2.9.0') — 못 읽으면 '' */
export function upVersion(doc = globalThis.document) {
    try { return (String(doc?.querySelector?.('#ss-settings .inline-drawer-header small')?.textContent || '').match(/\d+(?:\.\d+){1,3}/) || [''])[0]; } catch { return ''; }
}
/** 판 번호 견주기: a 가 b 보다 옛 판인가 */
export function older(a, b) {
    const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0; }
    return false;
}
/** 그 확장이 이 기능을 스스로 갖고 있나(= 테마는 손을 떼요) */
export function upHas(name, c = ctx(), doc = globalThis.document) {
    const u = UP[name], s = upSettings(c);
    if (!u || !s || s.enabled === false || !Object.hasOwn(s, u.key)) return false;
    const ver = upVersion(doc);
    return !(ver && older(ver, u.since));   // 판을 내린 뒤 남은 키는 안 믿어요
}
/** 그 확장에서 이 기능이 켜져 있나(없으면 false) */
export function upOn(name, c = ctx(), doc = globalThis.document) {
    return upHas(name, c, doc) && !!UP[name].on(upSettings(c)[UP[name].key]);
}
/** 레몬 탭 안내 줄: 그 확장 설정 어디서 켜고 끄는지 */
export function upWhere(name) {
    const u = UP[name];
    if (u?.always) return `미트볼 ${u.since} 부터 미트볼이 스스로 해요 — 「${u.label}」은 미트볼에 늘 켜져 있어요${u.part ? ` · ${u.part}` : ''}`;
    return u ? `미트볼 ${u.since} 부터 미트볼이 스스로 해요 — 미트볼 설정 칸 › ${u.tab} › 「${u.label}」에서 켜고 꺼요${u.part ? ` · ${u.part}` : ''}` : '';
}

/**
 * 옮길 것 셈(그 자리에서 아무것도 안 바꿔요). chat = 테마 설정의 chat 칸 · up = 그 확장 설정
 *   → { set: [[그 확장 키, 값, 열쇠]], done: [이번에 판단을 끝낸 열쇠] }
 *   · 뒤로 가기 · 지우기 묻기: 테마에서 손수 껐으면 그 확장 것도 꺼요(처음 값이 켬이라 판 올림으로 다시 켜지지 않게)
 *   · 눈 감긴 답은 테마 것이 그대로 돌아서 옮기지 않아요(UP_ALSO)
 *   · 작가 노트 · 채팅 읽기: 테마에 옮길 값이 없어요(단추 · 이번 한 번만 고르기였어요)
 */
export function planMoves(chat, up, ver = '') {
    const out = { set: [], done: [] };
    if (!chat || typeof chat !== 'object' || !up || typeof up !== 'object' || up.enabled === false) return out;
    const moved = new Set(Array.isArray(chat.mbMoved) ? chat.mbMoved : []);
    const off = new Set(Array.isArray(chat.mbOff) ? chat.mbOff : []);
    const want = {
        back: () => (chat.mbBack === false && up.backClose !== false ? false : undefined),
        ask: () => (off.has('ask') && up.askDelete !== false ? false : undefined),
        note: () => undefined,
        read: () => undefined,
        // 2.9.1: 테마에서 쓰던 꼴을 그대로 이어요 — 앨범 단추는 테마가 숨겨 왔고(보이기로 둔 때만 보임) · 흐림은 테마가 꺼 왔고 · 영어 저장 전환은 테마가 묻지 않고 바로 했어요
        album: () => (chat.mbAlbumBtn !== true && up.albumBtn !== false ? false : undefined),
        autoen: () => (chat.mbAutoEn !== false && up.trConvertAsk !== false ? false : undefined),
        blur: () => (!off.has('blur') && up.blurFx !== false ? false : undefined),
        helpers: () => undefined,
        grid: () => undefined,
        trend: () => undefined,
    };
    for (const name of UP_KEYS) {
        if (moved.has(name) || !Object.hasOwn(up, UP[name].key) || (ver && older(ver, UP[name].since))) continue;
        const v = want[name]();
        if (v !== undefined) out.set.push([UP[name].key, v, name]);
        out.done.push(name);
    }
    return out;
}

let moving = null;
/**
 * 한 번 옮기기 — 여러 곳에서 불러도 한 번만 돌아요(같은 약속을 돌려줘요). 옮긴 열쇠 목록을 돌려줘요.
 *   settings: 테마 설정을 읽고 쓰는 길(시험이 갈아 끼워요) — { get(): 설정, save(설정을 고치는 함수) }
 */
export function moveOnce({ c = ctx(), settings = null } = {}) {
    return (moving ||= (async () => {
        const up = upSettings(c);
        if (!up) { moving = null; return []; }   // 그 확장 설정을 아직 못 읽었어요 — 다음에 다시
        const st = settings || await themeSettings();
        const plan = planMoves(st.get()?.chat, up, upVersion());
        try { syncOffAttr(offAttrValue(st.get())); } catch { /* 다음 설정 적용 때 같이 */ }   // 2.9.1 원작에 맡긴 시트 묶음(upCssKeys) — 그 확장 설정을 읽은 뒤에야 알 수 있어요
        if (!plan.done.length) return [];
        for (const [key, value] of plan.set) up[key] = value;
        if (plan.set.length) { try { c.saveSettingsDebounced?.(); } catch { /* 다음 저장 때 같이 가요 */ } }
        try { await st.save(s => { s.chat.mbMoved = [...new Set([...(Array.isArray(s.chat.mbMoved) ? s.chat.mbMoved : []), ...plan.done])]; }); } catch { /* 다음 시작에 다시 셈해요(같은 값이라 또 옮겨도 같아요) */ }
        return plan.set.map(row => row[2]);
    })().catch(() => { moving = null; return []; }));
}
async function themeSettings() {
    const m = await import('./settings.js');
    return { get: () => m.getSettings(), save: async fn => { const s = m.getSettings(); fn(s); m.saveSettings?.(); } };
}
/** 시험용: 한 번 표시 지우기 */
export function resetMoveForTest() { moving = null; }
