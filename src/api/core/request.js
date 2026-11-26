// Parsing for the request formats the Pinterest client sends.
import { parseJson } from '../../util/json.js';
import { readText } from '../../util/body.js';

/** GET /resource/X/get/?data={"options":{...}}&bookmark=... */
export function resourceQuery(url) {
  const data = parseJson(url.searchParams.get('data') || '{}', {}) || {};
  return {
    options: data.options || {},
    context: data.context || {},
    bookmark: url.searchParams.get('bookmark') || data.bookmark || null,
  };
}

// The client posts either JSON or form-encoded `data=<json>`. Options live
// under data.options but are also flattened to the top level.
function mergeResourceData(parsed) {
  if (!parsed || typeof parsed !== 'object') return {};
  const data = parseJson(parsed.data, null);
  if (!data || typeof data !== 'object') return parsed;
  return { ...parsed, ...(data.options || {}), options: data.options || {}, context: data.context || {} };
}

/** Parse any request body into a plain object. */
export async function parseBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};
  const text = await readText(req);
  if (!text) return {};
  const json = parseJson(text, undefined);
  if (json && typeof json === 'object') return mergeResourceData(json);
  const params = new URLSearchParams(text);
  if (params.has('data')) return mergeResourceData({ data: params.get('data') });
  return Object.fromEntries(params);
}
