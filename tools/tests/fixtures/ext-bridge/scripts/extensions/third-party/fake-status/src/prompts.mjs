// 시험용 가짜 확장(tools/tests/ext-bridge-hook.mjs) — 남의 확장의 코드가 아니에요.
//   「third-party/<폴더>/src/…」 자리와 부르는 꼴(문맥 객체의 generateRaw · 연결 프로필 창구)만 같게 직접 쓴 빈 껍데기예요.
//   진짜 호출 스택(동기 프레임 · await 뒤 비동기 프레임)에서 다리가 부른 쪽과 기능을 알아보는지 봐요.
const ctx = () => globalThis.SillyTavern.getContext();

async function aiGenerateOnce(systemPrompt, prompt, max) {
    return String(await ctx().generateRaw({ systemPrompt, prompt, responseLength: max }) ?? '');
}
export async function aiGenerate(systemPrompt, prompt, max) { return await aiGenerateOnce(systemPrompt, prompt, max); }
export async function aiJSON(systemPrompt, prompt, max, { retry = false } = {}) {
    const first = await aiGenerate(systemPrompt, prompt, max);
    if (!retry) return first;
    return await aiGenerate(`${systemPrompt}\n(again)`, prompt, max);   // await 뒤에 한 번 더 — 기능 함수가 비동기 프레임으로만 남는 길
}
export async function viaProfile(id, systemPrompt, prompt, max) {
    return await ctx().ConnectionManagerRequestService.sendRequest(id, [{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }], max);
}
// 2.7.7 부터의 꼴: 문맥 객체를 먼저 받고(그때는 기능 함수가 동기 프레임에 있어요) 「본편이 다 쓸 때까지 기다리기」 await 뒤에 generateRaw 를 불러요
let busyTurns = 0;
export const setBusy = n => { busyTurns = n; };
async function waitMainIdle() { while (busyTurns > 0) { busyTurns -= 1; await new Promise(resolve => setTimeout(resolve, 5)); } }
async function aiGenerateOnceIdle(systemPrompt, prompt, max) {
    const c = ctx();
    await waitMainIdle();
    return String(await c.generateRaw({ systemPrompt, prompt, responseLength: max }) ?? '');
}
export async function aiGenerateIdle(systemPrompt, prompt, max) { return await aiGenerateOnceIdle(systemPrompt, prompt, max); }
