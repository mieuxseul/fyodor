# FYODOR

Desktop manga / manhwa reader. Local library first, online sources optional.

Built with Tauri 2, React, TypeScript, and SQLite.

## What it does

- Import CBZ / ZIP / image folders into a local library
- Browse titles, track reading progress, history, bookmarks
- Dual reading modes (paged + vertical scroll)
- Discover search across enabled sources (Source Network)
- In-app details + reading for MangaDex and Atsumaru (atsu.moe)

Remote downloads are intentionally off for now.

## Requirements

- Node.js 20+
- Rust (stable)
- Windows: MSVC Build Tools (“Desktop development with C++”)
- WebView2 (comes with modern Windows)

## Setup

```bash
npm install
npm run tauri:dev
```

Frontend only (no Rust commands / DB):

```bash
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm test` | Vitest |
| `npm run build` | Frontend production build |
| `npm run tauri:build` | Release app binary / installer |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust tests |

Sample CBZ for import testing:

```bash
node scripts/generate-fixture.mjs
```

Import `fixtures/sample-chapter.cbz` from **Library → Import CBZ**.

## Sources

- **MangaDex** — official API (`api.mangadex.org`). Search, metadata, chapters, at-home pages. Credit MangaDex. Follow their API rules.
- **Atsumaru** — unofficial site JSON (same endpoints the website uses). Search, chapters, in-app reading. Not affiliated with Atsumaru; endpoints can change.
- Covers / page images for Atsumaru are fetched through the app (CDN blocks bare requests).

Provider health lives under **Sources**. If a host is unreachable from your network, disable it there.

## Data

App paths and privacy notes: **Settings → Data & privacy**.

Removing a title from the library does not delete the original files you imported.

## License

MIT — see [LICENSE](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
