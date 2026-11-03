# Signed Windows NSIS build for Fyodor + updater artifacts.
# Requires:
#   - Node, Rust, WebView2, NSIS (via Tauri)
#   - TAURI_SIGNING_PRIVATE_KEY or key file + password

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$defaultKey = Join-Path $env:LOCALAPPDATA "fyodor-updater\fyodor.key"
if (-not $env:TAURI_SIGNING_PRIVATE_KEY -and -not $env:TAURI_SIGNING_PRIVATE_KEY_PATH) {
  if (Test-Path $defaultKey) {
    $env:TAURI_SIGNING_PRIVATE_KEY_PATH = $defaultKey
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
      $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "fyodor-local-signing"
    }
  } else {
    Write-Error "Missing signing key. Generate with: npx tauri signer generate -w `"$defaultKey`" -p <password> --ci"
  }
}

# Prefer path-based env if only PATH is set
if ($env:TAURI_SIGNING_PRIVATE_KEY_PATH -and -not $env:TAURI_SIGNING_PRIVATE_KEY) {
  $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $env:TAURI_SIGNING_PRIVATE_KEY_PATH -Raw
}

$jar = Join-Path $root "sidecars\kotatsu-bridge.jar"
$jarBuild = Join-Path $root "sidecars\kotatsu-bridge\build\libs\kotatsu-bridge.jar"
if (-not (Test-Path $jar) -and (Test-Path $jarBuild)) {
  Copy-Item $jarBuild $jar -Force
}
if (-not (Test-Path $jar)) {
  Write-Warning "kotatsu-bridge.jar missing — Kotatsu sources will be unavailable in this build."
  Write-Warning "Build it with: cd sidecars/kotatsu-bridge; .\gradlew.bat shadowJar"
}

Write-Host "Building Fyodor NSIS installer..."
npm run tauri:build
node .\scripts\make-latest-json.mjs

Write-Host "Done. Artifacts under src-tauri\target\release\bundle\nsis and release\latest.json"
