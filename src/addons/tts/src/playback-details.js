// Plain text only: original dialogue and effect metadata never become HTML.
const comparable = value => String(value || '').normalize('NFC').replace(/<#[\d.]+#>/g, ' ').replace(/\s+/g, ' ').trim();
export function playbackOriginal(job) {
    if (!job || job.sceneKind) return '';
    const parts = job.parts || [];
    const original = parts.map(p => p.original?.text || p.seg?.text || '').filter((s, i, all) => s && (i === 0 || s !== all[i - 1])).join('\n').trim();
    // Compare before engine chunking; splitting a long unchanged line is not an edit.
    const changed = parts.some(p => comparable(p.original?.text || p.seg?.text || '') !== comparable(p.text ?? job.text));
    return original && changed ? original : '';
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
