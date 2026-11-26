// Verifies every relative import under a directory resolves to a file.
// Usage: node tools/check-imports.js src
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
let bad = 0;
for (const f of walk(process.argv[2])) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/from '(\.[^']+)'/g)) {
    const target = path.resolve(path.dirname(f), m[1]);
    if (!fs.existsSync(target)) { console.log('MISSING', f, '->', m[1]); bad++; }
  }
}
console.log(bad ? `${bad} bad imports` : "all imports resolve");
if (bad) process.exit(1);
