// Read image dimensions straight from file headers, so uploads can be
// validated and sized without any image library.
const JPEG_SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function png(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { ext: '.png', mime: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  return null;
}

function gif(buf) {
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { ext: '.gif', mime: 'image/gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  return null;
}

function webp(buf) {
  if (!(buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')) return null;
  const kind = buf.toString('ascii', 12, 16);
  const base = { ext: '.webp', mime: 'image/webp' };
  if (kind === 'VP8X') return { ...base, width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  if (kind === 'VP8 ') return { ...base, width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return { ...base, width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function jpeg(buf) {
  if (!(buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8)) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (JPEG_SOF.has(marker)) {
      return { ext: '.jpg', mime: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

/** { ext, mime, width, height } or null when the buffer is not a supported image. */
export function imageInfo(buf) {
  if (!Buffer.isBuffer(buf)) return null;
  const info = png(buf) || gif(buf) || webp(buf) || jpeg(buf);
  return info && info.width > 0 && info.height > 0 ? info : null;
}
