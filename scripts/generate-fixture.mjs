import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync } from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../fixtures')
const outFile = path.join(outDir, 'sample-chapter.cbz')

function crc32(buf) {
  let crc = ~0
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j += 1) {
      const bit = crc & 1
      crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0)
    }
  }
  return ~crc >>> 0
}

function u16(n) {
  const b = Buffer.alloc(2)
  b.writeUInt16LE(n)
  return b
}

function u32(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32LE(n)
  return b
}

/** Minimal valid 1x1 PNG */
function tinyPng(r, g, b) {
  // Precomputed tiny solid PNGs are awkward; emit uncompressed PPM-like via PNG IHDR/IDAT.
  // Use a fixed known 1x1 red/green/blue PNG base64 variants instead.
  const palette = {
    red: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    green:
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    blue: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMUb922QAAAABJRU5ErkJggg==',
  }
  const key = r > 200 ? 'red' : g > 200 ? 'green' : 'blue'
  return Buffer.from(palette[key], 'base64')
}

function zipStore(files) {
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const data = file.data
    const crc = crc32(data)
    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      name,
    ])
    localParts.push(localHeader, data)

    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ])
    centralParts.push(central)
    offset += localHeader.length + data.length
  }

  const centralDir = Buffer.concat(centralParts)
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])

  return Buffer.concat([...localParts, centralDir, end])
}

fs.mkdirSync(outDir, { recursive: true })
const files = [
  { name: 'page_1.png', data: tinyPng(255, 0, 0) },
  { name: 'page_2.png', data: tinyPng(0, 255, 0) },
  { name: 'page_10.png', data: tinyPng(0, 0, 255) },
]
fs.writeFileSync(outFile, zipStore(files))
console.log(`Wrote ${outFile}`)
// keep deflateRawSync import used for future compressed fixtures
void deflateRawSync
