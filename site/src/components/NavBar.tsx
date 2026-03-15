import { useState } from "react"
import { Menu, X, Github } from "lucide-react"
import { ScrollProgress } from "@/components/ui/scroll-progress"
import { Logo } from "@/components/Logo"

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Showcase", href: "#showcase" },
  { label: "FAQ", href: "#faq" },
  {
    label: "Docs",
    href: "https://sub-frame.dev/docs/",
    external: true,
  },
  {
    label: "Blog",
    href: "https://sub-frame.dev/blog/",
    external: true,
  },
  {
    label: "GitHub",
    href: "https://github.com/Codename-11/SubFrame",
    external: true,
    icon: true,
  },
] as { label: string; href: string; external?: boolean; icon?: boolean }[]

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <ScrollProgress className="z-[60]" />
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-bg-deep/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-2">
          {/* Logo + version */}
          <a href="#" className="flex items-center gap-2 no-underline">
            <Logo size={54} id="nv" frame={false} animate={true} />
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold text-text-primary">
                SubFrame
              </span>
              <span className="text-[10px] font-mono">
                <span className="text-emerald-400">Latest:</span>{" "}
                <span className="text-amber-400">v{__APP_VERSION__}</span>
              </span>
            </div>
          </a>

          {/* Desktop nav */}
          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="text-sm text-text-secondary transition-colors hover:text-text-primary no-underline inline-flex items-center gap-1"
              >
                {"icon" in link && link.icon && <Github size={15} />}
                {link.label}
              </a>
            ))}
            <a
              href="#download"
              className="rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-white/90 no-underline"
            >
              Download
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="text-text-secondary md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="border-t border-white/5 bg-bg-deep/95 px-6 pb-4 pt-2 backdrop-blur-xl md:hidden">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.external ? "_blank" : undefined}
                rel={link.external ? "noopener noreferrer" : undefined}
                className="block py-2 text-sm text-text-secondary transition-colors hover:text-text-primary no-underline"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="#download"
              className="mt-2 block w-full rounded-lg bg-white px-4 py-1.5 text-center text-sm font-semibold text-black transition-colors hover:bg-white/90 no-underline"
              onClick={() => setMobileOpen(false)}
            >
              Download
            </a>
          </div>
        )}
      </nav>
    </>
  )
}
