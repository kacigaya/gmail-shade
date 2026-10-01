import { browser } from 'wxt/browser';

let assertions = 0;
export function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
  assertions++;
}
export async function waitFor(condition: () => boolean | Promise<boolean>, message: string) {
  const deadline = Date.now() + 10000;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}
export async function report(phase: string, run: () => Promise<void>) {
  try {
    await run();
    await browser.runtime.sendMessage({ phase, assertions });
  } catch (error) {
    await browser.runtime.sendMessage({ phase, error: String(error) });
  }
}
