import { useRef } from "react"
import { motion, useInView } from "motion/react"
import { Rocket, Bug, GitPullRequest } from "lucide-react"
import { LineShadowText } from "@/components/ui/line-shadow-text"

const cards = [
  {
    icon: Rocket,
    title: "Try it out",
    description:
      "Download the latest release, open a project, and run your first AI session.",
    linkText: "Get the latest release",
    href: "https://github.com/Codename-11/SubFrame/releases",
  },
  {
    icon: Bug,
    title: "Report & request",
    description:
      "Found a bug or have a feature idea? Open an issue on GitHub.",
    linkText: "Open an issue",
    href: "https://github.com/Codename-11/SubFrame/issues",
  },
  {
    icon: GitPullRequest,
    title: "Contribute",
    description:
      "SubFrame is MIT-licensed. Fork the repo, pick an issue, and submit a PR.",
    linkText: "View open PRs",
    href: "https://github.com/Codename-11/SubFrame/pulls",
  },
]

export function Community() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, {
    once: true,
    amount: 0.3,
  })

  return (
    <section className="bg-bg-deep px-6 py-24">
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
              Built in the open
            </LineShadowText>
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-text-secondary">
            SubFrame is open source. Contributions, bug reports, and feature
            requests are welcome.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-3">
          {cards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.a
                key={card.title}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 30 }}
                animate={
                  isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }
                }
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group rounded-xl border border-white/5 bg-bg-card p-6 no-underline transition-colors hover:border-accent-purple/20 hover:bg-bg-elevated"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-purple/10">
                  <Icon size={20} className="text-accent-purple" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-text-primary">
                  {card.title}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-text-secondary">
                  {card.description}
                </p>
                <span className="text-sm font-medium text-accent-purple group-hover:underline">
                  {card.linkText}
                </span>
              </motion.a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
