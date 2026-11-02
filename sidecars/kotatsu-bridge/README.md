# kotatsu-bridge

GPL-3.0 JSON sidecar that exposes [Kotatsu-Redo parsers](https://github.com/Kotatsu-Redo/kotatsu-parsers-redo) to Fyodor.

Fyodor (MIT) talks to this process over CLI/JSON. The bridge itself is GPL because it links kotatsu-parsers.

## Build

Requires JDK 17+.

```bash
./gradlew shadowJar
```

Output: `build/libs/kotatsu-bridge.jar`

## Commands

```bash
java -jar build/libs/kotatsu-bridge.jar list-sources
java -jar build/libs/kotatsu-bridge.jar search --source MANGADEX --query "one piece"
java -jar build/libs/kotatsu-bridge.jar health
```

Based on [kotatsu-dl](https://github.com/KotatsuApp/kotatsu-dl) loader context.
