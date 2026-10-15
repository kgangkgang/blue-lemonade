// 6.6.9 대사만 보기 — 메시지 글 → 인물 대사 목록 (순수 함수: DOM · 실리태번 없음, tools/tests/dialogue-only.mjs 가 검사한다).
//   글 나누기는 TTS 의 segmentMessage(src/addons/tts/src/text.js) 를 그대로 쓴다 — 「」『』 · 인라인 색 대사(<span style="color">) · 여러 줄 대사 ·
//   "이름: 「" 표시 · 속마음 · 답 머리 생각 블록 · 숨김 <!-- --> 주석 규칙이 TTS 가 읽는 것과 같다. TTS 애드온이 꺼져 있어도 이 파일만으로 돈다.
//   더 하는 것: 머리가 아닌 곳의 생각 블록(<ECoT>… message-work.js THINKING_BLOCK)도 지운다 · 번역문이 있으면 번역문 기준 + 원문의 색 · 이름을 짝지어 옮긴다.
import { segmentMessage, speechDisplay, pairSegments } from './addons/tts/src/text.js';
import { THINKING_BLOCK } from './message-work.js';

/** TTS 설정 skip_tags 의 기본값 (src/addons/tts/src/settings.js DEFAULT_SKIP_TAGS 와 같게 — 테스트가 맞춰 본다) */
export const DEFAULT_SKIP_TAGS = 'details,summary,style,script,tracker,status,scene_plan,momentum,visuals,think,thinking,reasoning,img,audio,video,table';

/** 같은 길이 빈칸으로 (줄 수 · 줄 번호는 그대로) */
const blank = s => s.replace(/[^\n]/g, ' ');
export function dropThinkingBlocks(text) {
    return String(text ?? '').replace(new RegExp(THINKING_BLOCK.source, 'gi'), blank);
}

/** 화면에 보이는 글: 번역문(extra.display_text)이 있으면 그것 (번역기의 접기 · 원문 먼저 칸은 번역문 쪽으로), 없으면 원문 */
export function shownText(mes) {
    const raw = String(mes?.mes ?? '');
    const d = mes?.extra?.display_text;
    if (typeof d === 'string' && d.trim() && d !== raw) return { text: speechDisplay(d), translated: true };
    return { text: raw, translated: false };
}

function optsOf(o = {}) {
    return {
        skipTags: o.skipTags ?? DEFAULT_SKIP_TAGS,
        skipCode: o.skipCode !== false,
        stripRegex: o.stripRegex || [],
        userName: o.userName || '',
        charName: o.charName || '',
        knownNames: o.knownNames || [],
        routes: { thought: 'character' },   // 속마음도 글째 받는다 (목록에 「속마음」 으로)
        final: true,
    };
}
const segs = (text, o) => { try { return segmentMessage(dropThinkingBlocks(text), o) || []; } catch { return []; } };

/**
 * 메시지 → 대사 줄 [{ kind: 'dialogue'|'thought', text, raw, color, name, line, sameIndex, sameCount }]
 * opts: { skipTags, skipCode, stripRegex, userName, charName, knownNames, sub(text) }  (TTS 설정이 있으면 그 값, 없으면 기본)
 */
export function dialogueLines(mes, opts = {}) {
    if (!mes || mes.is_system) return [];
    const sub = typeof opts.sub === 'function' ? opts.sub : (t => t);
    const o = optsOf(opts);
    const { text, translated } = shownText(mes);
    let list = segs(sub(text), o);
    // 번역문: 원문의 색 · 이름을 차례대로 옮긴다 (대사 수가 같고 색이 부딪치지 않을 때만 — TTS 와 같은 규칙)
    if (translated) { try { list = pairSegments(segs(sub(String(mes.mes ?? '')), o), list); } catch { /* 짝 못 맞추면 번역문 그대로 */ } }
    const out = [];
    const fold = s => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const count = new Map(), seen = new Map();
    for (const x of list) if (x?.kind === 'dialogue' && x.text) count.set(fold(x.text), (count.get(fold(x.text)) || 0) + 1);
    for (const x of list) {
        if (!x || !x.text || (x.kind !== 'dialogue' && x.kind !== 'thought')) continue;
        const k = fold(x.text), n = seen.get(k) || 0;
        if (x.kind === 'dialogue') seen.set(k, n + 1);
        out.push({ kind: x.kind, text: x.text, raw: x.raw ?? x.text, color: x.color || null, name: x.speakerHint || null, line: x.line || 0,
            sameIndex: x.kind === 'dialogue' ? n : 0, sameCount: x.kind === 'dialogue' ? count.get(k) || 0 : 0 });
    }
    return out;
}

// 화면 글과 저장 글의 차이(마크다운 글자 · 공백 · 실리태번이 '...' 를 '…' 로 그림)는 빼고 견준다
const SKIP = /[\s*_~`.…⋯\u200b-\u200f\ufeff]/;
/**
 * 화면 글(글 노드 조각들)에서 줄들의 자리를 차례대로 찾는다 — 같은 대사가 여러 번이어도 앞 줄 뒤에서 찾으므로 순서가 맞는다.
 * pieces: [문자열 …] → 줄마다 { piece, offset, endPiece, endOffset } (첫 글자 · 맞은 마지막 글자 바로 뒤의 조각 · 자리) 또는 null.
 *   앞 32자(못 찾으면 12 · 6자)로 찾고, 거기서 줄 글이 이어 맞는 데까지를 끝으로 — 강조가 조각(색 span · 강조 태그)을 넘어 줄 전체를 덮는다.
 */
export function locateLines(pieces, lines) {
    let plain = '';
    const where = [];
    pieces.forEach((p, i) => { const s = String(p ?? ''); for (let j = 0; j < s.length; j++) if (!SKIP.test(s[j])) { plain += s[j]; where.push([i, j]); } });
    let from = 0;
    return lines.map(line => {
        const full = [...String(line?.text ?? '').normalize('NFC')].filter(c => !SKIP.test(c)).join('');
        for (const n of [full.slice(0, 32), full.slice(0, 12), full.slice(0, 6)]) {
            if (!n) continue;
            const at = plain.indexOf(n, from);
            if (at < 0) continue;
            let len = n.length;
            while (len < full.length && plain[at + len] === full[len]) len++;
            from = at + len;
            const [piece, offset] = where[at], [endPiece, last] = where[at + len - 1];
            // 줄 끝의 마침표 · 줄임표(비교에서 뺀 글자)도 덮는다 — 같은 조각 안에서만
            const tail = String(pieces[endPiece] ?? '');
            let endOffset = last + 1;
            while (endOffset < tail.length && /[.…⋯]/.test(tail[endOffset])) endOffset++;
            return { piece, offset, endPiece, endOffset };
        }
        return null;
    });
}
