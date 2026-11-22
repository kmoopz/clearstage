import { describe, expect, it } from 'vitest'
import {
  formatBytes,
  formatDuration,
  formatMoney,
  formatNumber,
  initials,
  uidSalt
} from '../src/renderer/src/lib/format'
import { DEMO_MESSAGES, DEMO_ROOMS, DEMO_RECORDINGS } from '../src/renderer/src/lib/demo'

describe('format helpers', () => {
  it('formats Chinese viewer counts', () => {
    expect(formatNumber(12_890)).toBe('1.3万')
    expect(formatNumber(2_028_594)).toBe('202.9万')
    expect(formatNumber(120_000_000)).toBe('1.2亿')
    expect(formatNumber(860)).toBe('860')
    expect(formatNumber(undefined)).toBe('—')
  })

  it('formats duration and byte sizes', () => {
    expect(formatDuration(0)).toBe('00:00:00')
    expect(formatDuration(1721)).toBe('00:28:41')
    expect(formatDuration(90, false)).toBe('01:30')
    expect(formatBytes(1_760_000_000)).toBe('1.6 GB')
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats money and initials', () => {
    expect(formatMoney(866)).toBe('¥866.00')
    expect(formatMoney(12_345)).toBe('¥1.23万')
    expect(initials('澄幕放映室')).toBe('澄幕')
    expect(initials('')).toBe('C')
  })

  it('hashes ids deterministically', () => {
    expect(uidSalt('demo:arena')).toBe(uidSalt('demo:arena'))
    expect(uidSalt('demo:arena')).not.toBe(uidSalt('demo:radio'))
  })
})

describe('demo dataset', () => {
  it('has unique rooms, recordings and messages', () => {
    expect(new Set(DEMO_ROOMS.map((room) => room.id)).size).toBe(DEMO_ROOMS.length)
    expect(new Set(DEMO_RECORDINGS.map((item) => item.id)).size).toBe(DEMO_RECORDINGS.length)
    expect(new Set(DEMO_MESSAGES.map((item) => item.id)).size).toBe(DEMO_MESSAGES.length)
  })

  it('keeps every message attached to a demo room', () => {
    const ids = new Set(DEMO_ROOMS.map((room) => room.id))
    for (const message of DEMO_MESSAGES) expect(ids.has(message.roomId)).toBe(true)
  })

  it('uses valid recording ranges', () => {
    for (const recording of DEMO_RECORDINGS) {
      expect(recording.durationSec).toBeGreaterThan(0)
      expect(recording.sizeBytes).toBeGreaterThan(0)
      if (recording.status === 'completed') expect(recording.endedAt).toBeGreaterThan(recording.startedAt)
    }
  })
})
