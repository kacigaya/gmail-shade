import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

async function findChrome() {
  const supplied = process.env.CHROME_PATH;
  if (supplied && existsSync(supplied)) return supplied;
  for (const name of ['google-chrome', 'chromium', 'chromium-browser']) {
    const executable = Bun.which(name);
    if (executable) return executable;
  }
  const cache = join(homedir(), '.cache/ms-playwright');
  if (existsSync(cache)) {
    for (const entry of (await readdir(cache)).sort().reverse()) {
      if (!entry.startsWith('chromium-')) continue;
      for (const folder of ['chrome-linux-arm64', 'chrome-linux64', 'chrome-linux']) {
        const executable = join(cache, entry, folder, 'chrome');
        if (existsSync(executable)) return executable;
      }
    }
  }
  throw new Error('Chrome/Chromium is required for browser tests. Set CHROME_PATH to its executable.');
}

const executable = await findChrome();
const directory = await mkdtemp(join(tmpdir(), 'gmail-shade-browser-'));
let child: Bun.Subprocess<'ignore', 'ignore', 'pipe'> | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
try {
  const build = await Bun.build({
    entrypoints: ['tests/browser/run.tsx'],
    outdir: directory,
    target: 'browser',
    format: 'iife',
    define: { 'import.meta.env.MODE': '"test"', 'import.meta.env.ENTRYPOINT': '"test"' },
    plugins: [{
      name: 'test-browser-api',
      setup(builder) {
        builder.onResolve({ filter: /^wxt\/browser$/ }, () => ({ path: resolve('tests/browser/api.ts') }));
      },
    }],
  });
  if (!build.success) throw new AggregateError(build.logs, 'Browser fixture build failed');
  let report!: (result: string) => void;
  const completed = new Promise<string>((resolve) => { report = resolve; });
  server = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (request.method === 'GET' && path === '/') {
        return new Response('<!doctype html><html lang="en"><head><title>Browser tests</title></head><body><script src="run.js"></script></body></html>', { headers: { 'Content-Type': 'text/html' } });
      }
      if (request.method === 'GET' && path === '/run.js') return new Response(Bun.file(join(directory, 'run.js')));
      if (request.method === 'POST' && path === '/result') {
        report(await request.text());
        return new Response('OK');
      }
      return new Response('Not found', { status: 404 });
    },
  });
  child = Bun.spawn([
    executable, '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--disable-background-networking', '--disable-extensions', '--disable-sync', '--no-first-run',
    `--user-data-dir=${join(directory, 'profile')}`,
    server.url.href,
  ], { stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' });
  const errors = new Response(child.stderr).text();
  const timeout = setTimeout(() => child?.kill(), 30000);
  const output = await Promise.race([
    completed,
    child.exited.then(async (exit) => { throw new Error(`Browser exited before reporting results (${exit}):\n${await errors}`); }),
  ]).finally(() => clearTimeout(timeout));
  if (!/^\d+ browser assertions passed$/.test(output)) {
    throw new Error(`Browser tests failed:\n${output}`);
  }
  console.log(output);
} finally {
  if (child) { child.kill(); await child.exited; }
  server?.stop(true);
  await rm(directory, { recursive: true, force: true });
}
