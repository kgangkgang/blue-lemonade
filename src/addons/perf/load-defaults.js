// 1.4.x 최적화 3차: 성능 보조 도구 「불러오기」의 값이 없을 때의 기본 — 「로딩 시간」(timer · 폰에서 잠깐 켜 두고 숫자를 보는 진단 도구)만 끔.
//   settings.js DEFAULTS.addonUI.perfLoad 와 같은 값이에요. 저장된 값(켬 · 끔)이 있으면 그 값 그대로 — 이미 켜 둔 사람은 그대로 켜져요.
//   start.js(불러올지) · hub.js(설정 창 스위치 표시)가 같이 써요.
export const LOAD_DEFAULT = { timer: false };
export const loadOn = (load, id) => (typeof load?.[id] === 'boolean' ? load[id] : LOAD_DEFAULT[id] ?? true);
