// 1.0.0 설정창 간단화(10-31 사용자 「테마 설정창 내부 설정들도 다 좀 간단화시켜 줘」)
//   ① 화면마다 맨 아래 「고급」 접힘 하나 — 세부 조정 · 거의 안 바꾸는 것을 그 안으로 옮겨요(기본 접힘).
//      설정 키 · 저장 값 · 화면 id 는 그대로예요. 옮기는 것은 그려진 줄(DOM)뿐이라 검색 · 바로 가기 · 되돌리기 · 즐겨찾기가 그대로 찾아요.
//      접힘은 data-md-fold 라 다시 그려도 열린 상태가 이어지고, 검색 · 「변경한 설정」 바로 가기로 오면 저절로 펼쳐져요(panel.js navigate · jumpToSetting).
//   ② 한 줄을 넘는 설명은 묶음 제목 옆 ? 하나(H3)로 모아요 — 누르면 도움말 시트(help-sheet.js, 월드인포 ? 와 같은 창).
//      상태를 알리는 글(「지금 …」 · 다른 확장이 쉬게 한다는 알림 · 경고)은 그 자리에 남겨요.

/** 화면(route) → 「고급」으로 옮길 것. 'group:<묶음 이름>' = 묶음 통째, 'sel:<CSS>' = 그 요소, 'color:<토큰>' = 색 줄, 그 밖 = 설정 키(그 줄) */
export const ADVANCED = {
    'theme/colors': ['sel:.salty-group:has(> .salty-label[data-search-anchor="가독성 확인"])', 'color:muted', 'color:faint', 'color:shadow'],
    'theme/backup': ['sel:.salty-group:has(> .salty-label[data-search-anchor="최근 꾸미기 복구함"])', 'sel:.bl-setting-locks'],
    'text/text': ['fonts.hanja'],
    'text/dialogue': ['dialogue.tilt', 'dialogue.markerPos', 'dialogue.markerThick', 'dialogue.weight', 'dialogue.letterSpacing'],
    'text/ui': ['ui.weight', 'ui.letterSpacing'],
    'text/em': ['em.weight', 'em.letterSpacing'],
    'text/strike': ['strike.thickness'],
    'text/strong': ['strong.weight', 'strong.letterSpacing'],
    'text/code': ['code.weight', 'code.letterSpacing'],
    'text/shadow': ['shadow.angle', 'shadow.distance', 'shadow.blur'],
    'chat/profile': ['group:장식 액자', 'group:테두리', 'group:흐림 · 투명도'],
    'chat/user-profile': ['group:장식 액자', 'group:테두리', 'group:흐림 · 투명도'],
    'chat/name': ['profile.nameHeight', 'profile.nameOutline', 'profile.nameOutlineColor', 'profile.nameShadow', 'profile.nameShadowY', 'profile.nameShadowBlur', 'profile.nameShadowAlpha', 'profile.headerGap', 'profile.buttonGap', 'profile.metaOpacity'],
    'chat/user-name': ['userProfile.nameHeight', 'userProfile.nameOutline', 'userProfile.nameOutlineColor', 'userProfile.nameShadow', 'userProfile.nameShadowY', 'userProfile.nameShadowBlur', 'userProfile.nameShadowAlpha', 'userProfile.headerGap', 'userProfile.buttonGap', 'userProfile.metaOpacity'],
    'chat/screen': ['sel:.salty-row[data-search-anchor="새로고침 화면"]', 'sel:.salty-row[data-search-anchor="탭 아이콘"]', 'sel:.salty-row[data-search-anchor="홈 화면 아이콘"]', 'chat.selectPop', 'chat.colorPop', 'chat.numComma', 'chat.showMoreAuto', 'chat.chatLight', 'chat.personaDefer', 'chat.sentTokens', 'chat.webSearchMarks', 'chat.personaTall', 'chat.streamFade', 'st.streamFadeIn', 'chat.hiddenGray', 'chat.hiddenHover', 'chat.reasoningFollow', 'group:가볍게',
        'chat.qrCtxNames', 'chat.qrFind',
        'chat.weatherAutoRest', 'chat.weatherReadability', 'sceneSound.thunder', 'sceneSound.background', 'chat.weatherBubble', 'sel:.salty-group:has(> .salty-stack [data-path="chat.weatherColorMode"])'],
    'chat/etc': ['group:다른 CSS', 'group:확장 탭', 'group:진단'],   // 1.0.0 되살린 진단(복사 · 파일)도 고급으로
    'image/frame': ['image.edgeStyle', 'image.edgeSideTop', 'image.edgeGap', 'image.edgeGlow', 'image.edgeGlowAlpha', 'image.edgeSecondGap', 'image.edgeSecondAlpha', 'image.edgeShadowX', 'image.edgeShadowY', 'image.edgeShadowBlur', 'image.edgeShadowSpread'],
    'image/cutedge': ['group:외곽선', 'group:그림자 · 빛', 'group:그리는 범위'],
    'prompt/deus': ['chat.demFold', 'chat.regexIcons', 'group:톤 값', 'deus.ink.outline.alpha', 'deus.ink.shadow.alpha', 'deus.ink.shadow.angle', 'deus.ink.shadow.distance', 'deus.ink.shadow.blur', 'deus.fx.flow', 'deus.fx.flowMode', 'deus.fx.force'],
};

/** 설정 키가 고급 안에 있는 화면이면 그 route (시험 · 측정용) */
export function advancedRouteOf(path) {
    for (const [route, list] of Object.entries(ADVANCED)) if (list.includes(path)) return route;
    return null;
}

const ROW = '.salty-sizeopt,.bl-color-field,.salty-slider,.salty-row,.salty-stack';
function findItem(section, spec) {
    if (spec.startsWith('sel:')) { try { return section.querySelector(spec.slice(4)); } catch { return null; } }
    const control = spec.startsWith('color:')
        ? section.querySelector(`toolcool-color-picker[data-token="${CSS.escape(spec.slice(6))}"]`)
        : section.querySelector(['data-toggle', 'data-path', 'data-range', 'data-num', 'data-color-path'].map(a => `[${a}="${CSS.escape(spec)}"]`).join(','));
    if (!control) return null;
    // 크기 고르기(.salty-sizeopt) · 색 칸(.bl-color-field) 안의 줄은 바깥 틀째로
    return control.closest('.salty-sizeopt') || control.closest('.bl-color-field') || control.closest('.salty-slider,.salty-row,.salty-stack');
}

function foldFor(host, route, index) {
    let fold = host.querySelector(':scope > details.bl-advanced');
    if (fold) return fold;
    fold = document.createElement('details');
    fold.className = 'bl-md-group bl-advanced';
    fold.dataset.mdFold = `adv:${route}:${index}`;
    fold.innerHTML = '<summary><span>고급</span><small></small></summary><div class="bl-advanced-body"></div>';
    host.append(fold);
    return fold;
}

/**
 * 「고급」으로 옮겨요. groups: arrangeEditor 가 만든 맨 위 묶음들(순서대로). chipped: 칩 화면인지.
 * 돌려줌: 옮긴 뒤 맨 위에 남은 묶음 목록(통째로 옮긴 묶음은 빠져요)
 */
export function applyAdvanced(section, groups, route, chipped) {
    const list = ADVANCED[route];
    if (!list) return groups;
    const top = new Set(groups);
    const moves = [];
    for (const spec of list) {
        if (spec.startsWith('group:')) {
            const g = groups.find(x => x.dataset.group === spec.slice(6));
            if (g) moves.push({ whole: g });
            continue;
        }
        const item = findItem(section, spec);
        if (!item || moves.some(m => m.item === item || m.item?.contains(item))) continue;
        moves.push({ item, group: item.closest('.bl-editor-group') });
    }
    if (!moves.length) return groups;
    const hostOf = group => {
        if (!chipped) return { host: section, index: 0 };
        const i = groups.indexOf(group);
        return { host: group.querySelector(':scope > .bl-editor-group-body'), index: i };
    };
    const wrappers = new Map();
    let left = groups;
    for (const m of moves) {
        if (m.whole) {
            // 칩 화면: 그 묶음 칩을 없애고 바로 앞 묶음의 고급 안으로 · 아니면 화면 맨 아래 고급 안으로
            const before = groups[Math.max(0, groups.indexOf(m.whole) - 1)];
            const { host, index } = hostOf(before === m.whole ? groups.find(g => g !== m.whole) : before);
            if (!host) continue;
            const fold = foldFor(host, route, index);
            fold.querySelector('.bl-advanced-body').append(m.whole);
            m.whole.hidden = false;
            left = left.filter(g => g !== m.whole);
            continue;
        }
        const src = m.group;
        const { host, index } = hostOf(src && top.has(src) ? src : groups.find(g => g.contains(m.item)) || groups[0]);
        if (!host) continue;
        const fold = foldFor(host, route, index);
        const body = fold.querySelector('.bl-advanced-body');
        // 같은 묶음 · 같은 틀(.salty-group 의 모양 클래스)에서 온 줄은 한 칸에 모아요 — 2열 격자 같은 모양이 그대로
        const parent = m.item.parentElement;
        const shape = parent?.classList.contains('salty-group') ? parent.className : 'salty-group';
        const key = `${src?.dataset.group || ''}|${shape}`;
        let wrap = wrappers.get(key);
        if (!wrap) {
            let box = body;
            if (!chipped && src) {
                // 화면 맨 아래 고급: 어느 묶음에서 왔는지 작은 제목(이름 있는 묶음만)
                box = [...body.querySelectorAll(':scope > .bl-editor-group')].find(g => g.dataset.group === src.dataset.group && g.dataset.advFrom);
                if (!box) {
                    const g = document.createElement('div'); g.className = 'bl-editor-group'; g.dataset.group = src.dataset.group; g.dataset.advFrom = '1';
                    if (src.querySelector(':scope > .bl-editor-group-head')) { const h = document.createElement('h4'); h.className = 'bl-editor-group-head'; h.textContent = src.dataset.group; g.append(h); }
                    const b = document.createElement('div'); b.className = 'bl-editor-group-body'; g.append(b); body.append(g);
                    box = g;
                }
                box = box.querySelector(':scope > .bl-editor-group-body');
            }
            wrap = document.createElement('div'); wrap.className = shape;
            box.append(wrap); wrappers.set(key, wrap);
        }
        // 바로 뒤에 붙은 설명 줄은 그 줄의 것 — 같이 옮겨요
        const notes = [];
        for (let n = m.item.nextElementSibling; n?.matches('.salty-note'); n = n.nextElementSibling) notes.push(n);
        wrap.append(m.item, ...notes);
    }
    // 비어 버린 틀 · 묶음은 치워요(제목만 남는 일 없게)
    for (const g of section.querySelectorAll('.salty-group')) if (!g.children.length && !g.textContent.trim()) g.remove();
    for (const g of [...left]) {
        const b = g.querySelector(':scope > .bl-editor-group-body');
        if (b && !b.children.length) { g.remove(); left = left.filter(x => x !== g); }
    }
    for (const fold of section.querySelectorAll('details.bl-advanced')) {
        const n = [...fold.querySelectorAll('.salty-row,.salty-stack,.salty-slider,.salty-sizeopt')].filter(r => !r.parentElement.closest('.salty-sizeopt')).length;
        fold.querySelector(':scope > summary > small').textContent = n ? `${n}개` : '';
    }
    return left;
}

// ───────── 긴 설명 → 묶음 제목 옆 ? ─────────
const LIMIT = 22;   // 폰 384 에서 설명 글(보조 13px) 한 줄 ≈ 22자
const KEEP = '.bl-rest-note,.bl-css-touch,[role="alert"],[data-keep-note],a,button,input,select';
const text = el => el.textContent.replace(/\s+/g, ' ').trim();
const isState = t => /^지금|^이 기기|꺼져 있어서|켜져 있어서/.test(t);   // 지금 상태를 알리는 글만 — 다른 확장이 쉬게 한다는 알림은 .bl-rest-note 로 따로 남겨요

/** 한 묶음의 긴 설명을 걷어 { list:[[이름, 설명]], body:[문단] } 로. 걷은 게 없으면 null */
function collectHelp(group) {
    const list = [], body = [];
    for (const small of group.querySelectorAll('.salty-row > span > small, .salty-stack > span > small')) {
        if (small.closest('.bl-editor-group') !== group) continue;   // 안쪽 묶음(고급 안)의 설명은 그 묶음이 맡아요
        const keep = small.querySelector('.bl-rest-note');
        const clone = small.cloneNode(true); clone.querySelector('.bl-rest-note')?.remove();
        const t = text(clone).replace(/\s*·\s*$/, '');
        if (t.length <= LIMIT || isState(t)) continue;
        const label = text(small.parentElement).replace(text(small), '').replace(/↺/g, '').trim();
        list.push([label, t]);
        if (keep) { small.textContent = ''; small.append(keep); keep.textContent = keep.textContent.replace(/^\s*·\s*/, ''); }
        else small.remove();
    }
    for (const note of group.querySelectorAll('.salty-note')) {
        if (note.closest('.bl-editor-group') !== group || note.closest('details:not(.bl-advanced)')) continue;
        const t = text(note);
        if (t.length <= LIMIT || isState(t) || note.querySelector(KEEP) || note.matches(KEEP)) continue;
        body.push(t); note.remove();
    }
    return list.length || body.length ? { list, body } : null;
}

/** 묶음마다 긴 설명을 ? 하나로. 제목이 안 보이는 묶음(첫 묶음 · 칩 화면)은 작은 제목 줄을 만들어 ? 를 달아요 */
export function moveLongNotes(root, section, route, title, chipped) {
    const helps = [];
    for (const group of section.querySelectorAll('.bl-editor-group')) {
        const help = collectHelp(group);
        if (!help) continue;
        let head = group.querySelector(':scope > .bl-editor-group-head');
        const hiddenHead = !head || (chipped && group.parentElement === section);
        if (hiddenHead) {
            head = document.createElement('div'); head.className = 'bl-editor-group-head bl-help-head';
            head.textContent = chipped && group.parentElement === section && group.querySelector(':scope > .bl-editor-group-head') ? group.dataset.group : title;
            group.querySelector(':scope > .bl-editor-group-body')?.prepend(head);
        }
        const name = text(head);
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'bl-help-btn'; button.dataset.act = 'group-help'; button.dataset.help = String(helps.length);
        button.setAttribute('aria-label', `${name} 설명`); button.innerHTML = '<i class="fa-solid fa-question" aria-hidden="true"></i>';
        head.append(button);
        helps.push({ title: name, ...help });
    }
    root._groupHelp = helps;
}

/** 설정 키 없이 화면으로 오는 검색 항목(예: 「설정 일부 잠그기」)이 「고급」 안 줄을 가리키면 그 접힘을 펼쳐요.
 *  words: 검색 항목의 낱말들 — 고급 안 줄 이름의 낱말이 모두 들어 있으면 그 줄을 찾는 것으로 봐요. 펼친 첫 줄을 돌려줘요 */
export function openFoldsFor(root, words) {
    const set = new Set((words || []).map(w => String(w).toLowerCase()));
    let first = null;
    for (const fold of root.querySelectorAll('.salty-sec details.bl-advanced')) {
        if (!fold.closest('.bl-editor-group[hidden]') && fold.open) continue;
        for (const row of fold.querySelectorAll('.salty-row,.salty-stack,.salty-slider')) {
            const label = row.querySelector(':scope > span,:scope > header > span')?.childNodes[0]?.textContent || '';
            const parts = label.toLowerCase().split(/[\s·()「」,]+/).filter(Boolean);
            if (!parts.length || !parts.every(p => set.has(p))) continue;
            fold.open = true; first ??= row; break;
        }
    }
    return first;
}
