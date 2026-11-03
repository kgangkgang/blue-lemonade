// 로그 복사 — 채팅에서 글을 드래그해 고르면(여러 메시지에 걸쳐도) 뜨는 고른 글 도구 줄에 「로그 복사」 단추를 올린다.
// 누르는 순간 고른 부분을 화면에 보이는 그대로 떠 두고(log-copy-capture.js), 시트(log-copy-sheet.js)를 연다 — 시트는 처음 누를 때 받는다.
// 실리태번 기본 복사(Ctrl+C)는 바꾸지 않는다. 채팅 밖 · 입력칸 선택에는 줄이 뜨지 않는다(src/selection-bar.js).
// 시작 그래프 밖: index.js 3층(유휴)에서 받는다.
import { registerSelectionTool } from './selection-bar.js';
import { captureLog } from './log-copy-capture.js';

let sheet = null;
const loadSheet = () => (sheet ||= import('./log-copy-sheet.js').catch((error) => { sheet = null; throw error; }));

/** @param {{ isEnabled: () => boolean }} options */
export function startLogCopy({ isEnabled }) {
    registerSelectionTool({
        id: 'logcopy',
        order: 20,
        label: '로그 복사',
        aria: '고른 채팅을 보이는 그대로 복사',
        icon: () => 'fa-copy',
        enabled: () => { try { return isEnabled(); } catch { return false; } },
        shown: () => { loadSheet().catch(() => {}); },   // 줄이 뜰 때 미리 받아 두면 누르자마자 열린다
        capture: target => captureLog(target),
        run: async ({ captured }) => (await loadSheet()).openLogSheet(captured),
    });
}
