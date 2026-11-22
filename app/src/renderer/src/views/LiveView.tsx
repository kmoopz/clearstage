import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Room } from '../../../shared/types'
import {
  Grid2X2,
  LayoutGrid,
  Maximize2,
  MessageSquare,
  Minimize2,
  Palette,
  PanelRightOpen,
  Plus,
  Radio,
  Sparkles
} from 'lucide-react'
import { useAppStore } from '../store'
import { PlayerTile } from '../components/PlayerTile'
import { InteractionPanel } from '../components/InteractionPanel'
import { initials } from '../lib/format'

const GRID_GAP = 11

interface GridPlan {
  columns: number
  rows: number
  tileWidth: number
  tileHeight: number
  ready: boolean
}

function planGrid(
  count: number,
  layout: string,
  width: number,
  height: number,
  focused: boolean
): GridPlan {
  const fallbackColumns = layout === '1' ? 1 : layout === '2' || layout === '4' ? Math.min(2, Math.max(1, count)) : count <= 4 ? Math.min(2, Math.max(1, count)) : 3
  if (focused) {
    return {
      columns: 1,
      rows: 1,
      tileWidth: Math.max(0, width),
      tileHeight: Math.max(0, height),
      ready: width > 0 && height > 0
    }
  }
  if (count <= 0) return { columns: 1, rows: 1, tileWidth: 0, tileHeight: 0, ready: false }
  const columns = Math.min(count, fallbackColumns)
  const rows = Math.ceil(count / columns)
  if (width <= 0 || height <= 0) {
    return { columns, rows, tileWidth: 0, tileHeight: 0, ready: false }
  }
  const cellWidth = (width - GRID_GAP * (columns - 1)) / columns
  const cellHeight = (height - GRID_GAP * (rows - 1)) / rows
  if (cellWidth <= 0 || cellHeight <= 0) {
    return { columns, rows, tileWidth: 0, tileHeight: 0, ready: false }
  }
  const cellRatio = 16 / 9
  let tileWidth = cellWidth
  let tileHeight = cellWidth / cellRatio
  if (tileHeight > cellHeight) {
    tileHeight = cellHeight
    tileWidth = cellHeight * cellRatio
  }
  return { columns, rows, tileWidth, tileHeight, ready: true }
}

export function LiveView() {
  const rooms = useAppStore((state) => state.rooms)
  const activeIds = useAppStore((state) => state.activeIds)
  const layout = useAppStore((state) => state.settings.layout)
  const setLayout = useAppStore((state) => state.setLayout)
  const setAddRoomOpen = useAppStore((state) => state.setAddRoomOpen)
  const setThemeOpen = useAppStore((state) => state.setThemeOpen)
  const chatOpen = useAppStore((state) => state.chatOpen)
  const setChatOpen = useAppStore((state) => state.setChatOpen)
  const recordings = useAppStore((state) => state.recordings)
  const selectedId = useAppStore((state) => state.selectedId)
  const focusedRoomId = useAppStore((state) => state.focusedRoomId)
  const setFocusedRoom = useAppStore((state) => state.setFocusedRoom)
  const reorderActive = useAppStore((state) => state.reorderActive)
  const gridRef = useRef<HTMLDivElement>(null)
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 })
  const [dragId, setDragId] = useState<string | null>(null)

  const activeRooms = useMemo(
    () => activeIds.map((id) => rooms.find((room) => room.id === id)).filter((room): room is Room => Boolean(room)),
    [activeIds, rooms]
  )
  const capacity = Number(layout) || 4
  const focusedRoom = focusedRoomId ? activeRooms.find((room) => room.id === focusedRoomId) : undefined
  const displayRooms = focusedRoom ? [focusedRoom] : activeRooms
  const showAdd = !focusedRoom && displayRooms.length > 1 && displayRooms.length < Math.min(capacity, 9)
  const tileCount = displayRooms.length + (showAdd ? 1 : 0)
  const liveCount = activeRooms.filter((room) => room.liveStatus === 'live').length
  const recordingCount = recordings.filter((item) => item.status === 'recording').length
  const plan = useMemo(
    () => planGrid(tileCount, layout, gridSize.width, gridSize.height, Boolean(focusedRoom)),
    [tileCount, layout, gridSize.width, gridSize.height, focusedRoom]
  )
  const gridStyle = plan.ready
    ? {
        gridTemplateColumns: `repeat(${plan.columns}, ${plan.tileWidth}px)`,
        gridTemplateRows: `repeat(${plan.rows}, ${plan.tileHeight}px)`,
        gap: `${GRID_GAP}px`
      }
    : { gridTemplateColumns: `repeat(${plan.columns}, minmax(0, 1fr))` }

  useLayoutEffect(() => {
    const element = gridRef.current
    if (!element) return
    const measure = (): void => {
      setGridSize({ width: element.clientWidth, height: element.clientHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [displayRooms.length, chatOpen, focusedRoom])

  useEffect(() => {
    if (focusedRoomId && !activeRooms.some((room) => room.id === focusedRoomId)) setFocusedRoom(null)
  }, [activeRooms, focusedRoomId, setFocusedRoom])

  useEffect(() => {
    if (!focusedRoomId) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setFocusedRoom(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusedRoomId, setFocusedRoom])

  return (
    <section className="view live-view">
      <header className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow"><Radio size={12} /> LIVE WORKSPACE · 直播台</span>
          <h1>
            把每一路现场
            <span className="head-em">放在同一张桌上。</span>
          </h1>
          <p>
            {activeRooms.length > 0
              ? `${activeRooms.length} 路画面 · ${liveCount} 路直播中${recordingCount ? ` · ${recordingCount} 路正在录制` : ''}${focusedRoom ? ' · 专注模式' : plan.ready ? ` · 自动 ${plan.columns}×${plan.rows}` : ''}`
              : '添加 B 直播间，或接入你有权访问的 HLS / FLV 直链。'}
          </p>
        </div>
        <div className="page-head-actions">
          {activeRooms.length > 0 && (
            <button
              className={`btn btn-ghost btn-sm ${focusedRoom ? 'is-active' : ''}`}
              title={focusedRoom ? '返回多画面' : '只保留当前画面，减少解码压力'}
              onClick={() => setFocusedRoom(focusedRoom ? null : selectedId)}
              disabled={!focusedRoom && !selectedId}
            >
              {focusedRoom ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {focusedRoom ? '退出专注' : '专注当前'}
            </button>
          )}
          {!chatOpen && (
            <button className="btn btn-ghost btn-sm" onClick={() => setChatOpen(true)}>
              <PanelRightOpen size={14} /> 互动
            </button>
          )}
          <div className="layout-switch" title="画面格数容量；画面会按实际路数自适应">
            <Grid2X2 size={14} />
            {['1', '2', '4', '6', '9'].map((value) => (
              <button
                key={value}
                className={layout === value ? 'is-active' : ''}
                onClick={() => void setLayout(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setThemeOpen(true)}>
            <Palette size={14} /> 风格
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setAddRoomOpen(true)}>
            <Plus size={15} /> 添加直播间
          </button>
        </div>
      </header>

      {activeRooms.length === 0 ? (
        <div className="stage-empty">
          <div className="empty-art">
            <div className="empty-art-ring r1" />
            <div className="empty-art-ring r2" />
            <div className="empty-art-screen">
              <Radio size={30} />
              <span>NO SIGNAL</span>
            </div>
            <div className="empty-art-orbit">
              <Sparkles size={14} />
            </div>
          </div>
          <div className="empty-copy">
            <span className="eyebrow">READY WHEN YOU ARE</span>
            <h2>直播台还是空的</h2>
            <p>
              从 B 站直播间开始。澄幕会解析纯净画面，聚合弹幕、礼物和醒目留言，并把录制、切片与主播数据留在本地。
            </p>
            <div className="empty-actions">
              <button className="btn btn-primary" onClick={() => setAddRoomOpen(true)}>
                <Plus size={15} /> 添加第一个直播间
              </button>
              <button className="btn btn-ghost" onClick={() => setThemeOpen(true)}>
                <Palette size={15} /> 先挑一种风格
              </button>
            </div>
            {rooms.length > 0 && (
              <div className="saved-room-list">
                <span>已保存的直播间</span>
                <div>
                  {rooms.slice(0, 5).map((room) => (
                    <button
                      key={room.id}
                      className="saved-room"
                      onClick={() => useAppStore.getState().toggleRoom(room.id)}
                    >
                      <span className="mini-avatar">{initials(room.streamer)}</span>
                      <span>
                        <b>{room.streamer}</b>
                        <small>{room.title}</small>
                      </span>
                      <Plus size={13} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`live-layout ${chatOpen ? 'with-chat' : 'without-chat'} ${focusedRoom ? 'is-focused' : ''}`}>
          <div
            ref={gridRef}
            className={`live-grid layout-${layout} ${plan.ready ? 'is-sized' : ''} ${focusedRoom ? 'is-focused' : ''}`}
            style={gridStyle}
          >
            {displayRooms.map((room) => (
              <PlayerTile
                key={room.id}
                room={room}
                focused={Boolean(focusedRoom)}
                onDragStart={() => setDragId(room.id)}
                onDragEnd={() => setDragId(null)}
                onDropRoom={(sourceId) => {
                  reorderActive(sourceId, room.id)
                  setDragId(null)
                }}
              />
            ))}
            {showAdd && (
              <button className="add-tile" onClick={() => setAddRoomOpen(true)}>
                <span className="add-tile-icon">
                  <Plus size={22} />
                </span>
                <strong>添加新画面</strong>
                <small>B 站原生 · 直链兼容</small>
                <span className="add-tile-hint">
                  <LayoutGrid size={12} /> {activeRooms.length}/{layout} 格
                </span>
              </button>
            )}
            {plan.ready && (
              <span className="live-grid-meta">
                {focusedRoom ? '专注模式 · 仅当前画面' : `自动排布 ${plan.columns}×${plan.rows} · 每路 16:9`}
              </span>
            )}
          </div>
          {chatOpen ? (
            <InteractionPanel />
          ) : (
            <button className="chat-reopen" onClick={() => setChatOpen(true)} title="打开互动面板">
              <MessageSquare size={18} />
              <span>互动</span>
            </button>
          )}
        </div>
      )}
    </section>
  )
}
