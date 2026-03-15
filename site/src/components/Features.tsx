import { useRef } from "react"
import { motion, useInView } from "motion/react"
import {
  LayoutGrid,
  Network,
  GitBranch,
  ListChecks,
  Puzzle,
  Bot,
  Rocket,
  Workflow,
  ShieldCheck,
} from "lucide-react"
import { LineShadowText } from "@/components/ui/line-shadow-text"

const features = [
  {
    icon: LayoutGrid,
    title: "Multi-Terminal",
    description:
      "Up to 9 terminals in tabs or a split grid. Run an AI tool, a dev server, and tests simultaneously.",
  },
  {
    icon: Network,
    title: "Structure Map",
    description:
      "Interactive D3.js graph of your module map. Node size scales with LOC, edges show dependencies.",
  },
  {
    icon: GitBranch,
    title: "GitHub",
    description:
      "Browse open issues and PRs, check sync status, manage branches and worktrees.",
  },
  {
    icon: ListChecks,
    title: "Task Management",
    description:
      "Tasks stored as markdown files. View as sortable table, kanban board, or dependency graph.",
  },
  {
    icon: Puzzle,
    title: "Plugin System",
    description:
      "Manage Claude Code plugins from the UI — browse, toggle, install.",
  },
  {
    icon: Bot,
    title: "Multi-AI Support",
    description:
      "Switch between Claude Code, Codex CLI, and Gemini CLI with a single click.",
  },
  {
    icon: Rocket,
    title: "One-Click Init",
    description:
      "Initialize any project with AGENTS.md, codebase mapping, task tracking. One command.",
  },
  {
    icon: Workflow,
    title: "Hooks & Automation",
    description:
      "Context injection at session start, task matching on every prompt.",
  },
  {
    icon: ShieldCheck,
    title: "Health & Audit",
    description:
      "See every SubFrame component's status. Update outdated hooks and skills with one click.",
  },
]

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[number]
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, {
    once: true,
    amount: 0.3,
  })

  const Icon = feature.icon

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.5, delay: index * 0.07 }}
      className="group relative rounded-xl border border-white/5 bg-bg-card p-6 transition-colors hover:border-accent-purple/20 hover:bg-bg-elevated"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
        <Icon size={20} className="text-accent-purple" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-text-primary">
        {feature.title}
      </h3>
      <p className="text-sm leading-relaxed text-text-secondary">
        {feature.description}
      </p>
    </motion.div>
  )
}

export function Features() {
  return (
    <section id="features" className="bg-bg-primary px-6 py-24">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-16 text-center">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            <LineShadowText
              shadowColor="rgba(157, 157, 176, 0.5)"
              className="text-text-primary"
            >
              What's in the box
            </LineShadowText>
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto text-center">
            SubFrame wraps Claude Code, Codex CLI, and Gemini CLI in a structured workspace &mdash;
            persistent context, task tracking, and multi-terminal support all in one place.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
