// 목소리 선택에 필요한 엔진 정보만 둬요. 합성·설정 화면 구현을 받지 않고도 동기 조회를 유지해요.
// tts-provider-info 검사가 실제 엔진의 같은 필드·기본 목소리 목록과 대조해요.
const openai = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
const gemini = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'];
const info = Object.fromEntries(['minimax', 'openai', 'openai_compat', 'openrouter', 'elevenlabs', 'gemini', 'azure', 'typecast', 'cartesia', 'browser', 'gtranslate'].map(id => [id, {
    needsKey: !['openai_compat', 'browser', 'gtranslate'].includes(id),
    accountNames: id === 'elevenlabs',
    caps: { account: ['minimax', 'elevenlabs', 'typecast', 'cartesia'].includes(id) },
}]));
for (const [id, list] of [['openai', openai], ['gemini', gemini], ['openrouter', [...openai, ...gemini]]]) {
    const ids = new Set(list); info[id].stockIds = () => ids;
}
export const providerIds = Object.freeze(Object.keys(info));
export function getProviderInfo(id) { return Object.prototype.hasOwnProperty.call(info, id) ? info[id] : null; }
