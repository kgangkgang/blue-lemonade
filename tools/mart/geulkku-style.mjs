// 1.0.2 글꾸 그림체 — 액자 마트처럼 「같은 주제 · 여러 디자인」(11-04 사용자 결정).
//   자료 칸 이름은 `style`(액자 마트 항목의 style 과 같은 이름), 값은 정확히 「심플 · 일러스트 · 다꾸 · 무테」 넷 중 하나예요.
//   11-04 18:3x 이름 바꿈: 오리지널 그림(옛 「기본」)은 「일러스트」, 심플은 그대로 「심플」. 차례(사이트 칩)도 심플 → 일러스트 → 다꾸 → 무테 —
//   심플이 맨 앞(테마에 내장하는 글꾸와 같은 그림체예요).
//   칸이 없는 틀은 「일러스트」예요(시안2~5 · 할로윈 원본). geulkku-sian.json 에는 일러스트가 아닐 때만 적고(파일이 그대로 남게),
//   사이트 산출물(mart/data/geulkku.json)에는 항목마다 적고 머리에 그림체 목록(styles)을 둬요 — 사이트가 「그림체」 칩으로 걸러요.
//   테마(src/mart-import.js checkItem)는 이 칸을 모르고 넘겨요 — 받은 글꾸에는 남지 않아요.
export const GEULKKU_STYLES = Object.freeze(['심플', '일러스트', '다꾸', '무테']);
export const STYLE_DEFAULT = '일러스트';
// 옛 이름(11-04 18:3x 전) — 시안 파일에 남아 있어도 같은 그림체로 읽어요
export const STYLE_ALIAS = Object.freeze({ 기본: '일러스트' });
// 그림체가 일러스트가 아니면 id 에 꼬리를 달아 같은 주제의 다른 그림체와 겹치지 않게 해요(내 글꾸 id 는 영문 소문자 · 숫자 · - 24자까지)
//   꼬리는 이름을 바꾸기 전 그대로예요(받아 둔 글꾸 id 가 바뀌지 않게) — 일러스트는 꼬리 없음
export const STYLE_SLUG = Object.freeze({ 심플: 'sp', 일러스트: '', 다꾸: 'dk', 무테: 'mt' });

/** 틀의 그림체 — 칸이 없으면 fallback(일러스트) · 옛 이름은 새 이름으로 · 모르는 값이면 멈춰요 */
export function styleOf(frame, fallback = STYLE_DEFAULT) {
    const raw = frame?.style ?? fallback;
    const style = STYLE_ALIAS[raw] ?? raw;
    if (!GEULKKU_STYLES.includes(style)) throw new Error(`${frame?.id ?? frame?.label ?? '틀'}: 모르는 그림체 「${raw}」(${GEULKKU_STYLES.join(' · ')} 만 써요)`);
    return style;
}
