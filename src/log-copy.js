// 로그 복사 — 채팅에서 글을 드래그해 고르면(여러 메시지에 걸쳐도) 뜨는 고른 글 도구 줄에 「로그 복사」 단추를 올린다.
// 누르는 순간 고른 부분을 화면에 보이는 그대로 떠 두고(log-copy-capture.js), 시트(log-copy-sheet.js)를 연다 — 시트는 처음 누를 때 받는다.
// 실리태번 기본 복사(Ctrl+C)는 바꾸지 않는다. 채팅 밖 · 입력칸 선택에는 줄이 뜨지 않는다(src/selection-bar.js).
// 시작 그래프 밖: index.js 3층(유휴)에서 받는다.
import { registerSelectionTool } from './selection-bar.js';
import { captureLog } from './log-copy-capture.js';
import * as decor from './message-decor.js';   // 이름 묶음으로 받아요 — 아래 함수들이 없는 판이어도 실리는 데 문제가 없게

let sheet = null;
const loadSheet = () => (sheet ||= import('./log-copy-sheet.js').catch((error) => { sheet = null; throw error; }));

/**
 * 1.1.3 읽기 전에 꾸미기 — 긴 채팅에서 화면 밖 메시지의 꾸미기(조판 · 글자색 · 대사 표시)를 미뤄 두는 판(message-decor.js 가 splitSkipped 를 내는 판)에서는
 *   아직 덜 꾸민 메시지가 고른 범위에 걸릴 수 있어요. 고른 메시지를 먼저 다 꾸민 다음에 보이는 모양을 떠요.
 *   미루지 않는 판은 메시지가 이미 다 꾸며져 있어 부르지 않아요(누를 때마다 다시 꾸미지 않게). 꾸미기가 실패해도 읽기는 그대로 해요.
 * @param {{ range: Range, roots: Element[] }} target 고른 글
 */
export function captureDecorated(target, { decor: api = decor, capture = captureLog } = {}) {
    if (typeof api?.decorateMessages === 'function' && typeof api?.splitSkipped === 'function') {
        try {
            const list = [...new Set((target?.roots ?? []).map(root => root?.closest?.('.mes')).filter(Boolean))];
            if (list.length) api.decorateMessages(list, 'chat');
        } catch (error) { console.warn('[Blue Lemonade] 로그 복사: 읽기 전 꾸미기 오류', error); }
    }
    return capture(target);
}

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
        capture: target => captureDecorated(target),
        run: async ({ captured }) => (await loadSheet()).openLogSheet(captured),
    });
}
