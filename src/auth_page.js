const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export function authPage({ mode = 'login', error = '', username = '' } = {}) {
  const signup = mode === 'signup';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="icon" href="/favicon.ico">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${signup ? 'Sign up' : 'Log in'} · pinterestd</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f5f5;
    font:16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111}
  form{background:#fff;width:min(400px,92vw);padding:36px 32px;border-radius:24px;box-shadow:0 2px 16px #0002;display:grid;gap:14px}
  h1{margin:0 0 6px;font-size:28px;text-align:center}
  label{display:grid;gap:4px;font-size:13px;font-weight:600}
  input{font:inherit;padding:12px 14px;border:2px solid #ddd;border-radius:16px;outline:none}
  input:focus{border-color:#0074e8}
  button{font:inherit;font-weight:700;padding:12px;border:0;border-radius:24px;background:#e60023;color:#fff;cursor:pointer;margin-top:6px}
  button:hover{background:#ad081b}
  .err{background:#fde8ea;color:#9b0018;padding:10px 12px;border-radius:12px;font-size:14px}
  p{margin:4px 0 0;text-align:center;font-size:14px} a{color:#111;font-weight:600}
</style></head><body>
<form method="post" action="/${signup ? 'signup' : 'login'}">
  <img src="/assets/logo-192.png" alt="" width="64" height="64" style="margin:0 auto">
  <h1>${signup ? 'Create an account' : 'Welcome back'}</h1>
  ${error ? `<div class="err">${esc(error)}</div>` : ''}
  <label>Username<input name="username" value="${esc(username)}" autocomplete="username" required autofocus></label>
  ${signup ? '<label>Name<input name="full_name" autocomplete="name"></label>' : ''}
  <label>Password<input name="password" type="password" ${signup ? 'minlength="8" autocomplete="new-password"' : 'autocomplete="current-password"'} required></label>
  <button type="submit">${signup ? 'Sign up' : 'Log in'}</button>
  <p>${signup ? 'Already have an account? <a href="/login">Log in</a>' : 'New here? <a href="/signup">Sign up</a>'}</p>
</form></body></html>`;
}
