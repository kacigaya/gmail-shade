export interface PackageVersion { name: string; version: string }
type Request = (url: string, init?: RequestInit) => Promise<Response>;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, unknown>;
}

/** Send only exact public npm resolutions, never workspace or custom-registry names. */
export function publicPackages(text: string): PackageVersion[] {
  const lock = object(Bun.JSONC.parse(text));
  if (lock.lockfileVersion !== 1) throw new Error('Unsupported Bun lockfile version');
  const packages = new Map<string, PackageVersion>();
  for (const entry of Object.values(object(lock.packages))) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string') throw new Error('Invalid lockfile package');
    const [resolved, registry, , integrity] = entry;
    if (registry !== '' && !(typeof registry === 'string' && registry.startsWith('https://registry.npmjs.org/'))) continue;
    if (typeof integrity !== 'string' || !/^sha(?:256|512)-/.test(integrity)) continue;
    const split = resolved.lastIndexOf('@');
    const name = resolved.slice(0, split);
    const version = resolved.slice(split + 1);
    if (!/^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(name) || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`Unsupported public resolution: ${resolved}`);
    packages.set(resolved, { name, version });
  }
  if (!packages.size) throw new Error('No exact public packages found');
  return [...packages.values()];
}

/**
 * Reviewed advisories that stay accepted only along one exact development-only chain.
 * The first link must be a root devDependency, each later link may only be required by
 * the link before it, and the vulnerable package must be unreachable from production
 * dependencies. Any other path, package, or advisory still fails the audit.
 */
export const EXCEPTIONS = [{
  id: 'GHSA-86w9-cpqp-85rv',
  chain: ['web-ext', '@devicefarmer/adbkit', 'node-forge'],
  reason: 'web-ext uses adbkit for Firefox for Android only; no fixed node-forge release exists, and it is not in the extension ZIPs.',
}];

export interface DependencyGraph {
  production: Set<string>;
  development: Set<string>;
  parents: Map<string, Set<string>>;
}

/** Name-level graph. Merging nested versions overapproximates edges, which only narrows exceptions. */
export function dependencyGraph(text: string): DependencyGraph {
  const lock = object(Bun.JSONC.parse(text));
  const root = object(object(lock.workspaces)['']);
  const names = (value: unknown) => value === undefined ? [] : Object.keys(object(value));
  const children = new Map<string, Set<string>>();
  const parents = new Map<string, Set<string>>();
  for (const entry of Object.values(object(lock.packages))) {
    if (!Array.isArray(entry) || typeof entry[0] !== 'string') throw new Error('Invalid lockfile package');
    const name = entry[0].slice(0, entry[0].lastIndexOf('@'));
    const meta = entry[2] === undefined || typeof entry[2] === 'string' ? {} : object(entry[2]);
    for (const child of [...names(meta.dependencies), ...names(meta.optionalDependencies), ...names(meta.peerDependencies)]) {
      if (!children.has(name)) children.set(name, new Set());
      children.get(name)!.add(child);
      if (!parents.has(child)) parents.set(child, new Set());
      parents.get(child)!.add(name);
    }
  }
  const production = new Set<string>();
  const queue = [...names(root.dependencies), ...names(root.optionalDependencies), ...names(root.peerDependencies)];
  for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
    if (production.has(name)) continue;
    production.add(name);
    queue.push(...children.get(name) ?? []);
  }
  return { production, development: new Set(names(root.devDependencies)), parents };
}

/** The exception that covers this finding, or undefined when the finding must fail the audit. */
export function exceptionFor(graph: DependencyGraph, finding: { id: string; package: PackageVersion }) {
  return EXCEPTIONS.find(({ id, chain }) =>
    id === finding.id &&
    chain.at(-1) === finding.package.name &&
    graph.development.has(chain[0]!) &&
    chain.every((name) => !graph.production.has(name)) &&
    chain.slice(1).every((name, index) => {
      const parents = graph.parents.get(name);
      return parents?.size === 1 && parents.has(chain[index]!);
    }));
}

async function requestJson(request: Request, url: string, init?: RequestInit): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await request(url, { ...init, signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
          await Bun.sleep(200 * (attempt + 1));
          continue;
        }
        throw new Error(`OSV HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt >= 2 || (error instanceof Error && error.message.startsWith('OSV HTTP'))) throw error;
      await Bun.sleep(200 * (attempt + 1));
    }
  }
}

export async function audit(packages: PackageVersion[], request: Request = fetch) {
  const affected = new Map<string, Set<number>>();
  for (let offset = 0; offset < packages.length; offset += 1000) {
    let pending = packages.slice(offset, offset + 1000).map((pkg, index) => ({ pkg, index: offset + index, token: '', seen: new Set<string>() }));
    while (pending.length) {
      const body = object(await requestJson(request, 'https://api.osv.dev/v1/querybatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: pending.map(({ pkg, token }) => ({ package: { ecosystem: 'npm', name: pkg.name }, version: pkg.version, ...(token ? { page_token: token } : {}) })) }),
      }));
      if (!Array.isArray(body.results) || body.results.length !== pending.length) throw new Error('Invalid OSV batch response');
      const next: typeof pending = [];
      for (let i = 0; i < pending.length; i++) {
        const query = pending[i]!;
        const result = object(body.results[i]);
        if (result.vulns !== undefined && !Array.isArray(result.vulns)) throw new Error('Invalid OSV vulnerability list');
        for (const value of result.vulns ?? []) {
          const { id } = object(value);
          if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid OSV ID');
          if (!affected.has(id)) affected.set(id, new Set());
          affected.get(id)!.add(query.index);
        }
        if (result.next_page_token !== undefined) {
          if (typeof result.next_page_token !== 'string') throw new Error('Invalid OSV page token');
          if (result.next_page_token) {
            if (query.seen.has(result.next_page_token)) throw new Error('Repeated OSV page token');
            query.seen.add(result.next_page_token);
            next.push({ ...query, token: result.next_page_token });
          }
        }
      }
      pending = next;
    }
  }
  const findings: { package: PackageVersion; id: string; aliases: string[]; details: Record<string, unknown> }[] = [];
  for (const [id, indexes] of affected) {
    const details = object(await requestJson(request, `https://api.osv.dev/v1/vulns/${id}`));
    if (details.id !== id) throw new Error('Invalid OSV advisory response');
    if (typeof details.withdrawn === 'string' && details.withdrawn) continue;
    const aliases = Array.isArray(details.aliases) ? details.aliases.filter((alias): alias is string => typeof alias === 'string') : [];
    for (const index of indexes) findings.push({ package: packages[index]!, id, aliases, details });
  }
  return findings;
}

if (import.meta.main) {
  try {
    const lock = await Bun.file('bun.lock').text();
    const packages = publicPackages(lock);
    const graph = dependencyGraph(lock);
    const findings = await audit(packages);
    let blocking = 0;
    for (const finding of findings) {
      const exception = exceptionFor(graph, finding);
      const report = exception ? console.warn : console.error;
      if (exception) report(`Accepted via ${exception.chain.join(' -> ')}: ${exception.reason}`);
      else blocking++;
      report(`${finding.package.name}@${finding.package.version}: ${finding.id} ${finding.aliases.join(', ')} https://osv.dev/vulnerability/${finding.id}`);
      report(JSON.stringify({ severity: finding.details.severity, affected: finding.details.affected }));
    }
    console.log(`OSV: ${packages.length} exact public npm resolutions scanned; ${blocking} active findings, ${findings.length - blocking} accepted exceptions`);
    process.exitCode = blocking ? 1 : 0;
  } catch (error) {
    console.error(`Dependency audit failed: ${String(error)}`);
    process.exitCode = 2;
  }
}
