import crypto from 'node:crypto'
import type { AddRoomInput, Room, RoomHeaders } from '../../shared/types'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'

export interface DirectProbe {
  protocol: 'hls' | 'flv'
  contentType: string
}

export class DirectStreamService {
  async probe(url: string, headers: RoomHeaders = {}): Promise<DirectProbe> {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('直播流地址格式不正确')
    }
    if (!/^https?:$/.test(parsed.protocol)) throw new Error('直播流只支持 HTTP(S) 地址')
    const requestHeaders = this.headers(headers)
    const response = await fetch(url, {
      headers: { ...requestHeaders, range: 'bytes=0-2047' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000)
    })
    if (!response.ok && response.status !== 206) {
      throw new Error(`无法读取直播流：HTTP ${response.status}`)
    }
    const contentType = response.headers.get('content-type') ?? ''
    const buffer = Buffer.from(await response.arrayBuffer())
    const prefix = buffer.toString('utf8', 0, Math.min(buffer.length, 64))
    if (contentType.includes('mpegurl') || prefix.trimStart().startsWith('#EXTM3U')) {
      return { protocol: 'hls', contentType }
    }
    if (contentType.includes('flv') || prefix.startsWith('FLV')) {
      return { protocol: 'flv', contentType }
    }
    if (parsed.pathname.endsWith('.m3u8')) return { protocol: 'hls', contentType }
    if (parsed.pathname.endsWith('.flv')) return { protocol: 'flv', contentType }
    throw new Error('无法识别流格式，请使用 .m3u8 或 .flv 直播流地址')
  }

  async resolve(input: AddRoomInput): Promise<Room> {
    const directUrl = (input.directUrl || input.url || '').trim()
    if (!directUrl) throw new Error('请填写直播流地址')
    const probe = await this.probe(directUrl, input.headers)
    const fingerprint = crypto.createHash('sha1').update(directUrl).digest('hex').slice(0, 12)
    const id = `direct:${fingerprint}`
    const streamer = input.streamer?.trim() || '自定义直播'
    const title = input.title?.trim() || `${streamer}的直播`
    return {
      id,
      platform: 'direct',
      roomId: fingerprint,
      title,
      streamer,
      liveStatus: 'live',
      sourceUrl: directUrl,
      playbackMode: 'direct',
      directUrl,
      protocol: probe.protocol,
      headers: input.headers,
      note: `通用直链 · ${probe.protocol.toUpperCase()}`,
      addedAt: Date.now(),
      lastOpenedAt: Date.now()
    }
  }

  headers(headers: RoomHeaders = {}): Record<string, string> {
    const result: Record<string, string> = {
      'user-agent': headers.userAgent || UA,
      accept: '*/*',
      'accept-language': 'zh-CN,zh;q=0.9'
    }
    if (headers.referer) result.referer = headers.referer
    return result
  }
}
