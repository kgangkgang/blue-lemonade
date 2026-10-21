import { context, chatKey, exclusive, termHooks } from './state.js';
import { CHAT_GLOSSARY_KEY, chatGlossaryEntries } from '../chat-glossary.js';
import { STYLE_PROFILE_KEY, styleProfiles } from '../style-profile.js';
import { bookStamp, exportCandidates, planBookImport } from '../book-transfer-core.js';

export function assertBookJob(job) {
    const ctx = context();
    if (job.closed?.() || !ctx.getCurrentChatId?.() || chatKey() !== job.chatKey || ctx.chatMetadata !== job.metadata) throw Error('채팅이나 창이 바뀌었어요. 옮길 채팅에서 다시 열어 주세요.');
    if (bookStamp(job.metadata) !== job.stamp) throw Error('용어나 말투가 다른 곳에서 바뀌었어요. 목록을 다시 읽어 주세요.');
    if (termHooks()?.busy?.()) throw Error('진행 중인 번역이 끝난 뒤 옮겨 주세요.');
}
export function prepareBookJob(closed) {
    const ctx = context();
    if (!ctx.chatMetadata || !ctx.getCurrentChatId?.()) throw Error('먼저 저장된 채팅을 열어 주세요.');
    const job = { metadataOnly: true, metadataKeys: [CHAT_GLOSSARY_KEY, STYLE_PROFILE_KEY], metadata: ctx.chatMetadata, chatKey: chatKey(), stamp: bookStamp(ctx.chatMetadata), closed };
    assertBookJob(job);
    const entries = termHooks()?.entries?.() || chatGlossaryEntries(job.metadata);
    return { ...job, candidates: exportCandidates(entries, styleProfiles(job.metadata)) };
}
export function applyBook(job, book, options) {
    return exclusive(async () => {
        assertBookJob(job);
        const plan = planBookImport(job.metadata, book, options);
        if (!plan.changed) return { ...job, plan, saved: { confirmed: true } };
        const before = job.metadataKeys.map(key => structuredClone(job.metadata[key]));
        job.metadata[CHAT_GLOSSARY_KEY] = plan.terms;
        job.metadata[STYLE_PROFILE_KEY] = plan.styles;
        const stamp = bookStamp(job.metadata);
        let saved;
        try { saved = await termHooks().save(job); }
        catch (error) {
            // A pre-save error can be reverted only if no newer local edit replaced our values.
            if (bookStamp(job.metadata) === stamp) job.metadataKeys.forEach((key, i) => { if (before[i] === undefined) delete job.metadata[key]; else job.metadata[key] = before[i]; });
            throw error;
        }
        if (context().chatMetadata === job.metadata && chatKey() === job.chatKey) termHooks()?.changed?.();
        return { ...job, stamp, plan, saved };
    });
}
