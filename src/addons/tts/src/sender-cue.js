// 서술 속 인용의 보낸 사람 단서 (2.0.1 · 2.0.2 넓힘) — 순수 모듈(실리태번 · DOM 없이 · tools/tests/tts-paint-cue.mjs 가 부른다)
//   사용자 11-21 「저 대사는 왜 그 인물 색 아님」 · 「타자는 왜 그 인물 대사 색 아님 ㅜ」.
//   senderCue(before, after, names, { userName }) → 보낸 사람 이름 | null
//     before = 인용 바로 앞 서술(두 문장까지 — 인용만 있는 문단이면 앞 문단 서술) · after = 인용 뒤 같은 문장
//   ① 보낸 쪽 꼴: 아는 이름 뒤 「에게서 · 로부터」 · 「의 메시지 · 답장 · 회신 · 문자 · 톡 …」 · 「특유의 … 답장 · 타자」 · 「가 (방금) 보낸 · 쳐낸 · 친 · 남긴 …」 ·
//      「X: 」 · from X · X's reply · X texted (back) · Xからの · Xの返信 · Xが送
//   ② 받는 쪽 꼴(「X(직함)과의 대화창을 열고 … 입력한다」 · 「X에게 … 보낸다」 · Xに送る · sends X · to X): 보낸 사람은 그 문장의 주어 —
//      주어가 「나」(사용자 이름 · 나 · I)일 때만 사용자로. 그녀 · 그 · she · he 는 바로 앞 문장 주어가 사용자일 때만 사용자로
//   ③ 여럿이면 인용에 가장 가까운 단서 하나 · 못 가리면 null(오판보다 못 가림) · 아는 이름(names)만
import { foldBlank } from '../../../blank-fold.js';

const TAIL = String.raw`(?:\s*[(（][^()（）\n]{0,24}[)）])?`;   // 「X (부서)」 · 「X(부서 직함)」 의 괄호 덧말   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
const VERB_KO = '보낸|보내온|보낸다|보냈다|남긴|적은|쓴|전한|쳐낸|쳐\\s*보낸|친|입력한|타이핑한|올린';   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
const SENDER_AFTER = [
    String.raw`\s*(?:에게서|한테서|께서|(?:으)?로부터)(?![가-힣])`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`\s*의\s*(?:새\s*|짧은\s*|긴\s*)?(?:메시지|메세지|문자|답장|회신|답|톡|카톡|DM|메일|편지|쪽지|알림|글|말|음성\s*메모|보이스|타자)`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`\s*특유의\s+[^.!?。！？]{0,60}?(?:답장|회신|답|문자|메시지|메세지|톡|타자|글)`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`(?:이|가|은|는)?\s+(?:[^\s.!?。！？]{1,12}\s+){0,3}?(?:${VERB_KO})(?![가-힣])`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`(?:이|가)\s*(?:${VERB_KO})(?![가-힣])`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`\s*[:：]\s*$`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`\s*(?:からの|から)`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`\s*の\s*(?:メッセージ|メール|返信|LINE|通知|DM|手紙)`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`\s*(?:が|は)\s*(?:送|返信)`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`['’]s\s+(?:new\s+|quick\s+|short\s+|curt\s+)?(?:message|text|dm|reply|response|email|note|voicemail)`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`\s+(?:sent|texted|wrote|messaged|replied|typed)`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
];
const SENDER_BEFORE = [String.raw`\bfrom\s+$`];   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
// 받는 쪽: 이름 뒤 「과/와의 (개인) 대화창 · 채팅방 …」(그 문장에 입력 · 전송 · 보내는 말이 있을 때) · 「에게/한테 … 보낸다」 · 「に送る」
const SEND_WORD = /입력|전송|보낸|보내|보냈|타이핑|친다|쳤|두드|올린|올렸|送|入力|返信|sends?|sent|types?|typed|texts?|texted|messages?|replies|replied/iu;
const RECEIVER_AFTER = [
    String.raw`\s*(?:과|와)의\s*(?:개인\s*|1:1\s*|단톡\s*)?(?:대화창|채팅창|대화방|채팅방|톡방|DM\s*창|메신저\s*창|창)`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`\s*(?:에게|한테|께)(?!서)\s*(?:[^\s.!?。！？]{1,12}\s+){0,3}?(?:보낸다|보냈다|보낸|보내|전송|입력|답장|친다|쳤)`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    String.raw`\s*(?:に|へ)\s*(?:返信|送|メッセージ|メール)`,   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
];
const RECEIVER_BEFORE = [String.raw`\b(?:to|texts?|texted|messages?|messaged|dms?|replies\s+to|replied\s+to)\s+$`];   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
const LETTER = /[\p{L}\p{N}]/u;
const splitSentences = s => String(s || '').split(/(?<=[.!?。！？])\s+/u).filter(x => x.trim());   // blank-ok: foldBlank 한 글만 와요

/** 문장 안에 나온 아는 이름들 [{ name, i }] (낱말 머리 · 로마자 이름은 낱말 끝까지 · 「하은하」 속 「은하」 아님) */
function namesAt(text, names) {
    const hay = String(text || ''), low = hay.toLowerCase(), out = [], seen = new Set();
    for (const n of names || []) {
        const name = String(n || '').trim(), key = name.toLowerCase();   // blank-ok: 이름 표
        if ((key.match(/[\p{L}\p{N}]/gu) || []).length < 2 || seen.has(key)) continue;
        seen.add(key);
        for (let i = low.indexOf(key); i >= 0; i = low.indexOf(key, i + 1)) {
            const prev = low[i - 1] || '';
            if (LETTER.test(prev) && !/^[぀-ヿ一-鿿]/u.test(key)) continue;   // 낱말 머리에서만(일본어 이름은 앞 글자에 붙어 써요)
            if (/[a-z0-9]$/.test(key) && /[a-z0-9]/.test(low[i + key.length] || '')) continue;
            out.push({ name, i, end: i + name.length });
        }
    }
    return out;
}
const re = (p, f = 'iu') => new RegExp(p, f);
const restOf = (s, m) => s.slice(m.end).replace(re(`^${TAIL}`), '');
/** 문장 주어가 「나」인가 — 사용자 이름 · 나 · 내가 · I · 私 · 僕 / 그녀 · 그 · she · he · 彼女 · 彼 는 앞 문장 주어가 나일 때 */
function subjectIsUser(sentence, prev, userName) {
    const me = String(userName || '').trim();   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    const head = String(sentence || '').replace(/^[\s*_~>「『"“(（]+/u, '');   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    const meRe = me ? me.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    const direct = re(String.raw`^(?:${meRe ? `${meRe}|` : ''}나|내|저|제)(?:은|는|이|가|도|만)(?![가-힣])|^(?:I|I['’]m|I've)\b|^(?:私|僕|俺|あたし)(?:は|が)`, 'u');
    if (direct.test(head)) return true;
    const pron = /^(?:그녀|그)(?:는|가|도)(?![가-힣])|^(?:she|he)\b|^(?:彼女|彼)(?:は|が)/iu;
    if (pron.test(head) && prev) return subjectIsUser(prev, null, userName) && !pron.test(String(prev).replace(/^[\s*_~>「『"“(（]+/u, ''));   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    return false;
}
/** 문장 머리의 아는 이름 주어(「렉스는 …」 · 「Rex …」) — 없으면 null */
function headName(sentence, names) {
    const head = String(sentence || '').replace(/^[\s*_~>「『"“(（]+/u, '');   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    for (const m of namesAt(head, names)) if (m.i === 0 && /^(?:은|는|이|가|도)(?![가-힣])|^\s|^(?:は|が)/u.test(restOf(head, m))) return m.name;   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
    return null;
}
/** 한 문장에서 단서들 [{ name, at }] (at = 문장 안 자리) */
function cuesIn(sentence, prev, names, userName) {
    const out = [];
    for (const m of namesAt(sentence, names)) {
        const rest = restOf(sentence, m), head = sentence.slice(0, m.i);
        const receiver = RECEIVER_AFTER.some(p => re(`^(?:${p})`).test(rest)) || RECEIVER_BEFORE.some(p => re(p, 'i').test(head));
        if (receiver) {
            if (!SEND_WORD.test(sentence)) continue;
            if (userName && subjectIsUser(sentence, prev, userName) && m.name.toLowerCase() !== String(userName).toLowerCase()) { out.push({ name: userName, at: m.i, user: true }); continue; }
            // 주어가 다른 아는 이름이면 그 사람(「렉스는 미나와의 대화창을 열고 … 보낸다」 → 렉스)
            const subj = headName(sentence, names);
            if (subj && subj.toLowerCase() !== m.name.toLowerCase()) out.push({ name: subj, at: m.i });
            continue;
        }
        if (/^\s*(?:에게|한테|께)(?!서)/u.test(rest) || /\bto\s+$/i.test(head)) continue;   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
        if (SENDER_AFTER.some(p => re(`^(?:${p})`).test(rest)) || SENDER_BEFORE.some(p => re(p, 'i').test(head))) out.push({ name: m.name, at: m.i });
    }
    // 「그녀가 입력한 · 보낸」: 대명사는 앞 문장 주어가 나일 때만 나
    if (userName) {
        const pm = /(?:^|[\s,，])(그녀|그)(?:가|이|는)\s*(?:[^\s.!?。！？]{1,12}\s+){0,2}?(?:보낸|입력한|타이핑한|쳐낸|친|남긴|적은)(?![가-힣])/u.exec(sentence);   // blank-ok: senderCue 가 foldBlank 한 글만 봐요
        if (pm && subjectIsUser(sentence, prev, userName)) out.push({ name: userName, at: pm.index, user: true });
    }
    return out;
}
/**
 * 보낸 사람 이름 | null — before 는 뒤쪽(인용에 가까운 쪽)이 먼저, after 는 앞쪽이 먼저
 */
export function senderCue(before, after, names, { userName = '' } = {}) {
    const list = [...new Set([...(names || []), ...(userName ? [userName] : [])].filter(Boolean))];
    const b = splitSentences(foldBlank(before)), a = splitSentences(foldBlank(after));
    // 앞: 바로 앞 두 문장(가까운 문장 · 문장 안 뒤쪽 단서 먼저)
    for (let k = b.length - 1, seen = 0; k >= 0 && seen < 2; k--, seen++) {
        const c = cuesIn(b[k], b[k - 1] || null, list, userName);
        if (c.length) return c.sort((x, y) => y.at - x.at)[0].name;
    }
    // 뒤: 같은 문장(앞쪽 단서 먼저) — 「『…』라는 X의 답장이 왔다」
    if (a[0]) { const c = cuesIn(a[0], b[b.length - 1] || null, list, userName); if (c.length) return c.sort((x, y) => x.at - y.at)[0].name; }
    return null;
}
