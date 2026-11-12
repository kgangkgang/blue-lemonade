// 1.2.0 「붙이는 길」(점검 1112 「테마 라」) — 로그 복사 창에서 복사한 다음 무엇을 하는지 끝까지 알려요. 시작 그래프 밖(로그 복사 시트 조각에 같이 들어요).
//   ① 바닥 줄 맨 위 안내 한 줄(늘 보여요 · 1.6초 알림 대신): 평소엔 「붙일 곳: 깡통 글쓰기 › 「HTML」 칸」 → 복사하면 「복사했어요 — …」 + 「코드 보기 · 닫기」.
//      복사가 끝나도 창은 열린 채예요(다시 복사 · 「글만」도 바로). 모양을 바꿔 다시 그리면 평소 줄로 돌아와요(복사한 글은 바꾸기 전 모양이라).
//   ② 「코드 보기」 칸: 붙일 코드를 전부 담아 골라 둔 글칸 + 「돌아가기 · 전부 고르기 · 복사」. 클립보드가 막혔을 때 저절로 열리고(아이폰 사파리 등), 폰 바닥 줄의 「코드」로도 열어요.
//      글칸은 읽기 전용 — 폰에서 눌러도 자판이 올라오지 않아요(골라 두기 · 길게 눌러 복사는 돼요).
//   폰(600px 아래)은 「파일로」 자리에 「코드」 — 받은 .html 파일은 보기용이라 깡통 「HTML」 칸에 넣을 코드를 얻는 길이 못 됐어요(PC 는 「내려받기」 그대로).
//   붙일 곳 근거: 인수인계-커뮤니티-글꾸.md — 글 쓰기 · 편집의 「공개 영역과 보호 영역의 HTML」 단추가 여는 칸.
export const WHERE_SHORT = '붙일 곳: 깡통 글쓰기 › 「HTML」 칸';
export const WHERE_HTML = '깡통 글쓰기에서 「HTML」 단추(공개 영역과 보호 영역의 HTML)를 눌러 열린 칸에 붙여 넣어요';
const HOW = '「복사」를 누르거나, 글칸을 길게 눌러 「전부 선택 › 복사」해요';
export const TEXT = {
    idle: WHERE_SHORT,
    html: `복사했어요 — ${WHERE_HTML}`,
    md: '글만 복사했어요 — 꾸밈 없는 글이라 글 쓰기 칸 어디에 붙여도 돼요',
    code: `${WHERE_HTML}. ${HOW}`,
    fail: `클립보드에 넣지 못했어요 — 아래 코드를 다 골라 두었어요. ${HOW}`,
    failMd: `클립보드에 넣지 못했어요 — 아래 글을 다 골라 두었어요. ${HOW}`,
};

/** 바닥 줄 맨 위 안내(바닥 줄 grid 의 한 줄 전체) */
export const GUIDE_HTML = '<div class="bl-lc-done" role="status" aria-live="polite" data-lc-done><i class="fa-solid fa-paste" aria-hidden="true"></i><span data-lc-done-text></span><span class="bl-lc-done-go" data-lc-done-go hidden><button type="button" class="bl-lc-chip" data-lc="code"><i class="fa-solid fa-code" aria-hidden="true"></i><span>코드 보기</span></button><button type="button" class="bl-lc-chip" data-lc="close"><span>닫기</span></button></span></div>';
/** 바닥 줄 「코드」 단추(폰만 · 「파일로」 자리) */
export const CODE_BUTTON = '<button type="button" class="salty-btn bl-lc-code-btn" data-lc="code" title="붙일 HTML 코드를 글칸으로 봐요"><i class="fa-solid fa-code" aria-hidden="true"></i><span>코드</span></button>';
/** 「코드 보기」 칸(미리보기 자리에) */
export const CODE_HTML = '<div class="bl-lc-code" data-lc-code hidden><p class="bl-lc-note" data-lc-code-note></p><textarea rows="10" readonly spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="붙일 코드" data-lc-code-text></textarea><div class="bl-lc-code-row"><button type="button" class="salty-btn" data-lc="code-back">돌아가기</button><button type="button" class="salty-btn" data-lc="code-all">전부 고르기</button><button type="button" class="salty-btn bl-tool-primary" data-lc="code-copy"><i class="fa-solid fa-copy" aria-hidden="true"></i> 복사</button></div></div>';

/** 안내 한 줄 바꾸기 — kind: idle | html | md */
export function guide(dialog, kind = 'idle') {
    const box = dialog.querySelector('[data-lc-done]');
    if (!box) return;
    const done = kind === 'html' || kind === 'md';
    box.classList.toggle('is-done', done);
    box.dataset.state = kind;
    box.querySelector('i').className = `fa-solid fa-${done ? 'check' : 'paste'}`;
    box.querySelector('[data-lc-done-text]').textContent = TEXT[kind] ?? TEXT.idle;
    const go = box.querySelector('[data-lc-done-go]');
    go.hidden = !done;
    go.querySelector('[data-lc="code"]').hidden = kind !== 'html';   // 「글만」은 코드가 아니에요
}

/** 「코드 보기」 칸 열기 · 닫기 — 미리보기 · 바닥 줄 · 붙여 넣기 칸 자리를 빌려요(닫으면 그대로) · why: code | fail · plain: 「글만」(코드가 아닌 글) */
export function showCode(dialog, on, { text = '', why = 'code', plain = false } = {}) {
    const box = dialog.querySelector('[data-lc-code]');
    if (!box) return;
    box.hidden = !on;
    for (const sel of ['[data-lc-stage]', '.bl-lc-foot']) { const el = dialog.querySelector(sel); if (el) el.hidden = on; }
    if (!on) return;
    const paste = dialog.querySelector('[data-lc-paste]'); if (paste) paste.hidden = true;
    box.dataset.kind = plain ? 'md' : 'html';
    box.querySelector('[data-lc-code-note]').textContent = why === 'fail' ? (plain ? TEXT.failMd : TEXT.fail) : TEXT.code;
    const area = box.querySelector('[data-lc-code-text]');
    area.value = text;
    selectAll(area);   // 열 때 다 골라 둬요(읽기 전용이라 폰 자판은 안 올라와요)
    area.scrollTop = 0;
}

/** 글칸 글을 전부 고르기 — 아이폰은 select() 만으로 안 골라져 setSelectionRange 까지 */
export function selectAll(area) {
    area.focus({ preventScroll: true });
    area.select();
    try { area.setSelectionRange(0, area.value.length); } catch { /* 옛 브라우저 */ }
}

/** 「복사」: 누른 순간 고른 글을 복사 사건으로(아이폰도 됨) → 안 되면 Clipboard API · @returns 넣었나 */
export async function copyArea(area) {
    selectAll(area);
    let ok = false;
    try { ok = document.execCommand('copy') === true; } catch { /* 막힘 */ }
    if (!ok && globalThis.isSecureContext && navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(area.value); ok = true; } catch { /* 막힘 */ }
    }
    return ok;
}

export const STYLE = `
.bl-lc-done { grid-column:1 / -1; display:flex; flex-wrap:wrap; align-items:center; gap:4px 8px; min-width:0; margin:-4px 0 0; color:var(--salty-muted); font-size:12px; line-height:1.5; }
.bl-lc-done > i { flex:none; font-size:12px; color:var(--salty-faint, var(--salty-muted)); }
.bl-lc-done > span:not(.bl-lc-done-go) { flex:1 1 200px; min-width:0; overflow-wrap:anywhere; }
.bl-lc-done.is-done { color:var(--salty-text); }
.bl-lc-done.is-done > i { color:var(--salty-accent-ink, var(--salty-accent)); }
.bl-lc-done-go { display:flex; gap:6px; margin-left:auto; }
.bl-lc-done-go[hidden], .bl-lc-done-go [hidden], .bl-lc-code[hidden] { display:none; }
.bl-lc-done-go .bl-lc-chip { min-height:30px; padding:0 10px; font-size:12px; }
.bl-lc-code { display:grid; gap:8px; margin:0 16px; }
.bl-lc-code > .bl-lc-note { margin:0; line-height:1.6; }
.bl-lc-code textarea { box-sizing:border-box; width:100%; min-height:220px; max-height:52dvh; padding:8px; border:1px solid var(--salty-line); border-radius:8px; background:var(--salty-field, var(--salty-raised)); color:var(--salty-text); font:12px/1.5 var(--salty-font-code, ui-monospace, Consolas, monospace); white-space:pre; overflow:auto; scrollbar-width:thin; resize:vertical; }
.bl-lc-code textarea:focus { outline:1px solid var(--salty-accent); }
.bl-lc-code-row { display:grid; grid-template-columns:auto auto minmax(0, 1fr); gap:8px; }
.bl-lc-code-row .salty-btn { min-height:40px; }
.bl-lc-code-row .bl-tool-primary { border-color:var(--salty-accent); background:var(--salty-accent); color:var(--salty-on-accent, #fff); font-weight:650; border-radius:12px; }
.bl-lc .bl-lc-foot .bl-lc-code-btn { display:none; }   /* 공용 창 단추 규칙(.bl-tool-dialog .salty-btn 0,2,0)보다 세게 */
@media (max-width: 600px) {
  .bl-lc-done { margin:-2px 0 2px; }
  .bl-lc-code { order:5; margin:6px 16px 0; }
  .bl-lc-code textarea { font-size:16px; min-height:180px; }
  .bl-lc .bl-lc-foot .salty-btn[data-lc="download"] { display:none; }   /* 폰 바닥 줄 「글만 · 파일로 · HTML 복사」 의 「파일로」(.salty-btn:not(.bl-tool-primary) 0,3,0 보다 세게) */
  .bl-lc .bl-lc-foot .salty-btn.bl-lc-code-btn { display:inline-flex; }
}
@media (max-width: 600px) and (max-height: 480px) { .bl-lc-done:not(.is-done) { display:none; } }   /* 폰 자판이 떠서 창이 낮아진 동안은 평소 안내 줄을 접어요(칸이 보일 자리를 남겨요) */
`;
