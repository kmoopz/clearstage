import type { Room } from '../../../shared/types'
import { Radio, Music2, Gamepad2, AudioLines } from 'lucide-react'

export function DemoStage({ room }: { room: Room }) {
  if (room.id.includes('radio')) {
    return (
      <div className="demo-stage stage-radio">
        <div className="stage-noise" />
        <div className="radio-rings">
          <span />
          <span />
          <span />
        </div>
        <div className="radio-disc">
          <div className="disc-label">
            <Music2 size={22} />
            <b>NIGHT<br />FREQUENCY</b>
            <small>FM 98.7 · 23:00</small>
          </div>
        </div>
        <div className="stage-radio-copy">
          <span>LIVE SESSION · 深夜电台</span>
          <h2>把城市<br />唱给你听</h2>
          <p>林澈 · 不插电现场</p>
        </div>
        <div className="waveform">
          {Array.from({ length: 28 }).map((_, index) => (
            <i key={index} style={{ animationDelay: `${index * 70}ms`, height: `${18 + ((index * 37) % 70)}%` }} />
          ))}
        </div>
      </div>
    )
  }
  if (room.id.includes('indie')) {
    return (
      <div className="demo-stage stage-indie">
        <div className="stage-noise" />
        <div className="pixel-sun" />
        <div className="pixel-grid" />
        <div className="floating-cube cube-a" />
        <div className="floating-cube cube-b" />
        <div className="floating-cube cube-c" />
        <div className="stage-indie-copy">
          <span><Gamepad2 size={13} /> FIRST LOOK · 全球首发</span>
          <h2>像素旅馆</h2>
          <p>独立游戏试玩 · 第 2 夜</p>
          <div className="indie-tags">
            <b>叙事</b><b>解谜</b><b>像素</b>
          </div>
        </div>
        <div className="indie-score">
          <small>STEAM 愿望单</small>
          <strong>+ 4,208</strong>
        </div>
      </div>
    )
  }
  return (
    <div className="demo-stage stage-arena">
      <div className="stage-noise" />
      <div className="arena-grid" />
      <div className="arena-beam beam-left" />
      <div className="arena-beam beam-right" />
      <div className="arena-orb" />
      <div className="arena-copy">
        <span><Radio size={12} /> GRAND FINAL · 2026</span>
        <h2>最后一局<br /><em>LAST GAME</em></h2>
        <p>二路解说席 · 澄幕放映室</p>
      </div>
      <div className="arena-scoreboard">
        <div><span>TEAM A</span><strong>2</strong></div>
        <i>:</i>
        <div><span>TEAM B</span><strong>2</strong></div>
        <small>GAME 5 · 23:48</small>
      </div>
      <div className="arena-crowd">
        {Array.from({ length: 46 }).map((_, index) => (
          <span key={index} style={{ left: `${(index * 17) % 100}%`, bottom: `${(index * 31) % 24}%`, animationDelay: `${index * 120}ms` }} />
        ))}
      </div>
      <div className="arena-signal">
        <AudioLines size={13} />
        <span>PURE SIGNAL</span>
      </div>
    </div>
  )
}
