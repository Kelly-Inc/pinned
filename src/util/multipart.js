// Minimal multipart/form-data reader: returns the bytes of one named field.
export function multipartField(body, contentType, field) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!match) return body; // raw upload, not multipart
  const delimiter = Buffer.from(`--${match[1] || match[2]}`);
  const fieldPattern = new RegExp(`name="${field}"`, 'i');
  let pos = body.indexOf(delimiter);
  while (pos !== -1) {
    const next = body.indexOf(delimiter, pos + delimiter.length);
    if (next === -1) break;
    const part = body.subarray(pos + delimiter.length + 2, next - 2);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1 && fieldPattern.test(part.subarray(0, headerEnd).toString('utf8'))) {
      return part.subarray(headerEnd + 4);
    }
    pos = next;
  }
  return null;
}
