import { useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ChartNoAxesCombined,
  Clapperboard,
  ClipboardPaste,
  Command,
  ExternalLink,
  LayoutGrid,
  Maximize2,
  MessageSquare,
  Palette,
  PictureInPicture2,
  Plus,
  Radio,
  RefreshCw,
  Rss,
  Search,
  Settings,
  X
} from 'lucide-react'
import type { Room } from '../../../shared/types'
import type { Page } from '../store'
import { useAppStore } from '../store'
import { errorMessage, initials } from '../lib/format'

interface PaletteAction {
  id: string
  label: string
  hint?: string
  category: string
  icon: LucideIcon
  keywords?: string
  run: () => void | Promise<void>
}

function roomUrl(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const bili = trimmed.match(/(?:https?:\/\/)?live\.bilibili\.com\/(\d+)/i) ?? trimmed.match(/^(\d{1,10})$/)
  if (bili) return `https://live.bilibili.com/${bili[1]}`
  if (/^https?:\/\/.+\.(m3u8|flv)(\?|$)/i.test(trimmed)) return trimmed
  return null
}

export function CommandPalette() {
  const open = useAppStore((state) => state.commandOpen)
  const setOpen = useAppStore((state) => state.setCommandOpen)
  const page = useAppStore((state) => state.page)
  const setPage = useAppStore((state) => state.setPage)
  const rooms = useAppStore((state) => state.rooms)
  const activeIds = useAppStore((state) => state.activeIds)
  const selectedId = useAppStore((state) => state.selectedId)
  const focusedRoomId = useAppStore((state) => state.focusedRoomId)
  const chatOpen = useAppStore((state) => state.chatOpen)
  const layout = useAppStore((state) => state.settings.layout)
  const setAddRoomOpen = useAppStore((state) => state.setAddRoomOpen)
  const setThemeOpen = useAppStore((state) => state.setThemeOpen)
  const setChatOpen = useAppStore((state) => state.setChatOpen)
  const setSelected = useAppStore((state) => state.setSelected)
  const setFocusedRoom = useAppStore((state) => state.setFocusedRoom)
  const setLayout = useAppStore((state) => state.setLayout)
  const toggleRoom = useAppStore((state) => state.toggleRoom)
  const addRoom = useAppStore((state) => state.addRoom)
  const toast = useAppStore((state) => state.toast)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const go = (target: Page): void => setPage(target)

  async function addFromClipboard(): Promise<void> {
    try {
      const text = await window.clearstage.app.readClipboard()
      const url = roomUrl(text)
      if (!url) {
        setAddRoomOpen(true)
        toast('info', '剪贴板里没有直播间链接', '已打开添加窗口，可手动粘贴直播间地址。')
        return
      }
      if (/\.(m3u8|flv)/i.test(url)) {
        await addRoom({ url, platform: 'direct', directUrl: url })
        toast('success', '已从剪贴板添加直链', url)
      } else {
        await addRoom({ url, platform: 'bilibili' })
      }
      go('live')
    } catch (error) {
      toast('error', '无法读取剪贴板', errorMessage(error))
    }
  }

  const actions = useMemo<PaletteAction[]>(
    () => [
      { id: 'page-live', label: '直播台', hint: 'Ctrl+1', category: '前往', icon: Radio, keywords: 'live 监控', run: () => go('live') },
      { id: 'page-recordings', label: '录制库', hint: 'Ctrl+2', category: '前往', icon: Clapperboard, keywords: 'recording 录像', run: () => go('recordings') },
      { id: 'page-stats', label: '主播数据', hint: 'Ctrl+3', category: '前往', icon: ChartNoAxesCombined, keywords: 'stats 数据', run: () => go('stats') },
      { id: 'page-feeds', label: '动态与投稿', hint: 'Ctrl+4', category: '前往', icon: Rss, keywords: 'feed 动态', run: () => go('feeds') },
      { id: 'page-settings', label: '设置', hint: 'Ctrl+5', category: '前往', icon: Settings, keywords: 'preferences 偏好', run: () => go('settings') },
      { id: 'add-room', label: '添加直播间', hint: 'Ctrl+Shift+A', category: '操作', icon: Plus, keywords: 'add room 新画面', run: () => setAddRoomOpen(true) },
      { id: 'add-clipboard', label: '从剪贴板添加直播间', category: '操作', icon: ClipboardPaste, keywords: 'clipboard 粘贴 快速添加', run: addFromClipboard },
      {
        id: 'toggle-chat',
        label: chatOpen ? '收起互动面板' : '打开互动面板',
        hint: 'Ctrl+Shift+M',
        category: '画面',
        icon: MessageSquare,
        keywords: 'chat 弹幕 互动',
        run: () => setChatOpen(!chatOpen)
      },
      {
        id: 'focus',
        label: focusedRoomId ? '退出专注画面' : '专注当前画面',
        hint: 'Ctrl+Shift+F',
        category: '画面',
        icon: Maximize2,
        keywords: 'focus theater 剧场 全屏',
        run: () => setFocusedRoom(focusedRoomId ? null : selectedId)
      },
      {
        id: 'refresh',
        label: '刷新当前画面',
        hint: 'F5',
        category: '画面',
        icon: RefreshCw,
        keywords: 'reload 重连',
        run: () => {
          go('live')
          window.dispatchEvent(new CustomEvent('clearstage:refresh-room', { detail: { roomId: selectedId ?? 'all' } }))
        }
      },
      {
        id: 'layout',
        label: `切换布局（当前 ${layout} 格）`,
        hint: 'Ctrl+Shift+L',
        category: '画面',
        icon: LayoutGrid,
        keywords: 'layout 分屏 多画面',
        run: () => {
          const order = ['1', '2', '4', '6', '9']
          const next = order[(order.indexOf(layout) + 1) % order.length] ?? '4'
          void setLayout(next)
        }
      },
      {
        id: 'pip',
        label: '把当前画面放入画中画',
        category: '画面',
        icon: PictureInPicture2,
        keywords: 'picture in picture 小窗',
        run: () => {
          const video = document.querySelector<HTMLVideoElement>('.player-tile.is-selected video')
          if (!video) {
            toast('info', '当前没有可用的直播画面')
            return
          }
          if (document.pictureInPictureElement) void document.exitPictureInPicture()
          else void video.requestPictureInPicture().catch(() => toast('warning', '无法进入画中画'))
        }
      },
      { id: 'theme', label: '打开风格工坊', category: '外观', icon: Palette, keywords: 'theme 主题', run: () => setThemeOpen(true) },
      {
        id: 'docs',
        label: '打开使用文档',
        category: '帮助',
        icon: ExternalLink,
        keywords: 'help docs faq',
        run: () => void window.clearstage.app.openExternal('https://kmoopz.github.io/clearstage/docs.html')
      }
    ],
    [chatOpen, focusedRoomId, layout, selectedId, setAddRoomOpen, setChatOpen, setFocusedRoom, setLayout, setThemeOpen, toast]
  )

  const roomActions = useMemo<PaletteAction[]>(() => {
    const order = new Map(activeIds.map((id, index) => [id, index]))
    return [...rooms]
      .sort((a, b) => {
        const activeA = order.has(a.id) ? 0 : 1
        const activeB = order.has(b.id) ? 0 : 1
        if (activeA !== activeB) return activeA - activeB
        if (a.liveStatus === 'live' && b.liveStatus !== 'live') return -1
        if (b.liveStatus === 'live' && a.liveStatus !== 'live') return 1
        return (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)
      })
      .map((room: Room) => ({
        id: `room-${room.id}`,
        label: room.streamer || room.title || room.roomId,
        hint: activeIds.includes(room.id) ? '已在直播台' : room.liveStatus === 'live' ? '直播中' : '未开播',
        category: '直播间',
        icon: Radio,
        keywords: `${room.title} ${room.roomId} ${room.sourceUrl} ${room.area ?? ''}`,
        run: () => {
          if (activeIds.includes(room.id)) {
            setSelected(room.id)
            setFocusedRoom(null)
            go('live')
          } else {
            toggleRoom(room.id)
            go('live')
          }
        }
      }))
  }, [rooms, activeIds, setSelected, setFocusedRoom, toggleRoom])

  const filteredActions = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return actions.filter((action) => {
      if (!needle) return true
      return `${action.label} ${action.category} ${action.keywords ?? ''}`.toLowerCase().includes(needle)
    })
  }, [actions, query])

  const filteredRooms = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return roomActions.slice(0, 8)
    return roomActions
      .filter((action) => `${action.label} ${action.hint ?? ''} ${action.keywords}`.toLowerCase().includes(needle))
      .slice(0, 12)
  }, [roomActions, query])

  const entries = useMemo(() => {
    const pageActions = filteredActions.filter((action) => action.category === '前往')
    const otherActions = filteredActions.filter((action) => action.category !== '前往')
    return [...pageActions, ...filteredRooms, ...otherActions]
  }, [filteredActions, filteredRooms])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    window.setTimeout(() => inputRef.current?.focus(), 20)
  }, [open])

  useEffect(() => {
    if (!open) return
    setActiveIndex(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    document.getElementById(`command-entry-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, entries.length])

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, setOpen])

  if (!open) return null

  const runEntry = (entry: PaletteAction | undefined): void => {
    if (!entry) return
    setOpen(false)
    void entry.run()
  }

  let lastCategory = ''

  return (
    <div className="command-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <div className="command-panel" role="dialog" aria-modal="true" aria-label="快捷命令">
        <div className="command-search">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((index) => (index + 1) % Math.max(entries.length, 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => (index - 1 + entries.length) % Math.max(entries.length, 1))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                runEntry(entries[activeIndex])
              }
            }}
            placeholder="搜索房间、页面或操作…"
            aria-label="搜索快捷命令"
            spellCheck={false}
          />
          <kbd>Ctrl K</kbd>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="关闭快捷命令">
            <X size={16} />
          </button>
        </div>

        <div className="command-list">
          {entries.length === 0 && <div className="command-empty">没有匹配的命令或直播间</div>}
          {entries.map((entry, index) => {
            const showCategory = entry.category !== lastCategory
            lastCategory = entry.category
            const Icon = entry.icon
            const room = entry.id.startsWith('room-') ? rooms.find((item) => `room-${item.id}` === entry.id) : undefined
            return (
              <div key={entry.id}>
                {showCategory && <div className="command-category">{entry.category}</div>}
                <button
                  id={`command-entry-${index}`}
                  className={`command-item ${index === activeIndex ? 'is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runEntry(entry)}
                >
                  <span className="command-icon">
                    {room ? <span className="command-avatar">{initials(room.streamer)}</span> : <Icon size={15} />}
                  </span>
                  <span className="command-label">{entry.label}</span>
                  {entry.hint && <span className="command-hint">{entry.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>

        <div className="command-foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>Esc</kbd> 关闭</span>
          <span className="command-brand"><Command size={11} /> 澄幕快捷命令</span>
        </div>
      </div>
    </div>
  )
}
