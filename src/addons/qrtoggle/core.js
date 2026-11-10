// 퀵 리플라이 줄 접기 — 순수 계산 (DOM · 실리태번 없음, tools/tests/qr-toggle.mjs 가 검사해요).
// Based on Simple QR Bar Toggle — Copyright (c) 2025 IceFog72, MIT (src/addons/qrtoggle/LICENSE · NOTICE.md).
export const VERSION = '1.0.0';
export const STATE_KEY = 'blue_lemonade_qrfold';
/** 따로 깔아 쓰던 호환판 확장이 적어 둔 상태 — 처음 켤 때 한 번 이어받아요 */
export const LEGACY_KEY = 'simple_qr_bar_toggle_bl';
/** 원작 · 호환판 확장이 넣는 단추 id — 보이면 내장 쪽이 물러나요(단추가 둘 생기지 않게) */
export const OTHER_BUTTONS = Object.freeze(['qr_toggle_button', 'sqrbt_bl_toggle']);

/** 저장값 다듬기: { open } — 처음이면 호환판의 isOpen 을 이어받고, 그것도 없으면 펼친 채로(켜자마자 줄이 사라지지 않게) */
export function tidyState(raw, legacy) {
    if (raw && typeof raw === 'object' && typeof raw.open === 'boolean') return { open: raw.open };
    if (legacy && typeof legacy === 'object' && typeof legacy.isOpen === 'boolean') return { open: legacy.isOpen };
    return { open: true };
}

/** 단추에 적을 것 — 펼친 상태면 「접기」(아래 화살표), 접힌 상태면 「펼치기」(위 화살표) */
export function buttonView(open) {
    return open
        ? { label: '퀵 리플라이 접기', icon: 'fa-chevron-down', off: 'fa-chevron-up', expanded: 'true' }
        : { label: '퀵 리플라이 펼치기', icon: 'fa-chevron-up', off: 'fa-chevron-down', expanded: 'false' };
}

/** Enter · Space 로도 눌러요 */
export const isPressKey = key => key === 'Enter' || key === ' ';
