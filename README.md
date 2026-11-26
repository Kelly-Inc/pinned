<p align="center">
  <img src="public/logo-192.png" width="96" alt="Pinned logo">
</p>

<h1 align="center">Pinned</h1>

<p align="center">
  A self-hosted Pinterest alternative. Your pins, your boards, your server.
</p>

---

Pinned runs the Pinterest web client against your own backend: a small Node.js server with a SQLite database. You get the Pinterest interface you already know, but every account, pin, board, like and comment lives on a machine you control. Nothing goes to Pinterest.

## Features

- **Accounts:** sign up and log in. Passwords are hashed with scrypt, and sessions are stored server-side and expire after 30 days.
- **Pins:** upload images (JPG, PNG, WebP or GIF, up to 20 MB) with a title, description, link and tags.
- **Boards:** create, rename, make secret and delete boards, and save pins to them.
- **Likes, comments, saves:** the counts come from real data, never placeholder numbers.
- **Follows:** follow and unfollow people, with real follower and following counts.
- **Profiles:** edit your name, about, website, username and pronouns, and upload a profile photo.
- **Settings:** profile, notification and privacy settings, plus light, dark and auto theme.
- **Search:** search across pin titles and descriptions.
- **Self-contained:** a single process with one SQLite file and an upload folder, and no external services.

## Requirements

| | |
|---|---|
| **Node.js** | 22.5 or newer (uses the built-in `node:sqlite`) |
| **OS** | Linux, macOS or Windows |
| **RAM** | about 150 MB |
| **Disk** | about 100 MB for the app, plus your uploads |

Check your Node version with `node --version`. If it's older, install a current one from [nodejs.org](https://nodejs.org) or with [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 22 && nvm use 22
```

## Quick start

```bash
git clone https://github.com/Kelly-Inc/pinned.git
cd pinned
npm start
```

Open **http://localhost:3000**, create an account, and you're in.

There's no build step, and the server itself has no runtime dependencies. `npm install` only pulls in `playwright-core`, which the browser tests use.

### Or with Docker

```bash
git clone https://github.com/Kelly-Inc/pinned.git
cd pinned
docker compose up -d
```

Your database and uploads go into the `pinned-data` volume.

A fresh instance starts empty: no accounts, no pins, no boards. The first account you create is a normal user. Nothing is created for you.

## Configuration

Configure Pinned with environment variables:

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `3000` | Port to listen on |
| `HOST` | `0.0.0.0` | Interface to bind to. Use `127.0.0.1` when running behind a reverse proxy. |
| `PINNED_DATA_DIR` | `data/` | Where the database and uploads live |
| `PINNED_DB` | `$PINNED_DATA_DIR/pinterestd.sqlite` | Path to the SQLite database (`PINTERESTD_DB` also works) |
| `PINNED_SEED` | unset | Set to `1` to load demo pins from `data/seed.json` into an empty instance. They're attached to the first account. |
| `PINNED_LOG_LEVEL` | `info` | `debug` also logs every API call the client makes that isn't implemented yet |
| `PINNED_LOG_REQUESTS` | unset | Set to `1` to log every request with its status and timing |

For example:

```bash
PORT=8080 HOST=127.0.0.1 npm start
```

## Running it for real

### 1. Keep it running with systemd

Create `/etc/systemd/system/pinned.service`:

```ini
[Unit]
Description=Pinned (self-hosted Pinterest alternative)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/pinned
ExecStart=/usr/bin/node server.js
Environment=PORT=3000
Environment=HOST=127.0.0.1
Restart=on-failure
User=pinned

[Install]
WantedBy=multi-user.target
```

Then enable and start it:

```bash
sudo useradd --system --home /opt/pinned pinned
sudo chown -R pinned:pinned /opt/pinned
sudo systemctl daemon-reload
sudo systemctl enable --now pinned
journalctl -u pinned -f   # logs
```

### 2. Put it behind HTTPS

Do this before you share the link with anyone. Over plain HTTP, passwords travel unencrypted, and browsers drop some cookies the client relies on.

**Caddy** is the easiest option, because it gets certificates automatically. Put this in `/etc/caddy/Caddyfile`:

```caddy
pins.example.com {
    reverse_proxy 127.0.0.1:3000
    request_body {
        max_size 25MB
    }
}
```

**nginx** works too:

```nginx
server {
    listen 443 ssl http2;
    server_name pins.example.com;

    ssl_certificate     /etc/letsencrypt/live/pins.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pins.example.com/privkey.pem;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Get a certificate with `sudo certbot --nginx -d pins.example.com`.

### 3. Firewall

When you use a proxy, keep port 3000 closed to the outside:

```bash
sudo ufw allow 80,443/tcp
sudo ufw deny 3000/tcp
```

## Your data

All of your data lives in two places:

| Path | Contents |
|---|---|
| `data/pinterestd.sqlite` | Accounts, pins, boards, saves, likes, comments, follows, settings, sessions |
| `data/media/uploads/` | Uploaded pin images and profile photos |

Both move together if you set `PINNED_DATA_DIR`.

### Backups

```bash
# Consistent snapshot of the database while the server is running
sqlite3 data/pinterestd.sqlite ".backup 'backup-$(date +%F).sqlite'"

# Uploaded images
tar czf media-$(date +%F).tar.gz data/media
```

To restore, stop the server, put both back in place, and start it again.

### What's stored

| Table | Contents |
|---|---|
| `users` | Username, display name, profile fields, avatar, scrypt password hash, settings |
| `sessions` | Login tokens (expire after 30 days) |
| `pins` | Title, description, link, image path and size, owner, tags |
| `boards` | Owner, name, description, secret flag, cover pin |
| `saves` / `likes` / `comments` / `follows` | Who did what to which pin or user, and when |
| `uploads` | Upload tracking for pin and avatar images |

Pinned has no analytics or tracking, and makes no calls to third parties.

## Updating

```bash
cd /opt/pinned
git pull
sudo systemctl restart pinned
```

Database migrations run automatically at startup and are recorded in the `schema_migrations` table. Browsers pick up the new client code automatically after a restart.

## Troubleshooting

**A page looks outdated after an update.** Do one hard refresh with Ctrl+Shift+R, or Cmd+Shift+R on a Mac.

**Dark mode or some settings don't stick.** Run Pinned over HTTPS, as described in step 2. Some client cookies are marked `Secure` and are ignored on plain HTTP.

**Uploads fail behind a proxy.** Raise the proxy's body size limit: `client_max_body_size` in nginx, or `request_body max_size` in Caddy.

**`ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`.** Your Node.js is too old. Install 22.5 or newer.

**Port already in use.** Start on another port, for example `PORT=3001 npm start`.

## How it works

```
Browser ──► server.js ──► src/server/app.js
                            ├── static files    vendored client, uploads, avatars, assets
                            ├── auth            /login /signup /logout
                            ├── uploads         pin images and profile photos
                            ├── API             /resource/*  /v3/*  /_/graphql/
                            │                     └── one file per endpoint → models → SQLite
                            └── app shell       the page that boots the client as you
```

```
src/
├── server/          HTTP server and request pipeline
├── auth/            passwords, sign up and log in, login page
├── api/
│   ├── core/        file-system router, resource and GraphQL dispatch
│   ├── routes/v3/   one file per v3 endpoint (the path is the URL)
│   ├── resources/   one file per Pinterest resource
│   └── graphql/     one file per GraphQL operation
├── database/
│   ├── migrations/  numbered schema migrations
│   └── models/      one model per table
├── schemas/         database rows → the JSON shapes the client expects
├── cdn/             image storage, uploads, avatars
├── client/          app shell, vendored-code rewriting, injected scripts and CSS
├── jobs/            background housekeeping
└── util/            shared helpers
```

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) covers how requests flow, how to add an endpoint, migrations and testing. Run `npm run routes` to list every implemented endpoint.

## Development

```bash
npm run dev        # restart on file changes
npm test           # API tests against a real server and a throwaway database
npm run test:e2e   # browser tests driving the real client in headless Chromium
npm run routes     # list every API endpoint
npm run check      # verify all imports resolve
```

The tests run on every push through GitHub Actions. If you're an AI agent picking up this project, start with [HANDOFF.md](HANDOFF.md).

## Status

Pinned is a work in progress. Not every part of the client is backed by real data yet:

- [x] Accounts, sessions, profiles, avatars
- [x] Pins, uploads, boards, saves, likes, comments, follows
- [x] Settings: profile, notifications, privacy, theme
- [ ] Notifications feed and messages
- [ ] Related pins ("More like this")
- [ ] Video pins
- [ ] Search filters

## Disclaimer

Pinned is an independent, non-commercial project. It is not affiliated with, endorsed by or connected to Pinterest, Inc. "Pinterest" is a trademark of Pinterest, Inc. The web client in `vendor/` is Pinterest's code. Self-host Pinned for personal use, and make sure you are comfortable with that before running a public instance.
