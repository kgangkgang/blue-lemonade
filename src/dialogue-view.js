// 6.6.9 대사만 보기 화면 — dialogue-only.js 가 ··· 메뉴의 단추를 처음 누를 때 불러온다.
//   목록: dialogue-lines.js (번역문 기준, 생각 블록 · 숨김 주석 제외). 줄을 누르면 창을 닫고 본문의 그 자리로 옮겨 잠깐 칠한다.
//   듣기: 내장 TTS 애드온이 켜져 있을 때만 단추가 있다. 새 재생기를 만들지 않고 TTS 의 대사 누르기 길(clickplay.segmentForHit → player.speakSegments)을
//   그대로 탄다 — 목소리 지정 · 대사 분석 · 미리 만든 소리(같은 캐시 키) · 효과음 · 재생 줄이 대사를 누를 때와 같다. 화자 이름 · 색도 TTS 판정을 쓴다.
//   상주 관찰자 · 타이머 없음: 창이 열린 동안만 「재생이 끝났다」 알림을 받고, 칠한 자리는 2초 뒤 한 번 지운다.
import { dialogueLines, locateLines } from './dialogue-lines.js';
import { showThemeModal } from './modal.js';

const TTS_OWNER = Symbol.for('blue-lemonade.tts.owner');
const HIT = 'bl-dlg-hit';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = () => SillyTavern.getContext();

// 창 모양: 테마 공용 대화상자(.bl-tool-dialog) · 버튼(.salty-btn) 위에 목록 줄만 더한다 (처음 열 때 한 번 넣음)
const STYLE = `:root{--bl-dialogue-fallback-7ab:#7ab;--bl-dialogue-fallback-8882:#8882;--bl-dialogue-fallback-8888:#8888;}

.bl-dlg-view{width:min(520px,calc(100vw - 32px));max-height:calc(100dvh - 32px);padding:0;display:flex;flex-direction:column;overflow:hidden}
.bl-dlg-view:not([open]){display:none}
.bl-dlg-view:focus,.bl-dlg-list:focus:not(:focus-visible){outline:none}
.bl-dlg-head{display:flex;align-items:baseline;gap:10px;padding:12px var(--bl-fh-pad,14px) 10px;border-bottom:1px solid var(--salty-line,var(--bl-dialogue-fallback-8888))}
.bl-dlg-head h3{margin:0;flex:1 1 auto;min-width:0;font-size:1.05em;font-weight:inherit}
.bl-dlg-count{flex:none;font-size:.86em;opacity:.78}
.bl-dlg-list{list-style:none;margin:0;padding:0;overflow:auto;overscroll-behavior:contain;flex:1 1 auto;min-height:0}
.bl-dlg-list>li+li{border-top:1px solid color-mix(in srgb,var(--salty-line,var(--bl-dialogue-fallback-8888)) 55%,transparent)}
.bl-dlg-view button.bl-dlg-row{all:unset;box-sizing:border-box;display:grid;grid-template-columns:10px minmax(0,1fr);column-gap:10px;align-items:start;width:100%;padding:9px var(--bl-fh-pad,14px);color:var(--salty-text,currentColor);cursor:pointer;line-height:1.6;text-align:start;overflow-wrap:anywhere}
.bl-dlg-view button.bl-dlg-row:hover{background:var(--salty-shade,var(--bl-dialogue-fallback-8882))}
.bl-dlg-view button.bl-dlg-row:focus-visible{outline:2px solid var(--salty-accent,var(--bl-dialogue-fallback-7ab));outline-offset:-2px}
.bl-dlg-dot{width:10px;height:10px;margin-top:calc(.8em - 5px);border-radius:50%;background:var(--dot,var(--salty-line,var(--bl-dialogue-fallback-8888)));box-shadow:0 0 0 1px color-mix(in srgb,var(--salty-text,currentColor) 22%,transparent)}
.bl-dlg-name{display:block;font-size:.84em;font-weight:600;opacity:.86}
.bl-dlg-thought .bl-dlg-text{font-style:italic;opacity:.86}
.bl-dlg-tag{font-size:.8em;font-weight:normal;opacity:.75;margin-inline-start:6px}
.bl-dlg-empty{margin:0;padding:16px var(--bl-fh-pad,14px);line-height:1.7}
.bl-dlg-foot{display:flex;gap:8px;justify-content:flex-end;padding:10px var(--bl-fh-pad,14px) 12px;border-top:1px solid var(--salty-line,var(--bl-dialogue-fallback-8888))}
.bl-dlg-foot .salty-btn{min-height:34px;padding:5px 12px}
::highlight(${HIT}){background-color:color-mix(in srgb,var(--salty-accent,var(--bl-dialogue-fallback-7ab)) 45%,transparent);text-decoration:underline 2px var(--salty-accent,var(--bl-dialogue-fallback-7ab));text-underline-offset:3px}
.bl-dlg-flash{outline:2px solid var(--salty-accent,var(--bl-dialogue-fallback-7ab));outline-offset:2px;border-radius:4px}`;
function style() {
    if (document.querySelector('style[data-bl-dialogue-only]')) return;
    const el = document.createElement('style');
    el.dataset.blDialogueOnly = '1';
    el.textContent = STYLE;
    document.head.append(el);
}

/** 내장 TTS 가 켜져 있으면 그 모듈들 (이미 불러온 것이라 새로 받지 않는다), 아니면 null */
async function ttsParts() {
    if (globalThis[TTS_OWNER] !== 'builtin') return null;
    try {
        const runtime = await import('./addons/tts/src/runtime.js');
        if (!runtime.runtimeEnabled()) return null;
        const [player, clickplay, speakers, settings, text] = await Promise.all([
            import('./addons/tts/src/player.js'), import('./addons/tts/src/clickplay.js'), import('./addons/tts/src/speakers.js'),
            import('./addons/tts/src/settings.js'), import('./addons/tts/src/text.js'),
        ]);
        return { player, clickplay, speakers, s: settings.settings(), text };
    } catch (error) {
        console.warn('[Blue Lemonade] 대사만 보기: TTS 연결 실패', error);
        return null;
    }
}

function names(c, tts) {
    const out = new Set([c.name1, c.name2]);
    const group = c.groupId && Array.isArray(c.groups) ? c.groups.find(g => g.id === c.groupId) : null;
    for (const avatar of group?.members || []) { const ch = (c.characters || []).find(x => x.avatar === avatar); if (ch) out.add(ch.name); }
    try { for (const n of tts?.speakers.knownNames() || []) out.add(n); } catch { /* 채팅 메타가 없으면 넘어감 */ }
    return [...out].filter(Boolean);
}

const fold = t => String(t || '').replace(/[\s*_~`.…⋯]/g, '').toLowerCase();
/**
 * 줄마다 화자 이름 · 점 색. TTS 가 켜져 있으면 재생기와 같은 화자 — player.dialogueSpeakers (색 → 배운 이름 · 이름표 · 저장된 대사 분석, 글을 한 번만 나눔).
 * 「보낸 사람」으로 떨어진 줄(색 · 이름표 · 분석으로 못 정함)은 이름을 비운다 — 세계관 카드면 카드 이름이 대사 주인이 아니다.
 */
function rowsOf(mesId, mes, tts) {
    const c = ctx();
    const sub = t => { try { return c.substituteParams ? c.substituteParams(String(t ?? '')) : String(t ?? ''); } catch { return String(t ?? ''); } };
    const s = tts?.s;
    const userName = c.name1 || '', charName = (!mes.is_user && mes.name) || c.name2 || '';
    const opts = {
        sub, userName, charName, knownNames: names(c, tts),
        ...(s ? { skipTags: String(s.skip_tags ?? ''), skipCode: !!s.skip_codeblocks, stripRegex: tts.text.parseRegexLines(s.strip_regex) } : {}),
    };
    let spk = [];
    if (tts) { try { spk = tts.player.dialogueSpeakers(mesId) || []; } catch { spk = []; } }
    let at = 0;
    return dialogueLines(mes, opts).map((line) => {
        let name = line.name, color = line.color;
        if (tts && line.kind === 'dialogue') {
            // 같은 화면 글을 같은 설정으로 나눈 목록이라 차례가 같다 — 글이 어긋나면 몇 줄 앞까지만 찾아 맞춘다
            const f = fold(line.text);
            let j = at;
            while (j < spk.length && j < at + 4 && fold(spk[j].text) !== f) j++;
            const hit = j < spk.length && fold(spk[j].text) === f ? spk[j] : null;
            if (hit) { at = j + 1; color = color || hit.color || null; if (hit.source !== 'sender' && hit.name) name = hit.name; }
        } else if (tts && line.kind === 'thought') {
            try { const who = tts.speakers.resolveSpeaker({ color: line.color, speakerHint: line.name }, { mes, userName, charName }); if (who?.name && who.source !== 'sender') name = who.name; } catch { /* 표 없음 */ }
        }
        if (tts && !color && name) { try { color = tts.speakers.colorOfName(name, { userName }) || null; } catch { /* 표 없음 */ } }
        return { ...line, name, color };
    });
}
/** 듣기용 조각: 대사를 누를 때와 같은 조각 (clickplay.segmentForHit — 같은 캐시 키 · 미리 만든 소리). 듣기를 누를 때 한 번만 만든다.
 *  TTS 설정에서 속마음을 「건너뛰기」로 두었으면 속마음 줄은 목록에만 두고 읽지 않는다 */
function segsOf(mes, rows, tts) {
    const thoughts = (tts.s.routes?.thought || 'skip') !== 'skip';
    return rows.filter(line => thoughts || line.kind !== 'thought').map((line) => {
        try {
            return tts.clickplay.segmentForHit(mes, line.kind === 'thought'
                ? { kind: 'thought', strong: true, match: 'any', text: line.text, raw: line.raw, nameHint: line.name, color: line.color, line: line.line }
                : { kind: 'dialogue', text: line.text, raw: line.raw, quoted: line.text, color: line.color, speakerHint: line.name, line: line.line, sameIndex: line.sameIndex, sameCount: line.sameCount });
        } catch { return null; }
    }).filter(Boolean);
}

function listHtml(rows) {
    let prev = '';
    return rows.map((r, i) => {
        const who = r.name || '';
        const head = who !== prev || r.kind === 'thought';
        prev = r.kind === 'thought' ? '' : who;
        const label = head && (who || r.kind === 'thought')
            ? `<b class="bl-dlg-name">${esc(who)}${r.kind === 'thought' ? `<span class="bl-dlg-tag">속마음</span>` : ''}</b>` : '';
        const dot = /^#[0-9a-f]{3,8}$/i.test(r.color || '') ? ` style="--dot:${r.color}"` : '';
        return `<li class="${r.kind === 'thought' ? 'bl-dlg-thought' : ''}"><button type="button" class="bl-dlg-row" data-i="${i}"><i class="bl-dlg-dot"${dot} aria-hidden="true"></i><span>${label}<span class="bl-dlg-text">${esc(r.text)}</span></span></button></li>`;
    }).join('');
}

// ---------- 본문의 그 자리로
const SKIP_NODE = 'style, script, template, .bl-dlg-skip';
function textNodes(root) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (!n.nodeValue.trim() || n.parentElement?.closest(SKIP_NODE) || !n.parentElement?.getClientRects().length) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n);
    return out;
}
let clearHit = 0;
function jump(mesId, rows, index) {
    const mesEl = document.querySelector(`#chat .mes[mesid="${mesId}"]`);
    const box = mesEl?.querySelector('.mes_text');
    if (!box) return;
    const nodes = textNodes(box);
    const at = locateLines(nodes.map(n => n.nodeValue), rows.slice(0, index + 1))[index];
    const smooth = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (!at) { mesEl.scrollIntoView({ block: 'start', behavior: smooth }); return; }
    const node = nodes[at.piece];
    const range = document.createRange();
    range.setStart(node, at.offset);
    range.setEnd(nodes[at.endPiece], at.endOffset);
    const target = node.parentElement;
    target.scrollIntoView({ block: 'center', behavior: smooth });
    clearTimeout(clearHit);
    if (globalThis.CSS?.highlights && typeof Highlight === 'function') {
        CSS.highlights.set(HIT, new Highlight(range));
        clearHit = setTimeout(() => CSS.highlights.delete(HIT), 2000);
    } else {
        target.classList.add('bl-dlg-flash');
        clearHit = setTimeout(() => target.classList.remove('bl-dlg-flash'), 2000);
    }
}

// ---------- 창
export async function openDialogueView(mesId) {
    const mes = ctx().chat?.[mesId];
    if (!mes || mes.is_system) return null;
    document.querySelector('dialog.bl-dlg-view')?.close();
    style();
    const tts = await ttsParts();
    const rows = rowsOf(mesId, mes, tts);
    let segs = null;
    const translated = typeof mes.extra?.display_text === 'string' && mes.extra.display_text.trim() && mes.extra.display_text !== mes.mes;
    // 듣는 중 표시: 단추를 누른 뒤(분석 · 번역을 기다리는 동안도) ~ 정지 · 재생이 저절로 끝남
    let playing = !!tts && tts.player.isPlaying() && tts.player.currentMesId() === mesId;
    const listenLabel = () => playing ? '<i class="fa-solid fa-stop" aria-hidden="true"></i><span>듣기 멈춤</span>' : '<i class="fa-solid fa-volume-high" aria-hidden="true"></i><span>대사만 듣기</span>';

    const dialog = document.createElement('dialog');
    dialog.className = 'bl-tool-dialog bl-dlg-view';
    dialog.setAttribute('aria-label', '대사만 보기');
    dialog.tabIndex = -1;   // 열 때 창 자체에 초점 (브라우저가 스크롤 목록에 초점을 주면 목록에 포커스 테두리가 생긴다)
    dialog.innerHTML = `<header class="bl-dlg-head"><h3>대사만 보기</h3><span class="bl-dlg-count">${rows.length ? `${translated ? '번역문 · ' : ''}${rows.length}줄` : ''}</span></header>`
        + (rows.length ? `<ol class="bl-dlg-list">${listHtml(rows)}</ol>` : '<p class="bl-dlg-empty">이 메시지에는 모아 볼 대사가 없어요.</p>')
        + `<footer class="bl-dlg-foot">${tts && rows.length ? `<button type="button" class="salty-btn" data-act="listen">${listenLabel()}</button>` : ''}<button type="button" class="salty-btn" data-act="close">닫기</button></footer>`;
    document.body.append(dialog);

    const listen = dialog.querySelector('[data-act="listen"]');
    const offEnded = tts && listen ? tts.player.onEnded((id) => { if (id !== mesId) return; playing = false; if (listen.isConnected) listen.innerHTML = listenLabel(); }) : null;
    dialog.addEventListener('close', () => { offEnded?.(); dialog.remove(); }, { once: true });
    dialog.addEventListener('click', (event) => {
        const row = event.target.closest?.('.bl-dlg-row');
        if (row) { dialog.close(); jump(mesId, rows, Number(row.dataset.i)); return; }
        const act = event.target.closest?.('[data-act]')?.dataset.act;
        if (act === 'close') { dialog.close(); return; }
        if (act === 'listen') {
            if (playing) { tts.player.stop(); playing = false; }
            else {
                segs ??= segsOf(mes, rows, tts);
                if (!segs.length) window.toastr?.info?.('들을 대사가 없어요. 속마음은 TTS 설정에서 「건너뛰기」로 되어 있어요.');
                playing = segs.length > 0 && !!tts.player.speakSegments(mesId, segs);
            }
            listen.innerHTML = listenLabel();
            return;
        }
        // 바깥(뒷배경)을 눌렀을 때만 닫기
        if (event.target !== dialog) return;
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
    showThemeModal(dialog);
    dialog.focus({ preventScroll: true });
    return dialog;
}
