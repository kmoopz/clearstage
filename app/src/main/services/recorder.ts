import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type {
  Clip,
  Recording,
  RecordingClipInput,
  RecordingProgress,
  Room
} from '../../shared/types'
import type { Store } from '../store'
import type { Ffmpeg } from './ffmpeg'

export interface ResolvedStream {
  url: string
  headers: Record<string, string>
  protocol: 'hls' | 'flv'
  label: string
}

interface SegmentRecord {
  index: number
  file: string
  duration: number
  offset: number
  bytes: number
}

interface ActiveRecording {
  recording: Recording
  room: Room
  stream: ResolvedStream
  abort: AbortController
  stopped: boolean
  loop?: Promise<void>
  segments: SegmentRecord[]
  bytes: number
  duration: number
  playlistUrl: string
  headers: Record<string, string>
  lastProgressAt: number
  allSegments: number
}

type ProgressListener = (progress: RecordingProgress) => void

export class RecordingManager {
  private readonly store: Store
  private readonly ffmpeg: Ffmpeg
  private readonly resolveStream: (room: Room, quality?: string) => Promise<ResolvedStream>
  private readonly active = new Map<string, ActiveRecording>()
  private readonly listeners = new Set<ProgressListener>()

  constructor(
    store: Store,
    ffmpeg: Ffmpeg,
    resolveStream: (room: Room, quality?: string) => Promise<ResolvedStream>
  ) {
    this.store = store
    this.ffmpeg = ffmpeg
    this.resolveStream = resolveStream
    this.recover()
  }

  onProgress(listener: ProgressListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(progress: RecordingProgress): void {
    for (const listener of this.listeners) {
      try {
        listener(progress)
      } catch {
        // ignore
      }
    }
  }

  private recover(): void {
    let changed = false
    for (const recording of this.store.data.recordings) {
      if (recording.status !== 'recording' && recording.status !== 'processing') continue
      const size = this.directorySize(recording.dir)
      recording.status = 'interrupted'
      recording.sizeBytes = size
      recording.endedAt = recording.endedAt ?? Date.now()
      changed = true
      try {
        const manifest = this.readManifest(recording.dir)
        if (manifest?.segments?.length) {
          recording.durationSec = manifest.segments.reduce((sum, item) => sum + item.duration, 0)
          recording.segmentCount = manifest.segments.length
          this.writePlaylist(recording.dir, manifest.segments)
        }
      } catch {
        // ignore
      }
    }
    if (changed) this.store.save()
  }

  private readManifest(dir: string): { segments: SegmentRecord[] } | null {
    try {
      const file = path.join(dir, 'segments.json')
      if (!fs.existsSync(file)) return null
      return JSON.parse(fs.readFileSync(file, 'utf8')) as { segments: SegmentRecord[] }
    } catch {
      return null
    }
  }

  async start(room: Room, quality?: string, songMode = false): Promise<Recording> {
    for (const active of this.active.values()) {
      if (active.room.roomId === room.roomId && !active.stopped) {
        throw new Error('这个直播间已经在录制中')
      }
    }
    const stream = await this.resolveStream(room, quality)
    const id = crypto.randomUUID()
    const startedAt = Date.now()
    const baseName = `${stamp(startedAt)}_${sanitize(room.streamer || room.title)}`
    const dir = uniqueDir(path.join(this.store.data.settings.recordDir, baseName))
    fs.mkdirSync(path.join(dir, 'segments'), { recursive: true })
    const recording: Recording = {
      id,
      roomId: room.roomId,
      roomTitle: room.title,
      streamer: room.streamer,
      platform: room.platform,
      quality: stream.label,
      startedAt,
      status: 'recording',
      durationSec: 0,
      sizeBytes: 0,
      segmentCount: 0,
      dir,
      songMode
    }
    this.store.upsertRecording(recording)
    fs.writeFileSync(
      path.join(dir, 'meta.json'),
      JSON.stringify({ ...recording, streamProtocol: stream.protocol }, null, 2),
      'utf8'
    )
    const active: ActiveRecording = {
      recording,
      room,
      stream,
      abort: new AbortController(),
      stopped: false,
      segments: [],
      bytes: 0,
      duration: 0,
      playlistUrl: stream.url,
      headers: stream.headers,
      lastProgressAt: 0,
      allSegments: 0
    }
    this.active.set(id, active)
    active.loop = stream.protocol === 'hls' ? this.runHls(active) : this.runFlv(active)
    return recording
  }

  private async runHls(active: ActiveRecording): Promise<void> {
    const { recording } = active
    try {
      let first = true
      let failures = 0
      let lastSeen = new Set<string>()
      while (!active.stopped) {
        try {
          const text = await this.fetchText(active.playlistUrl, active.headers, active.abort.signal)
          const playlist = parsePlaylist(text, active.playlistUrl)
          if (playlist.encrypted) {
            throw new Error('该直播流启用了加密，暂不支持录制')
          }
          if (first) {
            const startIndex = Math.max(0, playlist.segments.length - 2)
            playlist.segments = playlist.segments.slice(startIndex)
            first = false
          }
          for (const segment of playlist.segments) {
            if (active.stopped) break
            if (lastSeen.has(segment.url)) continue
            lastSeen.add(segment.url)
            if (lastSeen.size > 200) lastSeen = new Set([...lastSeen].slice(-100))
            const index = active.segments.length + 1
            const fileName = `${String(index).padStart(6, '0')}.ts`
            const target = path.join(recording.dir, 'segments', fileName)
            const bytes = await this.download(segment.url, active.headers, target, active.abort.signal)
            const record: SegmentRecord = {
              index,
              file: `segments/${fileName}`,
              duration: segment.duration || 2,
              offset: active.duration,
              bytes
            }
            active.segments.push(record)
            active.duration += record.duration
            active.bytes += bytes
            active.allSegments = index
            this.writeSegments(active)
            recording.durationSec = active.duration
            recording.sizeBytes = active.bytes
            recording.segmentCount = active.segments.length
            this.store.upsertRecording(recording)
            this.maybeProgress(active, true)
          }
          failures = 0
          await sleep(1800, active.abort.signal)
        } catch (error) {
          if (active.stopped) break
          failures += 1
          if (failures === 2) {
            try {
              const fresh = await this.resolveStream(active.room, String(recording.quality))
              active.playlistUrl = fresh.url
              active.headers = fresh.headers
              active.recording.quality = fresh.label
            } catch {
              // keep retrying the old URL
            }
          }
          if (failures > 12) throw error
          await sleep(Math.min(10_000, 800 * failures), active.abort.signal)
        }
      }
    } catch (error) {
      if (!active.stopped) {
        recording.status = 'failed'
        recording.error = error instanceof Error ? error.message : '录制失败'
        this.store.upsertRecording(recording)
        this.emit(this.progress(active))
      }
    } finally {
      if (active.stopped) await this.finalize(active)
      this.active.delete(recording.id)
    }
  }

  private async runFlv(active: ActiveRecording): Promise<void> {
    const { recording } = active
    const target = path.join(recording.dir, `${sanitize(recording.streamer)}.flv`)
    try {
      recording.filePath = target
      this.store.upsertRecording(recording)
      const response = await fetch(active.stream.url, {
        headers: active.stream.headers,
        signal: active.abort.signal
      })
      if (!response.ok || !response.body) {
        throw new Error(`FLV 流拉取失败：HTTP ${response.status}`)
      }
      let bytes = 0
      const source = Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream)
      source.on('data', (chunk: Buffer) => {
        bytes += chunk.length
        recording.durationSec = (Date.now() - recording.startedAt) / 1000
        recording.sizeBytes = bytes
        this.maybeProgress(active)
      })
      await pipeline(source, fs.createWriteStream(target), { signal: active.abort.signal })
    } catch (error) {
      if (!active.stopped) {
        recording.status = 'failed'
        recording.error = error instanceof Error ? error.message : '录制失败'
        this.store.upsertRecording(recording)
        this.emit(this.progress(active))
      }
    } finally {
      if (active.stopped) await this.finalize(active)
      this.active.delete(recording.id)
    }
  }

  private maybeProgress(active: ActiveRecording, force = false): void {
    const now = Date.now()
    if (!force && now - active.lastProgressAt < 2000) {
      this.store.upsertRecording(active.recording)
      return
    }
    active.lastProgressAt = now
    this.store.upsertRecording(active.recording)
    this.emit(this.progress(active))
  }

  private progress(active: ActiveRecording): RecordingProgress {
    return {
      recordingId: active.recording.id,
      status: active.recording.status,
      durationSec: active.recording.durationSec,
      sizeBytes: active.recording.sizeBytes,
      segmentCount: active.recording.segmentCount,
      error: active.recording.error
    }
  }

  private writeSegments(active: ActiveRecording): void {
    const payload = {
      version: 1,
      roomId: active.recording.roomId,
      startedAt: active.recording.startedAt,
      segments: active.segments
    }
    fs.writeFileSync(path.join(active.recording.dir, 'segments.json'), JSON.stringify(payload, null, 2), 'utf8')
    if (active.recording.segmentCount > 0) {
      this.writePlaylist(active.recording.dir, active.segments)
      active.recording.filePath = path.join(active.recording.dir, 'recording.m3u8')
    }
  }

  private async finalize(active: ActiveRecording): Promise<void> {
    const { recording } = active
    const endedAt = Date.now()
    recording.endedAt = endedAt
    if (recording.status === 'recording') recording.status = 'completed'
    if (!active.segments.length && active.stream.protocol === 'hls') {
      recording.status = recording.status === 'failed' ? 'failed' : 'completed'
      recording.durationSec = Math.max(0, (endedAt - recording.startedAt) / 1000)
    }
    recording.sizeBytes = this.directorySize(recording.dir)
    recording.segmentCount = active.segments.length
    if (active.segments.length) {
      this.writePlaylist(recording.dir, active.segments)
      recording.filePath = path.join(recording.dir, 'recording.m3u8')
      fs.writeFileSync(path.join(recording.dir, 'meta.json'), JSON.stringify(recording, null, 2), 'utf8')
    }
    this.store.upsertRecording(recording)
    this.emit(this.progress(active))

    const ffmpeg = await this.ffmpeg.resolve()
    if (ffmpeg && active.segments.length) {
      const mp4 = path.join(recording.dir, 'recording.mp4')
      recording.status = 'processing'
      this.store.upsertRecording(recording)
      this.emit(this.progress(active))
      try {
        await this.ffmpeg.run([
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          path.join(recording.dir, 'recording.m3u8'),
          '-c',
          'copy',
          '-bsf:a',
          'aac_adtstoasc',
          '-movflags',
          '+faststart',
          mp4
        ])
        if (fs.existsSync(mp4) && fs.statSync(mp4).size > 0) {
          recording.filePath = mp4
          recording.status = 'completed'
        } else {
          recording.status = 'completed'
        }
      } catch (error) {
        console.warn('[recording] remux failed', error)
        recording.status = 'completed'
      }
      this.store.upsertRecording(recording)
      this.emit(this.progress(active))
    }
  }

  async stop(recordingId: string): Promise<Recording> {
    const active = this.active.get(recordingId)
    if (!active) {
      const stored = this.store.getRecording(recordingId)
      if (!stored) throw new Error('找不到录制任务')
      return stored
    }
    active.stopped = true
    active.abort.abort()
    if (active.loop) {
      await Promise.race([active.loop.catch(() => undefined), sleep(20_000)])
    }
    const result = this.store.getRecording(recordingId) ?? active.recording
    return result
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.active.keys()].map((id) => this.stop(id).catch(() => undefined)))
  }

  isRecording(roomId: string): boolean {
    return [...this.active.values()].some((active) => active.room.roomId === roomId && !active.stopped)
  }

  getLiveStream(recordingId: string): { url: string; headers: Record<string, string> } | null {
    const active = this.active.get(recordingId)
    if (!active) return null
    return { url: active.playlistUrl, headers: active.headers }
  }

  getActiveDuration(recordingId: string): number {
    return this.active.get(recordingId)?.recording.durationSec ?? 0
  }

  async exportAudio(
    recordingId: string,
    startSec: number,
    endSec: number,
    title: string
  ): Promise<{ filePath: string; sizeBytes: number }> {
    const recording = this.store.getRecording(recordingId)
    if (!recording) throw new Error('找不到对应的录制')
    const ffmpeg = await this.ffmpeg.resolve()
    if (!ffmpeg) throw new Error('保存歌曲音频需要安装 FFmpeg')
    const source =
      recording.filePath && fs.existsSync(recording.filePath)
        ? recording.filePath
        : path.join(recording.dir, 'recording.m3u8')
    if (!fs.existsSync(source)) throw new Error('录制文件不存在')
    const outputDir = path.join(this.store.data.settings.recordDir, 'songs')
    fs.mkdirSync(outputDir, { recursive: true })
    const target = path.join(outputDir, `${sanitize(title)}_${Date.now()}.m4a`)
    const start = Math.max(0, startSec)
    const duration = Math.max(1, Math.min(endSec, recording.durationSec || endSec) - start)
    await this.ffmpeg.run([
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      start.toFixed(3),
      '-i',
      source,
      '-t',
      duration.toFixed(3),
      '-vn',
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      target
    ])
    return { filePath: target, sizeBytes: fs.existsSync(target) ? fs.statSync(target).size : 0 }
  }

  listActive(): RecordingProgress[] {
    return [...this.active.values()].map((active) => this.progress(active))
  }

  async createClips(input: RecordingClipInput): Promise<Clip[]> {
    const recording = this.store.getRecording(input.recordingId)
    if (!recording) throw new Error('找不到录制文件')
    if (!input.segments.length) throw new Error('至少选择一个片段')
    const outputDir = path.join(this.store.data.settings.recordDir, 'clips')
    fs.mkdirSync(outputDir, { recursive: true })
    const clips: Clip[] = []
    for (let index = 0; index < input.segments.length; index += 1) {
      const segment = input.segments[index]
      const start = Math.max(0, Math.min(segment.startSec, recording.durationSec))
      const end = Math.max(start + 0.5, Math.min(segment.endSec, recording.durationSec))
      if (end - start < 0.5) throw new Error('片段至少要 0.5 秒')
      const title =
        input.title && input.segments.length === 1
          ? input.title
          : `${recording.streamer || recording.roomTitle}_${Math.round(start)}s-${Math.round(end)}s`
      const id = crypto.randomUUID()
      const base = sanitize(title)
      const preciseTarget = path.join(outputDir, `${base}_${id.slice(0, 6)}.mp4`)
      const clip: Clip = {
        id,
        recordingId: recording.id,
        roomId: recording.roomId,
        roomTitle: recording.roomTitle,
        title,
        startSec: start,
        endSec: end,
        createdAt: Date.now(),
        filePath: preciseTarget,
        sizeBytes: 0,
        method: 'precise',
        status: 'processing'
      }
      const ffmpeg = await this.ffmpeg.resolve()
      try {
        if (ffmpeg && recording.filePath && fs.existsSync(recording.filePath)) {
          await this.ffmpeg.run([
            '-y',
            '-hide_banner',
            '-loglevel',
            'error',
            '-ss',
            start.toFixed(3),
            '-i',
            recording.filePath,
            '-t',
            (end - start).toFixed(3),
            '-c',
            'copy',
            '-avoid_negative_ts',
            'make_zero',
            '-movflags',
            '+faststart',
            preciseTarget
          ])
          clip.method = 'precise'
          clip.filePath = preciseTarget
        } else {
          const manifest = this.readManifest(recording.dir)
          if (!manifest?.segments?.length) throw new Error('录制分段信息缺失，无法切片')
          const selected = manifest.segments.filter(
            (item) => item.offset < end && item.offset + item.duration > start
          )
          if (!selected.length) throw new Error('没有覆盖所选时间范围的分段')
          const target = path.join(outputDir, `${base}_${id.slice(0, 6)}.ts`)
          const output = fs.createWriteStream(target)
          for (const item of selected) {
            const segmentPath = path.join(recording.dir, item.file)
            await pipeline(fs.createReadStream(segmentPath), output, { end: false })
          }
          await new Promise<void>((resolve, reject) => {
            output.end((error?: Error | null) => (error ? reject(error) : resolve()))
          })
          clip.method = 'segment'
          clip.filePath = target
        }
        clip.sizeBytes = fs.existsSync(clip.filePath) ? fs.statSync(clip.filePath).size : 0
        clip.status = 'ready'
        this.store.upsertClip(clip)
        clips.push(clip)
      } catch (error) {
        clip.status = 'failed'
        clip.error = error instanceof Error ? error.message : '切片失败'
        this.store.upsertClip(clip)
        clips.push(clip)
      }
    }
    return clips
  }

  async deleteRecording(id: string, deleteFiles = true): Promise<void> {
    const recording = this.store.getRecording(id)
    if (!recording) return
    if (this.active.has(id)) await this.stop(id)
    if (deleteFiles && fs.existsSync(recording.dir)) {
      fs.rmSync(recording.dir, { recursive: true, force: true })
    }
    for (const clip of this.store.data.clips.filter((item) => item.recordingId === id)) {
      if (deleteFiles && clip.filePath && fs.existsSync(clip.filePath)) fs.rmSync(clip.filePath, { force: true })
    }
    this.store.removeRecording(id)
  }

  async deleteClip(id: string, deleteFile = true): Promise<void> {
    const clip = this.store.data.clips.find((item) => item.id === id)
    if (clip && deleteFile && fs.existsSync(clip.filePath)) fs.rmSync(clip.filePath, { force: true })
    this.store.removeClip(id)
  }

  private writePlaylist(dir: string, segments: SegmentRecord[]): void {
    const target = Math.max(2, Math.ceil(Math.max(...segments.map((item) => item.duration), 2)))
    const lines = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      `#EXT-X-TARGETDURATION:${target}`,
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PLAYLIST-TYPE:VOD'
    ]
    for (const segment of segments) {
      lines.push(`#EXTINF:${segment.duration.toFixed(3)},`)
      lines.push(segment.file.replace(/\\/g, '/'))
    }
    lines.push('#EXT-X-ENDLIST')
    fs.writeFileSync(path.join(dir, 'recording.m3u8'), lines.join('\n'), 'utf8')
  }

  private async fetchText(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<string> {
    const response = await fetch(url, { headers, signal, redirect: 'follow' })
    if (!response.ok) throw new Error(`播放列表请求失败：HTTP ${response.status}`)
    return response.text()
  }

  private async download(
    url: string,
    headers: Record<string, string>,
    target: string,
    signal: AbortSignal
  ): Promise<number> {
    let attempt = 0
    while (attempt < 3) {
      attempt += 1
      try {
        const response = await fetch(url, { headers, signal, redirect: 'follow' })
        if (!response.ok || !response.body) throw new Error(`分段请求失败：HTTP ${response.status}`)
        const temp = `${target}.part`
        const source = Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream)
        await pipeline(source, fs.createWriteStream(temp), { signal })
        const bytes = fs.statSync(temp).size
        if (bytes <= 0) throw new Error('直播分段为空')
        fs.renameSync(temp, target)
        return bytes
      } catch (error) {
        if (signal.aborted) throw error
        if (attempt >= 3) throw error
        await sleep(500 * attempt, signal)
      }
    }
    throw new Error('直播分段下载失败')
  }

  private directorySize(dir: string): number {
    if (!fs.existsSync(dir)) return 0
    let total = 0
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      try {
        if (entry.isDirectory()) total += this.directorySize(full)
        else total += fs.statSync(full).size
      } catch {
        // ignore
      }
    }
    return total
  }
}

interface PlaylistSegment {
  url: string
  duration: number
}

export function parsePlaylist(text: string, base: string): { segments: PlaylistSegment[]; encrypted: boolean } {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const segments: PlaylistSegment[] = []
  let encrypted = false
  let duration = 2
  for (const line of lines) {
    if (!line) continue
    if (line.startsWith('#EXT-X-KEY')) {
      if (!/METHOD=NONE/i.test(line)) encrypted = true
      continue
    }
    if (line.startsWith('#EXTINF:')) {
      duration = Number.parseFloat(line.slice(8).split(',')[0] ?? '2') || 2
      continue
    }
    if (line.startsWith('#EXT-X-MAP')) {
      const match = line.match(/URI="([^"]+)"/)
      if (match) {
        // Init segments are not common for Bilibili HLS; keep as a pseudo segment with 0 duration.
        segments.push({ url: new URL(match[1], base).toString(), duration: 0.001 })
      }
      continue
    }
    if (line.startsWith('#')) continue
    segments.push({ url: new URL(line, base).toString(), duration })
    duration = 2
  }
  return { segments, encrypted }
}

function sanitize(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 72) || '直播录制'
  )
}

function stamp(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}${String(date.getSeconds()).padStart(2, '0')}`
}

function uniqueDir(base: string): string {
  if (!fs.existsSync(base)) return base
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}_${index}`
    if (!fs.existsSync(candidate)) return candidate
  }
  return `${base}_${Date.now()}`
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('aborted'))
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms)
    const abort = (): void => {
      clearTimeout(timer)
      reject(new Error('aborted'))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}
