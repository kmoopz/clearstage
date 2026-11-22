import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import type { AddRoomInput, AppInfo, AppSettings, BiliCookieInput, RecordingStartOptions, Room } from '../shared/types'
import type { Store } from './store'
import type { BiliClient } from './services/bili'
import type { DanmakuHub } from './services/danmaku'
import type { DirectStreamService } from './services/direct'
import type { Ffmpeg } from './services/ffmpeg'
import type { MediaProxy } from './services/mediaProxy'
import { mediaHeadersFor } from './services/mediaProxy'
import type { RecordingManager, ResolvedStream } from './services/recorder'
import type { SongCaptureService } from './services/songs'
import type { StatsService } from './services/stats'

export interface IpcContext {
  window: BrowserWindow
  store: Store
  bili: BiliClient
  danmaku: DanmakuHub
  proxy: MediaProxy
  recorder: RecordingManager
  songs: SongCaptureService
  stats: StatsService
  direct: DirectStreamService
  ffmpeg: Ffmpeg
  dataDir: string
  isDemo: boolean
  ffmpegStatus: () => Promise<{ available: boolean; path?: string }>
}

export function registerIpc(context: IpcContext): void {
  const { window, store, bili, danmaku, proxy, recorder, songs, stats, direct } = context

  // Forward push-style events to the renderer.
  recorder.onProgress((progress) => {
    if (!window.isDestroyed()) window.webContents.send('event:recording-progress', progress)
  })
  danmaku.onMessage((roomId, message) => {
    if (!window.isDestroyed()) window.webContents.send('event:danmaku', roomId, message)
  })
  danmaku.onBurst((state) => {
    if (!window.isDestroyed()) window.webContents.send('event:burst', state)
  })
  songs.onSong((song) => {
    if (!window.isDestroyed()) window.webContents.send('event:song', song)
  })

  ipcMain.handle('app:info', async (): Promise<AppInfo> => {
    const ffmpeg = await context.ffmpegStatus()
    return {
      version: process.env.npm_package_version ?? '0.1.0',
      platform: process.platform,
      arch: process.arch,
      isDemo: context.isDemo,
      dataDir: context.dataDir,
      homeDir: process.env.USERPROFILE ?? process.env.HOME ?? '',
      ffmpegAvailable: ffmpeg.available,
      ffmpegPath: ffmpeg.path,
      mediaServerReady: proxy.ready
    }
  })

  ipcMain.handle('app:open-external', async (_event, url: string) => {
    if (!/^https?:\/\//.test(url)) throw new Error('只能打开 HTTP(S) 链接')
    await shell.openExternal(url)
  })

  ipcMain.handle('app:show-item', async (_event, target: string) => {
    if (!target || !fs.existsSync(target)) throw new Error('文件不存在')
    if (fs.statSync(target).isDirectory()) {
      await shell.openPath(target)
    } else {
      shell.showItemInFolder(target)
    }
  })

  ipcMain.handle('window:minimize', () => window.minimize())
  ipcMain.handle('window:toggle-maximize', () => {
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
    return window.isMaximized()
  })
  ipcMain.handle('window:close', () => window.close())
  ipcMain.handle('window:is-maximized', () => window.isMaximized())

  ipcMain.handle('settings:get', () => store.data.settings)
  ipcMain.handle('settings:update', async (_event, patch: Partial<AppSettings>) => {
    const updated = store.updateSettings(patch)
    context.ffmpeg.setConfiguredPath(updated.ffmpegPath)
    return updated
  })
  ipcMain.handle('settings:choose-folder', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: '选择文件夹',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  ipcMain.handle('settings:check-ffmpeg', () => context.ffmpegStatus())

  ipcMain.handle('rooms:list', () => store.listRooms())
  ipcMain.handle('rooms:add', async (_event, input: AddRoomInput) => {
    const trimmed = input.url?.trim() ?? ''
    if (!trimmed && !input.directUrl?.trim()) throw new Error('请填写直播间地址或直播流地址')
    let room: Room
    if (input.platform === 'direct' || (!/live\.bilibili\.com/i.test(trimmed) && /^https?:\/\//i.test(trimmed))) {
      room = await direct.resolve({ ...input, platform: 'direct', url: input.directUrl?.trim() || trimmed })
    } else {
      const parsed = trimmed.match(/live\.bilibili\.com\/(?:blanc\/)?(\d+)/)?.[1] ?? trimmed
      if (!/^\d+$/.test(parsed)) {
        throw new Error('请输入 B 站直播间号码、直播间链接，或切换到通用直链模式')
      }
      room = await bili.getRoom(parsed)
      const existing = store.data.rooms.find((item) => item.id === room.id)
      if (existing) {
        room = { ...existing, ...room, addedAt: existing.addedAt, note: existing.note }
      }
    }
    store.upsertRoom(room)
    return room
  })
  ipcMain.handle('rooms:remove', async (_event, roomId: string) => {
    const room = store.data.rooms.find((item) => item.id === roomId)
    if (room) danmaku.disconnect(room.roomId)
    store.removeRoom(roomId)
  })
  ipcMain.handle('rooms:refresh', async (_event, roomId: string) => {
    const room = store.data.rooms.find((item) => item.id === roomId)
    if (!room) throw new Error('找不到直播间')
    if (room.platform === 'bilibili') {
      const fresh = await bili.refreshRoom(room)
      store.upsertRoom(fresh)
      return fresh
    }
    if (room.directUrl) await direct.probe(room.directUrl, room.headers)
    return room
  })
  ipcMain.handle('rooms:touch', (_event, roomId: string) => {
    store.touchRoom(roomId)
  })
  ipcMain.handle('rooms:set-active', (_event, roomIds: string[]) => {
    const active = store.data.rooms.filter((room) => roomIds.includes(room.id))
    stats.setActive(active)
  })

  ipcMain.handle('player:resolve', async (_event, roomId: string, quality?: number) => {
    const room = store.data.rooms.find((item) => item.id === roomId)
    if (!room) throw new Error('找不到直播间')
    store.touchRoom(roomId)
    if (room.platform === 'bilibili') {
      return bili.getPlayInfo(room, quality ?? store.data.settings.defaultQuality, (url, headers) =>
        proxy.register(url, headers)
      )
    }
    if (!room.directUrl) throw new Error('该直播间没有可用的直播流地址')
    const protocol = room.protocol ?? (room.directUrl.includes('.flv') ? 'flv' : 'hls')
    return {
      roomId: room.roomId,
      title: room.title,
      variants: [
        {
          id: `direct-${protocol}`,
          label: '原始画质',
          quality: 10000,
          protocol,
          codec: 'source',
          url: proxy.register(room.directUrl, direct.headers(room.headers)),
          mime: protocol === 'hls' ? 'application/vnd.apple.mpegurl' : 'video/x-flv'
        }
      ],
      defaultVariantId: `direct-${protocol}`,
      qualities: [{ quality: 10000, label: '原始画质' }],
      expiresAt: Date.now() + 6 * 60 * 60_000,
      liveStatus: room.liveStatus,
      hint: room.note
    }
  })

  ipcMain.handle('danmaku:connect', async (_event, roomId: string) => {
    const room = store.data.rooms.find((item) => item.id === roomId)
    if (!room) throw new Error('找不到直播间')
    return danmaku.connect(room)
  })
  ipcMain.handle('danmaku:disconnect', (_event, roomId: string) => {
    const room = store.data.rooms.find((item) => item.id === roomId)
    if (room) danmaku.disconnect(room.roomId)
  })
  ipcMain.handle('danmaku:send', async (_event, roomId: string, text: string) => {
    const room = store.data.rooms.find((item) => item.id === roomId)
    if (!room) throw new Error('找不到直播间')
    await danmaku.send(room, text)
  })
  ipcMain.handle(
    'danmaku:burst',
    (_event, roomId: string, text: string, count: number, gapMs: number) => {
      const room = store.data.rooms.find((item) => item.id === roomId)
      if (!room) throw new Error('找不到直播间')
      return danmaku.startBurst(room, text, count, gapMs)
    }
  )
  ipcMain.handle('danmaku:stop-burst', () => danmaku.stopBurst())
  ipcMain.handle('danmaku:history', (_event, roomId?: string) => store.listHistory(roomId))
  ipcMain.handle('danmaku:add-favorite', (_event, roomId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) throw new Error('弹幕不能为空')
    return store.addHistory({ roomId, text: trimmed, type: 'favorite' })
  })
  ipcMain.handle('danmaku:remove-history', (_event, id: string) => store.removeHistory(id))

  ipcMain.handle('auth:import', (_event, input: BiliCookieInput) => bili.importCookies(input))
  ipcMain.handle('auth:me', () => bili.getAccount(true))
  ipcMain.handle('auth:logout', () => bili.logout())

  ipcMain.handle('recordings:list', () => store.listRecordings())
  ipcMain.handle('recordings:start', async (_event, options: RecordingStartOptions) => {
    const room = store.data.rooms.find((item) => item.id === options.roomId)
    if (!room) throw new Error('找不到直播间')
    const recording = await recorder.start(room, options.quality, options.songMode)
    if (options.songMode) {
      await songs.start(recording, room).catch(() => false)
    }
    return store.getRecording(recording.id) ?? recording
  })
  ipcMain.handle('recordings:stop', async (_event, recordingId: string) => {
    await songs.stop(recordingId).catch(() => undefined)
    return recorder.stop(recordingId)
  })
  ipcMain.handle('recordings:remove', async (_event, recordingId: string) => {
    for (const song of store.data.songs.filter((item) => item.recordingId === recordingId)) {
      songs.removeSongFile(song)
    }
    await songs.stop(recordingId).catch(() => undefined)
    await recorder.deleteRecording(recordingId)
  })
  ipcMain.handle('recordings:reveal', async (_event, recordingId: string) => {
    const recording = store.getRecording(recordingId)
    if (!recording) throw new Error('找不到录制')
    if (recording.filePath && fs.existsSync(recording.filePath)) shell.showItemInFolder(recording.filePath)
    else if (fs.existsSync(recording.dir)) await shell.openPath(recording.dir)
  })
  ipcMain.handle('recordings:active', () => recorder.listActive())

  ipcMain.handle('clips:list', () => store.listClips())
  ipcMain.handle('clips:create', (_event, input) => recorder.createClips(input))
  ipcMain.handle('clips:remove', (_event, clipId: string) => recorder.deleteClip(clipId))
  ipcMain.handle('clips:reveal', async (_event, clipId: string) => {
    const clip = store.data.clips.find((item) => item.id === clipId)
    if (!clip) throw new Error('找不到切片')
    if (fs.existsSync(clip.filePath)) shell.showItemInFolder(clip.filePath)
  })

  ipcMain.handle('songs:list', () => store.listSongs())
  ipcMain.handle('songs:mark', (_event, input) =>
    songs.markManual(input.recordingId, input.startSec, input.endSec, input.title, input.artist)
  )
  ipcMain.handle('songs:remove', (_event, songId: string) => {
    const song = store.data.songs.find((item) => item.id === songId)
    if (!song) return
    songs.removeSongFile(song)
    store.removeSong(songId)
  })
  ipcMain.handle('songs:reveal', async (_event, songId: string) => {
    const song = store.data.songs.find((item) => item.id === songId)
    if (!song?.filePath) throw new Error('找不到歌曲文件')
    if (fs.existsSync(song.filePath)) shell.showItemInFolder(song.filePath)
  })

  ipcMain.handle('stats:get', async (_event, roomId: string, days = 7) => {
    const room = store.data.rooms.find((item) => item.id === roomId)
    if (!room) throw new Error('找不到直播间')
    return bili.getStreamerStats(room, days)
  })
  ipcMain.handle('stats:refresh', async (_event, roomId: string) => {
    const room = store.data.rooms.find((item) => item.id === roomId)
    if (!room) throw new Error('找不到直播间')
    await stats.refresh(room)
  })

  ipcMain.handle('feeds:get', async (_event, roomId: string, type: 'dynamic' | 'video', offset?: string) => {
    const room = store.data.rooms.find((item) => item.id === roomId)
    if (!room) throw new Error('找不到直播间')
    if (room.platform !== 'bilibili') {
      throw new Error('通用直链模式不提供主播动态与投稿接口。')
    }
    if (!room.streamerId) throw new Error('缺少主播 UID，请先刷新直播间')
    return type === 'video' ? bili.getVideos(room.streamerId) : bili.getDynamics(room.streamerId, offset)
  })
  ipcMain.handle('feeds:profile', (_event, uid: string) => bili.getProfile(uid))

  ipcMain.handle(
    'direct:probe',
    (_event, url: string, headers?: { referer?: string; userAgent?: string }) =>
      direct.probe(url, headers)
  )

  ipcMain.handle('session:set-active', (_event, roomIds: string[]) => {
    const active = store.data.rooms.filter((room) => roomIds.includes(room.id))
    stats.setActive(active)
  })
}

export function rawStreamResolver(
  store: Store,
  bili: BiliClient,
  direct: DirectStreamService
): (room: Room, quality?: string) => Promise<ResolvedStream> {
  return async (room, quality) => {
    if (room.platform === 'bilibili') {
      const numericQuality = Number(quality)
      const play = await bili.getPlayInfo(
        room,
        Number.isFinite(numericQuality) && numericQuality > 0 ? numericQuality : store.data.settings.defaultQuality,
        (url) => url
      )
      const variant = play.variants[0]
      if (!variant) throw new Error(play.hint || 'B站没有返回可用的直播流')
      return {
        url: variant.url,
        headers: mediaHeadersFor(`https://live.bilibili.com/${room.roomId}`),
        protocol: variant.protocol,
        label: variant.label
      }
    }
    if (!room.directUrl) throw new Error('该直播间没有直播流地址')
    const protocol = room.protocol ?? (room.directUrl.includes('.flv') ? 'flv' : 'hls')
    return {
      url: room.directUrl,
      headers: direct.headers(room.headers),
      protocol,
      label: '原始画质'
    }
  }
}
