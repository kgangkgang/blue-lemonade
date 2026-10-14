// 모델 전환 6.4.6 목록 규칙 — 꺼진 대체 모델도 보이되, 확인·설정을 거치기 전에는 일괄 변경에 포함하지 않는다.
//  · 고르기 단추 둘: 「전체」 = 일반 줄 · 「검열되면」 = 보이는 「(검열되면)」 줄 — 그 줄들이 모두 켜져 있으면 모두 끄고, 아니면 모두 켠다
const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);

/** id 가 「<본 id>-fallback」 인 대상 (아는 확장 · 스스로 등록한 확장 모두) */
export const isFallbackRow = target => String(target?.id ?? '').endsWith('-fallback');

/** fallback 칸 { enabled, provider, model } 이 켜져 있나 */
export const fallbackOn = fb => isObj(fb) && fb.enabled !== false && !!String(fb.provider ?? '').trim() && !!String(fb.model ?? '').trim();

/** 실제로 사용하는 대상인가. 꺼진 대체 모델은 표시와 별개로 변경 대상에서 제외한다. */
export function rowActive(target) {
    if (!isFallbackRow(target)) return true;
    if (typeof target.active === 'function') { try { return !!target.active(); } catch { return false; } }
    let now = null;
    try { now = target.read?.(); } catch { now = null; }
    return isObj(now) && !now.follow && !!String(now.source ?? '').trim() && !!String(now.model ?? '').trim();
}

export const rowShown = target => !!target;

/** 보일 줄만 (차례 그대로) */
export const visibleRows = list => (Array.isArray(list) ? list : []).filter(rowShown);

const nameOrder = (a, b) => String(a).localeCompare(String(b), 'ko', { numeric: true });
const parentOf = (row, parent) => {
    const id = String(row.id).replace(/-fallback$/, ''), bare = id.replace(/^ext:/, '');
    return [String(parent.id), String(parent.id).replace(/^ext:/, ''), parent.folder].includes(id) || [String(parent.id), parent.folder].includes(bare);
};
/** 그룹은 등록 메타데이터만 사용한다. 대체 모델은 본 대상의 그룹·정렬 위치를 따른다. */
export function displayGroups(list) {
    const blocks = [], units = [], grouped = new Map();
    for (const target of visibleRows(list)) {
        const previous = blocks.at(-1);
        if (isFallbackRow(target) && previous && !isFallbackRow(previous.target) && parentOf(target, previous.target)) previous.rows.push(target);
        else blocks.push({ target, rows: [target] });
    }
    for (const block of blocks) {
        const group = block.target.group;
        if (!isObj(group) || !String(group.id || '').trim() || !String(group.name || '').trim()) {
            units.push({ id: `target:${block.target.id}`, name: block.target.name, main: block.rows, children: [] }); continue;
        }
        const key = String(group.id);
        if (!grouped.has(key)) { const unit = { id: `group:${key}`, name: String(group.name), blocks: [] }; grouped.set(key, unit); units.push(unit); }
        grouped.get(key).blocks.push(block);
    }
    for (const unit of grouped.values()) {
        const order = (a, b) => (Number(a.target.group.order) || 0) - (Number(b.target.group.order) || 0) || nameOrder(a.target.name, b.target.name);
        const primary = unit.blocks.find(block => block.target.group.primary === true) || [...unit.blocks].sort(order)[0];
        unit.name = String(primary.target.group.name); unit.main = primary.rows;
        unit.children = unit.blocks.filter(block => block !== primary).sort(order).flatMap(block => block.rows);
        delete unit.blocks;
    }
    return units.sort((a, b) => nameOrder(a.name, b.name));
}
export const orderedRows = list => displayGroups(list).flatMap(group => [...group.main, ...group.children]);

/**
 * 고르기 단추: group 'main'(일반 줄) · 'fallback'(「(검열되면)」 줄) — rows 는 보이는 줄.
 * 그 묶음이 모두 켜져 있으면 모두 끄고, 아니면 모두 켠다 → 바꿀 값 { [id]: true|false } (빈 묶음이면 {})
 */
export function toggleGroup(rows, group, isOn) {
    const pick = (Array.isArray(rows) ? rows : []).filter(target => rowActive(target) && (group === 'fallback') === isFallbackRow(target));
    if (!pick.length) return {};
    const allOn = pick.every(target => isOn(target));
    return Object.fromEntries(pick.map(target => [target.id, !allOn]));
}

/** 그 묶음이 지금 모두 켜져 있나 (단추 눌림 표시) — 빈 묶음이면 false */
export function groupOn(rows, group, isOn) {
    const pick = (Array.isArray(rows) ? rows : []).filter(target => rowActive(target) && (group === 'fallback') === isFallbackRow(target));
    return pick.length > 0 && pick.every(target => isOn(target));
}
