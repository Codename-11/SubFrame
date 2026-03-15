import { useState, useRef, useEffect, useCallback } from "react"
import { motion, useInView } from "motion/react"
import { LineShadowText } from "@/components/ui/line-shadow-text"

/* ------------------------------------------------------------------ */
/*  1. Structure Map                                                   */
/* ------------------------------------------------------------------ */

function StructureMap() {
  const [view, setView] = useState<"graph" | "mindmap">("graph")

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 p-3 pb-0">
        {(["graph", "mindmap"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1 font-mono text-xs transition-colors ${
              view === v
                ? "bg-accent-purple/15 text-accent-purple"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {v === "graph" ? "Graph" : "Mindmap"}
          </button>
        ))}
      </div>

      <div className="aspect-[4/3] p-3">
        {view === "graph" ? (
          <svg viewBox="0 0 200 130" fill="none" className="h-full w-full">
            {/* Connection lines */}
            <line x1="100" y1="35" x2="55" y2="85" stroke="#a855f7" strokeWidth="1" opacity="0.4" />
            <line x1="100" y1="35" x2="145" y2="85" stroke="#e040a0" strokeWidth="1" opacity="0.4" />
            <line x1="55" y1="85" x2="145" y2="85" stroke="#38d9f5" strokeWidth="1" opacity="0.4" strokeDasharray="3 2" />
            <line x1="100" y1="35" x2="100" y2="115" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" opacity="0.3" />
            {/* main node */}
            <circle cx="100" cy="35" r="16" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth="1.5">
              <animate attributeName="r" values="16;17.5;16" dur="3s" repeatCount="indefinite" />
            </circle>
            <text x="100" y="38" fill="#f59e0b" fontSize="7" fontFamily="var(--font-mono)" textAnchor="middle">main</text>
            {/* renderer node */}
            <circle cx="55" cy="85" r="13" fill="rgba(168,85,247,0.15)" stroke="#a855f7" strokeWidth="1.5">
              <animate attributeName="r" values="13;14.5;13" dur="3.5s" repeatCount="indefinite" />
            </circle>
            <text x="55" y="88" fill="#a855f7" fontSize="6.5" fontFamily="var(--font-mono)" textAnchor="middle">renderer</text>
            {/* shared node */}
            <circle cx="145" cy="85" r="11" fill="rgba(56,217,245,0.15)" stroke="#38d9f5" strokeWidth="1.5">
              <animate attributeName="r" values="11;12.5;11" dur="4s" repeatCount="indefinite" />
            </circle>
            <text x="145" y="88" fill="#38d9f5" fontSize="6.5" fontFamily="var(--font-mono)" textAnchor="middle">shared</text>
            {/* utils node */}
            <circle cx="100" cy="115" r="8" fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth="1">
              <animate attributeName="r" values="8;9;8" dur="3.8s" repeatCount="indefinite" />
            </circle>
            <text x="100" y="118" fill="#22c55e" fontSize="5.5" fontFamily="var(--font-mono)" textAnchor="middle">utils</text>
          </svg>
        ) : (
          <svg viewBox="0 0 200 130" fill="none" className="h-full w-full">
            {/* Center node */}
            <circle cx="100" cy="65" r="18" fill="rgba(224,64,160,0.12)" stroke="#e040a0" strokeWidth="1.5">
              <animate attributeName="r" values="18;19.5;18" dur="3s" repeatCount="indefinite" />
            </circle>
            <text x="100" y="63" fill="#e040a0" fontSize="5.5" fontFamily="var(--font-mono)" textAnchor="middle">SubFrame</text>
            <text x="100" y="71" fill="var(--color-text-tertiary)" fontSize="4" fontFamily="var(--font-mono)" textAnchor="middle">root</text>
            {/* Branch lines */}
            <path d="M118,60 Q140,40 160,30" stroke="#f59e0b" strokeWidth="1" fill="none" opacity="0.5" />
            <path d="M118,70 Q140,90 160,100" stroke="#a855f7" strokeWidth="1" fill="none" opacity="0.5" />
            <path d="M82,60 Q60,40 40,30" stroke="#38d9f5" strokeWidth="1" fill="none" opacity="0.5" />
            <path d="M82,70 Q60,90 40,100" stroke="#22c55e" strokeWidth="1" fill="none" opacity="0.5" />
            {/* Branch nodes */}
            <circle cx="165" cy="28" r="10" fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="1" />
            <text x="165" y="31" fill="#f59e0b" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">main</text>
            <circle cx="165" cy="102" r="10" fill="rgba(168,85,247,0.12)" stroke="#a855f7" strokeWidth="1" />
            <text x="165" y="105" fill="#a855f7" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">render</text>
            <circle cx="35" cy="28" r="10" fill="rgba(56,217,245,0.12)" stroke="#38d9f5" strokeWidth="1" />
            <text x="35" y="31" fill="#38d9f5" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">shared</text>
            <circle cx="35" cy="102" r="10" fill="rgba(34,197,94,0.12)" stroke="#22c55e" strokeWidth="1" />
            <text x="35" y="105" fill="#22c55e" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">tests</text>
          </svg>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  2. Usage Tracking                                                  */
/* ------------------------------------------------------------------ */

function UsageTracking() {
  const [sessionWidth, setSessionWidth] = useState(0)
  const [weeklyWidth, setWeeklyWidth] = useState(0)
  const [animating, setAnimating] = useState(false)

  const animateTo = useCallback((target: number, setter: (v: number) => void) => {
    const duration = 1200
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setter(eased * target)
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  const refresh = () => {
    if (animating) return
    setAnimating(true)
    setSessionWidth(0)
    setWeeklyWidth(0)
    // Small delay so the reset is visible
    setTimeout(() => {
      animateTo(62, setSessionWidth)
      animateTo(38, setWeeklyWidth)
      setTimeout(() => setAnimating(false), 1300)
    }, 150)
  }

  return (
    <div className="aspect-[4/3] p-3">
      <svg viewBox="0 0 200 120" fill="none" className="h-full w-full">
        <text x="20" y="16" fill="var(--color-text-primary)" fontSize="8" fontWeight="600" fontFamily="var(--font-mono)">Usage Tracking</text>

        <text x="20" y="35" fill="var(--color-text-secondary)" fontSize="7" fontFamily="var(--font-mono)">Session Usage</text>
        <rect x="20" y="40" width="160" height="8" rx="4" fill="var(--color-bg-primary)" />
        <rect x="20" y="40" width={sessionWidth * 160 / 100} height="8" rx="4" fill="#f59e0b" />
        <text x={24 + sessionWidth * 160 / 100} y="47" fill="var(--color-text-tertiary)" fontSize="6" fontFamily="var(--font-mono)">{Math.round(sessionWidth)}%</text>

        <text x="20" y="65" fill="var(--color-text-secondary)" fontSize="7" fontFamily="var(--font-mono)">Weekly Usage</text>
        <rect x="20" y="70" width="160" height="8" rx="4" fill="var(--color-bg-primary)" />
        <rect x="20" y="70" width={weeklyWidth * 160 / 100} height="8" rx="4" fill="#22c55e" />
        <text x={24 + weeklyWidth * 160 / 100} y="77" fill="var(--color-text-tertiary)" fontSize="6" fontFamily="var(--font-mono)">{Math.round(weeklyWidth)}%</text>

        {/* Refresh button */}
        <rect
          x="20" y="92" width="60" height="20" rx="6"
          fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth="0.5"
          className="cursor-pointer"
          onClick={refresh}
        />
        <text x="50" y="105" fill="#f59e0b" fontSize="7" fontFamily="var(--font-mono)" textAnchor="middle" style={{ pointerEvents: "none" }}>
          {animating ? "..." : "Refresh"}
        </text>
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  3. Health Dashboard                                                */
/* ------------------------------------------------------------------ */

function HealthDashboard() {
  const [fixed, setFixed] = useState(false)
  const [updating, setUpdating] = useState(false)

  const handleUpdate = () => {
    if (fixed || updating) return
    setUpdating(true)
    setTimeout(() => {
      setFixed(true)
      setUpdating(false)
    }, 800)
  }

  const items = [
    { label: "Core Files", healthy: true },
    { label: "Git Hooks", healthy: true },
    { label: "Skills", healthy: true },
    { label: "CLI Tools", healthy: fixed },
    { label: "Config", healthy: true },
  ]

  return (
    <div className="aspect-[4/3] p-3">
      <svg viewBox="0 0 200 140" fill="none" className="h-full w-full">
        <defs>
          <filter id="health-glow-g" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
          <filter id="health-glow-w" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
        </defs>

        {/* Header */}
        <text x="20" y="18" fill="var(--color-text-primary)" fontSize="9" fontWeight="600" fontFamily="var(--font-mono)">SubFrame Health</text>
        <rect x="130" y="6" width="50" height="16" rx="8" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth="0.5" />
        <text x="155" y="17" fill="#f59e0b" fontSize="7" fontFamily="var(--font-mono)" textAnchor="middle">
          {fixed ? "5/5" : "4/5"}
        </text>

        {/* Status rows */}
        {items.map((item, i) => {
          const y = 34 + i * 18
          const isHealthy = item.healthy
          const dotColor = isHealthy ? "#22c55e" : "#f59e0b"
          const bgColor = isHealthy ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)"
          const displayStatus = isHealthy ? "Healthy" : "Outdated"

          return (
            <g key={item.label}>
              <circle cx="28" cy={y + 7} r="4" fill={dotColor} filter={isHealthy ? "url(#health-glow-g)" : "url(#health-glow-w)"}>
                <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite" />
              </circle>
              <text x="38" y={y + 10} fill="var(--color-text-secondary)" fontSize="6.5" fontFamily="var(--font-mono)">{item.label}</text>
              <rect x="130" y={y} width="50" height="14" rx="7" fill={bgColor} />
              <text x="155" y={y + 10} fill={dotColor} fontSize="5.5" fontFamily="var(--font-mono)" textAnchor="middle">{displayStatus}</text>
            </g>
          )
        })}

        {/* Update button */}
        <rect
          x="20" y="120" width="70" height="16" rx="6"
          fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth="0.5"
          className="cursor-pointer"
          onClick={handleUpdate}
        />
        <text x="55" y="131" fill="#f59e0b" fontSize="7" fontFamily="var(--font-mono)" textAnchor="middle" style={{ pointerEvents: "none" }}>
          {updating ? "Updating..." : fixed ? "All Good" : "Update All"}
        </text>
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  4. Agent Activity Monitor                                          */
/* ------------------------------------------------------------------ */

function AgentActivity() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, { once: true, amount: 0.3 })
  const [visibleSteps, setVisibleSteps] = useState(0)

  useEffect(() => {
    if (!isInView) return
    let step = 0
    const interval = setInterval(() => {
      step++
      setVisibleSteps(step)
      if (step >= 4) clearInterval(interval)
    }, 400)
    return () => clearInterval(interval)
  }, [isInView])

  const steps = [
    { action: "Read", detail: "src/main/index.ts", color: "#38d9f5", time: "2s ago", cy: 42 },
    { action: "Edit", detail: "package.json", color: "#a855f7", time: "5s ago", cy: 72 },
    { action: "Bash", detail: "npm test", color: "#e040a0", time: "8s ago", cy: 102 },
  ]

  return (
    <div ref={ref} className="aspect-[4/3] p-3">
      <svg viewBox="0 0 200 140" fill="none" className="h-full w-full">
        <defs>
          <filter id="agent-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feComposite in="SourceGraphic" in2="b" operator="over" />
          </filter>
          <linearGradient id="timeline-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="50%" stopColor="#e040a0" />
            <stop offset="100%" stopColor="#38d9f5" />
          </linearGradient>
        </defs>

        {/* Header */}
        <text x="20" y="18" fill="var(--color-text-primary)" fontSize="9" fontWeight="600" fontFamily="var(--font-mono)">Agent Activity</text>
        <circle cx="134" cy="15" r="3" fill="#22c55e" filter="url(#agent-glow)">
          <animate attributeName="r" values="3;4;3" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.6;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <text x="142" y="18" fill="#22c55e" fontSize="7" fontFamily="var(--font-mono)">active</text>

        {/* Timeline line */}
        <line x1="32" y1="35" x2="32" y2="128" stroke="url(#timeline-grad)" strokeWidth="1.5" opacity="0.4" />

        {/* Steps - fade in sequentially */}
        {steps.map((step, i) => (
          <g key={step.action} opacity={visibleSteps > i ? 1 : 0} style={{ transition: "opacity 0.4s ease-out" }}>
            <circle cx="32" cy={step.cy} r="5" fill={step.color} filter="url(#agent-glow)">
              <animate attributeName="r" values="5;6;5" dur={`${2.5 + i * 0.3}s`} repeatCount="indefinite" />
            </circle>
            <text x="44" y={step.cy - 3} fill={step.color} fontSize="6" fontWeight="600" fontFamily="var(--font-mono)">{step.action}</text>
            <text x="44" y={step.cy + 6} fill="var(--color-text-secondary)" fontSize="7" fontFamily="var(--font-mono)">{step.detail}</text>
            <text x="168" y={step.cy + 2} fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)">{step.time}</text>
          </g>
        ))}

        {/* Thinking indicator */}
        <g opacity={visibleSteps > 3 ? 1 : 0} style={{ transition: "opacity 0.4s ease-out" }}>
          <circle cx="32" cy="125" r="3" fill="#f59e0b" opacity="0.6">
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <text x="44" y="128" fill="var(--color-text-tertiary)" fontSize="6" fontFamily="var(--font-mono)" fontStyle="italic">thinking...</text>
        </g>
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  5. Sub-Task Management                                             */
/* ------------------------------------------------------------------ */

function TaskManagement() {
  const [view, setView] = useState<"kanban" | "timeline" | "graph">("kanban")

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 p-3 pb-0">
        {(["kanban", "timeline", "graph"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1 font-mono text-xs capitalize transition-colors ${
              view === v
                ? "bg-accent-purple/15 text-accent-purple"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="aspect-[4/3] p-3">
        {view === "kanban" && (
          <svg viewBox="0 0 200 130" fill="none" className="h-full w-full">
            {/* Column headers */}
            <rect x="8" y="6" width="56" height="14" rx="3" fill="rgba(113,113,122,0.15)" />
            <text x="36" y="16" fill="var(--color-text-tertiary)" fontSize="6" fontFamily="var(--font-mono)" textAnchor="middle">Pending</text>
            <rect x="72" y="6" width="56" height="14" rx="3" fill="rgba(245,158,11,0.15)" />
            <text x="100" y="16" fill="#f59e0b" fontSize="6" fontFamily="var(--font-mono)" textAnchor="middle">In Progress</text>
            <rect x="136" y="6" width="56" height="14" rx="3" fill="rgba(34,197,94,0.15)" />
            <text x="164" y="16" fill="#22c55e" fontSize="6" fontFamily="var(--font-mono)" textAnchor="middle">Done</text>
            {/* Dividers */}
            <line x1="67" y1="4" x2="67" y2="125" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            <line x1="131" y1="4" x2="131" y2="125" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            {/* Pending cards */}
            <rect x="12" y="26" width="48" height="22" rx="4" fill="var(--color-bg-card)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            <text x="16" y="35" fill="var(--color-text-secondary)" fontSize="5" fontFamily="var(--font-mono)">Git status</text>
            <text x="16" y="43" fill="var(--color-text-tertiary)" fontSize="4" fontFamily="var(--font-mono)">medium</text>
            <rect x="12" y="52" width="48" height="22" rx="4" fill="var(--color-bg-card)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            <text x="16" y="61" fill="var(--color-text-secondary)" fontSize="5" fontFamily="var(--font-mono)">Cmd palette</text>
            <text x="16" y="69" fill="var(--color-text-tertiary)" fontSize="4" fontFamily="var(--font-mono)">low</text>
            {/* In Progress */}
            <rect x="76" y="26" width="48" height="22" rx="4" fill="var(--color-bg-card)" stroke="#f59e0b" strokeWidth="0.8" />
            <text x="80" y="35" fill="#f59e0b" fontSize="5" fontFamily="var(--font-mono)">Task UX</text>
            <text x="80" y="43" fill="var(--color-text-tertiary)" fontSize="4" fontFamily="var(--font-mono)">high</text>
            {/* Done */}
            <rect x="140" y="26" width="48" height="22" rx="4" fill="var(--color-bg-card)" stroke="rgba(34,197,94,0.3)" strokeWidth="0.5" />
            <text x="144" y="35" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)" textDecoration="line-through">Init flow</text>
            <text x="144" y="43" fill="var(--color-text-tertiary)" fontSize="4" fontFamily="var(--font-mono)">completed</text>
            <rect x="140" y="52" width="48" height="22" rx="4" fill="var(--color-bg-card)" stroke="rgba(34,197,94,0.3)" strokeWidth="0.5" />
            <text x="144" y="61" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)" textDecoration="line-through">Health panel</text>
            <text x="144" y="69" fill="var(--color-text-tertiary)" fontSize="4" fontFamily="var(--font-mono)">completed</text>
          </svg>
        )}

        {view === "timeline" && (
          <svg viewBox="0 0 200 130" fill="none" className="h-full w-full">
            {/* Timeline axis */}
            <line x1="20" y1="110" x2="185" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            {/* Date labels */}
            <text x="30" y="122" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)">Feb 24</text>
            <text x="80" y="122" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)">Feb 26</text>
            <text x="130" y="122" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)">Feb 28</text>
            <text x="170" y="122" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)">Mar 1</text>
            {/* Completed task bars */}
            <rect x="25" y="20" width="70" height="14" rx="4" fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth="0.5" />
            <text x="30" y="30" fill="#22c55e" fontSize="5" fontFamily="var(--font-mono)">Init flow</text>
            <rect x="50" y="40" width="55" height="14" rx="4" fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth="0.5" />
            <text x="55" y="50" fill="#22c55e" fontSize="5" fontFamily="var(--font-mono)">Health panel</text>
            {/* In progress bar */}
            <rect x="90" y="60" width="60" height="14" rx="4" fill="rgba(245,158,11,0.2)" stroke="#f59e0b" strokeWidth="0.8">
              <animate attributeName="width" values="60;65;60" dur="3s" repeatCount="indefinite" />
            </rect>
            <text x="95" y="70" fill="#f59e0b" fontSize="5" fontFamily="var(--font-mono)">Task UX</text>
            {/* Pending bar */}
            <rect x="140" y="80" width="40" height="14" rx="4" fill="rgba(113,113,122,0.1)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="3 2" />
            <text x="145" y="90" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)">Git status</text>
          </svg>
        )}

        {view === "graph" && (
          <svg viewBox="0 0 200 130" fill="none" className="h-full w-full">
            <defs>
              <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0,0 L6,3 L0,6 z" fill="var(--color-text-tertiary)" />
              </marker>
            </defs>
            {/* Dependency arrows */}
            <line x1="78" y1="35" x2="100" y2="65" stroke="var(--color-text-tertiary)" strokeWidth="0.8" markerEnd="url(#arrow)" opacity="0.5" />
            <line x1="55" y1="42" x2="55" y2="85" stroke="var(--color-text-tertiary)" strokeWidth="0.8" markerEnd="url(#arrow)" opacity="0.5" />
            <line x1="140" y1="72" x2="155" y2="30" stroke="var(--color-text-tertiary)" strokeWidth="0.8" markerEnd="url(#arrow)" opacity="0.5" strokeDasharray="3 2" />
            {/* Init flow (completed) */}
            <rect x="25" y="18" width="60" height="22" rx="6" fill="rgba(34,197,94,0.12)" stroke="#22c55e" strokeWidth="1" />
            <text x="55" y="32" fill="#22c55e" fontSize="6" fontFamily="var(--font-mono)" textAnchor="middle">Init flow</text>
            {/* Task UX (in progress) */}
            <rect x="90" y="58" width="60" height="22" rx="6" fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="1">
              <animate attributeName="strokeOpacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
            </rect>
            <text x="120" y="72" fill="#f59e0b" fontSize="6" fontFamily="var(--font-mono)" textAnchor="middle">Task UX</text>
            {/* Health panel (completed) */}
            <rect x="25" y="88" width="60" height="22" rx="6" fill="rgba(34,197,94,0.12)" stroke="#22c55e" strokeWidth="1" />
            <text x="55" y="102" fill="#22c55e" fontSize="6" fontFamily="var(--font-mono)" textAnchor="middle">Health panel</text>
            {/* Git status (pending) */}
            <rect x="130" y="18" width="55" height="22" rx="6" fill="rgba(113,113,122,0.08)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeDasharray="3 2" />
            <text x="157" y="32" fill="var(--color-text-tertiary)" fontSize="6" fontFamily="var(--font-mono)" textAnchor="middle">Git status</text>
          </svg>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  6. Project Overview                                                */
/* ------------------------------------------------------------------ */

function ProjectOverview() {
  return (
    <div className="aspect-[4/3] p-3">
      <svg viewBox="0 0 200 140" fill="none" className="h-full w-full">
        {/* Header */}
        <text x="20" y="18" fill="var(--color-text-primary)" fontSize="9" fontWeight="600" fontFamily="var(--font-mono)">Project Overview</text>

        {/* Stats row */}
        <rect x="20" y="28" width="38" height="26" rx="5" fill="var(--color-bg-primary)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <text x="39" y="38" fill="#f59e0b" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)" textAnchor="middle">36</text>
        <text x="39" y="48" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">modules</text>

        <rect x="64" y="28" width="38" height="26" rx="5" fill="var(--color-bg-primary)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <text x="83" y="38" fill="#a855f7" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)" textAnchor="middle">15</text>
        <text x="83" y="48" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">IPC</text>

        <rect x="108" y="28" width="38" height="26" rx="5" fill="var(--color-bg-primary)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <text x="127" y="38" fill="#38d9f5" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)" textAnchor="middle">5</text>
        <text x="127" y="48" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">hooks</text>

        <rect x="152" y="28" width="38" height="26" rx="5" fill="var(--color-bg-primary)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <text x="171" y="38" fill="#e040a0" fontSize="10" fontWeight="700" fontFamily="var(--font-mono)" textAnchor="middle">4</text>
        <text x="171" y="48" fill="var(--color-text-tertiary)" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">skills</text>

        {/* Decisions section */}
        <text x="20" y="70" fill="var(--color-text-secondary)" fontSize="7" fontWeight="600" fontFamily="var(--font-mono)">Recent Decisions</text>
        <line x1="20" y1="74" x2="180" y2="74" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

        <circle cx="28" cy="86" r="2" fill="#f59e0b" />
        <text x="36" y="89" fill="var(--color-text-secondary)" fontSize="6" fontFamily="var(--font-mono)">Migrated renderer to React 19 + Zustand</text>

        <circle cx="28" cy="100" r="2" fill="#a855f7" />
        <text x="36" y="103" fill="var(--color-text-secondary)" fontSize="6" fontFamily="var(--font-mono)">Adopted Tailwind CSS v4 design system</text>

        <circle cx="28" cy="114" r="2" fill="#38d9f5" />
        <text x="36" y="117" fill="var(--color-text-secondary)" fontSize="6" fontFamily="var(--font-mono)">Tasks stored as markdown + YAML frontmatter</text>

        {/* Context badge */}
        <rect x="130" y="124" width="55" height="12" rx="6" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth="0.4" />
        <text x="157" y="133" fill="#f59e0b" fontSize="5" fontFamily="var(--font-mono)" textAnchor="middle">context preserved</text>
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Showcase Card wrapper                                              */
/* ------------------------------------------------------------------ */

interface ShowcaseItem {
  title: string
  description: string
  render: () => React.ReactNode
  hasTabs?: boolean
}

const showcases: ShowcaseItem[] = [
  {
    title: "Interactive Structure Map",
    description:
      "Visualize your codebase as a force-directed graph or tree view. Drag nodes, zoom in, filter by module name, and explore dependencies.",
    render: () => <StructureMap />,
    hasTabs: true,
  },
  {
    title: "Usage Tracking",
    description:
      "Monitor your Claude Code API utilization from the top bar. See current session usage and 7-day consumption with countdown to reset.",
    render: () => <UsageTracking />,
  },
  {
    title: "Health Dashboard",
    description:
      "Monitor every SubFrame component — core files, hooks, skills, and git integration. Pulsing status indicators and one-click updates.",
    render: () => <HealthDashboard />,
  },
  {
    title: "Agent Activity Monitor",
    description:
      "Watch your AI agent work in real-time. Every tool call appears as a color-coded timeline entry. Review past sessions to understand what changed.",
    render: () => <AgentActivity />,
  },
  {
    title: "Sub-Task Management",
    description:
      "Track work in kanban board, timeline, or dependency graph views. Tasks persist as markdown files with YAML frontmatter.",
    render: () => <TaskManagement />,
    hasTabs: true,
  },
  {
    title: "Project Overview",
    description:
      "See your project at a glance — module count, IPC channels, hooks, skills, and recent architecture decisions.",
    render: () => <ProjectOverview />,
  },
]

function ShowcaseCard({
  item,
  index,
}: {
  item: ShowcaseItem
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, {
    once: true,
    amount: 0.2,
  })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group flex flex-col rounded-xl border border-white/5 bg-bg-card overflow-hidden transition-colors hover:border-accent-purple/20"
    >
      <div className="bg-bg-deep flex-1">
        {item.render()}
      </div>
      <div className="px-3 py-2.5 border-t border-white/5">
        <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
        <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{item.description}</p>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function Showcase() {
  const headerRef = useRef<HTMLDivElement>(null)
  const headerInView = useInView(headerRef as React.RefObject<Element>, {
    once: true,
    amount: 0.3,
  })

  return (
    <section id="showcase" className="bg-bg-primary px-6 py-24">
      <div className="mx-auto max-w-[1200px]">
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 30 }}
          animate={headerInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            <LineShadowText shadowColor="rgba(157, 157, 176, 0.5)" className="text-text-primary">
              Features
            </LineShadowText>
          </h2>
          <p className="mx-auto max-w-xl text-text-secondary">
            A look at some of SubFrame's core panels. Click buttons, switch tabs,
            and explore — these are just a few of 20+ built-in features.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
          {showcases.map((item, i) => (
            <ShowcaseCard key={item.title} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
