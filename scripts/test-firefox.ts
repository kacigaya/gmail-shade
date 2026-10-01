import { cp, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const executable = process.env.FIREFOX_PATH || Bun.which('firefox');
if (!executable || !existsSync(executable)) throw new Error('Firefox is required. Set FIREFOX_PATH to its executable.');
if (!existsSync('.output/firefox-mv2/manifest.json')) throw new Error('Run bun run build:firefox first.');
if (process.platform === 'win32') throw new Error('Native Firefox runner requires POSIX process groups.');
const directory = await mkdtemp(join(tmpdir(), 'gmail-shade-firefox-'));
let child: ReturnType<typeof spawn> | undefined;
let exited: Promise<void> | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
let timeout: ReturnType<typeof setTimeout> | undefined;
try {
  await cp('.output/firefox-mv2', directory, { recursive: true });
  let report!: (result: string) => void;
  const completed = new Promise<string>((resolve) => { report = resolve; });
  server = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    async fetch(request) {
      if (request.method === 'POST' && new URL(request.url).pathname === '/result') {
        report(await request.text());
        return new Response('OK');
      }
      return new Response('<!doctype html><html><head><style>.hx .a3s{color:#222}.card{background:white;color:#222}</style></head><body><div class="nH a98 iY"><div class="hx"><div class="a3s"><div id="plain">Plain</div><div id="card" class="card">Card</div></div></div></div></body></html>', { headers: { 'Content-Type': 'text/html' } });
    },
  });
  const build = await Bun.build({
    entrypoints: ['tests/firefox/background.ts', 'tests/firefox/popup.ts', 'tests/firefox/content.ts'],
    outdir: join(directory, 'native-tests'), target: 'browser', format: 'iife',
    define: { TEST_URL: JSON.stringify(server.url.href) },
  });
  if (!build.success) throw new AggregateError(build.logs, 'Firefox test build failed');
  const manifestFile = Bun.file(join(directory, 'manifest.json'));
  const manifest = await manifestFile.json();
  // Only the disposable test copy can access the local fixture.
  manifest.permissions.push('http://127.0.0.1/*');
  manifest.background = { scripts: ['native-tests/background.js'] };
  manifest.content_scripts[0].matches.push('http://127.0.0.1/*');
  manifest.content_scripts.push({ matches: ['http://127.0.0.1/*'], js: ['native-tests/content.js'], run_at: 'document_idle' });
  await Bun.write(manifestFile, JSON.stringify(manifest));
  const popupFile = Bun.file(join(directory, 'popup.html'));
  await Bun.write(popupFile, (await popupFile.text()).replace('</body>', '<script src="native-tests/popup.js"></script></body>'));
  child = spawn('node', ['node_modules/web-ext/bin/web-ext.js', 'run', `--source-dir=${directory}`, `--firefox=${executable}`, '--no-reload', '--no-input', '--no-config-discovery', '--args=-headless', '--pref=ui.prefersReducedMotion=1'], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout?.on('data', (data) => { output += String(data); });
  child.stderr?.on('data', (data) => { output += String(data); });
  exited = new Promise<void>((resolve) => child!.once('close', () => resolve()));
  const failed = new Promise<never>((_, reject) => {
    child!.once('error', reject);
    child!.once('exit', (code) => reject(new Error(`Firefox runner exited (${code}):\n${output}`)));
    timeout = setTimeout(() => reject(new Error(`Firefox tests timed out:\n${output}`)), 60000);
  });
  const result = await Promise.race([completed, failed]);
  if (!/^\d+ native Firefox assertions passed$/.test(result)) throw new Error(result);
  console.log(result);
} finally {
  clearTimeout(timeout);
  // Kill only this runner's process group, including Firefox children.
  if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error; } }
  await exited;
  server?.stop(true);
  await rm(directory, { recursive: true, force: true });
}
