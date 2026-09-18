// 소금과 부딪히는 설정 찾기 → 설정 창 맨 위에 버튼과 함께 표시
function runSlash(command) {
    const ctx = SillyTavern.getContext();
    const run = ctx.executeSlashCommandsWithOptions || ctx.executeSlashCommands;
    return run(command);
}

export function getIssues() {
    const ctx = SillyTavern.getContext();
    const issues = [];

    if (window.MoonlitEchoesTheme || document.getElementById('MoonlitEchosTheme-style')) {
        issues.push({
            text: 'Moonlit Echoes 확장이 켜져 있어요. 이 테마와 겹쳐서 모양이 섞여요.',
            fix: '끄고 새로고침',
            run: () => runSlash('/extension-disable SillyTavern-MoonlitEchoesTheme'),
        });
    }
    if (window.MoonlitSlate || document.getElementById('MoonlitSlate-style')) {
        issues.push({
            text: 'Moonlit Slate 확장이 켜져 있어요. 이 테마가 대신하니 꺼 주세요.',
            fix: '끄고 새로고침',
            run: () => runSlash('/extension-disable moonlit-slate'),
        });
    }

    const fm = document.getElementById('font-manager--ui-fonts');
    if (fm && /UI FONT APPLICATION|CHAT FONT/.test(fm.textContent || '')) {
        issues.push({
            text: '폰트 매니저 확장이 글꼴을 강제로 씌우고 있어요. 이 테마의 글꼴 설정이 안 먹어요.',
            fix: '끄고 새로고침',
            run: () => runSlash('/extension-disable Font-Manager'),
        });
    }

    const css = ctx.powerUserSettings?.custom_css || '';
    if (/Moonlit|Slate|--custom-theme-style-inputs/.test(css)) {
        issues.push({
            text: '사용자 설정의 커스텀 CSS에 예전 테마가 남아 있어요.',
            fix: '비우기',
            run: () => {
                if (confirm('사용자 설정 → 커스텀 CSS 칸을 비울까요?\n(예전 Moonlit / Moonlit Slate 테마 CSS가 들어 있어요)\n\n지우지 않고 꺼 두기만 하려면: 채팅 › 기타 › 커스텀 CSS 끄기')) {
                    $('#customCSS').val('').trigger('input');
                }
            },
        });
    }

    const chatDisplay = document.getElementById('chat_display');
    if (chatDisplay && chatDisplay.value !== '0') {
        issues.push({
            text: '메시지 스타일이 플랫이 아니에요. 이 테마는 플랫 기준으로 만들어졌어요.',
            fix: '플랫으로',
            run: () => $('#chat_display').val('0').trigger('change'),
        });
    }

    return issues;
}
