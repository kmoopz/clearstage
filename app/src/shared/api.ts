import type {
  AddRoomInput,
  AppInfo,
  AppSettings,
  BiliAccount,
  BiliCookieInput,
  BurstState,
  ChatMessage,
  Clip,
  FeedResult,
  PlaybackInfo,
  Recording,
  RecordingClipInput,
  RecordingProgress,
  RecordingStartOptions,
  Room,
  Song,
  StreamerProfile,
  StreamerStats
} from './types'

export interface HistoryItem {
  id: string
  roomId: string
  text: string
  timestamp: number
  type: 'sent' | 'favorite'
  used: number
}

export interface FfmpegStatus {
  available: boolean
  path?: string
}

export interface ClearStageApi {
  app: {
    info(): Promise<AppInfo>
    openExternal(url: string): Promise<void>
    showItem(path: string): Promise<void>
  }
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<boolean>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
    onStateChange(listener: (state: { maximized: boolean; fullscreen: boolean }) => void): () => void
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
    chooseFolder(title?: string): Promise<string | null>
    checkFfmpeg(): Promise<FfmpegStatus>
  }
  rooms: {
    list(): Promise<Room[]>
    add(input: AddRoomInput): Promise<Room>
    remove(roomId: string): Promise<void>
    refresh(roomId: string): Promise<Room>
    touch(roomId: string): Promise<void>
    setActive(roomIds: string[]): Promise<void>
  }
  player: {
    resolve(roomId: string, quality?: number): Promise<PlaybackInfo>
  }
  danmaku: {
    connect(roomId: string): Promise<{ connected: boolean; message?: string }>
    disconnect(roomId: string): Promise<void>
    send(roomId: string, text: string): Promise<void>
    burst(roomId: string, text: string, count: number, gapMs: number): Promise<BurstState>
    stopBurst(): Promise<void>
    listHistory(roomId?: string): Promise<HistoryItem[]>
    addFavorite(roomId: string, text: string): Promise<HistoryItem>
    removeHistory(id: string): Promise<void>
    onMessage(listener: (roomId: string, message: ChatMessage) => void): () => void
    onBurst(listener: (state: BurstState) => void): () => void
  }
  auth: {
    importCookies(input: BiliCookieInput): Promise<BiliAccount>
    me(): Promise<BiliAccount>
    logout(): Promise<void>
  }
  recordings: {
    list(): Promise<Recording[]>
    start(options: RecordingStartOptions): Promise<Recording>
    stop(recordingId: string): Promise<Recording>
    remove(recordingId: string): Promise<void>
    reveal(recordingId: string): Promise<void>
    active(): Promise<RecordingProgress[]>
    onProgress(listener: (progress: RecordingProgress) => void): () => void
  }
  clips: {
    list(): Promise<Clip[]>
    create(input: RecordingClipInput): Promise<Clip[]>
    remove(clipId: string): Promise<void>
    reveal(clipId: string): Promise<void>
  }
  songs: {
    list(): Promise<Song[]>
    mark(input: {
      recordingId: string
      startSec: number
      endSec: number
      title: string
      artist: string
    }): Promise<Song>
    remove(songId: string): Promise<void>
    reveal(songId: string): Promise<void>
    onSong(listener: (song: Song) => void): () => void
  }
  stats: {
    get(roomId: string, days?: number): Promise<StreamerStats>
    refresh(roomId: string): Promise<void>
  }
  feeds: {
    get(roomId: string, type: 'dynamic' | 'video', offset?: string): Promise<FeedResult>
    profile(uid: string): Promise<StreamerProfile>
  }
  direct: {
    probe(url: string, headers?: { referer?: string; userAgent?: string }): Promise<{
      protocol: 'hls' | 'flv'
      contentType: string
    }>
  }
}
