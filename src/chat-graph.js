import { buildChatGraph, collectBranchHints } from './chat-graph-data.js';

const SVG = 'http://www.w3.org/2000/svg';
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const context = () => SillyTavern.getContext();
const statusLabel = { root: '시작', linked: '분기', unknown: '연결 미확인', 'missing-parent': '원래 채팅 없음', 'self-parent': '연결 확인 필요', cycle: '연결 확인 필요', 'invalid-parent': '연결 확인 필요', 'duplicate-conflict': '연결 확인 필요' };

// Iterative tree layout: deep branch chains cannot overflow the call stack.
export function layoutChatGraph(graph, width = 216, height = 104, { vertical = false, currentId = '' } = {}) {
    const gapX = vertical ? 18 : 66, gapY = vertical ? 42 : 28;
    const nodes = new Map(graph.nodes.map(n => [n.id, n])), positions = new Map(), trees = new Map();
    const roots = graph.roots.map(root => typeof root === 'string' ? root : root.id);
    const current = nodes.get(currentId) || graph.nodes.find(node => node.current);
    const focusRootId = current?.rootId || roots.find(id => nodes.get(id)?.children.length) || roots[0];
    if (roots.includes(focusRootId)) roots.splice(0, 0, ...roots.splice(roots.indexOf(focusRootId), 1));
    let offsetY = 0, totalWidth = width, totalHeight = height;
    for (const rootId of roots) {
        const local = new Map();
        let row = 0;
        const stack = [[rootId, false]];
        while (stack.length) {
            const [id, visited] = stack.pop(), node = nodes.get(id);
            if (!node || local.has(id)) continue;
            const children = node.children.filter(child => nodes.has(child));
            if (!visited && children.length) {
                stack.push([id, true]);
                for (let i = children.length - 1; i >= 0; i--) stack.push([children[i], false]);
                continue;
            }
            const childPositions = children.map(child => local.get(child)).filter(Boolean);
            const across = childPositions.length
                ? (childPositions[0][vertical ? 'x' : 'y'] + childPositions.at(-1)[vertical ? 'x' : 'y']) / 2
                : row++ * (vertical ? width + gapX : height + gapY);
            local.set(id, { x: vertical ? across : node.depth * (width + gapX), y: vertical ? node.depth * (height + gapY) : across, width, height });
        }
        let treeWidth = width, treeHeight = height;
        for (const [id, pos] of local) {
            treeWidth = Math.max(treeWidth, pos.x + width); treeHeight = Math.max(treeHeight, pos.y + height);
            positions.set(id, { ...pos, y: pos.y + offsetY });
        }
        trees.set(rootId, { x: 0, y: offsetY, width: treeWidth, height: treeHeight });
        totalWidth = Math.max(totalWidth, treeWidth); totalHeight = offsetY + treeHeight;
        // Unrelated roots form separate blocks below the current tree, never extra zoom-out pressure.
        offsetY += treeHeight + (vertical ? 64 : 54);
    }
    return { positions, trees, focusRootId, vertical, width: totalWidth, height: totalHeight };
}

function ownerFromContext(ctx) {
    const group = ctx.groupId ? ctx.groups?.find(g => String(g.id) === String(ctx.groupId)) : null;
    const character = ctx.characters?.[ctx.characterId];
    if (group) return { key: `group:${group.id}`, groupId: group.id, name: group.name || '그룹', ids: [...(group.chats || [])] };
    if (character) return { key: `character:${character.avatar}`, avatar: character.avatar, name: character.name || '채팅' };
    return null;
}
function dateLabel(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function createChatGraph(popup, showList) {
    const root = document.createElement('section');
    root.className = 'bl-chat-graph'; root.hidden = true;
    root.setAttribute('aria-label', '채팅 분기 지도');
    root.innerHTML = `<div class="bl-chat-graph-tools">
        <label class="bl-chat-graph-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" aria-label="지도에서 채팅 이름 찾기" placeholder="채팅 찾기" autocomplete="off"></label>
        <div class="bl-chat-graph-zoom"><button type="button" data-act="out" title="축소" aria-label="축소"><i class="fa-solid fa-minus" aria-hidden="true"></i></button><output>100%</output><button type="button" data-act="in" title="확대" aria-label="확대"><i class="fa-solid fa-plus" aria-hidden="true"></i></button></div>
        <button type="button" data-act="fit" title="전체 보기" aria-label="전체 보기"><i class="fa-solid fa-expand" aria-hidden="true"></i></button>
        <button type="button" data-act="current" title="현재 채팅으로" aria-label="현재 채팅으로"><i class="fa-solid fa-location-crosshairs" aria-hidden="true"></i></button>
        <button type="button" data-act="refresh" title="새로고침" aria-label="새로고침"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i></button>
    </div><div class="bl-chat-graph-viewport" tabindex="0" aria-label="채팅 분기 지도. 드래그 또는 방향키로 이동, 더하기와 빼기로 확대·축소">
        <div class="bl-chat-graph-stage"><svg aria-hidden="true"></svg><div class="bl-chat-graph-nodes"></div></div>
        <div class="bl-chat-graph-empty" hidden></div>
    </div><div class="bl-chat-graph-footer"><span class="bl-chat-graph-status" role="status"></span><span class="bl-chat-graph-hint">드래그로 이동 · 두 손가락으로 확대</span></div>
    <div class="bl-chat-graph-detail" hidden><div><b></b><span></span></div><button type="button" data-act="open">채팅 열기</button><button type="button" data-act="list" title="목록으로" aria-label="목록으로"><i class="fa-solid fa-list" aria-hidden="true"></i></button></div>`;
    popup.append(root);
    const $ = selector => root.querySelector(selector);
    const viewport = $('.bl-chat-graph-viewport'), stage = $('.bl-chat-graph-stage'), svg = $('svg'), nodesBox = $('.bl-chat-graph-nodes');
    const status = $('.bl-chat-graph-status'), empty = $('.bl-chat-graph-empty'), detail = $('.bl-chat-graph-detail'), search = $('input');
    let active = false, request = null, revision = 0, owner = null, currentId = '', selected = '', records = [], graph = null, layout = null;
    let scale = 1, tx = 24, ty = 24, ignoreClickUntil = 0, autoFit = true, opening = false, fitMode = 'focus', lastHints = [];
    const pointers = new Map();
    let gesture = null;

    function transform() {
        stage.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
        viewport.style.setProperty('--bl-chat-graph-grid', `${24 * scale}px`);
        viewport.style.setProperty('--bl-chat-graph-grid-x', `${tx}px`);
        viewport.style.setProperty('--bl-chat-graph-grid-y', `${ty}px`);
        $('output').textContent = `${Math.round(scale * 100)}%`;
    }
    function zoom(next, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
        next = clamp(next, .12, 2);
        tx = x - (x - tx) * next / scale; ty = y - (y - ty) * next / scale;
        scale = next; autoFit = false; transform();
    }
    function center(id, resetScale = false) {
        const pos = layout?.positions.get(id); if (!pos) return;
        if (resetScale) scale = clamp(Math.min(1, (viewport.clientWidth - 28) / pos.width, (viewport.clientHeight - 28) / pos.height), .12, 1);
        tx = (viewport.clientWidth - pos.width * scale) / 2 - pos.x * scale;
        ty = (viewport.clientHeight - pos.height * scale) / 2 - pos.y * scale;
        autoFit = false; transform();
    }
    function fit(initial = false) {
        if (!layout || !viewport.clientWidth || !viewport.clientHeight) return;
        fitMode = initial ? 'focus' : 'all';
        const bounds = initial ? layout.trees.get(layout.focusRootId) : null;
        const box = bounds || { x: 0, y: 0, width: layout.width, height: layout.height };
        const fitted = Math.min((viewport.clientWidth - 28) / box.width, (viewport.clientHeight - 28) / box.height, 1);
        const focus = layout.positions.has(currentId) ? currentId : layout.focusRootId;
        if (initial && fitted < .65 && layout.positions.has(focus)) { center(focus, true); return; }
        scale = clamp(fitted, .12, 1);
        tx = (viewport.clientWidth - box.width * scale) / 2 - box.x * scale;
        ty = (viewport.clientHeight - box.height * scale) / 2 - box.y * scale;
        autoFit = true; transform();
    }
    function select(id) {
        selected = id;
        const node = graph?.nodes.find(n => n.id === id), item = records.find(r => r.id === id);
        detail.hidden = !node;
        for (const button of nodesBox.children) button.setAttribute('aria-pressed', String(button.dataset.id === id));
        if (!node) return;
        detail.querySelector('b').textContent = node.label;
        detail.querySelector('b').title = id;
        const parent = node.parentId ? graph.nodes.find(n => n.id === node.parentId) : null;
        detail.querySelector('span').textContent = parent ? `${parent.label}에서 분기${Number.isInteger(node.branchMessageId) ? ` · #${node.branchMessageId}` : ''}` : statusLabel[node.status] || '';
        const button = detail.querySelector('[data-act="open"]');
        button.textContent = id === currentId ? '현재 채팅' : '채팅 열기';
        button.disabled = id === currentId || opening || !item;
    }
    function filter() {
        const query = search.value.trim().toLocaleLowerCase();
        let count = 0;
        for (const button of nodesBox.children) {
            const match = !query || button.textContent.toLocaleLowerCase().includes(query);
            button.classList.toggle('is-dim', !match); button.classList.toggle('is-match', !!query && match);
            if (match) count++;
        }
        if (query) status.textContent = `${count}개 찾음 · Enter로 이동`;
        else if (graph) status.textContent = `${graph.nodes.length}개 채팅 · ${graph.edges.length}개 연결`;
    }
    function draw(hints, initial = false) {
        lastHints = hints;
        graph = buildChatGraph(records, { currentId, branchHints: hints });
        nodesBox.replaceChildren(); svg.replaceChildren();
        // Size follows UI font settings; rows never clip larger or translated text.
        const em = parseFloat(getComputedStyle(root).fontSize) || 14;
        const vertical = viewport.clientWidth <= 600;
        root.dataset.layout = vertical ? 'vertical' : 'horizontal';
        const nodeWidth = vertical ? Math.max(144, em * 10.7) : Math.max(192, em * 15.4), nodeHeight = Math.max(104, em * 7.5);
        layout = layoutChatGraph(graph, nodeWidth, nodeHeight, { vertical, currentId });
        layout.fontSize = em;
        stage.style.width = `${layout.width}px`; stage.style.height = `${layout.height}px`;
        svg.setAttribute('width', String(layout.width)); svg.setAttribute('height', String(layout.height));
        for (const edge of graph.edges) {
            const a = layout.positions.get(edge.parentId), b = layout.positions.get(edge.childId); if (!a || !b) continue;
            const path = document.createElementNS(SVG, 'path');
            if (vertical) {
                const ax = a.x + a.width / 2, ay = a.y + a.height, bx = b.x + b.width / 2;
                path.setAttribute('d', `M${ax},${ay} C${ax},${ay + 21} ${bx},${b.y - 21} ${bx},${b.y}`);
            } else {
                const ax = a.x + a.width, ay = a.y + a.height / 2, by = b.y + b.height / 2;
                path.setAttribute('d', `M${ax},${ay} C${ax + 33},${ay} ${b.x - 33},${by} ${b.x},${by}`);
            }
            path.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(path);
        }
        const fragment = document.createDocumentFragment(), byId = new Map(records.map(record => [record.id, record]));
        for (const node of graph.nodes) {
            const pos = layout.positions.get(node.id); if (!pos) continue;
            const item = byId.get(node.id), button = document.createElement('button');
            button.type = 'button'; button.className = 'bl-chat-graph-node'; button.dataset.id = node.id;
            button.classList.toggle('is-current', node.current); button.title = node.id;
            button.style.cssText = `left:${pos.x}px;top:${pos.y}px;width:${pos.width}px;height:${pos.height}px`;
            const badge = document.createElement('span'); badge.className = 'bl-chat-graph-node-badge'; badge.textContent = node.current ? '현재 채팅' : statusLabel[node.status] || '채팅';
            const label = document.createElement('b'); label.textContent = node.label;
            const meta = document.createElement('span'); meta.className = 'bl-chat-graph-node-meta';
            meta.textContent = [Number.isFinite(node.messageCount) ? `${node.messageCount}개 메시지` : '', dateLabel(item?.lastMes)].filter(Boolean).join(' · ');
            button.append(badge, label, meta); fragment.append(button);
        }
        nodesBox.append(fragment); empty.hidden = graph.nodes.length > 0; empty.textContent = '저장된 채팅이 없어요.';
        filter(); select(graph.nodes.some(n => n.id === selected) ? selected : currentId);
        if (initial) fit(true); else transform();
    }
    async function post(url, body, signal) {
        const response = await fetch(url, { method: 'POST', headers: context().getRequestHeaders(), body: JSON.stringify(body), signal });
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const result = await response.json(); if (result?.error) throw Error('채팅 목록을 읽지 못했습니다'); return result;
    }
    async function refresh() {
        request?.abort(); const controller = new AbortController(); request = controller; const token = ++revision;
        const ctx = context(); owner = ownerFromContext(ctx); currentId = String(ctx.getCurrentChatId?.() || ctx.chatId || '');
        if (!active || !owner) return;
        const own = owner;
        const live = () => active && token === revision && !controller.signal.aborted && ownerFromContext(context())?.key === own.key;
        records = []; graph = null; layout = null; selected = currentId;
        nodesBox.replaceChildren(); svg.replaceChildren(); detail.hidden = true;
        empty.hidden = false; empty.textContent = '채팅 연결을 불러오는 중…'; status.textContent = '';
        root.setAttribute('aria-busy', 'true');
        try {
            const payload = await post(own.groupId ? '/api/chats/search' : '/api/characters/chats', own.groupId ? { query: '', group_id: own.groupId, avatar_url: null } : { avatar_url: own.avatar, metadata: true }, controller.signal);
            if (!live()) return;
            const list = Array.isArray(payload) ? payload : Object.values(payload || {});
            const allowed = own.groupId ? new Set(own.ids) : null;
            for (const item of list) {
                if (!item || typeof item !== 'object') continue;
                const id = own.groupId ? item.file_name : item.file_id ?? String(item.file_name || '').replace(/\.jsonl$/, '');
                if (typeof id !== 'string' || !id || (allowed && !allowed.has(id))) continue;
                const label = id.startsWith(own.name + ' - ') ? id.slice(own.name.length + 3) : id;
                records.push({ id, label, messageCount: item.message_count ?? item.chat_items, lastMes: item.last_mes, ...(!own.groupId && item.chat_metadata && typeof item.chat_metadata === 'object' && !Array.isArray(item.chat_metadata) ? { metadata: item.chat_metadata } : {}) });
            }
            const current = records.find(r => r.id === currentId);
            if (current) { current.metadata = ctx.chatMetadata || {}; current.messageCount = ctx.chat?.length ?? current.messageCount; }
            const hints = collectBranchHints(currentId, ctx.chat || []);
            draw(hints, true);
            if (own.groupId) {
                const queue = records.filter(record => record.id !== currentId); let index = 0, done = 0, failed = 0;
                const worker = async () => {
                    while (live() && index < queue.length) {
                        const record = queue[index++];
                        try {
                            const chat = await post('/api/chats/group/get', { id: record.id }, controller.signal);
                            if (!live()) return;
                            const header = Array.isArray(chat) ? chat.find(row => row && !('mes' in row) && row.chat_metadata) : null;
                            if (!header?.chat_metadata || typeof header.chat_metadata !== 'object' || Array.isArray(header.chat_metadata)) throw Error('채팅 연결 정보 없음');
                            record.metadata = header.chat_metadata;
                        } catch (error) { if (controller.signal.aborted) return; failed++; }
                        done++; status.textContent = `연결 확인 ${done}/${queue.length}`;
                    }
                };
                await Promise.all([worker(), worker()]);
                if (!live()) return;
                draw(hints, autoFit); if (failed) status.textContent += ` · ${failed}개 미확인, 새로고침으로 재시도`;
            }
        } catch (error) {
            if (!live()) return;
            empty.hidden = false; empty.textContent = '채팅 연결을 불러오지 못했어요. 새로고침하거나 목록으로 돌아가 주세요.';
            status.textContent = '불러오기 실패';
            console.warn('[블루 레몬에이드] 분기 지도', error);
        } finally { if (token === revision) root.removeAttribute('aria-busy'); }
    }
    async function openSelected() {
        const id = selected, target = owner, ctx = context();
        if (!id || opening || id === currentId || !records.some(r => r.id === id) || ownerFromContext(ctx)?.key !== target?.key) return;
        if (document.body.dataset.generating === 'true' || (typeof ctx.isGenerating === 'function' ? ctx.isGenerating() : ctx.isGenerating) === true) { globalThis.toastr?.info('응답이 끝난 뒤 채팅을 열어 주세요.'); return; }
        opening = true; select(id);
        try {
            await ctx.saveChat?.();
            if (ownerFromContext(context())?.key !== target.key) return;
            if (target.groupId) await ctx.openGroupChat(target.groupId, id); else await ctx.openCharacterChat(id);
            document.getElementById('select_chat_cross')?.click();
        } catch (error) { globalThis.toastr?.error('채팅을 열지 못했어요. 목록에서 다시 시도해 주세요.'); console.warn('[블루 레몬에이드] 분기 채팅 열기', error); }
        finally { opening = false; select(selected); }
    }
    root.addEventListener('click', event => {
        if (Date.now() < ignoreClickUntil) { event.preventDefault(); return; }
        const node = event.target.closest('.bl-chat-graph-node'); if (node) { select(node.dataset.id); return; }
        const action = event.target.closest('[data-act]')?.dataset.act;
        if (action === 'in') zoom(scale * 1.25);
        if (action === 'out') zoom(scale / 1.25);
        if (action === 'fit') fit();
        if (action === 'current') { select(currentId); center(currentId, true); }
        if (action === 'refresh') refresh();
        if (action === 'open') openSelected();
        if (action === 'list') showList();
    });
    search.addEventListener('input', filter);
    search.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        const matches = [...nodesBox.querySelectorAll('.is-match')]; if (!matches.length) return;
        const index = matches.findIndex(n => n.dataset.id === selected), node = matches[(index + 1) % matches.length];
        select(node.dataset.id); center(node.dataset.id, true);
    });
    viewport.addEventListener('keydown', event => {
        if (event.target !== viewport) return;
        const step = event.shiftKey ? 150 : 50;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            event.preventDefault(); autoFit = false;
            tx += event.key === 'ArrowLeft' ? step : event.key === 'ArrowRight' ? -step : 0;
            ty += event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0; transform();
        } else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(scale * 1.25); }
        else if (event.key === '-') { event.preventDefault(); zoom(scale / 1.25); }
        else if (event.key === 'Home') { event.preventDefault(); fit(); }
    });
    const point = event => { const r = viewport.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
    function beginGesture() {
        const ps = [...pointers.values()];
        gesture = ps.length > 1 ? { type: 'pinch', distance: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), scale, tx, ty, x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 } : ps.length ? { type: 'pan', x: ps[0].x, y: ps[0].y, tx, ty, moved: false } : null;
    }
    viewport.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        pointers.set(event.pointerId, point(event)); beginGesture();
        (event.target.closest('.bl-chat-graph-node') || viewport).setPointerCapture(event.pointerId);
    });
    viewport.addEventListener('pointermove', event => {
        if (!pointers.has(event.pointerId) || !gesture) return;
        pointers.set(event.pointerId, point(event)); const ps = [...pointers.values()];
        if (gesture.type === 'pinch' && ps.length > 1) {
            const distance = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y), next = clamp(gesture.scale * distance / Math.max(1, gesture.distance), .12, 2);
            const x = (ps[0].x + ps[1].x) / 2, y = (ps[0].y + ps[1].y) / 2;
            tx = x - (gesture.x - gesture.tx) * next / gesture.scale; ty = y - (gesture.y - gesture.ty) * next / gesture.scale; scale = next;
            ignoreClickUntil = Date.now() + 400;
        } else if (gesture.type === 'pan') {
            const dx = ps[0].x - gesture.x, dy = ps[0].y - gesture.y;
            if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
            gesture.moved = true; tx = gesture.tx + dx; ty = gesture.ty + dy; ignoreClickUntil = Date.now() + 400;
        }
        autoFit = false; transform();
    });
    const endPointer = event => { pointers.delete(event.pointerId); beginGesture(); };
    viewport.addEventListener('pointerup', endPointer); viewport.addEventListener('pointercancel', endPointer);
    viewport.addEventListener('wheel', event => {
        event.preventDefault(); const p = point(event);
        if (event.ctrlKey || event.metaKey) zoom(scale * Math.exp(-event.deltaY * .008), p.x, p.y);
        else { tx -= event.deltaX; ty -= event.deltaY; autoFit = false; transform(); }
    }, { passive: false });
    const observer = new ResizeObserver(() => {
        if (!active || !layout || !viewport.clientWidth) return;
        const em = parseFloat(getComputedStyle(root).fontSize) || 14;
        if (layout.vertical !== (viewport.clientWidth <= 600) || layout.fontSize !== em) draw(lastHints, true);
        else if (autoFit) fit(fitMode === 'focus');
    }); observer.observe(viewport);
    return {
        show() { active = true; root.hidden = false; refresh(); },
        hide() { active = false; revision++; request?.abort(); root.hidden = true; root.removeAttribute('aria-busy'); pointers.clear(); gesture = null; },
        refresh,
    };
}
