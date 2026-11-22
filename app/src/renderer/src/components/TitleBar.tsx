import { useEffect, useState } from 'react'
import { Minus, Square, X, Copy, Radio, Search } from 'lucide-react'
import { BrandMark, BrandWordmark } from './Brand'
import { useAppStore } from '../store'

const PAGE_LABEL: Record<string, string> = {
  live: '直播台',
  recordings: '录制库',
  stats: '主播数据',
  feeds: '动态与投稿',
  settings: '偏好设置'
}

export function TitleBar() {
  const page = useAppStore((state) => state.page)
  const info = useAppStore((state) => state.info)
  const activeIds = useAppStore((state) => state.activeIds)
  const setCommandOpen = useAppStore((state) => state.setCommandOpen)
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let alive = true
    void window.clearstage.window.isMaximized().then((value) => alive && setMaximized(value))
    const unsubscribe = window.clearstage.window.onStateChange((state) => setMaximized(state.maximized))
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  return (
    <header className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-brand">
          <BrandMark size={28} />
          <BrandWordmark compact />
        </div>
        <div className="titlebar-divider" />
        <div className="titlebar-crumb">
          <Radio size={12} />
          <span>{PAGE_LABEL[page] ?? '工作台'}</span>
          {page === 'live' && activeIds.length > 0 && <em>{activeIds.length} 路</em>}
        </div>
        <div className="titlebar-center-hint">
          <span className="titlebar-dot" />
          本地优先 · 数据不出机
        </div>
      </div>
      <div className="titlebar-actions">
        <button className="titlebar-command" onClick={() => setCommandOpen(true)} title="快捷命令（Ctrl+K）">
          <Search size={13} />
          <span>快捷命令</span>
          <kbd>Ctrl K</kbd>
        </button>
        <span className="titlebar-version">v{info?.version ?? '0.1.0'} · BETA</span>
        <button className="window-btn" aria-label="最小化" onClick={() => void window.clearstage.window.minimize()}>
          <Minus size={14} />
        </button>
        <button className="window-btn" aria-label={maximized ? '还原' : '最大化'} onClick={() => void window.clearstage.window.toggleMaximize()}>
          {maximized ? <Copy size={12} /> : <Square size={11} />}
        </button>
        <button className="window-btn window-btn-close" aria-label="关闭" onClick={() => void window.clearstage.window.close()}>
          <X size={14} />
        </button>
      </div>
    </header>
  )
}
