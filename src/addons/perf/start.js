import { markLegacy, markBroken } from './hub.js';
import { extensionNames, extension_settings } from '../../../../../../extensions.js';
const old = { timer:'load-timer', watchdog:'stream-watchdog', dedupe:'save-dedupe', log:'request-log' };
export const failures=[];
for (const [id,file] of [['timer','loadtimer'],['perf','perfassist'],['watchdog','watchdog-main'],['dedupe','savededupe'],['log','requestlog']]) {
 const folder=old[id], key=`third-party/${folder}`;
 if (folder && extensionNames.includes(key) && !extension_settings.disabledExtensions?.includes(key)) { markLegacy(id,folder); continue; }
 try { await import(`./${file}.js`); } catch(error) { failures.push(id);markBroken(id,error); console.error('[Blue Lemonade]',error); }
}
