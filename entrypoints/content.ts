import { DEFAULT_SETTINGS, getSettings, settingsItem, type Settings, withDefaults } from '@/lib/settings';
import { buildCss } from '@/lib/gmail';

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

    // Defaults are dark, so darken first and reconcile once storage answers.
    applyCss();
    settings = await getSettings();
    applyCss();

    settingsItem.watch((value) => {
      settings = withDefaults(value);
      applyCss();
    });

    // An extension reload invalidates this context; the stylesheet outlives it.
    ctx.onInvalidated(() => {
      style.remove();
    });
  },
});
