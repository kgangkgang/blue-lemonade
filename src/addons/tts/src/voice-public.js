// 외부 확장의 동기 조회 계약이에요. 재생기 로딩 여부와 관계없이 같은 설정·같은 목소리 선택 규칙을 써요.
import { runtimeEnabled } from './runtime.js';
import { voiceFor, shownVoices } from './voices.js';

const publicVoice = voice => voice ? { uid: voice.uid, name: voice.name, provider: voice.provider, lang: voice.lang || '' } : null;
export function voiceOfName({ name = '', isUser = false } = {}) {
    if (!runtimeEnabled()) return null;
    try { return publicVoice(voiceFor(String(name || '').trim(), { isUser: !!isUser, kind: 'dialogue' })); } catch { return null; }
}
export function voiceListPublic() {
    if (!runtimeEnabled()) return [];
    try { return shownVoices().map(voice => ({ ...publicVoice(voice), group: voice.group || '' })); } catch { return []; }
}
