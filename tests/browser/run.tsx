import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/entrypoints/popup/App';
import { buildCss } from '@/lib/gmail';
import { classifyMessageBackgrounds, clearMessageBackgrounds, PAINTED_ATTRIBUTE } from '@/lib/message-backgrounds';
import { api, browser } from './api';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import content from '@/entrypoints/content';

let assertions = 0;
function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  assertions++;
}
async function waitFor(condition: () => boolean, message: string) {
  const deadline = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
}

async function run() {
  const fixture = document.createElement('div');
  fixture.innerHTML = `<style>
    .hx .a3s { color: #222; }
    .class-card { background: #fff; color: #222; }
    .dark-card { background: #000; color: #fff; }
    .child-color { color: #b00; }
  </style><div class="nH a98 iY"><div class="hx"><div class="a3s">
    <div id="plain">Plain text</div>
    <div id="transparent" style="background-color:transparent">Transparent</div>
    <div id="zero-alpha" style="background-color:rgba(255,255,255,0.0)">Zero alpha</div>
    <div id="position" style="background-position:center">Position only</div>
    <div id="none-layers" style="background-image:none,none">Empty layers</div>
    <div id="upper" style="BACKGROUND-COLOR:#fff">Uppercase</div>
    <div id="card" class="class-card">Class card <span id="child" class="child-color">Child</span></div>
    <div id="dark" class="dark-card">Dark card <div style="background:#fff;color:#222" id="nested">Nested</div></div>
    <table bgcolor="#fff"><tr><td id="legacy">Legacy card</td></tr></table>
    <div id="gradient" style="background:linear-gradient(white,gray)">Gradient</div>
    <div id="image" style="background-image:url(data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7)">Image</div>
  </div></div></div>`;
  document.body.append(fixture);
  const style = document.createElement('style');
  style.textContent = buildCss({ darkMessages: true, showToggle: true });
  document.head.append(style);
  const bodies = fixture.querySelectorAll<HTMLElement>('.a3s');
  classifyMessageBackgrounds(bodies, style);
  const element = (id: string) => document.getElementById(id)!;
  const color = (id: string) => getComputedStyle(element(id)).color;
  for (const id of ['plain', 'transparent', 'zero-alpha', 'position', 'none-layers']) {
    expect(color(id) === 'rgb(232, 234, 237)', `${id} should get light text`);
    expect(!element(id).hasAttribute(PAINTED_ATTRIBUTE), `${id} should not be painted`);
  }
  for (const id of ['upper', 'card', 'legacy', 'nested', 'gradient', 'image']) {
    expect(color(id) === 'rgb(34, 34, 34)', `${id} should preserve original text`);
  }
  expect(color('dark') === 'rgb(255, 255, 255)', 'Dark cards must keep white author text');
  expect(color('child') === 'rgb(187, 0, 0)', 'Descendant stylesheet colours must survive');
  element('card').className = '';
  classifyMessageBackgrounds(bodies, style);
  expect(color('card') === 'rgb(232, 234, 237)', 'Changed backgrounds must be reclassified');
  expect(!element('card').hasAttribute(PAINTED_ATTRIBUTE), 'Stale painted markers must be removed');
  clearMessageBackgrounds(fixture);
  expect(fixture.querySelector(`[${PAINTED_ATTRIBUTE}]`) === null, 'Cleanup must remove markers');
  expect(!element('dark').style.getPropertyValue('--gmail-shade-author-color'), 'Cleanup must remove custom properties');
  style.remove();
  fixture.remove();

  const compose = document.createElement('div');
  compose.innerHTML = `<style>.aoI, .Am, .Ar, .aH9, .xx { background: #fff; color: #222; } .aYF { color: #0b57d0; }</style>
    <div class="nH Hd" role="dialog"><div class="aCk"><table><tr><td id="compose-title"><h2><span id="compose-heading" class="aYF">New message</span></h2></td></tr></table></div>
    <div class="aoI" role="region"><table class="GS"><tr class="bzf"><td>
    <div id="compose-recipients" class="xx"><div id="compose-chip" class="xx" role="option">a@example.com</div>
    <div id="compose-to" class="aH9"><input class="agP aFw" role="combobox"></div></div>
    <div style="background:#fff"><span id="compose-suggestion">Suggested contact</span></div></td></tr></table>
    <input id="compose-subject" class="aoT" placeholder="Subject">
    <div id="compose-wrapper" class="Ar Au"><div id="compose-body" class="Am" contenteditable="true">Typed <span id="compose-red" style="color:#b00">red</span></div></div>
    </div></div>`;
  document.body.append(compose);
  const composeStyle = document.createElement('style');
  composeStyle.textContent = buildCss({ darkMessages: true, showToggle: true });
  document.head.append(composeStyle);
  const background = (id: string) => getComputedStyle(element(id)).backgroundColor;
  expect(background('compose-body') === 'rgb(44, 44, 44)', 'Compose body should be dark');
  expect(color('compose-body') === 'rgb(232, 234, 237)', 'Compose body should get light text');
  expect(color('compose-subject') === 'rgb(232, 234, 237)', 'Compose subject should get light text');
  expect(background('compose-title') === 'rgb(56, 56, 56)', 'Compose title bar should be dark');
  expect(color('compose-heading') === 'rgb(232, 234, 237)', 'Compose title text should be light');
  expect(background('compose-wrapper') === 'rgb(44, 44, 44)', 'Editor wrappers should not paint white around the body');
  expect(background('compose-to') === 'rgba(0, 0, 0, 0)', 'Recipient input wrapper should not paint white');
  expect(background('compose-recipients') === 'rgba(0, 0, 0, 0)', 'Recipient field should not paint white');
  expect(background('compose-chip') === 'rgb(255, 255, 255)', 'Recipient chips keep their own background');
  expect(color('compose-red') === 'rgb(187, 0, 0)', 'Text coloured by the writer must survive');
  expect(color('compose-suggestion') === 'rgb(34, 34, 34)', 'Gmail popups in compose must not inherit light text');
  composeStyle.remove();
  expect(background('compose-body') === 'rgb(255, 255, 255)', 'Light mode should restore the compose window');
  compose.remove();

  const popup = document.createElement('div');
  document.body.append(popup);
  const root = createRoot(popup);
  api.failRead = true;
  root.render(<StrictMode><App /></StrictMode>);
  await waitFor(() => popup.textContent!.includes('Could not load settings'), 'Popup read failure did not appear');
  expect(popup.textContent!.includes('Could not load settings'), 'Popup should show read failures');
  const retry = popup.querySelector<HTMLButtonElement>('button')!;
  expect(retry.textContent === 'Retry', 'Popup should offer retry');
  api.failRead = false;
  retry.click();
  await waitFor(() => !popup.querySelector('[role=alert]') && popup.querySelector('[role=switch]')?.getAttribute('aria-disabled') !== 'true', 'Popup retry did not complete');
  expect(!popup.querySelector('[role=alert]'), 'Successful retry should clear the error');
  await browser.storage.sync.set({ darkMessages: false });
  await waitFor(() => popup.querySelector('[role=switch]')?.getAttribute('aria-checked') === 'false', 'Popup did not receive remote settings');
  const switches = popup.querySelectorAll<HTMLElement>('[role=switch]');
  expect(switches[0]!.getAttribute('aria-checked') === 'false', 'Popup should follow remote settings');
  switches[1]!.click();
  await waitFor(() => api.values.showToggle === false, 'Popup did not save the preference');
  expect(api.values.darkMessages === false && api.values.showToggle === false, 'Changing one preference should preserve another');
  api.failWrite = true;
  switches[1]!.click();
  await waitFor(() => popup.textContent!.includes('Could not save settings'), 'Popup save failure did not appear');
  expect(switches[1]!.getAttribute('aria-checked') === 'false', 'Failed save should roll back');
  expect(popup.textContent!.includes('Could not save settings'), 'Popup should show save failures');
  root.unmount();
  popup.remove();

  api.failWrite = false;
  api.values = {};
  const pane = document.createElement('div');
  pane.innerHTML = '<style>.hx .a3s {color:#222}.native-card {background:#fff;color:#222}</style><div class="hx"><div class="a3s"><div class="native-card">Card</div></div></div>';
  document.body.append(pane);
  const card = pane.querySelector<HTMLElement>('.native-card')!;
  const ctx = new ContentScriptContext('browser-content');
  content.main(ctx);
  try {
    await waitFor(() => card.hasAttribute(PAINTED_ATTRIBUTE), 'Content script did not classify the initial message');
    expect(getComputedStyle(card).color === 'rgb(34, 34, 34)', 'Content script should preserve painted card text');
    card.className = '';
    await waitFor(() => !card.hasAttribute(PAINTED_ATTRIBUTE), 'Class mutation was not reclassified');
    expect(getComputedStyle(card).color === 'rgb(232, 234, 237)', 'Class changes should restore light text');
    card.className = 'native-card';
    await waitFor(() => card.hasAttribute(PAINTED_ATTRIBUTE), 'Painted class was not restored');
    pane.querySelector('style')!.textContent = '.hx .a3s {color:#222}.native-card {background:transparent}';
    await waitFor(() => !card.hasAttribute(PAINTED_ATTRIBUTE), 'Stylesheet mutation was not reclassified');
    expect(getComputedStyle(card).color === 'rgb(232, 234, 237)', 'Stylesheet changes should restore light text');
    card.style.background = '#fff';
    await waitFor(() => card.hasAttribute(PAINTED_ATTRIBUTE), 'Inline background mutation was not classified');
    await browser.storage.sync.set({ darkMessages: false });
    await waitFor(() => !card.hasAttribute(PAINTED_ATTRIBUTE), 'Light mode did not clear author markers');
    expect(getComputedStyle(card).color === 'rgb(34, 34, 34)', 'Light mode should restore Gmail colours');
    await browser.storage.sync.set({ darkMessages: true });
    await waitFor(() => card.hasAttribute(PAINTED_ATTRIBUTE), 'Re-enabling dark mode did not classify the message');
    card.textContent = 'Queued mutation';
    ctx.notifyInvalidated();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(!document.querySelector('style[data-gmail-shade]'), 'Invalidation should remove the stylesheet');
    expect(!document.querySelector('#gmail-shade-toggle'), 'Invalidation should prevent queued button remounts');
    expect(!card.hasAttribute(PAINTED_ATTRIBUTE), 'Invalidation should clear author markers');
  } finally {
    ctx.notifyInvalidated();
    pane.remove();
  }
}

void run().then(async () => {
  const result = document.createElement('pre');
  result.dataset.status = 'passed';
  result.textContent = `${assertions} browser assertions passed`;
  document.body.append(result);
  await fetch('/result', { method: 'POST', body: result.textContent });
}).catch(async (error: unknown) => {
  const result = document.createElement('pre');
  result.dataset.status = 'failed';
  result.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
  document.body.append(result);
  await fetch('/result', { method: 'POST', body: result.textContent });
});
