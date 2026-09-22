import { markLegacy, markBroken, markOff } from './hub.js';
import { getSettings } from '../../settings.js';
import { extensionNames, extension_settings } from '../../../../../../extensions.js';
const old = { timer:'load-timer', watchdog:'stream-watchdog', dedupe:'save-dedupe', log:'request-log' };
export const failures=[];
for (const [id,file] of [['timer','loadtimer'],['perf','perfassist'],['watchdog','watchdog-main'],['dedupe','savededupe'],['log','requestlog']]) {
 const folder=old[id], key=`third-party/${folder}`;
 // 4.5.5: 꺼 둔 도구는 파일을 아예 읽지 않는다 (설정 › 확장 › 성능 보조의 각 탭에서 고름)
 if (getSettings().addonUI?.perfLoad?.[id] === false) { markOff(id); continue; }
 if (folder && extensionNames.includes(key) && !extension_settings.disabledExtensions?.includes(key)) { markLegacy(id,folder); continue; }
 try { await import(`./${file}.js`); } catch(error) { failures.push(id);markBroken(id,error); console.error('[Blue Lemonade]',error); }
}
