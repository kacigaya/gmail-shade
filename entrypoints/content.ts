import { DEFAULT_SETTINGS, getSettings, settingsItem, type Settings, withDefaults } from '@/lib/settings';
import { buildCss, mountToggle, unmountToggle } from '@/lib/gmail';

export default defineContentScript({
  matches: ['*://mail.google.com/*'],
  runAt: 'document_start',

  async main(ctx) {
    let settings: Settings = DEFAULT_SETTINGS;

    const style = document.createElement('style');
    (document.head ?? document.documentElement).append(style);
    const applyCss = () => {
      style.textContent = buildCss(settings);
    };

    // Writing the setting is the whole click handler: the watch below repaints both
    // the stylesheet and the icon, so the button and the popup share one code path.
    const toggleDark = () => {
      settingsItem.setValue({ ...settings, darkMessages: !settings.darkMessages });
    };

    let queued = false;
    const sweep = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (settings.showToggle) mountToggle(settings.darkMessages, toggleDark);
        else unmountToggle();
      });
    };

    // Defaults are dark, so darken first and reconcile once storage answers.
    applyCss();
    settings = await getSettings();
    applyCss();
    sweep();

    settingsItem.watch((value) => {
      settings = withDefaults(value);
      applyCss();
      sweep();
    });

    // Gmail rebuilds the reading pane on every message it opens, which is what
    // re-mounts the button; coalescing to a frame keeps that off the mutation path.
    const observer = new MutationObserver(sweep);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // An extension reload invalidates this context; the observer, stylesheet and
    // button all outlive it.
    ctx.onInvalidated(() => {
      observer.disconnect();
      style.remove();
      unmountToggle();
    });
  },
});
