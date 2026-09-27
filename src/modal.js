import { fixToastrForDialogs } from '../../../../popup.js';

/** Keep notifications in the modal top layer, and recover them before removal. */
export function showThemeModal(dialog) {
    // Capture runs before the existing close handlers that remove the dialog.
    const closed = () => {
        const container = dialog.querySelector('#toast-container');
        if (container) document.body.append(container);
        fixToastrForDialogs();
    };
    dialog.addEventListener('close', closed, {capture:true, once:true});
    try { dialog.showModal(); }
    catch (error) { dialog.removeEventListener('close',closed,true); throw error; }
    fixToastrForDialogs();
}
