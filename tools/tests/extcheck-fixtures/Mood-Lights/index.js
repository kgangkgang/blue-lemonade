// 시험용 가짜 확장 — 링크로 설치 전 검사용
import { lights } from './lights.js';
SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'roll', callback: () => lights() }));
window.MoodLights = { on: true };
