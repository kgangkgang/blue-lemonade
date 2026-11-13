// 1.2.1 노드 도구용 공지 전체 목록 — 최근 구간(src/notice-data.js NOTICES) + 옛 구간 원문(tools/notice-old.src.mjs OLD_NOTICES)을 공지 창과 같은 차례로 이어요.
//   1.2.1 앞에는 src/notice-data.js 의 NOTICES 가 전체였어요. 전체를 비교하던 도구(사이트 release-notes.json 대조 등)는 이 파일의 NOTICES 를 읽어요.
import { NOTICES as RECENT } from '../src/notice-data.js';
import { OLD_NOTICES } from './notice-old.src.mjs';

export { RECENT, OLD_NOTICES };
export const NOTICES = [...RECENT, ...OLD_NOTICES];
