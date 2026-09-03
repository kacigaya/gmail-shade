import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // Firefox and Opera get a sources zip by default. Only an AMO review
  // submission needs it, so nothing builds it until one is due.
  zip: {
    zipSources: false,
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ browser }) => ({
    name: 'Gmail Shade',
    description:
      "Darkens Gmail's opened-message reading pane, which the native dark theme leaves white.",
    permissions: ['storage'],
    host_permissions: ['*://mail.google.com/*'],
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              data_collection_permissions: {
                required: ['none'] as const,
              },
            },
          },
        }
      : {}),
  }),
});
