// Makes `node --test curation/real-art/` work on every Node >= 18.
// Node 18/20 expand a directory argument into its *.test.mjs files themselves.
// Node >= 21 treats test arguments as globs, so a bare directory is executed as a
// module instead, and CommonJS resolves a directory to its index.js: this file,
// which loads every test file beside it. (Not a test file itself, so Node 18/20
// skip it.)
const { readdirSync } = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

for (const f of readdirSync(__dirname).filter((n) => /\.test\.m?js$/.test(n)).sort()) {
  import(pathToFileURL(path.join(__dirname, f)).href).catch((e) => {
    console.error(`failed to load ${f}:`, e)
    process.exitCode = 1
  })
}
