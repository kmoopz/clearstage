import {
  ChartNoAxesCombined,
  CircleHelp,
  Clapperboard,
  Radio,
  Rss,
  Settings
} from 'lucide-react'
import type { Page } from '../store'
import { useAppStore } from '../store'
import { initials } from '../lib/format'

const NAV: Array<{ page: Page; label: string; icon: typeof Radio }> = [
  { page: 'live', label: '直播台', icon: Radio },
  { page: 'recordings', label: '录制库', icon: Clapperboard },
  { page: 'stats', label: '数据', icon: ChartNoAxesCombined },
  { page: 'feeds', label: '动态', icon: Rss },
  { page: 'settings', label: '设置', icon: Settings }
]

export function Sidebar() {
  const page = useAppStore((state) => state.page)
  const setPage = useAppStore((state) => state.setPage)
  const auth = useAppStore((state) => state.auth)
  const recordings = useAppStore((state) => state.recordings)
  const isDemo = useAppStore((state) => state.info?.isDemo)
  const recordingCount = recordings.filter((item) => item.status === 'recording').length

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav" aria-label="主导航">
        {NAV.slice(0, 4).map(({ page: target, label, icon: Icon }) => (
          <button
            key={target}
            className={`side-item ${page === target ? 'is-active' : ''}`}
            onClick={() => setPage(target)}
            title={label}
          >
            <span className="side-icon">
              <Icon size={19} strokeWidth={1.8} />
              {target === 'live' && <span className="side-live-dot" />}
              {target === 'recordings' && recordingCount > 0 && <span className="side-rec-dot" />}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      {recordingCount > 0 && (
        <button className="side-recording" onClick={() => setPage('recordings')} title="正在录制">
          <span className="rec-pulse" />
          <span>REC</span>
          <b>{recordingCount}</b>
        </button>
      )}

      <div className="sidebar-bottom">
        <button className="side-item" onClick={() => setPage('settings')} title="设置">
          <span className="side-icon">
            <Settings size={19} strokeWidth={1.8} />
          </span>
          <span>设置</span>
        </button>
        <button
          className="side-help"
          title="帮助与常见问题"
          onClick={() => {
            if (isDemo) useAppStore.getState().toast('info', '帮助文档', '官网的文档与 FAQ 页面覆盖了常见问题。')
            else useAppStore.getState().toast('info', '提示', '设置页底部可以查看版本、数据目录与合规说明。')
          }}
        >
          <CircleHelp size={18} strokeWidth={1.8} />
        </button>
        <button className="side-account" onClick={() => setPage('settings')} title={auth.loggedIn ? auth.uname : '登录 B 站'}>
          {auth.face ? (
            <img src={auth.face} alt={auth.uname ?? '账号'} />
          ) : (
            <span>{initials(auth.uname)}</span>
          )}
          <i className={auth.loggedIn ? 'is-online' : ''} />
        </button>
      </div>
    </aside>
  )
}
