export function BrandMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cs-mark" x1="7" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9CFFE0" />
          <stop offset="0.52" stopColor="#70F0C0" />
          <stop offset="1" stopColor="#34B894" />
        </linearGradient>
      </defs>
      <rect x="2.2" y="2.2" width="35.6" height="35.6" rx="11.2" stroke="url(#cs-mark)" strokeWidth="1.5" opacity="0.42" />
      <path
        d="M11 12.4C11 10.9 12.2 9.7 13.7 9.7H26.3C27.8 9.7 29 10.9 29 12.4V27.6C29 29.1 27.8 30.3 26.3 30.3H13.7C12.2 30.3 11 29.1 11 27.6V12.4Z"
        fill="url(#cs-mark)"
        fillOpacity="0.09"
        stroke="url(#cs-mark)"
        strokeWidth="1.3"
      />
      <path d="M17 14.8L25.8 20L17 25.2V14.8Z" fill="url(#cs-mark)" />
      <path d="M7.8 20H10.4M29.6 20H32.2" stroke="#70F0C0" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <circle cx="33.2" cy="7.2" r="2" fill="#FFC978" />
    </svg>
  )
}

export function BrandWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-wordmark ${compact ? 'is-compact' : ''}`}>
      <div className="brand-name">
        澄幕<span>ClearStage</span>
      </div>
      {!compact && <div className="brand-sub">纯净直播工作台</div>}
    </div>
  )
}
