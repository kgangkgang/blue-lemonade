// 시험용 가짜 확장 — 블루레몬에이드 내장 번역의 단독판 흉내(같은 설정 칸 · 같은 명령을 일부러 같이 써요)
import { extension_settings } from '../../../extensions.js';
const extensionName = 'llm-translator-custom';
extension_settings[extensionName] = extension_settings[extensionName] || {};
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'llmtranslate', callback: () => '' }));
