import { useRef, useState } from "react"
import { motion, useInView } from "motion/react"
import { Github, Terminal } from "lucide-react"
import { LineShadowText } from "@/components/ui/line-shadow-text"
import { RainbowButton } from "@/components/ui/rainbow-button"

type Platform = "windows" | "macos" | "linux" | "other"

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("win")) return "windows"
  if (ua.includes("mac")) return "macos"
  if (ua.includes("linux")) return "linux" as Platform
  return "other"
}

const releaseUrl = "https://github.com/Codename-11/SubFrame/releases/latest"
const repoUrl = "https://github.com/Codename-11/SubFrame"

// Simple platform SVG icons
function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  )
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83" />
      <path d="M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11" />
    </svg>
  )
}

export function CTA() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, {
    once: true,
    amount: 0.3,
  })
  const [platform] = useState<Platform>(detectPlatform)

  const primaryLabel = platform === "macos" ? "Download for macOS"
    : platform === "linux" ? "Download for Linux"
    : "Download for Windows"
  const PrimaryIcon = platform === "macos" ? AppleIcon : WindowsIcon

  return (
    <section id="download" className="bg-bg-primary px-6 py-24">
      <div className="mx-auto max-w-[1200px]">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            <LineShadowText shadowColor="rgba(157, 157, 176, 0.5)" className="text-text-primary">
              Get started
            </LineShadowText>
          </h2>

          <p className="mx-auto mb-3 max-w-lg text-lg text-text-secondary">
            SubFrame is free and open source. Download for macOS or Windows, or build from source.
          </p>

          <p className="mb-8 text-sm font-mono text-text-tertiary">
            Windows (stable) · macOS &amp; Linux (beta — testers wanted)
          </p>

          {/* Primary CTA buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
            <a href={releaseUrl} target="_blank" rel="noopener noreferrer">
              <RainbowButton size="lg" className="text-base font-semibold gap-2">
                <PrimaryIcon />
                {primaryLabel}
              </RainbowButton>
            </a>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-2.5 text-base font-medium text-text-primary transition-colors hover:bg-white/10 no-underline"
            >
              <Github size={18} />
              View Source
            </a>
          </div>

          {/* All Platforms */}
          <p className="mb-4 text-[10px] font-mono uppercase tracking-[0.2em] text-text-tertiary">
            All Platforms
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-5 py-2 text-sm text-text-secondary transition-colors hover:bg-white/8 hover:text-text-primary no-underline"
            >
              <AppleIcon />
              <span>macOS</span>
              <span className="text-text-tertiary text-xs">.dmg</span>
            </a>
            <a
              href={releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-5 py-2 text-sm text-text-secondary transition-colors hover:bg-white/8 hover:text-text-primary no-underline"
            >
              <WindowsIcon />
              <span>Windows</span>
              <span className="text-text-tertiary text-xs">.exe</span>
            </a>
            <a
              href={`${repoUrl}#quick-start`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/3 px-5 py-2 text-sm text-text-secondary transition-colors hover:bg-white/8 hover:text-text-primary no-underline"
            >
              <Terminal size={16} />
              <span>Build from source</span>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
