import { useState, useEffect, useRef, useCallback } from "react"
import { motion } from "motion/react"
import { Download, Github } from "lucide-react"
import { LineShadowText } from "@/components/ui/line-shadow-text"
import { WordRotate } from "@/components/ui/word-rotate"
import { RainbowButton } from "@/components/ui/rainbow-button"
import { LightRays } from "@/components/ui/light-rays"
import { Logo } from "@/components/Logo"

interface TerminalLine {
  type: "command" | "output"
  text: string
}

const TERMINAL_LINES: TerminalLine[] = [
  { type: "command", text: "subframe init my-project" },
  { type: "output", text: "✓ Created project structure" },
  { type: "output", text: "✓ Initialized STRUCTURE.json" },
  { type: "output", text: "✓ Ready to code with Claude" },
  { type: "command", text: "subframe" },
  { type: "output", text: "Starting SubFrame...  ● Claude connected  ● Project loaded: my-project" },
]

const RESET_DELAY = 8000 // ms to wait after done before replaying

function BlinkCursor() {
  return (
    <motion.span
      className="inline-block w-2 h-4 bg-accent-purple align-middle ml-0.5"
      animate={{ opacity: [1, 1, 0, 0] }}
      transition={{ duration: 1, repeat: Infinity, times: [0, 0.5, 0.5, 1] }}
    />
  )
}

function AnimatedTerminal() {
  const [, forceUpdate] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ visibleLines: 0, typedChars: 0, isTyping: false, done: false, started: false })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reset = useCallback(() => {
    const s = stateRef.current
    s.visibleLines = 0
    s.typedChars = 0
    s.isTyping = true
    s.done = false
    forceUpdate((n) => n + 1)
  }, [])

  const tick = useCallback(() => {
    const s = stateRef.current
    const line = TERMINAL_LINES[s.visibleLines]
    if (!line) {
      s.isTyping = false
      s.done = true
      forceUpdate((n) => n + 1)
      // Schedule replay after delay
      timerRef.current = setTimeout(() => {
        reset()
        timerRef.current = setTimeout(tick, 300)
      }, RESET_DELAY)
      return
    }
    if (line.type === "command") {
      if (s.typedChars < line.text.length) {
        s.typedChars++
        forceUpdate((n) => n + 1)
        timerRef.current = setTimeout(tick, 40 + Math.random() * 30)
      } else {
        timerRef.current = setTimeout(() => {
          s.visibleLines++
          s.typedChars = 0
          forceUpdate((n) => n + 1)
          timerRef.current = setTimeout(tick, TERMINAL_LINES[s.visibleLines]?.type === "output" ? 150 : 300)
        }, 400)
      }
    } else {
      s.visibleLines++
      s.typedChars = 0
      forceUpdate((n) => n + 1)
      timerRef.current = setTimeout(tick, TERMINAL_LINES[s.visibleLines]?.type === "output" ? 150 : 300)
    }
  }, [reset])

  // Start when scrolled into view
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !stateRef.current.started) {
          stateRef.current.started = true
          stateRef.current.isTyping = true
          timerRef.current = setTimeout(tick, 300)
          obs.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => { obs.disconnect(); if (timerRef.current) clearTimeout(timerRef.current) }
  }, [tick])

  return (
    <div ref={ref} className="mx-auto mt-12 w-full max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-bg-primary shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center border-b border-white/5 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
          </div>
          <span className="flex-1 text-center text-xs font-mono text-text-tertiary">
            subframe — zsh — 80×24
          </span>
          <div className="w-[52px]" />
        </div>
        {/* Terminal body */}
        <div className="p-6 text-left font-mono text-sm leading-loose min-h-[280px] space-y-1">
          {TERMINAL_LINES.map((line, i) => {
            const s = stateRef.current
            if (i > s.visibleLines) return null
            if (i === s.visibleLines && line.type === "command") {
              // Currently typing this command
              return (
                <div key={i}>
                  <span className="text-accent-purple">❯</span>{" "}
                  <span className="text-text-primary font-semibold">
                    {line.text.slice(0, s.typedChars)}
                  </span>
                  <BlinkCursor />
                </div>
              )
            }
            if (line.type === "command") {
              return (
                <div key={i}>
                  <span className="text-accent-purple">❯</span>{" "}
                  <span className="text-text-primary font-semibold">{line.text}</span>
                </div>
              )
            }
            // Output
            const hasAccentDot = line.text.includes("●")
            return (
              <div key={i} className="pl-5 text-text-tertiary">
                {hasAccentDot
                  ? line.text.split("  ").map((part, j) => (
                      <span key={j}>
                        {j > 0 && "  "}
                        {part.startsWith("● Claude") ? (
                          <><span className="text-accent-purple">●</span> Claude connected</>
                        ) : part.startsWith("● Project") ? (
                          <><span className="text-green-400">●</span> Project loaded: my-project</>
                        ) : (
                          part
                        )}
                      </span>
                    ))
                  : line.text}
              </div>
            )
          })}
          {/* Bottom prompt with blinking cursor — hidden while typing a command (that line has its own cursor) */}
          {!(stateRef.current.isTyping && TERMINAL_LINES[stateRef.current.visibleLines]?.type === "command") && stateRef.current.started && (
            <div className="mt-3">
              <span className="text-accent-purple">❯</span>{" "}
              <BlinkCursor />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-24 pb-16">
      {/* Animated light rays background */}
      <LightRays
        className="-z-10"
        count={8}
        color="rgba(168, 85, 247, 0.15)"
        blur={40}
        speed={16}
        length="80vh"
      />

      <div className="mx-auto flex max-w-[1200px] flex-col items-center text-center">
        {/* Beta badge */}
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
            Public Beta &mdash; Help us test
          </span>
        </div>

        {/* Animated logo — centered, dark bg to stand out from light rays */}
        <div className="mb-8 rounded-lg bg-black/80 p-1 ring-1 ring-white/10 backdrop-blur-sm" aria-hidden="true">
          <Logo size={120} id="hero" frame={true} animate={true} />
        </div>

        {/* Heading */}
        <h1 className="mb-4 text-5xl leading-none font-extrabold tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl">
          <LineShadowText shadowColor="rgba(157, 157, 176, 0.4)" className="text-text-primary">
            Your terminal,
          </LineShadowText>
          <br />
          <WordRotate
            words={["with context", "with memory", "with structure", "with clarity"]}
            duration={4000}
            className="aurora-rotate text-4xl font-extrabold italic sm:text-5xl md:text-6xl lg:text-7xl"
          />
        </h1>

        {/* Subtitle */}
        <p className="mb-3 text-lg text-text-secondary sm:text-xl">
          A terminal-first IDE built around AI coding tools.
        </p>

        {/* AI tool badge — below subtitle */}
        <div className="mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-text-secondary">
            Claude Code &middot; Codex CLI &middot; Gemini CLI
          </span>
        </div>

        {/* CTAs */}
        <div className="mb-16 flex flex-wrap items-center justify-center gap-4">
          <a href="#download">
            <RainbowButton size="lg" className="text-base font-semibold">
              <Download size={16} />
              Download for {getOS()}
            </RainbowButton>
          </a>
          <a
            href="https://github.com/Codename-11/SubFrame"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-3 text-base font-medium text-text-primary transition-colors hover:bg-white/10 no-underline"
          >
            <Github size={18} />
            View on GitHub
          </a>
        </div>

        {/* Promo video */}
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-white/10">
          <video
            autoPlay
            muted
            loop
            playsInline
            controls
            className="w-full"
            poster="/screenshots/main_ui_sidebars_collapsed.png"
          >
            <source src="/promo.mp4" type="video/mp4" />
          </video>
        </div>

        {/* Animated terminal demo */}
        <AnimatedTerminal />
      </div>
    </section>
  )
}

function getOS(): string {
  if (typeof navigator === "undefined") return "your OS"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("mac")) return "macOS"
  if (ua.includes("win")) return "Windows"
  if (ua.includes("linux")) return "Linux"
  return "your OS"
}
