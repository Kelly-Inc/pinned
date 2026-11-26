// Prints every API endpoint this server implements.
//   npm run routes
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Load the registry against a throwaway database so nothing real is touched.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pinned-routes-'));
process.env.PINNED_DATA_DIR = tmp;
const { v3, resources, graphqlOps } = await import('../src/api/core/registry.js');

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nv3 REST routes (${v3.routes.length}) - direct /v3/... or tunnelled via ApiResource\n`);
for (const r of v3.list().sort((a, b) => a.path.localeCompare(b.path))) {
  console.log(`  ${pad(r.methods.map((m) => (m === 'del' ? 'DELETE' : m.toUpperCase())).join(','), 18)} /v3${r.path.slice(3)}`);
}

const byModule = new Map();
for (const [name, module] of resources) {
  if (!byModule.has(module)) byModule.set(module, []);
  byModule.get(module).push(name);
}
console.log(`\nResources (${byModule.size} handlers, ${resources.size} names) - /resource/<Name>/<method>/\n`);
for (const [module, names] of [...byModule].sort((a, b) => a[1][0].localeCompare(b[1][0]))) {
  const methods = ['get', 'create', 'update', 'remove'].filter((m) => typeof module[m] === 'function').map((m) => (m === 'remove' ? 'delete' : m));
  console.log(`  ${pad(methods.join(','), 26)} ${names.join(', ')}`);
}

console.log(`\nGraphQL operations (${graphqlOps.length}) - /_/graphql/\n`);
for (const op of graphqlOps) console.log(`  ${pad(op.priority ?? 0, 5)} ${pad(op.name, 20)} ${op.match}`);
console.log('');
fs.rmSync(tmp, { recursive: true, force: true });
