import { useState, useRef } from "react"
import { motion, useInView, AnimatePresence } from "motion/react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { LineShadowText } from "@/components/ui/line-shadow-text"

const screenshots = [
  {
    src: "/screenshots/main_ui_left_sidebar_collapsed_right_tasks.png",
    caption: "Task management panel with collapsible sidebar",
  },
  {
    src: "/screenshots/main_ui_overview_pane.png",
    caption: "Overview panel with project stats and activity",
  },
  {
    src: "/screenshots/main_ui_overview_repo_detail_view.png",
    caption: "Repository detail view with commit history",
  },
  {
    src: "/screenshots/main_ui_sidebars_collapsed.png",
    caption: "Full terminal focus with sidebars collapsed",
  },
]

export function Screenshots() {
  const [current, setCurrent] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref as React.RefObject<Element>, {
    once: true,
    amount: 0.2,
  })

  const prev = () =>
    setCurrent((c) => (c === 0 ? screenshots.length - 1 : c - 1))
  const next = () =>
    setCurrent((c) => (c === screenshots.length - 1 ? 0 : c + 1))

  return (
    <section id="screenshots" className="bg-bg-deep px-6 py-24">
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
              See it in action
            </LineShadowText>
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-text-secondary">
            SubFrame provides a complete workspace — terminals, tasks, structure
            mapping, and more in one window.
          </p>
        </motion.div>

        {/* Carousel */}
        <div className="relative">
          <div className="overflow-hidden rounded-xl border border-white/5">
            <AnimatePresence mode="wait">
              <motion.img
                key={current}
                src={screenshots[current].src}
                alt={screenshots[current].caption}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full object-cover"
              />
            </AnimatePresence>
          </div>

          {/* Navigation arrows */}
          <button
            onClick={prev}
            className="absolute top-1/2 left-3 -translate-y-1/2 rounded-full border border-white/10 bg-bg-deep/80 p-2 text-text-secondary backdrop-blur-sm transition-colors hover:text-text-primary"
            aria-label="Previous screenshot"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-white/10 bg-bg-deep/80 p-2 text-text-secondary backdrop-blur-sm transition-colors hover:text-text-primary"
            aria-label="Next screenshot"
          >
            <ChevronRight size={20} />
          </button>

          {/* Dots */}
          <div className="mt-6 flex items-center justify-center gap-2">
            {screenshots.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current
                    ? "w-6 bg-accent-purple"
                    : "w-2 bg-white/20 hover:bg-white/40"
                }`}
                aria-label={`Go to screenshot ${i + 1}`}
              />
            ))}
          </div>

          {/* Caption */}
          <p className="mt-4 text-center text-sm text-text-tertiary">
            {screenshots[current].caption}
          </p>
        </div>
      </div>
    </section>
  )
}
