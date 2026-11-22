import { useMemo } from 'react'
import type { Room } from '../../../shared/types'
import {
  Grid2X2,
  LayoutGrid,
  MessageSquare,
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

  const activeRooms = useMemo(
    () => activeIds.map((id) => rooms.find((room) => room.id === id)).filter((room): room is Room => Boolean(room)),
    [activeIds, rooms]
  )
  const capacity = Number(layout) || 4
  const showAdd = activeRooms.length > 0 && activeRooms.length < Math.min(capacity, 9)
  const tileCount = activeRooms.length + (showAdd ? 1 : 0)
  const columns = tileCount <= 1 ? 1 : Number(layout) >= 6 ? 3 : 2
  const liveCount = activeRooms.filter((room) => room.liveStatus === 'live').length
  const recordingCount = recordings.filter((item) => item.status === 'recording').length

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
              ? `${activeRooms.length} 路画面 · ${liveCount} 路直播中${recordingCount ? ` · ${recordingCount} 路正在录制` : ''}`
              : '添加 B 站直播间，或接入你有权访问的 HLS / FLV 直链。'}
          </p>
        </div>
        <div className="page-head-actions">
          {!chatOpen && (
            <button className="btn btn-ghost btn-sm" onClick={() => setChatOpen(true)}>
              <PanelRightOpen size={14} /> 互动
            </button>
          )}
          <div className="layout-switch" title="画面布局">
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
        <div className={`live-layout ${chatOpen ? 'with-chat' : 'without-chat'}`}>
          <div
            className={`live-grid layout-${layout}`}
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {activeRooms.map((room) => (
              <PlayerTile key={room.id} room={room} />
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
