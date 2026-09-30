export const PAINTED_ATTRIBUTE = 'data-gmail-shade-painted';
export const AUTHOR_COLOR_PROPERTY = '--gmail-shade-author-color';

/** Measure with our stylesheet disabled so author colours are not already overridden. */
export function classifyMessageBackgrounds(bodies: Iterable<HTMLElement>, style: HTMLStyleElement) {
  const measurements: { element: HTMLElement; painted: boolean; color: string }[] = [];
  const disabled = style.disabled;
  style.disabled = true;
  try {
    for (const body of bodies) {
      if (!body.isConnected) continue;
      for (const element of [body, ...body.querySelectorAll<HTMLElement>('*')]) {
        const computed = getComputedStyle(element);
        const color = computed.backgroundColor;
        const transparent = color === 'transparent' || /(?:rgba\([^)]*,\s*0(?:\.0+)?%?\s*\)|\/\s*0(?:\.0+)?%?\s*\))$/.test(color);
        measurements.push({
          element,
          painted: Boolean(color && !transparent) || Boolean(computed.backgroundImage && !/^none(?:\s*,\s*none)*$/.test(computed.backgroundImage)),
          color: computed.color,
        });
      }
    }
  } finally {
    style.disabled = disabled;
  }

  // Finish every style read before writing markers or custom properties.
  for (const { element, painted, color } of measurements) {
    if (painted) {
      element.setAttribute(PAINTED_ATTRIBUTE, '');
      element.style.setProperty(AUTHOR_COLOR_PROPERTY, color);
    } else if (element.hasAttribute(PAINTED_ATTRIBUTE)) {
      element.removeAttribute(PAINTED_ATTRIBUTE);
      element.style.removeProperty(AUTHOR_COLOR_PROPERTY);
    }
  }
}

export function clearMessageBackgrounds(root: ParentNode = document) {
  for (const element of root.querySelectorAll<HTMLElement>(`[${PAINTED_ATTRIBUTE}]`)) {
    element.removeAttribute(PAINTED_ATTRIBUTE);
    element.style.removeProperty(AUTHOR_COLOR_PROPERTY);
  }
}
