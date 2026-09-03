import type { Settings } from './settings';

/**
 * Static rules per feature, injected as one stylesheet built from the enabled ones.
 *
 * Gmail's own dark theme already covers the list, the sidebar and the chrome; only
 * the opened-message pane stays white, so every rule here is scoped to it.
 */
export const CSS: Record<keyof Settings, string> = {
  darkMessages: `
    /* Fill the remaining white opened-message area */
    .nH.a98.iY,
    .nH.a98.iY > .nH {
      background-color: #2c2c2c !important;
      color: #e8eaed !important;
    }

    /* Subject area */
    .nH.a98.iY .ha,
    .nH.a98.iY .hP {
      background-color: #2c2c2c !important;
      color: #e8eaed !important;
    }

    /* Bottom reply area */
    .nH.a98.iY > .nH.btDi4d.tyMQmc,
    .nH.a98.iY > .nH.btDi4d.tyMQmc > div {
      background-color: #2c2c2c !important;
      color: #e8eaed !important;
    }

    /* Sender / recipient / date */
    .hx .gD,
    .hx .gD span,
    .hx .go,
    .hx .go span,
    .hx .g2,
    .hx .g3,
    .hx .ajA,
    .hx .ajB {
      color: #e8eaed !important;
    }

    /* Email body text */
    .hx .a3s,
    .hx .a3s div,
    .hx .a3s span,
    .hx .a3s p,
    .hx .a3s td,
    .hx .a3s th,
    .hx .a3s li,
    .hx .a3s b,
    .hx .a3s strong,
    .hx .a3s h1,
    .hx .a3s h2,
    .hx .a3s h3,
    .hx .a3s h4,
    .hx .a3s h5,
    .hx .a3s h6 {
      color: #e8eaed !important;
    }

    /* Keep links blue */
    .hx .a3s a,
    .hx .a3s a span,
    .hx .a3s a:visited {
      color: #8ab4f8 !important;
    }

    /* Final reply bar fix */
    .btDi4d,
    .btDi4d > div,
    .btDi4d > div > div,
    .btDi4d .amr,
    .btDi4d .nr,
    .btDi4d .wR,
    .btDi4d .amn {
      background: #2c2c2c !important;
      background-color: #2c2c2c !important;
      color: #e8eaed !important;
    }

    /* Reply / Reply all / Forward buttons */
    .btDi4d .ams {
      background: transparent !important;
      background-color: transparent !important;
      color: #e8eaed !important;
      border-color: #747775 !important;
      box-shadow: none !important;
    }

    /* Reply button icons are black PNGs in Gmail */
    .btDi4d .ams::before {
      filter: invert(1) brightness(1.4) !important;
      opacity: 0.85 !important;
    }

    /* Reaction button */
    .btDi4d button {
      background: transparent !important;
      background-color: transparent !important;
      color: #e8eaed !important;
      border-color: #747775 !important;
    }

    .btDi4d button svg {
      fill: #e8eaed !important;
    }

    /* Remove light sticky shadow */
    .btDi4d.tyMQmc {
      box-shadow: 0 -1px 0 #555 !important;
    }

    /* Message action icons: print, open in new window, reaction, reply, more */
    .nH.a98.iY button svg,
    .hx .gH.acX button svg {
      fill: #e8eaed !important;
      color: #e8eaed !important;
      opacity: 0.9 !important;
    }

    /* Star icon */
    .hx .jvIjkd .T-KT {
      filter: invert(1) brightness(1.5) !important;
      opacity: 0.85 !important;
    }

    /* "Show details" popup background */
    .ajA,
    .ajB {
      background-color: #2c2c2c !important;
      color: #e8eaed !important;
    }

    /* Its field labels: From, To, Date, Subject, ... */
    .ajB .gG {
      color: #b8b8b8 !important;
    }

    /* Its values */
    .ajB .gL,
    .ajB td,
    .ajB th,
    .ajB span,
    .ajB div {
      color: #e8eaed !important;
    }

    /* Its links, such as "Learn more" */
    .ajB a,
    .ajB a:visited {
      color: #8ab4f8 !important;
    }

    /* Its icons */
    .ajB svg {
      fill: #e8eaed !important;
    }

    .ajB img {
      filter: invert(1) brightness(1.4) !important;
    }

    /* Small details arrow next to the recipient */
    .hx .ajz {
      filter: invert(1) brightness(1.4) !important;
      opacity: 0.85 !important;
    }
  `,
  /** Gates DOM, not CSS: the toggle button is mounted by mountToggle. */
  showToggle: '',
};

/** The stylesheet is the switch: light mode is the absence of rules, not a class on <html>. */
export function buildCss(settings: Settings): string {
  return (Object.keys(CSS) as (keyof Settings)[])
    .filter((key) => settings[key])
    .map((key) => CSS[key])
    .join('\n');
}

/** Our own nodes, kept out of every Gmail lookup below. */
const TOGGLE_ID = 'gmail-shade-toggle';
const MARK = 'data-gmail-shade';
const NOT_OURS = `:not([${MARK}])`;

/**
 * Last action button of the opened message's toolbar. Matched by structure, so it
 * holds in every interface language, unlike the print-button labels below.
 */
const TOOLBAR_BUTTON = `.hx .gH.acX button[data-tooltip]${NOT_OURS}`;

/** Fallback anchor: the print button, which is what the toggle sits beside. */
const PRINT_BUTTON = [
  'Print all',
  'Tout imprimer',
  'Alles drucken',
  'Imprimir todo',
  'Imprimir tudo',
  'Stampa tutto',
]
  .map((label) => `button[aria-label="${label}"]${NOT_OURS}`)
  .join(',');

const SVG_NS = 'http://www.w3.org/2000/svg';

interface IconSpec {
  viewBox: string;
  path: string;
}

/** Material Symbols "light_mode": shown while dark is on, so clicking goes light. */
export const SUN_ICON: IconSpec = {
  viewBox: '0 -960 960 960',
  path: 'M480-280q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280Zm0-80q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM440-760v-160h80v160h-80Zm0 720v-160h80v160h-80ZM200-440H40v-80h160v80Zm720 0H760v-80h160v80ZM256-650 155-750l57-57 100 101-56 56Zm492 497L647-254l56-56 101 100-56 57Zm-98-551 100-101 57 57-101 100-56-56ZM153-212l101-101 56 56-100 101-57-56Z',
};

/** Material Symbols "dark_mode": shown while dark is off. */
export const MOON_ICON: IconSpec = {
  viewBox: '0 -960 960 960',
  path: 'M484-80q-84 0-157.5-32t-128-86.5Q144-253 112-326.5T80-484q0-146 93-257.5T410-880q-18 99 11 193.5T520-521q70 70 164.5 99T878-411q-26 144-138 237.5T484-80Zm0-80q88 0 163-44t118-121q-86-8-163-43.5T463-463q-62-62-97.5-139T322-765q-77 43-119.5 118.5T160-484q0 135 94.5 229.5T484-160Z',
};

/**
 * Built through the DOM rather than innerHTML. Gmail sets
 * `require-trusted-types-for 'script'`; isolated worlds are exempt today, and this
 * costs nothing while removing the dependency on that exemption.
 */
export function createIcon(spec: IconSpec): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', spec.viewBox);
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', spec.path);
  svg.append(path);

  return svg;
}

/** Where the toggle goes, best match first. `null` means fall back to fixed positioning. */
export function findToolbarAnchor(root: ParentNode = document): HTMLElement | null {
  const buttons = root.querySelectorAll<HTMLElement>(TOOLBAR_BUTTON);
  return buttons[buttons.length - 1] ?? root.querySelector<HTMLElement>(PRINT_BUTTON);
}

function getToggle(root: ParentNode = document): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`#${TOGGLE_ID}`);
}

/** Repaint the toggle for the current mode. Icon and label are its only state. */
export function syncToggleIcon(dark: boolean, root: ParentNode = document) {
  const button = getToggle(root);
  if (!button) return false;
  // The sweep that calls this is driven by a MutationObserver, so repainting
  // unconditionally would mutate the DOM on every frame and never settle.
  if (button.getAttribute('aria-pressed') === String(dark)) return true;

  const label = dark ? 'Switch to light messages' : 'Switch to dark messages';
  button.replaceChildren(createIcon(dark ? SUN_ICON : MOON_ICON));
  button.setAttribute('aria-label', label);
  button.title = label;
  button.setAttribute('aria-pressed', String(dark));
  return true;
}

function createToggle(onToggle: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.id = TOGGLE_ID;
  button.type = 'button';
  button.setAttribute(MARK, '');

  Object.assign(button.style, {
    width: '36px',
    height: '36px',
    padding: '8px',
    margin: '0',
    border: 'none',
    borderRadius: '50%',
    background: 'transparent',
    color: '#e8eaed',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onToggle();
  });
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = 'rgba(255, 255, 255, 0.10)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = 'transparent';
  });

  return button;
}

/**
 * Put the toggle next to the message actions, or in the top right corner when the
 * toolbar cannot be found. Idempotent: an already correctly parented button is only
 * repainted, so this is safe to call from every mutation sweep.
 */
export function mountToggle(dark: boolean, onToggle: () => void, root: ParentNode = document) {
  const anchor = findToolbarAnchor(root);
  const parent = anchor?.parentElement ?? document.body;
  if (!parent) return null;

  let button = getToggle(root);
  // Gmail rebuilds the toolbar wholesale, which orphans the button rather than
  // removing it, so placement is checked and not just existence.
  const misplaced =
    button != null &&
    (button.parentElement !== parent || (anchor != null && button.nextElementSibling !== anchor));
  if (misplaced) {
    button!.remove();
    button = null;
  }

  if (!button) {
    button = createToggle(onToggle);
    if (anchor) parent.insertBefore(button, anchor);
    else parent.append(button);
  }

  // Fixed only in the fallback path: inside the toolbar the button rides the layout,
  // which is what removes the userscript's reposition polling.
  if (anchor) {
    button.style.position = '';
    button.style.zIndex = '';
    button.style.top = '';
    button.style.right = '';
  } else {
    Object.assign(button.style, {
      position: 'fixed',
      zIndex: '999999',
      top: '75px',
      right: '150px',
    });
  }

  syncToggleIcon(dark, root);
  return button;
}

export function unmountToggle(root: ParentNode = document) {
  const button = getToggle(root);
  if (!button) return false;
  button.remove();
  return true;
}
