# Changes

## 2026-11-26

The live Pinned instance on port 3000 was restarted from `89df750`. Login
returned HTTP 200 and migration `0009_conversations` was present. The
pre-migration backup at
`/root/board/backups/pre-conversations-1795710543141.sqlite` passed SQLite's
integrity check. The seven feature commits are local to `main`.

| Commit | User-visible change |
| --- | --- |
| `13c5fe3` | Fixed the blank Privacy and data tab and enabled saving privacy changes. |
| `26617e9` | Aligned privacy settings with the vendored client, added search privacy indexing directives, and fixed the AI content empty state. |
| `f4fa530` | Connected the desktop pin closeup to local related pins. |
| `3f47167` | Persisted pin stars independently of reactions and implemented Favorites and Created by you profile filters. |
| `80ae640` | Added search suggestions and scoped Your Pins search to created and saved pins. Restored the Updates empty state. |
| `f24d713` | Added follow and comment notifications, unread badges, hiding, and in-app notification preferences. |
| `89df750` | Added local private conversations, text replies, pin attachments, recipient search, unread state, and paginated message history. |

### Verification

- At `89df750`, all 63 API tests and the import check passed. Focused Chromium
  checks passed for sending from a profile, receiving and replying in the inbox,
  and clearing unread state. A separate Chromium run verified recipient search.
  The API tests cover pin attachments and reject conversation access by nonmembers.
- The last confirmed complete Chromium suite before messaging passed 14 tests.
  The full suite for messaging was still in progress at handoff. Its output is
  in `/tmp/messaging-last-full`. Check the final summary before claiming a pass,
  or run `npm run test:e2e` if the log is unavailable.
- Board sections were only investigated on a throwaway server. No section code
  was added.

See [HANDOFF.md](HANDOFF.md) for the current gaps and workflow.
