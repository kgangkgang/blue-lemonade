// 시험용 가짜 확장(tools/tests/ext-bridge-hook.mjs) — 남의 확장의 코드가 아니에요. 기능 함수의 「이름」만 같은 빈 껍데기예요(스택에 그 이름이 남는지 보려고).
import { aiGenerate, aiJSON, viaProfile } from './prompts.mjs';

export async function genModule(system, prompt) { return await aiJSON(system, prompt, 700); }
export async function genGroup(system, prompt) { return await aiJSON(system, prompt, 700, { retry: true }); }
export async function analyzeMessage(system, prompt) { return await aiGenerate(system, prompt, 600); }
export async function trJSON(system, prompt) { return await aiGenerate(system, prompt, 4000); }
export async function phoneReply(system, prompt) { const reply = await aiGenerate(system, prompt, 400); return `${reply}|${await trJSON(system, prompt)}`; }
export async function someNewFeature(system, prompt) { return await aiGenerate(system, prompt, 300); }
export async function genModuleByProfile(system, prompt) { return await viaProfile('profile-1', system, prompt, 700); }
