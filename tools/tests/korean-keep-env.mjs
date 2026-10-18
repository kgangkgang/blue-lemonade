// 시험 도우미 (시험 아님): translate() 를 잘라 돌리는 시험들의 env 에 넣을 것 — 번역기 2.7.9 korean-keep.js 함수 + index.js 의 KOREAN_TARGET.
//   translate() 가 「이미 한국어인 부분은 보내지 않기」를 판정할 때 쓴다 (한국어로 옮기는 프롬프트가 아니면 예전 그대로).
import fs from 'node:fs';

const dir = new URL('../../src/addons/translator/', import.meta.url);
const source = fs.readFileSync(new URL('index.js', dir), 'utf8');
const target = /\nconst KOREAN_TARGET = (\/.+\/i);/.exec(source)?.[1];
if (!target) throw new Error('KOREAN_TARGET not found in index.js');

// Extracted translate/check functions also use the production chat-term policy.
// Keep the real scope/signature logic; empty synthetic metadata follows the
// existing path without replacing the policy with a permissive no-op stub.
const chatTerms = await import(new URL('chat-glossary.js', dir));
const speechProfiles = await import(new URL('style-profile.js', dir));
export const KOREAN_KEEP_ENV = {
    ...await import(new URL('korean-keep.js', dir)), KOREAN_TARGET: new Function(`return ${target};`)(),
    chatGlossarySignature: chatTerms.chatGlossarySignature,
    chatTermCachePolicy: chatTerms.createChatTermCachePolicy(),
    styleProfileBlock: speechProfiles.styleProfileBlock,
    styleProfileSignature: speechProfiles.styleProfileSignature,
};
