import { defineContentScript } from 'wxt/utils/define-content-script';
import { createSettingsController, DEFAULT_SETTINGS, type SettingsState } from '@/lib/settings';
import { buildCss, mountToggle, showSettingsError, unmountToggle } from '@/lib/gmail';
import { classifyMessageBackgrounds, clearMessageBackgrounds } from '@/lib/message-backgrounds';

export default defineContentScript({
  matches: ['*://mail.google.com/*'],
  runAt: 'document_start',

  main(ctx) {
    let state: SettingsState = { settings: DEFAULT_SETTINGS, loaded: false, error: null };
    let disposed = false;
    let frame: number | undefined;
    let controller: ReturnType<typeof createSettingsController> | undefined;
    const dirtyBodies = new Set<HTMLElement>();
    const style = document.createElement('style');
    style.setAttribute('data-gmail-shade', '');
    const applyCss = () => {
      const css = buildCss(state.settings);
      if (style.textContent !== css) style.textContent = css;
    };
    const toggleDark = () => {
      if (!controller?.state.loaded) { void controller?.load(); return; }
      controller.set('darkMessages', !state.settings.darkMessages);
    };
    const markAllBodies = () => {
      for (const body of document.querySelectorAll<HTMLElement>('.hx .a3s')) dirtyBodies.add(body);
    };
    const observe = () => observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'id', 'style', 'bgcolor', 'background', 'href', 'rel', 'media', 'disabled'],
    });
    const sweep = () => {
      if (disposed || ctx.isInvalid || frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (disposed || ctx.isInvalid) return;
        // Our markers, styles and button must not schedule another observer sweep.
        observer.disconnect();
        try {
          if (state.settings.darkMessages) {
            if (dirtyBodies.size) classifyMessageBackgrounds(dirtyBodies, style);
          } else clearMessageBackgrounds();
          dirtyBodies.clear();
          if (state.settings.showToggle) mountToggle(state.settings.darkMessages, toggleDark);
          else unmountToggle();
          const error = state.error && (!state.loaded
            ? 'Could not load settings. Click the sun/moon button or open the popup to retry.'
            : state.error);
          showSettingsError(error);
        } finally {
          if (!disposed && !ctx.isInvalid) observe();
        }
      });
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (target?.closest('[data-gmail-shade]')) continue;
        const body = target?.closest<HTMLElement>('.hx .a3s');
        if (body) dirtyBodies.add(body);
        if (target instanceof HTMLElement) {
          for (const child of target.querySelectorAll<HTMLElement>('.hx .a3s')) dirtyBodies.add(child);
        }
        // Style rules can change backgrounds without changing message markup.
        if (target?.closest('style') || target instanceof HTMLLinkElement || [...record.addedNodes, ...record.removedNodes].some((node) =>
          node instanceof Element && (node.matches('style, link[rel="stylesheet"]') || node.querySelector('style, link[rel="stylesheet"]')),
        )) markAllBodies();
      }
      sweep();
    });
    ctx.onInvalidated(() => {
      disposed = true;
      controller?.dispose();
      if (frame !== undefined) cancelAnimationFrame(frame);
      observer.disconnect();
      dirtyBodies.clear();
      style.remove();
      clearMessageBackgrounds();
      unmountToggle();
      showSettingsError(null);
    });
    if (ctx.isInvalid) return;

    (document.head ?? document.documentElement).append(style);
    applyCss();
    markAllBodies();
    observe();
    ctx.addEventListener(window, 'resize', () => { markAllBodies(); sweep(); });
    ctx.addEventListener(document, 'load', (event) => {
      if (event.target instanceof HTMLLinkElement) { markAllBodies(); sweep(); }
    }, { capture: true });
    controller = createSettingsController((next) => {
      if (disposed || ctx.isInvalid) return;
      if (next.settings.darkMessages !== state.settings.darkMessages) markAllBodies();
      state = next;
      applyCss();
      sweep();
    });
    void controller.load();
    sweep();
  },
});
