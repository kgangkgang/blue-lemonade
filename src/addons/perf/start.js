import { perfStartError, perfErrorText } from './start-error.js';
const old = { timer:'load-timer', watchdog:'stream-watchdog', dedupe:'save-dedupe', log:'request-log' };
export const failures=[];
// Finish evaluating this module before its dependencies can import it back.
// The caller awaits ready, so "running" still means all enabled imports settled.
export const ready = start();
async function start() {
 let hub, load, names, disabled;
 try { hub = await import('./hub.js'); }
 catch (error) { throw perfStartError('HUB', error); }
 try {
  const { getSettings } = await import('../../settings.js');
  load = { ...getSettings().addonUI?.perfLoad };
 } catch (error) { throw perfStartError('SETTINGS', error); }
 try {
  const host = await import('../../../../../../extensions.js');
  // Do not start duplicate wrappers when the host's extension list is unavailable.
  if (!Array.isArray(host.extensionNames) || !host.extension_settings ||
      (host.extension_settings.disabledExtensions != null && !Array.isArray(host.extension_settings.disabledExtensions))) throw new TypeError();
  names = [...host.extensionNames];
  disabled = [...(host.extension_settings.disabledExtensions ?? [])];
 } catch (error) { throw perfStartError('HOST', error); }
 for (const [id,file] of [['timer','loadtimer'],['perf','perfassist'],['watchdog','watchdog-main'],['dedupe','savededupe'],['log','requestlog']]) {
  try {
   const folder=old[id], key=`third-party/${folder}`;
   if (load[id] === false) { hub.markOff(id); continue; }
   if (folder && names.includes(key) && !disabled.includes(key)) { hub.markLegacy(id,folder); continue; }
   await import(`./${file}.js`);
  } catch (error) {
   failures.push(id);
   const safe = perfStartError('TOOL', error);
   // A broken status renderer must not prevent the remaining tools from starting.
   try { hub.markBroken(id, safe); } catch { /* The outer card still reports failures. */ }
   console.error('[Blue Lemonade]', id, perfErrorText(safe));
  }
 }
}
