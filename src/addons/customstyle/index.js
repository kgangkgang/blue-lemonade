// Copyright (c) 2025 IceFog72. MIT License: see LICENSE.
// Modified 2026-09-24 by Blue Lemonade: embedded dialog, Korean UI, settings preservation.
// Import statements
import { eventSource, event_types, saveSettingsDebounced } from '../../../../../../../script.js';
import { extension_settings } from '../../../../../../extensions.js';

// Constants and Types
const CSS_THEME_STYLE_VAR = '--custom-theme-style-inputs';
const CTS_DRAWER_ID = 'ctsi-drawer';
const CTS_CONTENT_ID = 'ctsi-drawer-content';

const DEFAULT_CSS_TEMPLATE = `
:root {
  --custom-theme-style-inputs: [
  {
    "type": "slider",
    "varId": "customCSS-font-size",
    "displayText": "CustomCSS font size",
    "default": "5",
    "min": 0,
    "max": 32,
    "step": 1
  },
  {
    "type": "color",
    "varId": "customCSS-background",
    "displayText": "CustomCSS background",
    "default": "rgba(149, 78, 178, 40)"
  },
  {
    "type": "color",
    "varId": "customCSS-Drawer-iconColor",
    "displayText": "Drawer icon Color",
    "default": "rgba(19, 78, 78, 30)"
  },
  {
    "type": "text",
    "varId": "customAnimation-duration",
    "displayText": "animation duration",
    "default": "0.1s"
  },
  {
    "type": "select",
    "varId": "expressionVisibility",
    "displayText": "Expression Visibility",
    "default": "visible",
    "options": [
      {
        "label": "visible",
        "value": "visible"
      },
      {
        "label": "hidden",
        "value": "hidden"
      },
      {
        "label": "collapse",
        "value": "collapse"
      }
    ]
  },
  {
    "type": "select",
    "varId": "expressionWidth",
    "displayText": "Expression size",
    "default": "512px",
    "options": [
      {
        "label": "512px",
        "value": "512px"
      },
      {
        "label": "0px",
        "value": "0px"
      }
    ]
  }
]
}

/* !!! Exemples. If using slider always * 1(Unit) !!!*/
* {
    --animation-duration: calc(var(--customAnimation-duration) * 1s);
}

.expression-holder {
    width: var(--expressionWidth) !important;
    height: var(--expressionWidth) !important;
    min-width: var(--expressionWidth) !important;
    min-height: var(--expressionWidth) !important;
}

.drawer-icon {
    color: var(--customCSS-Drawer-iconColor) !important;
}

#expression-image {
    visibility: var(--expressionVisibility);
}

#customCSS {
    background: var(--customCSS-background);
    font-size: calc(var(--customCSS-font-size) * 1px);
}
`;

class CustomThemeSettingsManager {

    constructor() {
        this.settings = this.initializeSettings();
        this.previousStyleValue = null;
        this.isAppReady = false;

        // Bind methods for event listeners
        this.handleDelegatedInput = this.handleDelegatedInput.bind(this);
        this.handleDelegatedChange = this.handleDelegatedChange.bind(this);
        this.handleDelegatedClick = this.handleDelegatedClick.bind(this);
    }

    /**
     * Initialize extension settings from global storage
     */
    initializeSettings() {
        if (!extension_settings.CTSI) {
            extension_settings.CTSI = {};
        }
        return extension_settings.CTSI;
    }

    /**
     * Parse CSS variable content safely
     * @param {string} cssVariable - The CSS variable name to parse
     * @returns {Array} - Array of config objects
     */
    _parseCSSConfig(cssVariable) {
        try {
            const cssContent = getComputedStyle(document.documentElement).getPropertyValue(cssVariable);
            if (!cssContent || !cssContent.trim() || ['none', '""', "''"].includes(cssContent.trim())) {
                return [];
            }

            const parsed = JSON.parse(cssContent);
            if (!Array.isArray(parsed)) {
                console.warn('[CTSI] CSS content is not an array');
                return [];
            }

            const seenVarIds = new Set();
            return parsed.filter(entry => {
                if (!entry || !['slider','color','text','checkbox','select'].includes(entry.type) || !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(entry.varId) || !entry.displayText) return false;
                if (seenVarIds.has(entry.varId)) {
                    console.warn(`[CTSI] Duplicate varId ignored: ${entry.varId}`);
                    return false;
                }
                seenVarIds.add(entry.varId);
                return true;
            });

        } catch (error) {
            console.error(`[CTSI] Failed to parse ${cssVariable}:`, error);
            return [];
        }
    }

    /**
     * Apply current settings to CSS variables in the DOM
     * @param {Object} savedValues - Key-value map of settings
     */
    updateCSSVariables(savedValues) {
        const active=new Set(this._parseCSSConfig(CSS_THEME_STYLE_VAR).map(e=>e.varId));
        Object.entries(savedValues).forEach(([varId, value]) => {
            if(!active.has(varId))return;
            if (!varId || varId === 'undefined') return;

            const unitKey = `${varId}-unit`;
            const unit = savedValues[unitKey] || '';
            const valueWithUnit = unit ? `${value}${unit}` : value;

            if (valueWithUnit !== '') {
                document.documentElement.style.setProperty(`--${varId}`, valueWithUnit);
            }
        });
    }

    /**
     * Save settings to storage and update DOM
     * @param {Object} entries 
     */
    saveSettings(entries) {
        this.settings.entries = entries;
        this.updateCSSVariables(entries);
        saveSettingsDebounced();
    }

    /**
     * Sanitize and synchronize settings with current CSS configuration
     * @param {Array} parsedEntries 
     */
    syncSettingsWithConfig(parsedEntries) {
        const currentVarIds = parsedEntries.map(entry => entry.varId);

        const entries = this.settings.entries || {};
        for(const key of this.appliedKeys||[])if(!currentVarIds.includes(key))document.documentElement.style.removeProperty(`--${key}`);
        this.appliedKeys=new Set(currentVarIds);

        // Initialize new entries
        parsedEntries.forEach(entry => {
            if (entries[entry.varId] === undefined) {
                if (entry.type === 'select') {
                    const defaultOption = (entry.options||[]).find(opt => opt.value === entry.default) || (entry.options||[])[0];
                    entries[entry.varId] = defaultOption ? defaultOption.value : '';
                } else if (entry.type === 'checkbox') {
                    entries[entry.varId] = entry.checked || false;
                } else {
                    entries[entry.varId] = entry.default || '';
                }
            }
        });

        this.settings.entries = entries;
    }

    /**
     * Generate HTML for a settings entry
     */
    generateEntryHTML(entry, value) {
        const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        entry={...entry,displayText:escape(entry.displayText),default:escape(entry.default),min:escape(entry.min),max:escape(entry.max),step:escape(entry.step),options:(entry.options||[]).map(o=>({label:escape(o.label),value:escape(o.value)}))};
        if(entry.type!=='checkbox'&&value!==undefined)value=escape(value);
        const safeValue = value !== undefined ? value : entry.default;
        switch (entry.type) {
            case 'slider':
                return `
                    <div class="flex-container alignitemscenter">      
                        <span data-i18n="${entry.displayText}">${entry.displayText}</span><br>
                        <div class="alignitemscenter flex-container flexFlowColumn flexBasis48p flexGrow flexShrink gap0">
                            <input class="neo-range-slider" type="range" data-var-id="${entry.varId}" min="${entry.min}" max="${entry.max}" value="${safeValue}" step="${entry.step || 1}">
                            <input class="neo-range-input" type="number" data-var-id="${entry.varId}" min="${entry.min}" max="${entry.max}" value="${safeValue}" step="${entry.step || 1}">
                        </div>
                    </div>`;
            case 'color':
                return `
                    <div class="flex-container alignItemsBaseline">
                        <span>${entry.displayText}</span>
                        <toolcool-color-picker data-var-id="${entry.varId}" color="${safeValue}"></toolcool-color-picker>
                    </div>`;
            case 'text':
                return `
                    <label class="flex-container alignItemsBaseline">
                        <span>${entry.displayText}</span><br>
                        <input type="text" class="text_pole wide100p widthNatural flex1 margin0" data-var-id="${entry.varId}" value="${safeValue}" />
                    </label>`;
            case 'checkbox':
                return `
                    <label class="checkbox_label alignItemsBaseline">
                        <span>${entry.displayText}</span>
                        <input type="checkbox" data-var-id="${entry.varId}" ${safeValue ? 'checked' : ''}>
                    </label>`;
            case 'select':
                const options = (entry.options || []).map(opt =>
                    `<option value="${opt.value}" ${opt.value === safeValue ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                return `
                    <div class="flex-container alignItemsBaseline">
                        <span>${entry.displayText}</span>
                        <select class="widthNatural flex1 margin0" data-var-id="${entry.varId}">${options}</select>
                    </div>`;
            default:
                return '';
        }
    }

    /**
     * Event Handler: Input events (Text, Sliders, Numbers)
     */
    handleDelegatedInput(event) {
        const target = event.target;
        const varId = target.dataset.varId;

        if (!varId) return;

        // Synchronize dual inputs (Slider + Number)
        if (target.classList.contains('neo-range-slider') || target.classList.contains('neo-range-input')) {
            const value = target.value;
            const container = target.closest('.alignitemscenter'); // Parent container
            const inputs = container.querySelectorAll(`[data-var-id="${varId}"]`);
            inputs.forEach(input => {
                if (input !== target) input.value = value;
            });

            this.settings.entries[varId] = value;
            this.saveSettings(this.settings.entries);
        }
        // Text Inputs
        else if (target.type === 'text') {
            this.settings.entries[varId] = target.value;
            this.saveSettings(this.settings.entries);
        }
    }

    /**
     * Event Handler: Change events (Select, Checkbox)
     */
    handleDelegatedChange(event) {
        const target = event.target;
        const varId = target.dataset.varId;

        if (!varId) return;

        if (target.type === 'checkbox') {
            this.settings.entries[varId] = target.checked;
            this.saveSettings(this.settings.entries);
        } else if (target.tagName === 'SELECT') {
            this.settings.entries[varId] = target.value;
            this.saveSettings(this.settings.entries);
        }
    }

    /**
     * Binds specific events to color pickers since they effectively use custom events
     * that might not bubble correctly for delegation in all contexts.
     */
    bindColorPickers() {
        const pickers = document.querySelectorAll(`${CTS_CONTENT_ID} toolcool-color-picker`); // Use specific selector if possible, or query inside container
        const container = document.getElementById(CTS_CONTENT_ID);
        if (!container) return;

        const containerPickers = container.querySelectorAll('toolcool-color-picker');

        containerPickers.forEach(picker => {
            // Remove old listener if any (safety, though we rebuild DOM)
            // picker.replaceWith(picker.cloneNode(true)); // Heavy handed

            picker.addEventListener('change', (evt) => {
                const varId = picker.dataset.varId;
                const color = evt.detail?.rgba || evt.detail?.hex || picker.color;

                if (varId && color) {
                    this.settings.entries[varId] = color;
                    this.saveSettings(this.settings.entries);
                }
            });
        });
    }

    /**
     * Event Handler: Clicks (Buttons)
     */
    handleDelegatedClick(event) {
        const target = event.target.closest('.interactable, .ctsi-inline-drawer-maximize');
        if (!target) return;

        if (target.id === 'ctsi-copy-to-clipboard') {
            this.copyToClipboard();
        } else if (target.id === 'ctsi-update-customCSS') {
            this.updateCustomCSSFile(); // Renamed to accurately reflect action
        } else if (target.id === 'ctsi-reset-defaults') {
            this.resetDefaults();
        } else if (target.id === 'insert-default-css') { // ID for the empty state button
            this.insertDefaultCSS();
        } else if (target.classList.contains('ctsi-inline-drawer-maximize')) {
            this.toggleMaximize(target);
        }
    }

    toggleMaximize(btn) {
        const icon = btn.querySelector('i');
        const drawer = document.getElementById(CTS_DRAWER_ID);
        const movingDivs = document.getElementById('movingDivs');
        const originalParent = document.querySelector('[name="FontBlurChatWidthBlock"]'); // Fallback anchor

        if (!drawer || !movingDivs) return;

        if (icon.classList.contains('fa-window-maximize')) {
            // Maximize
            icon.classList.replace('fa-window-maximize', 'fa-window-restore');
            // Store original parent if needed, but we know where it goes
            drawer.dataset.originalParentIdx = Array.from(drawer.parentNode.children).indexOf(drawer);

            movingDivs.appendChild(drawer);
            drawer.classList.remove('inline-drawer');
            drawer.classList.add('ctsi-drawer-content', 'flexGap5', 'maximized');
            drawer.style.display = 'flex';
            drawer.style.opacity = '1';
        } else {
            // Restore
            icon.classList.replace('fa-window-restore', 'fa-window-maximize');

            // Try to put it back exactly where it was, or append to original container
            // Since we inject at specific point, simple append might displace it if multiple extensions
            // But usually safe to append to the container found by selector
            if (originalParent) {
                originalParent.insertAdjacentElement('beforeend', drawer); // Or try to respect index
            }

            drawer.classList.add('inline-drawer');
            drawer.classList.remove('ctsi-drawer-content', 'flexGap5', 'maximized');
            drawer.style.display = '';
            drawer.style.opacity = '';
        }
    }

    copyToClipboard() {
        const cssContent = this.generateCSSContent();
        navigator.clipboard.writeText(cssContent).then(() => {
            toastr.success('CSS content copied to clipboard');
        }).catch(err => {
            console.error('[CTSI] Clipboard error:', err);
            toastr.error('Failed to copy to clipboard');
        });
    }

    /**
     * Updates the #customCSS element preserving existing content
     */
    updateCustomCSSFile() {
        const customCSSArea = document.getElementById('customCSS');
        if (!customCSSArea) {
            toastr.error('CustomCSS element not found');
            return;
        }

        const currentContent = customCSSArea.value;
        const generatedCSS = this.generateSettingsJSON();
        let newContent = currentContent;

        // Find the start of the variable definition
        // We look for: --custom-theme-style-inputs : [
        const keyMatch = /--custom-theme-style-inputs\s*:\s*\[/.exec(currentContent);

        if (keyMatch) {
            const tempStart = keyMatch.index + keyMatch[0].length - 1; // Index of the opening '['
            let endIndex = -1;

            // The array is JSON, and a ']' may sit inside a string value, so a
            // bare bracket count can stop early and corrupt the CSS on the next
            // save. Take the first ']' at which the slice parses as JSON.
            for (let i = currentContent.indexOf(']', tempStart); i !== -1; i = currentContent.indexOf(']', i + 1)) {
                try {
                    JSON.parse(currentContent.substring(tempStart, i + 1));
                    endIndex = i + 1; // Include the closing ']'
                    break;
                } catch { /* not the end yet */ }
            }

            if (endIndex !== -1) {
                // We found the full array block
                const prefix = currentContent.substring(0, tempStart);
                const suffix = currentContent.substring(endIndex);
                // Reconstruct: prefix + new JSON + suffix
                // We replaced currentContent.substring(tempStart, endIndex) with generatedCSS
                newContent = prefix + generatedCSS + suffix;
            } else {
                console.warn('[CTSI] Could not find matching closing bracket for variable array');
                // Fallback: Append or broken state
            }
        } else {
            // Variable definition not found at all, try to find :root
            const rootRegex = /:root\s*\{/;
            if (rootRegex.test(currentContent)) {
                // Insert into :root
                newContent = currentContent.replace(rootRegex, `:root {\n  --custom-theme-style-inputs: ${generatedCSS};\n`);
            } else {
                // Append new block
                newContent = `${currentContent}\n:root {\n  --custom-theme-style-inputs: ${generatedCSS};\n}`;
            }
        }

        if (newContent !== currentContent) {
            customCSSArea.value = newContent;
            // Trigger input event to let other systems know (e.g., ST saving)
            customCSSArea.dispatchEvent(new Event('input', { bubbles: true }));
            toastr.success('CustomCSS updated');
        } else {
            // Even if content is same, user expected an update/save confirmation
            toastr.success('CustomCSS is already up to date');
        }
    }

    generateSettingsJSON() {
        const entries = this.settings.entries;
        const configEntries = this._parseCSSConfig(CSS_THEME_STYLE_VAR); // Get structure from CSS

        // Map current settings values back to the config structure
        const exportEntries = configEntries.map(config => {
            const currentVal = entries[config.varId];
            return {
                ...config,
                default: currentVal !== undefined ? currentVal : config.default
            };
        });

        return JSON.stringify(exportEntries, null, 2);
    }

    generateCSSContent() {
        return `:root {\n  --custom-theme-style-inputs: ${this.generateSettingsJSON()}\n}`;
    }

    insertDefaultCSS() {
        if(!confirm('현재 커스텀 CSS 앞에 예제를 추가할까요? 적용하면 화면 모양이 바뀔 수 있어요.'))return;
        const customCSSArea = document.getElementById('customCSS');
        if (customCSSArea) {
            customCSSArea.value = `${DEFAULT_CSS_TEMPLATE}\n${customCSSArea.value}`;
            customCSSArea.dispatchEvent(new Event('input', { bubbles: true }));
            this.buildUI(); // Rebuild UI after insertion
        }
    }

    resetDefaults() {
        if (!confirm('현재 CSS 설정 항목을 기본값으로 되돌릴까요?')) return;

        for(const entry of this._parseCSSConfig(CSS_THEME_STYLE_VAR))delete this.settings.entries[entry.varId];
        this.updateCSSVariables({});
        this.previousStyleValue = null;
        this.buildUI();
        this.saveSettings(this.settings.entries);
        toastr.info('현재 항목을 기본값으로 되돌렸어요.');
    }

    /**
     * Build the UI
     */
    buildUI() {
        const drawerContent = document.getElementById(CTS_CONTENT_ID);
        if (!drawerContent) return;

        // Container structure
        drawerContent.innerHTML = `
            <div class="flex-container ctsi-container flexFlowColumn">
                <div class="flex-container ctsi-flex-container">
                    <div id="cts-row-1" class="flex-container flexFlowColumn" style="flex: 1;"></div>
                    <div id="cts-row-2" class="flex-container flexFlowColumn" style="flex: 1;"></div>
                </div>
                <div class="flex-container ctsi-button-container">
                    <div id="ctsi-copy-to-clipboard" title="설정 CSS 복사" class="menu_button margin0 interactable" tabindex="0"><i class="fa-solid fa-copy"></i></div>
                    <div id="ctsi-update-customCSS" title="커스텀 CSS에 저장" class="menu_button margin0 interactable" tabindex="0"><i class="fa-solid fa-save"></i></div>
                    <div id="ctsi-reset-defaults" title="기본값 복원" class="menu_button margin0 interactable" tabindex="0"><i class="fa-solid fa-undo"></i></div>
                    
                </div>
            </div>`;

        const row1 = document.getElementById('cts-row-1');
        const row2 = document.getElementById('cts-row-2');

        const parsedEntries = this._parseCSSConfig(CSS_THEME_STYLE_VAR);

        if (parsedEntries.length === 0) {
            row1.innerHTML = '<p class="alert-message">이 CSS에는 조절 항목이 아직 없어요. 아래 예제 형식을 참고해 주세요.</p>';
            row2.innerHTML = '<button id="insert-default-css" class="menu_button menu_button_icon interactable flex1">예제 CSS 추가</button>';
            this.updateCSSVariables({});
            return;
        }

        this.syncSettingsWithConfig(parsedEntries);

        parsedEntries.forEach((entry, index) => {
            const html = this.generateEntryHTML(entry, this.settings.entries[entry.varId]);
            if (index < parsedEntries.length / 2) {
                row1.insertAdjacentHTML('beforeend', html);
            } else {
                row2.insertAdjacentHTML('beforeend', html);
            }
        });

        // Bind color pickers directly
        this.bindColorPickers();
    }

    injectDrawer() {
        if (document.getElementById(CTS_DRAWER_ID)) return;

        const html = `
            <div id="${CTS_DRAWER_ID}" class="inline-drawer wide100p flexFlowColumn">
                <div class="inline-drawer-toggle inline-drawer-header userSettingsInnerExpandable">
                    <b>커스텀 CSS 조절</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div id="${CTS_CONTENT_ID}" class="inline-drawer-content" style="font-size:small;"></div>
            </div>
            <hr>`;

        const target = document.getElementById('bl-ctsi-holder');
        if (target) {
            target.insertAdjacentHTML('beforeend', html);
        } else {
            console.warn('[CTSI] Target container FontBlurChatWidthBlock not found');
        }
    }

    setupDelegation() {
        const container = document.getElementById(CTS_CONTENT_ID);
        if (!container) return;

        // Cleanup old if any (though usually we init once)
        container.removeEventListener('input', this.handleDelegatedInput);
        container.removeEventListener('change', this.handleDelegatedChange);
        container.removeEventListener('click', this.handleDelegatedClick);

        container.addEventListener('input', this.handleDelegatedInput);
        container.addEventListener('change', this.handleDelegatedChange);
        container.addEventListener('click', this.handleDelegatedClick);
    }

    initialize() {
        const boot = () => {
            if (this.isAppReady) return;
            this.isAppReady = true;
            this.injectDrawer();
            // Remember the config we built from, so the first SETTINGS_UPDATED
            // of the session does not rebuild the UI (and drop focus) for nothing.
            this.previousStyleValue = this._parseCSSConfig(CSS_THEME_STYLE_VAR);
            this.buildUI();
            this.setupDelegation();

            // Apply initial settings
            this.updateCSSVariables(this.settings.entries || {});
        };
        this.boot = boot;
        // getComputedStyle at import time forces a style flush in the middle of
        // startup; wait for the first frame (hidden tabs get no frames — fall
        // back to a timer).
        requestAnimationFrame(() => setTimeout(boot, 0));
        setTimeout(boot, 1000);

        let settingsTimer = null;
        eventSource.on(event_types.SETTINGS_UPDATED, () => {
            if (!this.isAppReady) return;
            clearTimeout(settingsTimer);
            settingsTimer = setTimeout(() => {
                const currentConfig = this._parseCSSConfig(CSS_THEME_STYLE_VAR);
                // Simple deep compare to see if we need to rebuild inputs
                if (JSON.stringify(currentConfig) !== JSON.stringify(this.previousStyleValue)) {
                    this.previousStyleValue = currentConfig;
                    this.buildUI();
                    this.updateCSSVariables(this.settings.entries || {});
                }
            }, 300);
        });
    }
}

const holder=document.createElement('div');holder.id='bl-ctsi-holder';holder.hidden=true;document.body.append(holder);
const customThemeManager = new CustomThemeSettingsManager();
customThemeManager.initialize();

export default customThemeManager;

let currentDialog=null;
export function openPanel(){
 if(currentDialog?.open)return;
 customThemeManager.boot?.();
 const drawer=document.getElementById('ctsi-drawer');customThemeManager.buildUI();customThemeManager.updateCSSVariables(customThemeManager.settings.entries||{});
 const dialog=document.createElement('dialog');currentDialog=dialog;dialog.className='bl-ctsi-dialog';dialog.setAttribute('aria-label','커스텀 CSS 조절');
 dialog.innerHTML='<header><b>커스텀 CSS 조절</b><button type="button" aria-label="커스텀 CSS 조절 닫기">×</button></header><p>CSS에 정의된 색·크기·텍스트 값을 입력칸으로 조절해요.</p><div class="bl-ctsi-body"></div><small>Copyright © 2025 <a href="https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs" target="_blank" rel="noopener noreferrer">IceFog72</a> · <a href="https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT</a></small>';
 document.body.append(dialog);dialog.querySelector('.bl-ctsi-body').append(drawer);dialog.querySelector('header button').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{holder.append(drawer);dialog.remove();currentDialog=null;},{once:true});dialog.showModal();
}
export function mountInline(host){const button=document.createElement('button');button.type='button';button.className='salty-btn';button.textContent='커스텀 CSS 조절 열기';button.onclick=openPanel;host.replaceChildren(button);return()=>host.replaceChildren();}
