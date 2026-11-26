// Dispatch for /_/graphql/. Operations are matched by name.
import { graphqlOps } from './registry.js';
import { parseBody } from './request.js';
import { createContext } from './context.js';

export async function handleGraphql(req, res, url) {
  const body = await parseBody(req);
  const name = req.headers['x-pinterest-graphql-name'] || body.queryName || 'unknown';
  const variables = body.variables || {};
  const op = graphqlOps.find((o) => o.match.test(name));
  if (!op) return { data: {}, extensions: {} };
  const ctx = createContext({ req, res, url, data: variables, method: 'POST' });
  ctx.operationName = name;
  return { data: await op.resolve(ctx), extensions: {} };
}
