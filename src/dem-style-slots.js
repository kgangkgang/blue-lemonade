// 분리된 규칙을 원래 미디어 칸에 넣어요. 시트 자체의 켬/끔과 규칙 순서는 바꾸지 않아요.
const SLOT = /^#bl-dem-slot-([a-z0-9-]+-[0-9a-f]{16})$/;
export function createDemStyleSlots() {
    const scans = new WeakMap(), installed = new WeakSet();
    function find(sheet) {
        if (scans.has(sheet)) return scans.get(sheet);
        const slots = [];
        const walk = rules => {
            for (const rule of rules) {
                if (!rule.cssRules) continue;
                const id = rule.media && SLOT.exec(rule.cssRules[0]?.selectorText || '')?.[1];
                if (id) slots.push({ rule, id }); else walk(rule.cssRules);
            }
        };
        walk(sheet.cssRules || []); scans.set(sheet, slots); return slots;
    }
    const slotsOf = sheets => [...new Set(sheets)].filter(Boolean).flatMap(find);
    return {
        needed(sheets) { return slotsOf(sheets).filter(({ rule }) => !installed.has(rule)).map(({ id }) => id); },
        apply(sheets, enabled, payload = {}) {
            const slots = slotsOf(sheets), pending = enabled ? slots.filter(({ rule }) => !installed.has(rule)) : [];
            // 파일 버전이 어긋났으면 어느 칸도 쓰기 전에 멈춰요.
            for (const { id } of pending) if (!Array.isArray(payload[id]?.rules) || !payload[id].rules.length || payload[id].rules.some(text => typeof text !== 'string' || !text.trim())) throw Error(`데우스 시트 내용이 어긋났어요: ${id}`);
            const changed = [];
            try {
                for (const { rule, id } of pending) {
                    const entry = { rule, count: 0 }; changed.push(entry);
                    for (const text of payload[id].rules) { rule.insertRule(text, rule.cssRules.length); entry.count++; }
                }
            } catch (error) {
                for (const entry of changed.reverse()) while (entry.count-- > 0) entry.rule.deleteRule(entry.rule.cssRules.length - 1);
                throw error;
            }
            for (const { rule } of changed) installed.add(rule);
            const media = enabled ? 'all' : 'not all';
            for (const { rule } of slots) if (rule.media.mediaText !== media) rule.media.mediaText = media;
            return slots.length;
        },
    };
}
