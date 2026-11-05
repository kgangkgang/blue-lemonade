// 시험용 가짜 확장 — 주사위 상자
import { extension_settings } from '../../../extensions.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { mountPanel } from './ui.js';

const MODULE = 'shared_box';
extension_settings[MODULE] = extension_settings[MODULE] || { sides: 6 };
window.DiceShared = { roll: () => 4 };

SlashCommandParser.addCommandObject(SlashCommand.fromProps({
    name: 'roll',
    aliases: ['dice'],
    callback: () => String(Math.ceil(Math.random() * 6)),
    helpString: '주사위를 굴려요',
}));
SillyTavern.getContext().registerMacro('mood', () => '맑음');
SillyTavern.getContext().registerFunctionTool({
    name: 'roll_dice',
    displayName: '주사위',
    action: async () => 4,
});

// 요청을 통째로 바꿔요(원래 fetch 를 받아 두지 않아요)
window.fetch = async function diceFetch(url, init) { return new Response('{}'); };

document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key === 'k') mountPanel();
});
const { eventSource, event_types } = SillyTavern.getContext();
eventSource.makeFirst(event_types.MESSAGE_RECEIVED, () => {});
eventSource.on(event_types.CHAT_CHANGED, () => {});
mountPanel();
