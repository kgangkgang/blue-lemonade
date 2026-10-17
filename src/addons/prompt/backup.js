// 한글화 패널 원본 백업 (7.0.1): 「⚡ 원본 적용」 직전에 바뀌는 자료의 원본을 사용자 파일 영역(/api/files/upload)에 자료마다 최근 1개 둔다.
//   프리셋 · 월드인포는 전체, 봇카드는 이번에 바뀌는 필드만 (merge-attributes 로 같은 키만 되돌린다).
//   순수 함수만 — 파일 쓰기 · 실리태번 저장은 index.js (시험: tools/tests/prompt-backup.mjs).
export const BACKUP_VERSION = 1;
const PREFIX = 'pt-backup-';
const KINDS = new Set(['preset', 'wi', 'char']);

/** FNV-1a 32 → 8자리 16진 (자료 이름에 쓸 수 없는 글자가 있어도 파일 이름이 안전하게) */
function hash(text) {
    let h = 0x811c9dc5;
    for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
}
/** 자료마다 파일 하나 (최근 것으로 덮어씀) */
export function backupFileName(kind, name) {
    if (!KINDS.has(kind)) throw new Error(`모르는 자료 종류: ${kind}`);
    return `${PREFIX}${kind}-${hash(String(name ?? ''))}.json`;
}
/** 저장할 기록 */
export function backupRecord(kind, name, label, data, at = Date.now()) {
    return { version: BACKUP_VERSION, kind, name: String(name ?? ''), label: String(label ?? name ?? ''), at, data };
}
/** 읽은 기록이 쓸 만한가 (종류 · 이름이 맞고 자료가 있음) */
export function validBackup(record, kind, name) {
    return !!record && typeof record === 'object' && record.version === BACKUP_VERSION && record.kind === kind
        && record.name === String(name ?? '') && record.data && typeof record.data === 'object';
}

const clone = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));
/**
 * 봇카드: 적용이 보낼 update 와 같은 키로 지금(적용 전) 값을 모은다 — V1(맨 위) · V2(data.*) 둘 다.
 * 첫 인사 목록은 배열째, 캐릭터 노트는 depth_prompt 통째(깊이 · 역할 포함).
 */
export function characterBackup(char, update) {
    const out = { avatar: char?.avatar ?? update?.avatar, data: {} };
    const data = char?.data && typeof char.data === 'object' ? char.data : {};
    for (const key of Object.keys(update || {})) {
        if (key === 'avatar' || key === 'data') continue;
        const before = data[key] ?? char?.[key] ?? '';
        out[key] = clone(before);
        out.data[key] = clone(before);
    }
    for (const key of Object.keys(update?.data || {})) {
        if (key === 'extensions') {
            const dp = data.extensions?.depth_prompt;
            if (update.data.extensions?.depth_prompt && dp) out.data.extensions = { depth_prompt: clone(dp) };
            continue;
        }
        if (!(key in out.data)) out.data[key] = clone(data[key] ?? char?.[key] ?? '');
        if (key === 'alternate_greetings') out.alternate_greetings = clone(out.data[key]);
    }
    if (!Object.keys(out.data).length) delete out.data;
    return out;
}
/** 백업 시각 → 「10월 17일 오후 3:05」 꼴 (알림 · 확인 창) */
export function backupWhen(at) {
    const d = new Date(Number(at) || 0);
    if (!Number.isFinite(d.getTime()) || !at) return '';
    const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${m}`;
}
