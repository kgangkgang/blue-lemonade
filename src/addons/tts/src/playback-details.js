// Plain text only: original dialogue and effect metadata never become HTML.
// 6.4.2 「같은 말」인지 접어서 본다 — 따옴표 · 줄임표 · 문장부호 · 기호 · 쉼 표식 · 오디오 태그 · 장음 겹침 · 말끝 っ(감정 세기 「약하게」의 순한 글)는 다른 말이 아니다.
//   막대 글이 이미 원문인데 「원문」 칩이 뜨고 같은 글이 나오던 것 — 옮긴 글 · 화면 글을 옮겨 읽음 · 원문 짝이 다른 글일 때만 칩
const folded = value => String(value || '').normalize('NFKC').replace(/<#[\d.]+#>/g, ' ').replace(/\[[A-Za-z][A-Za-z' -]{0,30}\]/g, ' ')
    .replace(/ー{2,}/g, 'ー').replace(/っ(?=[\p{P}\p{S}\s]|$)/gu, '').replace(/[\p{P}\p{S}\s]+/gu, '').toLowerCase();
export function playbackOriginal(job) {
    if (!job || job.sceneKind) return '';
    // 1.9.2 원문을 못 찾아 화면 글(번역문)을 듣는 언어로 옮겨 읽는 줄: 칸에는 번역문을 「원문」처럼 두지 않고 실제로 읽는 글 (제목이 사정을 말함)
    if (job.listen && fromDisplayOf(job)) return String(job.text || '').trim();
    const parts = job.parts || [];
    const original = parts.map(p => p.original?.text || p.seg?.text || '').filter((s, i, all) => s && (i === 0 || s !== all[i - 1])).join('\n').trim();
    // Compare before engine chunking; splitting a long unchanged line is not an edit.
    const changed = parts.some(p => folded(p.original?.text || p.seg?.text || '') !== folded(p.text ?? job.text));
    return original && changed ? original : '';
}
/** 6.3.8 칸 제목: 원문 짝을 못 찾아 화면 글(번역문)을 옮겨 읽는 줄이면 「원문」이라고 하지 않는다.
 *  1.9.1 더 솔직하게 (사용자: 「아니 원문도 일본어인데」 — 칸에 번역문이 「지금 읽는 대사의 원문」으로 떴다) */
export const ORIGINAL_MISSING = '원문을 못 찾았어요 — 화면 글(번역문)';
export const ORIGINAL_MISSING_LISTEN = '원문을 못 찾았어요 — 화면 글을 옮겨 읽는 중';   // 1.9.2 듣는 언어로 번역문을 옮겨 읽음 (칸 = 실제로 읽는 글)
// 6.9.6 번역 중 미리 보기에서 누른 줄인데 그 문단 번역이 아직 덜 와서 원문 짝이 없음 — 까닭까지
export const ORIGINAL_PREVIEW = '번역이 아직 덜 와서 원문을 못 찾았어요 — 화면 글(번역문)';
export const ORIGINAL_PREVIEW_LISTEN = '번역이 아직 덜 와서 원문을 못 찾았어요 — 화면 글을 옮겨 읽는 중';
const fromDisplayOf = (job) => (job?.parts || []).some(p => (p?.original || p?.seg)?.fromDisplay === true);
const fromPreviewOf = (job) => (job?.parts || []).some(p => (p?.original || p?.seg)?.fromPreview === true);
const missingTitle = (job) => (fromPreviewOf(job) ? (job?.listen ? ORIGINAL_PREVIEW_LISTEN : ORIGINAL_PREVIEW) : job?.listen ? ORIGINAL_MISSING_LISTEN : ORIGINAL_MISSING);
export function playbackOriginalTitle(job) {
    if (!fromDisplayOf(job)) return '지금 읽는 대사의 원문';
    return missingTitle(job);
}
/** 1.9.3 원문 칸 (막대): 메시지 원문(source)과 직접 견줘 { text, title } — 사용자 10-16 「원문 일본어라고~~~!!!」
 *  (막대는 일본어 원문을 읽는데 칸에 화면 한국어 번역문이 「지금 읽는 대사의 원문」으로 떴다 — 효과음 대본 · 누르기 길의 조각은 원문 짝 자리에 화면 글이 있었다)
 *  · 1.9.4 TTS 가 옮겨 읽은 줄(듣는 언어 job.listen · 목소리 원어 번역 job.translated)만 칸 — 원문 · 화면 글을 그대로 읽으면 칸 없음
 *    (사용자 「번역했을 때만 보여야지 · tts는 번역 안 했잖아」)
 *  · 원문 짝이라고 둔 글이 원문에 없으면 화면 글 — 「원문」이라 하지 않는다 · 원문이 없는 메시지는 예전 규칙 */
export function playbackOriginalIn(job, source) {
    if (!job || job.sceneKind || (!job.listen && !job.translated)) return { text: '', title: playbackOriginalTitle(job) };
    const src = folded(source || '');
    if (!src) return { text: playbackOriginal(job), title: playbackOriginalTitle(job) };
    const spoken = String(job.text || '').trim();
    const pieces = (job.parts?.length ? job.parts.map(p => p.text ?? job.text) : [job.text]).map(folded).filter(Boolean);
    if (spoken && pieces.length && pieces.every(piece => src.includes(piece))) {
        return { text: '', title: '지금 읽는 대사의 원문' };
    }
    const text = playbackOriginal(job);
    if (text && !src.includes(folded(text))) return { text, title: missingTitle(job) };
    return { text, title: playbackOriginalTitle(job) };
}
/** RIFF INFO comment preserves attribution inside a WAV, including after renaming. */
export async function wavWithCredits(blob, credits) {
    if (!credits) return blob;
    const source = new Uint8Array(await blob.arrayBuffer());
    if (source.length < 44 || String.fromCharCode(...source.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...source.slice(8, 12)) !== 'WAVE') throw new Error('WAV 파일에 출처를 기록하지 못했어요.');
    const comment = new TextEncoder().encode(credits + '\0');
    const size = 4 + 8 + comment.length + (comment.length % 2);
    const result = new Uint8Array(source.length + 8 + size), view = new DataView(result.buffer);
    result.set(source);
    const tag = (at, text) => result.set(new TextEncoder().encode(text), at);
    let at = source.length;
    tag(at, 'LIST'); view.setUint32(at + 4, size, true); tag(at + 8, 'INFO');
    tag(at + 12, 'ICMT'); view.setUint32(at + 16, comment.length, true); result.set(comment, at + 20);
    view.setUint32(4, result.length - 8, true);
    return new Blob([result], { type: 'audio/wav' });
}
