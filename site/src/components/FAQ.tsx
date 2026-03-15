import { useState, useRef } from "react"
import { motion, useInView, AnimatePresence } from "motion/react"
import { ChevronDown } from "lucide-react"
import { LineShadowText } from "@/components/ui/line-shadow-text"

interface FAQItem {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: "What is SubFrame?",
    answer:
      "SubFrame is a terminal-first IDE that wraps Claude Code, Codex CLI, and Gemini CLI into a single workspace. It provides multi-terminal management, project structure mapping, task tracking, GitHub integration, and hooks/automation — all without replacing your existing code editor.",
  },
  {
    question: "How is it different from VS Code or Cursor?",
    answer:
      "SubFrame is terminal-first, not editor-first. It does not try to be a code editor. Instead, it enhances the native AI terminal tools you already use by providing project context, task management, and multi-terminal orchestration around them. Use SubFrame alongside your preferred editor.",
  },
  {
    question: "What AI tools does it support?",
    answer:
      "Claude Code, Codex CLI, and Gemini CLI. SubFrame is AI-tool agnostic — its plugin system allows you to manage and switch between different tools. New tools can be added as the ecosystem grows.",
  },
  {
    question: "Is it open source?",
    answer:
      "Yes. SubFrame is fully open source under the MIT license. You can read the code, contribute, or fork it.",
  },
  {
    question: "What platforms are supported?",
    answer:
      "Windows is the most stable platform. macOS and Linux builds are available in beta. See the GitHub releases page for the latest builds.",
  },
  {
    question: "Does it work without SubFrame initialization?",
    answer:
      "Yes. Without initialization, SubFrame works as a multi-terminal manager — you still get tabbed terminals, split grids, and basic workspace features. Initialization adds structure mapping, task tracking, hooks, and project-aware context.",
  },
  {
    question: "Can I run it on a server?",
    answer:
      "Not yet. A remote/headless mode is on the roadmap but not currently available. SubFrame runs as a desktop Electron application.",
  },
  {
    question: "Is there a plugin system?",
    answer:
      "Basic plugin management exists — you can browse, toggle, and install Claude Code plugins from the UI. A full extension API with custom views and commands is on the roadmap.",
  },
]

function Accordion({
  item,
  isOpen,
  onToggle,
}: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div className="border-b border-white/5">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 text-base font-medium text-text-primary">
          {item.question}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-text-tertiary transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-text-secondary">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, {
    once: true,
    amount: 0.2,
  })

  return (
    <section id="faq" className="bg-bg-primary px-6 py-24">
      <div className="mx-auto max-w-[700px]">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="mb-12 text-center text-4xl font-bold tracking-tight sm:text-5xl">
            <LineShadowText shadowColor="rgba(157, 157, 176, 0.5)" className="text-text-primary">
              Frequently asked questions
            </LineShadowText>
          </h2>

          <div className="border-t border-white/5">
            {faqs.map((faq, i) => (
              <Accordion
                key={i}
                item={faq}
                isOpen={openIndex === i}
                onToggle={() =>
                  setOpenIndex(openIndex === i ? null : i)
                }
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
