// 내장 스크립트 helper (9.0.7 부터 iframe 없이 테마 창에서 도는 모듈). 원본이에요 — 고친 뒤 node tools/build-plain-scripts.mjs 로 머리를 맞춰요.
// 실행기(src/scripts/runtime.js)가 BlueLemonade(테마 API)와 스크립트별 창 대리 window(src/scripts/realm.js — 타이머 · 감시 모음, setInterval 은 공용 스케줄러)를 넘겨요.
export default function blueLemonadeScript(BlueLemonade, window) {
/*BL-SCRIPT-START*/
// Tavern Helper 4.11.3 Korean UI, v1.4.0
// Short UI labels only (buttons, menus, item names): no prompts, script code, user variables, stored names, or settings are rewritten.
// 1.4.0: 긴 원문(도움말 문단 · 변경 내역 · 공지 · 긴 알림)의 번역은 뺐어요 — 원문 폭 30 이하(한자 · 한글 2칸, 영문 1칸, ${n} 자리 뺌)인 짧은 이름만 남겨요.
//   그 밖의 글은 헬퍼 원래 말로 보여요. 기준은 tools/tests/preset-text-short.mjs 가 지켜요.
// 출처 · 라이선스: 사전의 원문 열(왼쪽)은 태번 헬퍼(JS-Slash-Runner, KAKAA · N0VI028 — https://github.com/N0VI028/JS-Slash-Runner ·
//   https://gitlab.com/novi028/JS-Slash-Runner)의 화면 문구예요. 태번 헬퍼는 PolyForm Noncommercial License 1.0.0
//   (https://polyformproject.org/licenses/noncommercial/1.0.0) 으로 배포돼요. 그래서 이 파일(src/scripts/plain/helper.js)만
//   테마의 다른 파일(AGPL-3.0)과 달리 PolyForm Noncommercial License 1.0.0 조건으로 배포해요 — 비상업 목적으로만 쓸 수 있어요.
//   번역 열(오른쪽)은 Blue Lemonade 가 썼어요. 원작자의 보증을 뜻하지 않아요. 전체 고지: THIRD-PARTY-NOTICES.md
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
  "[酒馆助手]实时监听器断开连接": "[실리태번 헬퍼] 실시간 변경 감지 연결이 끊어졌습니다.",
  "获取更新日志失败": "변경 내역을 불러오지 못했습니다.",
  "Failed to get the changelog": "변경 내역을 불러오지 못했습니다.",
  "无法找到版本 '${0}' 的日志": "'${0}' 버전의 변경 내역을 찾을 수 없습니다.",
  "正在更新酒馆助手...": "실리태번 헬퍼 업데이트 중...",
  "Updating Tavern Helper...": "실리태번 헬퍼 업데이트 중...",
  "酒馆助手已是最新版本, 无需更新": "실리태번 헬퍼가 이미 최신 버전입니다.",
  "更新失败: ${0}": "업데이트 실패: ${0}",
  "Update failed: ${0}": "업데이트 실패: ${0}",
  "复制网址": "주소 복사",
  "Copy URL": "주소 복사",
  "网址已复制": "주소를 복사했습니다.",
  "URL copied": "주소를 복사했습니다.",
  "正在卸载重装酒馆助手...": "실리태번 헬퍼를 삭제하고 다시 설치하는 중...",
  "更新酒馆助手失败": "실리태번 헬퍼 업데이트에 실패했습니다.",
  "Failed to update Tavern Helper": "실리태번 헬퍼 업데이트에 실패했습니다.",
  "路径已复制": "경로를 복사했습니다.",
  "Path copied": "경로를 복사했습니다.",
  "无法复制路径，请手动复制": "경로를 복사할 수 없습니다. 직접 복사해 주세요.",
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
  "启用代码折叠": "코드 접기 사용",
  "Enable Code Folding": "코드 접기 사용",
  "允许流式渲染": "스트리밍 중 렌더링 허용",
  "Enable Streaming Rendering": "스트리밍 중 렌더링 허용",
  "启用兜底清理": "남은 화면 요소 자동 정리",
  "Enable Cleanup Protector": "남은 화면 요소 자동 정리",
  "启用加载动画": "로딩 애니메이션 사용",
  "Enable Loading Animation": "로딩 애니메이션 사용",
  "启用 Blob URL 渲染": "Blob URL 렌더링 사용",
  "Enable Blob URL Rendering": "Blob URL 렌더링 사용",
  "取消前端代码高亮": "프런트엔드 코드 구문 강조 끄기",
  "Cancel Frontend Code Highlight": "프런트엔드 코드 구문 강조 끄기",
  "渲染深度": "렌더링 깊이",
  "Rendering Depth": "렌더링 깊이",
  "忽略隐藏楼层": "숨긴 메시지 제외",
  "Ignore Hidden Floors": "숨긴 메시지 제외",
  "全部": "전체",
  "All": "전체",
  "仅前端": "프런트엔드만",
  "Only Frontend": "프런트엔드만",
  "禁用": "사용 안 함",
  "Disable": "사용 안 함",
  "搜索（支持普通和/正则/）": "검색 (일반 텍스트 및 /정규식/ 지원)",
  "全局脚本": "전역 스크립트",
  "Global Script": "전역 스크립트",
  "酒馆全局可用": "실리태번 전체에서 사용",
  "角色脚本": "캐릭터 스크립트",
  "Character Script": "캐릭터 스크립트",
  "绑定到当前角色卡": "현재 캐릭터 카드에 연결",
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
  "变量管理器": "변수 관리자",
  "Variable Manager": "변수 관리자",
  "实时监听": "실시간 변경 감지",
  "Real-time Editing Listener": "실시간 변경 감지",
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
  "编写参考": "작성 참고 자료",
  "Reference": "작성 참고 자료",
  "编写脚本的参考文档": "스크립트 작성 참고 문서",
  "Writing Reference Document": "스크립트 작성 참고 문서",
  "查看教程及文档": "튜토리얼 및 문서 보기",
  "下载参考文件": "참고 파일 다운로드",
  "Download Reference File": "참고 파일 다운로드",
  "下载STScript参考文件": "STScript 참고 파일 다운로드",
  "下载宏参考文件": "매크로 참고 파일 다운로드",
  "Download Macro Reference File": "매크로 참고 파일 다운로드",
  "电脑编写模板用": "PC에서 템플릿 작성 시 사용",
  "手机或 AI 官网用": "모바일 또는 AI 공식 웹사이트에서 사용",
  "酒馆STScript与宏": "실리태번 STScript 및 매크로",
  "Tavern STScript & Macro": "실리태번 STScript 및 매크로",
  "查看手册": "매뉴얼 보기",
  "View Manual": "매뉴얼 보기",
  "<div>更新日志加载中...</div>": "<div>업데이트 내역을 불러오는 중...</div>",
  "更新日志加载中...": "업데이트 내역을 불러오는 중...",
  "Loading Changelog...": "업데이트 내역을 불러오는 중...",
  "关闭": "닫기",
  "Close": "닫기",
  "例如我个人除了内置库外还有": "예를 들어, 내장 라이브러리 외에도 제가 만든",
  "这些脚本": "스크립트들이 있습니다",
  "these scripts": "스크립트들이 있습니다",
  "如果需要制作脚本, 建议查看": "스크립트를 만들려면 다음 자료를 참고하세요:",
  "官方编写模板配置教程": "공식 작성 템플릿 설정 튜토리얼",
  "预设防误触": "프리셋 설정 오조작 방지",
  "世界书强制自定义排序": "로어북을 사용자 지정 순서로 강제 정렬",
  "一键禁用条目递归": "클릭 한 번으로 항목 재귀 비활성화",
  "输入助手": "입력 도우미",
  "Input Helper": "입력 도우미",
  "token数过多提醒: 防止玩傻子AI": "토큰 초과 알림: AI의 응답 품질 저하 방지",
  "取消代码块高亮": "코드 블록 구문 강조 해제",
  "Cancel code block highlight": "코드 블록 구문 강조 해제",
  "正在加载作者备注...": "작성자 메모를 불러오는 중...",
  "Loading author note...": "작성자 메모를 불러오는 중...",
  "正在加载脚本...": "스크립트를 불러오는 중...",
  "Loading scripts...": "스크립트를 불러오는 중...",
  "成功导入脚本: '${0}'": "스크립트 가져오기 완료: '${0}'",
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
  "批量开关文件夹内脚本": "폴더 안의 스크립트 모두 켜기/끄기",
  "酒馆助手脚本-${0}.json": "실리태번 헬퍼 스크립트-${0}.json",
  "tavern_helper_script-${0}.json": "실리태번 헬퍼 스크립트-${0}.json",
  "酒馆助手脚本文件夹-${0}.json": "실리태번 헬퍼 스크립트 폴더-${0}.json",
  "变量": "변수",
  "Variables": "변수",
  "导出选项": "내보내기 옵션",
  "Export Options": "내보내기 옵션",
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
  "变量列表": "변수 목록",
  "Variable List": "변수 목록",
  "按钮": "버튼",
  "Buttons": "버튼",
  "按钮名称": "버튼 이름",
  "Button Name": "버튼 이름",
  "未填写作者备注": "작성자 메모가 없습니다",
  "No author note": "작성자 메모가 없습니다",
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
  "成功导入脚本文件夹 '${0}'": "스크립트 폴더 '${0}' 가져오기 완료",
  "成功导入脚本 '${0}'": "스크립트 '${0}' 가져오기 완료",
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
  "是否现在就启用它们?": "지금 활성화할까요?",
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
  "已复制全部提示词到剪贴板": "모든 프롬프트를 클립보드에 복사했습니다",
  "已复制提示词到剪贴板": "프롬프트를 클립보드에 복사했습니다",
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
  "正在获取生成请求中的提示词...": "생성 요청에서 프롬프트를 가져오는 중...",
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
  "导出角色卡时始终携带最新世界书": "캐릭터 카드 내보내기 시 항상 최신 로어북 포함",
  "强制使用推荐的世界书全局设置": "권장 로어북 전역 설정 강제 적용",
  "保存预设条目时直接保存预设": "프리셋 항목 저장 시 프리셋도 바로 저장",
  "最大化预设上下文长度": "프리셋 컨텍스트 길이 최대화",
  "Maximize preset context length": "프리셋 컨텍스트 길이 최대화",
  "切换预设时提醒还没有保存": "프리셋 전환 시 저장하지 않은 변경 사항 알림",
  "折叠": "접기",
  "正在加载说明...": "설명을 불러오는 중...",
  "确定": "확인",
  "虚拟化聊天不支持流式渲染": "채팅 가상화는 스트리밍 렌더링을 지원하지 않습니다",
  "JavaScript 代码": "JavaScript 코드",
  "备注文本": "메모 내용",
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
  "当前没有可删除的变量": "현재 삭제할 변수가 없습니다",
  "已删除全部变量": "모든 변수를 삭제했습니다",
  "删除成功": "삭제 완료",
  "搜索变量(支持正则表达式 )": "변수 검색(정규식 지원)",
  "已删除变量": "변수를 삭제했습니다",
  "已清空对象": "객체를 비웠습니다",
  "已清空数组": "배열을 비웠습니다",
  "已重置为对象": "객체로 초기화했습니다",
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
  "启用内容溯源（实验性功能）": "내용 출처 표시 사용 (실험 기능)"
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
    // 1.3.9: 4.11 에서 프롬프트 뷰어 본문 칸이 wrap-break-word 를 잃어 위의 '.wrap-break-word.whitespace-pre-wrap' 이 안 맞는다.
    // 본문 글은 .TH-prompt-content-block 이 막지만 도구 호출 이름(AI 가 부른 함수 이름)이 드러나 따로 막는다. 출처 배지 줄도 막는다(FIXED_LABELS 만 바꿈).
    '.tool-call-name > strong', '.TH-wi-badge-row',
  ].join(',');
  const ATTRIBUTE_NAMES = ['title', 'placeholder', 'aria-label', 'data-tippy-content'];
  const textChanges = new Map();
  const attributeChanges = new Map();
  // BL 9.0.7: 범위(헬퍼 창 · 팝업 · 알림 칸 · ✦ 메뉴)마다 감시 객체를 하나씩 만들던 것을 하나로 — 한 감시 객체가 여러 칸을 봐요.
  const scopes = new Set();
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

  // 1.3.9: 실리태번 헬퍼 4.11 의 '내용 출처 표시'(内容溯源 · Content Tracing). 아래 글은 SKIP 칸 안(도움말 칸 · 프롬프트 본문 칸
  // .TH-prompt-content-block · 배지 줄)에 있어 일반 번역이 닿지 않는다. 정해진 자리에서 글 전체가 고정 문구와 정확히 같을 때만 바꾼다(패턴은 안 씀).
  // 배지에는 로어북 항목 이름 · 프리셋 항목 이름도 같은 꼴로 들어오므로(이름 없는 로어북 항목은 "#12") 배지 종류를 아이콘으로 확인하고,
  // 헬퍼가 넣는 고정 라벨만 바꾼다 — 사용자가 지은 이름은 바꾸지 않는다. korean 이 없으면 위 사전(exact)의 한국어를 쓴다.
  const FIXED_LABELS = [
    { at: 'label[for="TH-wi-tracer-enabled"]', texts: ["启用内容溯源（实验性功能）", "Enable content tracing (Experimental)"] },
    { at: '.TH-wi-badge', icon: 'fa-id-card', texts: ["角色描述", "Character Description"], korean: "캐릭터 설명" },
    { at: '.TH-wi-badge', icon: 'fa-face-smile', texts: ["用户信息", "User Persona"], korean: "페르소나" },
    { at: '.TH-wi-badge', icon: 'fa-sliders', texts: ["预设条目", "Preset Entry"], korean: "프리셋 항목" },
    // 4.11 에서 '내용 접기' 단추가 본문 칸(.TH-prompt-content-block) 안으로 들어갔다 (검색 결과만 보기에서 숨긴 줄을 펼친 뒤).
    { at: '.TH-prompt-content-block > .cursor-pointer', icon: 'fa-chevron-up', texts: ["收起内容", "Collapse Content"] },
  ];
  for (const rule of FIXED_LABELS) rule.keys = new Set(rule.texts.map(normalize));
  const FIXED_AT = [...new Set(FIXED_LABELS.map(rule => rule.at))].join(', ');
  function isFixedLabel(node) {
    return node.nodeType === 3 && Boolean(node.parentElement?.matches(FIXED_AT));
  }
  function fixedLabel(text, node) {
    const element = node.parentElement;
    const key = normalize(text);
    for (const rule of FIXED_LABELS) {
      if (!rule.keys.has(key) || !element?.matches(rule.at)) continue;
      if (rule.icon && ![...element.children].some(child => child.tagName === 'I' && child.classList.contains(rule.icon))) continue;
      return rule.korean ?? exact.get(key) ?? null;
    }
    return null;
  }
  function translateFixedLabels(root) {
    const elements = [...root.querySelectorAll(FIXED_AT)];
    if (root.matches(FIXED_AT)) elements.push(root);
    for (const element of elements) {
      for (const child of element.childNodes) if (child.nodeType === 3) translateText(child, true, fixedLabel);
    }
  }

  // Preserve controls, event handlers and user-written content by editing individual UI text nodes.
  function translateText(node, force = false, lookup = translate) {
    const element = node.parentElement;
    if (!element || (!force && element.closest(SKIP)) || element.closest('input, textarea, option[data-custom]')) return;
    const before = node.nodeValue;
    const previous = textChanges.get(node);
    if (previous && before === previous.after) return;
    const translated = lookup(before, node);
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
  function processNode(node) {
    if (node.nodeType === 3) {
      if (isFixedLabel(node)) translateText(node, true, fixedLabel);
      else translateText(node, isLogLabel(node));
      return;
    }
    if (node.nodeType !== 1) return;
    translateLogLabels(node);
    translateFixedLabels(node);
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
  const info = { version: '1.4.0', errors: 0, lastError: '' };
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
  }

  function schedule(node) {
    dirty.add(node);
    if (timer === null) timer = host.setTimeout(flush, 40);
  }

  const scopeWatch = new host.MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData' || record.type === 'attributes') schedule(record.target);
      else for (const node of record.addedNodes) schedule(node);
    }
  });
  function attachScope(element) {
    if (scopes.has(element) || element.closest(SKIP)) return;
    if ([...scopes].some(root => root.contains(element))) return;
    scopes.add(element);
    scopeWatch.observe(element, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTE_NAMES });
    safely(element);
  }

  // A lightweight watcher discovers helper popups; detailed watching stays inside helper UI.
  const discovery = new host.MutationObserver(records => {
    // BL 8.2.7: 기록 수천 개가 같은 부모에 몰려요(채팅을 열면 메시지마다 단추 줄) — 부모마다 채팅 · 입력칸 안인지는 한 번만 물어요(이 고리에서 바꾸는 것은 글자 · 속성뿐이라 조상이 그대로예요)
    const inChat = new Map();
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
      let skip = inChat.get(target);
      if (skip === undefined) { skip = !!target?.closest('#chat, #send_form'); inChat.set(target, skip); }
      if (skip) continue;
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        // 마법봉 메뉴 칸은 헬퍼가 빈 칸을 먼저 넣고 항목을 나중에 채운다. 그때는 칸이 아직 SCOPE(:has 아이콘)에 안 맞아 놓쳤고,
        // 뒤에 들어온 항목은 칸의 자식이라 또 놓쳤다 (새로고침마다 한글/중국어가 갈림). 들어온 노드의 조상도 본다.
        const owner = node.closest(SCOPE);
        if (owner) attachScope(owner);
        for (const scope of node.querySelectorAll(SCOPE)) attachScope(scope);
      }
    }
    for (const element of scopes) if (!element.isConnected) scopes.delete(element);
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
    scopeWatch.disconnect();
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
    textChanges.clear();
    attributeChanges.clear();
    if (host[INSTANCE_KEY]?.cleanup === cleanup) delete host[INSTANCE_KEY];
  }

  function init() {
    if (stopped) return;
    installStyle();
    for (const scope of doc.querySelectorAll(SCOPE)) attachScope(scope);
    discovery.observe(doc.body, { subtree: true, childList: true });
    doc.addEventListener('click', rescan, true);
  }

  host[INSTANCE_KEY] = Object.assign(info, { cleanup, stats: () => ({ scopes: scopes.size, texts: textChanges.size, stopped, watching: [...scopes].map(element => element.id || element.className?.toString().split(' ')[0] || element.tagName).join(',') }) });
  window.addEventListener('pagehide', cleanup, { once: true });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
/*BL-SCRIPT-END*/
}
