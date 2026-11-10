// 7.9.9 프로필 여러 개 — 설정의 시작 그래프 몫 (1.1.1 가볍게: settings.js 가 쓰는 정리 규칙만, 고르기 · 세션은 pick.js)
//   pick.js 가 여기 이름을 그대로 다시 내보내요. 순수 모듈 (시험: tools/tests/multi-avatar-pick.mjs)
export const WHEN = ['message', 'chat', 'list', 'daily', 'off'];
export const WHEN_LABEL = { message: '답변마다', chat: '채팅방 열 때마다', list: '캐릭터 목록 열 때마다', daily: '하루에 한 번', off: '끔' };
export const MAX_FILES = 24;
export const CARD = 'card';   // 「원본 카드 그림」을 가리키는 값 (pinned · 고른 결과)
const FILE_PATH = /^user\/images\/bl-avatar-[0-9a-f]{16}\/[A-Za-z0-9._-]{1,120}$/;
export const isFilePath = p => typeof p === 'string' && FILE_PATH.test(p);

/** 설정 정리 (settings.js getSettings 가 부른다) — 깨진 값은 버리고, 24장 상한, 고정값은 목록 안에 있을 때만 */
export function tidyMultiAvatar(value, defaults = { on: true, when: 'chat', includeCard: true, chars: {} }) {
    const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
    const s = isObj(value) ? value : {};
    const out = { on: s.on !== false, when: WHEN.includes(s.when) ? s.when : defaults.when, includeCard: s.includeCard !== false, chars: {} };
    if (isObj(s.chars)) {
        for (const [avatar, rec] of Object.entries(s.chars)) {
            if (typeof avatar !== 'string' || !avatar || avatar.length > 255 || /[/\\]/.test(avatar) || !isObj(rec)) continue;
            const seen = new Set();
            const files = (Array.isArray(rec.files) ? rec.files : []).filter(p => isFilePath(p) && !seen.has(p) && seen.add(p)).slice(0, MAX_FILES);
            const pinned = rec.pinned === CARD ? CARD : files.includes(rec.pinned) ? rec.pinned : '';
            if (!files.length && !pinned) continue;   // 빈 항목은 두지 않는다 (카드만 고정은 남긴다 — 랜덤 끈 캐릭터)
            out.chars[avatar] = { files, pinned };
        }
    }
    return out;
}
