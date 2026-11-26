// Small response helpers shared by every layer.
export function sendJson(res, value, status = 200, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
}

export function sendHtml(res, body, status = 200, headers = {}) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
}

export function sendText(res, body, status = 200, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(body);
}

export function redirect(res, location, status = 303, headers = {}) {
  res.writeHead(status, { location, 'cache-control': 'no-store', ...headers });
  res.end();
}
