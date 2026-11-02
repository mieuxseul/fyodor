# Contributing

Thanks for poking at FYODOR. Keep changes focused and easy to review.

## Before you start

1. Run the app locally (`npm install` → `npm run tauri:dev`).
2. Open an issue for bigger ideas / breaking changes if one doesn’t exist yet.
3. Prefer small PRs over kitchen-sink dumps.

## Dev loop

```bash
npm install
npm run tauri:dev
```

Useful checks before a PR:

```bash
npm test
npx tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml
```

## Code layout

- `src/` — React UI
- `src-tauri/` — Rust / Tauri commands, SQLite, providers
- `src/source-network/` — provider registry + Discover orchestration

Match the style already in the file you’re editing. Don’t reformat unrelated code.

## Sources / providers

- Official APIs (e.g. MangaDex): stick to documented endpoints and their terms.
- Unofficial site JSON (e.g. Atsumaru): treat as fragile; document what you call and why.
- Don’t enable remote downloads unless there’s a clear, intentional path for that.
- Credit hosts in UI / provider descriptions where required.

## Commits & PRs

- Commit messages: short, imperative (“fix Atsu CDN proxy”, not “fixed stuff”).
- PR description: what changed, how you tested it.
- Screenshots help for UI work.

## Issues worth filing

- Crashes, import failures, broken reader progress
- Provider outages / response shape changes
- Clear UX bugs on Discover / details / reader

Feature requests are fine; say what you’re trying to do, not just a widget wishlist.
