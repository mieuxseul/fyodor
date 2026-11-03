#!/usr/bin/env node
/**
 * Build a Tauri updater `latest.json` from the NSIS artifact + signature.
 *
 * Usage (after `npm run tauri:build` with signing env vars set):
 *   node ./scripts/make-latest-json.mjs
 *   node ./scripts/make-latest-json.mjs --version 0.2.0 --tag v0.2.0
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const conf = JSON.parse(
  fs.readFileSync(path.join(root, 'src-tauri', 'tauri.conf.json'), 'utf8'),
)

const args = process.argv.slice(2)
function arg(name, fallback) {
  const idx = args.indexOf(`--${name}`)
  if (idx >= 0 && args[idx + 1]) return args[idx + 1]
  return fallback
}

const version = arg('version', conf.version)
const tag = arg('tag', `v${version}`)
const repo = arg('repo', 'rickshank-rickdemption/fyodor')
const notes = arg('notes', `Fyodor ${version}`)

const nsisDir = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'nsis')
if (!fs.existsSync(nsisDir)) {
  console.error(`NSIS bundle folder not found: ${nsisDir}`)
  console.error('Run a signed `npm run tauri:build` first.')
  process.exit(1)
}

const setup = fs
  .readdirSync(nsisDir)
  .find((name) => name.toLowerCase().endsWith('-setup.exe'))
if (!setup) {
  console.error(`No *-setup.exe found in ${nsisDir}`)
  process.exit(1)
}

const setupPath = path.join(nsisDir, setup)
const sigPath = `${setupPath}.sig`
if (!fs.existsSync(sigPath)) {
  console.error(`Missing signature file: ${sigPath}`)
  console.error('Set TAURI_SIGNING_PRIVATE_KEY / PASSWORD and rebuild with createUpdaterArtifacts.')
  process.exit(1)
}

const signature = fs.readFileSync(sigPath, 'utf8').trim()
const url = `https://github.com/${repo}/releases/download/${tag}/${setup}`

const latest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    'windows-x86_64': {
      signature,
      url,
    },
    'windows-x86_64-nsis': {
      signature,
      url,
    },
  },
}

const outDir = path.join(root, 'release')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'latest.json')
fs.writeFileSync(outFile, `${JSON.stringify(latest, null, 2)}\n`)

console.log(`Wrote ${outFile}`)
console.log(`Installer: ${setupPath}`)
console.log(`Upload to GitHub release ${tag}:`)
console.log(`  - ${setup}`)
console.log(`  - ${setup}.sig (optional)`)
console.log(`  - latest.json`)
