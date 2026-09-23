import { context, chatKey, enabled, isBusy } from './state.js';
import { promptText, norm } from './core.js';
const records = [];
let pending = null, unbind = [], epoch = 0;
const TYPES = ['normal', 'swipe', 'regenerate', 'continue'];
const MAX_TEXT = 500000;
export function requestRecords() { return records.filter(r => r.chatKey === chatKey()); }
export function clearRequests() { records.length = 0; pending = null; epoch++; }
export function syncRequests(on) {
    if (!on) { unbind.splice(0).forEach(fn => fn()); pending = null; epoch++; return; }
    if (unbind.length) return;
    const ctx = context(), bus = ctx.eventSource, types = ctx.eventTypes;
    const listen = (name, fn) => { if (!types[name]) return; bus.on(types[name], fn); unbind.push(() => bus.removeListener(types[name], fn)); };
    listen('CHAT_CHANGED', () => { pending = null; });
    listen('GENERATION_STARTED', (type, _options, dry) => {
        if (dry || isBusy()) return;
        // Other extensions may await asynchronous prompt edits. Run after their handlers.
        if (types.CHAT_COMPLETION_SETTINGS_READY) bus.makeLast?.(types.CHAT_COMPLETION_SETTINGS_READY, onChat);
        if (types.GENERATE_AFTER_DATA) bus.makeLast?.(types.GENERATE_AFTER_DATA, onText);
        pending = TYPES.includes(type) ? { id: crypto.randomUUID(), type, chatKey: chatKey(), time: Date.now(), wi: [], request: null } : null;
    });
    listen('WORLD_INFO_ACTIVATED', entries => {
        if (!pending || isBusy()) return;
        pending.wi = Array.from(entries || []).slice(0, 200).map(e => ({ title: String(e.comment || e.key?.join(', ') || '로어북 항목'), text: String(e.content || '') }));
    });
    const capture = (data, mode) => {
        if (!pending || isBusy() || !enabled('requestview') || pending.chatKey !== chatKey()) return;
        if (data.type && !TYPES.includes(data.type)) return;
        const current = pending, startedEpoch = epoch;
        // Event handlers may edit this object later in the same emit. Read at the next task boundary.
        setTimeout(() => {
            if (startedEpoch !== epoch || !enabled('requestview') || current.chatKey !== chatKey()) return;
            const messages = mode === 'chat' ? data.messages : [{ role: 'prompt', content: data.prompt }];
            if (!Array.isArray(messages) || !messages.length) return;
            let remaining = MAX_TEXT, clipped = false;
            const safe = messages.map(m => {
                const value = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map(p => p.type === 'text' ? p.text : '[이미지·비텍스트 첨부]').join('\n') : '[도구 호출·비텍스트 내용]';
                const content = value.slice(0, remaining); remaining -= content.length; clipped ||= content.length < value.length;
                return { role: String(m.role || 'unknown'), content };
            });
            const full = norm(promptText(safe));
            const matched = value => { const key = norm(value); return !!key && full.includes(key); };
            const live = context();
            const record = {
                ...current, request: safe, model: String(data.model || live.mainApi || ''), clipped,
                wi: current.wi.map(e => ({ ...e, text: e.text.slice(0, 10000), matched: matched(e.text) })),
                injections: Object.entries(live.extensionPrompts || {}).filter(([,v]) => v?.value).map(([name,v]) => ({ name, text: String(v.value).slice(0, 10000), matched: matched(v.value) })),
                history: live.chat.map((m, i) => ({ id: i, user: !!m.is_user, matched: matched(m.mes) })).filter(m => !live.chat[m.id]?.is_system),
            };
            const at = records.findIndex(r => r.id === record.id);
            if (at >= 0) records[at] = record; else records.unshift(record);
            records.splice(5);
            document.dispatchEvent(new Event('bl:request-recorded'));
        }, 0);
    };
    const onChat = data => capture(data, 'chat');
    const onText = (data, dry) => {
        if (!dry && context().mainApi !== 'openai' && typeof data?.prompt === 'string') capture(data, 'text');
    };
    listen('CHAT_COMPLETION_SETTINGS_READY', onChat);
    listen('GENERATE_AFTER_DATA', onText);
    listen('MESSAGE_RECEIVED', id => { if (pending) { pending.messageId = Number(id); const r = records.find(r => r.id === pending.id); if (r) r.messageId = Number(id); } });
    listen('GENERATION_ENDED', () => { pending = null; });
    listen('GENERATION_STOPPED', () => { pending = null; });
}
