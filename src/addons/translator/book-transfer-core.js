import { glossaryFold, glossaryAlternatives } from './glossary-match.js';
import { CHAT_GLOSSARY_KEY, CHAT_GLOSSARY_LIMIT, chatGlossaryEntries } from './chat-glossary.js';
import { STYLE_PROFILE_KEY, STYLE_PROFILE_LIMIT, planStyleProfile } from './style-profile.js';

export const BOOK_KIND = 'blue-lemonade-translation-book';
export const BOOK_FILE_LIMIT = 2 * 1024 * 1024;
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
export const bookStamp = metadata => JSON.stringify([metadata?.[CHAT_GLOSSARY_KEY], metadata?.[STYLE_PROFILE_KEY]]);
export const termKey = row => glossaryFold(row.src);
export const styleKey = row => row.id;

function term(row) {
    if (!object(row) || typeof row.src !== 'string' || typeof row.dst !== 'string') throw Error('용어의 원문·번역 형식이 올바르지 않아요.');
    const item = { src: row.src.trim(), dst: row.dst.trim() };
    if (chatGlossaryEntries({ [CHAT_GLOSSARY_KEY]: [item] }).length !== 1) throw Error('용어는 원문·번역 각각 100자 안의 글이어야 해요. 원문 표기는 한 가지씩 넣어 주세요.');
    return { id: termKey(item), scope: 'chat', ...item };
}
function style(row) {
    if (!object(row) || typeof row.speaker !== 'string' || typeof row.mode !== 'string' || typeof row.note !== 'string'
        || row.listener != null && typeof row.listener !== 'string' || row.mutual != null && typeof row.mutual !== 'boolean') throw Error('말투 지침의 형식이 올바르지 않아요.');
    return planStyleProfile({}, row)[0];
}
const distinct = (rows, key) => {
    const seen = new Set();
    return rows.filter(row => { const id = key(row); if (seen.has(id)) return false; seen.add(id); return true; });
};

/** Build an explicit, selectable snapshot of the terms currently applied to this chat. */
export function exportCandidates(terms = [], styles = []) {
    const out = { terms: [], styles: [], omitted: 0 };
    for (const row of terms) {
        const forms = glossaryAlternatives(row?.src);
        if (!forms.length) { out.omitted++; continue; }
        for (const src of forms) {
            try { out.terms.push(term({ src, dst: row.dst })); } catch { out.omitted++; }
        }
    }
    for (const row of styles) { try { out.styles.push(style(row)); } catch { out.omitted++; } }
    out.terms = distinct(out.terms, termKey); out.styles = distinct(out.styles, styleKey);
    return out;
}

// 3.1.7 다른 번역 확장(Interpres 계열)이 내보낸 용어·말투 파일(format interpres-book · version 1 · glossary [{src,dst}] · voiceCards [{name,style}])도 읽는다.
//   파일 꼴만 읽고 그 확장의 코드는 쓰지 않는다. 용어는 표기마다 한 줄로, 말투 카드는 그 인물의 「직접 지침」(custom)으로.
//   이 확장의 규칙(이름 80자 · 용어 100자 · 지침 300자 · 꺾쇠 없음)에 맞지 않는 항목은 통째로 거절하지 않고 빼서 센다(omitted) — 미리 보기에 남은 것만 보인다.
export const OTHER_BOOK_FORMAT = 'interpres-book';
function readOtherBook(raw) {
    const glossary = raw.glossary ?? [], voices = raw.voiceCards ?? [];
    if (!Array.isArray(glossary) || !Array.isArray(voices)) throw Error('용어·말투 파일의 목록 형식이 올바르지 않아요.');
    if (glossary.length > 1000 || voices.length > 200) throw Error('파일의 항목이 너무 많아요. 용어 1,000개·말투 200개 이하로 나눠 주세요.');
    const terms = [], styles = [];
    let omitted = 0;
    for (const row of glossary) {
        const forms = typeof row?.src === 'string' && typeof row?.dst === 'string' ? glossaryAlternatives(row.src) : [];
        if (!forms.length) { omitted++; continue; }
        for (const src of forms) { try { terms.push(term({ src, dst: row.dst })); } catch { omitted++; } }
    }
    for (const row of voices) {
        try { styles.push(style({ speaker: row?.name, listener: '', mutual: false, mode: 'custom', note: row?.style })); } catch { omitted++; }
    }
    const keptTerms = distinct(terms, termKey), keptStyles = distinct(styles, styleKey);
    return { terms: keptTerms, styles: keptStyles, duplicates: terms.length + styles.length - keptTerms.length - keptStyles.length, omitted };
}

export function readBook(raw) {
    if (object(raw) && raw.format === OTHER_BOOK_FORMAT && raw.version === 1) return readOtherBook(raw);
    if (!object(raw) || raw.kind !== BOOK_KIND || raw.version !== 1 || !Array.isArray(raw.terms) || !Array.isArray(raw.styles)) throw Error('블루레몬 용어·말투 파일이 아니에요.');
    if (raw.terms.length > 1000 || raw.styles.length > 200) throw Error('파일의 항목이 너무 많아요. 용어 1,000개·말투 200개 이하로 나눠 주세요.');
    // Validate every item before returning any data to the caller.
    const terms = raw.terms.map(term), styles = raw.styles.map(style);
    return { terms: distinct(terms, termKey), styles: distinct(styles, styleKey), duplicates: terms.length + styles.length - distinct(terms, termKey).length - distinct(styles, styleKey).length };
}
export function makeBook(terms, styles) {
    const checked = readBook({ kind: BOOK_KIND, version: 1, terms, styles });
    return { kind: BOOK_KIND, version: 1,
        terms: checked.terms.map(({ src, dst }) => ({ src, dst })),
        styles: checked.styles.map(({ speaker, listener, mutual, mode, note }) => ({ speaker, listener, mutual, mode, note })) };
}

function existing(metadata, key, normalize, limit) {
    const raw = metadata?.[key];
    if (raw === undefined) return [];
    if (!Array.isArray(raw) || raw.length > limit) throw Error('현재 채팅의 목록을 안전하게 읽지 못했어요. 기존 자료를 백업한 뒤 확인해 주세요.');
    return raw.map(normalize);
}
function mergeRows(before, incoming, key, policy, limit) {
    const rows = before.map(row => ({ ...row })), indices = new Map(rows.map((row, i) => [key(row), i]));
    const count = { added: 0, updated: 0, kept: 0 };
    for (const row of incoming) {
        const id = key(row), index = indices.get(id);
        if (index !== undefined) {
            if (policy === 'update' && JSON.stringify(rows[index]) !== JSON.stringify(row)) { rows[index] = { ...row }; count.updated++; }
            else count.kept++;
        } else { indices.set(id, rows.length); rows.push({ ...row }); count.added++; }
    }
    if (rows.length > limit) throw Error(`가져오면 ${rows.length}개가 되어 현재 채팅 한도 ${limit}개를 넘어요. 가져올 항목을 줄여 주세요.`);
    return { rows, count };
}
export function planBookImport(metadata, book, { policy = 'keep' } = {}) {
    if (!['keep', 'update'].includes(policy)) throw Error('중복 처리 방식을 골라 주세요.');
    const terms = mergeRows(existing(metadata, CHAT_GLOSSARY_KEY, term, CHAT_GLOSSARY_LIMIT), book.terms.map(term), termKey, policy, CHAT_GLOSSARY_LIMIT);
    const styles = mergeRows(existing(metadata, STYLE_PROFILE_KEY, style, STYLE_PROFILE_LIMIT), book.styles.map(style), styleKey, policy, STYLE_PROFILE_LIMIT);
    return { terms: terms.rows, styles: styles.rows, counts: { terms: terms.count, styles: styles.count }, changed: terms.count.added + terms.count.updated + styles.count.added + styles.count.updated > 0 };
}
