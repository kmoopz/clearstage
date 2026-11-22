import { describe, expect, it } from 'vitest'
import { parsePlaylist } from '../src/main/services/recorder'

describe('HLS playlist parser', () => {
  it('reads segment durations and resolves relative URLs', () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:3',
      '#EXTINF:3.000,',
      'live-1.ts',
      '#EXTINF:2.500,',
      'live-2.ts?token=abc',
      '#EXT-X-ENDLIST'
    ].join('\n')
    const result = parsePlaylist(playlist, 'https://cdn.example.com/live/room.m3u8?expires=1')
    expect(result.encrypted).toBe(false)
    expect(result.segments).toHaveLength(2)
    expect(result.segments[0].url).toBe('https://cdn.example.com/live/live-1.ts')
    expect(result.segments[1].url).toBe('https://cdn.example.com/live/live-2.ts?token=abc')
    expect(result.segments.map((segment) => segment.duration)).toEqual([3, 2.5])
  })

  it('detects encryption keys but still parses surrounding segments', () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin"',
      '#EXTINF:2,',
      'segment.ts',
      '#EXT-X-ENDLIST'
    ].join('\n')
    const result = parsePlaylist(playlist, 'https://cdn.example.com/a/b.m3u8')
    expect(result.encrypted).toBe(true)
    expect(result.segments[0].url).toBe('https://cdn.example.com/a/segment.ts')
  })

  it('treats METHOD=NONE as unencrypted', () => {
    const playlist = '#EXTM3U\n#EXT-X-KEY:METHOD=NONE\n#EXTINF:2,\nseg.ts\n#EXT-X-ENDLIST'
    const result = parsePlaylist(playlist, 'https://cdn.example.com/live/main.m3u8')
    expect(result.encrypted).toBe(false)
    expect(result.segments).toHaveLength(1)
  })
})
