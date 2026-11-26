// Loads the route table and resource handlers once at startup.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Router } from './router.js';

const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const v3 = await Router.load(path.join(API_DIR, 'routes'));

/** Resource name -> module. A module may declare extra `aliases`. */
export const resources = new Map();
for (const file of fs.readdirSync(path.join(API_DIR, 'resources')).filter((f) => f.endsWith('.js'))) {
  const module = await import(pathToFileURL(path.join(API_DIR, 'resources', file)).href);
  const name = file.replace(/\.js$/, '');
  for (const alias of [name, ...(module.aliases || [])]) resources.set(alias, module);
}

/** GraphQL operations, tried in priority order. */
export const graphqlOps = [];
for (const file of fs.readdirSync(path.join(API_DIR, 'graphql')).filter((f) => f.endsWith('.js'))) {
  const module = await import(pathToFileURL(path.join(API_DIR, 'graphql', file)).href);
  graphqlOps.push({ name: file.replace(/\.js$/, ''), ...module });
}
graphqlOps.sort((a, b) => (b.priority || 0) - (a.priority || 0));
