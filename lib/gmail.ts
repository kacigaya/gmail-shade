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
