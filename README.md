# Fyodor

A desktop manga and manhwa reader. Local library first; online sources when you want them.

## Features

- Import CBZ, ZIP, and image folders into a local library
- Browse titles with reading progress, history, and bookmarks
- Paged and vertical-scroll reading modes
- Discover and read from enabled online sources
- Built-in MangaDex + Atsumaru, plus the full Kotatsu-Redo catalog (~1385 sources) via an optional sidecar

Remote downloads are off for now.

## Install

Grab the latest **Windows setup** from [Releases](https://github.com/rickshank-rickdemption/fyodor/releases).

Prefer the NSIS installer (`Fyodor_x.y.z_x64-setup.exe`) so Settings → **Check for updates** can upgrade you automatically.

For Kotatsu sources you also need a Java 17+ runtime (the installer ships the bridge jar).

## Sources

- **MangaDex** — official API
- **Atsumaru** — unofficial site JSON (not affiliated)
- **Kotatsu sources** — [Kotatsu-Redo parsers](https://github.com/Kotatsu-Redo/kotatsu-parsers-redo) (~1385). Enable individual sites under **Sources → Kotatsu catalog**.

Kotatsu support uses a separate GPL-3.0 Java bridge (`sidecars/kotatsu-bridge`). Fyodor itself stays MIT; the bridge JAR is GPL because it links kotatsu-parsers-redo.

### Build the Kotatsu bridge (optional)

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

## Data

Library paths and privacy notes live under **Settings → Data & privacy**.

Removing a title from the library does not delete the original files you imported.

## License

- Fyodor app: MIT — see [LICENSE](LICENSE)
- `sidecars/kotatsu-bridge`: GPL-3 (kotatsu-dl / kotatsu-parsers lineage)

The optional Kotatsu bridge and vendored kotatsu-parsers-redo sources are GPL-3.0.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
