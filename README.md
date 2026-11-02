# Fyodor

A desktop manga and manhwa reader. Local library first; online sources when you want them.

## Features

- Import CBZ, ZIP, and image folders into a local library
- Browse titles with reading progress, history, and bookmarks
- Paged and vertical-scroll reading modes
- Discover and read from enabled online sources
- Built-in MangaDex + Atsumaru, plus 1,300+ Kotatsu-Redo parsers via a local bridge
- Windows NSIS installer with in-app updates

Remote downloads are off for now.

## Install

Grab the latest **Windows setup** from [Releases](https://github.com/rickshank-rickdemption/fyodor/releases).

Prefer the NSIS installer (`Fyodor_x.y.z_x64-setup.exe`) so Settings → **Check for updates** can upgrade you automatically.

For Kotatsu sources you also need a Java 17+ runtime (the installer ships the bridge jar).

## Sources

- **MangaDex** — official API
- **Atsumaru** — unofficial site JSON (not affiliated)
- **Kotatsu catalog** — parsers from [Kotatsu-Redo](https://github.com/Kotatsu-Redo/kotatsu-parsers-redo) through a GPL sidecar (`sidecars/kotatsu-bridge`)

Enable individual Kotatsu parsers under **Sources**. Discover searches only the ones you turn on.

### Kotatsu bridge (optional rebuild)

```bash
cd sidecars/kotatsu-bridge
./gradlew shadowJar
copy build\libs\kotatsu-bridge.jar ..\..\src-tauri\resources\kotatsu-bridge.jar
```

## CI

GitHub Actions on `main`:

- Frontend: lint, unit tests, production Vite build
- Rust: `cargo check` + `cargo test` (Windows)
- Smoke: `tauri build --no-bundle` (Windows)

Tag `v*.*.*` runs the Release workflow (NSIS + optional updater `latest.json`).

Repo secrets for signed releases:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (if the key has one)

## Build a Windows release locally

1. Generate (once) and keep private the updater signing key:
   `npx tauri signer generate -w %LOCALAPPDATA%\fyodor-updater\fyodor.key -p <password> --ci`
2. Put the **public** key in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.
3. Run `powershell -File .\scripts\build-windows-release.ps1`
4. Upload from `src-tauri/target/release/bundle/nsis/` plus `release/latest.json` to a GitHub Release tagged `vX.Y.Z`.

Signing env vars: `TAURI_SIGNING_PRIVATE_KEY` (or `_PATH`) and optional `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## Data

Library paths and privacy notes live under **Settings → Data & privacy**.

Removing a title from the library does not delete the original files you imported.

## License

- Fyodor app: MIT — see [LICENSE](LICENSE)
- `sidecars/kotatsu-bridge`: GPL-3 (kotatsu-dl / kotatsu-parsers lineage)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
