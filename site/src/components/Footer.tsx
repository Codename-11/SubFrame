import { Logo } from "@/components/Logo"

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-bg-deep px-6 py-10">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-5">
        {/* Top row — logo, links, license all inline */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <a href="#" className="flex items-center gap-1.5 no-underline">
            <Logo size={22} id="ft" frame={false} animate={false} />
            <span className="text-sm font-bold text-text-primary">SubFrame</span>
          </a>
          <span className="text-text-tertiary/20">·</span>
          <a href="https://sub-frame.dev/docs/" target="_blank" rel="noopener noreferrer" className="text-sm text-text-tertiary transition-colors hover:text-text-secondary no-underline">Docs</a>
          <a href="https://sub-frame.dev/blog/" target="_blank" rel="noopener noreferrer" className="text-sm text-text-tertiary transition-colors hover:text-text-secondary no-underline">Blog</a>
          <a href="https://github.com/Codename-11/SubFrame" target="_blank" rel="noopener noreferrer" className="text-sm text-text-tertiary transition-colors hover:text-text-secondary no-underline">GitHub</a>
          <a href="https://github.com/Codename-11/SubFrame/issues" target="_blank" rel="noopener noreferrer" className="text-sm text-text-tertiary transition-colors hover:text-text-secondary no-underline">Issues</a>
          <span className="text-text-tertiary/20">·</span>
          <span className="text-xs text-text-tertiary">Open source · MIT License</span>
        </div>

        {/* Center — credit */}
        <p className="text-xs text-text-tertiary/60">
          Developed with <span className="text-red-400">♥</span> by Codename_11 // Axiom-Labs
        </p>

        {/* AI tool links */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <a href="https://docs.anthropic.com/en/docs/build-with-claude/claude-code" target="_blank" rel="noopener noreferrer" className="text-[11px] text-text-tertiary/40 transition-colors hover:text-text-secondary no-underline">Claude Code</a>
          <a href="https://github.com/openai/codex" target="_blank" rel="noopener noreferrer" className="text-[11px] text-text-tertiary/40 transition-colors hover:text-text-secondary no-underline">Codex CLI</a>
          <a href="https://github.com/google-gemini/gemini-cli" target="_blank" rel="noopener noreferrer" className="text-[11px] text-text-tertiary/40 transition-colors hover:text-text-secondary no-underline">Gemini CLI</a>
        </div>
      </div>
    </footer>
  )
}
