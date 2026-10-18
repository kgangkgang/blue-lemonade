import { context, chatKey, exclusive, captureGuard, deleteHooks, termHooks } from './state.js';
import { pickSame } from './delete-core.js';
import { CHAT_GLOSSARY_KEY, chatGlossaryEntries, planChatTerm, proposeChatTerm } from '../chat-glossary.js';

const stale = () => Error('메시지나 채팅이 바뀌었어요. 현재 번역문에서 다시 선택해 주세요.');
function assertCurrent(job) {
    if(termHooks()?.busy?.()) throw Error('진행 중인 번역이 끝난 뒤 표기를 고치거나 지워 주세요.');
    job.guard?.assert();
    const ctx = context();
    if (job.closed?.() || chatKey() !== job.chatKey || ctx.chat[job.id] !== job.message || ctx.chatMetadata !== job.metadata || job.message.mes !== job.mes || job.message.swipe_id !== job.swipe || job.message.extra?.display_text !== job.display || deleteHooks()?.busy?.(job.id)) throw stale();
    if (JSON.stringify(job.metadata[CHAT_GLOSSARY_KEY]) !== job.rulesStamp) throw Error('기억한 표기가 다른 곳에서 바뀌었어요. 창을 다시 열어 주세요.');
}
export async function prepareTermMemory(selection, closed) {
    if (!selection?.display || !selection.text || selection.text.length > 100) throw Error('번역문에서 이름이나 호칭을 100자 안으로 선택해 주세요.');
    return exclusive(async () => {
        const metadata = context().chatMetadata;
        if (!metadata || !context().getCurrentChatId?.()) throw Error('저장된 채팅에서 사용해 주세요.');
        const job = {...selection, metadata, closed, rulesStamp: JSON.stringify(metadata[CHAT_GLOSSARY_KEY])};
        assertCurrent(job);
        const ctx = context(), hooks = deleteHooks(), source = ctx.substituteParams(job.mes, ctx.name1, job.message.name);
        const raw = await hooks.rawTranslation(job.message, source); assertCurrent(job);
        if (typeof raw !== 'string' || !raw || hooks.render(source, raw) !== job.display) throw Error('표시와 연결된 번역 기록을 확인하지 못했어요. 번역문을 다시 열어 주세요.');
        const picked = job.correction;
        if (picked?.side !== 'translation' || picked.text !== job.text) throw Error('번역문 쪽에서 이름이나 호칭만 다시 선택해 주세요.');
        const span = pickSame(raw, job.text, picked.ordinal, picked.screen);
        if (!span || /[<>]/.test(raw.slice(span.start, span.end))) throw Error('같은 표기가 반복되거나 서식에 걸려 한 곳을 정하지 못했어요. 조금 더 긴 표기를 선택해 주세요.');
        return {...job, source, raw, span, suggested: proposeChatTerm(termHooks().entries(), job.text, source)};
    });
}
export async function applyTermMemory(job, src, dst) {
    return exclusive(async () => {
        assertCurrent(job);
        const rules = planChatTerm(job.metadata, job.source, src, dst), hooks = deleteHooks();
        const raw = job.raw.slice(0,job.span.start) + dst.trim() + job.raw.slice(job.span.end);
        const display = hooks.render(job.source, raw);
        if (!display) throw Error('새 번역 표시를 만들지 못했어요.');
        const before = {extra: structuredClone(job.message.extra), rules: structuredClone(job.metadata[CHAT_GLOSSARY_KEY])};
        const extra = job.message.extra;
        extra.display_text = display;
        if ('original_translation_backup' in extra) extra.original_translation_backup = display;
        extra.translation_edited = hooks.hashOf(job.source);
        hooks.remember(extra, job.source, raw, display);
        job.metadata[CHAT_GLOSSARY_KEY] = rules;
        const after = {extra: JSON.stringify(extra), rules: JSON.stringify(rules)};
        job.guard?.acceptDisplay(); hooks.syncSwipe(job.id);
        let saved;
        try { saved = await termHooks().save(job); }
        catch (error) {
            // Roll back only our exact state, never a newer edit or another chat.
            if (JSON.stringify(extra) === after.extra && JSON.stringify(job.metadata[CHAT_GLOSSARY_KEY]) === after.rules) {
                for (const key of Object.keys(extra)) delete extra[key]; Object.assign(extra,before.extra);
                if (before.rules === undefined) delete job.metadata[CHAT_GLOSSARY_KEY]; else job.metadata[CHAT_GLOSSARY_KEY] = before.rules;
                if (chatKey() === job.chatKey && context().chat[job.id] === job.message) hooks.syncSwipe(job.id);
            }
            throw error;
        }
        if (chatKey() === job.chatKey && context().chat[job.id] === job.message && job.message.swipe_id === job.swipe) { termHooks().changed(); await hooks.refresh(job.id, job.message); }
        return {...job, guard:captureGuard(job.message), display, rulesStamp:after.rules, after, before, saved};
    });
}
export async function undoTermMemory(job) {
    return exclusive(async () => {
        assertCurrent(job);
        if (JSON.stringify(job.message.extra) !== job.after.extra) throw Error('번역문이 다시 수정되어 되돌리지 않았어요.');
        const hooks = deleteHooks(), extra = job.message.extra;
        const rollback = structuredClone(extra), rules = job.metadata[CHAT_GLOSSARY_KEY];
        for (const key of Object.keys(extra)) delete extra[key]; Object.assign(extra, structuredClone(job.before.extra));
        if (job.before.rules === undefined) delete job.metadata[CHAT_GLOSSARY_KEY]; else job.metadata[CHAT_GLOSSARY_KEY] = structuredClone(job.before.rules);
        const written = JSON.stringify(extra), ruleStamp = JSON.stringify(job.metadata[CHAT_GLOSSARY_KEY]);
        job.guard?.acceptDisplay(); hooks.syncSwipe(job.id);
        let saved;
        try { saved = await termHooks().save(job); }
        catch (error) {
            if (JSON.stringify(extra) === written && JSON.stringify(job.metadata[CHAT_GLOSSARY_KEY]) === ruleStamp) {
                for (const key of Object.keys(extra)) delete extra[key]; Object.assign(extra, rollback); job.metadata[CHAT_GLOSSARY_KEY] = rules;
                if (chatKey() === job.chatKey && context().chat[job.id] === job.message) hooks.syncSwipe(job.id);
            }
            throw error;
        }
        if (chatKey() === job.chatKey && context().chat[job.id] === job.message && job.message.swipe_id === job.swipe) { termHooks().changed(); await hooks.refresh(job.id,job.message); }
        return saved;
    });
}
export function prepareTermList(selection, closed) {
    if (!selection) throw Error('현재 채팅에서 글을 선택해 주세요.');
    const metadata = context().chatMetadata;
    const job = {...selection,metadata,closed,rulesStamp:JSON.stringify(metadata?.[CHAT_GLOSSARY_KEY])};
    assertCurrent(job);
    return {...job,entries:chatGlossaryEntries(metadata)};
}
export async function removeTermRule(job, id) {
    return exclusive(async()=>{
        assertCurrent(job);
        const entries=chatGlossaryEntries(job.metadata), next=entries.filter(e=>e.id!==id);
        if(next.length===entries.length) throw Error('이미 지워졌거나 바뀐 표기예요. 목록을 다시 열어 주세요.');
        const before=job.metadata[CHAT_GLOSSARY_KEY];job.metadata[CHAT_GLOSSARY_KEY]=next;
        let saved;
        try { saved=await termHooks().save(job); }
        catch(error){if(job.metadata[CHAT_GLOSSARY_KEY]===next)job.metadata[CHAT_GLOSSARY_KEY]=before;throw error;}
        if(chatKey()===job.chatKey)termHooks().changed();
        return {...job,rulesStamp:JSON.stringify(next),entries:next,saved};
    });
}
