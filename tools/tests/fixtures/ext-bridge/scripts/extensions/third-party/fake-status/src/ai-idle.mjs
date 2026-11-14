// 시험용 가짜 확장(tools/tests/ext-bridge-hook.mjs) — 남의 확장의 코드가 아니에요. 기능 함수의 「이름」만 같은 빈 껍데기예요.
//   2.7.7 부터의 꼴: 메인 연결로 보내기 전에 「본편이 다 쓸 때까지 기다리기」 await 를 해서, generateRaw 때 기능 함수는 비동기 프레임으로만 남아요.
//   2.7.3 의 칩 점검 길(pipFix → analyzeMessage)도 같이 둬요.
import { aiGenerateIdle } from './prompts.mjs';

export async function phoneReply(system, prompt) { return await aiGenerateIdle(system, prompt, 400); }
export async function genModule(system, prompt) { return await aiGenerateIdle(system, prompt, 700); }
export async function analyzeMessage(system, prompt) { return await aiGenerateIdle(system, prompt, 600); }
export async function pipFix(system, prompt) { const n = await analyzeMessage(system, prompt); return n; }
