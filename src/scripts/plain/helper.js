// 자동 생성 (tools/build-plain-scripts.mjs) — 고치려면 bundled/helper.js 을 고치고 다시 만든다
export default function blueLemonadeScript(BlueLemonade) {
/*BL-SCRIPT-START*/
// Tavern Helper 4.9.5 Korean UI, v1.3.8
// UI text and built-in help popups only: no prompts, script code, user variables, stored names, or settings are rewritten.
(() => {
  'use strict';
  const host = window.parent;
  const doc = host.document;
  const INSTANCE_KEY = '__tavernHelperKoreanUI_v1';
  host[INSTANCE_KEY]?.cleanup?.();

  const TRANSLATIONS = {
  "酒馆助手": "실리태번 헬퍼",
  "Tavern Helper": "실리태번 헬퍼",
  "[酒馆助手]": "[실리태번 헬퍼]",
  "[Tavern Helper]": "[실리태번 헬퍼]",
  "API 错误": "API 오류",
  "API Error": "API 오류",
  "[酒馆助手]迁移旧数据失败, 将使用空数据": "[실리태번 헬퍼] 기존 데이터를 옮기지 못했습니다. 빈 데이터를 사용합니다.",
  "[Tavern Helper] Failed to migrate old data, using empty data": "[실리태번 헬퍼] 기존 데이터를 옮기지 못했습니다. 빈 데이터를 사용합니다.",
  "[酒馆助手]读取全局数据失败, 将使用空数据": "[실리태번 헬퍼] 전역 데이터를 읽지 못했습니다. 빈 데이터를 사용합니다.",
  "[Tavern Helper] Failed to parse global data, using empty data": "[실리태번 헬퍼] 전역 데이터를 읽지 못했습니다. 빈 데이터를 사용합니다.",
  "[酒馆助手]读取角色数据失败, 将使用空数据": "[실리태번 헬퍼] 캐릭터 데이터를 읽지 못했습니다. 빈 데이터를 사용합니다.",
  "[Tavern Helper] Failed to parse character data, using empty data": "[실리태번 헬퍼] 캐릭터 데이터를 읽지 못했습니다. 빈 데이터를 사용합니다.",
  "[酒馆助手]读取预设数据失败, 将使用空数据": "[실리태번 헬퍼] 프리셋 데이터를 읽지 못했습니다. 빈 데이터를 사용합니다.",
  "[Tavern Helper] Failed to parse preset data, using empty data": "[실리태번 헬퍼] 프리셋 데이터를 읽지 못했습니다. 빈 데이터를 사용합니다.",
  "[酒馆助手]读取聊天数据失败, 将使用空数据": "[실리태번 헬퍼] 채팅 데이터를 읽지 못했습니다. 빈 데이터를 사용합니다.",
  "[Tavern Helper] Failed to parse chat data, using empty data": "[실리태번 헬퍼] 채팅 데이터를 읽지 못했습니다. 빈 데이터를 사용합니다.",
  "[酒馆助手]连接实时监听功能出错, 尝试重连...": "[실리태번 헬퍼] 실시간 변경 감지 연결 중 오류가 발생했습니다. 다시 연결하는 중...",
  "[Tavern Helper] Error connecting to Real-time Editing Listener, trying to reconnect...": "[실리태번 헬퍼] 실시간 변경 감지 연결 중 오류가 발생했습니다. 다시 연결하는 중...",
  "[酒馆助手]实时监听器断开连接": "[실리태번 헬퍼] 실시간 변경 감지 연결이 끊어졌습니다.",
  "[Tavern Helper] Real-time Editing Listener disconnected": "[실리태번 헬퍼] 실시간 변경 감지 연결이 끊어졌습니다.",
  "获取更新日志失败": "변경 내역을 불러오지 못했습니다.",
  "Failed to get the changelog": "변경 내역을 불러오지 못했습니다.",
  "无法找到版本 '${0}' 的日志": "'${0}' 버전의 변경 내역을 찾을 수 없습니다.",
  "Cannot find the changelog for version '${0}'": "'${0}' 버전의 변경 내역을 찾을 수 없습니다.",
  "酒馆助手更新成功, 准备刷新页面以生效...": "실리태번 헬퍼를 업데이트했습니다. 변경 사항을 적용하기 위해 페이지를 새로고침합니다...",
  "Tavern Helper updated successfully, preparing to refresh the page to take effect...": "실리태번 헬퍼를 업데이트했습니다. 변경 사항을 적용하기 위해 페이지를 새로고침합니다...",
  "正在更新酒馆助手...": "실리태번 헬퍼 업데이트 중...",
  "Updating Tavern Helper...": "실리태번 헬퍼 업데이트 중...",
  "酒馆助手已是最新版本, 无需更新": "실리태번 헬퍼가 이미 최신 버전입니다.",
  "Tavern Helper is already the latest version, no need to update": "실리태번 헬퍼가 이미 최신 버전입니다.",
  "更新失败: ${0}": "업데이트 실패: ${0}",
  "Update failed: ${0}": "업데이트 실패: ${0}",
  "是否尝试通过卸载重装来更新? (以防由于网络问题重装没能成功, 请先复制网址)": "삭제 후 다시 설치하여 업데이트할까요? (네트워크 문제로 재설치에 실패할 수 있으니 먼저 주소를 복사해 주세요.)",
  "Whether to try to update by uninstalling and reinstalling? (In case that the reinstalling failed due to network issues, please copy the URL first)": "삭제 후 다시 설치하여 업데이트할까요? (네트워크 문제로 재설치에 실패할 수 있으니 먼저 주소를 복사해 주세요.)",
  "复制网址": "주소 복사",
  "Copy URL": "주소 복사",
  "网址已复制": "주소를 복사했습니다.",
  "URL copied": "주소를 복사했습니다.",
  "正在卸载重装酒馆助手...": "실리태번 헬퍼를 삭제하고 다시 설치하는 중...",
  "Uninstalling and reinstalling Tavern Helper...": "실리태번 헬퍼를 삭제하고 다시 설치하는 중...",
  "更新酒馆助手失败": "실리태번 헬퍼 업데이트에 실패했습니다.",
  "Failed to update Tavern Helper": "실리태번 헬퍼 업데이트에 실패했습니다.",
  "路径已复制": "경로를 복사했습니다.",
  "Path copied": "경로를 복사했습니다.",
  "无法复制路径，请手动复制": "경로를 복사할 수 없습니다. 직접 복사해 주세요.",
  "Cannot copy path, please copy manually": "경로를 복사할 수 없습니다. 직접 복사해 주세요.",
  "成功编辑键名": "키 이름을 변경했습니다.",
  "Successfully edited key name": "키 이름을 변경했습니다.",
  "成功编辑值": "값을 변경했습니다.",
  "Successfully edited value": "값을 변경했습니다.",
  "已复制!": "복사했습니다!",
  "Copied!": "복사했습니다!",
  "主设置": "주요 설정",
  "Main": "주요 설정",
  "扩展设置": "확장 기능 설정",
  "Settings": "확장 기능 설정",
  "渲染器": "렌더러",
  "Renderer": "렌더러",
  "渲染": "렌더링",
  "Render": "렌더링",
  "脚本库": "스크립트 라이브러리",
  "Script": "스크립트",
  "脚本": "스크립트",
  "工具箱": "도구 모음",
  "Toolbox": "도구 모음",
  "工具": "도구",
  "Tools": "도구",
  "基本设置": "기본 설정",
  "Basic Settings": "기본 설정",
  "渲染优化": "렌더링 최적화",
  "Render Optimization": "렌더링 최적화",
  "实验功能": "실험 기능",
  "Experimental Features": "실험 기능",
  "优化": "최적화",
  "Optimize": "최적화",
  "开发": "개발",
  "Dev": "개발",
  "类脑": "오디세이아",
  "ΟΔΥΣΣΕΙΑ": "오디세이아",
  "旅程": "오리존타스",
  "ΟΡΙΖΟΝΤΑΣ": "오리존타스",
  "Ver ${0}": "버전 ${0}",
  "查看日志": "변경 내역 보기",
  "View Log": "변경 내역 보기",
  "最新: ${0}": "최신 버전: ${0}",
  "Latest: ${0}": "최신 버전: ${0}",
  "发现新版本: ${0}": "새 버전이 있습니다: ${0}",
  "New version available: ${0}": "새 버전이 있습니다: ${0}",
  "更新": "업데이트",
  "Update": "업데이트",
  "开发工具": "개발 도구",
  "Development": "개발 도구",
  "扩展信息": "확장 기능 정보",
  "Extension Information": "확장 기능 정보",
  "启用渲染器": "렌더러 사용",
  "Enable Renderer": "렌더러 사용",
  "启用后，符合条件的代码块将被渲染": "활성화하면 조건에 맞는 코드 블록을 렌더링합니다.",
  "When enabled, qualified code blocks will be rendered": "활성화하면 조건에 맞는 코드 블록을 렌더링합니다.",
  "启用代码折叠": "코드 접기 사용",
  "Enable Code Folding": "코드 접기 사용",
  "允许流式渲染": "스트리밍 중 렌더링 허용",
  "Enable Streaming Rendering": "스트리밍 중 렌더링 허용",
  "在AI流式输出时就渲染，某些前端界面可能无法这样渲染。此外，这可能与某些脚本、插件、酒馆美化不兼容": "AI가 스트리밍으로 출력하는 동안 렌더링합니다. 일부 화면은 이 방식으로 렌더링되지 않을 수 있으며, 일부 스크립트·플러그인·실리태번 테마와 호환되지 않을 수 있습니다.",
  "Render during AI streaming output, some frontend interfaces may not be rendered in this way. Also, this may be incompatible with some scripts, plugins, and SillyTavern theme": "AI가 스트리밍으로 출력하는 동안 렌더링합니다. 일부 화면은 이 방식으로 렌더링되지 않을 수 있으며, 일부 스크립트·플러그인·실리태번 테마와 호환되지 않을 수 있습니다.",
  "启用兜底清理": "남은 화면 요소 자동 정리",
  "Enable Cleanup Protector": "남은 화면 요소 자동 정리",
  "对脚本附加的界面如悬浮球等进行兜底清理, 以防脚本关闭后界面残留；但遇到这种情况更建议提醒脚本作者修复": "스크립트를 끈 뒤 플로팅 버튼 등 스크립트가 추가한 화면 요소가 남지 않도록 정리합니다. 이런 문제가 생기면 스크립트 제작자에게 수정을 요청하는 것이 좋습니다.",
  "Try to cleanup interfaces attached by scripts like floating balls, avoiding the interface existing after the script is closed; it is recommended to notify the script author to fix the issue though.": "스크립트를 끈 뒤 플로팅 버튼 등 스크립트가 추가한 화면 요소가 남지 않도록 정리합니다. 이런 문제가 생기면 스크립트 제작자에게 수정을 요청하는 것이 좋습니다.",
  "折叠指定类型的代码块，当选择“仅前端”时，将只折叠可渲染成前端界面但没被渲染的代码块": "지정한 유형의 코드 블록을 접습니다. ‘프런트엔드만’을 선택하면 화면으로 렌더링할 수 있지만 아직 렌더링되지 않은 코드 블록만 접습니다.",
  "Fold specified types of code blocks, when selecting \"Only Frontend\", only code blocks that can be rendered into frontend interface but not rendered will be folded": "지정한 유형의 코드 블록을 접습니다. ‘프런트엔드만’을 선택하면 화면으로 렌더링할 수 있지만 아직 렌더링되지 않은 코드 블록만 접습니다.",
  "启用加载动画": "로딩 애니메이션 사용",
  "Enable Loading Animation": "로딩 애니메이션 사용",
  "在前端内字体、图片等资源未加载完成前，显示加载动画而不是显示不完全界面": "화면의 글꼴·이미지 등을 모두 불러오기 전까지 로딩 애니메이션을 표시합니다.",
  "Show loading animation instead of incomplete interface before fonts, images and other resources in frontend are loaded": "화면의 글꼴·이미지 등을 모두 불러오기 전까지 로딩 애니메이션을 표시합니다.",
  "启用 Blob URL 渲染": "Blob URL 렌더링 사용",
  "Enable Blob URL Rendering": "Blob URL 렌더링 사용",
  "使用 Blob URL 渲染前端界面，更方便 f12 开发者工具调试；但某些浏览器可能不支持": "Blob URL로 화면을 렌더링하여 F12 개발자 도구에서 더 편하게 디버깅할 수 있습니다. 일부 브라우저에서는 지원하지 않을 수 있습니다.",
  "Use Blob URL to render frontend interface, easier for F12 developer tool debugging; but some browsers may not support it": "Blob URL로 화면을 렌더링하여 F12 개발자 도구에서 더 편하게 디버깅할 수 있습니다. 일부 브라우저에서는 지원하지 않을 수 있습니다.",
  "取消前端代码高亮": "프런트엔드 코드 구문 강조 끄기",
  "Cancel Frontend Code Highlight": "프런트엔드 코드 구문 강조 끄기",
  "避免酒馆对可渲染成前端界面的代码块进行语法高亮，从而提升渲染性能": "화면으로 렌더링할 수 있는 코드 블록에 실리태번의 구문 강조를 적용하지 않아 렌더링 성능을 높입니다.",
  "Avoid SillyTavern from highlighting code blocks that can be rendered into frontend interface, improving rendering performance": "화면으로 렌더링할 수 있는 코드 블록에 실리태번의 구문 강조를 적용하지 않아 렌더링 성능을 높입니다.",
  "渲染深度": "렌더링 깊이",
  "Rendering Depth": "렌더링 깊이",
  "设置需要渲染的楼层数，从最新楼层开始计数。为 0 时，将渲染所有楼层": "최신 메시지부터 몇 개의 메시지를 렌더링할지 설정합니다. 0으로 설정하면 모든 메시지를 렌더링합니다.",
  "Set the number of floors to render, counting from the latest floor. When 0, all floors will be rendered": "최신 메시지부터 몇 개의 메시지를 렌더링할지 설정합니다. 0으로 설정하면 모든 메시지를 렌더링합니다.",
  "忽略隐藏楼层": "숨긴 메시지 제외",
  "Ignore Hidden Floors": "숨긴 메시지 제외",
  "不渲染已经被设置为AI不可见的楼层，且不计入渲染深度设定的楼层数": "AI에게 숨기도록 설정한 메시지는 렌더링하지 않으며, 렌더링 깊이의 메시지 수에도 포함하지 않습니다.",
  "Floors set as invisible to AI are never rendered and do not count toward the rendering depth": "AI에게 숨기도록 설정한 메시지는 렌더링하지 않으며, 렌더링 깊이의 메시지 수에도 포함하지 않습니다.",
  "全部": "전체",
  "All": "전체",
  "仅前端": "프런트엔드만",
  "Only Frontend": "프런트엔드만",
  "禁用": "사용 안 함",
  "Disable": "사용 안 함",
  "搜索（支持普通和/正则/）": "검색 (일반 텍스트 및 /정규식/ 지원)",
  "Search (supports both plain and /regex/)": "검색 (일반 텍스트 및 /정규식/ 지원)",
  "全局脚本": "전역 스크립트",
  "Global Script": "전역 스크립트",
  "酒馆全局可用": "실리태번 전체에서 사용",
  "Available for the entire tavern": "실리태번 전체에서 사용",
  "角色脚本": "캐릭터 스크립트",
  "Character Script": "캐릭터 스크립트",
  "绑定到当前角色卡": "현재 캐릭터 카드에 연결",
  "Bind to the current character card": "현재 캐릭터 카드에 연결",
  "预设脚本": "프리셋 스크립트",
  "Preset Script": "프리셋 스크립트",
  "绑定到当前预设": "현재 프리셋에 연결",
  "Bind to the current preset": "현재 프리셋에 연결",
  "关闭前端渲染": "프런트엔드 렌더링 끄기",
  "Disable Fontend Renderer": "프런트엔드 렌더링 끄기",
  "开启前端渲染": "프런트엔드 렌더링 켜기",
  "Enabled Fontend Renderer": "프런트엔드 렌더링 켜기",
  "提示词查看器": "프롬프트 뷰어",
  "Prompt Viewer": "프롬프트 뷰어",
  "查看当前提示词发送情况，窗口开启时会监听新的发送及时更新显示": "현재 전송된 프롬프트를 확인합니다. 창이 열려 있는 동안 새 프롬프트가 전송되면 자동으로 갱신합니다.",
  "View the current prompt sending situation, the window will listen for new sending and update the display in time": "현재 전송된 프롬프트를 확인합니다. 창이 열려 있는 동안 새 프롬프트가 전송되면 자동으로 갱신합니다.",
  "变量管理器": "변수 관리자",
  "Variable Manager": "변수 관리자",
  "查看和管理全局、角色、聊天、消息楼层变量": "전역·캐릭터·채팅·메시지 변수를 확인하고 관리합니다.",
  "View and manage global, role, chat, message variables": "전역·캐릭터·채팅·메시지 변수를 확인하고 관리합니다.",
  "作者：KAKAA，青空莉想做舞台少女的狗": "제작자: KAKAA, 青空莉想做舞台少女的狗",
  "Author: KAKAA, 青空莉想做舞台少女的狗": "제작자: KAKAA, 青空莉想做舞台少女的狗",
  "本扩展免费使用，禁止任何形式的商业用途": "이 확장 기능은 무료이며, 모든 형태의 상업적 이용을 금지합니다.",
  "This extension is free to use but prohibited for any commercial use": "이 확장 기능은 무료이며, 모든 형태의 상업적 이용을 금지합니다.",
  "脚本可能存在风险，请确保安全后再运行": "스크립트에 위험 요소가 있을 수 있습니다. 안전성을 확인한 뒤 실행하세요.",
  "The script may exist risks, please ensure safety before running": "스크립트에 위험 요소가 있을 수 있습니다. 안전성을 확인한 뒤 실행하세요.",
  "实时监听": "실시간 변경 감지",
  "Real-time Editing Listener": "실시간 변경 감지",
  "连接编写模板，将代码修改实时同步到酒馆": "개발용 템플릿에 연결하여 코드 변경 사항을 실리태번에 실시간으로 동기화합니다.",
  "Connect to the official writing template, and synchronize the code changes in real time to the tavern": "개발용 템플릿에 연결하여 코드 변경 사항을 실리태번에 실시간으로 동기화합니다.",
  "允许监听": "변경 감지 허용",
  "Enable Listening": "변경 감지 허용",
  "启用弹窗报错": "오류 팝업 표시",
  "Enable Popup Error": "오류 팝업 표시",
  "使用方法": "사용 방법",
  "How to Use": "사용 방법",
  "刷新间隔 (毫秒)": "새로고침 간격 (밀리초)",
  "Refresh Interval (ms)": "새로고침 간격 (밀리초)",
  "禁用酒馆助手宏": "실리태번 헬퍼 매크로 비활성화",
  "Disable Tavern Helper Macro": "실리태번 헬퍼 매크로 비활성화",
  "编写变量角色卡而非测试/游玩角色卡时，打开此开关，避免 {{get_message_variable::变量}} 等宏被替换": "변수를 사용하는 캐릭터 카드를 테스트하거나 플레이하는 대신 작성할 때 켜면 {{get_message_variable::变量}} 등의 매크로가 치환되지 않습니다.",
  "When writing variable character cards instead of test/play character cards, enable this to avoid {{get_message_variable::variable}} and other macros being replaced": "변수를 사용하는 캐릭터 카드를 테스트하거나 플레이하는 대신 작성할 때 켜면 {{get_message_variable::变量}} 등의 매크로가 치환되지 않습니다.",
  "编写参考": "작성 참고 자료",
  "Reference": "작성 참고 자료",
  "编写脚本的参考文档": "스크립트 작성 참고 문서",
  "Writing Reference Document": "스크립트 작성 참고 문서",
  "查看教程及文档": "튜토리얼 및 문서 보기",
  "View Tutorial and Documentation": "튜토리얼 및 문서 보기",
  "下载参考文件": "참고 파일 다운로드",
  "Download Reference File": "참고 파일 다운로드",
  "下载STScript参考文件": "STScript 참고 파일 다운로드",
  "Download STScript Reference File": "STScript 참고 파일 다운로드",
  "下载宏参考文件": "매크로 참고 파일 다운로드",
  "Download Macro Reference File": "매크로 참고 파일 다운로드",
  "电脑编写模板用": "PC에서 템플릿 작성 시 사용",
  "Use for computer writing template": "PC에서 템플릿 작성 시 사용",
  "手机或 AI 官网用": "모바일 또는 AI 공식 웹사이트에서 사용",
  "Use for mobile or AI official website": "모바일 또는 AI 공식 웹사이트에서 사용",
  "酒馆STScript与宏": "실리태번 STScript 및 매크로",
  "Tavern STScript & Macro": "실리태번 STScript 및 매크로",
  "查看手册": "매뉴얼 보기",
  "View Manual": "매뉴얼 보기",
  "<div>更新日志加载中...</div>": "<div>업데이트 내역을 불러오는 중...</div>",
  "更新日志加载中...": "업데이트 내역을 불러오는 중...",
  "<div>Loading Changelog...</div>": "<div>업데이트 내역을 불러오는 중...</div>",
  "Loading Changelog...": "업데이트 내역을 불러오는 중...",
  "关闭": "닫기",
  "Close": "닫기",
  "内置库更多是作为脚本能做什么的示例, 更多实用脚本请访问社区的工具区": "내장 라이브러리는 주로 스크립트로 할 수 있는 기능을 보여 주는 예제입니다. 더 다양한 실용 스크립트는 커뮤니티의 도구 게시판에서 확인하세요.",
  "Built-in libraries are sort of examples of what scripts can do; to get more practical scripts, please visit the community's tool channel": "내장 라이브러리는 주로 스크립트로 할 수 있는 기능을 보여 주는 예제입니다. 더 다양한 실용 스크립트는 커뮤니티의 도구 게시판에서 확인하세요.",
  "例如我个人除了内置库外还有": "예를 들어, 내장 라이브러리 외에도 제가 만든",
  "For example, besides the built-in libraries, I've written": "예를 들어, 내장 라이브러리 외에도 제가 만든",
  "这些脚本": "스크립트들이 있습니다",
  "these scripts": "스크립트들이 있습니다",
  "如果需要制作脚本, 建议查看": "스크립트를 만들려면 다음 자료를 참고하세요:",
  "If you need to write scripts, please refer to": "스크립트를 만들려면 다음 자료를 참고하세요:",
  "官方编写模板配置教程": "공식 작성 템플릿 설정 튜토리얼",
  "Official writing template configuration tutorial": "공식 작성 템플릿 설정 튜토리얼",
  "标签化: 随世界书、预设或链接配置自动开关正则、提示词条目": "태그 연동: 로어북, 프리셋 또는 연결 설정에 따라 정규식과 프롬프트 항목을 자동으로 켜고 끄기",
  "Tagify: Automatically toggle regular expressions and prompt entries according to worldbook, preset or API configuration names": "태그 연동: 로어북, 프리셋 또는 연결 설정에 따라 정규식과 프롬프트 항목을 자동으로 켜고 끄기",
  "预设防误触": "프리셋 설정 오조작 방지",
  "Prevent mis-touch preset settings": "프리셋 설정 오조작 방지",
  "世界书强制自定义排序": "로어북을 사용자 지정 순서로 강제 정렬",
  "Forcely sort world book by \"custom\" order": "로어북을 사용자 지정 순서로 강제 정렬",
  "一键禁用条目递归": "클릭 한 번으로 항목 재귀 비활성화",
  "Disable recursion of worldbook entries in one click": "클릭 한 번으로 항목 재귀 비활성화",
  "预设条目更多按钮: 一键新增预设条目": "프리셋 항목 추가 버튼: 클릭 한 번으로 새 프리셋 항목 추가",
  "More buttons for preset entries: insert new prompt entries in one click": "프리셋 항목 추가 버튼: 클릭 한 번으로 새 프리셋 항목 추가",
  "角色卡绑定预设: 切换到某个角色卡时自动切换为对应预设": "캐릭터 카드에 프리셋 연결: 캐릭터 카드를 바꾸면 연결된 프리셋으로 자동 전환",
  "Binding preset to character: Automatically switch to the corresponding preset when switching to a character card": "캐릭터 카드에 프리셋 연결: 캐릭터 카드를 바꾸면 연결된 프리셋으로 자동 전환",
  "输入助手": "입력 도우미",
  "Input Helper": "입력 도우미",
  "压缩相邻消息: 让 AI 对内容理解更连贯": "인접 메시지 통합: AI가 문맥을 더 자연스럽게 이해하도록 연결",
  "Compress prompts: Make AI understand content more coherent": "인접 메시지 통합: AI가 문맥을 더 자연스럽게 이해하도록 연결",
  "深度条目排斥器: 让深度条目只能在 D0 或 D9999": "깊이 항목 위치 제한: 깊이 항목을 D0 또는 D9999에만 배치",
  "Depth entry excluder: Force depth entries to be inserted at either D0 or D9999": "깊이 항목 위치 제한: 깊이 항목을 D0 또는 D9999에만 배치",
  "token数过多提醒: 防止玩傻子AI": "토큰 초과 알림: AI의 응답 품질 저하 방지",
  "Token count overflow reminder: Prevent playing with stupid AI": "토큰 초과 알림: AI의 응답 품질 저하 방지",
  "取消代码块高亮": "코드 블록 구문 강조 해제",
  "Cancel code block highlight": "코드 블록 구문 강조 해제",
  "世界书繁简互换: 一键将繁体/简体世界书翻译成简体/繁体": "로어북 번체·간체 변환: 클릭 한 번으로 로어북의 번체와 간체 상호 변환",
  "Worldbook Traditional/Simplified Chinese conversion: Translate Worldbook in one click": "로어북 번체·간체 변환: 클릭 한 번으로 로어북의 번체와 간체 상호 변환",
  "正在加载作者备注...": "작성자 메모를 불러오는 중...",
  "Loading author note...": "작성자 메모를 불러오는 중...",
  "正在加载脚本...": "스크립트를 불러오는 중...",
  "Loading scripts...": "스크립트를 불러오는 중...",
  "成功导入脚本: '${0}'": "스크립트 가져오기 완료: '${0}'",
  "Successfully imported script: '${0}'": "스크립트 가져오기 완료: '${0}'",
  "暂无脚本": "스크립트가 없습니다",
  "No scripts": "스크립트가 없습니다",
  "确认": "확인",
  "Confirm": "확인",
  "取消": "취소",
  "Cancel": "취소",
  "编辑文件夹": "폴더 편집",
  "Edit Folder": "폴더 편집",
  "移动文件夹": "폴더 이동",
  "Move Folder": "폴더 이동",
  "导出文件夹": "폴더 내보내기",
  "Export Folder": "폴더 내보내기",
  "删除文件夹": "폴더 삭제",
  "Delete Folder": "폴더 삭제",
  "展开或折叠文件夹": "폴더 펼치기 또는 접기",
  "Expand or Collapse Folder": "폴더 펼치기 또는 접기",
  "创建新文件夹": "새 폴더 만들기",
  "Create New Folder": "새 폴더 만들기",
  "文件夹名称:": "폴더 이름:",
  "Folder Name:": "폴더 이름:",
  "文件夹图标:": "폴더 아이콘:",
  "Folder Icon:": "폴더 아이콘:",
  "请输入文件夹名称": "폴더 이름을 입력하세요",
  "Please enter the folder name": "폴더 이름을 입력하세요",
  "选择颜色": "색상 선택",
  "Select Color": "색상 선택",
  "选择图标": "아이콘 선택",
  "Select Icon": "아이콘 선택",
  "<div>确定要删除文件夹及其中所有脚本吗？此操作无法撤销</div>": "<div>폴더와 그 안의 모든 스크립트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.</div>",
  "确定要删除文件夹及其中所有脚本吗？此操作无法撤销": "폴더와 그 안의 모든 스크립트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
  "<div>Are you sure you want to delete the folder and all its scripts? This operation cannot be undone</div>": "<div>폴더와 그 안의 모든 스크립트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.</div>",
  "Are you sure you want to delete the folder and all its scripts? This operation cannot be undone": "폴더와 그 안의 모든 스크립트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
  "批量开关文件夹内脚本": "폴더 안의 스크립트 모두 켜기/끄기",
  "Toggle all scripts in this folder": "폴더 안의 스크립트 모두 켜기/끄기",
  "酒馆助手脚本-${0}.json": "실리태번 헬퍼 스크립트-${0}.json",
  "tavern_helper_script-${0}.json": "실리태번 헬퍼 스크립트-${0}.json",
  "酒馆助手脚本文件夹-${0}.json": "실리태번 헬퍼 스크립트 폴더-${0}.json",
  "tavern_helper_script_folder-${0}.json": "실리태번 헬퍼 스크립트 폴더-${0}.json",
  "变量": "변수",
  "Variables": "변수",
  "导出选项": "내보내기 옵션",
  "Export Options": "내보내기 옵션",
  "控制此脚本随角色卡/预设导出时是否包含以下内容": "이 스크립트를 캐릭터 카드나 프리셋과 함께 내보낼 때 다음 내용을 포함할지 설정합니다.",
  "Control whether the following content is included when this script is exported with a character card or preset": "이 스크립트를 캐릭터 카드나 프리셋과 함께 내보낼 때 다음 내용을 포함할지 설정합니다.",
  "文件夹导出的脚本将包含以下内容, 请确认是否保留:": "폴더에서 내보낼 스크립트에 다음 내용이 포함됩니다. 유지할 항목을 확인하세요:",
  "folder will export scripts containing the following items. Please confirm whether to keep them:": "폴더에서 내보낼 스크립트에 다음 내용이 포함됩니다. 유지할 항목을 확인하세요:",
  "脚本导出将包含以下内容, 请确认是否保留:": "내보낼 스크립트에 다음 내용이 포함됩니다. 유지할 항목을 확인하세요:",
  "script will be exported with the following items. Please confirm whether to keep them:": "내보낼 스크립트에 다음 내용이 포함됩니다. 유지할 항목을 확인하세요:",
  "编辑脚本": "스크립트 편집",
  "Edit Script": "스크립트 편집",
  "创建新脚本": "새 스크립트 만들기",
  "Create New Script": "새 스크립트 만들기",
  "脚本名称": "스크립트 이름",
  "Script Name": "스크립트 이름",
  "脚本内容": "스크립트 내용",
  "Script Content": "스크립트 내용",
  "展开编辑": "편집기 확장",
  "Expand Editor": "편집기 확장",
  "脚本的 JavaScript 代码": "스크립트의 JavaScript 코드",
  "JavaScript code": "스크립트의 JavaScript 코드",
  "作者备注": "작성자 메모",
  "Author Note": "작성자 메모",
  "脚本备注, 例如作者名、版本和注意事项等, 支持简单的 markdown 和 html": "작성자 이름, 버전, 주의 사항 등의 스크립트 메모입니다. 간단한 markdown과 html을 지원합니다.",
  "Note of this script, such as the author's name, version and notes, etc. Supports simple markdown and html": "작성자 이름, 버전, 주의 사항 등의 스크립트 메모입니다. 간단한 markdown과 html을 지원합니다.",
  "变量列表": "변수 목록",
  "Variable List": "변수 목록",
  "绑定到脚本的变量, 会随脚本一同导出": "스크립트에 연결된 변수이며, 스크립트와 함께 내보내집니다.",
  "Variables bound to the script will be exported together": "스크립트에 연결된 변수이며, 스크립트와 함께 내보내집니다.",
  "按钮": "버튼",
  "Buttons": "버튼",
  "需配合代码里的 getButtonEvent 使用": "코드의 getButtonEvent와 함께 사용해야 합니다.",
  "Cooperate with getButtonEvent in the code": "코드의 getButtonEvent와 함께 사용해야 합니다.",
  "按钮名称": "버튼 이름",
  "Button Name": "버튼 이름",
  "未填写作者备注": "작성자 메모가 없습니다",
  "No author note": "작성자 메모가 없습니다",
  "<div>确定要删除脚本吗? 此操作无法撤销</div>": "<div>스크립트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.</div>",
  "确定要删除脚本吗? 此操作无法撤销": "스크립트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
  "<div>Are you sure you want to delete the script? This operation cannot be undone</div>": "<div>스크립트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.</div>",
  "Are you sure you want to delete the script? This operation cannot be undone": "스크립트를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
  "选择创建目标": "생성 위치 선택",
  "Select target": "생성 위치 선택",
  "全局脚本库": "전역 스크립트 라이브러리",
  "Global Script Library": "전역 스크립트 라이브러리",
  "角色脚本库": "캐릭터 스크립트 라이브러리",
  "Character Script Library": "캐릭터 스크립트 라이브러리",
  "预设脚本库": "프리셋 스크립트 라이브러리",
  "Preset Script Library": "프리셋 스크립트 라이브러리",
  "文件夹": "폴더",
  "Folder": "폴더",
  "导入": "가져오기",
  "Import": "가져오기",
  "内置库": "내장 라이브러리",
  "Built-in Library": "내장 라이브러리",
  "未命名变量": "이름 없는 변수",
  "{{Unnamed Variable}}": "이름 없는 변수",
  "暂无变量值": "변수 값이 없습니다",
  "{{No Variable Value}}": "변수 값이 없습니다",
  "打开": "열기",
  "Open": "열기",
  "批量操作": "일괄 작업",
  "Batch Operation": "일괄 작업",
  "导入脚本文件 '${0}' 失败": "스크립트 파일 '${0}' 가져오기 실패",
  "Failed to import script file '${0}'": "스크립트 파일 '${0}' 가져오기 실패",
  "成功导入脚本文件夹 '${0}'": "스크립트 폴더 '${0}' 가져오기 완료",
  "Successfully imported script folder '${0}'": "스크립트 폴더 '${0}' 가져오기 완료",
  "成功导入脚本 '${0}'": "스크립트 '${0}' 가져오기 완료",
  "Successfully imported script '${0}'": "스크립트 '${0}' 가져오기 완료",
  "查看作者备注": "작성자 메모 보기",
  "View Author Note": "작성자 메모 보기",
  "更多操作": "더보기",
  "More Actions": "더보기",
  "复制脚本": "스크립트 복사",
  "Copy Script": "스크립트 복사",
  "移动脚本": "스크립트 이동",
  "Move Script": "스크립트 이동",
  "导出脚本": "스크립트 내보내기",
  "Export Script": "스크립트 내보내기",
  "删除脚本": "스크립트 삭제",
  "Delete Script": "스크립트 삭제",
  "<div><h4>角色卡 '${0}' 中包含酒馆助手可用的嵌入式脚本</h4><h4>是否现在就启用它们?</h4><small>您可以选择否, 稍后在“酒馆助手-脚本库-角色脚本”中手动启用它们</small></div>": "<div><h4>캐릭터 카드 '${0}'에 실리태번 헬퍼에서 사용할 수 있는 내장 스크립트가 포함되어 있습니다</h4><h4>지금 활성화할까요?</h4><small>아니요를 선택한 뒤 나중에 “실리태번 헬퍼-스크립트 라이브러리-캐릭터 스크립트”에서 직접 활성화할 수 있습니다</small></div>",
  "角色卡 '${0}' 中包含酒馆助手可用的嵌入式脚本": "캐릭터 카드 '${0}'에 실리태번 헬퍼에서 사용할 수 있는 내장 스크립트가 포함되어 있습니다",
  "是否现在就启用它们?": "지금 활성화할까요?",
  "您可以选择否, 稍后在“酒馆助手-脚本库-角色脚本”中手动启用它们": "아니요를 선택한 뒤 나중에 “실리태번 헬퍼-스크립트 라이브러리-캐릭터 스크립트”에서 직접 활성화할 수 있습니다",
  "<div><h4>Character '${0}' contains embedded scripts available for Tavern Helper</h4><h4>Would you like to enable them now?</h4><small>If you want to do it later, enable them in \"Tavern Helper - Script - Character Script\"</small></div>": "<div><h4>캐릭터 카드 '${0}'에 실리태번 헬퍼에서 사용할 수 있는 내장 스크립트가 포함되어 있습니다</h4><h4>지금 활성화할까요?</h4><small>아니요를 선택한 뒤 나중에 “실리태번 헬퍼-스크립트 라이브러리-캐릭터 스크립트”에서 직접 활성화할 수 있습니다</small></div>",
  "Character '${0}' contains embedded scripts available for Tavern Helper": "캐릭터 카드 '${0}'에 실리태번 헬퍼에서 사용할 수 있는 내장 스크립트가 포함되어 있습니다",
  "Would you like to enable them now?": "지금 활성화할까요?",
  "If you want to do it later, enable them in \"Tavern Helper - Script - Character Script\"": "아니요를 선택한 뒤 나중에 “실리태번 헬퍼-스크립트 라이브러리-캐릭터 스크립트”에서 직접 활성화할 수 있습니다",
  "<div><h4>预设 '${0}' 中包含酒馆助手可用的嵌入式脚本</h4><h4>是否现在就启用它们?</h4><small>您可以选择否, 稍后在“酒馆助手-脚本库-预设脚本”中手动启用它们</small></div>": "<div><h4>프리셋 '${0}'에 실리태번 헬퍼에서 사용할 수 있는 내장 스크립트가 포함되어 있습니다</h4><h4>지금 활성화할까요?</h4><small>아니요를 선택한 뒤 나중에 “실리태번 헬퍼-스크립트 라이브러리-프리셋 스크립트”에서 직접 활성화할 수 있습니다</small></div>",
  "预设 '${0}' 中包含酒馆助手可用的嵌入式脚本": "프리셋 '${0}'에 실리태번 헬퍼에서 사용할 수 있는 내장 스크립트가 포함되어 있습니다",
  "您可以选择否, 稍后在“酒馆助手-脚本库-预设脚本”中手动启用它们": "아니요를 선택한 뒤 나중에 “실리태번 헬퍼-스크립트 라이브러리-프리셋 스크립트”에서 직접 활성화할 수 있습니다",
  "<div><h4>Preset '${0}' contains embedded scripts available for Tavern Helper</h4><h4>Would you like to enable them now?</h4><small>If you want to do it later, enable them in \"Tavern Helper - Script - Preset Script\"</small></div>": "<div><h4>프리셋 '${0}'에 실리태번 헬퍼에서 사용할 수 있는 내장 스크립트가 포함되어 있습니다</h4><h4>지금 활성화할까요?</h4><small>아니요를 선택한 뒤 나중에 “실리태번 헬퍼-스크립트 라이브러리-프리셋 스크립트”에서 직접 활성화할 수 있습니다</small></div>",
  "Preset '${0}' contains embedded scripts available for Tavern Helper": "프리셋 '${0}'에 실리태번 헬퍼에서 사용할 수 있는 내장 스크립트가 포함되어 있습니다",
  "If you want to do it later, enable them in \"Tavern Helper - Script - Preset Script\"": "아니요를 선택한 뒤 나중에 “실리태번 헬퍼-스크립트 라이브러리-프리셋 스크립트”에서 직접 활성화할 수 있습니다",
  "本次${0}导出中，以下绑定脚本会连同这些内容一起导出：": "이번 ${0} 내보내기에서 다음 연결된 스크립트의 아래 내용도 함께 내보냅니다:",
  "When exporting ${0}, the following bound scripts will also include these contents:": "이번 ${0} 내보내기에서 다음 연결된 스크립트의 아래 내용도 함께 내보냅니다:",
  "如需调整这些内容的导出行为, 可在对应脚本编辑器的“导出选项”中修改": "포함할 내용을 변경하려면 해당 스크립트 편집기의 “내보내기 옵션”을 수정하세요",
  "To adjust how these contents are exported, edit the corresponding script's \"Export Options\" settings.": "포함할 내용을 변경하려면 해당 스크립트 편집기의 “내보내기 옵션”을 수정하세요",
  "本次${0}导出包含 ${1} 个带变量或按钮的酒馆助手脚本": "이번 ${0} 내보내기에는 변수 또는 버튼이 있는 실리태번 헬퍼 스크립트 ${1}개가 포함됩니다",
  "Exporting ${0}, ${1} TavernHelper scripts with variables or buttons are included.": "이번 ${0} 내보내기에는 변수 또는 버튼이 있는 실리태번 헬퍼 스크립트 ${1}개가 포함됩니다",
  "点此查看详情": "자세히 보기",
  "Click here for details": "자세히 보기",
  "播放器": "오디오 플레이어",
  "Audio Player": "오디오 플레이어",
  "全局音频播放器": "전역 오디오 플레이어",
  "Global audio player": "전역 오디오 플레이어",
  "音乐": "음악",
  "Music": "음악",
  "音效": "효과음",
  "Sound Effect": "효과음",
  "链接": "링크",
  "Link": "링크",
  "播放列表": "재생 목록",
  "Play List": "재생 목록",
  "列表编辑": "재생 목록 편집",
  "Play List Editor": "재생 목록 편집",
  "导入音频链接": "오디오 링크 가져오기",
  "Import Audio Link": "오디오 링크 가져오기",
  "暂无音频": "오디오 없음",
  "No Audio": "오디오 없음",
  "单个添加": "개별 추가",
  "Single Add": "개별 추가",
  "批量导入": "일괄 가져오기",
  "Batch Import": "일괄 가져오기",
  "标题（可选）": "제목(선택)",
  "Title (Optional)": "제목(선택)",
  "音频链接 URL": "오디오 링크 URL",
  "Audio Link URL": "오디오 링크 URL",
  "添加更多": "더 추가",
  "Add More": "더 추가",
  "编辑音频项": "오디오 항목 편집",
  "Edit Audio Item": "오디오 항목 편집",
  "标题": "제목",
  "Title": "제목",
  "留空将自动从链接中提取文件名": "비워 두면 링크에서 파일 이름을 자동으로 가져옵니다",
  "Leave blank to extract filename from link": "비워 두면 링크에서 파일 이름을 자동으로 가져옵니다",
  "音频链接": "오디오 링크",
  "Audio Link": "오디오 링크",
  "音频标题（可选）": "오디오 제목(선택)",
  "Audio Title (Optional)": "오디오 제목(선택)",
  "重复播放所有曲目": "전체 곡 반복",
  "Repeat all tracks": "전체 곡 반복",
  "重复播放当前曲目": "현재 곡 반복",
  "Repeat current track": "현재 곡 반복",
  "随机播放": "무작위 재생",
  "Shuffle play": "무작위 재생",
  "播放当前曲目并停止": "현재 곡 재생 후 정지",
  "Play current track and stop": "현재 곡 재생 후 정지",
  "<div>确定要删除音频吗? 此操作无法撤销</div>": "<div>오디오를 삭제할까요? 이 작업은 되돌릴 수 없습니다</div>",
  "确定要删除音频吗? 此操作无法撤销": "오디오를 삭제할까요? 이 작업은 되돌릴 수 없습니다",
  "<div>Are you sure you want to delete the audio? This operation cannot be undone</div>": "<div>오디오를 삭제할까요? 이 작업은 되돌릴 수 없습니다</div>",
  "Are you sure you want to delete the audio? This operation cannot be undone": "오디오를 삭제할까요? 이 작업은 되돌릴 수 없습니다",
  "每行一个链接，可选格式：URL 或 URL,标题": "한 줄에 링크 하나씩 입력하세요. 형식: URL 또는 URL,제목",
  "Each line should contain a link, optionally with a title in the format: URL or URL,Title": "한 줄에 링크 하나씩 입력하세요. 형식: URL 또는 URL,제목",
  "示例：\nhttps://example.com/audio1.mp3\nhttps://example.com/audio2.mp3,我的音乐\nhttps://example.com/audio3.mp3": "예시:\nhttps://example.com/audio1.mp3\nhttps://example.com/audio2.mp3,내 음악\nhttps://example.com/audio3.mp3",
  "Example:\nhttps://example.com/audio1.mp3\nhttps://example.com/audio2.mp3,My Music\nhttps://example.com/audio3.mp3": "예시:\nhttps://example.com/audio1.mp3\nhttps://example.com/audio2.mp3,내 음악\nhttps://example.com/audio3.mp3",
  "已复制全部提示词到剪贴板": "모든 프롬프트를 클립보드에 복사했습니다",
  "All prompts have been copied to the clipboard": "모든 프롬프트를 클립보드에 복사했습니다",
  "已复制提示词到剪贴板": "프롬프트를 클립보드에 복사했습니다",
  "Prompt has been copied to the clipboard": "프롬프트를 클립보드에 복사했습니다",
  "总token数": "총 토큰 수",
  "Token Count": "총 토큰 수",
  "${0}/${1} 条消息": "메시지 ${0}/${1}개",
  "${0}/${1} messages": "메시지 ${0}/${1}개",
  "搜索消息内容...": "메시지 내용 검색...",
  "Search message content...": "메시지 내용 검색...",
  "过滤": "필터",
  "Filter": "필터",
  "仅显示匹配": "일치하는 항목만 표시",
  "only-matched": "일치하는 항목만 표시",
  "等待已有生成请求完成... (或用刷新按钮强制取消它)": "기존 생성 요청이 완료되기를 기다리는 중... (새로고침 버튼으로 강제 취소할 수 있습니다)",
  "Waiting for the existing generation request to complete... (or use the refresh button to forcely cancel it)": "기존 생성 요청이 완료되기를 기다리는 중... (새로고침 버튼으로 강제 취소할 수 있습니다)",
  "正在发送虚假生成请求, 从而获取最新提示词...": "최신 프롬프트를 가져오기 위해 모의 생성 요청을 보내는 중...",
  "Sending a fake generation request to get the latest prompts...": "최신 프롬프트를 가져오기 위해 모의 생성 요청을 보내는 중...",
  "正在获取生成请求中的提示词...": "생성 요청에서 프롬프트를 가져오는 중...",
  "Getting prompts from the generation request...": "생성 요청에서 프롬프트를 가져오는 중...",
  "当前 API 不是聊天补全, 无法使用提示词查看器功能": "현재 API가 채팅 완성 방식이 아니므로 프롬프트 뷰어를 사용할 수 없습니다",
  "The current API is not 'chat completion', cannot use the Prompt Viewer": "현재 API가 채팅 완성 방식이 아니므로 프롬프트 뷰어를 사용할 수 없습니다",
  "未连接到 API, 提示词查看器将无法获取数据": "API에 연결되지 않아 프롬프트 뷰어에서 데이터를 가져올 수 없습니다",
  "Not connected to API, the Prompt Viewer will not retrieve data": "API에 연결되지 않아 프롬프트 뷰어에서 데이터를 가져올 수 없습니다",
  "工具调用": "도구 호출",
  "Tool Call": "도구 호출",
  "收起内容": "내용 접기",
  "Collapse Content": "내용 접기",
  "展开": "펼치기",
  "Expand": "펼치기",
  "行隐藏内容": "줄의 숨겨진 내용",
  "Lines of Hidden Content": "줄의 숨겨진 내용",
  "收起图片": "이미지 접기",
  "Collapse Images": "이미지 접기",
  "显示图片": "이미지 표시",
  "Show Images": "이미지 표시",
  "日志查看器": "로그 뷰어",
  "Log Viewer": "로그 뷰어",
  "查看脚本和渲染界面的控制台日志": "스크립트와 렌더링 화면의 콘솔 로그 보기",
  "View Script and Render Console Logs": "스크립트와 렌더링 화면의 콘솔 로그 보기",
  "清除日志": "로그 지우기",
  "Clear Logs": "로그 지우기",
  "所有日志": "모든 로그",
  "All Logs": "모든 로그",
  "搜索日志内容...": "로그 내용 검색...",
  "Search log content...": "로그 내용 검색...",
  "详细": "상세",
  "Debug": "상세",
  "错误": "오류",
  "Error": "오류",
  "信息": "정보",
  "Info": "정보",
  "警告": "경고",
  "Warn": "경고",
  "消息": "메시지",
  "Message": "메시지 번호",
  "第${0}楼-第${1}个界面": "메시지 ${0}번 - 화면 ${1}번",
  "Floor ${0} - View ${1}": "메시지 ${0}번 - 화면 ${1}번",
  "全局": "전역",
  "Global": "전역",
  "预设": "프리셋",
  "Preset": "프리셋",
  "角色": "캐릭터",
  "Character": "캐릭터",
  "聊天": "채팅",
  "Chat": "채팅",
  "消息楼层": "메시지 번호",
  "追踪最新": "최신 로그 따라가기",
  "Track Latest": "최신 로그 따라가기",
  "正序显示": "오래된 순으로 표시",
  "In Order": "오래된 순으로 표시",
  "楼": "번 메시지",
  "message id": "번 메시지",
  "最新楼层号": "최신 메시지 번호",
  "latest message id": "최신 메시지 번호",
  "第 ${0} 楼": "메시지 ${0}번",
  "#${0}": "메시지 ${0}번",
  "模型": "모델",
  "Model": "모델",
  "体验优化": "사용 편의 개선",
  "User Experience Optimization": "사용 편의 개선",
  "性能": "성능",
  "Performance": "성능",
  "角色卡": "캐릭터 카드",
  "Character Card": "캐릭터 카드",
  "世界书": "로어북",
  "Worldbook": "로어북",
  "杂项": "기타",
  "Miscellaneous": "기타",
  "联动和绑定": "연동 및 연결",
  "Linking & Binding": "연동 및 연결",
  "模型上下文处理": "모델 컨텍스트 처리",
  "Model Context": "모델 컨텍스트 처리",
  "禁用不兼容选项": "호환되지 않는 옵션 비활성화",
  "Disable incompatible options": "호환되지 않는 옵션 비활성화",
  "[要加载 # 条消息] → [要渲染 # 条消息]": "[불러올 메시지 수: #] → [렌더링할 메시지 수: #]",
  "[# Msg. to Load] → [# Msg. to Render]": "[불러올 메시지 수: #] → [렌더링할 메시지 수: #]",
  "使用[替换/更新角色卡]功能时更新世界书": "[캐릭터 카드 교체/업데이트] 사용 시 로어북 업데이트",
  "Update worldbook when using [Replace/Update]": "[캐릭터 카드 교체/업데이트] 사용 시 로어북 업데이트",
  "导出角色卡时始终携带最新世界书": "캐릭터 카드 내보내기 시 항상 최신 로어북 포함",
  "Always export the latest worldbook when exporting character cards": "캐릭터 카드 내보내기 시 항상 최신 로어북 포함",
  "删除角色卡时删除绑定的主要世界书": "캐릭터 카드 삭제 시 연결된 기본 로어북 삭제",
  "Delete bound primary worldbook when deleting character cards": "캐릭터 카드 삭제 시 연결된 기본 로어북 삭제",
  "强制使用推荐的世界书全局设置": "권장 로어북 전역 설정 강제 적용",
  "Forcely use recommended worldbook global settings": "권장 로어북 전역 설정 강제 적용",
  "保存预设条目时直接保存预设": "프리셋 항목 저장 시 프리셋도 바로 저장",
  "Save preset when saving preset entries": "프리셋 항목 저장 시 프리셋도 바로 저장",
  "最大化预设上下文长度": "프리셋 컨텍스트 길이 최대화",
  "Maximize preset context length": "프리셋 컨텍스트 길이 최대화",
  "切换预设时提醒还没有保存": "프리셋 전환 시 저장하지 않은 변경 사항 알림",
  "Remind saving the current preset before switching to another preset": "프리셋 전환 시 저장하지 않은 변경 사항 알림",
  "折叠": "접기",
  "[酒馆助手]连接实时监听器出错, 尝试重连...": "[실리태번 헬퍼] 실시간 리스너 연결 오류. 다시 연결하는 중...",
  "编写变量角色卡而非测试/游玩角色卡时，打开此开关，避免 \\{\\{get_message_variable::变量\\}\\} 等宏被替换": "변수를 사용하는 캐릭터 카드를 테스트하거나 플레이하는 대신 작성할 때 켜면 \\{\\{get_message_variable::变量\\}\\} 등의 매크로가 치환되지 않습니다.",
  "正在加载说明...": "설명을 불러오는 중...",
  "对脚本附加的界面如悬浮球等进行兜底清理, 避免脚本关闭后界面残留；但遇到这种情况更建议提醒脚本作者修复": "스크립트를 꺼도 플로팅 버튼 등의 추가 화면 요소가 남지 않도록 정리합니다. 이런 문제가 발생하면 스크립트 작성자에게 수정을 요청하는 것이 좋습니다.",
  "确定": "확인",
  "启用流式渲染可能与某些脚本、插件或酒馆美化不兼容，导致界面异常或功能失效。是否继续？": "스트리밍 렌더링은 일부 스크립트, 플러그인 또는 실리태번 테마와 호환되지 않아 화면이나 기능에 문제가 생길 수 있습니다. 계속할까요?",
  "虚拟化聊天不支持流式渲染": "채팅 가상화는 스트리밍 렌더링을 지원하지 않습니다",
  "JavaScript 代码": "JavaScript 코드",
  "备注文本": "메모 내용",
  "示例：&#10;https://example.com/audio1.mp3&#10;https://example.com/audio2.mp3,我的音乐&#10;https://example.com/audio3.mp3": "예시:&#10;https://example.com/audio1.mp3&#10;https://example.com/audio2.mp3,내 음악&#10;https://example.com/audio3.mp3",
  "重新渲染第 ${0} 楼": "${0}번 메시지 다시 렌더링",
  "已重新渲染第 ${0} 楼": "${0}번 메시지를 다시 렌더링했습니다",
  "菜单": "메뉴",
  "新增变量": "변수 추가",
  "删除": "삭제",
  "键名不能为空": "키 이름을 입력하세요",
  "编辑失败": "편집 실패",
  "已更新键名": "키 이름을 변경했습니다",
  "编辑成功": "편집 완료",
  "已添加到数组": "배열에 추가했습니다",
  "重命名失败": "이름 변경 실패",
  "键名已存在": "이미 존재하는 키 이름입니다",
  "新增变量失败": "변수 추가 실패",
  "已添加到对象": "객체에 추가했습니다",
  "删除全部": "모두 삭제",
  "暂无可删除的变量": "삭제할 변수가 없습니다",
  "暂无变量，点击上方“新增变量”创建": "변수가 없습니다. 위의 ‘변수 추가’를 눌러 만드세요.",
  "当前没有可删除的变量": "현재 삭제할 변수가 없습니다",
  "已删除全部变量": "모든 변수를 삭제했습니다",
  "删除成功": "삭제 완료",
  "搜索变量(支持正则表达式 )": "변수 검색(정규식 지원)",
  "已删除变量": "변수를 삭제했습니다",
  "已清空对象": "객체를 비웠습니다",
  "已清空数组": "배열을 비웠습니다",
  "已重置为对象": "객체로 초기화했습니다",
  "确定要删除此变量吗？此操作不可撤销": "이 변수를 삭제할까요? 이 작업은 되돌릴 수 없습니다.",
  "+ 脚本": "+ 스크립트",
  "+ Script": "+ 스크립트",
  "+ 文件夹": "+ 폴더",
  "+ Folder": "+ 폴더",
  "New!": "새 버전!",
  "总token数: ${0}": "총 토큰 수: ${0}",
  "Token Count: ${0}": "총 토큰 수: ${0}",
  "模型: ${0}": "모델: ${0}",
  "Model: ${0}": "모델: ${0}",
  "预设: ${0}": "프리셋: ${0}",
  "Preset: ${0}": "프리셋: ${0}",
  "最新楼层号: ${0}": "최신 메시지 번호: ${0}",
  "latest message id: ${0}": "최신 메시지 번호: ${0}",
  "工具调用 (${0})": "도구 호출 (${0})",
  "Tool Call (${0})": "도구 호출 (${0})",
  "展开 ${0} 行隐藏内容": "숨겨진 ${0}줄 펼치기",
  "Expand ${0} Lines of Hidden Content": "숨겨진 ${0}줄 펼치기",
  "显示图片(${0})": "이미지 표시(${0})",
  "Show Images(${0})": "이미지 표시(${0})",
  "脚本 | ${0}": "스크립트 | ${0}",
  "Script | ${0}": "스크립트 | ${0}",
  "【脚本 | ${0}】:": "【스크립트 | ${0}】:",
  "【Script | ${0}】:": "【스크립트 | ${0}】:",
  "消息 | 第${0}楼-第${1}个界面": "메시지 | ${0}번 메시지-${1}번째 화면",
  "Message | 第${0}楼-第${1}个界面": "메시지 | ${0}번 메시지-${1}번째 화면",
  "【消息 | 第${0}楼-第${1}个界面】:": "【메시지 | ${0}번 메시지-${1}번째 화면】:",
  "【Message | 第${0}楼-第${1}个界面】:": "【메시지 | ${0}번 메시지-${1}번째 화면】:",
  "'${0}' 文件夹导出的脚本将包含以下内容, 请确认是否保留:": "'${0}' 폴더에서 내보낼 스크립트에 다음 내용이 포함됩니다. 유지할 항목을 확인하세요:",
  "'${0}' folder will export scripts containing the following items. Please confirm whether to keep them:": "'${0}' 폴더에서 내보낼 스크립트에 다음 내용이 포함됩니다. 유지할 항목을 확인하세요:",
  "'${0}' 脚本导出将包含以下内容, 请确认是否保留:": "'${0}' 스크립트를 내보낼 때 다음 내용이 포함됩니다. 유지할 항목을 확인하세요:",
  "'${0}' script will be exported with the following items. Please confirm whether to keep them:": "'${0}' 스크립트를 내보낼 때 다음 내용이 포함됩니다. 유지할 항목을 확인하세요:"
};
  const HELP = {
  "titles": [
    "Always export the latest worldbook when exporting character cards",
    "导出角色卡时始终携带最新世界书",
    "Update worldbook when using Replace/Update",
    "使用替换/更新角色卡功能时更新世界书",
    "# Msg. to Load → # Msg. to Render",
    "要加载 # 条消息 → 要渲染 # 条消息",
    "Disable incompatible options",
    "禁用不兼容选项",
    "Forcely use recommended worldbook global settings",
    "强制使用推荐的世界书全局设置",
    "Maximize preset context length",
    "最大化预设上下文长度",
    "Prompt Viewer always shows the latest prompts:",
    "提示词查看器始终显示最新提示词:"
  ],
  "blocks": {
    "Always export the latest worldbook when exporting character cards": "캐릭터 카드 내보내기 시 항상 최신 로어북 포함",
    "When exporting character cards, vanilla SillyTavern may export stale worldbooks: If you modify the worldbook entry and immediately export the character card, the worldbook data in the exported character card file may be the one before the modification.": "기본 실리태번은 캐릭터 카드를 내보낼 때 오래된 로어북을 내보낼 수 있습니다. 로어북 항목을 수정한 직후 캐릭터 카드를 내보내면, 내보낸 캐릭터 카드 파일에 수정 전 로어북 데이터가 들어 있을 수 있습니다.",
    "This optimization fixes this: When enabled, exporting a character card will always export the latest worldbook.": "이 최적화는 이 문제를 해결합니다. 켜 두면 캐릭터 카드를 내보낼 때 항상 최신 로어북이 함께 내보내집니다.",
    "导出角色卡时始终携带最新世界书": "캐릭터 카드 내보내기 시 항상 최신 로어북 포함",
    "原生酒馆导出角色卡时, 可能导出陈旧的世界书: 在修改世界书条目后立即导出角色卡, 角色卡文件中很可能包含的是修改前的世界书数据.": "기본 실리태번은 캐릭터 카드를 내보낼 때 오래된 로어북을 내보낼 수 있습니다. 로어북 항목을 수정한 직후 캐릭터 카드를 내보내면, 내보낸 캐릭터 카드 파일에 수정 전 로어북 데이터가 들어 있을 수 있습니다.",
    "本优化就是为了修正这一点: 开启这个选项后, 导出角色卡时必然携带最新世界书.": "이 최적화는 이 문제를 해결합니다. 켜 두면 캐릭터 카드를 내보낼 때 항상 최신 로어북이 함께 내보내집니다.",
    "Update worldbook when using Replace/Update": "<code>캐릭터 카드 교체/업데이트</code> 사용 시 로어북 업데이트",
    "SillyTavern has a More... → Replace/Update function in the character card panel.": "실리태번의 캐릭터 카드 패널에는 <code>추가 설정들... → 교체/업데이트</code> 기능이 있습니다.",
    "However, through this function, vanilla SillyTavern only updates the character card itself (avatar, description, first message etc.), not the worldbook data that has already been imported.": "하지만 기본 실리태번은 이 기능을 써도 캐릭터 카드 자체(아바타, 설명, 첫 메시지 등)만 업데이트하고, 이미 가져온 로어북 데이터는 업데이트하지 않습니다.",
    "This optimization fixes this: When enabled, Replace/Update will also update the worldbook bound to the character card.": "이 최적화는 이 문제를 해결합니다. 켜 두면 <code>교체/업데이트</code> 시 캐릭터 카드에 연결된 로어북도 함께 업데이트됩니다.",
    "使用替换/更新角色卡功能时更新世界书": "<code>캐릭터 카드 교체/업데이트</code> 사용 시 로어북 업데이트",
    "酒馆的角色卡面板中有更多... → 替换/更新角色卡功能.": "실리태번의 캐릭터 카드 패널에는 <code>추가 설정들... → 교체/업데이트</code> 기능이 있습니다.",
    "但使用这个功能更新角色卡时, 原生酒馆只会更新角色卡面板上的信息 (角色头像、角色描述、第一条消息等), 不会更新之前已经导入的世界书数据.": "하지만 기본 실리태번은 이 기능을 써도 캐릭터 카드 자체(아바타, 설명, 첫 메시지 등)만 업데이트하고, 이미 가져온 로어북 데이터는 업데이트하지 않습니다.",
    "本优化就是为了修正这一点: 开启这个选项后, 替换/更新角色卡将会同时更新角色卡绑定的世界书.": "이 최적화는 이 문제를 해결합니다. 켜 두면 <code>교체/업데이트</code> 시 캐릭터 카드에 연결된 로어북도 함께 업데이트됩니다.",
    "# Msg. to Load → # Msg. to Render": "<code>불러올 메시지 수: #</code> → <code>렌더링할 메시지 수: #</code>",
    "Optimize the function of 👤 on the top bar - # Msg. to Load: Originally, it only limited the number of messages displayed when loading chat, but now it also limits the maximum number of messages displayed during the whole gameplay.": "<code>상단 바의 👤 → 로딩할 메시지 수</code> 기능을 개선합니다. 원래는 채팅을 불러올 때 표시되는 메시지 수만 제한했지만, 이제는 플레이하는 내내 화면에 표시되는 최대 메시지 수도 제한합니다.",
    "For example, if you set # Msg. to Load to 5, the page will display at most 5 messages.": "예를 들어 <code>로딩할 메시지 수</code>를 5로 설정하면 페이지에는 최대 5개의 메시지만 표시됩니다.",
    "When a new message or new reply is sent, the old messages will be automatically canceled rendering: the displayed messages change from 4,5,6,7,8 to 5,6,7,8,9": "새 메시지를 보내거나 새 답변을 받으면 오래된 메시지는 자동으로 렌더링이 해제됩니다. 표시되는 메시지가 <code>4,5,6,7,8</code>에서 <code>5,6,7,8,9</code>로 바뀝니다.",
    "When a message is deleted, the old messages will be automatically completed: the displayed messages change from 5,6,7,8,9 to 4,5,6,7,8": "메시지를 삭제하면 이전 메시지가 자동으로 다시 채워집니다. 표시되는 메시지가 <code>5,6,7,8,9</code>에서 <code>4,5,6,7,8</code>로 바뀝니다.",
    "This way, the tavern will always only render a few floors during gameplay, making the gameplay more流畅.": "이렇게 하면 플레이 중에도 실리태번이 항상 몇 개의 메시지만 렌더링하므로 더 부드럽게 플레이할 수 있습니다.",
    "Additionally, originally SillyTavern only allowed # Msg. to Load to be set to a multiple of 5, but now you can set it to any non-negative number, such as 1 to only display the most recent 1 message.": "또한 원래 실리태번은 <code>로딩할 메시지 수</code>를 5의 배수로만 설정할 수 있었지만, 이제는 0 이상의 아무 숫자로나 설정할 수 있습니다. 예를 들어 1로 설정하면 가장 최근 메시지 1개만 표시됩니다.",
    "要加载 # 条消息 → 要渲染 # 条消息": "<code>불러올 메시지 수: #</code> → <code>렌더링할 메시지 수: #</code>",
    "优化酒馆上方人头👤-要加载 # 条消息的作用: 原本它只是限制加载聊天时显示的楼层数量, 而现在, 它还会限制游玩酒馆过程中最多显示的楼层数量.": "<code>상단 바의 👤 → 로딩할 메시지 수</code> 기능을 개선합니다. 원래는 채팅을 불러올 때 표시되는 메시지 수만 제한했지만, 이제는 플레이하는 내내 화면에 표시되는 최대 메시지 수도 제한합니다.",
    "例如, 如果设置要加载 # 条消息为 5, 则页面将最多显示 5 个楼层.": "예를 들어 <code>로딩할 메시지 수</code>를 5로 설정하면 페이지에는 최대 5개의 메시지만 표시됩니다.",
    "当发送新消息或收到新回复时, 旧楼层将会被自动取消渲染: 显示的楼层从4,5,6,7,8 变成 5,6,7,8,9": "새 메시지를 보내거나 새 답변을 받으면 오래된 메시지는 자동으로 렌더링이 해제됩니다. 표시되는 메시지가 <code>4,5,6,7,8</code>에서 <code>5,6,7,8,9</code>로 바뀝니다.",
    "当删除楼层时, 旧楼层将自动补全出来: 显示的楼层从 5,6,7,8,9 变成 4,5,6,7,8": "메시지를 삭제하면 이전 메시지가 자동으로 다시 채워집니다. 표시되는 메시지가 <code>5,6,7,8,9</code>에서 <code>4,5,6,7,8</code>로 바뀝니다.",
    "这样一来, 在游玩过程中酒馆始终只会渲染几个楼层, 因而游玩酒馆会更加流畅.": "이렇게 하면 플레이 중에도 실리태번이 항상 몇 개의 메시지만 렌더링하므로 더 부드럽게 플레이할 수 있습니다.",
    "此外, 原本酒馆只允许要加载 # 条消息设置为 5 的倍数, 现在你可以设置为任意非负数, 如设置为 1 来只显示聊天中最近的 1 楼消息.": "또한 원래 실리태번은 <code>로딩할 메시지 수</code>를 5의 배수로만 설정할 수 있었지만, 이제는 0 이상의 아무 숫자로나 설정할 수 있습니다. 예를 들어 1로 설정하면 가장 최근 메시지 1개만 표시됩니다.",
    "Disable incompatible options": "호환되지 않는 옵션 비활성화",
    "Forcely disable/enable some settings in SillyTavern, which are not recommended to set to the opposite value during normal gameplay:": "실리태번의 일부 설정을 강제로 끄거나 켭니다. 일반적인 플레이 중에는 반대 값으로 바꾸는 것을 권장하지 않는 설정들입니다:",
    "Auto-fix Markdown → Off": "마크다운 자동 수정 → 끔",
    "Trim Incomplete Sentences → Off": "불완전한 문장 자르기 → 끔",
    "Forbid External Media → Off": "외부 미디어 금지 → 끔",
    "Show <tags> in responses → Off": "응답에서 태그 표시 → 끔",
    "Show {{char}}: in responses → On": "봇 메시지에서 {{char}}: 허용 → 켬",
    "Show {{user}}: in responses → On": "봇 메시지에서 {{user}}: 허용 → 켬",
    "禁用不兼容选项": "호환되지 않는 옵션 비활성화",
    "强制禁用/启用酒馆中某些设置, 正常游玩酒馆时不可能需要调整这些设置:": "실리태번의 일부 설정을 강제로 끄거나 켭니다. 일반적인 플레이 중에는 반대 값으로 바꾸는 것을 권장하지 않는 설정들입니다:",
    "自动修复生成的 Markdown → 关": "마크다운 자동 수정 → 끔",
    "修剪不完整的句子 → 关": "불완전한 문장 자르기 → 끔",
    "禁止外部媒体 → 关": "외부 미디어 금지 → 끔",
    "在响应中显示标签 → 关": "응답에서 태그 표시 → 끔",
    "在机器人消息中允许{{char}} → 开": "봇 메시지에서 {{char}}: 허용 → 켬",
    "在机器人消息中允许{{user}} → 开": "봇 메시지에서 {{user}}: 허용 → 켬",
    "Forcely use recommended worldbook global settings": "권장 로어북 전역 설정 강제 적용",
    "Specifically, the recommended global settings are as follows:": "권장 전역 설정은 구체적으로 다음과 같습니다:",
    "Scan Depth: 2": "스캔 깊이: 2",
    "Context %: 100": "컨텍스트 %: 100",
    "Budget Cap: 0": "예산 한도: 0",
    "Min Activations: 0": "최소 활성화: 0",
    "Max Depth: 0": "최대 깊이: 0",
    "Max Recursion Steps: 0": "최대 재귀 단계: 0",
    "Insertion Strategy: Character Lore First": "삽입 전략: 캐릭터 로어 우선",
    "Include Names: false": "이름 포함: 끔",
    "Recursive Scan: true": "재귀 스캔: 켬",
    "Case Sensitive: false": "대소문자 구분: 끔",
    "Match Whole Words: false": "전체 단어 일치: 끔",
    "Use Group Scoring: false": "그룹 점수 사용: 끔",
    "Alert On Overflow: false": "오버플로우 알림: 끔",
    "Currently, character card authors take these global settings as a default, so there is no need for you to modify them.": "현재 캐릭터 카드 제작자들은 이 전역 설정을 기본값으로 삼고 있으므로, 직접 수정할 필요가 없습니다.",
    "However, some old worldbooks may require you to disable recursive scan. In this case, please use the \"Disable recursion of worldbook entries in one click\" script in the built-in library to process it.": "다만 일부 오래된 로어북은 재귀 스캔을 꺼야 할 수도 있습니다. 이 경우 내장 라이브러리의 \"클릭 한 번으로 항목 재귀 비활성화\" 스크립트로 처리하세요.",
    "强制使用推荐的世界书全局设置": "권장 로어북 전역 설정 강제 적용",
    "具体地, 推荐的全局设置如下:": "권장 전역 설정은 구체적으로 다음과 같습니다:",
    "扫描深度: 2": "스캔 깊이: 2",
    "上下文百分比: 100": "컨텍스트 %: 100",
    "Token 预算上限: 0": "예산 한도: 0",
    "最小激活数: 0": "최소 활성화: 0",
    "最大深度: 0": "최대 깊이: 0",
    "最大递归深度: 0": "최대 재귀 단계: 0",
    "插入策略: 角色世界书优先": "삽입 전략: 캐릭터 로어 우선",
    "包括名称: false": "이름 포함: 끔",
    "递归扫描: true": "재귀 스캔: 켬",
    "区分大小写: false": "대소문자 구분: 끔",
    "匹配整个单词: false": "전체 단어 일치: 끔",
    "使用群组评分: false": "그룹 점수 사용: 끔",
    "溢出警报: false": "오버플로우 알림: 끔",
    "现在角色卡作者默认均会用这样的全局设置, 本来就没有你去修改的必要.": "현재 캐릭터 카드 제작자들은 이 전역 설정을 기본값으로 삼고 있으므로, 직접 수정할 필요가 없습니다.",
    "然而, 有的旧世界书会需要 \"禁止递归扫描\". 这时请去内置库中使用 \"一键禁用条目递归\" 脚本, 对它进行处理.": "다만 일부 오래된 로어북은 재귀 스캔을 꺼야 할 수도 있습니다. 이 경우 내장 라이브러리의 \"클릭 한 번으로 항목 재귀 비활성화\" 스크립트로 처리하세요.",
    "Maximize preset context length": "프리셋 컨텍스트 길이 최대화",
    "When enabled, the Context Size (tokens) in preset panel will be locked to the maximum (200w), which avoids SillyTavern incorrectly truncating the prompt that could be sent to the AI completely.": "켜 두면 프리셋 패널의 <code>컨텍스트 크기 (토큰)</code>이 최댓값(200만)으로 고정되어, AI에게 온전히 보낼 수 있는 프롬프트를 실리태번이 잘못 잘라내는 일을 막아 줍니다.",
    "Context Size (tokens) is only a limit set by SillyTavern on the prompt: Before sending the prompt to the AI, SillyTavern will check if the prompt length exceeds this limit; if it exceeds, it will only send the part of the prompt that does not exceed the limit to the AI.": "<code>컨텍스트 크기 (토큰)</code>은 실리태번이 프롬프트에 거는 제한일 뿐입니다. 실리태번은 프롬프트를 AI에게 보내기 전에 길이가 이 제한을 넘는지 확인하고, 넘으면 제한을 넘지 않는 부분만 AI에게 보냅니다.",
    "But SillyTavern cannot accurately calculate the token count of the prompt, and some SillyTavern extensions will additionally process the prompt (such as Tavern helper macros will be replaced, ST-Prompt-Template will only send prompts whose if is true, etc.), so the token count calculated by SillyTavern is often much higher than the actual token count.": "하지만 실리태번은 프롬프트의 토큰 수를 정확히 계산하지 못하고, 일부 확장 프로그램은 프롬프트를 추가로 가공하기 때문에(예: 실리태번 헬퍼 매크로는 치환되고, ST-Prompt-Template은 <code>if</code>가 <code>true</code>인 프롬프트만 보내는 등) 실리태번이 계산한 토큰 수는 실제보다 훨씬 높은 경우가 많습니다.",
    "Therefore, a too low Context Size (tokens) will cause SillyTavern to incorrectly truncate the prompt that can be sent to the AI, and locking it to the maximum value can fix this issue without any negative impact on the game.": "따라서 <code>컨텍스트 크기 (토큰)</code>이 너무 낮으면 실리태번이 AI에게 보낼 수 있는 프롬프트를 잘못 잘라내게 되며, 최댓값으로 고정하면 플레이에 아무런 악영향 없이 이 문제를 해결할 수 있습니다.",
    "最大化预设上下文长度": "프리셋 컨텍스트 길이 최대화",
    "启用后, 预设面板的上下文长度 (以词符数计) 将会被锁定成最大 (200w), 从而避免酒馆错误地截断本来可以完整发给 AI 的提示词.": "켜 두면 프리셋 패널의 <code>컨텍스트 크기 (토큰)</code>이 최댓값(200만)으로 고정되어, AI에게 온전히 보낼 수 있는 프롬프트를 실리태번이 잘못 잘라내는 일을 막아 줍니다.",
    "上下文长度 (以词符数计)只是酒馆对提示词最大 token 数施加的限制: 在把提示词发送给 AI 前, 酒馆会先检查提示词长度是否超过这个限制; 如果超过则只截取部分提示词发给 AI.": "<code>컨텍스트 크기 (토큰)</code>은 실리태번이 프롬프트에 거는 제한일 뿐입니다. 실리태번은 프롬프트를 AI에게 보내기 전에 길이가 이 제한을 넘는지 확인하고, 넘으면 제한을 넘지 않는 부분만 AI에게 보냅니다.",
    "但酒馆本就无法精确计算提示词 token 数, 再加上一些插件会对提示词进行处理 (例如酒馆助手宏会被替换, 提示词模板只有 if 成立的提示词才会真的发送......), 酒馆所计算出的 token 数往往比实际 token 数高出非常多.": "하지만 실리태번은 프롬프트의 토큰 수를 정확히 계산하지 못하고, 일부 확장 프로그램은 프롬프트를 추가로 가공하기 때문에(예: 실리태번 헬퍼 매크로는 치환되고, ST-Prompt-Template은 <code>if</code>가 <code>true</code>인 프롬프트만 보내는 등) 실리태번이 계산한 토큰 수는 실제보다 훨씬 높은 경우가 많습니다.",
    "因此, 预设上下文长度太低只会让酒馆错误地截断本来可以完整发给 AI 的提示词, 将它锁定成最大值可以避免这种情况, 并且不会对游玩产生负面影响.": "따라서 <code>컨텍스트 크기 (토큰)</code>이 너무 낮으면 실리태번이 AI에게 보낼 수 있는 프롬프트를 잘못 잘라내게 되며, 최댓값으로 고정하면 플레이에 아무런 악영향 없이 이 문제를 해결할 수 있습니다.",
    "Prompt Viewer always shows the latest prompts:": "프롬프트 뷰어는 <u><strong>항상 최신 프롬프트를 보여 줍니다</strong></u>:",
    "When opening Prompt Viewer": "프롬프트 뷰어를 열 때",
    "When opening Prompt Viewer, it will send a fake generation request, which is equivalent to clicking the send button right now. Then, Prompt Viewer will wait for SillyTavern processing the prompts to send, intercept prompts (in order not to really sent them to AI), and thus obtain the latest prompts.": "프롬프트 뷰어를 열면 가짜 생성 요청을 보냅니다. 지금 바로 전송 버튼 <i class=\"fa-solid fa-paper-plane\"></i>을 누른 것과 같습니다. 그런 다음 실리태번이 보낼 프롬프트를 처리할 때까지 기다렸다가, 프롬프트를 가로채서(실제로 AI에게 보내지 않도록) 최신 프롬프트를 가져옵니다.",
    "When clicking the refresh button": "새로고침 버튼 <i class=\"fa-solid fa-rotate-right\"></i>을 누를 때",
    "Each time the refresh button is clicked, the viewer will also send a fake generation request.": "새로고침 버튼을 누를 때마다 뷰어가 가짜 생성 요청을 다시 보냅니다.",
    "When a generation request is actually sent": "실제로 생성 요청을 보낼 때",
    "Regardless of whether you:": "다음 중 어떤 방법을 쓰든:",
    "Click the send button": "전송 버튼 <i class=\"fa-solid fa-paper-plane\"></i> 클릭",
    "Use the generate、generateRaw function of Tavern Helper": "실리태번 헬퍼의 <code>generate</code>, <code>generateRaw</code> 함수 사용",
    "Any other ways to send prompts through SillyTavern": "그 밖에 실리태번을 통해 프롬프트를 보내는 모든 방법",
    "Prompt Viewer will listen to the generation request and obtain the latest prompts.": "프롬프트 뷰어가 생성 요청을 감지해 최신 프롬프트를 가져옵니다.",
    "提示词查看器始终显示最新提示词:": "프롬프트 뷰어는 <u><strong>항상 최신 프롬프트를 보여 줍니다</strong></u>:",
    "打开提示词查看器时": "프롬프트 뷰어를 열 때",
    "在打开提示词查看器时, 查看器将会发送一条虚假的生成请求, 相当于你在此时点击了输入框发送按钮 . 然后, 查看器将会等待酒馆处理完毕, 拦截下这段提示词 (不真的发给 AI), 从而获得最新提示词发送情况.": "프롬프트 뷰어를 열면 가짜 생성 요청을 보냅니다. 지금 바로 전송 버튼 <i class=\"fa-solid fa-paper-plane\"></i>을 누른 것과 같습니다. 그런 다음 실리태번이 보낼 프롬프트를 처리할 때까지 기다렸다가, 프롬프트를 가로채서(실제로 AI에게 보내지 않도록) 최신 프롬프트를 가져옵니다.",
    "点击刷新按钮 时": "새로고침 버튼 <i class=\"fa-solid fa-rotate-right\"></i>을 누를 때",
    "每次点击刷新按钮时, 查看器也会像被打开时那样发送一条虚假的生成请求.": "새로고침 버튼을 누를 때마다 뷰어가 가짜 생성 요청을 다시 보냅니다.",
    "实际发生生成请求时": "실제로 생성 요청을 보낼 때",
    "无论你是:": "다음 중 어떤 방법을 쓰든:",
    "直接点击输入框发送按钮": "전송 버튼 <i class=\"fa-solid fa-paper-plane\"></i> 클릭",
    "使用酒馆助手 generate、generateRaw 函数": "실리태번 헬퍼의 <code>generate</code>, <code>generateRaw</code> 함수 사용",
    "其他任何以酒馆方式发送提示词": "그 밖에 실리태번을 통해 프롬프트를 보내는 모든 방법",
    "查看器都会监听到生成请求, 获得它的提示词发送情况.": "프롬프트 뷰어가 생성 요청을 감지해 최신 프롬프트를 가져옵니다."
  }
};
  // Toasts are shared with SillyTavern, but only exact helper strings from the dictionary are replaced there.
  // The helper teleports its three wand-menu items into SillyTavern's #extensionsMenu; only that container is watched.
  const SCOPE = [
    '#tavern_helper', '.TH-popup', '.TH-custom-tailwind[role="dialog"]', '#toast-container',
    // 1.3.7: 예전에는 헬퍼의 칸만(`#extensionsMenu > .extension_container:has(아이콘)`) 범위로 잡았는데, 폰에서는 그 칸이 범위로 안 잡힌 채
    // 중국어로 남는 일이 되풀이됐다. 메뉴 전체를 범위로 둔다 — 사전에 있는 헬퍼 글자만 바뀌므로 다른 확장의 항목은 그대로다.
    '#extensionsMenu',
  ].join(', ');
  const SKIP = [
    'script', 'style', 'pre', 'code', '[contenteditable="true"]',
    '.monaco-editor', '.cm-editor', '.jse-main', '.jsoneditor',
    '.TH-prompt-content-block', '.wrap-break-word.whitespace-pre-wrap', '.TH-log--item',
    '[data-type="script"] > .grow',
    '[data-type="folder"] > div > span.grow',
    '.TH-popup .p-1\\.5.text-left:not(.flex)',
    '.TH-popup .font-bold.break-all',
  ].join(',');
  // Help popups share their container with user-written script notes, so they stay in SKIP
  // and are only replaced block by block when the popup is a known help document.
  const HELP_SCOPE = '.TH-popup .p-1\\.5.text-left:not(.flex)';
  const HELP_BLOCKS = 'h1, h2, h3, h4, h5, h6, p, li';
  const ATTRIBUTE_NAMES = ['title', 'placeholder', 'aria-label', 'data-tippy-content'];
  const textChanges = new Map();
  const attributeChanges = new Map();
  const htmlChanges = new Map();
  const scopes = new Map();
  let stopped = false;
  let timer = null;
  const dirty = new Set();

  function normalize(text) {
    return String(text ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  }
  const exact = new Map();
  const patterns = [];
  const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function addTranslation(source, korean) {
    const key = normalize(source);
    if (!key || key === normalize(korean)) return;
    if (!/\$\{\d+\}/.test(key)) {
      exact.set(key, korean);
      return;
    }
    // v1.3.3: 번호 자리는 숫자만 받는다 — 원문에서 # · 第 바로 뒤이거나, 한국어에서 바로 뒤에 번 · 개 · 줄이 붙는 자리.
    // 예전에는 아무 글자나 받아서, 다른 확장의 알림 "#9 턴 기록 실패: … 있어요" 전체가 `#${0}` 에 걸려
    // "메시지 9 턴 기록 실패: … 있어요번" 이 됐다 (알림 칸 #toast-container 도 번역 범위라서).
    const numeric = new Set();
    for (const match of String(korean).matchAll(/\$\{(\d+)\}\s*(?:번|개|줄)/g)) numeric.add(match[1]);
    // v1.3.5: "메시지 ${0}/${1}개" 의 앞자리(${0})도 숫자다. 예전에는 앞자리가 아무 글이나 받아서
    // 다른 확장 알림 "Summarized 10/20 messages" 가 "메시지 Summarized 10/20개" 로 바뀌었다.
    for (const match of String(korean).matchAll(/\$\{(\d+)\}\s*\/\s*\$\{\d+\}\s*(?:번|개|줄)/g)) numeric.add(match[1]);
    for (const match of key.matchAll(/(?:#|第)\s*\$\{(\d+)\}/g)) numeric.add(match[1]);
    const indices = [];
    let cursor = 0;
    let expression = '^';
    for (const match of key.matchAll(/\$\{(\d+)\}/g)) {
      expression += escapeRegex(key.slice(cursor, match.index)) + (numeric.has(match[1]) ? '(\\d+)' : '([\\s\\S]*?)');
      indices.push(match[1]);
      cursor = match.index + match[0].length;
    }
    expression += escapeRegex(key.slice(cursor)) + '$';
    patterns.push({ regex: new RegExp(expression), indices, korean, length: key.length });
  }

  for (const [source, korean] of Object.entries(TRANSLATIONS)) addTranslation(source, korean);
  patterns.sort((a, b) => b.length - a.length);
  const helpTitles = new Set(HELP.titles);
  const helpBlocks = new Map(Object.entries(HELP.blocks));

  function translate(text) {
    const key = normalize(text);
    if (!key) return null;
    if (exact.has(key)) return exact.get(key);
    for (const entry of patterns) {
      const matches = entry.regex.exec(key);
      if (!matches) continue;
      const values = new Map(entry.indices.map((index, position) => [index, matches[position + 1]]));
      return entry.korean.replace(/\$\{(\d+)\}/g, (token, index) => values.get(index) ?? token);
    }
    return null;
  }

  // Log viewer rows are skipped as a whole (the message is user output), but the helper's own
  // "【脚本 | 이름】:" label in front of the message is UI text: it is the first text node of the row.
  const LOG_ITEM = '.TH-log--item';
  function isLogLabel(node) {
    return node.nodeType === 3 && /^\s*【/.test(node.nodeValue) && Boolean(node.parentElement?.parentElement?.matches(LOG_ITEM));
  }
  function translateLogLabels(root) {
    if (root.nodeType !== 1) return;
    const items = root.matches(LOG_ITEM) ? [root] : root.querySelectorAll(LOG_ITEM);
    for (const item of items) {
      for (const row of item.children) {
        for (const child of row.childNodes) if (isLogLabel(child)) translateText(child, true);
      }
    }
  }

  // Preserve controls, event handlers and user-written content by editing individual UI text nodes.
  function translateText(node, force = false) {
    const element = node.parentElement;
    if (!element || (!force && element.closest(SKIP)) || element.closest('input, textarea, option[data-custom]')) return;
    const before = node.nodeValue;
    const previous = textChanges.get(node);
    if (previous && before === previous.after) return;
    const translated = translate(before);
    if (translated === null) return;
    const whitespace = before.match(/^(\s*)[\s\S]*?(\s*)$/);
    const after = whitespace[1] + translated + whitespace[2];
    if (before === after) return;
    textChanges.set(node, { before, after });
    node.nodeValue = after;
  }

  function translateAttributes(element) {
    if (element.closest(SKIP)) return;
    for (const attribute of ATTRIBUTE_NAMES) {
      if (!element.hasAttribute(attribute)) continue;
      const before = element.getAttribute(attribute);
      const translated = translate(before);
      if (translated === null || translated === before) continue;
      let changes = attributeChanges.get(element);
      if (!changes) attributeChanges.set(element, changes = new Map());
      const previous = changes.get(attribute);
      if (previous && before === previous.after) continue;
      changes.set(attribute, { before, after: translated });
      element.setAttribute(attribute, translated);
    }
  }

  // Help Markdown is static HTML, so whole blocks are swapped to keep Korean word order around inline code.
  function translateHelp(container) {
    const blocks = [...container.querySelectorAll(HELP_BLOCKS)].filter(block => !block.querySelector(HELP_BLOCKS));
    if (!blocks.length || !helpTitles.has(normalize(blocks[0].textContent))) return;
    for (const block of blocks) {
      const korean = helpBlocks.get(normalize(block.textContent));
      if (korean === undefined) continue;
      const before = block.innerHTML;
      block.innerHTML = korean;
      htmlChanges.set(block, { before, after: block.innerHTML });
    }
  }

  function translateHelpAround(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (!element) return;
    const container = element.closest(HELP_SCOPE);
    for (const help of container ? [container] : element.querySelectorAll(HELP_SCOPE)) translateHelp(help);
  }

  function processNode(node) {
    translateHelpAround(node);
    if (node.nodeType === 3) {
      translateText(node, isLogLabel(node));
      return;
    }
    if (node.nodeType !== 1) return;
    translateLogLabels(node);
    if (node.closest(SKIP)) return;
    translateAttributes(node);
    const walker = doc.createTreeWalker(node, host.NodeFilter.SHOW_ELEMENT | host.NodeFilter.SHOW_TEXT, {
      acceptNode(child) {
        if (child.nodeType === 1 && child.matches(SKIP)) return host.NodeFilter.FILTER_REJECT;
        return host.NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      const child = walker.currentNode;
      if (child.nodeType === 3) translateText(child);
      else translateAttributes(child);
    }
  }

  // 1.3.8: 한 노드에서 오류가 나면 예전에는 그 묶음의 나머지(와 다시 훑기의 뒤쪽 범위)가 통째로 번역되지 않았다. 노드마다 따로 막고 오류는 진단에 남긴다.
  const info = { version: '1.3.8', errors: 0, lastError: '' };
  function safely(node) {
    try { processNode(node); } catch (error) { info.errors++; info.lastError = String(error?.message || error).slice(0, 140); }
  }

  function flush() {
    timer = null;
    if (stopped) return;
    const work = [...dirty];
    dirty.clear();
    for (const node of work) if (node.isConnected) safely(node);
    for (const node of textChanges.keys()) if (!node.isConnected) textChanges.delete(node);
    for (const element of attributeChanges.keys()) if (!element.isConnected) attributeChanges.delete(element);
    for (const block of htmlChanges.keys()) if (!block.isConnected) htmlChanges.delete(block);
  }

  function schedule(node) {
    dirty.add(node);
    if (timer === null) timer = host.setTimeout(flush, 40);
  }

  function attachScope(element) {
    if (scopes.has(element) || element.closest(SKIP)) return;
    if ([...scopes.keys()].some(root => root.contains(element))) return;
    const observer = new host.MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData' || record.type === 'attributes') schedule(record.target);
        else for (const node of record.addedNodes) schedule(node);
      }
    });
    scopes.set(element, observer);
    observer.observe(element, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTE_NAMES });
    safely(element);
  }

  // A lightweight watcher discovers helper popups; detailed watching stays inside helper UI.
  const discovery = new host.MutationObserver(records => {
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      if (target?.closest('#chat, #send_form')) continue;
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        // 마법봉 메뉴 칸은 헬퍼가 빈 칸을 먼저 넣고 항목을 나중에 채운다. 그때는 칸이 아직 SCOPE(:has 아이콘)에 안 맞아 놓쳤고,
        // 뒤에 들어온 항목은 칸의 자식이라 또 놓쳤다 (새로고침마다 한글/중국어가 갈림). 들어온 노드의 조상도 본다.
        const owner = node.closest(SCOPE);
        if (owner) attachScope(owner);
        for (const scope of node.querySelectorAll(SCOPE)) attachScope(scope);
      }
    }
    for (const [element, observer] of scopes) {
      if (!element.isConnected) { observer.disconnect(); scopes.delete(element); }
    }
  });

  // 탭 줄: 좁은 화면에서 '스크립트'가 '스크립/트'로 꺾이지 않게 한 줄로 두고, 그래도 안 맞으면 탭이 통째로 다음 줄로 내려간다.
  const STYLE_ID = 'tavern-helper-korean-ui-style';
  const TAB_BAR = '#tavern_helper .inline-drawer-content > .flex-col > .border-x-2';
  const STYLE = [
    // 탭은 내용 너비만큼 잡고 남는 자리를 나눠 갖는다. 탭 이름은 줄 바꿈하지 않는다.
    `${TAB_BAR} { flex-wrap: wrap; container-type: inline-size; }`,
    `${TAB_BAR} > .flex-1 { flex: 1 1 auto; padding: 0 0.25em; }`,
    `${TAB_BAR} > .flex-1 > div { white-space: nowrap; }`,
    `@media (max-width: 600px) { ${TAB_BAR} > .flex-1 > div { font-size: 0.9em; gap: 2px; } }`,
    // 한 줄에 안 들어갈 만큼 좁으면 아이콘을 숨기고, 그래도 좁으면 3개 + 2개 두 줄로 나눈다 (em = 탭 줄의 글자 크기).
    `@container (max-width: 19.2em) { ${TAB_BAR} > .flex-1 > div > i { display: none; } }`,
    `@container (max-width: 14.2em) { ${TAB_BAR} > .flex-1 { flex-basis: 30%; } }`,
  ].join(' ');

  function installStyle() {
    doc.getElementById(STYLE_ID)?.remove();
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    doc.head.append(style);
  }

  // ✦ 메뉴 · 헬퍼 창을 누를 때 범위를 다시 훑는다: 그려진 순서 때문에 놓친 칸이 있어도 열면 한글이 된다 (감시 비용 없음)
  function rescan(event) {
    if (stopped || !event.target?.closest?.('#extensionsMenuButton, #extensionsMenu, #tavern_helper')) return;
    host.setTimeout(() => {
      if (stopped) return;
      for (const scope of doc.querySelectorAll(SCOPE)) { if (scopes.has(scope)) safely(scope); else attachScope(scope); }
    }, 0);
  }

  function cleanup() {
    if (stopped) return;
    stopped = true;
    discovery.disconnect();
    doc.removeEventListener('click', rescan, true);
    doc.getElementById(STYLE_ID)?.remove();
    for (const observer of scopes.values()) observer.disconnect();
    scopes.clear();
    if (timer !== null) host.clearTimeout(timer);
    dirty.clear();
    for (const [node, change] of textChanges) {
      if (node.isConnected && node.nodeValue === change.after) node.nodeValue = change.before;
    }
    for (const [element, changes] of attributeChanges) {
      if (!element.isConnected) continue;
      for (const [attribute, change] of changes) {
        if (element.getAttribute(attribute) === change.after) element.setAttribute(attribute, change.before);
      }
    }
    for (const [block, change] of htmlChanges) {
      if (block.isConnected && block.innerHTML === change.after) block.innerHTML = change.before;
    }
    textChanges.clear();
    attributeChanges.clear();
    htmlChanges.clear();
    if (host[INSTANCE_KEY]?.cleanup === cleanup) delete host[INSTANCE_KEY];
  }

  function init() {
    if (stopped) return;
    installStyle();
    for (const scope of doc.querySelectorAll(SCOPE)) attachScope(scope);
    discovery.observe(doc.body, { subtree: true, childList: true });
    doc.addEventListener('click', rescan, true);
  }

  host[INSTANCE_KEY] = Object.assign(info, { cleanup, stats: () => ({ scopes: scopes.size, texts: textChanges.size, stopped, watching: [...scopes.keys()].map(element => element.id || element.className?.toString().split(' ')[0] || element.tagName).join(',') }) });
  window.addEventListener('pagehide', cleanup, { once: true });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

/*BL-SCRIPT-END*/
}
