import { useRef } from "react"
import { motion, useInView } from "motion/react"
import { LineShadowText } from "@/components/ui/line-shadow-text"

const techs = [
  { name: "React 19", icon: "https://cdn.simpleicons.org/react/61DAFB", color: "#61DAFB" },
  { name: "TypeScript", icon: "https://cdn.simpleicons.org/typescript/3178C6", color: "#3178C6" },
  { name: "Electron", icon: "https://cdn.simpleicons.org/electron/9FEAF9", color: "#9FEAF9" },
  { name: "Tailwind CSS", icon: "https://cdn.simpleicons.org/tailwindcss/06B6D4", color: "#06B6D4" },
  { name: "Framer Motion", icon: "https://cdn.simpleicons.org/framer/0055FF", color: "#0055FF" },
  { name: "esbuild", icon: "https://cdn.simpleicons.org/esbuild/FFCF00", color: "#FFCF00" },
]

const techsNoIcon = [
  { name: "xterm.js", abbr: "xt" },
  { name: "Zustand", abbr: "Zu" },
  { name: "TanStack Query", abbr: "TQ" },
  { name: "CodeMirror 6", abbr: "CM" },
  { name: "shadcn/ui", abbr: "ui" },
  { name: "VitePress", abbr: "VP" },
]

export function TechStack() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, {
    once: true,
    amount: 0.3,
  })

  return (
    <section className="bg-bg-primary px-6 py-24">
      <div className="mx-auto max-w-[900px]">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            <LineShadowText shadowColor="rgba(157, 157, 176, 0.5)" className="text-text-primary">
              Built with
            </LineShadowText>
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-text-secondary">
            12 battle-tested open-source libraries. No vendor lock-in.
          </p>
        </motion.div>

        {/* Icon grid — 6 columns on desktop, 3 on mobile */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {techs.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-bg-card p-4 transition-all hover:border-white/15 hover:bg-bg-elevated"
            >
              <img
                src={tech.icon}
                alt={tech.name}
                className="h-8 w-8 opacity-70 group-hover:opacity-100 transition-opacity"
                loading="lazy"
              />
              <span className="text-xs text-text-tertiary group-hover:text-text-secondary transition-colors text-center leading-tight">
                {tech.name}
              </span>
            </motion.div>
          ))}
          {techsNoIcon.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4, delay: (techs.length + i) * 0.05 }}
              className="group flex flex-col items-center gap-2 rounded-xl border border-white/5 bg-bg-card p-4 transition-all hover:border-white/15 hover:bg-bg-elevated"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-xs font-bold font-mono text-text-tertiary group-hover:text-accent-purple transition-colors">
                {tech.abbr}
              </span>
              <span className="text-xs text-text-tertiary group-hover:text-text-secondary transition-colors text-center leading-tight">
                {tech.name}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
