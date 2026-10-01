import { expect, test } from 'bun:test';
import { publishRelease } from '../scripts/publish-release';

const options = {
  tag: 'v0.1.2', version: '0.1.2', repo: 'owner/gmail-shade', sha: 'a'.repeat(40),
  artifacts: ['chrome', 'firefox'].map((browser) => ({ path: `.output/gmail-shade-0.1.2-${browser}.zip`, size: 123, digest: 'sha256:test' })),
};
function fixture(config: { published?: boolean; existingDraft?: boolean; wrongCommit?: boolean; uploadFailure?: boolean; missingAsset?: boolean; networkFailure?: boolean; wrongDigest?: boolean; movedTag?: boolean } = {}) {
  const calls: string[][] = [];
  let exists = !!config.published || !!config.existingDraft;
  let draft = !config.published;
  let uploaded = false;
  const run = async (args: string[]) => {
    calls.push(args);
    if (args[1] === 'api') {
      if (config.networkFailure) return { code: 1, stdout: '', stderr: 'network unavailable' };
      if (args[2]?.includes('/commits/')) return { code: 0, stdout: config.movedTag && uploaded ? 'b'.repeat(40) : options.sha, stderr: '' };
      return { code: 0, stderr: '', stdout: exists ? JSON.stringify({ draft, tag_name: options.tag, target_commitish: config.wrongCommit ? 'b'.repeat(40) : options.sha, assets: uploaded ? options.artifacts.slice(0, config.missingAsset ? 1 : 2).map((asset) => ({ name: asset.path.split('/').pop(), size: asset.size, state: 'uploaded', digest: config.wrongDigest ? 'sha256:wrong' : asset.digest })) : [] }) : '' };
    }
    if (args[2] === 'create') exists = true;
    if (args[2] === 'upload') {
      if (config.uploadFailure) return { code: 1, stdout: '', stderr: 'upload interrupted' };
      uploaded = true;
    }
    if (args[2] === 'edit') draft = false;
    return { code: 0, stdout: '', stderr: '' };
  };
  return { calls, run };
}

test('publishes only after both draft assets are verified', async () => {
  const { calls, run } = fixture();
  await publishRelease(options, run);
  expect(calls.filter((args) => args[1] === 'release').map((args) => args[2])).toEqual(['create', 'upload', 'edit']);
  expect(calls.find((args) => args[2] === 'create')).toContain('--draft');
  expect(calls.find((args) => args[2] === 'upload')).toContain(options.artifacts[0]!.path);
  expect(calls.find((args) => args[2] === 'upload')).toContain(options.artifacts[1]!.path);
  const publication = calls.findIndex((args) => args[2] === 'edit');
  expect(calls[publication - 1]![2]).toContain('/commits/');
});

test('refuses published releases, unavailable API, and mismatched tags', async () => {
  for (const config of [{ published: true }, { networkFailure: true }, { existingDraft: true, wrongCommit: true }]) {
    const { calls, run } = fixture(config);
    await expect(publishRelease(options, run)).rejects.toThrow();
    expect(calls.some((args) => args[1] === 'release')).toBe(false);
  }
  const { calls, run } = fixture();
  await expect(publishRelease({ ...options, tag: 'v0.1.3' }, run)).rejects.toThrow('tag');
  expect(calls).toHaveLength(0);
});

test('failed or incomplete uploads leave the release unpublished', async () => {
  for (const config of [{ uploadFailure: true }, { missingAsset: true }, { wrongDigest: true }, { movedTag: true }]) {
    const { calls, run } = fixture(config);
    await expect(publishRelease(options, run)).rejects.toThrow();
    expect(calls.some((args) => args[2] === 'edit')).toBe(false);
  }
});

test('resumes an existing draft without creating another release', async () => {
  const { calls, run } = fixture({ existingDraft: true });
  await publishRelease(options, run);
  expect(calls.filter((args) => args[1] === 'release').map((args) => args[2])).toEqual(['upload', 'edit']);
});
