import { create } from 'zustand'
import type {
  AppInfo,
  AppSettings,
  BiliAccount,
  BurstState,
  ChatMessage,
  Clip,
  Recording,
  RecordingProgress,
  Room,
  Song
} from '../../shared/types'
import type { HistoryItem } from '../../shared/api'
import {
  DEMO_CLIPS,
  DEMO_MESSAGES,
  DEMO_RECORDINGS,
  DEMO_ROOMS,
  DEMO_SONGS
} from './lib/demo'
import { errorMessage } from './lib/format'

export type Page = 'live' | 'recordings' | 'stats' | 'feeds' | 'settings'
export type ToastKind = 'info' | 'success' | 'error' | 'warning'

export interface Toast {
  id: string
  kind: ToastKind
  text: string
  detail?: string
}

const FALLBACK_SETTINGS: AppSettings = {
  themeId: 'nocturne',
  accent: '#70f0c0',
  customCss: '',
  recordDir: '',
  ffmpegPath: '',
  defaultQuality: 10000,
  layout: '4',
  autoReconnect: true,
  notifications: true,
  danmaku: { fontSize: 16, opacity: 0.92, showGifts: true, showEnter: false, area: 72 },
  songRecognition: {
    enabled: false,
    provider: 'none',
    auddToken: '',
    acrHost: '',
    acrAccessKey: '',
    acrAccessSecret: ''
  }
}

interface AppState {
  booted: boolean
  bootError?: string
  info: AppInfo | null
  settings: AppSettings
  rooms: Room[]
  activeIds: string[]
  selectedId: string | null
  page: Page
  messages: Record<string, ChatMessage[]>
  recordings: Recording[]
  clips: Clip[]
  songs: Song[]
  auth: BiliAccount
  burst: BurstState
  history: HistoryItem[]
  toasts: Toast[]
  addRoomOpen: boolean
  themeOpen: boolean
  chatOpen: boolean
  libraryLoaded: boolean
  recordingBusy: Record<string, boolean>

  init(): Promise<void>
  setPage(page: Page): void
  setAddRoomOpen(open: boolean): void
  setThemeOpen(open: boolean): void
  setChatOpen(open: boolean): void
  setSelected(roomId: string): void
  setActiveRooms(ids: string[]): void
  setLayout(layout: string): Promise<void>
  toggleRoom(roomId: string): void
  addRoom(input: { url: string; platform?: string; directUrl?: string; headers?: { referer?: string; userAgent?: string }; title?: string; streamer?: string }): Promise<void>
  removeRoom(roomId: string): Promise<void>
  refreshRoom(roomId: string): Promise<void>
  updateSettings(patch: Partial<AppSettings>): Promise<void>
  loadLibrary(): Promise<void>
  loadAuth(): Promise<void>
  setAuth(account: BiliAccount): void
  importCookies(input: { sessdata: string; biliJct?: string; dedeUserId?: string }): Promise<BiliAccount>
  logout(): Promise<void>
  loadHistory(roomId: string): Promise<void>
  addMessage(roomId: string, message: ChatMessage): void
  setBurst(state: BurstState): void
  startRecording(roomId: string): Promise<void>
  stopRecording(recordingId: string): Promise<void>
  removeRecording(recordingId: string): Promise<void>
  progressRecording(progress: RecordingProgress): void
  addSong(song: Song): void
  removeSong(songId: string): Promise<void>
  toast(kind: ToastKind, text: string, detail?: string): void
  dismissToast(id: string): void
}

function initialPage(): Page {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  const valid: Page[] = ['live', 'recordings', 'stats', 'feeds', 'settings']
  return valid.includes(raw as Page) ? (raw as Page) : 'live'
}

export const useAppStore = create<AppState>((set, get) => ({
  booted: false,
  info: null,
  settings: FALLBACK_SETTINGS,
  rooms: [],
  activeIds: [],
  selectedId: null,
  page: initialPage(),
  messages: {},
  recordings: [],
  clips: [],
  songs: [],
  auth: { loggedIn: false },
  burst: { active: false, sent: 0, total: 0 },
  history: [],
  toasts: [],
  addRoomOpen: false,
  themeOpen: false,
  chatOpen: true,
  libraryLoaded: false,
  recordingBusy: {},

  async init() {
    try {
      const [info, settings, rooms] = await Promise.all([
        window.clearstage.app.info(),
        window.clearstage.settings.get(),
        window.clearstage.rooms.list()
      ])
      if (info.isDemo) {
        set({
          booted: true,
          info,
          settings: { ...settings, layout: settings.layout || '4' },
          rooms: DEMO_ROOMS,
          activeIds: DEMO_ROOMS.map((room) => room.id),
          selectedId: DEMO_ROOMS[0].id,
          recordings: DEMO_RECORDINGS,
          clips: DEMO_CLIPS,
          songs: DEMO_SONGS,
          auth: {
            loggedIn: true,
            mid: 9617619,
            uname: '澄幕体验账号',
            face: '',
            cookieSaved: true
          },
          libraryLoaded: true,
          messages: DEMO_MESSAGES.reduce<Record<string, ChatMessage[]>>((acc, item) => {
            acc[item.roomId] = [...(acc[item.roomId] ?? []), item]
            return acc
          }, {})
        })
        return
      }
      const opening = rooms.slice(0, 1).map((room) => room.id)
      set({
        booted: true,
        info,
        settings,
        rooms,
        activeIds: opening,
        selectedId: opening[0] ?? null,
        page: initialPage()
      })
      void get().loadLibrary()
      void get().loadAuth()
      if (opening[0]) void window.clearstage.rooms.setActive(opening)
    } catch (error) {
      set({
        booted: true,
        bootError: errorMessage(error),
        info: null
      })
    }
  },

  setPage(page) {
    set({ page })
    window.location.hash = page
    if (page === 'live') {
      void window.clearstage.rooms.setActive(get().activeIds)
    }
  },
  setAddRoomOpen(open) {
    set({ addRoomOpen: open })
  },
  setThemeOpen(open) {
    set({ themeOpen: open })
  },
  setChatOpen(open) {
    set({ chatOpen: open })
  },
  setSelected(roomId) {
    set({ selectedId: roomId })
  },
  setActiveRooms(ids) {
    const activeIds = ids.filter((id) => get().rooms.some((room) => room.id === id)).slice(0, 9)
    set({ activeIds })
    void window.clearstage.rooms.setActive(activeIds)
  },
  async setLayout(layout) {
    set((state) => ({ settings: { ...state.settings, layout } }))
    try {
      const settings = await window.clearstage.settings.update({ layout })
      set({ settings })
    } catch (error) {
      get().toast('error', '布局保存失败', errorMessage(error))
    }
  },
  toggleRoom(roomId) {
    const { activeIds, rooms } = get()
    if (activeIds.includes(roomId)) {
      const next = activeIds.filter((id) => id !== roomId)
      set({
        activeIds: next,
        selectedId: get().selectedId === roomId ? (next[0] ?? null) : get().selectedId
      })
      void window.clearstage.rooms.setActive(next)
      return
    }
    if (activeIds.length >= 9) {
      get().toast('warning', '最多同时打开 9 路画面')
      return
    }
    if (!rooms.some((room) => room.id === roomId)) return
    const next = [...activeIds, roomId]
    set({ activeIds: next, selectedId: roomId })
    void window.clearstage.rooms.setActive(next)
  },
  async addRoom(input) {
    if (get().info?.isDemo) {
      get().toast('info', '演示模式', '正式版中会在这里解析直播间并加入多画面。')
      return
    }
    try {
      const room = await window.clearstage.rooms.add(input as never)
      set((state) => {
        const exists = state.rooms.some((item) => item.id === room.id)
        const rooms = exists
          ? state.rooms.map((item) => (item.id === room.id ? room : item))
          : [room, ...state.rooms]
        const activeIds = state.activeIds.includes(room.id)
          ? state.activeIds
          : [...state.activeIds, room.id].slice(0, 9)
        return {
          rooms,
          activeIds,
          selectedId: room.id,
          addRoomOpen: false
        }
      })
      void window.clearstage.rooms.setActive(get().activeIds)
      get().toast('success', '已加入直播台', `${room.streamer} · ${room.title}`)
    } catch (error) {
      get().toast('error', '添加直播间失败', errorMessage(error))
      throw error
    }
  },
  async removeRoom(roomId) {
    if (get().info?.isDemo) {
      get().toast('info', '演示模式不可移除')
      return
    }
    try {
      await window.clearstage.rooms.remove(roomId)
      set((state) => {
        const rooms = state.rooms.filter((room) => room.id !== roomId)
        const activeIds = state.activeIds.filter((id) => id !== roomId)
        return {
          rooms,
          activeIds,
          selectedId: state.selectedId === roomId ? (activeIds[0] ?? null) : state.selectedId
        }
      })
      void window.clearstage.rooms.setActive(get().activeIds)
      get().toast('success', '已从直播台移除')
    } catch (error) {
      get().toast('error', '移除失败', errorMessage(error))
    }
  },
  async refreshRoom(roomId) {
    if (get().info?.isDemo) {
      get().toast('info', '演示模式', '真实环境中会刷新直播间标题、在线人数与开播状态。')
      return
    }
    try {
      const room = await window.clearstage.rooms.refresh(roomId)
      set((state) => ({
        rooms: state.rooms.map((item) => (item.id === room.id ? room : item))
      }))
      get().toast('success', '直播间信息已刷新')
    } catch (error) {
      get().toast('error', '刷新失败', errorMessage(error))
    }
  },
  async updateSettings(patch) {
    const previous = get().settings
    const optimistic = { ...previous, ...patch }
    set({ settings: optimistic })
    try {
      const settings = await window.clearstage.settings.update(patch)
      set({ settings })
    } catch (error) {
      set({ settings: previous })
      get().toast('error', '设置保存失败', errorMessage(error))
    }
  },
  async loadLibrary() {
    if (get().info?.isDemo) {
      set({ recordings: DEMO_RECORDINGS, clips: DEMO_CLIPS, songs: DEMO_SONGS, libraryLoaded: true })
      return
    }
    try {
      const [recordings, clips, songs] = await Promise.all([
        window.clearstage.recordings.list(),
        window.clearstage.clips.list(),
        window.clearstage.songs.list()
      ])
      set({ recordings, clips, songs, libraryLoaded: true })
    } catch (error) {
      get().toast('error', '读取录制库失败', errorMessage(error))
    }
  },
  async loadAuth() {
    if (get().info?.isDemo) return
    try {
      const account = await window.clearstage.auth.me()
      set({ auth: account })
    } catch {
      set({ auth: { loggedIn: false } })
    }
  },
  setAuth(account) {
    set({ auth: account })
  },
  async importCookies(input) {
    const account = await window.clearstage.auth.importCookies(input)
    set({ auth: account })
    get().toast(
      account.canSendDanmaku ? 'success' : 'warning',
      '登录成功',
      account.canSendDanmaku
        ? `欢迎，${account.uname ?? 'B站用户'}`
        : `已登录 ${account.uname ?? 'B站用户'}，但缺少 bili_jct，暂时不能发送弹幕`
    )
    return account
  },
  async logout() {
    if (get().info?.isDemo) {
      set({ auth: { loggedIn: false } })
      get().toast('info', '已退出演示账号')
      return
    }
    try {
      await window.clearstage.auth.logout()
      set({ auth: { loggedIn: false } })
      get().toast('success', '已退出 B 站账号')
    } catch (error) {
      get().toast('error', '退出登录失败', errorMessage(error))
    }
  },
  async loadHistory(roomId) {
    if (get().info?.isDemo) {
      set({
        history: [
          {
            id: 'demo-history-1',
            roomId,
            text: '这一波太漂亮了！',
            timestamp: Date.now() - 500_000,
            type: 'sent',
            used: 4
          },
          {
            id: 'demo-history-2',
            roomId,
            text: '打卡打卡，今天也在。',
            timestamp: Date.now() - 3_600_000,
            type: 'favorite',
            used: 11
          }
        ]
      })
      return
    }
    try {
      const history = await window.clearstage.danmaku.listHistory(roomId)
      set({ history })
    } catch {
      set({ history: [] })
    }
  },
  addMessage(roomId, message) {
    set((state) => {
      const current = state.messages[roomId] ?? []
      return { messages: { ...state.messages, [roomId]: [...current, message].slice(-240) } }
    })
  },
  setBurst(state) {
    set({ burst: state })
    if (!state.active && state.error) {
      get().toast('error', '连发中断', state.error)
    }
  },
  async startRecording(roomId) {
    if (get().info?.isDemo) {
      get().toast('info', '演示模式', '正式版会在这里开始本地录制。')
      return
    }
    if (get().recordingBusy[roomId]) return
    set((state) => ({ recordingBusy: { ...state.recordingBusy, [roomId]: true } }))
    try {
      const room = get().rooms.find((item) => item.id === roomId)
      const recording = await window.clearstage.recordings.start({
        roomId,
        songMode: get().settings.songRecognition.enabled
      })
      set((state) => ({
        recordings: [recording, ...state.recordings.filter((item) => item.id !== recording.id)]
      }))
      get().toast(
        'success',
        '开始录制',
        `${room?.streamer ?? '直播间'} · ${get().settings.songRecognition.enabled ? '歌曲分轨已开启' : '保存到本地'}`
      )
    } catch (error) {
      get().toast('error', '无法开始录制', errorMessage(error))
    } finally {
      set((state) => ({ recordingBusy: { ...state.recordingBusy, [roomId]: false } }))
    }
  },
  async stopRecording(recordingId) {
    if (get().info?.isDemo) {
      get().toast('info', '演示模式', '正式版会在此停止并写入录制库。')
      return
    }
    try {
      const recording = await window.clearstage.recordings.stop(recordingId)
      set((state) => ({
        recordings: state.recordings.map((item) => (item.id === recording.id ? recording : item))
      }))
      get().toast('success', '录制已停止', '文件已保存，可前往录制库查看。')
      void get().loadLibrary()
    } catch (error) {
      get().toast('error', '停止录制失败', errorMessage(error))
    }
  },
  async removeRecording(recordingId) {
    if (get().info?.isDemo) {
      get().toast('info', '演示模式不可删除')
      return
    }
    try {
      await window.clearstage.recordings.remove(recordingId)
      set((state) => ({
        recordings: state.recordings.filter((item) => item.id !== recordingId),
        clips: state.clips.filter((item) => item.recordingId !== recordingId),
        songs: state.songs.filter((item) => item.recordingId !== recordingId)
      }))
      get().toast('success', '录制及关联切片已删除')
    } catch (error) {
      get().toast('error', '删除失败', errorMessage(error))
    }
  },
  progressRecording(progress) {
    set((state) => {
      const exists = state.recordings.some((item) => item.id === progress.recordingId)
      if (!exists) return {}
      return {
        recordings: state.recordings.map((item) =>
          item.id === progress.recordingId
            ? {
                ...item,
                status: progress.status,
                durationSec: progress.durationSec,
                sizeBytes: progress.sizeBytes,
                segmentCount: progress.segmentCount,
                error: progress.error
              }
            : item
        )
      }
    })
  },
  addSong(song) {
    set((state) => ({ songs: [song, ...state.songs.filter((item) => item.id !== song.id)] }))
    get().toast('success', '捕获到一首歌', `${song.artist} - ${song.title}`)
  },
  async removeSong(songId) {
    if (get().info?.isDemo) {
      get().toast('info', '演示模式不可删除')
      return
    }
    try {
      await window.clearstage.songs.remove(songId)
      set((state) => ({ songs: state.songs.filter((item) => item.id !== songId) }))
      get().toast('success', '歌曲已删除')
    } catch (error) {
      get().toast('error', '删除歌曲失败', errorMessage(error))
    }
  },
  toast(kind, text, detail) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    set((state) => ({ toasts: [...state.toasts, { id, kind, text, detail }].slice(-4) }))
    setTimeout(() => get().dismissToast(id), 4600)
  },
  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }))
  }
}))
