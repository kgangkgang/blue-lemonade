// 북마크 — 패널 안의 설정 화면
import { VERSION, hooks, settings, saveSettings, baseColors, colorsFor, hasOwnColors, applyColors, parseColorCode, DEFAULT_COLORS, chatKey, iconName, themeColors } from './state.js';

const COLOR_FIELDS = [
    ['accent', '포인트 색', 'AI 메시지 리본·대사 색, 선택한 채팅, 버튼'],
    ['user', '유저 색', '유저 메시지 리본·대사 색, 앞뒤 문맥 창의 유저 말풍선'],
    ['icon', '아이콘 색', '채팅 메시지에 붙는 북마크 아이콘'],
];

function segmented(name, options, value) {
    return `<div class="cg-segmented" data-setting="${name}" role="radiogroup">
        ${options.map(([optionValue, label, icon]) => `
            <button type="button" role="radio" data-value="${optionValue}" aria-checked="${optionValue === value}" class="${optionValue === value ? 'is-active' : ''}">
                ${icon ? `<i class="fa-solid ${icon}"></i>` : ''}<span>${label}</span>
            </button>`).join('')}
    </div>`;
}

function stepper(name, min, max, value) {
    return `<div class="cg-stepper" data-setting="${name}" data-min="${min}" data-max="${max}">
        <button type="button" data-step="-1" aria-label="줄이기"><i class="fa-solid fa-minus"></i></button>
        <input type="number" inputmode="numeric" min="${min}" max="${max}" value="${value}" aria-label="값">
        <button type="button" data-step="1" aria-label="늘리기"><i class="fa-solid fa-plus"></i></button>
    </div>`;
}

// 아이콘이 null이면 지금 고른 메시지 아이콘(별/북마크)을 쓴다.
const GUIDE = [
    [null, '북마크 달기', '메시지의 북마크 아이콘을 누르면 북마크가 생기고, 다시 누르면 없어져요. <b>길게 누르면</b>(PC는 우클릭) 메모를 바로 쓸 수 있어요.'],
    ['fa-wand-magic-sparkles', '목록 열기', '입력창 왼쪽 마법봉 메뉴 → <b>북마크</b>'],
    ['fa-comments', '채팅 고르기', '같은 캐릭터의 다른 채팅 북마크도 볼 수 있어요. 넓은 화면은 왼쪽 목록, 좁은 화면은 왼쪽 위 <i class="fa-solid fa-bars-staggered"></i> 버튼을 누르세요.'],
    ['fa-magnifying-glass', '검색', '메시지와 메모를 함께 찾아요. <b>메모만</b>을 켜면 메모에서만 찾아요.'],
    ['fa-eye', '채팅에서 보기', '그 메시지 주변 대화를 채팅 화면에 잠깐 불러와요. 아래 막대에서 목록으로 돌아가거나 끝낼 수 있어요.'],
    ['fa-layer-group', '앞뒤 문맥', '작은 창에서 앞뒤 메시지를 보여 줘요. 창 위의 −/+로 범위를 바로 바꿀 수 있어요.'],
    ['fa-pen-to-square', '원문 수정', '메시지 원문을 직접 고쳐요. <b>채팅 기록이 바뀌니</b> 조심하세요.'],
    ['fa-language', '번역', '카드의 <b>번역</b>을 누르면 번역하기·직접 고치기·지우기가 나와요. 번역은 <b>LLM 번역기</b> 확장의 모델·프롬프트 설정을 그대로 쓰고, 번역문은 채팅 화면과 같은 자리에 저장돼서 그 채팅을 열어도 똑같이 보여요. 다른 채팅의 북마크도 번역할 수 있어요.'],
    ['fa-arrows-rotate', '메시지 번호가 바뀌면', '메시지를 지우거나 끼워 넣거나 옮겨도 북마크가 그 메시지를 따라가요. 지운 메시지의 북마크는 함께 사라져요.'],
    ['fa-box-archive', '데이터', '이전 <b>채팅 북마크</b> 확장과 같은 곳(각 채팅 파일)에 저장해서 기존 북마크가 그대로 보여요. 두 확장을 같이 켜면 아이콘이 두 개 생기니 이전 확장은 꺼 주세요.'],
];

// 설정 화면이 들어가는 칸(.cg-settings-page)은 패널과 함께 계속 남아 있다. 열 때마다 그 칸에 클릭 리스너를 붙이면 쌓여서
// 스위치가 여는 횟수만큼 뒤집히고(짝수면 안 바뀐 것처럼 보임) +가 여러 칸 오르고, 예전 화면의 '색 저장'이 그때 보던 채팅에 다시 저장된다.
// 그래서 칸에 붙이는 리스너는 이것으로 묶어 두고, 새로 그리거나 닫을 때 뗀다.
let pageListeners = null;

export function disposeSettingsPage() {
    pageListeners?.abort();
    pageListeners = null;
}

/**
 * @param {HTMLElement} page 설정 화면이 들어갈 자리
 * @param {{ key: string, label: string }|null} viewingChat 패널에서 보고 있는 채팅 (색 설정 '이 채팅에만'의 대상)
 * @param {() => void} onBack
 */
export function renderSettingsPage(page, viewingChat, onBack) {
    disposeSettingsPage();
    pageListeners = new AbortController();
    const { signal } = pageListeners;
    const store = settings();
    const chat = viewingChat?.key ? viewingChat : null;
    let colorScope = chat ? 'chat' : 'default';
    const scopeColors = () => (colorScope === 'chat' ? colorsFor(chat.key) : baseColors());

    page.innerHTML = `
        <header class="cg-page-head">
            <button type="button" class="cg-icon-btn" data-act="back" title="뒤로" aria-label="뒤로"><i class="fa-solid fa-arrow-left"></i></button>
            <div class="cg-page-title">설정</div>
        </header>
        <div class="cg-page-scroll">
            <section class="cg-section">
                <h3 class="cg-section-title"><i class="fa-solid fa-palette"></i>모양</h3>
                <div class="cg-setting" data-manual ${store.followTheme ? 'hidden' : ''}>
                    <div class="cg-setting-text"><b>테마</b><small>자동은 지금 실리태번 테마의 글자색·배경색을 그대로 써요. 밝게·어둡게는 대사 색이 아래 색상 설정을 따라요.</small></div>
                    ${segmented('theme', [['auto', '자동', 'fa-wand-magic-sparkles'], ['light', '밝게', 'fa-sun'], ['dark', '어둡게', 'fa-moon']], store.theme)}
                </div>
                <div class="cg-setting">
                    <div class="cg-setting-text"><b>메시지 아이콘</b><small>채팅 메시지 오른쪽 위에 붙는 아이콘 모양</small></div>
                    ${segmented('iconStyle', [['bookmark', '북마크', 'fa-bookmark'], ['star', '별', 'fa-star']], store.iconStyle)}
                </div>
                <div class="cg-setting">
                    <div class="cg-setting-text"><b>긴 메시지 접기</b><small>목록에서 긴 메시지를 접어 두고 '전체 보기'로 펼쳐요.</small></div>
                    <button type="button" class="cg-switch" role="switch" data-setting="collapseLong" aria-checked="${store.collapseLong}"><span></span></button>
                </div>
            </section>

            <section class="cg-section">
                <h3 class="cg-section-title"><i class="fa-solid fa-masks-theater"></i>데우스 엑스 마키나</h3>
                <div class="cg-setting">
                    <div class="cg-setting-text"><b>본문만 보기</b><small>카드에 본문만 보여요. 끄면 장면 계획 · 트래커 같은 정규식 카드도 같이 보여요.</small></div>
                    <button type="button" class="cg-switch" role="switch" data-setting="deusProseOnly" aria-checked="${store.deusProseOnly !== false}"><span></span></button>
                </div>
            </section>

            <section class="cg-section">
                <h3 class="cg-section-title"><i class="fa-solid fa-droplet"></i>색상</h3>
                <div class="cg-setting">
                    <div class="cg-setting-text"><b>블루 레몬에이드 따라가기</b><small>테마와 색을 지금 에이드에 맞춰요. 테마를 끄면 직접 고른 색을 써요.</small></div>
                    <button type="button" class="cg-switch" role="switch" data-setting="followTheme" aria-checked="${store.followTheme}"><span></span></button>
                </div>
                <div class="cg-color-manual" data-manual ${store.followTheme ? 'hidden' : ''}>
                <p class="cg-section-desc">색 코드(<code>#51a0de</code>)나 RGB(<code>81, 160, 222</code>)를 입력하거나 동그라미를 눌러 고르세요. 바꾸는 대로 미리 보여요.</p>
                ${chat ? segmented('colorScope', [['chat', '이 채팅에만', 'fa-comment'], ['default', '기본 색', 'fa-layer-group']], colorScope) : ''}
                <p class="cg-scope-note"></p>
                <div class="cg-color-list">
                    ${COLOR_FIELDS.map(([key, label, description]) => `
                        <div class="cg-color-row">
                            <label class="cg-swatch" title="색 선택기로 고르기">
                                <input type="color" data-color-swatch="${key}">
                                <span></span>
                            </label>
                            <div class="cg-color-text"><b>${label}</b><small>${description}</small></div>
                            <input type="text" class="cg-input cg-color-code" data-color-key="${key}" placeholder="#51a0de"
                                autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
                        </div>`).join('')}
                </div>
                <div class="cg-section-actions">
                    <button type="button" class="cg-btn cg-btn--ghost" data-act="color-reset"><i class="fa-solid fa-rotate-left"></i><span>되돌리기</span></button>
                    <button type="button" class="cg-btn cg-btn--primary" data-act="color-save"><i class="fa-solid fa-check"></i><span>색 저장</span></button>
                </div>
                </div>
            </section>

            <section class="cg-section">
                <h3 class="cg-section-title"><i class="fa-solid fa-list"></i>목록</h3>
                <div class="cg-setting">
                    <div class="cg-setting-text"><b>한 페이지에 보여 줄 북마크</b><small>1~50개. 너무 많으면 여는 속도가 느려져요.</small></div>
                    ${stepper('itemsPerPage', 1, 50, store.itemsPerPage)}
                </div>
                <div class="cg-setting">
                    <div class="cg-setting-text"><b>앞뒤 문맥 범위</b><small>앞뒤 문맥 창에서 앞뒤로 몇 개씩 보여 줄지 (0이면 그 메시지만)</small></div>
                    ${stepper('contextRange', 0, 10, store.contextRange)}
                </div>
            </section>

            <section class="cg-section">
                <h3 class="cg-section-title"><i class="fa-solid fa-book-open"></i>사용법</h3>
                <ul class="cg-guide">
                    ${GUIDE.map(([icon, title, text]) => `<li><i class="fa-solid ${icon ?? iconName()}"></i><div><b>${title}</b><p>${text}</p></div></li>`).join('')}
                </ul>
            </section>

            <p class="cg-version">북마크 ${VERSION}</p>
        </div>`;

    const codeInputs = [...page.querySelectorAll('[data-color-key]')];
    const swatchFor = key => page.querySelector(`[data-color-swatch="${key}"]`);
    const scopeNote = page.querySelector('.cg-scope-note');

    const describeScope = () => {
        scopeNote.textContent = colorScope === 'chat'
            ? `“${chat.label}” 채팅에만 적용돼요.${hasOwnColors(chat.key) ? '' : ' 지금은 기본 색을 쓰고 있어요.'}`
            : '전용 색이 없는 모든 채팅에 적용돼요.';
    };
    const previewColors = () => {
        const colors = Object.fromEntries(COLOR_FIELDS.map(([key]) => [key, swatchFor(key).value]));
        for (const [key, color] of Object.entries(colors)) swatchFor(key).parentElement.style.setProperty('--swatch', color);
        // 테마를 따라가는 중에는 직접 고른 색으로 덮지 않는다 (설정 화면을 열기만 해도 색이 바뀌던 것을 막음)
        if (!(store.followTheme && themeColors())) applyColors(colors);
    };
    const fillColors = (colors) => {
        for (const input of codeInputs) {
            const key = input.dataset.colorKey;
            input.value = colors[key];
            input.classList.remove('is-invalid');
            swatchFor(key).value = colors[key];
        }
        previewColors();
        describeScope();
    };

    for (const input of codeInputs) {
        const swatch = swatchFor(input.dataset.colorKey);
        swatch.addEventListener('input', () => {
            input.value = swatch.value;
            input.classList.remove('is-invalid');
            previewColors();
        });
        input.addEventListener('input', () => {
            const color = parseColorCode(input.value);
            input.classList.toggle('is-invalid', !color && input.value.trim() !== '');
            if (!color) return;
            swatch.value = color;
            previewColors();
        });
        input.addEventListener('change', () => {
            const color = parseColorCode(input.value);
            if (color) input.value = color;
            else input.classList.add('is-invalid');
        });
        // 모바일 키보드의 완료(Enter)는 입력만 마친다.
        input.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            input.blur();
        });
    }

    const saveColors = () => {
        const colors = Object.fromEntries(codeInputs.map(input => [input.dataset.colorKey, parseColorCode(input.value)]));
        const invalid = COLOR_FIELDS.filter(([key]) => !colors[key]).map(([, label]) => label);
        if (invalid.length) {
            codeInputs.forEach(input => input.classList.toggle('is-invalid', !colors[input.dataset.colorKey]));
            toastr.error(`색 코드를 확인해 주세요: ${invalid.join(', ')} (예: #51a0de 또는 81, 160, 222)`, '북마크');
            return;
        }
        if (colorScope === 'default') {
            store.colors.default = colors;
            toastr.success('기본 색을 저장했어요.', '북마크');
        } else {
            const base = baseColors();
            const sameAsBase = COLOR_FIELDS.every(([key]) => base[key] === colors[key]);
            // 기본 색과 같으면 전용 색을 지워서, 나중에 기본 색을 바꿀 때 이 채팅도 함께 따라가게 한다.
            if (sameAsBase) delete store.colors.chats[chatKey(chat.key)];
            else store.colors.chats[chatKey(chat.key)] = colors;
            toastr.success(sameAsBase ? '이 채팅은 기본 색을 써요.' : '이 채팅의 색을 저장했어요.', '북마크');
        }
        saveSettings();
        describeScope();
    };

    const setSetting = async (name, value) => {
        if (name === 'colorScope') {
            colorScope = value;
            fillColors(scopeColors());
            return;
        }
        store[name] = value;
        saveSettings();
        if (name === 'iconStyle') hooks.refreshMessageIcons();
        if (name === 'followTheme') {
            page.querySelectorAll('[data-manual]').forEach((element) => { element.hidden = value; });
            if (value) applyColors(colorsFor(chat?.key));
            else fillColors(scopeColors());
            hooks.syncThemeColors?.();
        }
        await hooks.refreshPanel({ keepPage: true });
    };

    page.addEventListener('click', (event) => {
        const target = event.target;
        const action = target.closest('[data-act]')?.dataset.act;
        if (action === 'back') {
            onBack();
            return;
        }
        if (action === 'color-save') return saveColors();
        if (action === 'color-reset') {
            // '이 채팅에만'은 기본 색으로, '기본 색'은 확장 기본값으로 되돌린다 (저장을 눌러야 확정).
            fillColors(colorScope === 'chat' ? baseColors() : { ...DEFAULT_COLORS });
            return;
        }

        const option = target.closest('.cg-segmented [data-value]');
        if (option) {
            const group = option.closest('.cg-segmented');
            group.querySelectorAll('[data-value]').forEach((button) => {
                const active = button === option;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-checked', String(active));
            });
            setSetting(group.dataset.setting, option.dataset.value);
            return;
        }

        const toggle = target.closest('.cg-switch');
        if (toggle) {
            const next = toggle.getAttribute('aria-checked') !== 'true';
            toggle.setAttribute('aria-checked', String(next));
            setSetting(toggle.dataset.setting, next);
            return;
        }

        const step = target.closest('.cg-stepper [data-step]');
        if (step) {
            const input = step.parentElement.querySelector('input');
            input.value = String(Number(input.value || 0) + Number(step.dataset.step));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }, { signal });

    page.querySelectorAll('.cg-stepper[data-setting] input').forEach((input) => {
        const box = input.closest('.cg-stepper');
        const min = Number(box.dataset.min);
        const max = Number(box.dataset.max);
        input.addEventListener('change', () => {
            const parsed = Number.parseInt(input.value, 10);
            const value = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : store[box.dataset.setting];
            input.value = String(value);
            if (value !== store[box.dataset.setting]) setSetting(box.dataset.setting, value);
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                input.blur();
            }
        });
    });

    fillColors(scopeColors());
}
