import { expect, test } from 'bun:test';
import { audit, dependencyGraph, exceptionFor, publicPackages } from '../scripts/audit-deps';

test('extracts exact public resolutions, excluding local and private registries', () => {
  const lock = `{"lockfileVersion":1,"packages":{
    "alias":["@scope/pkg@1.2.3","",{},"sha512-test"],
    "nested/alias":["@scope/pkg@1.2.3","",{},"sha512-test"],
    "local":["local@workspace:packages/local"],
    "secret":["secret@1.0.0","https://private.example/",{},"sha512-test"],
  }}`;
  expect(publicPackages(lock)).toEqual([{ name: '@scope/pkg', version: '1.2.3' }]);
  expect(() => publicPackages('{"lockfileVersion":2}')).toThrow('Unsupported');
  expect(() => publicPackages('{"lockfileVersion":1,"packages":{}}')).toThrow('No exact');
});

test('follows pagination, deduplicates advisories, and ignores withdrawn records', async () => {
  const queries: unknown[] = [];
  const findings = await audit([{ name: 'public', version: '1.0.0' }], async (url, init) => {
    if (url.endsWith('querybatch')) {
      queries.push(JSON.parse(String(init!.body)));
      return Response.json({ results: [{ vulns: [{ id: 'GHSA-active' }, { id: 'GHSA-old' }], ...(queries.length === 1 ? { next_page_token: 'next' } : {}) }] });
    }
    return Response.json(url.endsWith('GHSA-old') ? { id: 'GHSA-old', withdrawn: '2026-01-01' } : { id: 'GHSA-active', aliases: ['CVE-test'] });
  });
  expect(queries).toHaveLength(2);
  expect(queries[1]).toEqual({ queries: [{ package: { ecosystem: 'npm', name: 'public' }, version: '1.0.0', page_token: 'next' }] });
  expect(findings.map(({ id }) => id)).toEqual(['GHSA-active']);
});

test('respects the 1000-query limit and fails closed on malformed results', async () => {
  const sizes: number[] = [];
  await audit(Array.from({ length: 1001 }, (_, i) => ({ name: `package-${i}`, version: '1.0.0' })), async (_, init) => {
    const { queries } = JSON.parse(String(init!.body));
    sizes.push(queries.length);
    return Response.json({ results: queries.map(() => ({})) });
  });
  expect(sizes).toEqual([1000, 1]);
  await expect(audit([{ name: 'public', version: '1.0.0' }], async () => Response.json({ results: [] }))).rejects.toThrow('Invalid OSV batch');
  await expect(audit([{ name: 'public', version: '1.0.0' }], async () => new Response('', { status: 403 }))).rejects.toThrow('HTTP 403');
});

test('retries transient service errors without treating an outage as clean', async () => {
  let attempts = 0;
  await expect(audit([{ name: 'public', version: '1.0.0' }], async () => {
    attempts++;
    return new Response('', { status: 503 });
  })).rejects.toThrow('HTTP 503');
  expect(attempts).toBe(3);
});

test('accepts the node-forge advisory only on its development-only chain', () => {
  const lock = (root: string, extra = '') => `{"lockfileVersion":1,"workspaces":{"":{${root}}},"packages":{
    "web-ext":["web-ext@10.6.0","",{"dependencies":{"@devicefarmer/adbkit":"3.3.9"}},"sha512-test"],
    "@devicefarmer/adbkit":["@devicefarmer/adbkit@3.3.9","",{"dependencies":{"node-forge":"^1.3.1"}},"sha512-test"],
    "node-forge":["node-forge@1.4.0","",{},"sha512-test"],${extra}
  }}`;
  const finding = { id: 'GHSA-86w9-cpqp-85rv', package: { name: 'node-forge', version: '1.4.0' } };
  const dev = '"devDependencies":{"web-ext":"^10.5.0"}';
  expect(exceptionFor(dependencyGraph(lock(dev)), finding)?.id).toBe('GHSA-86w9-cpqp-85rv');
  expect(exceptionFor(dependencyGraph(lock(dev)), { ...finding, id: 'GHSA-other' })).toBeUndefined();
  expect(exceptionFor(dependencyGraph(lock(dev)), { ...finding, package: { name: 'web-ext', version: '10.6.0' } })).toBeUndefined();
  // A production path to any link, or a second parent of a later link, voids the exception.
  expect(exceptionFor(dependencyGraph(lock('"dependencies":{"web-ext":"^10.5.0"}')), finding)).toBeUndefined();
  expect(exceptionFor(dependencyGraph(lock(`"dependencies":{"app":"1.0.0"},${dev}`,
    '"app":["app@1.0.0","",{"dependencies":{"node-forge":"^1.4.0"}},"sha512-test"],')), finding)).toBeUndefined();
  expect(exceptionFor(dependencyGraph(lock(dev,
    '"tool":["tool@1.0.0","",{"dependencies":{"node-forge":"^1.4.0"}},"sha512-test"],')), finding)).toBeUndefined();
  expect(exceptionFor(dependencyGraph(lock('"devDependencies":{}')), finding)).toBeUndefined();
});
