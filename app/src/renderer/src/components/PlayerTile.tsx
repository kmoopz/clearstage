import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import mpegts from 'mpegts.js'
import {
  Captions,
  CaptionsOff,
  CircleStop,
  Expand,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Signal,
  Square,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import type { ChatMessage, PlaybackInfo, Room } from '../../../shared/types'
import { useAppStore } from '../store'
import { errorMessage, formatNumber, uidSalt } from '../lib/format'
import { DemoStage } from './DemoStage'

const DEMO_QUALITIES = [
  { quality: 10000, label: '原画' },
  { quality: 400, label: '蓝光' },
  { quality: 250, label: '超清' }
]

const EMPTY_MESSAGES: ChatMessage[] = []

const OVERLAY_POSITIONS = [14, 33, 53, 71]

export function PlayerTile({ room }: { room: Room }) {
  const selectedId = useAppStore((state) => state.selectedId)
  const setSelected = useAppStore((state) => state.setSelected)
  const setChatOpen = useAppStore((state) => state.setChatOpen)
  const roomMessages = useAppStore((state) => state.messages[room.id])
  const messages = roomMessages ?? EMPTY_MESSAGES
  const settings = useAppStore((state) => state.settings)
  const recordings = useAppStore((state) => state.recordings)
  const recordingBusy = useAppStore((state) => state.recordingBusy[room.id] ?? false)
  const startRecording = useAppStore((state) => state.startRecording)
  const stopRecording = useAppStore((state) => state.stopRecording)
  const toggleRoom = useAppStore((state) => state.toggleRoom)
  const refreshRoom = useAppStore((state) => state.refreshRoom)
  const toast = useAppStore((state) => state.toast)
  const [info, setInfo] = useState<PlaybackInfo | null>(null)
  const [quality, setQuality] = useState(String(settings.defaultQuality))
  const [loading, setLoading] = useState(!room.isDemo)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [volume, setVolume] = useState(0.72)
  const [danmakuOn, setDanmakuOn] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [connection, setConnection] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const recording = recordings.find((item) => item.roomId === room.roomId && item.status === 'recording')
  const selected = selectedId === room.id

  useEffect(() => {
    if (room.isDemo) return
    let alive = true
    setConnection('connecting')
    window.clearstage.danmaku
      .connect(room.id)
      .then((result) => {
        if (!alive) return
        setConnection(result.connected ? 'connected' : 'error')
        if (!result.connected && result.message) setError((current) => current || result.message || '')
      })
      .catch(() => alive && setConnection('error'))
    return () => {
      alive = false
      void window.clearstage.danmaku.disconnect(room.id)
    }
  }, [room.id, room.isDemo])

  useEffect(() => {
    if (room.isDemo) {
      setLoading(false)
      return
    }
    let disposed = false
    let hls: Hls | undefined
    let flv: ReturnType<typeof mpegts.createPlayer> | undefined
    const video = videoRef.current
    setLoading(true)
    setError('')

    async function setup() {
      try {
        const playback = await window.clearstage.player.resolve(room.id, Number(quality))
        if (disposed) return
        setInfo(playback)
        const variant = playback.variants[0]
        if (!variant || !video) {
          setLoading(false)
          setError(playback.hint || '直播间当前没有可用画面')
          return
        }
        video.muted = true
        if (variant.protocol === 'hls') {
          if (Hls.isSupported()) {
            hls = new Hls({
              enableWorker: true,
              lowLatencyMode: true,
              backBufferLength: 30,
              liveSyncDurationCount: 3,
              maxLiveSyncPlaybackRate: 1.25
            })
            hls.loadSource(variant.url)
            hls.attachMedia(video)
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              void video.play().catch(() => undefined)
            })
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data.fatal) return
              if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                hls?.startLoad()
              } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                hls?.recoverMediaError()
              } else {
                setError('直播流中断，请点击刷新重连')
                setLoading(false)
              }
            })
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = variant.url
            void video.play().catch(() => undefined)
          } else {
            setError('当前系统不支持 HLS 播放')
            setLoading(false)
          }
        } else if (mpegts.isSupported()) {
          flv = mpegts.createPlayer(
            { type: 'flv', isLive: true, url: variant.url, hasAudio: true, hasVideo: true },
            {
              enableStashBuffer: false,
              liveBufferLatencyChasing: true,
              lazyLoad: false
            }
          )
          flv.attachMediaElement(video)
          flv.on(mpegts.Events.ERROR, () => {
            setError('FLV 直播流中断，请点击刷新重连')
            setLoading(false)
          })
          flv.load()
          try {
            flv.play()
          } catch {
            // Autoplay may be blocked until the user interacts.
          }
        } else {
          video.src = variant.url
          void video.play().catch(() => undefined)
        }
      } catch (playbackError) {
        if (disposed) return
        setError(errorMessage(playbackError))
        setLoading(false)
      }
    }
    void setup()
    return () => {
      disposed = true
      hls?.destroy()
      if (flv) {
        try {
          flv.pause()
          flv.unload()
          flv.detachMediaElement()
          flv.destroy()
        } catch {
          // ignore
        }
      }
      if (video) {
        video.removeAttribute('src')
        video.load()
      }
    }
  }, [room.id, room.isDemo, quality, retryKey])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = muted
    video.volume = volume
  }, [muted, volume])

  useEffect(() => {
    const handler = (): void => setFullscreen(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  function togglePlay() {
    const video = videoRef.current
    if (!video || room.isDemo) return
    if (video.paused) void video.play()
    else video.pause()
  }

  async function toggleFullscreen() {
    if (!stageRef.current) return
    if (document.fullscreenElement) await document.exitFullscreen()
    else await stageRef.current.requestFullscreen()
  }

  function handleRecord() {
    if (recording) {
      void stopRecording(recording.id)
    } else {
      if (room.liveStatus !== 'live') {
        toast('warning', '主播当前不在直播', '开播后再开始录制。')
        return
      }
      void startRecording(room.id)
    }
  }

  const overlayMessages = messages
    .filter((message) => {
      if (message.type === 'chat' || message.type === 'superchat') return true
      if (message.type === 'gift') return settings.danmaku.showGifts
      if (message.type === 'guard') return true
      return false
    })
    .slice(room.isDemo ? -4 : -9)

  return (
    <article
      className={`player-tile ${selected ? 'is-selected' : ''} ${fullscreen ? 'is-fullscreen' : ''}`}
      onClick={() => setSelected(room.id)}
    >
      <div className="player-stage" ref={stageRef}>
        <video
          ref={videoRef}
          className={`player-video ${room.isDemo ? 'is-hidden' : ''}`}
          playsInline
          muted={muted}
          onLoadedData={() => {
            setLoading(false)
            setPaused(false)
          }}
          onPlaying={() => {
            setLoading(false)
            setPaused(false)
          }}
          onPause={() => setPaused(true)}
          onError={() => {
            if (!room.isDemo && info) {
              setError('画面加载失败，可能是直播流已过期')
              setLoading(false)
            }
          }}
          onClick={(event) => {
            event.stopPropagation()
            togglePlay()
          }}
        />
        {room.isDemo && <DemoStage room={room} />}
        {!room.isDemo && !loading && !error && (
          <div className="video-vignette" />
        )}

        <div className="player-topbar">
          <div className="player-badges">
            <span className={`live-badge ${room.liveStatus === 'live' ? 'is-live' : ''}`}>
              <i />
              {room.liveStatus === 'live' ? 'LIVE' : room.liveStatus === 'replay' ? '轮播' : '离线'}
            </span>
            {room.isDemo && <span className="demo-badge">DEMO</span>}
            <span className="viewer-badge">
              <Signal size={11} />
              {formatNumber(room.viewerCount)} 人在看
            </span>
          </div>
          <div className="player-actions">
            <button
              className={`glass-btn ${danmakuOn ? 'is-on' : ''}`}
              title={danmakuOn ? '关闭弹幕层' : '开启弹幕层'}
              onClick={(event) => {
                event.stopPropagation()
                setDanmakuOn((value) => !value)
              }}
            >
              {danmakuOn ? <Captions size={15} /> : <CaptionsOff size={15} />}
            </button>
            <button
              className="glass-btn"
              title="刷新直播间"
              onClick={(event) => {
                event.stopPropagation()
                setRetryKey((value) => value + 1)
                void refreshRoom(room.id)
              }}
            >
              <RefreshCw size={14} />
            </button>
            <button
              className="glass-btn"
              title="打开互动面板"
              onClick={(event) => {
                event.stopPropagation()
                setSelected(room.id)
                setChatOpen(true)
              }}
            >
              <MessageSquare size={14} />
            </button>
            <button
              className="glass-btn glass-btn-close"
              title="从直播台移除"
              onClick={(event) => {
                event.stopPropagation()
                toggleRoom(room.id)
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="player-title-overlay">
          <div className="player-title-copy">
            <span>{room.streamer}{room.area ? ` · ${room.area}` : ''}</span>
            <h3>{room.title}</h3>
          </div>
        </div>

        {danmakuOn && (
          <div
            className="danmaku-overlay"
            style={{ opacity: settings.danmaku.opacity, fontSize: settings.danmaku.fontSize }}
          >
            {overlayMessages.map((message, index) => (
              <DanmakuLine
                key={message.id}
                message={message}
                top={room.isDemo ? OVERLAY_POSITIONS[index % OVERLAY_POSITIONS.length] : 10 + (uidSalt(message.id) % 66)}
                still={Boolean(room.isDemo)}
              />
            ))}
          </div>
        )}

        {loading && (
          <div className="player-loading">
            <span className="loading-orbit">
              <Loader2 size={21} className="spin" />
            </span>
            <p>正在接入纯净流</p>
            <small>解析播放地址 · 同步弹幕频道</small>
          </div>
        )}

        {error && !loading && (
          <div className="player-error">
            <span className="error-icon">
              <Radio size={20} />
            </span>
            <strong>画面暂时不可用</strong>
            <p>{error}</p>
            <div>
              <button className="btn btn-primary btn-sm" onClick={() => setRetryKey((value) => value + 1)}>
                <RefreshCw size={13} /> 重新连接
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => void window.clearstage.app.openExternal(room.sourceUrl)}
              >
                打开官方直播间
              </button>
            </div>
          </div>
        )}

        {!room.isDemo && paused && !loading && !error && (
          <button
            className="play-overlay"
            onClick={(event) => {
              event.stopPropagation()
              togglePlay()
            }}
            aria-label="播放"
          >
            <Play size={26} fill="currentColor" />
          </button>
        )}

        <div className="player-controls">
          <button
            className="ctrl-btn"
            title={muted ? '取消静音' : '静音'}
            onClick={(event) => {
              event.stopPropagation()
              setMuted((value) => !value)
            }}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            className="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(event) => {
              setVolume(Number(event.target.value))
              setMuted(Number(event.target.value) === 0)
            }}
            onClick={(event) => event.stopPropagation()}
            aria-label="音量"
          />
          <div className="control-divider" />
          <button
            className="ctrl-btn"
            title={paused ? '播放' : '暂停'}
            onClick={(event) => {
              event.stopPropagation()
              togglePlay()
            }}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <div className="control-spacer" />
          <span className={`danmaku-health ${connection === 'connected' || room.isDemo ? 'ok' : connection === 'error' ? 'bad' : ''}`}>
            <i /> 弹幕{connection === 'connected' || room.isDemo ? '在线' : connection === 'error' ? '受限' : '连接中'}
          </span>
          <select
            className="quality-select"
            value={quality}
            onChange={(event) => {
              event.stopPropagation()
              setQuality(event.target.value)
            }}
            onClick={(event) => event.stopPropagation()}
            title="画质"
          >
            {(info?.qualities?.length ? info.qualities : DEMO_QUALITIES).map((item) => (
              <option key={item.quality} value={String(item.quality)}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            className={`ctrl-btn record-btn ${recording ? 'is-recording' : ''}`}
            title={recording ? '停止录制' : '开始录制'}
            disabled={recordingBusy}
            onClick={(event) => {
              event.stopPropagation()
              handleRecord()
            }}
          >
            {recordingBusy ? (
              <Loader2 size={14} className="spin" />
            ) : recording ? (
              <CircleStop size={16} />
            ) : (
              <span className="record-dot" />
            )}
            <span>{recording ? '停止' : '录制'}</span>
          </button>
          <button
            className="ctrl-btn"
            title={fullscreen ? '退出全屏' : '全屏'}
            onClick={(event) => {
              event.stopPropagation()
              void toggleFullscreen()
            }}
          >
            {fullscreen ? <Square size={14} /> : <Expand size={15} />}
          </button>
        </div>

        {recording && (
          <div className="recording-flag">
            <i />
            REC {recording.durationSec > 0 ? formatRecordingDuration(recording.durationSec) : '00:00'}
          </div>
        )}
      </div>
    </article>
  )
}

function DanmakuLine({
  message,
  top,
  still
}: {
  message: ChatMessage
  top: number
  still: boolean
}) {
  return (
    <div
      className={`dm-line ${still ? 'is-still' : ''} ${message.type === 'superchat' ? 'is-super' : ''} ${message.type === 'gift' || message.type === 'guard' ? 'is-gift' : ''}`}
      style={{ top: `${top}%` }}
    >
      {message.medal && <span className="dm-medal">{message.medal.name}</span>}
      {message.type === 'gift' || message.type === 'guard' ? (
        <span>
          <b>{message.userName}</b> {message.text}
        </span>
      ) : message.type === 'superchat' ? (
        <span>
          <b>{message.userName}</b>：{message.text}
        </span>
      ) : (
        <span>
          <b>{message.userName}</b>：{message.text}
        </span>
      )}
    </div>
  )
}

function formatRecordingDuration(seconds: number): string {
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
