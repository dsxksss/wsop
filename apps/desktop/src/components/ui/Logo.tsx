/** 中性字母标识（无任何模板 IP）。高科技线条感设计：几何六角框 + 霓虹渐变 W + 动态刻度环。 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center shrink-0 select-none relative"
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full drop-shadow-[0_2px_8px_rgba(16,185,129,0.25)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" /> {/* emerald-500 */}
            <stop offset="50%" stopColor="#34d399" /> {/* emerald-400 */}
            <stop offset="100%" stopColor="#06b6d4" /> {/* cyan-500 */}
          </linearGradient>
          <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 外层细线六角边框 */}
        <polygon
          points="50,5 89,27.5 89,72.5 50,95 11,72.5 11,27.5"
          className="stroke-zinc-800/80"
          strokeWidth="2"
        />

        {/* 背景慢速旋转刻度虚线圆环 */}
        <circle
          cx="50"
          cy="50"
          r="38"
          className="stroke-emerald-500/20"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          style={{
            transformOrigin: "50px 50px",
            animation: "spin 25s linear infinite",
          }}
        />

        {/* 霓虹发光 W 渐变主路径 */}
        <path
          d="M 28 32 L 41 72 L 50 48 L 59 72 L 72 32"
          stroke="url(#logo-grad)"
          strokeWidth="6.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#logo-glow)"
        />

        {/* 内部高亮白色高光反射线 */}
        <path
          d="M 30.5 33 L 41 68 L 50 49 L 59 68 L 69.5 33"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.75"
        />

        {/* 节点端点（代表运维服务器/网络节点） */}
        <circle cx="28" cy="32" r="4.5" fill="#10b981" filter="url(#logo-glow)" />
        <circle cx="41" cy="72" r="4.5" fill="#06b6d4" filter="url(#logo-glow)" />
        <circle cx="50" cy="48" r="4" fill="#10b981" filter="url(#logo-glow)" />
        <circle cx="59" cy="72" r="4.5" fill="#06b6d4" filter="url(#logo-glow)" />
        <circle cx="72" cy="32" r="4.5" fill="#10b981" filter="url(#logo-glow)" />
      </svg>
    </div>
  );
}

