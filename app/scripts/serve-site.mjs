import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'site')
const port = Number(process.env.PORT || 4173)
const lan = process.argv.includes('--lan') || process.env.SITE_LAN === '1'
const host = process.env.SITE_HOST || (lan ? '0.0.0.0' : '127.0.0.1')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.cer': 'application/pkix-cert',
  '.dmg': 'application/x-apple-diskimage'
}

function localAddresses() {
  const addresses = []
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address)
    }
  }
  return [...new Set(addresses)]
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/') pathname = '/index.html'
    if (!pathname.includes('.') && !pathname.endsWith('/')) pathname += '.html'
    const file = path.resolve(root, `.${pathname}`)
    if (!file.startsWith(root)) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<h1>404</h1><p>Page not found.</p>')
      return
    }
    const stat = fs.statSync(file)
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'content-length': stat.size,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff'
    })
    fs.createReadStream(file).pipe(res)
  } catch (error) {
    res.writeHead(500)
    res.end(String(error))
  }
})

server.listen(port, host, () => {
  console.log(`ClearStage site: http://127.0.0.1:${port}`)
  if (lan) {
    console.log('LAN access enabled. Other devices on the same network can use:')
    for (const address of localAddresses()) console.log(`  http://${address}:${port}`)
    console.log('If Windows Firewall prompts, allow Node.js on the private network only.')
  }
})
