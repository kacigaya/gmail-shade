import { beforeEach, describe, expect, test } from 'bun:test';
import {
  CSS,
  MOON_ICON,
  SUN_ICON,
  buildCss,
  createIcon,
  findToolbarAnchor,
  mountToggle,
  syncToggleIcon,
  unmountToggle,
} from '@/lib/gmail';

type Key = keyof typeof CSS;

/** Settings fixture without importing lib/settings, whose `#imports` bun cannot resolve. */
function only(...enabled: Key[]): Record<Key, boolean> {
  return Object.fromEntries(
    (Object.keys(CSS) as Key[]).map((key) => [key, enabled.includes(key)]),
  ) as Record<Key, boolean>;
}

/** Toolbar shape Gmail renders above an opened message. */
const TOOLBAR = `
  <div class="hx">
    <div class="gH acX">
      <button data-tooltip="Reply" id="reply"></button>
      <button data-tooltip="More" id="more"></button>
    </div>
  </div>`;

const noop = () => {};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('buildCss', () => {
  test('includes the reading pane rules when dark messages are on', () => {
    const css = buildCss(only('darkMessages'));
    expect(css).toContain('.nH.a98.iY');
    expect(css).toContain('#2c2c2c');
    expect(css).toContain('.hx .a3s');
    expect(css).toContain('#8ab4f8');
  });

  test('is empty when dark messages are off', () => {
    expect(buildCss(only('showToggle')).trim()).toBe('');
    expect(buildCss(only()).trim()).toBe('');
  });

  test('showToggle contributes no rules', () => {
    expect(CSS.showToggle).toBe('');
  });

  test('carries no light-mode class, because the stylesheet is the switch', () => {
    expect(CSS.darkMessages).not.toContain('GmailLightMode');
  });
});

describe('findToolbarAnchor', () => {
  test('prefers the last toolbar action button', () => {
    document.body.innerHTML = TOOLBAR;
    expect(findToolbarAnchor()!.id).toBe('more');
  });

  test('falls back to the print button in any of its locales', () => {
    for (const label of ['Print all', 'Tout imprimer', 'Stampa tutto']) {
      document.body.innerHTML = `<button id="print" aria-label="${label}"></button>`;
      expect(findToolbarAnchor()!.id).toBe('print');
    }
  });

  test('returns null when neither is on the page', () => {
    document.body.innerHTML = '<div class="hx"></div>';
    expect(findToolbarAnchor()).toBeNull();
  });

  test('never anchors on our own button', () => {
    document.body.innerHTML = TOOLBAR;
    mountToggle(true, noop);
    expect(findToolbarAnchor()!.id).toBe('more');
  });
});

describe('createIcon', () => {
  test('builds a namespaced svg without innerHTML', () => {
    const svg = createIcon(SUN_ICON);
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('viewBox')).toBe(SUN_ICON.viewBox);
    expect(svg.querySelector('path')!.getAttribute('d')).toBe(SUN_ICON.path);
  });
});

describe('mountToggle', () => {
  test('inserts the button before the anchor', () => {
    document.body.innerHTML = TOOLBAR;
    const button = mountToggle(true, noop)!;
    expect(button.nextElementSibling!.id).toBe('more');
    expect(button.style.position).toBe('');
  });

  test('is idempotent: a second call reuses the same node', () => {
    document.body.innerHTML = TOOLBAR;
    const first = mountToggle(true, noop);
    const second = mountToggle(true, noop);
    expect(second).toBe(first);
    expect(document.querySelectorAll('#gmail-shade-toggle')).toHaveLength(1);
  });

  test('re-parents after Gmail replaces the toolbar', () => {
    document.body.innerHTML = TOOLBAR;
    mountToggle(true, noop);
    document.querySelector('.gH.acX')!.remove();
    document.body.insertAdjacentHTML('beforeend', TOOLBAR);

    const button = mountToggle(true, noop)!;
    expect(document.querySelectorAll('#gmail-shade-toggle')).toHaveLength(1);
    expect(button.nextElementSibling!.id).toBe('more');
  });

  test('falls back to a fixed position when no anchor exists', () => {
    const button = mountToggle(true, noop)!;
    expect(button.parentElement).toBe(document.body);
    expect(button.style.position).toBe('fixed');
    expect(button.style.top).toBe('75px');
    expect(button.style.right).toBe('150px');
  });

  test('drops the fixed position once the toolbar shows up', () => {
    mountToggle(true, noop);
    document.body.insertAdjacentHTML('beforeend', TOOLBAR);

    const button = mountToggle(true, noop)!;
    expect(button.style.position).toBe('');
    expect(button.nextElementSibling!.id).toBe('more');
  });

  test('reports clicks to the caller', () => {
    document.body.innerHTML = TOOLBAR;
    let clicks = 0;
    mountToggle(true, () => clicks++)!.click();
    expect(clicks).toBe(1);
  });
});

describe('syncToggleIcon', () => {
  test('swaps the path and the label with the mode', () => {
    document.body.innerHTML = TOOLBAR;
    const button = mountToggle(true, noop)!;
    expect(button.querySelector('path')!.getAttribute('d')).toBe(SUN_ICON.path);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    syncToggleIcon(false);
    expect(button.querySelectorAll('svg')).toHaveLength(1);
    expect(button.querySelector('path')!.getAttribute('d')).toBe(MOON_ICON.path);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Switch to dark messages');
  });

  test('does nothing when the button is not mounted', () => {
    expect(syncToggleIcon(true)).toBe(false);
  });
});

describe('unmountToggle', () => {
  test('leaves no node behind', () => {
    document.body.innerHTML = TOOLBAR;
    mountToggle(true, noop);

    expect(unmountToggle()).toBe(true);
    expect(document.querySelector('#gmail-shade-toggle')).toBeNull();
    expect(unmountToggle()).toBe(false);
  });
});
