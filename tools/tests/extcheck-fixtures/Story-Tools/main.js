// 시험용 가짜 확장 — 이야기 도구
import { extension_settings } from '../../../extensions.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';

const KEY = 'shared_box';
extension_settings[KEY] ??= { mode: 'story' };
window.DiceShared = { story: true };
globalThis[Symbol.for('st.storage-report.pending')] ??= [];
window.SharedHub ??= {};

SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'roll', callback: () => '이야기 주사위', helpString: '이야기 주사위' }));
SillyTavern.getContext().registerMacro('mood', () => '흐림');
SillyTavern.getContext().registerFunctionTool({ name: 'roll_dice', action: async () => 1 });

const original = window.fetch;
window.fetch = (...args) => original(...args);

$(document).on('keydown', event => { if (event.key === 'K' && event.ctrlKey && event.shiftKey) openTools(); });
function openTools() { $('body').append('<div id="quick-panel"></div>'); }

const { eventSource, event_types } = SillyTavern.getContext();
eventSource.makeFirst(event_types.MESSAGE_RECEIVED, () => {});
eventSource.on(event_types.CHAT_CHANGED, () => {});
eventSource.on(event_types.MESSAGE_SENT, () => {});
eventSource.on(event_types.MESSAGE_EDITED, () => {});
eventSource.on(event_types.MESSAGE_DELETED, () => {});
eventSource.on(event_types.MESSAGE_SWIPED, () => {});
eventSource.on(event_types.GENERATION_ENDED, () => {});
eventSource.on(event_types.GENERATE_AFTER_COMBINE_PROMPTS, () => {});
globalThis.storyToolsIntercept = async () => {};
