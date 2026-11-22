import crypto from 'node:crypto'
import http from 'node:http'
import { Readable } from 'node:stream'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'

interface MediaEntry {
  url: string
  headers: Record<string, string>
  createdAt: number
  lastUsed: number
}

const FORWARD_HEADERS = [
  'content-type',
  'content-length',
  'last-modified',
  'etag',
  'accept-ranges',
  'content-range'
]

export class MediaProxy {
  private server?: http.Server
  private port = 0
  private readonly entries = new Map<string, MediaEntry>()
  private cleanupTimer?: NodeJS.Timeout

  async start(): Promise<void> {
    if (this.server) return
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((error) => {
        console.error('[media] request failed', error)
        if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('media proxy error')
      })
    })
    await new Promise<void>((resolve, reject) => {
      this.server!.once('error', reject)
      this.server!.listen(0, '127.0.0.1', () => {
        const address = this.server!.address()
        if (address && typeof address === 'object') this.port = address.port
        resolve()
      })
    })
    this.cleanupTimer = setInterval(() => this.cleanup(), 10 * 60_000)
    this.cleanupTimer.unref()
  }

  stop(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    this.server?.close()
    this.server = undefined
  }

  get ready(): boolean {
    return this.port > 0
  }

  register(url: string, headers: Record<string, string> = {}): string {
    if (!this.port) throw new Error('媒体代理尚未启动')
    const parsed = new URL(url)
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('只支持 HTTP(S) 直播流')
    const token = crypto.randomBytes(18).toString('base64url')
    const now = Date.now()
    this.entries.set(token, { url, headers, createdAt: now, lastUsed: now })
    if (this.entries.size > 5000) {
      const sorted = [...this.entries.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)
      for (const [key] of sorted.slice(0, 1000)) this.entries.delete(key)
    }
    return `http://127.0.0.1:${this.port}/h/${token}`
  }

  private cleanup(): void {
    const cutoff = Date.now() - 6 * 60 * 60_000
    for (const [token, entry] of this.entries) {
      if (entry.lastUsed < cutoff) this.entries.delete(token)
    }
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('access-control-allow-origin', '*')
    res.setHeader('access-control-allow-headers', '*')
    res.setHeader('access-control-allow-methods', 'GET, HEAD, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405)
      res.end('method not allowed')
      return
    }
    const pathname = (req.url ?? '').split('?')[0] ?? ''
    const match = pathname.match(/^\/h\/([A-Za-z0-9_-]+)$/)
    if (!match) {
      res.writeHead(404)
      res.end('not found')
      return
    }
    const token = match[1]
    const entry = this.entries.get(token)
    if (!entry) {
      res.writeHead(404)
      res.end('expired')
      return
    }
    entry.lastUsed = Date.now()

    const headers: Record<string, string> = {
      'user-agent': entry.headers['user-agent'] ?? UA,
      accept: '*/*',
      'accept-language': 'zh-CN,zh;q=0.9',
      ...entry.headers
    }
    if (!headers.referer) headers.referer = this.defaultReferer(entry.url)
    if (!headers.origin) {
      try {
        const origin = new URL(entry.url).origin
        if (/bilibili\.com$/.test(new URL(entry.url).hostname)) headers.origin = 'https://live.bilibili.com'
        else headers.origin = origin
      } catch {
        // ignore
      }
    }
    const range = req.headers.range
    if (range) headers.range = range

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20_000)
    let upstream: Response
    try {
      upstream = await fetch(entry.url, {
        headers,
        redirect: 'follow',
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeout)
    }

    if (!upstream.ok && upstream.status !== 206) {
      res.writeHead(upstream.status, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(`upstream ${upstream.status}`)
      return
    }

    const contentType = upstream.headers.get('content-type') ?? this.guessType(entry.url)
    const finalUrl = upstream.url || entry.url
    const isPlaylist =
      /mpegurl/i.test(contentType) ||
      /\.m3u8($|\?)/i.test(finalUrl) ||
      /\.m3u8($|\?)/i.test(entry.url)

    if (isPlaylist) {
      const text = await upstream.text()
      const base = new URL(finalUrl)
      const rewritten = this.rewritePlaylist(text, base, entry.headers)
      res.writeHead(200, {
        'content-type': 'application/vnd.apple.mpegurl',
        'cache-control': 'no-store, no-cache, must-revalidate',
        'access-control-allow-origin': '*'
      })
      res.end(rewritten)
      return
    }

    res.writeHead(upstream.status, {
      'content-type': contentType || 'application/octet-stream',
      'cache-control': 'no-store',
      ...Object.fromEntries(
        FORWARD_HEADERS.flatMap((name) => {
          const value = upstream.headers.get(name)
          return value ? [[name, value]] : []
        })
      )
    })
    if (req.method === 'HEAD' || !upstream.body) {
      res.end()
      return
    }
    const stream = Readable.fromWeb(upstream.body as unknown as import('node:stream/web').ReadableStream)
    stream.on('error', (error) => {
      console.warn('[media] stream error', error.message)
      res.destroy(error)
    })
    stream.pipe(res)
  }

  private rewritePlaylist(text: string, base: URL, headers: Record<string, string>): string {
    return text
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed) return line
        if (trimmed.startsWith('#')) {
          return trimmed.replace(/URI="([^"]+)"/g, (_match, uri: string) => {
            try {
              const absolute = new URL(uri, base).toString()
              return `URI="${this.register(absolute, headers)}"`
            } catch {
              return `URI="${uri}"`
            }
          })
        }
        try {
          return this.register(new URL(trimmed, base).toString(), headers)
        } catch {
          return line
        }
      })
      .join('\n')
  }

  private defaultReferer(url: string): string {
    try {
      const host = new URL(url).hostname
      if (/bilivideo|bilibili/.test(host)) return 'https://live.bilibili.com/'
      return `${new URL(url).origin}/`
    } catch {
      return 'https://live.bilibili.com/'
    }
  }

  private guessType(url: string): string {
    if (/\.m3u8($|\?)/i.test(url)) return 'application/vnd.apple.mpegurl'
    if (/\.ts($|\?)/i.test(url)) return 'video/mp2t'
    if (/\.flv($|\?)/i.test(url)) return 'video/x-flv'
    if (/\.mp4($|\?)/i.test(url)) return 'video/mp4'
    return 'application/octet-stream'
  }
}

export function mediaHeadersFor(referer?: string, userAgent?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'user-agent': userAgent || UA
  }
  if (referer) {
    headers.referer = referer
    headers.origin = new URL(referer).origin
  }
  return headers
}
