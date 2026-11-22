import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  CircleStop,
  Clapperboard,
  Clock3,
  Disc3,
  Film,
  FolderOpen,
  HardDrive,
  Loader2,
  Music2,
  Plus,
  RefreshCw,
  Scissors,
  Trash2,
  X
} from 'lucide-react'
import type { Clip, Recording, Song } from '../../../shared/types'
import { useAppStore } from '../store'
import {
  dayLabel,
  errorMessage,
  formatBytes,
  formatDuration,
  formatMoney,
  initials,
  timeAgo,
  uidSalt
} from '../lib/format'

type Tab = 'recordings' | 'clips' | 'songs'

export function RecordingsView() {
  const recordings = useAppStore((state) => state.recordings)
  const clips = useAppStore((state) => state.clips)
  const songs = useAppStore((state) => state.songs)
  const rooms = useAppStore((state) => state.rooms)
  const settings = useAppStore((state) => state.settings)
  const loadLibrary = useAppStore((state) => state.loadLibrary)
  const startRecording = useAppStore((state) => state.startRecording)
  const stopRecording = useAppStore((state) => state.stopRecording)
  const removeRecording = useAppStore((state) => state.removeRecording)
  const removeSong = useAppStore((state) => state.removeSong)
  const info = useAppStore((state) => state.info)
  const toast = useAppStore((state) => state.toast)
  const setPage = useAppStore((state) => state.setPage)
  const [tab, setTab] = useState<Tab>('recordings')
  const [selectedId, setSelectedId] = useState<string | null>(recordings[0]?.id ?? null)
  const [clipTarget, setClipTarget] = useState<Recording | null>(null)
  const [songTarget, setSongTarget] = useState<Recording | null>(null)
  const [recordMenu, setRecordMenu] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void loadLibrary()
  }, [loadLibrary])

  useEffect(() => {
    if (!selectedId && recordings[0]) setSelectedId(recordings[0].id)
    if (selectedId && !recordings.some((item) => item.id === selectedId)) {
      setSelectedId(recordings[0]?.id ?? null)
    }
  }, [recordings, selectedId])

  const selected = recordings.find((item) => item.id === selectedId) ?? recordings[0]
  const selectedClips = clips.filter((item) => item.recordingId === selected?.id)
  const selectedSongs = songs.filter((item) => item.recordingId === selected?.id)
  const totalDuration = recordings.reduce((sum, item) => sum + item.durationSec, 0)
  const totalSize = recordings.reduce((sum, item) => sum + item.sizeBytes, 0)
  const activeRecording = recordings.find((item) => item.status === 'recording')
  const songModeReady = settings.songRecognition.enabled && info?.ffmpegAvailable

  async function handleStart(roomId: string) {
    setRecordMenu(false)
    await startRecording(roomId)
  }

  async function handleReveal(recording: Recording) {
    if (info?.isDemo) {
      toast('info', '演示模式', '正式版会打开录制文件所在文件夹。')
      return
    }
    try {
      await window.clearstage.recordings.reveal(recording.id)
    } catch (error) {
      toast('error', '打开文件夹失败', errorMessage(error))
    }
  }

  async function handleClipReveal(clip: Clip) {
    if (info?.isDemo) {
      toast('info', '演示模式', '正式版会在文件管理器中定位切片。')
      return
    }
    try {
      await window.clearstage.clips.reveal(clip.id)
    } catch (error) {
      toast('error', '定位失败', errorMessage(error))
    }
  }

  async function handleClipDelete(clip: Clip) {
    if (info?.isDemo) {
      toast('info', '演示模式不可删除')
      return
    }
    try {
      await window.clearstage.clips.remove(clip.id)
      useAppStore.setState((state) => ({ clips: state.clips.filter((item) => item.id !== clip.id) }))
      toast('success', '切片已删除')
    } catch (error) {
      toast('error', '删除切片失败', errorMessage(error))
    }
  }

  async function handleSongReveal(song: Song) {
    if (info?.isDemo) {
      toast('info', '演示模式', '正式版会定位到歌曲音频文件。')
      return
    }
    try {
      await window.clearstage.songs.reveal(song.id)
    } catch (error) {
      toast('error', '定位失败', errorMessage(error))
    }
  }

  async function openRecordingsFolder() {
    if (!settings.recordDir) return
    if (info?.isDemo) {
      toast('info', '演示模式', `录制目录示例：${settings.recordDir}`)
      return
    }
    try {
      await window.clearstage.app.showItem(settings.recordDir)
    } catch (error) {
      toast('error', '无法打开目录', errorMessage(error))
    }
  }

  return (
    <section className="view recordings-view">
      <header className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow"><Clapperboard size={12} /> LOCAL ARCHIVE · 录制库</span>
          <h1>
            留下值得
            <span className="head-em">反复看的部分。</span>
          </h1>
          <p>录制、时间线切片、歌曲分轨都在本地完成。没有云端上传，也没有二次压缩。</p>
        </div>
        <div className="page-head-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => void loadLibrary()}>
            <RefreshCw size={14} /> 刷新
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => void openRecordingsFolder()}>
            <FolderOpen size={14} /> 打开目录
          </button>
          <div className="menu-anchor">
            <button className="btn btn-primary btn-sm" onClick={() => setRecordMenu((value) => !value)}>
              <Plus size={15} /> 新建录制
            </button>
            {recordMenu && (
              <div className="dropdown-menu record-menu">
                <div className="dropdown-head">
                  <span>选择直播间</span>
                  <button onClick={() => setRecordMenu(false)} aria-label="关闭"><X size={13} /></button>
                </div>
                {rooms.length === 0 && <p className="dropdown-empty">还没有保存的直播间</p>}
                {rooms.map((room) => (
                  <button key={room.id} className="record-room-row" onClick={() => void handleStart(room.id)}>
                    <span className={`room-dot ${room.liveStatus === 'live' ? 'is-live' : ''}`} />
                    <span>
                      <b>{room.streamer}</b>
                      <small>{room.title}</small>
                    </span>
                    <Plus size={13} />
                  </button>
                ))}
                <button className="dropdown-foot" onClick={() => { setRecordMenu(false); setPage('live') }}>
                  在直播台中操作 <ArrowUpRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="rec-stat-grid">
        <div className="rec-stat">
          <span className="rec-stat-icon"><Film size={17} /></span>
          <div>
            <small>本地录制</small>
            <strong>{recordings.length}<i>段</i></strong>
          </div>
          <span className="rec-stat-note">{formatDuration(totalDuration)}</span>
        </div>
        <div className="rec-stat">
          <span className="rec-stat-icon amber"><HardDrive size={17} /></span>
          <div>
            <small>占用空间</small>
            <strong>{formatBytes(totalSize)}</strong>
          </div>
          <span className="rec-stat-note">本地磁盘</span>
        </div>
        <div className="rec-stat">
          <span className="rec-stat-icon blue"><Scissors size={17} /></span>
          <div>
            <small>切片作品</small>
            <strong>{clips.length}<i>个</i></strong>
          </div>
          <span className="rec-stat-note">精确 / 分段</span>
        </div>
        <div className="rec-stat">
          <span className="rec-stat-icon pink"><Music2 size={17} /></span>
          <div>
            <small>捕获歌曲</small>
            <strong>{songs.length}<i>首</i></strong>
          </div>
          <span className="rec-stat-note">
            {songModeReady ? '自动分轨已开启' : '可在设置中启用'}
          </span>
        </div>
      </div>

      {activeRecording && (
        <div className="active-rec-banner">
          <span className="rec-pulse" />
          <div>
            <strong>正在录制 · {activeRecording.streamer}</strong>
            <p>{activeRecording.roomTitle}</p>
          </div>
          <span className="mono">{formatDuration(activeRecording.durationSec)}</span>
          <span>{formatBytes(activeRecording.sizeBytes)}</span>
          <button className="btn btn-danger btn-sm" onClick={() => void stopRecording(activeRecording.id)}>
            <CircleStop size={14} /> 停止录制
          </button>
        </div>
      )}

      <div className="library-tabs">
        <button className={tab === 'recordings' ? 'is-active' : ''} onClick={() => setTab('recordings')}>
          录制 <span>{recordings.length}</span>
        </button>
        <button className={tab === 'clips' ? 'is-active' : ''} onClick={() => setTab('clips')}>
          切片 <span>{clips.length}</span>
        </button>
        <button className={tab === 'songs' ? 'is-active' : ''} onClick={() => setTab('songs')}>
          歌曲 <span>{songs.length}</span>
        </button>
      </div>

      {tab === 'recordings' && (
        <div className="recordings-layout">
          <div className="recording-list">
            {recordings.length === 0 && (
              <div className="library-empty">
                <Clapperboard size={24} />
                <strong>还没有本地录制</strong>
                <p>在直播画面下方点「录制」，或在右上角新建录制。</p>
              </div>
            )}
            {recordings.map((recording) => (
              <button
                key={recording.id}
                className={`recording-row ${selected?.id === recording.id ? 'is-active' : ''}`}
                onClick={() => setSelectedId(recording.id)}
              >
                <RecordingArt recording={recording} compact />
                <div className="recording-copy">
                  <div className="recording-row-top">
                    <span className={`status-dot-label status-${recording.status}`}>
                      <i />
                      {recording.status === 'recording'
                        ? '录制中'
                        : recording.status === 'processing'
                          ? '处理中'
                          : recording.status === 'completed'
                            ? '已完成'
                            : recording.status === 'failed'
                              ? '失败'
                              : '已中断'}
                    </span>
                    <time>{dayLabel(recording.startedAt)}</time>
                  </div>
                  <strong>{recording.roomTitle}</strong>
                  <p>{recording.streamer} · {recording.quality}</p>
                  <div className="recording-meta">
                    <span><Clock3 size={11} />{formatDuration(recording.durationSec)}</span>
                    <span><HardDrive size={11} />{formatBytes(recording.sizeBytes)}</span>
                    {recording.songMode && <span className="song-mode-chip"><Music2 size={10} /> 分轨</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="recording-detail">
              <RecordingArt recording={selected} />
              <div className="recording-detail-head">
                <div>
                  <span className="eyebrow">RECORDING · {selected.platform === 'bilibili' ? 'BILIBILI' : 'DIRECT'}</span>
                  <h2>{selected.roomTitle}</h2>
                  <p>{selected.streamer} · {selected.quality} · {dayLabel(selected.startedAt)}</p>
                </div>
                <div className="recording-detail-actions">
                  {selected.status === 'recording' ? (
                    <button className="btn btn-danger btn-sm" onClick={() => void stopRecording(selected.id)}>
                      <CircleStop size={14} /> 停止
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-soft btn-sm" onClick={() => setClipTarget(selected)}>
                        <Scissors size={14} /> 切片
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSongTarget(selected)}>
                        <Music2 size={14} /> 标记歌曲
                      </button>
                    </>
                  )}
                  <button className="icon-btn" title="打开文件夹" onClick={() => void handleReveal(selected)}>
                    <FolderOpen size={16} />
                  </button>
                  <button className="icon-btn danger" title="删除" onClick={() => void removeRecording(selected.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="detail-stats">
                <div><small>时长</small><strong>{formatDuration(selected.durationSec)}</strong></div>
                <div><small>大小</small><strong>{formatBytes(selected.sizeBytes)}</strong></div>
                <div><small>分段</small><strong>{selected.segmentCount}<i>段</i></strong></div>
                <div><small>切片</small><strong>{selectedClips.length}<i>个</i></strong></div>
              </div>

              <div className="timeline-block">
                <div className="timeline-head">
                  <span>时间线</span>
                  <small>
                    0:00 — {formatDuration(selected.durationSec, false)}
                    {selected.status === 'recording' && <em> · 实时写入</em>}
                  </small>
                </div>
                <div className="timeline-track">
                  <div className="timeline-wave">
                    {Array.from({ length: 56 }).map((_, index) => (
                      <i
                        key={index}
                        style={{ height: `${28 + ((index * 41 + uidSalt(selected.id)) % 68)}%` }}
                      />
                    ))}
                  </div>
                  {selectedClips.map((clip) => (
                    <span
                      key={clip.id}
                      className="timeline-clip-mark"
                      style={{
                        left: `${Math.max(0, (clip.startSec / Math.max(1, selected.durationSec)) * 100)}%`,
                        width: `${Math.max(0.8, ((clip.endSec - clip.startSec) / Math.max(1, selected.durationSec)) * 100)}%`
                      }}
                      title={clip.title}
                    />
                  ))}
                  <span
                    className="timeline-playhead"
                    style={{
                      left: `${Math.min(100, (selected.durationSec / Math.max(1, selected.durationSec)) * 100)}%`
                    }}
                  />
                </div>
                <div className="timeline-legend">
                  <span><i className="legend-played" /> 已录制</span>
                  <span><i className="legend-clip" /> 切片区间</span>
                  <span className="timeline-note">
                    {settings.ffmpegPath || info?.ffmpegAvailable ? 'FFmpeg 已就绪 · 精确切片' : '未检测到 FFmpeg · 使用分段切片'}
                  </span>
                </div>
              </div>

              {(selectedClips.length > 0 || selectedSongs.length > 0) && (
                <div className="detail-related">
                  <div className="section-title">
                    <Scissors size={14} />
                    <h3>关联切片</h3>
                    <span>{selectedClips.length}</span>
                  </div>
                  <div className="related-list">
                    {selectedClips.map((clip) => (
                      <div key={clip.id} className="related-item">
                        <span className="related-icon"><Film size={13} /></span>
                        <span>
                          <b>{clip.title}</b>
                          <small>{formatDuration(clip.startSec, false)} — {formatDuration(clip.endSec, false)} · {formatBytes(clip.sizeBytes)}</small>
                        </span>
                        <button onClick={() => void handleClipReveal(clip)} title="定位文件"><FolderOpen size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="recording-detail placeholder">
              <span><Clapperboard size={26} /></span>
              <h3>选择一段录制</h3>
              <p>查看时间线、切片与歌曲分轨。</p>
            </div>
          )}
        </div>
      )}

      {tab === 'clips' && (
        <div className="media-grid">
          {clips.length === 0 && (
            <div className="library-empty wide">
              <Scissors size={24} />
              <strong>还没有切片</strong>
              <p>打开一段录制，拖动时间线范围即可导出一个新片段。</p>
            </div>
          )}
          {clips.map((clip) => (
            <article className="clip-card" key={clip.id}>
              <div className={`clip-poster art-${uidSalt(clip.roomId) % 4}`}>
                <div className="clip-poster-lines" />
                <Scissors size={20} />
                <span>{formatDuration(clip.endSec - clip.startSec, false)}</span>
              </div>
              <div className="clip-card-body">
                <div className="clip-card-top">
                  <span className={`method-chip ${clip.method}`}>{clip.method === 'precise' ? '精确切片' : '分段切片'}</span>
                  <span>{timeAgo(clip.createdAt)}</span>
                </div>
                <h3>{clip.title}</h3>
                <p>{clip.roomTitle}</p>
                <div className="clip-card-foot">
                  <span>{formatDuration(clip.startSec, false)} — {formatDuration(clip.endSec, false)}</span>
                  <span>{formatBytes(clip.sizeBytes)}</span>
                  <button onClick={() => void handleClipReveal(clip)} title="定位文件"><FolderOpen size={13} /></button>
                  <button onClick={() => void handleClipDelete(clip)} title="删除"><Trash2 size={13} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'songs' && (
        <>
          <div className="song-banner">
            <div>
              <span className="eyebrow"><Disc3 size={12} /> SONG CAPTURE</span>
              <h3>把直播里的歌，单独留下。</h3>
              <p>
                开启识别服务后，澄幕会自动判断歌曲切换，并把每首歌保存为独立音频。也可以手动标记。
              </p>
            </div>
            <div className="song-banner-side">
              <span className={songModeReady ? 'on' : ''}>{songModeReady ? '自动分轨已就绪' : '自动分轨未启用'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage('settings')}>
                配置识别服务
              </button>
            </div>
          </div>
          <div className="songs-list">
            {songs.length === 0 && (
              <div className="library-empty wide">
                <Music2 size={24} />
                <strong>还没有捕获歌曲</strong>
                <p>在设置中启用 AudD 或 ACRCloud，或从一段录制中手动标记。</p>
              </div>
            )}
            {songs.map((song, index) => (
              <div className="song-row" key={song.id}>
                <span className={`album-art art-${(index + 2) % 4}`}>
                  <Music2 size={19} />
                </span>
                <div className="song-main">
                  <strong>{song.title}</strong>
                  <p>{song.artist}</p>
                </div>
                <div className="song-source">
                  <span>{song.roomTitle}</span>
                  <small>{dayLabel(song.startedAt)}</small>
                </div>
                <span className={`provider-chip ${song.provider}`}>
                  {song.provider === 'manual'
                    ? '手动标记'
                    : song.provider === 'acrcloud'
                      ? 'ACRCloud'
                      : song.provider === 'acoustid'
                        ? 'AcoustID'
                        : song.provider === 'songrec'
                          ? 'SongRec'
                          : 'AudD'}
                  {song.confidence ? ` ${Math.round(song.confidence)}%` : ''}
                </span>
                <span className="song-duration">
                  {song.endedAt ? formatDuration((song.endedAt - song.startedAt) / 1000, false) : '—'}
                </span>
                <div className="song-actions">
                  <button onClick={() => void handleSongReveal(song)} title="定位文件"><FolderOpen size={14} /></button>
                  <button onClick={() => void removeSong(song.id)} title="删除"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {clipTarget && (
        <ClipModal
          recording={clipTarget}
          existingCount={clips.filter((item) => item.recordingId === clipTarget.id).length}
          demo={Boolean(info?.isDemo)}
          onClose={() => setClipTarget(null)}
          onCreated={() => void loadLibrary()}
        />
      )}
      {songTarget && (
        <SongModal
          recording={songTarget}
          demo={Boolean(info?.isDemo)}
          onClose={() => setSongTarget(null)}
          onCreated={() => void loadLibrary()}
        />
      )}
    </section>
  )
}

function RecordingArt({ recording, compact = false }: { recording: Recording; compact?: boolean }) {
  const kind = recording.roomId.includes('arena')
    ? 'arena'
    : recording.roomId.includes('radio')
      ? 'radio'
      : recording.roomId.includes('indie')
        ? 'indie'
        : `art-${uidSalt(recording.roomId) % 4}`
  return (
    <div className={`recording-art ${kind} ${compact ? 'is-compact' : ''}`}>
      <div className="recording-art-grid" />
      <div className="recording-art-glow" />
      <span className="recording-art-type">
        <Film size={compact ? 12 : 14} />
        {recording.platform === 'bilibili' ? 'BILIBILI' : 'DIRECT'}
      </span>
      <span className="recording-art-title">{recording.streamer}</span>
      {!compact && (
        <div className="recording-art-meta">
          <span>{formatDuration(recording.durationSec, false)}</span>
          <span>{recording.quality}</span>
        </div>
      )}
      {recording.status === 'recording' && (
        <span className="recording-art-live"><i /> REC</span>
      )}
    </div>
  )
}

function ClipModal({
  recording,
  existingCount,
  demo,
  onClose,
  onCreated
}: {
  recording: Recording
  existingCount: number
  demo: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const toast = useAppStore((state) => state.toast)
  const [start, setStart] = useState(Math.max(0, Math.round(recording.durationSec * 0.32)))
  const [end, setEnd] = useState(Math.max(1, Math.round(recording.durationSec * 0.52)))
  const [title, setTitle] = useState(`${recording.streamer} · 精彩片段 ${existingCount + 1}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (end - start < 0.5) {
      setError('结束时间需要至少比开始时间晚 0.5 秒')
      return
    }
    if (demo) {
      toast('info', '演示模式', '正式版会从本地录制中导出一个独立切片。')
      onClose()
      return
    }
    setBusy(true)
    setError('')
    try {
      const clips = await window.clearstage.clips.create({
        recordingId: recording.id,
        title,
        segments: [{ startSec: start, endSec: end }]
      })
      const failed = clips.find((item) => item.status === 'failed')
      if (failed) throw new Error(failed.error || '切片失败')
      toast('success', '切片已生成', `${formatDuration(end - start, false)} · ${title}`)
      onCreated()
      onClose()
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal clip-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">CUT FROM TIMELINE</span>
            <h2>从时间线创建切片</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="clip-source-line">
          <RecordingArt recording={recording} compact />
          <div>
            <strong>{recording.roomTitle}</strong>
            <p>{recording.streamer} · 总时长 {formatDuration(recording.durationSec)}</p>
          </div>
        </div>
        <div className="range-visual">
          <div className="range-visual-track">
            <span
              className="range-visual-selection"
              style={{
                left: `${(start / Math.max(1, recording.durationSec)) * 100}%`,
                width: `${((end - start) / Math.max(1, recording.durationSec)) * 100}%`
              }}
            />
            <i style={{ left: `${(start / Math.max(1, recording.durationSec)) * 100}%` }} />
            <i style={{ left: `${(end / Math.max(1, recording.durationSec)) * 100}%` }} />
          </div>
          <div className="range-times">
            <span>{formatDuration(start, false)}</span>
            <span>{formatDuration(end, false)}</span>
          </div>
        </div>
        <label className="field">
          <span>开始时间（秒）</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, recording.durationSec - 0.5)}
            step={0.5}
            value={start}
            onChange={(event) => {
              const value = Number(event.target.value)
              setStart(value)
              if (value >= end) setEnd(Math.min(recording.durationSec, value + 5))
            }}
          />
          <div className="range-input-row">
            <input
              type="number"
              step={0.5}
              value={start}
              onChange={(event) => setStart(Number(event.target.value))}
            />
            <span>秒</span>
          </div>
        </label>
        <label className="field">
          <span>结束时间（秒）</span>
          <input
            type="range"
            min={0.5}
            max={Math.max(1, recording.durationSec)}
            step={0.5}
            value={end}
            onChange={(event) => {
              const value = Number(event.target.value)
              setEnd(value)
              if (value <= start) setStart(Math.max(0, value - 5))
            }}
          />
          <div className="range-input-row">
            <input
              type="number"
              step={0.5}
              value={end}
              onChange={(event) => setEnd(Number(event.target.value))}
            />
            <span>秒</span>
          </div>
        </label>
        <label className="field">
          <span>切片标题</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <div className="clip-summary">
          <span>输出时长 <b>{formatDuration(Math.max(0, end - start), false)}</b></span>
          <span>方式 <b>{useAppStore.getState().info?.ffmpegAvailable ? '精确到帧' : '按分段对齐'}</b></span>
        </div>
        {error && <div className="form-error"><AlertIcon /> {error}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => void create()} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Scissors size={15} />}
            {busy ? '正在导出…' : '生成切片'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SongModal({
  recording,
  demo,
  onClose,
  onCreated
}: {
  recording: Recording
  demo: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const toast = useAppStore((state) => state.toast)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [start, setStart] = useState(Math.max(0, Math.round(recording.durationSec * 0.3)))
  const [end, setEnd] = useState(Math.max(1, Math.round(recording.durationSec * 0.42)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function mark() {
    if (!title.trim()) {
      setError('请填写歌曲名称')
      return
    }
    if (end - start < 5) {
      setError('歌曲片段至少 5 秒')
      return
    }
    if (demo) {
      toast('info', '演示模式', '正式版会导出这段音频并保存为独立歌曲。')
      onClose()
      return
    }
    setBusy(true)
    setError('')
    try {
      await window.clearstage.songs.mark({
        recordingId: recording.id,
        startSec: start,
        endSec: end,
        title: title.trim(),
        artist: artist.trim() || '未知歌手'
      })
      toast('success', '歌曲已保存', `${artist || '未知歌手'} - ${title}`)
      onCreated()
      onClose()
    } catch (markError) {
      setError(errorMessage(markError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal clip-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <span className="eyebrow">MARK A TRACK</span>
            <h2>从录制中标记歌曲</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="notice notice-mint compact">
          <Music2 size={14} />
          <p>需要 FFmpeg 才能导出音频。自动识别可在设置中选择 AudD 或 ACRCloud。</p>
        </div>
        <div className="form-row two">
          <label className="field">
            <span>歌曲名</span>
            <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：深蓝" />
          </label>
          <label className="field">
            <span>歌手</span>
            <input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="例如：陈婧霏" />
          </label>
        </div>
        <div className="form-row two">
          <label className="field">
            <span>开始（秒）</span>
            <input type="number" step={0.5} value={start} onChange={(event) => setStart(Number(event.target.value))} />
          </label>
          <label className="field">
            <span>结束（秒）</span>
            <input type="number" step={0.5} value={end} onChange={(event) => setEnd(Number(event.target.value))} />
          </label>
        </div>
        {error && <div className="form-error"><AlertIcon /> {error}</div>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => void mark()} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Music2 size={15} />}
            {busy ? '正在保存…' : '保存歌曲'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AlertIcon() {
  return <span className="alert-dot">!</span>
}
