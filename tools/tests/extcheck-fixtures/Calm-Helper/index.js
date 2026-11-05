// 시험용 가짜 확장 — 차분한 도우미 (겹치는 이름이 있어도 서로 맞춰 둔 꼴만)
import { extension_settings } from '../../../extensions.js';
extension_settings.calm_helper = extension_settings.calm_helper || {};
globalThis[Symbol.for('st.storage-report.pending')] ??= [];
window.SharedHub = window.SharedHub || {};
const nativeFetch = window.fetch.bind(window);
window.fetch = async (...args) => nativeFetch(...args);
const { eventSource, event_types } = SillyTavern.getContext();
eventSource.on(event_types.CHAT_CHANGED, () => {});
eventSource.on(event_types.MESSAGE_SENT, () => {});
eventSource.on(event_types.MESSAGE_EDITED, () => {});
eventSource.on(event_types.MESSAGE_DELETED, () => {});
eventSource.on(event_types.MESSAGE_SWIPED, () => {});
eventSource.on(event_types.APP_READY, () => {});
SillyTavern.getContext().setExtensionPrompt('calm_helper', '', 1, 0);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { /* 창 닫기 */ } });
// 주석 안의 이름은 세지 않아요: window.DiceShared = 1; extension_settings.shared_box = 2; registerMacro('mood')
/* SlashCommand.fromProps({ name: 'roll' }) */
const help = '<p>도움말 — https://example.invalid/a//b</p>';
