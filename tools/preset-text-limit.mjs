// 프리셋 · 헬퍼 화면 사전에 남길 원문의 길이 상한 (1.0.0 공개판 · 저작권 감사 §2 「긴 원문 빼기」).
//   남기는 것: 단추 · 메뉴 · 항목 이름 같은 짧은 문구. 빼는 것: 변경 내역 · 도움말 문단 · 공지 · 긴 알림 · 작가 감사 문장.
//   폭: NFKC 로 고르고 공백을 한 칸으로 줄인 뒤, 한자 · 한글 · 전각은 2칸, 그 밖은 1칸 — 자리표(${0} · {0})는 세지 않아요.
//   상한 30 = 한자 15자 · 영문 30자 안팎. 이 값을 넘는 원문은 사전에 들어가지 않아요(tools/build-fruit-family.mjs · tools/tests/preset-text-short.mjs).
export const SHORT_TEXT_WIDTH = 30;
const WIDE = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/u;
export function textWidth(text) {
    const core = String(text ?? '').normalize('NFKC').replace(/\$?\{\d+\}/g, '').replace(/\s+/g, ' ').trim();
    let width = 0;
    for (const ch of core) width += WIDE.test(ch) ? 2 : 1;
    return width;
}
export const isShortText = text => textWidth(text) <= SHORT_TEXT_WIDTH;
// 「@이름」 표기(기여자 · 작가 서명)가 든 문구도 빼요 — 변경 내역 · 감사 문장에서만 나와요(단추 · 항목 이름에는 없어요).
const HANDLE = /@[^\s@]/u;
export const keepPresetText = text => isShortText(text) && !HANDLE.test(String(text ?? ''));
