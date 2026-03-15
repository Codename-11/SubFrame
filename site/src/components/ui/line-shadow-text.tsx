import { motion, type MotionProps } from "motion/react"
import { cn } from "@/lib/utils"

interface LineShadowTextProps
  extends Omit<React.HTMLAttributes<HTMLElement>, keyof MotionProps>,
    MotionProps {
  shadowColor?: string
}

export function LineShadowText({
  children,
  shadowColor = "black",
  className,
  ...props
}: LineShadowTextProps) {
  const content = typeof children === "string" ? children : null

  if (!content) {
    throw new Error("LineShadowText only accepts string content")
  }

  return (
    <motion.span
      className={cn("inline-grid [&>*]:[grid-area:1/1]", className)}
      {...props}
    >
      <span className="relative z-[1]">{content}</span>
      <span
        aria-hidden="true"
        className="z-0 translate-x-[0.09em] translate-y-[0.09em] select-none"
        style={{
          background: `linear-gradient(45deg, transparent 45%, ${shadowColor} 45%, ${shadowColor} 55%, transparent 0)`,
          backgroundSize: "0.06em 0.06em",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          animation: "line-shadow 15s linear infinite",
          pointerEvents: "none",
        }}
      >
        {content}
      </span>
    </motion.span>
  )
}
