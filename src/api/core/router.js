// File-system router. Every file under src/api/routes is one endpoint:
//
//   routes/v3/pins/#pin/react.js   ->  /v3/pins/:pin/react/
//   routes/v3/users/index.js       ->  /v3/users/
//
// A route module exports handlers named after HTTP methods (get, post, put,
// patch, delete) or `all`. Static segments win over #params, so
// /v3/users/me/ beats /v3/users/#user/.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

function compile(rel) {
  const segments = rel.replace(/\.js$/, '').split(path.sep).filter((s) => s !== 'index');
  const keys = [];
  const pattern = segments.map((segment) => {
    if (segment.startsWith('#')) {
      keys.push(segment.slice(1));
      return '([^/]+)';
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  // Specificity: static segments outrank params, longer paths outrank shorter.
  const score = segments.reduce((acc, s) => acc * 3 + (s.startsWith('#') ? 1 : 2), 1);
  return {
    path: '/' + segments.map((s) => (s.startsWith('#') ? `:${s.slice(1)}` : s)).join('/') + '/',
    regex: new RegExp(`^/${pattern}/?$`),
    keys,
    score,
    depth: segments.length,
  };
}

export class Router {
  constructor(routes) {
    this.routes = routes.sort((a, b) => b.depth - a.depth || b.score - a.score);
  }

  static async load(dir) {
    const routes = [];
    for (const file of walk(dir)) {
      const rel = path.relative(dir, file);
      const module = await import(pathToFileURL(file).href);
      routes.push({ ...compile(rel), module, file: rel });
    }
    return new Router(routes);
  }

  /** Find the route for a pathname: { route, params } or null. */
  match(pathname) {
    const clean = pathname.split('?')[0].replace(/\/{2,}/g, '/');
    for (const route of this.routes) {
      const m = route.regex.exec(clean);
      if (!m) continue;
      const params = {};
      route.keys.forEach((key, i) => { params[key] = decodeURIComponent(m[i + 1]); });
      return { route, params };
    }
    return null;
  }

  /** The handler for an HTTP verb, honoring sensible fallbacks. */
  static handler(module, verb) {
    const order = {
      GET: ['get'],
      HEAD: ['get'],
      POST: ['post', 'put'],
      PUT: ['put', 'post'],
      PATCH: ['patch', 'put', 'post'],
      DELETE: ['delete', 'del'],
    }[verb] || [];
    for (const name of [...order, 'all']) if (typeof module[name] === 'function') return module[name];
    return null;
  }

  list() {
    return this.routes.map((r) => ({
      path: r.path,
      methods: ['get', 'post', 'put', 'patch', 'del', 'all'].filter((m) => typeof r.module[m] === 'function'),
      file: r.file,
    }));
  }
}
