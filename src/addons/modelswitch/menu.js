export function syncModelSwitchMenu(visible, open) {
    if(!visible){document.getElementById('bl-tool-menu-modelswitch')?.remove();return;}
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('bl-tool-menu-modelswitch')) return;
    const button = document.createElement('div');
    button.id = 'bl-tool-menu-modelswitch'; button.className = 'list-group-item flex-container flexGap5 interactable'; button.tabIndex = 0; button.setAttribute('role', 'button');
    button.innerHTML = '<div class="fa-fw fa-solid fa-shuffle extensionsMenuExtensionButton"></div><span>모델 전환</span>';
    button.onclick = () => open();
    button.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
    menu.append(button);
}
