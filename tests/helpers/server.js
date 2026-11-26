// Test harness: boots a real Pinned server on a random port with a throwaway
// database, and gives tests a cookie-aware client that speaks the same
// protocols as the vendored Pinterest web client.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Start a server. Returns { url, stop }. */
export async function startServer() {
  const port = await freePort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pinned-test-'));
  const env = {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    PINTERESTD_DB: path.join(tmp, 'test.sqlite'),
    PINNED_DATA_DIR: tmp,
    NODE_NO_WARNINGS: '1',
  };
  const child = spawn(process.execPath, ['server.js'], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (d) => { output += d; });
  child.stderr.on('data', (d) => { output += d; });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      const r = await fetch(`${url}/login`);
      if (r.ok) break;
    } catch {}
    if (child.exitCode !== null || Date.now() > deadline) {
      throw new Error(`server did not start:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return {
    url,
    output: () => output,
    async stop() {
      child.kill();
      await new Promise((r) => child.once('exit', r));
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

let counter = 0;
export function uniqueName(prefix = 'user') {
  counter += 1;
  return `${prefix}${process.pid % 1000}${Date.now().toString(36).slice(-4)}${counter}`;
}

/** A logged-in (or anonymous) client. */
export class Client {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
  }

  async raw(pathname, init = {}) {
    const headers = new Headers(init.headers || {});
    if (this.cookies.size) {
      headers.set('cookie', [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '));
    }
    const res = await fetch(this.base + pathname, { redirect: 'manual', ...init, headers });
    for (const line of res.headers.getSetCookie?.() || []) {
      const [pair, ...attrs] = line.split(';');
      const [k, ...v] = pair.trim().split('=');
      const value = v.join('=');
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
      if (expired || value === '') this.cookies.delete(k);
      else this.cookies.set(k, value);
    }
    return res;
  }

  form(pathname, fields) {
    return this.raw(pathname, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    });
  }

  async signup(username = uniqueName(), password = 'password123', fullName = '') {
    const res = await this.form('/signup', { username, password, full_name: fullName });
    if (res.status !== 303) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
    this.username = username;
    this.password = password;
    const me = await this.api('get', '/v3/users/me/');
    this.id = me.id;
    return this;
  }

  /** Pinterest "resource" call: GET /resource/<Name>/get/?data={options} */
  async resource(name, options = {}, method = 'get') {
    const data = JSON.stringify({ options, context: {} });
    let res;
    if (method === 'get') {
      res = await this.raw(`/resource/${name}/get/?data=${encodeURIComponent(data)}`);
    } else {
      res = await this.raw(`/resource/${name}/${method}/`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ source_url: '/', data }).toString(),
      });
    }
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    if (!res.ok) {
      const err = new Error(`${name}/${method} -> ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body.resource_response ? body.resource_response.data : body;
  }

  /** v3 call tunnelled through ApiResource, the way the client does it. */
  api(method, url, data = {}) {
    return this.resource('ApiResource', { url, data }, method);
  }

  async graphql(name, variables = {}) {
    const res = await this.raw('/_/graphql/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pinterest-graphql-name': name },
      body: JSON.stringify({ queryName: name, variables }),
    });
    return (await res.json()).data;
  }

  async multipart(pathname, field, buffer, filename = 'image.png') {
    const fd = new FormData();
    fd.append('key', 'x');
    fd.append(field, new Blob([buffer], { type: 'image/png' }), filename);
    return this.raw(pathname, { method: 'POST', body: fd });
  }

  /** Full pin-builder flow: register upload, post file, publish story pin. */
  async publishPin({ title = 'A pin', description = '', link = '', boardId, width = 400, height = 600 } = {}) {
    const reg = await this.api('create', '/v3/media/uploads/register/batch/', {
      media_info_list: JSON.stringify([{ id: 'local-1', media_type: 'image-story-pin' }]),
    });
    const { upload_id: uploadId, upload_url: uploadUrl } = reg['local-1'];
    const up = await this.multipart(new URL(uploadUrl).pathname, 'file', png(width, height));
    if (up.status !== 204) throw new Error(`upload failed: ${up.status}`);
    const story = {
      metadata: { pin_title: title, pin_image_signature: uploadId },
      pages: [{ blocks: [{ type: 2, image_signature: uploadId }] }],
    };
    return this.api('create', '/v3/storypins/', {
      title, description, link, board_id: boardId, story_pin: JSON.stringify(story),
    });
  }
}

/** A solid-color PNG of the given size. */
export function png(width, height, rgb = [200, 80, 120]) {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(width).fill(rgb).flat())]);
  const raw = Buffer.concat(Array(height).fill(row));
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
