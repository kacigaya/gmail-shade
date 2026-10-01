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
    const packages = publicPackages(await Bun.file('bun.lock').text());
    const findings = await audit(packages);
    for (const finding of findings) {
      console.error(`${finding.package.name}@${finding.package.version}: ${finding.id} ${finding.aliases.join(', ')} https://osv.dev/vulnerability/${finding.id}`);
      console.error(JSON.stringify({ severity: finding.details.severity, affected: finding.details.affected }));
    }
    console.log(`OSV: ${packages.length} exact public npm resolutions scanned; ${findings.length} active findings`);
    process.exitCode = findings.length ? 1 : 0;
  } catch (error) {
    console.error(`Dependency audit failed: ${String(error)}`);
    process.exitCode = 2;
  }
}
