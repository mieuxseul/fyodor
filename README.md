<div align="center">

<img src="branding/fyodor-icon.png" alt="Fyodor icon" width="160" />

# Fyodor

---

## Desktop manga reader

Discover and read manga, manhwa, comics, and local archives — easier than ever on Windows.

<br />

<a href="https://github.com/rickshank-rickdemption/fyodor/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/rickshank-rickdemption/fyodor/ci.yml?branch=main&label=CI&style=flat-square" /></a>
<a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" /></a>
<a href="https://github.com/rickshank-rickdemption/fyodor/releases"><img alt="Release" src="https://img.shields.io/github/v/release/rickshank-rickdemption/fyodor?style=flat-square&label=release" /></a>
<a href="https://github.com/rickshank-rickdemption/fyodor/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/rickshank-rickdemption/fyodor/total?style=flat-square&label=downloads" /></a>

</div>

<br />

<div align="center">

## Download

<a href="https://github.com/rickshank-rickdemption/fyodor/releases/latest"><img alt="Stable" src="https://img.shields.io/github/v/release/rickshank-rickdemption/fyodor?style=for-the-badge&label=Stable&color=2f81f7" /></a>
&nbsp;
<a href="https://github.com/rickshank-rickdemption/fyodor/releases"><img alt="All releases" src="https://img.shields.io/badge/All%20releases-browse-6e7681?style=for-the-badge" /></a>

<br />

*Requires Windows 10+ with WebView2. Prefer the NSIS setup (`Fyodor_*_x64-setup.exe`) for in-app updates.*

</div>

---

<div align="center">

## Features

</div>

- Local library first — import CBZ, ZIP, and image folders
- Reading progress, history, and bookmarks across titles
- Paged and vertical-scroll reader modes
- Discover & read from enabled online sources
- Built-in **MangaDex** + **Atsumaru**
- Full **[Kotatsu-Redo](https://github.com/Kotatsu-Redo/kotatsu-parsers-redo)** catalog (~1385 sources) via optional GPL sidecar
- Soft glass UI with compact library controls

Remote chapter downloads are off for now.

---

<div align="center">

## Sources

</div>

| Source | Notes |
| --- | --- |
| **MangaDex** | Official API |
| **Atsumaru** | Unofficial site JSON (not affiliated) |
| **Kotatsu** | [kotatsu-parsers-redo](https://github.com/Kotatsu-Redo/kotatsu-parsers-redo) — enable sites under **Sources → Kotatsu catalog** |

Kotatsu support uses a separate GPL-3.0 Java bridge (`sidecars/kotatsu-bridge`). Fyodor itself stays MIT; the bridge JAR is GPL because it links kotatsu-parsers-redo. A Java 17+ runtime is required for Kotatsu.

<details>
<summary><strong>Build the Kotatsu bridge (optional)</strong></summary>

Requires JDK 17+.

```bash
# once: publish parsers to local Maven
cd sidecars/kotatsu-parsers-redo
./gradlew publishToMavenLocal

# build the shadow JAR
cd ../kotatsu-bridge
./gradlew shadowJar
copy build/libs/kotatsu-bridge.jar ../bin/kotatsu-bridge.jar
```

Point `JAVA_HOME` at a JDK, or install under `%LOCALAPPDATA%\jdk-17`. Override the JAR with `FYODOR_KOTATSU_BRIDGE`.

</details>

---

<div align="center">

## Contributing

[Contributing guide](CONTRIBUTING.md)

</div>

Pull requests are welcome. Keep them focused and easy to review — check out [CONTRIBUTING.md](CONTRIBUTING.md) before opening one.

Before filing a bug, skim existing issues and the latest [release notes](https://github.com/rickshank-rickdemption/fyodor/releases).

---

<div align="center">

### Disclaimer

The developer(s) of this application do not have any affiliation with the content providers available, and this application hosts zero content.

### License

</div>

```
Copyright © 2026 rickshank-rickdemption

Fyodor is licensed under the MIT License.
https://opensource.org/licenses/MIT

The optional Kotatsu bridge (sidecars/kotatsu-bridge) and vendored
kotatsu-parsers-redo sources are GPL-3.0.
```

See [LICENSE](LICENSE) for the full MIT text.
