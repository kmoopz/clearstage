import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import type { AppSettings, Recording, Room, Song } from '../../shared/types'
import type { Store } from '../store'
import type { Ffmpeg } from './ffmpeg'
import type { RecordingManager } from './recorder'

const execFileAsync = promisify(execFile)

interface Recognition {
  title: string
  artist: string
  album?: string
  confidence?: number
}

interface SongSession {
  recording: Recording
  room: Room
  current?: {
    key: string
    title: string
    artist: string
    confidence?: number
    startSec: number
    lastMatchSec: number
  }
  timer?: NodeJS.Timeout
  busy: boolean
  stopped: boolean
}

type SongListener = (song: Song) => void

export class SongCaptureService {
  private readonly store: Store
  private readonly recorder: RecordingManager
  private readonly ffmpeg: Ffmpeg
  private readonly settingsProvider: () => AppSettings
  private readonly sessions = new Map<string, SongSession>()
  private readonly listeners = new Set<SongListener>()

  constructor(
    store: Store,
    recorder: RecordingManager,
    ffmpeg: Ffmpeg,
    settingsProvider: () => AppSettings
  ) {
    this.store = store
    this.recorder = recorder
    this.ffmpeg = ffmpeg
    this.settingsProvider = settingsProvider
  }

  onSong(listener: SongListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(song: Song): void {
    for (const listener of this.listeners) {
      try {
        listener(song)
      } catch {
        // ignore
      }
    }
  }

  async start(recording: Recording, room: Room): Promise<boolean> {
    const settings = this.settingsProvider()
    if (!settings.songRecognition.enabled || settings.songRecognition.provider === 'none') return false
    if (!(await this.ffmpeg.resolve())) return false
    if (this.sessions.has(recording.id)) return true
    const session: SongSession = { recording, room, busy: false, stopped: false }
    this.sessions.set(recording.id, session)
    session.timer = setInterval(() => void this.tick(session), 30_000)
    setTimeout(() => void this.tick(session), 12_000)
    return true
  }

  private async tick(session: SongSession): Promise<void> {
    if (session.busy || session.stopped) return
    session.busy = true
    try {
      const settings = this.settingsProvider()
      const provider = settings.songRecognition.provider
      if (provider === 'none') return
      const stream = this.recorder.getLiveStream(session.recording.id)
      if (!stream) return
      const audio = await this.sample(stream.url, stream.headers)
      if (!audio.length) return
      const result = await this.recognize(settings, audio)
      const now = this.recorder.getActiveDuration(session.recording.id)
      if (!result) {
        if (session.current && now - session.current.lastMatchSec > 120) {
          await this.finalizeCurrent(session, now)
        }
        return
      }
      const key = `${result.artist.toLowerCase()}::${result.title.toLowerCase()}`
      if (!session.current) {
        session.current = {
          key,
          title: result.title,
          artist: result.artist,
          confidence: result.confidence,
          startSec: Math.max(0, now - 8),
          lastMatchSec: now
        }
        return
      }
      if (session.current.key === key) {
        session.current.lastMatchSec = now
        return
      }
      await this.finalizeCurrent(session, now)
      session.current = {
        key,
        title: result.title,
        artist: result.artist,
        confidence: result.confidence,
        startSec: Math.max(0, now - 8),
        lastMatchSec: now
      }
    } catch (error) {
      console.warn('[songs] recognition tick failed', error instanceof Error ? error.message : error)
    } finally {
      session.busy = false
    }
  }

  private async sample(url: string, headers: Record<string, string>): Promise<Buffer> {
    const args = ['-hide_banner', '-loglevel', 'error']
    if (headers['user-agent']) args.push('-user_agent', headers['user-agent'])
    if (headers.referer) args.push('-headers', `Referer: ${headers.referer}\r\n`)
    args.push('-i', url, '-t', '8', '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', 'pipe:1')
    return this.ffmpeg.capture(args, 45_000)
  }

  private async recognize(settings: AppSettings, audio: Buffer): Promise<Recognition | null> {
    const config = settings.songRecognition
    if (config.provider === 'acoustid') {
      const result = await this.recognizeAcoustId(config, audio)
      return result
    }
    if (config.provider === 'songrec') {
      const result = await this.recognizeSongRec(config, audio)
      return result
    }
    if (config.provider === 'audd') {
      if (!config.auddToken) return null
      const form = new FormData()
      form.append('api_token', config.auddToken)
      form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'sample.wav')
      form.append('return', 'apple_music,spotify')
      const response = await fetch('https://api.audd.io/', {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(30_000)
      })
      const json = (await response.json()) as {
        status?: string
        result?: { artist?: string; title?: string; album?: string } | null
        error?: { error_message?: string }
      }
      if (json.status !== 'success') {
        throw new Error(json.error?.error_message || 'AudD 识别失败')
      }
      if (!json.result?.title) return null
      return {
        title: json.result.title,
        artist: json.result.artist || '未知歌手',
        album: json.result.album
      }
    }
    if (config.provider === 'acrcloud') {
      if (!config.acrHost || !config.acrAccessKey || !config.acrAccessSecret) return null
      const timestamp = Math.floor(Date.now() / 1000)
      const stringToSign = [
        'POST',
        '/v1/identify',
        config.acrAccessKey,
        'audio',
        '1',
        String(timestamp)
      ].join('\n')
      const signature = crypto
        .createHmac('sha1', config.acrAccessSecret)
        .update(stringToSign)
        .digest('base64')
      const host = /^https?:\/\//.test(config.acrHost)
        ? config.acrHost.replace(/\/$/, '')
        : `https://${config.acrHost.replace(/\/$/, '')}`
      const form = new FormData()
      form.append('access_key', config.acrAccessKey)
      form.append('data_type', 'audio')
      form.append('signature_version', '1')
      form.append('signature', signature)
      form.append('sample_bytes', String(audio.length))
      form.append('timestamp', String(timestamp))
      form.append('sample', new Blob([new Uint8Array(audio)], { type: 'audio/wav' }), 'sample.wav')
      const response = await fetch(`${host}/v1/identify`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(30_000)
      })
      const json = (await response.json()) as {
        status?: { code?: number; msg?: string }
        metadata?: {
          music?: Array<{
            title?: string
            score?: number
            artists?: Array<{ name?: string }>
            album?: { name?: string }
          }>
        }
      }
      if (json.status?.code !== 0) {
        throw new Error(json.status?.msg || 'ACRCloud 识别失败')
      }
      const music = json.metadata?.music?.[0]
      if (!music?.title) return null
      return {
        title: music.title,
        artist: music.artists?.[0]?.name || '未知歌手',
        album: music.album?.name,
        confidence: music.score
      }
    }
    return null
  }

  private tempWav(audio: Buffer, name: string): { dir: string; file: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clearstage-song-'))
    const file = path.join(dir, name)
    fs.writeFileSync(file, audio)
    return { dir, file }
  }

  private resolveFpcalc(configured: string): string | null {
    const candidates = [
      configured.trim(),
      path.join(process.resourcesPath, 'fpcalc.exe'),
      'C:\\ffmpeg\\bin\\fpcalc.exe',
      '/usr/local/bin/fpcalc',
      '/opt/homebrew/bin/fpcalc',
      '/usr/bin/fpcalc'
    ].filter(Boolean)
    for (const candidate of candidates) {
      if (candidate.includes(path.sep) && fs.existsSync(candidate)) return candidate
    }
    try {
      const command = process.platform === 'win32' ? 'where.exe' : 'which'
      const result = execFileSync(command, ['fpcalc'], {
        timeout: 5000,
        encoding: 'utf8'
      }) as string
      return result.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null
    } catch {
      return null
    }
  }

  private resolveSongRec(configured: string): string | null {
    const candidates = [
      configured.trim(),
      path.join(process.resourcesPath, 'SongRec.exe'),
      'C:\\Tools\\SongRec\\SongRec.exe',
      'C:\\ffmpeg\\bin\\SongRec.exe'
    ].filter(Boolean)
    for (const candidate of candidates) {
      if (candidate.includes(path.sep) && fs.existsSync(candidate)) return candidate
    }
    try {
      const command = process.platform === 'win32' ? 'where.exe' : 'which'
      const result = execFileSync(command, ['songrec'], {
        timeout: 5000,
        encoding: 'utf8'
      }) as string
      return result.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? null
    } catch {
      return null
    }
  }

  private async recognizeAcoustId(
    config: AppSettings['songRecognition'],
    audio: Buffer
  ): Promise<Recognition | null> {
    if (!config.acoustidClientKey.trim()) return null
    const fpcalc = this.resolveFpcalc(config.fpcalcPath)
    if (!fpcalc) return null
    const temp = this.tempWav(audio, 'sample.wav')
    try {
      const { stdout } = await execFileAsync(fpcalc, ['-json', '-length', '12', temp.file], {
        timeout: 20_000,
        maxBuffer: 4 * 1024 * 1024
      })
      const finger = JSON.parse(stdout) as { duration?: number; fingerprint?: string }
      if (!finger.fingerprint) return null
      const body = [
        `client=${encodeURIComponent(config.acoustidClientKey.trim())}`,
        'format=json',
        `duration=${Math.round(Number(finger.duration) || 8)}`,
        `fingerprint=${encodeURIComponent(finger.fingerprint)}`,
        'meta=recordings+releasegroups+compress'
      ].join('&')
      const response = await fetch('https://api.acoustid.org/v2/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(20_000)
      })
      const json = (await response.json()) as {
        status?: string
        error?: { message?: string }
        results?: Array<{
          score?: number
          recordings?: Array<{
            id?: string
            title?: string
            artists?: Array<{ name?: string }>
            releasegroups?: Array<{ title?: string }>
          }>
        }>
      }
      if (json.status !== 'ok') throw new Error(json.error?.message || 'AcoustID 查询失败')
      const candidates = (json.results ?? [])
        .flatMap((result) => (result.recordings ?? []).map((recording) => ({ result, recording })))
        .filter((item) => item.recording.title && (item.result.score ?? 0) >= 0.35)
        .sort((a, b) => (b.result.score ?? 0) - (a.result.score ?? 0))
      const best = candidates[0]
      if (!best) return null
      return {
        title: best.recording.title!,
        artist: best.recording.artists?.map((artist) => artist.name).filter(Boolean).join(' / ') || '未知歌手',
        album: best.recording.releasegroups?.[0]?.title,
        confidence: best.result.score
      }
    } finally {
      fs.rmSync(temp.dir, { recursive: true, force: true })
    }
  }

  private async recognizeSongRec(
    config: AppSettings['songRecognition'],
    audio: Buffer
  ): Promise<Recognition | null> {
    const executable = this.resolveSongRec(config.songrecPath)
    if (!executable) return null
    const temp = this.tempWav(audio, 'sample.wav')
    try {
      let stdout = ''
      try {
        const result = await execFileAsync(executable, ['recognize', '--json', temp.file], {
          timeout: 30_000,
          maxBuffer: 4 * 1024 * 1024
        })
        stdout = result.stdout
      } catch (firstError) {
        const fallback = await execFileAsync(executable, ['recognize', temp.file], {
          timeout: 30_000,
          maxBuffer: 4 * 1024 * 1024
        })
        stdout = fallback.stdout
      }
      const parsed = this.parseSongRecOutput(stdout)
      if (!parsed?.title) return null
      return {
        title: parsed.title,
        artist: parsed.artist || '未知歌手',
        album: parsed.album,
        confidence: parsed.confidence
      }
    } finally {
      fs.rmSync(temp.dir, { recursive: true, force: true })
    }
  }

  private parseSongRecOutput(output: string): { title: string; artist?: string; album?: string; confidence?: number } | null {
    const text = output.trim()
    if (!text) return null
    const start = Math.min(
      ...[text.indexOf('{'), text.indexOf('[')].filter((index) => index >= 0)
    )
    if (Number.isFinite(start)) {
      try {
        const parsed = JSON.parse(text.slice(start)) as Record<string, unknown>
        const record = (Array.isArray(parsed) ? parsed[0] : parsed) as Record<string, unknown> | undefined
        if (record) {
          const nested = (record.track ?? record.song ?? record.result) as Record<string, unknown> | undefined
          const source = nested ?? record
          const title = source.title ?? source.name
          if (typeof title === 'string') {
            const artist = source.artist ?? source.artistName
            const album = source.album ?? source.albumName
            return {
              title,
              artist: typeof artist === 'string' ? artist : undefined,
              album: typeof album === 'string' ? album : undefined,
              confidence: typeof source.score === 'number' ? source.score : undefined
            }
          }
        }
      } catch {
        // Fall through to the text parser below.
      }
    }
    const title = output.match(/Title:\s*(.+)/i)?.[1]?.trim()
    const artist = output.match(/Artist:\s*(.+)/i)?.[1]?.trim()
    const album = output.match(/Album:\s*(.+)/i)?.[1]?.trim()
    if (!title) return null
    return { title, artist, album }
  }

  private async finalizeCurrent(session: SongSession, endSec: number): Promise<void> {
    const current = session.current
    if (!current) return
    session.current = undefined
    const duration = endSec - current.startSec
    if (duration < 20) return
    try {
      const result = await this.recorder.exportAudio(
        session.recording.id,
        current.startSec,
        endSec,
        `${current.artist} - ${current.title}`
      )
      const song: Song = {
        id: crypto.randomUUID(),
        recordingId: session.recording.id,
        roomId: session.recording.roomId,
        roomTitle: session.recording.roomTitle,
        title: current.title,
        artist: current.artist,
        startedAt: session.recording.startedAt + current.startSec * 1000,
        endedAt: session.recording.startedAt + endSec * 1000,
        filePath: result.filePath,
        provider: (() => {
          const active = this.settingsProvider().songRecognition.provider
          return active === 'none' ? 'manual' : active
        })(),
        confidence: current.confidence
      }
      this.store.upsertSong(song)
      this.emit(song)
    } catch (error) {
      console.warn('[songs] save failed', error)
    }
  }

  async stop(recordingId: string): Promise<void> {
    const session = this.sessions.get(recordingId)
    if (!session) return
    session.stopped = true
    if (session.timer) clearInterval(session.timer)
    const duration = this.recorder.getActiveDuration(recordingId) || session.recording.durationSec
    await this.finalizeCurrent(session, duration)
    this.sessions.delete(recordingId)
  }

  async stopAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((id) => this.stop(id).catch(() => undefined)))
  }

  async markManual(
    recordingId: string,
    startSec: number,
    endSec: number,
    title: string,
    artist: string
  ): Promise<Song> {
    const recording = this.store.getRecording(recordingId)
    if (!recording) throw new Error('找不到对应的录制')
    const cleanTitle = title.trim() || '未命名歌曲'
    const cleanArtist = artist.trim() || '未知歌手'
    const result = await this.recorder.exportAudio(
      recordingId,
      startSec,
      endSec,
      `${cleanArtist} - ${cleanTitle}`
    )
    const song: Song = {
      id: crypto.randomUUID(),
      recordingId,
      roomId: recording.roomId,
      roomTitle: recording.roomTitle,
      title: cleanTitle,
      artist: cleanArtist,
      startedAt: recording.startedAt + startSec * 1000,
      endedAt: recording.startedAt + endSec * 1000,
      filePath: result.filePath,
      provider: 'manual'
    }
    this.store.upsertSong(song)
    this.emit(song)
    return song
  }

  removeSongFile(song: Song): void {
    if (song.filePath && fs.existsSync(song.filePath)) {
      // Keep the file path safe: it must be inside the configured songs directory.
      const songsDir = path.resolve(this.store.data.settings.recordDir, 'songs')
      const target = path.resolve(song.filePath)
      if (target.startsWith(songsDir)) fs.rmSync(target, { force: true })
    }
  }
}
