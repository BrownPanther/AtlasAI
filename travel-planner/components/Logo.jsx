export default function Logo({ className = '', height = 36, showText = true }) {
  return (
    <div className={`atlas-stitch-brand-logo flex items-center gap-3 select-none ${className}`}>
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ height, width: height, minWidth: height }}
      >
        <defs>
          <linearGradient id="atlasGradMark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C084FC" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
          <filter id="glowMark" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <g transform="translate(2, 2)">
          <circle cx="16" cy="16" r="14" stroke="url(#atlasGradMark)" strokeWidth="1.8" fill="none" opacity="0.45" />
          <ellipse cx="16" cy="16" rx="14" ry="6" stroke="url(#atlasGradMark)" strokeWidth="1.6" fill="none" transform="rotate(-25 16 16)" />
          <ellipse cx="16" cy="16" rx="6" ry="14" stroke="url(#atlasGradMark)" strokeWidth="1.6" fill="none" transform="rotate(-25 16 16)" opacity="0.65" />
          <circle cx="16" cy="16" r="4.5" fill="url(#atlasGradMark)" filter="url(#glowMark)" />
          <circle cx="25" cy="8" r="1.6" fill="#F472B6" filter="url(#glowMark)" />
        </g>
      </svg>
      {showText && (
        <div className="flex flex-col text-left leading-none">
          <span className="font-bold tracking-tight text-[19px] text-slate-900 dark:text-white flex items-center">
            Atlas<span className="text-purple-600 dark:text-[#C084FC] ml-0.5">AI</span>
          </span>
          <span className="text-[8.5px] font-semibold tracking-[0.22em] text-purple-700/80 dark:text-[#C084FC]/90 uppercase mt-1">
            AI TRAVEL STUDIO
          </span>
        </div>
      )}
    </div>
  )
}
