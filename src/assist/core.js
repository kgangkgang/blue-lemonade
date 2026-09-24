export const IDS = ['conflicts'];
export const LABELS = { conflicts: '확장 충돌 진단' };
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const DUPLICATES = { order: 'panel-order', perf: 'perf-assist', words: 'word-replace', models: 'model-register', rewrite: 'ban-word-rewrite', bookmarks: 'chat-bookmarks' };
export function knownConflicts(names, disabled, addons) {
    const active = new Set(names.filter(n => !disabled.includes(n)).map(n => n.replace(/^third-party\//, '')));
    return Object.entries(DUPLICATES).filter(([id, name]) => addons[id] && active.has(name)).map(([id, name]) => ({ code: 'duplicate-' + id, level: '확인됨', text: `${name}: 내장 기능과 별도 확장이 함께 켜져 있어요. 내장 기능은 대기할 수 있어요.` }));
}
