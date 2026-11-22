import { useEffect, useRef } from 'react'
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { useAppStore } from './store'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Toasts } from './components/Toasts'
import { AddRoomModal } from './components/AddRoomModal'
import { CommandPalette } from './components/CommandPalette'
import { ThemeDrawer } from './components/ThemeDrawer'
import { LiveView } from './views/LiveView'
import { RecordingsView } from './views/RecordingsView'
import { StatsView } from './views/StatsView'
import { FeedsView } from './views/FeedsView'
import { SettingsView } from './views/SettingsView'
import { BrandMark } from './components/Brand'
import { themeById } from './lib/themes'

export default function App() {
  const booted = useAppStore((state) => state.booted)
  const bootError = useAppStore((state) => state.bootError)
  const page = useAppStore((state) => state.page)
  const settings = useAppStore((state) => state.settings)
  const info = useAppStore((state) => state.info)
  const init = useAppStore((state) => state.init)
  const addMessage = useAppStore((state) => state.addMessage)
  const progressRecording = useAppStore((state) => state.progressRecording)
  const setBurst = useAppStore((state) => state.setBurst)
  const addSong = useAppStore((state) => state.addSong)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    void init()
  }, [init])

  useEffect(() => {
    if (!window.clearstage) return
    const unsubscribers = [
      window.clearstage.danmaku.onMessage((roomId, message) => addMessage(roomId, message)),
      window.clearstage.recordings.onProgress((progress) => progressRecording(progress)),
      window.clearstage.danmaku.onBurst((state) => setBurst(state)),
      window.clearstage.songs.onSong((song) => addSong(song))
    ]
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [addMessage, progressRecording, setBurst, addSong])

  useEffect(() => {
    const theme = themeById(settings.themeId)
    const root = document.documentElement
    root.dataset.mode = theme.mode
    root.dataset.theme = theme.id
    root.style.setProperty('--bg', theme.bg)
    root.style.setProperty('--surface', theme.surface)
    root.style.setProperty('--text', theme.text)
    root.style.setProperty('--muted', theme.muted)
    root.style.setProperty('--line', theme.line)
    root.style.setProperty('--accent', settings.accent || theme.accent)
    root.style.setProperty('--accent-contrast', theme.mode === 'light' ? '#06251d' : '#04120e')
    root.style.setProperty('--theme-art', theme.art ? `url("${theme.art}")` : 'none')
    root.style.setProperty('--theme-art-opacity', String(theme.artOpacity ?? 0.26))
    root.style.setProperty('--theme-art-position', theme.artPosition ?? 'center')
    let style = document.getElementById('clearstage-custom-css') as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = 'clearstage-custom-css'
      document.head.appendChild(style)
    }
    style.textContent = settings.customCss
  }, [settings.themeId, settings.accent, settings.customCss])

  useEffect(() => {
    if (info) document.title = `澄幕 ClearStage · ${info.version}`
  }, [info])

  useEffect(() => {
    const workspace = document.querySelector('.workspace')
    if (workspace) workspace.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const state = useAppStore.getState()
      const target = event.target instanceof Element ? event.target : null
      const typing = Boolean(target?.closest('input, textarea, select, [contenteditable="true"]'))
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()

      if (mod && key === 'k') {
        event.preventDefault()
        state.setCommandOpen(!state.commandOpen)
        return
      }

      if (state.commandOpen) {
        if (event.key === 'Escape') {
          event.preventDefault()
          state.setCommandOpen(false)
        }
        return
      }

      if (event.key === 'Escape' && state.focusedRoomId) {
        state.setFocusedRoom(null)
        return
      }

      if (event.key === 'F5') {
        event.preventDefault()
        window.dispatchEvent(
          new CustomEvent('clearstage:refresh-room', { detail: { roomId: state.selectedId ?? 'all' } })
        )
        return
      }

      if (typing) return

      if (event.key === '?') {
        event.preventDefault()
        state.setCommandOpen(true)
        return
      }

      if (!mod) return

      if (/^[1-5]$/.test(event.key)) {
        event.preventDefault()
        const pages = ['live', 'recordings', 'stats', 'feeds', 'settings'] as const
        state.setPage(pages[Number(event.key) - 1])
        return
      }

      if (event.shiftKey && key === 'l') {
        event.preventDefault()
        const order = ['1', '2', '4', '6', '9']
        const current = state.settings.layout
        const next = order[(order.indexOf(current) + 1) % order.length] ?? '4'
        void state.setLayout(next)
        return
      }

      if (event.shiftKey && key === 'm') {
        event.preventDefault()
        state.setChatOpen(!state.chatOpen)
        return
      }

      if (event.shiftKey && key === 'f') {
        event.preventDefault()
        state.setPage('live')
        state.setFocusedRoom(state.focusedRoomId ? null : state.selectedId)
        return
      }

      if (event.shiftKey && key === 'a') {
        event.preventDefault()
        state.setAddRoomOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!booted) {
    return (
      <div className="boot-screen">
        <div className="boot-glow" />
        <div className="boot-mark">
          <BrandMark size={62} />
          <span className="boot-orbit" />
        </div>
        <h1>澄幕 <span>ClearStage</span></h1>
        <p>正在擦亮画面</p>
        <div className="boot-progress"><i /></div>
        <small>初始化本地存储 · 启动媒体代理 · 检查 FFmpeg</small>
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="boot-screen boot-error">
        <div className="boot-mark"><AlertTriangle size={38} /></div>
        <h1>没能启动工作台</h1>
        <p>{bootError}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          <RefreshCw size={15} /> 重新加载
        </button>
        <small>如果问题持续，请检查数据目录权限或重启应用。</small>
      </div>
    )
  }

  return (
    <div className={`app-shell ${info?.isDemo ? 'is-demo' : ''}`}>
      <div className="app-ambient" aria-hidden="true">
        <span className="ambient-art" />
        <span className="ambient-glow glow-a" />
        <span className="ambient-glow glow-b" />
        <span className="ambient-grid" />
      </div>
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="workspace">
          {page === 'live' && <LiveView />}
          {page === 'recordings' && <RecordingsView />}
          {page === 'stats' && <StatsView />}
          {page === 'feeds' && <FeedsView />}
          {page === 'settings' && <SettingsView />}
        </main>
      </div>
      <AddRoomModal />
      <CommandPalette />
      <ThemeDrawer />
      <Toasts />
      {info?.isDemo && (
        <div className="demo-flag">
          <span /> 演示数据 · DEMO BUILD
        </div>
      )}
    </div>
  )
}
