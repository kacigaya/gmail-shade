import { createHash } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';

interface CommandResult { code: number; stdout: string; stderr: string }
type Run = (args: string[]) => Promise<CommandResult>;
interface Artifact { path: string; size: number; digest: string }
async function command(args: string[]): Promise<CommandResult> {
  const child = Bun.spawn(args, { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { code, stdout, stderr };
}
function release(value: unknown): { id: number; draft: boolean; tag_name: string; target_commitish: string; assets: { name: string; size: number; state: string; digest?: string }[] } {
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'number' || !Number.isSafeInteger(value.id) || value.id <= 0 || !('draft' in value) || typeof value.draft !== 'boolean' || !('tag_name' in value) || typeof value.tag_name !== 'string' || !('target_commitish' in value) || typeof value.target_commitish !== 'string' || !('assets' in value) || !Array.isArray(value.assets)) throw new Error('Invalid GitHub release response');
  const assets = value.assets.map((asset: unknown) => {
    if (!asset || typeof asset !== 'object' || !('name' in asset) || typeof asset.name !== 'string' || !('size' in asset) || typeof asset.size !== 'number' || !('state' in asset) || typeof asset.state !== 'string') throw new Error('Invalid release asset');
    return { name: asset.name, size: asset.size, state: asset.state, ...('digest' in asset && typeof asset.digest === 'string' ? { digest: asset.digest } : {}) };
  });
  return { id: value.id, draft: value.draft, tag_name: value.tag_name, target_commitish: value.target_commitish, assets };
}

/** Called only after the workflow's validation and packaging steps succeed. */
export async function publishRelease(options: { tag: string; version: string; repo: string; sha: string; artifacts: Artifact[] }, run: Run = command) {
  const { tag, version, repo, sha, artifacts } = options;
  if (!/^\d+\.\d+\.\d+$/.test(version) || tag !== `v${version}`) throw new Error('Release tag must match the stable package version');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid release repository or commit');
  const expected = [`gmail-shade-${version}-chrome.zip`, `gmail-shade-${version}-firefox.zip`];
  if (artifacts.length !== 2 || !expected.every((name) => artifacts.some((artifact) => basename(artifact.path) === name && artifact.size > 0))) throw new Error('Both browser ZIPs are required');
  const checked = async (args: string[]) => {
    const result = await run(args);
    if (result.code !== 0) throw new Error(`${args.slice(0, 3).join(' ')} failed: ${result.stderr}`);
    return result;
  };
  // The by-tag REST endpoint finds published releases only. List releases so
  // drafts remain visible both immediately after creation and on retries.
  const endpoint = `repos/${repo}/releases?per_page=100`;
  const read = async () => {
    const output = (await checked(['gh', 'api', '--paginate', endpoint, '--jq', '.[] | @json', '-H', 'Cache-Control: no-cache'])).stdout;
    const values: unknown[] = output.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
    const matches = values.filter((value) => value && typeof value === 'object' && 'tag_name' in value && value.tag_name === tag);
    if (matches.length > 1) throw new Error('Multiple releases found for the tag');
    return matches.length ? release(matches[0]) : undefined;
  };
  const verifyTag = async () => {
    const remote = await checked(['gh', 'api', `repos/${repo}/commits/${tag}`, '--jq', '.sha', '-H', 'Cache-Control: no-cache']);
    if (remote.stdout.trim() !== sha) throw new Error('Remote release tag changed from the validated commit');
  };
  await verifyTag();
  let draft = await read();
  if (!draft) {
    // Release lists can lag creation. Keep the POST response and use its ID
    // for subsequent reads instead of rediscovering the draft through the list.
    const created = await checked(['gh', 'api', '--method', 'POST', `repos/${repo}/releases`,
      '--raw-field', `tag_name=${tag}`, '--raw-field', `target_commitish=${sha}`,
      '--raw-field', `name=Gmail Shade ${tag}`, '--field', 'draft=true', '--field', 'generate_release_notes=true']);
    draft = release(JSON.parse(created.stdout));
  }
  if (!draft?.draft || draft.tag_name !== tag || draft.target_commitish !== sha) throw new Error('Refusing to change a published release or a draft for another commit');
  const readDraft = async () => release(JSON.parse((await checked(['gh', 'api', `repos/${repo}/releases/${draft.id}`, '-H', 'Cache-Control: no-cache'])).stdout));
  await checked(['gh', 'release', 'upload', tag, ...artifacts.map(({ path }) => path), '--repo', repo, '--clobber']);
  const uploaded = await readDraft();
  if (uploaded.id !== draft.id || !uploaded.draft || uploaded.tag_name !== tag || uploaded.target_commitish !== sha || uploaded.assets.length !== 2) throw new Error('Draft release changed or contains unexpected assets');
  for (const artifact of artifacts) {
    const asset = uploaded.assets.find(({ name }) => name === basename(artifact.path));
    if (!asset || asset.state !== 'uploaded' || asset.size !== artifact.size || (asset.digest && asset.digest !== artifact.digest)) throw new Error(`Release asset verification failed: ${basename(artifact.path)}`);
  }
  await verifyTag();
  await checked(['gh', 'release', 'edit', tag, '--repo', repo, '--draft=false', '--latest']);
  const published = await readDraft();
  if (published.id !== draft.id || published.draft || published.tag_name !== tag || published.target_commitish !== sha) throw new Error('Release publication was not confirmed');
  console.log(`Published ${repo} ${tag} with both verified browser ZIPs`);
}

if (import.meta.main) {
  const { version } = await Bun.file('package.json').json();
  const tag = process.env.GITHUB_REF_NAME ?? '';
  const sha = process.env.GITHUB_SHA ?? '';
  const repo = process.env.GITHUB_REPOSITORY ?? '';
  if (process.env.GITHUB_REF_TYPE !== 'tag') throw new Error('Release publication requires a tag workflow');
  const onMain = await command(['git', 'merge-base', '--is-ancestor', sha, 'origin/main']);
  if (onMain.code !== 0) throw new Error('Release commit must be on origin/main');
  const artifacts = await Promise.all(['chrome', 'firefox'].map(async (browser) => {
    const path = `.output/gmail-shade-${version}-${browser}.zip`;
    const size = (await stat(path)).size;
    const digest = `sha256:${createHash('sha256').update(new Uint8Array(await Bun.file(path).arrayBuffer())).digest('hex')}`;
    return { path, size, digest };
  }));
  await publishRelease({ tag, version, sha, repo, artifacts });
}
