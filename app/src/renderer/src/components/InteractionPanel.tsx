import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  Gift,
  History,
  Loader2,
  MessageSquare,
  PanelRightClose,
  Repeat2,
  Send,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  X
} from 'lucide-react'
import type { ChatMessage, Room } from '../../../shared/types'
import type { HistoryItem } from '../../../shared/api'
import { useAppStore } from '../store'
import { clockTime, errorMessage, formatNumber, initials } from '../lib/format'

type Tab = 'all' | 'chat' | 'gift' | 'super'

export function InteractionPanel() {
  const rooms = useAppStore((state) => state.rooms)
  const activeIds = useAppStore((state) => state.activeIds)
  const selectedId = useAppStore((state) => state.selectedId)
  const setSelected = useAppStore((state) => state.setSelected)
  const setChatOpen = useAppStore((state) => state.setChatOpen)
  const messagesByRoom = useAppStore((state) => state.messages)
  const auth = useAppStore((state) => state.auth)
  const settings = useAppStore((state) => state.settings)
  const burst = useAppStore((state) => state.burst)
  const setBurst = useAppStore((state) => state.setBurst)
  const addMessage = useAppStore((state) => state.addMessage)
  const toast = useAppStore((state) => state.toast)
  const setPage = useAppStore((state) => state.setPage)
  const history = useAppStore((state) => state.history)
  const loadHistory = useAppStore((state) => state.loadHistory)
  const isDemo = useAppStore((state) => state.info?.isDemo)
  const [tab, setTab] = useState<Tab>('all')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [burstOpen, setBurstOpen] = useState(false)
  const [giftOpen, setGiftOpen] = useState(false)
  const [burstCount, setBurstCount] = useState(5)
  const [burstGap, setBurstGap] = useState(4)
  const [localError, setLocalError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const activeRooms = activeIds
    .map((id) => rooms.find((room) => room.id === id))
    .filter(Boolean) as Room[]
  const room = activeRooms.find((item) => item.id === selectedId) ?? activeRooms[0]
  const messages = room ? (messagesByRoom[room.id] ?? []) : []

  const filtered = useMemo(() => {
    if (tab === 'all') return messages
    if (tab === 'chat') return messages.filter((message) => message.type === 'chat')
    if (tab === 'gift') return messages.filter((message) => message.type === 'gift' || message.type === 'guard')
    return messages.filter((message) => message.type === 'superchat')
  }, [messages, tab])

  const counts = useMemo(
    () => ({
      all: messages.length,
      chat: messages.filter((message) => message.type === 'chat').length,
      gift: messages.filter((message) => message.type === 'gift' || message.type === 'guard').length,
      super: messages.filter((message) => message.type === 'superchat').length
    }),
    [messages]
  )

  useEffect(() => {
    if (!room) return
    void loadHistory(room.id)
  }, [room?.id, loadHistory])

  useEffect(() => {
    const node = listRef.current
    if (!node) return
    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [filtered.length, room?.id])

  useEffect(() => {
    setHistoryOpen(false)
    setBurstOpen(false)
    setGiftOpen(false)
    setLocalError('')
  }, [room?.id])

  async function sendMessage() {
    const cleaned = text.trim()
    if (!room || !cleaned || sending) return
    if ([...cleaned].length > 20) {
      setLocalError('B站弹幕最多 20 个字符')
      return
    }
    if (room.platform !== 'bilibili') {
      setLocalError('该平台的弹幕发送需要官方开放能力')
      return
    }
    if (!auth.loggedIn) {
      setLocalError('请先在设置中粘贴 B 站 Cookie 登录')
      return
    }
    setSending(true)
    setLocalError('')
    try {
      await window.clearstage.danmaku.send(room.id, cleaned)
      setText('')
      addMessage(room.id, {
        id: `self-${Date.now()}`,
        roomId: room.id,
        type: 'chat',
        userName: auth.uname ?? '我',
        text: cleaned,
        timestamp: Date.now(),
        isSelf: true
      })
      void loadHistory(room.id)
    } catch (error) {
      setLocalError(errorMessage(error))
    } finally {
      setSending(false)
    }
  }

  async function addFavorite(value?: string) {
    const content = (value ?? text).trim()
    if (!room || !content) return
    if (isDemo) {
      toast('info', '演示模式', '正式版会把这句话加入常用弹幕。')
      return
    }
    try {
      await window.clearstage.danmaku.addFavorite(room.id, content)
      await loadHistory(room.id)
      toast('success', '已加入常用弹幕')
    } catch (error) {
      toast('error', '收藏失败', errorMessage(error))
    }
  }

  async function removeHistoryItem(item: HistoryItem) {
    if (isDemo) {
      toast('info', '演示模式不可删除')
      return
    }
    try {
      await window.clearstage.danmaku.removeHistory(item.id)
      await loadHistory(room?.id ?? '')
    } catch (error) {
      toast('error', '删除失败', errorMessage(error))
    }
  }

  async function startBurst() {
    if (!room) return
    if (isDemo) {
      toast('info', '演示模式', '正式版会在限速保护下发送连发弹幕。')
      setBurstOpen(false)
      return
    }
    if (!auth.loggedIn) {
      setLocalError('连发前请先登录 B 站账号')
      return
    }
    if (!text.trim()) {
      setLocalError('先输入要连发的内容')
      return
    }
    try {
      const state = await window.clearstage.danmaku.burst(room.id, text.trim(), burstCount, burstGap * 1000)
      setBurst(state)
      setBurstOpen(false)
    } catch (error) {
      setLocalError(errorMessage(error))
    }
  }

  if (!room) {
    return (
      <aside className="interaction-panel is-empty">
        <div className="chat-empty-state">
          <span className="empty-orbit">
            <MessageSquare size={22} />
          </span>
          <h3>还没有打开的直播间</h3>
          <p>添加一路画面后，弹幕、礼物和互动会在这里汇合。</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="interaction-panel">
      <div className="chat-head">
        <div className="chat-room-select">
          <span className="mini-avatar">{initials(room.streamer)}</span>
          <div>
            <strong>实时互动</strong>
            <button className="chat-room-title" onClick={() => setSelected(room.id)}>
              {room.streamer} <ChevronDown size={11} />
            </button>
          </div>
          <span className={`online-dot ${room.liveStatus === 'live' ? 'is-on' : ''}`} />
        </div>
        <button className="icon-btn" onClick={() => setChatOpen(false)} title="收起互动面板">
          <PanelRightClose size={17} />
        </button>
      </div>

      <div className="chat-tabs">
        {(
          [
            ['all', '全部', counts.all],
            ['chat', '弹幕', counts.chat],
            ['gift', '礼物', counts.gift],
            ['super', '醒目留言', counts.super]
          ] as Array<[Tab, string, number]>
        ).map(([key, label, count]) => (
          <button key={key} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>
            {label}
            {key === 'super' && count > 0 && <i>{count}</i>}
          </button>
        ))}
      </div>

      <div className="chat-list" ref={listRef}>
        {filtered.length === 0 && (
          <div className="chat-list-empty">
            <MessageSquare size={18} />
            <p>{room.liveStatus === 'live' ? '画面已接入，等待第一条弹幕…' : '主播当前未开播'}</p>
            {room.platform === 'direct' && (
              <small>通用直链模式仅提供画面，不解析弹幕。</small>
            )}
          </div>
        )}
        {filtered.map((message) => (
          <ChatRow key={message.id} message={message} />
        ))}
      </div>

      <div className="chat-composer">
        {giftOpen && (
          <div className="composer-popover gift-popover">
            <div className="popover-head">
              <Gift size={15} />
              <strong>礼物与打赏</strong>
              <button onClick={() => setGiftOpen(false)} aria-label="关闭">
                <X size={13} />
              </button>
            </div>
            <p>
              澄幕只展示公开的礼物、舰长与醒目留言数据，<b>不代理充值、不代送礼</b>。打赏请前往官方直播间完成。
            </p>
            <button
              className="btn btn-soft btn-sm"
              onClick={() => void window.clearstage.app.openExternal(room.sourceUrl)}
            >
              打开官方直播间
            </button>
          </div>
        )}

        {historyOpen && (
          <div className="composer-popover history-popover">
            <div className="popover-head">
              <History size={15} />
              <strong>历史与常用</strong>
              <button onClick={() => setHistoryOpen(false)} aria-label="关闭">
                <X size={13} />
              </button>
            </div>
            {history.length === 0 ? (
              <p className="popover-empty">你发送过的弹幕和收藏的常用语会出现在这里。</p>
            ) : (
              <div className="history-list">
                {history.slice(0, 20).map((item) => (
                  <div key={item.id} className="history-item">
                    <button className="history-text" onClick={() => { setText(item.text); setHistoryOpen(false) }}>
                      {item.type === 'favorite' && <Star size={10} fill="currentColor" />}
                      {item.text}
                    </button>
                    <button
                      className="history-star"
                      title="加入常用"
                      onClick={() => void addFavorite(item.text)}
                    >
                      <Star size={11} />
                    </button>
                    <button
                      className="history-remove"
                      title="删除"
                      onClick={() => void removeHistoryItem(item)}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {burstOpen && (
          <div className="composer-popover burst-popover">
            <div className="popover-head">
              <Repeat2 size={15} />
              <strong>连发设置</strong>
              <button onClick={() => setBurstOpen(false)} aria-label="关闭">
                <X size={13} />
              </button>
            </div>
            <div className="burst-options">
              <label>
                <span>次数</span>
                <select value={burstCount} onChange={(event) => setBurstCount(Number(event.target.value))}>
                  {[3, 4, 5, 6, 8, 10, 12, 15].map((value) => (
                    <option key={value} value={value}>{value} 次</option>
                  ))}
                </select>
              </label>
              <label>
                <span>间隔</span>
                <select value={burstGap} onChange={(event) => setBurstGap(Number(event.target.value))}>
                  {[3, 4, 5, 6, 8, 10].map((value) => (
                    <option key={value} value={value}>{value} 秒</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="notice notice-warm compact">
              <AlertTriangle size={13} />
              <p>请遵守直播间规则，勿刷屏。澄幕已限制次数与最小间隔，账号风险由使用者承担。</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => void startBurst()} disabled={!text.trim()}>
              开始连发
            </button>
          </div>
        )}

        {burst.active && (
          <div className="burst-progress">
            <div>
              <Repeat2 size={13} />
              <span>连发中 {burst.sent}/{burst.total}</span>
            </div>
            <i>
              <b style={{ width: `${burst.total ? (burst.sent / burst.total) * 100 : 0}%` }} />
            </i>
            <button onClick={() => { void window.clearstage.danmaku.stopBurst(); setBurst({ ...burst, active: false }) }}>
              停止
            </button>
          </div>
        )}

        {localError && (
          <div className="composer-error">
            <AlertTriangle size={13} /> {localError}
          </div>
        )}

        {!auth.loggedIn && room.platform === 'bilibili' ? (
          <div className="login-prompt">
            <UserRound size={15} />
            <span>登录后才能发送弹幕</span>
            <button onClick={() => setPage('settings')}>去登录</button>
          </div>
        ) : room.platform !== 'bilibili' ? (
          <div className="login-prompt">
            <AlertTriangle size={15} />
            <span>通用直链模式暂不支持互动</span>
            <button onClick={() => void window.clearstage.app.openExternal(room.sourceUrl)}>去官方</button>
          </div>
        ) : (
          <form
            className="composer-box"
            onSubmit={(event) => {
              event.preventDefault()
              void sendMessage()
            }}
          >
            <textarea
              value={text}
              rows={1}
              placeholder={auth.loggedIn ? `和 ${room.streamer} 的直播间说点什么…` : '登录后参与互动…'}
              maxLength={20}
              onChange={(event) => {
                setText(event.target.value)
                setLocalError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
            />
            <div className="composer-tools">
              <div className="composer-tools-left">
                <button type="button" title="历史与常用" onClick={() => setHistoryOpen((value) => !value)}>
                  <History size={15} />
                </button>
                <button type="button" title="收藏为常用弹幕" onClick={() => void addFavorite()}>
                  <Star size={15} />
                </button>
                <button type="button" title="连发设置" onClick={() => setBurstOpen((value) => !value)}>
                  <Repeat2 size={15} />
                </button>
                <button type="button" title="礼物与打赏" onClick={() => setGiftOpen((value) => !value)}>
                  <Gift size={15} />
                </button>
              </div>
              <span className="char-count">{text.length}/20</span>
              <button className="send-btn" type="submit" disabled={!text.trim() || sending}>
                {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
              </button>
            </div>
          </form>
        )}
        <div className="composer-foot">
          <span>Enter 发送</span>
          <span className="composer-safe">
            <Sparkles size={10} /> 本地保存历史
          </span>
        </div>
      </div>
    </aside>
  )
}

function ChatRow({ message }: { message: ChatMessage }) {
  if (message.type === 'system') {
    return (
      <div className="chat-system">
        <span>{message.text}</span>
      </div>
    )
  }
  if (message.type === 'enter') {
    return (
      <div className="chat-enter">
        <span>{message.userName}</span> 进入了直播间
      </div>
    )
  }
  if (message.type === 'like') {
    return (
      <div className="chat-like">
        <span>{message.userName}</span> {message.text}
      </div>
    )
  }
  if (message.type === 'watched') {
    return (
      <div className="chat-watched">
        <Clock3 size={11} /> {message.text}
      </div>
    )
  }
  if (message.type === 'superchat') {
    return (
      <div className="chat-superchat">
        <div className="super-head">
          <span className="mini-avatar">{initials(message.userName)}</span>
          <strong>{message.userName}</strong>
          <b>¥{message.price ?? 0}</b>
        </div>
        <p>{message.text}</p>
      </div>
    )
  }
  if (message.type === 'gift' || message.type === 'guard') {
    return (
      <div className="chat-gift">
        <span className="gift-icon"><Gift size={14} /></span>
        <div>
          <p>
            <b>{message.userName}</b> {message.text}
          </p>
          <small>
            {message.giftCount ? `×${message.giftCount}` : message.guardName}
            {message.price ? ` · 约 ¥${message.price.toFixed(1)}` : ''}
          </small>
        </div>
      </div>
    )
  }
  return (
    <div className={`chat-row ${message.isSelf ? 'is-self' : ''}`}>
      <span className="chat-avatar">{initials(message.userName)}</span>
      <div className="chat-body">
        <div className="chat-meta">
          {message.medal && <span className="medal-chip">{message.medal.name} {message.medal.level}</span>}
          <span className="chat-name">{message.userName}</span>
          {message.isSelf && <span className="self-chip">我</span>}
          <time>{clockTime(message.timestamp)}</time>
        </div>
        <p style={message.color && message.color !== '#ffffff' ? { color: message.color } : undefined}>
          {message.text}
        </p>
      </div>
    </div>
  )
}
