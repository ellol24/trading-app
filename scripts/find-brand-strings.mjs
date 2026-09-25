// Node.js script to find leftover brand strings.
// Run: node scripts/find-brand-strings.mjs
import { readdirSync, statSync, readFileSync } from "node:fs"
import { join, extname } from "node:path"

const ROOT = process.cwd()
const TARGET_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mdx", ".md", ".css"])
const NEEDLES = [
  /TradePro/g,
  /Trade Pro/g,
  /tradepro/g,
  /trade pro/g,
]

function walk(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      // Skip node_modules and .next-like folders
      if (/node_modules|\.next|dist|build|\.git|\.vercel/.test(full)) continue
      walk(full, results)
    } else {
      if (TARGET_EXTS.has(extname(full))) results.push(full)
    }
  }
  return results
}

const files = walk(ROOT)
let total = 0
for (const file of files) {
  const text = readFileSync(file, "utf8")
  let matched = false
  for (const rx of NEEDLES) {
    rx.lastIndex = 0
    if (rx.test(text)) {
      matched = true
      break
    }
  }
  if (matched) {
    total++
    console.log(file)
  }
}
console.log(`\nChecked ${files.length} files. Found ${total} file(s) with potential 'TradePro' strings.`)
