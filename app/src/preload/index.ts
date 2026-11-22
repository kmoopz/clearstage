import { contextBridge, ipcRenderer } from 'electron'
import type { ClearStageApi } from '../shared/api'
import type {
  AddRoomInput,
  AppSettings,
  BurstState,
  ChatMessage,
  RecordingClipInput,
  RecordingProgress,
  RecordingStartOptions,
  Song
} from '../shared/types'

const api: ClearStageApi = {
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
    showItem: (path: string) => ipcRenderer.invoke('app:show-item', path)
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onStateChange: (listener: (state: { maximized: boolean; fullscreen: boolean }) => void) => {
      const handler = (_event: unknown, state: { maximized: boolean; fullscreen: boolean }): void =>
        listener(state)
      ipcRenderer.on('event:window-state', handler)
      return () => ipcRenderer.removeListener('event:window-state', handler)
    }
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', patch),
    chooseFolder: () => ipcRenderer.invoke('settings:choose-folder'),
    checkFfmpeg: () => ipcRenderer.invoke('settings:check-ffmpeg')
  },
  rooms: {
    list: () => ipcRenderer.invoke('rooms:list'),
    add: (input: AddRoomInput) => ipcRenderer.invoke('rooms:add', input),
    remove: (roomId: string) => ipcRenderer.invoke('rooms:remove', roomId),
    refresh: (roomId: string) => ipcRenderer.invoke('rooms:refresh', roomId),
    touch: (roomId: string) => ipcRenderer.invoke('rooms:touch', roomId),
    setActive: (roomIds: string[]) => ipcRenderer.invoke('rooms:set-active', roomIds)
  },
  player: {
    resolve: (roomId: string, quality?: number) => ipcRenderer.invoke('player:resolve', roomId, quality)
  },
  danmaku: {
    connect: (roomId: string) => ipcRenderer.invoke('danmaku:connect', roomId),
    disconnect: (roomId: string) => ipcRenderer.invoke('danmaku:disconnect', roomId),
    send: (roomId: string, text: string) => ipcRenderer.invoke('danmaku:send', roomId, text),
    burst: (roomId: string, text: string, count: number, gapMs: number) =>
      ipcRenderer.invoke('danmaku:burst', roomId, text, count, gapMs),
    stopBurst: () => ipcRenderer.invoke('danmaku:stop-burst'),
    listHistory: (roomId?: string) => ipcRenderer.invoke('danmaku:history', roomId),
    addFavorite: (roomId: string, text: string) =>
      ipcRenderer.invoke('danmaku:add-favorite', roomId, text),
    removeHistory: (id: string) => ipcRenderer.invoke('danmaku:remove-history', id),
    onMessage: (listener: (roomId: string, message: ChatMessage) => void) => {
      const handler = (_event: unknown, roomId: string, message: ChatMessage): void =>
        listener(roomId, message)
      ipcRenderer.on('event:danmaku', handler)
      return () => ipcRenderer.removeListener('event:danmaku', handler)
    },
    onBurst: (listener: (state: BurstState) => void) => {
      const handler = (_event: unknown, state: BurstState): void => listener(state)
      ipcRenderer.on('event:burst', handler)
      return () => ipcRenderer.removeListener('event:burst', handler)
    }
  },
  auth: {
    importCookies: (input: unknown) => ipcRenderer.invoke('auth:import', input),
    me: () => ipcRenderer.invoke('auth:me'),
    logout: () => ipcRenderer.invoke('auth:logout')
  },
  recordings: {
    list: () => ipcRenderer.invoke('recordings:list'),
    start: (options: RecordingStartOptions) => ipcRenderer.invoke('recordings:start', options),
    stop: (recordingId: string) => ipcRenderer.invoke('recordings:stop', recordingId),
    remove: (recordingId: string) => ipcRenderer.invoke('recordings:remove', recordingId),
    reveal: (recordingId: string) => ipcRenderer.invoke('recordings:reveal', recordingId),
    active: () => ipcRenderer.invoke('recordings:active'),
    onProgress: (listener: (progress: RecordingProgress) => void) => {
      const handler = (_event: unknown, progress: RecordingProgress): void => listener(progress)
      ipcRenderer.on('event:recording-progress', handler)
      return () => ipcRenderer.removeListener('event:recording-progress', handler)
    }
  },
  clips: {
    list: () => ipcRenderer.invoke('clips:list'),
    create: (input: RecordingClipInput) => ipcRenderer.invoke('clips:create', input),
    remove: (clipId: string) => ipcRenderer.invoke('clips:remove', clipId),
    reveal: (clipId: string) => ipcRenderer.invoke('clips:reveal', clipId)
  },
  songs: {
    list: () => ipcRenderer.invoke('songs:list'),
    mark: (input) => ipcRenderer.invoke('songs:mark', input),
    remove: (songId: string) => ipcRenderer.invoke('songs:remove', songId),
    reveal: (songId: string) => ipcRenderer.invoke('songs:reveal', songId),
    onSong: (listener: (song: Song) => void) => {
      const handler = (_event: unknown, song: Song): void => listener(song)
      ipcRenderer.on('event:song', handler)
      return () => ipcRenderer.removeListener('event:song', handler)
    }
  },
  stats: {
    get: (roomId: string, days?: number) => ipcRenderer.invoke('stats:get', roomId, days),
    refresh: (roomId: string) => ipcRenderer.invoke('stats:refresh', roomId)
  },
  feeds: {
    get: (roomId: string, type: 'dynamic' | 'video', offset?: string) =>
      ipcRenderer.invoke('feeds:get', roomId, type, offset),
    profile: (uid: string) => ipcRenderer.invoke('feeds:profile', uid)
  },
  direct: {
    probe: (url: string, headers?: { referer?: string; userAgent?: string }) =>
      ipcRenderer.invoke('direct:probe', url, headers)
  }
}

contextBridge.exposeInMainWorld('clearstage', api)
