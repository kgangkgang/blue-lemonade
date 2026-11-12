// 1.1.7 테마에서 뺀 옛 내장 글꾸 48종(심플 30 · 반응 4 · 장면 8 · 연말 6 — 옛 src/log-copy-builtin.gen.js)의 이름표예요(사용자 「내장 빼고 마트만」 11-12).
//   그림은 더 안 실어요. 저장해 둔 모양 id(로그 복사 shape · 즐겨찾기 · 최근)는 지우지 않고, 시트가 열 때 이 표로 읽기만 바꿔요:
//   ① 같은 이름의 새 판을 글꾸 마트에서 이미 「테마로 담기」로 받았으면(내 글꾸 id = simple-<마트 열쇠>) 그 글꾸로 이어 그려요
//   ② 못 받았으면 기본 틀로 그리고, 마트에 새 판이 있으면 받는 곳(마트 #id)을 한 번 알려 줘요 · 새 판이 없으면 조용히 기본 틀로
//   [옛 id, 이름, 마트 새 판 열쇠(simple-<열쇠> · 없거나 테마가 못 받는 틀이면 null), 1.0.1 시험판의 더 옛 id]
//   마트 새 판은 테마가 실제로 받는 틀만(tools/tests/fixtures/mart-takeable.json · node tools/mart/takeable-fixture.mjs 로 떠요 — log-copy-retired.mjs 가 대조해요)
const ROWS = [
    ['concept-sp-birthday', '생일', 'k1018', 'concept-birthday'],
    ['concept-sp-xmas', '크리스마스', 'k1091', 'concept-xmas'],
    ['concept-sp-pepero', '빼빼로데이', 'k1317', 'concept-pepero'],
    ['concept-sp-seol', '설날', 'k1329', 'concept-seol'],
    ['concept-sp-chuseok', '추석', null, 'concept-chuseok'],
    ['concept-sp-valentine', '발렌타인', null, 'concept-valentine'],
    ['concept-sp-white', '화이트데이', null, 'concept-white'],
    ['concept-sp-cafe', '카페 영수증', 'q09', 'concept-cafe'],
    ['concept-sp-sticky', '포스트잇', 'k1241', 'concept-sticky'],
    ['concept-sp-letter', '편지 봉투', 'q06', 'concept-letter'],
    ['concept-sp-parcel', '택배 상자', 'k1014', 'concept-parcel'],
    ['concept-sp-tape', '카세트 테이프', 'k1330', 'concept-tape'],
    ['concept-sp-diary', '일기장', 'k1036', 'concept-diary'],
    ['concept-sp-library', '대출 카드', 'k1200', 'concept-library'],
    ['concept-sp-menu', '메뉴판', null, 'concept-menu'],
    ['concept-sp-radio', '라디오', null, 'concept-radio'],   // 마트 k1107 은 테마가 못 받는 틀(소리 자리)이라 안내하지 않아요(검토 11-12)
    ['concept-sp-rx', '처방전', 'k1207', 'concept-rx'],
    ['concept-sp-passport', '여권', 'k1205', 'concept-passport'],
    ['concept-sp-space', '우주 통신', 'k1071', 'concept-space'],
    ['concept-sp-retro', '레트로 게임', 'k1220', 'concept-retro'],
    ['concept-sp-case', '수사 파일', 'k1201', 'concept-case'],
    ['concept-sp-news', '신문 기사', 'k1128', 'concept-news'],
    ['concept-sp-subway', '지하철 노선', 'k1048', 'concept-subway'],
    ['concept-sp-cinema', '영화 자막', null, 'concept-cinema'],   // 마트 k1174 는 테마가 못 받는 틀(줄마다 꾸밈이 달라요)
    ['concept-sp-lab', '실험 노트', null, 'concept-lab'],
    ['concept-sp-score', '악보', 'k1242', 'concept-score'],
    ['concept-sp-map', '보물 지도', 'k1115', 'concept-map'],
    ['concept-sp-weather', '날씨 예보', 'k1246', 'concept-weather'],
    ['concept-sp-spring', '봄 벚꽃', null, 'concept-spring'],   // 마트 k1087 은 테마가 못 받는 틀(줄마다 꾸밈이 달라요)
    ['concept-sp-winter', '겨울 눈', 'k1006', 'concept-winter'],
    ['c-react-sp-1', '봉투 열기', 'k1034'],
    ['c-react-sp-2', '초대장', 'k1132'],
    ['c-react-sp-3', '쪽 넘기기', 'k1100'],
    ['c-react-sp-4', '통통 카드', 'k1301'],
    ['c-scene-sp-1', '사랑 재판', null],
    ['c-scene-sp-2', '속보 방송', 'k1218'],
    ['c-scene-sp-3', '탑승권', 'k1186'],
    ['c-scene-sp-4', '레시피 카드', 'k1043'],
    ['c-scene-sp-5', '타로 리딩', 'k1051'],
    ['c-scene-sp-6', '터미널', 'k1104'],
    ['c-scene-sp-7', '학적부', 'k1204'],
    ['c-scene-sp-8', '전보', 'k1275'],
    ['c-xmas-sp-1', '스노우볼', null],
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
