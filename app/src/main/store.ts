import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type {
  AppSettings,
  Clip,
  DayStats,
  GiftAggregate,
  Recording,
  Room,
  RoomSnapshot,
  Song
} from '../shared/types'

export interface HistoryEntry {
  id: string
  roomId: string
  text: string
  timestamp: number
  type: 'sent' | 'favorite'
  used: number
}

export interface Database {
  version: number
  createdAt: number
  settings: AppSettings
  rooms: Room[]
  recordings: Recording[]
  clips: Clip[]
  songs: Song[]
  snapshots: Record<string, RoomSnapshot[]>
  daily: Record<string, DayStats>
  giftAgg: Record<string, GiftAggregate & { date: string; roomId: string }>
  history: HistoryEntry[]
  recentFeeds: Record<string, { fetchedAt: number }>
}

const DEFAULT_DANMAKU = {
  fontSize: 16,
  opacity: 0.92,
  showGifts: true,
  showEnter: false,
  area: 72
}

export function defaultSettings(): AppSettings {
  return {
    themeId: 'nocturne',
    accent: '#70f0c0',
    customCss: '',
    recordDir: path.join(app.getPath('videos'), 'ClearStage'),
    ffmpegPath: '',
    layout: '4',
    videoFit: 'cover',
    multiViewQuality: 'auto',
    startupPage: 'live',
    autoReconnect: true,
    notifications: true,
    danmaku: { ...DEFAULT_DANMAKU },
    songRecognition: {
      enabled: false,
      provider: 'none',
      auddToken: '',
      acrHost: '',
      acrAccessKey: '',
      acrAccessSecret: '',
      acoustidClientKey: '',
      fpcalcPath: '',
      songrecPath: ''
    }
  }
}

function defaultDb(): Database {
  return {
    version: 1,
    createdAt: Date.now(),
    settings: defaultSettings(),
    rooms: [],
    recordings: [],
    clips: [],
    songs: [],
    snapshots: {},
    daily: {},
    giftAgg: {},
    history: [],
    recentFeeds: {}
  }
}

function deepMerge<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return base
  const out = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue
    const previous = out[key]
    if (
      previous &&
      typeof previous === 'object' &&
      !Array.isArray(previous) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      out[key] = deepMerge(previous, value)
    } else {
      out[key] = value
    }
  }
  return out as T
}

export class Store {
  readonly dataDir: string
  readonly dbPath: string
  data: Database

  constructor(dataDir: string) {
    this.dataDir = dataDir
    this.dbPath = path.join(dataDir, 'clearstage.json')
    fs.mkdirSync(dataDir, { recursive: true })
    this.data = this.load()
  }

  private load(): Database {
    if (!fs.existsSync(this.dbPath)) return defaultDb()
    try {
      const raw = JSON.parse(fs.readFileSync(this.dbPath, 'utf8')) as Partial<Database>
      const merged = { ...defaultDb(), ...raw }
      merged.settings = deepMerge(defaultSettings(), raw.settings)
      merged.rooms = Array.isArray(raw.rooms) ? raw.rooms : []
      merged.recordings = Array.isArray(raw.recordings) ? raw.recordings : []
      merged.clips = Array.isArray(raw.clips) ? raw.clips : []
      merged.songs = Array.isArray(raw.songs) ? raw.songs : []
      merged.snapshots = raw.snapshots && typeof raw.snapshots === 'object' ? raw.snapshots : {}
      merged.daily = raw.daily && typeof raw.daily === 'object' ? raw.daily : {}
      merged.giftAgg = raw.giftAgg && typeof raw.giftAgg === 'object' ? raw.giftAgg : {}
      merged.history = Array.isArray(raw.history) ? raw.history : []
      merged.recentFeeds = raw.recentFeeds && typeof raw.recentFeeds === 'object' ? raw.recentFeeds : {}
      return merged
    } catch (error) {
      const backup = `${this.dbPath}.corrupt-${Date.now()}`
      try {
        fs.copyFileSync(this.dbPath, backup)
      } catch {
        // ignore
      }
      console.error('[store] failed to load database, starting fresh', error)
      return defaultDb()
    }
  }

  save(): void {
    const temp = `${this.dbPath}.${process.pid}.tmp`
    fs.mkdirSync(this.dataDir, { recursive: true })
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), 'utf8')
    fs.renameSync(temp, this.dbPath)
  }

  mutate(fn: (db: Database) => void): void {
    fn(this.data)
    this.save()
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    this.data.settings = deepMerge(this.data.settings, patch)
    this.save()
    return this.data.settings
  }

  listRooms(): Room[] {
    return [...this.data.rooms].sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt))
  }

  upsertRoom(room: Room): Room {
    const index = this.data.rooms.findIndex((item) => item.id === room.id)
    if (index >= 0) {
      this.data.rooms[index] = { ...this.data.rooms[index], ...room }
    } else {
      this.data.rooms.push(room)
    }
    this.save()
    return room
  }

  removeRoom(id: string): void {
    this.data.rooms = this.data.rooms.filter((room) => room.id !== id)
    this.save()
  }

  touchRoom(id: string): void {
    const room = this.data.rooms.find((item) => item.id === id)
    if (room) {
      room.lastOpenedAt = Date.now()
      this.save()
    }
  }

  listRecordings(): Recording[] {
    return [...this.data.recordings].sort((a, b) => b.startedAt - a.startedAt)
  }

  getRecording(id: string): Recording | undefined {
    return this.data.recordings.find((item) => item.id === id)
  }

  upsertRecording(recording: Recording): void {
    const index = this.data.recordings.findIndex((item) => item.id === recording.id)
    if (index >= 0) this.data.recordings[index] = recording
    else this.data.recordings.push(recording)
    this.save()
  }

  removeRecording(id: string): void {
    this.data.recordings = this.data.recordings.filter((item) => item.id !== id)
    this.data.clips = this.data.clips.filter((item) => item.recordingId !== id)
    this.data.songs = this.data.songs.filter((item) => item.recordingId !== id)
    this.save()
  }

  listClips(): Clip[] {
    return [...this.data.clips].sort((a, b) => b.createdAt - a.createdAt)
  }

  upsertClip(clip: Clip): void {
    const index = this.data.clips.findIndex((item) => item.id === clip.id)
    if (index >= 0) this.data.clips[index] = clip
    else this.data.clips.push(clip)
    this.save()
  }

  removeClip(id: string): void {
    this.data.clips = this.data.clips.filter((item) => item.id !== id)
    this.save()
  }

  listSongs(): Song[] {
    return [...this.data.songs].sort((a, b) => b.startedAt - a.startedAt)
  }

  upsertSong(song: Song): void {
    const index = this.data.songs.findIndex((item) => item.id === song.id)
    if (index >= 0) this.data.songs[index] = song
    else this.data.songs.push(song)
    this.save()
  }

  removeSong(id: string): void {
    this.data.songs = this.data.songs.filter((item) => item.id !== id)
    this.save()
  }

  recordSnapshot(roomId: string, snapshot: RoomSnapshot): RoomSnapshot[] {
    const list = this.data.snapshots[roomId] ?? []
    const last = list[list.length - 1]
    if (last && snapshot.t - last.t < 60_000) {
      list[list.length - 1] = { ...last, ...snapshot }
    } else {
      list.push(snapshot)
    }
    if (list.length > 5000) list.splice(0, list.length - 5000)
    this.data.snapshots[roomId] = list

    const day = dayKey(snapshot.t)
    const key = `${day}:${roomId}`
    const current =
      this.data.daily[key] ??
      ({
        date: day,
        giftValue: 0,
        messages: 0,
        peakOnline: 0,
        secondsWatched: 0
      } satisfies DayStats)
    if (typeof snapshot.online === 'number' && snapshot.online > current.peakOnline) {
      current.peakOnline = snapshot.online
    }
    if (typeof snapshot.followers === 'number') current.followersEnd = snapshot.followers
    this.data.daily[key] = current
    this.save()
    return list
  }

  recordMessage(roomId: string): void {
    const key = `${dayKey(Date.now())}:${roomId}`
    const current =
      this.data.daily[key] ??
      ({
        date: dayKey(Date.now()),
        giftValue: 0,
        messages: 0,
        peakOnline: 0,
        secondsWatched: 0
      } satisfies DayStats)
    current.messages += 1
    this.data.daily[key] = current
    this.save()
  }

  recordGift(roomId: string, name: string, value: number): void {
    const date = dayKey(Date.now())
    const key = `${date}:${roomId}`
    const day =
      this.data.daily[key] ??
      ({
        date,
        giftValue: 0,
        messages: 0,
        peakOnline: 0,
        secondsWatched: 0
      } satisfies DayStats)
    day.giftValue += value
    this.data.daily[key] = day
    const aggKey = `${key}:${name}`
    const agg = this.data.giftAgg[aggKey] ?? { date, roomId, name, count: 0, value: 0 }
    agg.count += 1
    agg.value += value
    this.data.giftAgg[aggKey] = agg
    this.save()
  }

  addWatchedSeconds(roomId: string, seconds: number): void {
    if (seconds <= 0) return
    const date = dayKey(Date.now())
    const key = `${date}:${roomId}`
    const current =
      this.data.daily[key] ??
      ({
        date,
        giftValue: 0,
        messages: 0,
        peakOnline: 0,
        secondsWatched: 0
      } satisfies DayStats)
    current.secondsWatched += Math.min(seconds, 300)
    this.data.daily[key] = current
    this.save()
  }

  addHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp' | 'used'> & { id?: string }): HistoryEntry {
    const text = entry.text.trim()
    const existing = this.data.history.find(
      (item) => item.roomId === entry.roomId && item.text === text && item.type === entry.type
    )
    if (existing) {
      existing.used += 1
      existing.timestamp = Date.now()
      this.save()
      return existing
    }
    const value: HistoryEntry = {
      id: entry.id ?? crypto.randomUUID(),
      roomId: entry.roomId,
      text,
      type: entry.type,
      timestamp: Date.now(),
      used: 1
    }
    this.data.history.unshift(value)
    this.data.history = this.data.history.slice(0, 500)
    this.save()
    return value
  }

  listHistory(roomId?: string): HistoryEntry[] {
    return this.data.history
      .filter((item) => !roomId || item.roomId === roomId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 120)
  }

  removeHistory(id: string): void {
    this.data.history = this.data.history.filter((item) => item.id !== id)
    this.save()
  }
}

export function dayKey(timestamp = Date.now()): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
