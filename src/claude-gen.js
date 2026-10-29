// Claude 5 세대 이후 모델인지 — live-models.js(번역 · 다시 쓰기 · TTS 의 모델별 요청 규칙)와 main-chat-rules.js(본채팅 규칙)가 같이 쓴다.
// 따로 둔 까닭: 본채팅 규칙은 시작할 때 실리는데, 이 한 줄 때문에 live-models.js(38KB · 맨 위 await 로 실리태번 모듈과 모델 등록 상태를 받는다)를
//   끌고 오면 테마 index.js 가 그 await(모델 등록 파일 한 번 더 받기)가 끝날 때까지 시작하지 못했다.
const versions = (re, m) => [...m.matchAll(re)].map(x => Number(x[1]));
export const isClaude5Plus = (m) => /claude-(fable|opus-5|sonnet-5)/.test(m) || versions(/claude-[a-z]+-(\d+)/g, m).some(n => n >= 5 && n <= 9);
