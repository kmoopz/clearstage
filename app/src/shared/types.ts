export type Platform = 'bilibili' | 'direct'

export type LiveStatus = 'live' | 'offline' | 'replay' | 'unknown'

export type PlaybackMode = 'native' | 'direct'

export interface RoomHeaders {
  referer?: string
  userAgent?: string
}

export interface Room {
  id: string
  platform: Platform
  roomId: string
  title: string
  streamer: string
  streamerId?: string
  avatar?: string
  cover?: string
  area?: string
  liveStatus: LiveStatus
  viewerCount?: number
  followers?: number
  sourceUrl: string
  playbackMode: PlaybackMode
  directUrl?: string
  protocol?: 'hls' | 'flv'
  headers?: RoomHeaders
  note?: string
  isDemo?: boolean
  addedAt: number
  lastOpenedAt?: number
}

export interface StreamVariant {
  id: string
  label: string
  quality: number
  protocol: 'hls' | 'flv'
  codec: string
  url: string
  mime: string
}

export interface PlaybackInfo {
  roomId: string
  title: string
  variants: StreamVariant[]
  defaultVariantId: string
  qualities: Array<{ quality: number; label: string }>
  expiresAt: number
  liveStatus: LiveStatus
  hint?: string
}

export type DanmakuType =
  | 'chat'
  | 'gift'
  | 'superchat'
  | 'guard'
  | 'enter'
  | 'like'
  | 'watched'
  | 'system'

export interface ChatMessage {
  id: string
  roomId: string
  type: DanmakuType
  userId?: string
  userName?: string
  avatar?: string
  text: string
  timestamp: number
  color?: string
  medal?: { name: string; level: number }
  giftName?: string
  giftCount?: number
  price?: number
  guardName?: string
  isSelf?: boolean
  rawCommand?: string
}

export interface BiliAccount {
  loggedIn: boolean
  mid?: number
  uname?: string
  face?: string
  vip?: boolean
  cookieSaved?: boolean
  canSendDanmaku?: boolean
}

export interface BiliCookieInput {
  sessdata: string
  biliJct?: string
  dedeUserId?: string
}

export interface RoomSnapshot {
  t: number
  online?: number
  followers?: number
}

export interface GiftAggregate {
  name: string
  count: number
  value: number
}

export interface DayStats {
  date: string
  giftValue: number
  messages: number
  peakOnline: number
  followersEnd?: number
  secondsWatched: number
}

export interface StreamerStats {
  roomId: string
  title: string
  platform: Platform
  followers: number
  online: number
  totalGiftValue: number
  todayGiftValue: number
  messages: number
  peakOnline: number
  snapshots: RoomSnapshot[]
  topGifts: GiftAggregate[]
  daily: DayStats[]
  disclaimer: string
}

export type RecordingStatus = 'recording' | 'processing' | 'completed' | 'interrupted' | 'failed'

export interface Recording {
  id: string
  roomId: string
  roomTitle: string
  streamer: string
  platform: Platform
  quality: string
  startedAt: number
  endedAt?: number
  status: RecordingStatus
  durationSec: number
  sizeBytes: number
  segmentCount: number
  dir: string
  filePath?: string
  error?: string
  songMode?: boolean
}

export interface RecordingProgress {
  recordingId: string
  status: RecordingStatus
  durationSec: number
  sizeBytes: number
  segmentCount: number
  error?: string
}

export interface Clip {
  id: string
  recordingId: string
  roomId: string
  roomTitle: string
  title: string
  startSec: number
  endSec: number
  createdAt: number
  filePath: string
  sizeBytes: number
  method: 'precise' | 'segment'
  status: 'ready' | 'processing' | 'failed'
  error?: string
}

export interface Song {
  id: string
  recordingId?: string
  roomId: string
  roomTitle: string
  title: string
  artist: string
  startedAt: number
  endedAt?: number
  filePath?: string
  provider: 'audd' | 'acrcloud' | 'acoustid' | 'songrec' | 'manual'
  confidence?: number
  cover?: string
}

export interface SongRecognitionSettings {
  enabled: boolean
  provider: 'none' | 'audd' | 'acrcloud' | 'acoustid' | 'songrec'
  auddToken: string
  acrHost: string
  acrAccessKey: string
  acrAccessSecret: string
  acoustidClientKey: string
  fpcalcPath: string
  songrecPath: string
}

export interface DanmakuSettings {
  fontSize: number
  opacity: number
  showGifts: boolean
  showEnter: boolean
  area: number
}

export type AppPage = 'live' | 'recordings' | 'stats' | 'feeds' | 'settings'

export interface AppSettings {
  themeId: string
  accent: string
  customCss: string
  recordDir: string
  ffmpegPath: string
  layout: string
  videoFit: 'cover' | 'contain'
  multiViewQuality: 'auto' | 'high'
  startupPage: AppPage
  autoReconnect: boolean
  notifications: boolean
  danmaku: DanmakuSettings
  songRecognition: SongRecognitionSettings
}

export interface AppInfo {
  version: string
  platform: NodeJS.Platform
  arch: string
  isDemo: boolean
  dataDir: string
  homeDir: string
  ffmpegAvailable: boolean
  ffmpegPath?: string
  mediaServerReady: boolean
}

export type FeedItemType = 'video' | 'dynamic' | 'image' | 'live' | 'forward'

export interface FeedTextSegment {
  type: 'text' | 'emoji'
  text: string
  icon?: string
}

export interface FeedItem {
  id: string
  type: FeedItemType
  title: string
  text?: string
  richText?: FeedTextSegment[]
  cover?: string
  images?: string[]
  url: string
  publishedAt: number
  author?: string
  stats?: { views?: number; likes?: number; comments?: number; duration?: string }
}

export interface FeedResult {
  items: FeedItem[]
  hasMore: boolean
  offset?: string
  message?: string
  fetchedAt: number
}

export interface StreamerProfile {
  uid: number
  name: string
  face?: string
  sign?: string
  followers?: number
  following?: number
  level?: number
  archiveCount?: number
}

export interface AddRoomInput {
  url: string
  platform?: Platform
  directUrl?: string
  headers?: RoomHeaders
  title?: string
  streamer?: string
}

export interface BurstState {
  active: boolean
  roomId?: string
  sent: number
  total: number
  text?: string
  nextAt?: number
  error?: string
}

export interface RecordingClipInput {
  recordingId: string
  title?: string
  segments: Array<{ startSec: number; endSec: number }>
}

export interface StatsQuery {
  roomId: string
  days?: number
}

export interface WindowState {
  maximized: boolean
  fullscreen: boolean
}

export interface RecordingStartOptions {
  roomId: string
  quality?: string
  songMode?: boolean
}

export interface ThemePreset {
  id: string
  name: string
  description: string
  mode: 'dark' | 'light'
  accent: string
  bg: string
  surface: string
  text: string
  muted: string
  line: string
  art?: string
  artOpacity?: number
  artPosition?: string
}
