import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChartSpline,
  Crown,
  Gift,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users
} from 'lucide-react'
import type { StreamerStats } from '../../../shared/types'
import { useAppStore } from '../store'
import { demoStats } from '../lib/demo'
import { errorMessage, formatMoney, formatNumber, formatDuration } from '../lib/format'

type Metric = 'online' | 'followers'

export function StatsView() {
  const rooms = useAppStore((state) => state.rooms)
  const selectedId = useAppStore((state) => state.selectedId)
  const info = useAppStore((state) => state.info)
  const toast = useAppStore((state) => state.toast)
  const [roomId, setRoomId] = useState(selectedId ?? rooms[0]?.id ?? '')
  const [days, setDays] = useState(7)
  const [stats, setStats] = useState<StreamerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [metric, setMetric] = useState<Metric>('online')

  const room = rooms.find((item) => item.id === roomId) ?? rooms[0]

  useEffect(() => {
    if (!roomId && rooms[0]) setRoomId(rooms[0].id)
  }, [rooms, roomId])

  async function load() {
    if (!room) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      if (info?.isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 350))
        setStats(demoStats(room.id))
      } else {
        const result = await window.clearstage.stats.get(room.id, days)
        setStats(result)
      }
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, days, info?.isDemo])

  async function refresh() {
    if (!room) return
    if (info?.isDemo) {
      toast('info', '演示模式', '实时快照会每 60 秒写入一次。')
      return
    }
    try {
      await window.clearstage.stats.refresh(room.id)
      await load()
      toast('success', '已刷新主播数据快照')
    } catch (refreshError) {
      toast('error', '刷新失败', errorMessage(refreshError))
    }
  }

  const change = useMemo(() => {
    if (!stats || stats.snapshots.length < 2) return 0
    const first = stats.snapshots[0]?.followers ?? 0
    const last = stats.snapshots[stats.snapshots.length - 1]?.followers ?? 0
    return last - first
  }, [stats])

  const points = useMemo(() => {
    if (!stats) return []
    return stats.snapshots
      .map((snapshot) => ({
        t: snapshot.t,
        value: metric === 'online' ? (snapshot.online ?? 0) : (snapshot.followers ?? 0)
      }))
      .filter((point) => point.value > 0)
  }, [stats, metric])

  if (rooms.length === 0) {
    return (
      <section className="view stats-view">
        <header className="page-head">
          <div className="page-head-copy">
            <span className="eyebrow"><ChartSpline size={12} /> CREATOR INSIGHTS · 主播数据</span>
            <h1>看懂一场直播<span className="head-em">真正发生了什么。</span></h1>
          </div>
        </header>
        <div className="library-empty wide stats-empty">
          <Activity size={28} />
          <strong>还没有可分析的主播</strong>
          <p>添加直播间并打开一段时间后，澄幕会记录粉丝、人气和公开礼物事件。</p>
          <button className="btn btn-primary" onClick={() => useAppStore.getState().setAddRoomOpen(true)}>
            添加直播间
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="view stats-view">
      <header className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow"><ChartSpline size={12} /> CREATOR INSIGHTS · 主播数据舱</span>
          <h1>
            看懂一场直播
            <span className="head-em">真正发生了什么。</span>
          </h1>
          <p>粉丝变化、人气曲线、公开礼物与弹幕密度。数据只从你使用澄幕开始记录。</p>
        </div>
        <div className="page-head-actions">
          <div className="select-wrap">
            <select value={room?.id ?? ''} onChange={(event) => setRoomId(event.target.value)}>
              {rooms.map((item) => (
                <option key={item.id} value={item.id}>{item.streamer} · {item.title.slice(0, 12)}</option>
              ))}
            </select>
          </div>
          <div className="layout-switch">
            {[7, 14, 30].map((value) => (
              <button key={value} className={days === value ? 'is-active' : ''} onClick={() => setDays(value)}>
                {value}D
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => void refresh()}>
            <RefreshCw size={14} /> 刷新
          </button>
        </div>
      </header>

      {loading ? (
        <div className="stats-loading">
          <Loader2 size={24} className="spin" />
          <p>正在整理数据快照…</p>
        </div>
      ) : error ? (
        <div className="callout-error">
          <Activity size={22} />
          <div>
            <strong>数据暂时没有接上</strong>
            <p>{error}</p>
            <button className="btn btn-soft btn-sm" onClick={() => void load()}>重试</button>
          </div>
        </div>
      ) : stats ? (
        <>
          <div className="stats-hero">
            <div className="profile-stat-card">
              <div className="profile-stat-head">
                <span className="profile-avatar">{room?.avatar ? <img src={room.avatar} alt="" /> : room?.streamer.slice(0, 1)}</span>
                <div>
                  <span className="eyebrow">{stats.platform === 'bilibili' ? 'BILIBILI' : 'DIRECT'} · {room?.area ?? '直播间'}</span>
                  <h2>{room?.streamer}</h2>
                  <p>{stats.title}</p>
                </div>
              </div>
              <div className="follower-number">
                <div>
                  <span>粉丝数</span>
                  <strong>{formatNumber(stats.followers)}</strong>
                </div>
                <span className={`delta-chip ${change >= 0 ? 'up' : 'down'}`}>
                  {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {change >= 0 ? '+' : ''}{formatNumber(change)}
                  <small>{days} 天</small>
                </span>
              </div>
              <div className="profile-mini-stats">
                <div><span>当前人气</span><b>{formatNumber(stats.online)}</b></div>
                <div><span>今日礼物估算</span><b>{formatMoney(stats.todayGiftValue)}</b></div>
                <div><span>最高人气</span><b>{formatNumber(stats.peakOnline)}</b></div>
              </div>
            </div>

            <div className="metric-cards">
              <div className="metric-card">
                <span className="metric-icon mint"><Users size={17} /></span>
                <div><small>记录粉丝</small><strong>{formatNumber(stats.followers)}</strong></div>
                <span className="metric-foot">最近一次快照</span>
              </div>
              <div className="metric-card">
                <span className="metric-icon amber"><Gift size={17} /></span>
                <div><small>礼物估算</small><strong>{formatMoney(stats.totalGiftValue)}</strong></div>
                <span className="metric-foot">{days} 天公开礼物</span>
              </div>
              <div className="metric-card">
                <span className="metric-icon blue"><MessageSquare size={17} /></span>
                <div><small>互动弹幕</small><strong>{formatNumber(stats.messages)}</strong></div>
                <span className="metric-foot">含礼物与醒目留言</span>
              </div>
              <div className="metric-card">
                <span className="metric-icon pink"><Crown size={17} /></span>
                <div><small>观看时长</small><strong>{formatDuration(stats.daily.reduce((sum, item) => sum + item.secondsWatched, 0), false)}</strong></div>
                <span className="metric-foot">澄幕内观看</span>
              </div>
            </div>
          </div>

          <div className="analytics-grid">
            <div className="chart-card wide">
              <div className="chart-head">
                <div>
                  <span className="eyebrow"><TrendingUp size={12} /> TREND</span>
                  <h3>{metric === 'online' ? '实时人气曲线' : '粉丝增长曲线'}</h3>
                </div>
                <div className="chart-toggle">
                  <button className={metric === 'online' ? 'is-active' : ''} onClick={() => setMetric('online')}>人气</button>
                  <button className={metric === 'followers' ? 'is-active' : ''} onClick={() => setMetric('followers')}>粉丝</button>
                </div>
              </div>
              {points.length > 1 ? (
                <TrendChart points={points} metric={metric} />
              ) : (
                <div className="chart-empty">
                  <Activity size={20} />
                  <p>打开直播间并保持澄幕运行，几分钟后会出现曲线。</p>
                </div>
              )}
              <div className="chart-foot">
                <span><i className="dot mint" /> {metric === 'online' ? '在线人气' : '粉丝数'}</span>
                <span>采样间隔约 1 分钟</span>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <div>
                  <span className="eyebrow"><Gift size={12} /> GIFTS</span>
                  <h3>礼物构成</h3>
                </div>
                <span className="muted-caption">公开事件估算</span>
              </div>
              <div className="gift-bars">
                {stats.topGifts.length === 0 && <p className="chart-empty-inline">还没有收到公开礼物事件</p>}
                {stats.topGifts.map((gift, index) => {
                  const max = stats.topGifts[0]?.value || 1
                  return (
                    <div className="gift-bar-row" key={gift.name}>
                      <span className="gift-rank">{String(index + 1).padStart(2, '0')}</span>
                      <div className="gift-bar-main">
                        <div><b>{gift.name}</b><span>{gift.count} 次</span><em>{formatMoney(gift.value)}</em></div>
                        <i><b style={{ width: `${Math.max(4, (gift.value / max) * 100)}%` }} /></i>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="chart-foot">
                <span><Sparkles size={11} /> 不代理充值或送礼</span>
              </div>
            </div>

            <div className="chart-card wide">
              <div className="chart-head">
                <div>
                  <span className="eyebrow"><Activity size={12} /> DAILY</span>
                  <h3>近 {days} 天直播日概览</h3>
                </div>
                <span className="muted-caption">按本地日期汇总</span>
              </div>
              <DailyBars stats={stats} />
            </div>

            <div className="chart-card">
              <div className="chart-head">
                <div>
                  <span className="eyebrow"><Crown size={12} /> TOP MOMENTS</span>
                  <h3>本场高光</h3>
                </div>
              </div>
              <div className="highlight-list">
                <div><span className="highlight-index">01</span><p>最高人气<br /><b>{formatNumber(stats.peakOnline)}</b></p></div>
                <div><span className="highlight-index">02</span><p>今日礼物<br /><b>{formatMoney(stats.todayGiftValue)}</b></p></div>
                <div><span className="highlight-index">03</span><p>弹幕总数<br /><b>{formatNumber(stats.messages)}</b></p></div>
              </div>
              <div className="disclaimer-box">{stats.disclaimer}</div>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}

function TrendChart({ points, metric }: { points: Array<{ t: number; value: number }>; metric: Metric }) {
  const width = 800
  const height = 230
  const pad = { left: 46, right: 18, top: 22, bottom: 30 }
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom
  const coords = points.map((point, index) => ({
    x: pad.left + (index / Math.max(1, points.length - 1)) * innerW,
    y: pad.top + (1 - (point.value - min) / range) * innerH,
    ...point
  }))
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${height - pad.bottom} L${coords[0].x.toFixed(1)},${height - pad.bottom} Z`
  const labels = [0, 0.5, 1].map((ratio) => Math.round(min + range * ratio))
  const timeLabels = [0, Math.floor(points.length / 2), points.length - 1].map((index) => {
    const date = new Date(points[index].t)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  })

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={metric === 'online' ? '人气趋势图' : '粉丝趋势图'}>
        <defs>
          <linearGradient id="chart-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {labels.map((label, index) => {
          const y = pad.top + (1 - index / 2) * innerH
          return (
            <g key={label}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="var(--line)" strokeDasharray="3 7" />
              <text x={pad.left - 10} y={y + 4} textAnchor="end" className="chart-axis">{formatNumber(label)}</text>
            </g>
          )
        })}
        <path d={area} fill="url(#chart-area)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.2" filter="url(#line-glow)" strokeLinecap="round" />
        {coords.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r={index === coords.length - 1 ? 4 : 0} fill="var(--accent)" stroke="var(--bg)" strokeWidth="2" />
        ))}
        {timeLabels.map((label, index) => (
          <text
            key={`${label}-${index}`}
            x={index === 0 ? pad.left : index === 1 ? width / 2 : width - pad.right}
            y={height - 8}
            textAnchor={index === 0 ? 'start' : index === 1 ? 'middle' : 'end'}
            className="chart-axis"
          >
            {label}
          </text>
        ))}
        <text x={width - pad.right} y={pad.top - 6} textAnchor="end" className="chart-axis">
          {metric === 'online' ? '在线人气' : '粉丝数'}
        </text>
      </svg>
    </div>
  )
}

function DailyBars({ stats }: { stats: StreamerStats }) {
  const daily = stats.daily.slice(-7)
  const maxGift = Math.max(...daily.map((item) => item.giftValue), 1)
  const maxMessages = Math.max(...daily.map((item) => item.messages), 1)
  return (
    <div className="daily-bars">
      {daily.map((day) => (
        <div className="daily-col" key={day.date}>
          <div className="daily-col-bars">
            <i
              className="daily-bar gifts"
              style={{ height: `${Math.max(4, (day.giftValue / maxGift) * 100)}%` }}
              title={`礼物 ${formatMoney(day.giftValue)}`}
            />
            <i
              className="daily-bar messages"
              style={{ height: `${Math.max(4, (day.messages / maxMessages) * 100)}%` }}
              title={`弹幕 ${day.messages}`}
            />
          </div>
          <span>{day.date.slice(5)}</span>
        </div>
      ))}
      <div className="daily-legend">
        <span><i className="gifts" /> 礼物估算</span>
        <span><i className="messages" /> 弹幕量</span>
      </div>
    </div>
  )
}
