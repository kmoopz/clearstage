import fs from 'node:fs'
import path from 'node:path'

const files = ['index.html', 'docs.html', 'faq.html', 'download.html']
const missing = []
for (const file of files) {
  const text = fs.readFileSync(path.join('site', file), 'utf8')
  for (const match of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = match[1]
    if (url.startsWith('#') || url.startsWith('http') || url.startsWith('mailto:')) continue
    const [targetPath, hash] = url.split('#')
    if (!targetPath) continue
    const target = path.join('site', targetPath)
    if (!fs.existsSync(target)) {
      missing.push(`${file} -> ${url}`)
      continue
    }
    if (hash) {
      const targetText = fs.readFileSync(target, 'utf8')
      if (!targetText.includes(`id="${hash}"`)) missing.push(`${file} -> ${url} (missing anchor)`)
    }
  }
}
console.log(missing.length ? missing.join('\n') : 'all local links resolve')
