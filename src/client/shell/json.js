/** Edit the JSON inside <script id="..." type="application/json">. */
export function editJsonScript(html, id, transform) {
  const pattern = new RegExp(`(<script id="${id}" type="application/json">)([\\s\\S]*?)(</script>)`);
  return html.replace(pattern, (_m, open, body, close) => {
    const data = JSON.parse(body);
    transform(data);
    return open + JSON.stringify(data) + close;
  });
}
