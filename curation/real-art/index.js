// Lets `node --test curation/real-art/` work on Node 21+, which runs a bare
// directory as a module (this file) instead of finding its tests.
const { readdirSync } = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

for (const f of readdirSync(__dirname).filter((n) => /\.test\.m?js$/.test(n)).sort()) {
  import(pathToFileURL(path.join(__dirname, f)).href).catch((e) => {
    console.error(`failed to load ${f}:`, e)
    process.exitCode = 1
  })
}
