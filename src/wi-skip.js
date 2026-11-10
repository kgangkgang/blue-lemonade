// 로어북 스캔에서 상태창 글 빼기 (1.1.2, 기본 꺼짐) — 켤 때만 받는 모듈(features.js). 계산은 wi-skip-core.js(순수).
// 차례(실리태번 1.19 Generate): 생성 전 가로채기 → 스캔용 글 만들기 → 로어북 항목 읽기(WORLDINFO_ENTRIES_LOADED) → 키워드 찾기 → 프롬프트 만들기.
//   가로채기에서 코드 칸 · 접는 칸을 뺀 사본으로 바꿔 끼우고, 로어북 항목을 읽었다는 사건에서 원래 메시지로 되돌려요.
//   스캔용 글은 그 전에 이미 만들어졌으니 키워드 찾기에는 뺀 글이, 프롬프트에는 원래 글이 들어가요.
// 안전: 되돌릴 사건(WORLDINFO_ENTRIES_LOADED)이 없는 실리태번에서는 아무것도 바꾸지 않아요. 생성이 끝나거나 멈춰도 되돌려요.
// 한계: 이 테마 뒤에 도는 다른 확장의 가로채기는 그 사이 뺀 글을 봐요. 로어북 읽기가 실패한 요청은 그 한 번 프롬프트에서도 빠질 수 있어요.
import { GENERATE_HOOKS, installGenerateInterceptor } from './private-addons.js';
import { swapForScan } from './wi-skip-core.js';

let on = false, bound = false, pending = [];
const stats = { swaps: 0, restores: 0 };
const ctx = () => SillyTavern.getContext();

function restoreAll() {
    const list = pending; pending = [];
    for (const item of list) stats.restores += item.restore();
}
function hook(chat, _contextSize, _abort, type) {
    restoreAll();   // 앞 요청이 되돌리지 못하고 끝났으면 먼저
    if (!on || type === 'quiet' || !ctx().event_types?.WORLDINFO_ENTRIES_LOADED) return;
    const swap = swapForScan(chat);
    if (!swap.count) return;
    stats.swaps += swap.count;
    pending.push(swap);
}
function bind() {
    if (bound) return;
    bound = true;
    const { eventSource, event_types } = ctx();
    (globalThis[GENERATE_HOOKS] instanceof Set ? globalThis[GENERATE_HOOKS] : installGenerateInterceptor()).add(hook);
    for (const name of ['WORLDINFO_ENTRIES_LOADED', 'WORLDINFO_SCAN_DONE', 'WORLD_INFO_ACTIVATED', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_CHANGED']) {
        if (event_types?.[name]) eventSource.on(event_types[name], restoreAll);
    }
}

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncWiSkip(next) {
    on = next === true;
    if (on) bind(); else restoreAll();
}

/** 시험용 */
export const _forTest = { hook, restoreAll, stats, pending: () => pending.length };
