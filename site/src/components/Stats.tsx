import { useRef } from "react"
import { motion, useInView } from "motion/react"
import { NumberTicker } from "@/components/ui/number-ticker"

interface StatItem {
  value: number
  label: string
  description: string
}

const stats: StatItem[] = [
  {
    value: 9,
    label: "Terminals",
    description: "Tabs or split grid — run AI, dev server, and tests side by side",
  },
  {
    value: 5,
    label: "Slash Commands",
    description: "Built-in skills like /sub-tasks, /sub-audit, /onboard, and more",
  },
  {
    value: 3,
    label: "AI Tools",
    description: "Claude Code, Codex CLI, and Gemini CLI — switch with one click",
  },
]

export function Stats() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, {
    once: true,
    amount: 0.5,
  })

  return (
    <section className="bg-bg-deep px-6 py-24">
      <div className="mx-auto max-w-[1200px]">
        <div ref={ref} className="grid gap-6 sm:grid-cols-3">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              animate={
                isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
              }
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="rounded-xl border border-white/5 bg-bg-card p-8 text-center"
            >
              <div className="mb-1 text-5xl font-extrabold text-accent-purple">
                {isInView && (
                  <NumberTicker
                    value={stat.value}
                    delay={i * 0.2}
                    className="text-accent-purple"
                  />
                )}
              </div>
              <div className="text-base font-semibold text-text-primary mb-1">{stat.label}</div>
              <div className="text-xs text-text-tertiary leading-relaxed">{stat.description}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
