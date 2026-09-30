import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { mock } from 'bun:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';

GlobalRegistrator.register();
mock.module('wxt/browser', () => ({ browser: fakeBrowser }));
