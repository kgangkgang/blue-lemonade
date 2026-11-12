// 1.1.7 테마에서 뺀 옛 내장 글꾸 48종(심플 30 · 반응 4 · 장면 8 · 연말 6 — 옛 src/log-copy-builtin.gen.js)의 이름표예요(사용자 「내장 빼고 마트만」 11-12).
//   그림은 더 안 실어요. 저장해 둔 모양 id(로그 복사 shape · 즐겨찾기 · 최근)는 지우지 않고, 시트가 열 때 이 표로 읽기만 바꿔요:
//   ① 같은 이름의 새 판을 글꾸 마트에서 이미 「테마로 담기」로 받았으면(내 글꾸 id = simple-<마트 열쇠>) 그 글꾸로 이어 그려요
//   ② 못 받았으면 기본 틀로 그리고, 시트 안 띠로 알려요(1.1.8 — 전엔 9초 알림): 마트에 새 판이 있으면 받는 곳(마트 #id) · 붙여 넣기 · 없으면 「이제 없어요」. 닫을 때까지 남아요
//   [옛 id, 이름, 마트 새 판 열쇠(simple-<열쇠> · 없거나 테마가 못 받는 틀이면 null), 1.0.1 시험판의 더 옛 id]
//   11-12 저녁: 새 판이 없던 일곱(추석 · 화이트데이 · 발렌타인 · 메뉴판 · 실험 노트 · 사랑 재판 · 스노우볼)의 마트 새 판 k1374 ~ k1380 을 이었어요(마트 분기 site-geulkku-7 · 사용자 확인 뒤 공개)
//   마트 새 판은 테마가 실제로 받는 틀만(tools/tests/fixtures/mart-takeable.json · node tools/mart/takeable-fixture.mjs 로 떠요 — log-copy-retired.mjs 가 대조해요)
const ROWS = [
    ['concept-sp-birthday', '생일', 'k1018', 'concept-birthday'],
    ['concept-sp-xmas', '크리스마스', 'k1091', 'concept-xmas'],
    ['concept-sp-pepero', '빼빼로데이', 'k1317', 'concept-pepero'],
    ['concept-sp-seol', '설날', 'k1329', 'concept-seol'],
    ['concept-sp-chuseok', '추석', 'k1374', 'concept-chuseok'],
    ['concept-sp-valentine', '발렌타인', 'k1376', 'concept-valentine'],
    ['concept-sp-white', '화이트데이', 'k1375', 'concept-white'],
    ['concept-sp-cafe', '카페 영수증', 'q09', 'concept-cafe'],
    ['concept-sp-sticky', '포스트잇', 'k1241', 'concept-sticky'],
    ['concept-sp-letter', '편지 봉투', 'q06', 'concept-letter'],
    ['concept-sp-parcel', '택배 상자', 'k1014', 'concept-parcel'],
    ['concept-sp-tape', '카세트 테이프', 'k1330', 'concept-tape'],
    ['concept-sp-diary', '일기장', 'k1036', 'concept-diary'],
    ['concept-sp-library', '대출 카드', 'k1200', 'concept-library'],
    ['concept-sp-menu', '메뉴판', 'k1377', 'concept-menu'],
    ['concept-sp-radio', '라디오', 'k1107', 'concept-radio'],   // 1.1.8 소리 칸을 뺀 판으로 받아요(11-12 검토 때는 못 받아 안내를 뺐어요)
    ['concept-sp-rx', '처방전', 'k1207', 'concept-rx'],
    ['concept-sp-passport', '여권', 'k1205', 'concept-passport'],
    ['concept-sp-space', '우주 통신', 'k1071', 'concept-space'],
    ['concept-sp-retro', '레트로 게임', 'k1220', 'concept-retro'],
    ['concept-sp-case', '수사 파일', 'k1201', 'concept-case'],
    ['concept-sp-news', '신문 기사', 'k1128', 'concept-news'],
    ['concept-sp-subway', '지하철 노선', 'k1048', 'concept-subway'],
    ['concept-sp-cinema', '영화 자막', 'k1174', 'concept-cinema'],   // 1.1.8 줄 갈래로 받아요
    ['concept-sp-lab', '실험 노트', 'k1378', 'concept-lab'],
    ['concept-sp-score', '악보', 'k1242', 'concept-score'],
    ['concept-sp-map', '보물 지도', 'k1115', 'concept-map'],
    ['concept-sp-weather', '날씨 예보', 'k1246', 'concept-weather'],
    ['concept-sp-spring', '봄 벚꽃', 'k1087', 'concept-spring'],   // 1.1.8 줄 갈래로 받아요
    ['concept-sp-winter', '겨울 눈', 'k1006', 'concept-winter'],
    ['c-react-sp-1', '봉투 열기', 'k1034'],
    ['c-react-sp-2', '초대장', 'k1132'],
    ['c-react-sp-3', '쪽 넘기기', 'k1100'],
    ['c-react-sp-4', '통통 카드', 'k1301'],
    ['c-scene-sp-1', '사랑 재판', 'k1379'],
    ['c-scene-sp-2', '속보 방송', 'k1218'],
    ['c-scene-sp-3', '탑승권', 'k1186'],
    ['c-scene-sp-4', '레시피 카드', 'k1043'],
    ['c-scene-sp-5', '타로 리딩', 'k1051'],
    ['c-scene-sp-6', '터미널', 'k1104'],
    ['c-scene-sp-7', '학적부', 'k1204'],
    ['c-scene-sp-8', '전보', 'k1275'],
    ['c-xmas-sp-1', '스노우볼', 'k1380'],
    ['c-xmas-sp-2', '성탄 카드', 'k1214'],
    ['c-xmas-sp-3', '오너먼트 대화', 'k1077'],
    ['c-xmas-sp-4', '겨울 기차표', 'k1208'],
    ['c-xmas-sp-5', '연말 정산', 'k1126'],
    ['c-xmas-sp-6', '소원 부적', 'k1322'],
];
const BY_ID = new Map();
for (const [id, name, mart, was] of ROWS) { const row = Object.freeze({ id, name, mart: mart ? `simple-${mart}` : null }); BY_ID.set(id, row); if (was) BY_ID.set(was, row); }
/** 뺀 내장 글꾸면 { id, name, mart } · 아니면 null */
export const retiredShape = id => BY_ID.get(id) ?? null;
/** 기본 틀 — 뺀 글꾸 자리에 그려요(설정 기본값과 같은 깡통 로그) */
export const RETIRED_FALLBACK = 'kkangtong';
/**
 * 저장된 모양 id 를 읽는 법(저장 값은 안 바꿔요). customs: 내 글꾸 목록
 * @returns {{ shape: string, retired: object|null, tell: string|null }} tell: 마트 새 판 바로가기 id(받으라고 알려 줄 때만)
 */
export function readShape(id, customs = []) {
    const retired = retiredShape(id);
    // 내 글꾸가 같은 id 면 내 글꾸가 먼저예요(1.0.1 마트 「일러스트」 concept-* · 1.1.7 부터 막지 않는 옛 내장 id 로 받은 글꾸)
    if (!retired || customs.some(c => c?.id === id)) return { shape: id, retired: null, tell: null };
    if (retired.mart && customs.some(c => c?.id === retired.mart)) return { shape: retired.mart, retired, tell: null };
    return { shape: RETIRED_FALLBACK, retired, tell: retired.mart };
}
/**
 * 1.1.8 저장된 로그 복사 설정(lc)을 읽어요 — 지금 모양이 옛 id 이거나, 전에 옛 id 로 열었다가 깡통 로그로 복사해 모양이 바뀐 뒤(lc.retiredFrom 에 남긴 옛 id)여도
 *   마트 새 판을 받으면 그 글꾸로 이어 그려요(전엔 복사 한 번에 옛 id 가 사라져 나중에 새 판을 받아도 안 이어졌어요).
 *   직접 다른 틀을 골라 복사했으면(모양이 깡통 로그가 아니면) 다 끝난 일로 봐요.
 * @param {object[]} [extra] 내 글꾸와 같이 볼 { id } 목록(1.1.8 보이는 추천 판)
 * @returns {{ shape: string, retired: object|null, tell: string|null, from: string }} from: 기억할 옛 id(없으면 '')
 */
export function readSaved(lc = {}, extra = []) {
    const customs = [...(Array.isArray(lc.custom) ? lc.custom : []), ...extra];   // extra: 1.1.8 보이는 「블루레몬 추천」 판({ id }) — 내 글꾸처럼 먼저 이어 그려요
    const now = readShape(lc.shape, customs);
    if (now.retired) return { ...now, from: lc.shape };
    const was = lc.retiredFrom && lc.shape === RETIRED_FALLBACK ? readShape(lc.retiredFrom, customs) : null;
    return was?.retired ? { ...was, from: lc.retiredFrom } : { ...now, from: '' };
}
