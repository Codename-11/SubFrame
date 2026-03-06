<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import NavBar from './components/NavBar.vue'
import Footer from './components/Footer.vue'
import TerminalMockup from './components/TerminalMockup.vue'
import FaqAccordion from './components/FaqAccordion.vue'
import LogoSvg from './components/LogoSvg.vue'
import './styles/landing.css'

// Showcase interactive state
const structureView = ref<'graph' | 'mindmap'>('graph')
const taskView = ref<'kanban' | 'timeline' | 'graph'>('kanban')
const usageAnimating = ref(false)
const usageSession = ref(0)
const usageWeekly = ref(0)
const healthUpdating = ref(false)
const healthFixed = ref(false)

function refreshUsage() {
  if (usageAnimating.value) return
  usageAnimating.value = true
  usageSession.value = 0
  usageWeekly.value = 0
  // Animate fill over 800ms
  const start = performance.now()
  const targetSession = 62
  const targetWeekly = 28
  function tick(now: number) {
    const t = Math.min((now - start) / 800, 1)
    const ease = 1 - Math.pow(1 - t, 3) // easeOutCubic
    usageSession.value = Math.round(targetSession * ease)
    usageWeekly.value = Math.round(targetWeekly * ease)
    if (t < 1) requestAnimationFrame(tick)
    else usageAnimating.value = false
  }
  requestAnimationFrame(tick)
}

function updateHealth() {
  if (healthUpdating.value) return
  healthUpdating.value = true
  setTimeout(() => {
    healthFixed.value = true
    healthUpdating.value = false
  }, 600)
}

let observer: IntersectionObserver | null = null
let showcaseObserver: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    },
    { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
  )

  document.querySelectorAll('.fade-in').forEach((el) => {
    observer!.observe(el)
  })

  // Reset showcase interactive state when scrolling away
  showcaseObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) {
        healthFixed.value = false
        usageSession.value = 0
        usageWeekly.value = 0
        structureView.value = 'graph'
        taskView.value = 'kanban'
      }
    },
    { threshold: 0.05 }
  )
  const showcaseEl = document.querySelector('.showcase')
  if (showcaseEl) showcaseObserver.observe(showcaseEl)
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
  showcaseObserver?.disconnect()
  showcaseObserver = null
})

function scrollTo(href: string) {
  const target = document.querySelector(href)
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

const faqItems = [
  {
    question: 'What is SubFrame?',
    answer:
      'SubFrame is a terminal-first development environment built for AI coding tools. It\'s not a code editor like VS Code or Cursor — the center is the terminal, not a text editor. SubFrame standardizes your projects with AGENTS.md, STRUCTURE.json, PROJECT_NOTES.md, and tasks.json so you never lose context between sessions.',
  },
  {
    question: 'How is SubFrame different from VS Code or Cursor?',
    answer:
      'VS Code and Cursor are designed for writing code manually. SubFrame is designed for developers who primarily code through AI tools in the terminal. The terminal is the center — with multi-terminal support (tabs and grid), project standardization, context preservation, and task tracking built in.',
  },
  {
    question: 'Which AI tools are supported?',
    answer:
      'SubFrame supports <strong>Claude Code</strong>, <strong>Codex CLI</strong>, and <strong>Gemini CLI</strong>. You can switch between them with a single click from the toolbar. Each tool gets proper context injection — Claude Code reads CLAUDE.md natively, Gemini CLI reads GEMINI.md natively, and Codex CLI uses a wrapper script that injects AGENTS.md automatically.',
  },
  {
    question: 'What is context preservation?',
    answer:
      'As projects grow, context gets lost between AI sessions — decisions are forgotten, tasks slip through the cracks. SubFrame solves this with a standardized structure: PROJECT_NOTES.md captures decisions as they happen, tasks.json tracks work, and STRUCTURE.json maps your codebase. The AI reads these at the start of each session, so it always knows the full context.',
  },
  {
    question: 'How do I set up a project?',
    answer:
      'Open your project in SubFrame and click <strong>Initialize Workspace</strong> (or run <code>subframe init</code> from the CLI). This creates AGENTS.md, STRUCTURE.json, PROJECT_NOTES.md, task tracking, and hooks — everything your AI tools need to understand your project. Existing files are never overwritten.',
  },
  {
    question: 'What are hooks and skills?',
    answer:
      '<strong>Hooks</strong> run automatically during your AI sessions — injecting context at startup, matching prompts to tasks, and reminding you of in-progress work. <strong>Skills</strong> are slash commands (<code>/sub-tasks</code>, <code>/sub-audit</code>, <code>/sub-docs</code>, <code>/release</code>) that give your AI specialized capabilities for task management, code review, documentation sync, and releases.',
  },
  {
    question: 'Can I run SubFrame on Windows and Linux?',
    answer:
      'Yes. SubFrame is built with Electron, so it runs on macOS, Windows, and Linux. On Windows it uses PowerShell Core (or falls back to Windows PowerShell), and on macOS/Linux it uses your default shell (zsh, bash, fish, etc.).',
  },
  {
    question: 'Can I run SubFrame as a web app on a remote server?',
    answer:
      'Not yet, but it\'s on the roadmap as "SubFrame Server". Since SubFrame uses web technologies (xterm.js, HTML/CSS), converting to a web app (like code-server) is technically feasible. The main change would be replacing Electron IPC with WebSocket communication. Stay tuned!',
  },
]
</script>

<template>
  <div class="sf-landing">
    <!-- Navigation -->
    <NavBar />

    <!-- Hero -->
    <section class="hero">
      <div class="container">
        <div class="hero-content">
          <div class="hero-badge">
            <span>Claude &middot; Codex &middot; Gemini</span>
          </div>

          <div class="hero-beta-badge">
            <span class="beta-dot"></span>
            Public Beta &mdash; Help us test and shape SubFrame
          </div>

          <div class="hero-logo" aria-hidden="true">
            <LogoSvg :size="120" id="hero" :frame="true" />
          </div>

          <h1 class="hero-title">
            Code with<br /><em>intelligence</em>
          </h1>

          <p class="hero-subtitle">
            SubFrame is a terminal-first development environment for AI coding tools.
            Supports Claude Code, Codex CLI, and Gemini CLI — all in one place.
          </p>

          <div class="hero-actions">
            <a href="#download" class="btn btn-accent btn-large" @click.prevent="scrollTo('#download')">
              Download for macOS &amp; Windows
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
            <a href="https://github.com/Codename-11/SubFrame" class="btn btn-outline btn-large">
              View on GitHub
            </a>
          </div>
        </div>

        <!-- Terminal Preview -->
        <TerminalMockup />
      </div>
    </section>

    <!-- Features -->
    <section class="features" id="features">
      <div class="container">
        <div class="section-label fade-in">Features</div>
        <h2 class="section-title fade-in">Everything you need<br />to build faster</h2>
        <p class="section-subtitle fade-in">
          SubFrame combines a terminal-first workflow with your favorite AI coding tool, giving you
          superpowers for understanding and writing code.
        </p>

        <div class="features-grid">
          <div class="feature-card fade-in">
            <div class="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </div>
            <h3 class="feature-title">Multi-Terminal</h3>
            <p class="feature-description">
              Run multiple terminals with different shells. Switch between zsh, bash, fish, or any
              shell you prefer.
            </p>
          </div>

          <div class="feature-card fade-in">
            <div class="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polygon points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3 class="feature-title">Structure Map</h3>
            <p class="feature-description">
              Interactive D3.js visualization of your project's modules and dependencies. See how
              everything connects.
            </p>
          </div>

          <div class="feature-card fade-in">
            <div class="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </div>
            <h3 class="feature-title">Git History</h3>
            <p class="feature-description">
              See who contributed to each file, view commit history, and understand code ownership at
              a glance.
            </p>
          </div>

          <div class="feature-card fade-in">
            <div class="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <h3 class="feature-title">Task Management</h3>
            <p class="feature-description">
              Built-in task panel to track your todos. Integrate with your workflow and never lose
              track of what needs to be done.
            </p>
          </div>

          <div class="feature-card fade-in">
            <div class="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <h3 class="feature-title">Plugin System</h3>
            <p class="feature-description">
              Extend SubFrame with plugins. Add new features, integrations, and capabilities to match
              your workflow.
            </p>
          </div>

          <div class="feature-card fade-in">
            <div class="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <h3 class="feature-title">Multi-AI Support</h3>
            <p class="feature-description">
              Switch between Claude Code, Codex CLI, and Gemini CLI with a single click. Use the
              best AI tool for each task.
            </p>
          </div>

          <div class="feature-card fade-in">
            <div class="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h3 class="feature-title">One-Click Init</h3>
            <p class="feature-description">
              Initialize any project with AGENTS.md, codebase mapping, task tracking, and AI tool
              integration. One command sets up everything.
            </p>
          </div>

          <div class="feature-card fade-in">
            <div class="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              </svg>
            </div>
            <h3 class="feature-title">Hooks &amp; Automation</h3>
            <p class="feature-description">
              Context injection at session start, task matching on every prompt, and reminders when
              you stop. Your AI always knows the project state.
            </p>
          </div>

          <div class="feature-card fade-in">
            <div class="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h3 class="feature-title">Health &amp; Audit</h3>
            <p class="feature-description">
              See every SubFrame component's status at a glance. Update outdated hooks, skills, and
              config with one click. Clean uninstall when needed.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Showcase -->
    <section class="showcase" id="showcase">
      <div class="container">
        <div class="showcase-header">
          <div class="section-label fade-in">Showcase</div>
          <h2 class="section-title fade-in">See SubFrame in action</h2>
        </div>

        <div class="showcase-grid">
          <div class="showcase-card fade-in">
            <div class="showcase-image structure-map-image">
              <!-- View tabs -->
              <div class="structure-tabs" role="tablist">
                <button role="tab" :aria-selected="structureView === 'graph'" :class="{ active: structureView === 'graph' }" @click="structureView = 'graph'">Graph</button>
                <button role="tab" :aria-selected="structureView === 'mindmap'" :class="{ active: structureView === 'mindmap' }" @click="structureView = 'mindmap'">Mindmap</button>
              </div>

              <!-- Graph view (force-directed) -->
              <div v-show="structureView === 'graph'" class="graph-preview">
                <svg viewBox="0 0 200 130" fill="none" class="structure-svg">
                  <!-- Connection lines -->
                  <line x1="100" y1="35" x2="55" y2="85" stroke="var(--sf-logo-purple)" stroke-width="1" opacity="0.4" />
                  <line x1="100" y1="35" x2="145" y2="85" stroke="var(--sf-logo-pink)" stroke-width="1" opacity="0.4" />
                  <line x1="55" y1="85" x2="145" y2="85" stroke="var(--sf-logo-cyan)" stroke-width="1" opacity="0.4" stroke-dasharray="3 2" />
                  <line x1="100" y1="35" x2="100" y2="115" stroke="var(--sf-border-hover)" stroke-width="0.5" opacity="0.3" />
                  <!-- main node -->
                  <circle cx="100" cy="35" r="16" fill="rgba(245,158,11,0.15)" stroke="var(--sf-accent)" stroke-width="1.5">
                    <animate attributeName="r" values="16;17.5;16" dur="3s" repeatCount="indefinite" />
                  </circle>
                  <text x="100" y="38" fill="var(--sf-accent)" font-size="7" font-family="var(--sf-font-mono)" text-anchor="middle">main</text>
                  <!-- renderer node -->
                  <circle cx="55" cy="85" r="13" fill="rgba(180,128,255,0.15)" stroke="var(--sf-logo-purple)" stroke-width="1.5">
                    <animate attributeName="r" values="13;14.5;13" dur="3.5s" repeatCount="indefinite" />
                  </circle>
                  <text x="55" y="88" fill="var(--sf-logo-purple)" font-size="6.5" font-family="var(--sf-font-mono)" text-anchor="middle">renderer</text>
                  <!-- shared node -->
                  <circle cx="145" cy="85" r="11" fill="rgba(100,216,255,0.15)" stroke="var(--sf-logo-cyan)" stroke-width="1.5">
                    <animate attributeName="r" values="11;12.5;11" dur="4s" repeatCount="indefinite" />
                  </circle>
                  <text x="145" y="88" fill="var(--sf-logo-cyan)" font-size="6.5" font-family="var(--sf-font-mono)" text-anchor="middle">shared</text>
                  <!-- utils node -->
                  <circle cx="100" cy="115" r="8" fill="rgba(34,197,94,0.15)" style="stroke: var(--sf-color-success)" stroke-width="1">
                    <animate attributeName="r" values="8;9;8" dur="3.8s" repeatCount="indefinite" />
                  </circle>
                  <text x="100" y="118" style="fill: var(--sf-color-success)" font-size="5.5" font-family="var(--sf-font-mono)" text-anchor="middle">utils</text>
                </svg>
              </div>

              <!-- Mindmap view -->
              <div v-show="structureView === 'mindmap'" class="mindmap-preview">
                <svg viewBox="0 0 200 130" fill="none" class="structure-svg">
                  <!-- Center node -->
                  <circle cx="100" cy="65" r="18" fill="rgba(255,110,180,0.12)" stroke="var(--sf-logo-pink)" stroke-width="1.5">
                    <animate attributeName="r" values="18;19.5;18" dur="3s" repeatCount="indefinite" />
                  </circle>
                  <text x="100" y="63" fill="var(--sf-logo-pink)" font-size="5.5" font-family="var(--sf-font-mono)" text-anchor="middle">SubFrame</text>
                  <text x="100" y="71" fill="var(--sf-text-tertiary)" font-size="4" font-family="var(--sf-font-mono)" text-anchor="middle">root</text>
                  <!-- Branch lines -->
                  <path d="M118,60 Q140,40 160,30" stroke="var(--sf-accent)" stroke-width="1" fill="none" opacity="0.5" />
                  <path d="M118,70 Q140,90 160,100" stroke="var(--sf-logo-purple)" stroke-width="1" fill="none" opacity="0.5" />
                  <path d="M82,60 Q60,40 40,30" stroke="var(--sf-logo-cyan)" stroke-width="1" fill="none" opacity="0.5" />
                  <path d="M82,70 Q60,90 40,100" style="stroke: var(--sf-color-success)" stroke-width="1" fill="none" opacity="0.5" />
                  <!-- Branch nodes -->
                  <circle cx="165" cy="28" r="10" fill="rgba(245,158,11,0.12)" stroke="var(--sf-accent)" stroke-width="1" />
                  <text x="165" y="31" fill="var(--sf-accent)" font-size="5" font-family="var(--sf-font-mono)" text-anchor="middle">main</text>
                  <circle cx="165" cy="102" r="10" fill="rgba(180,128,255,0.12)" stroke="var(--sf-logo-purple)" stroke-width="1" />
                  <text x="165" y="105" fill="var(--sf-logo-purple)" font-size="5" font-family="var(--sf-font-mono)" text-anchor="middle">render</text>
                  <circle cx="35" cy="28" r="10" fill="rgba(100,216,255,0.12)" stroke="var(--sf-logo-cyan)" stroke-width="1" />
                  <text x="35" y="31" fill="var(--sf-logo-cyan)" font-size="5" font-family="var(--sf-font-mono)" text-anchor="middle">shared</text>
                  <circle cx="35" cy="102" r="10" fill="rgba(34,197,94,0.12)" style="stroke: var(--sf-color-success)" stroke-width="1" />
                  <text x="35" y="105" style="fill: var(--sf-color-success)" font-size="5" font-family="var(--sf-font-mono)" text-anchor="middle">tests</text>
                </svg>
              </div>
            </div>
            <div class="showcase-content">
              <h3 class="showcase-title">Interactive Structure Map</h3>
              <p class="showcase-description">
                Visualize your codebase in multiple views — force-directed graph, kanban board, or
                mindmap. Drag nodes, zoom in, and explore module dependencies.
              </p>
            </div>
          </div>

          <div class="showcase-card fade-in">
            <div class="showcase-image">
              <svg viewBox="0 0 200 120" fill="none">
                <text x="20" y="16" fill="var(--sf-text-primary)" font-size="8" font-weight="600" font-family="var(--sf-font-mono)">Usage Tracking</text>

                <text x="20" y="35" fill="var(--sf-text-secondary)" font-size="7" font-family="var(--sf-font-mono)">Session Usage</text>
                <rect x="20" y="40" width="160" height="8" rx="4" fill="var(--sf-bg-primary)" />
                <rect x="20" y="40" :width="usageSession * 160 / 100" height="8" rx="4" fill="var(--sf-accent)">
                  <animate v-if="usageSession === 0" attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
                </rect>
                <text :x="24 + usageSession * 160 / 100" y="47" fill="var(--sf-text-tertiary)" font-size="6" font-family="var(--sf-font-mono)">{{ usageSession }}%</text>

                <text x="20" y="65" fill="var(--sf-text-secondary)" font-size="7" font-family="var(--sf-font-mono)">Weekly Usage</text>
                <rect x="20" y="70" width="160" height="8" rx="4" fill="var(--sf-bg-primary)" />
                <rect x="20" y="70" :width="usageWeekly * 160 / 100" height="8" rx="4" style="fill: var(--sf-color-success)">
                  <animate v-if="usageWeekly === 0" attributeName="opacity" values="0.3;0.6;0.3" dur="2s" repeatCount="indefinite" />
                </rect>
                <text :x="24 + usageWeekly * 160 / 100" y="77" fill="var(--sf-text-tertiary)" font-size="6" font-family="var(--sf-font-mono)">{{ usageWeekly }}%</text>

                <rect x="20" y="92" width="60" height="20" rx="6" fill="var(--sf-accent-subtle)" stroke="var(--sf-accent)" stroke-width="0.5" class="showcase-btn" @click="refreshUsage" @keydown.enter="refreshUsage" @keydown.space.prevent="refreshUsage" tabindex="0" role="button" aria-label="Refresh usage data" style="cursor:pointer" />
                <text x="50" y="105" fill="var(--sf-accent)" font-size="7" font-family="var(--sf-font-mono)" text-anchor="middle" style="pointer-events:none">{{ usageAnimating ? '...' : 'Refresh' }}</text>
              </svg>
            </div>
            <div class="showcase-content">
              <h3 class="showcase-title">Usage Tracking</h3>
              <p class="showcase-description">
                Monitor API usage across sessions in real-time. See session and weekly utilization
                with animated progress bars and automatic reset tracking.
              </p>
            </div>
          </div>

          <div class="showcase-card fade-in">
            <div class="showcase-image">
              <svg viewBox="0 0 200 140" fill="none">
                <defs>
                  <filter id="health-glow-g" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="2" result="b" />
                    <feComposite in="SourceGraphic" in2="b" operator="over" />
                  </filter>
                  <filter id="health-glow-w" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="2" result="b" />
                    <feComposite in="SourceGraphic" in2="b" operator="over" />
                  </filter>
                </defs>

                <!-- Header -->
                <text x="20" y="20" fill="var(--sf-text-primary)" font-size="9" font-weight="600" font-family="var(--sf-font-mono)">SubFrame Health</text>
                <rect x="130" y="10" width="50" height="16" rx="8" fill="var(--sf-accent-subtle)" stroke="var(--sf-accent)" stroke-width="0.5" />
                <text x="155" y="21" fill="var(--sf-accent)" font-size="7" font-family="var(--sf-font-mono)" text-anchor="middle">{{ healthFixed ? '12/12' : '11/12' }}</text>

                <!-- Row 1: Healthy -->
                <circle cx="28" cy="45" r="4" style="fill: var(--sf-color-success)" filter="url(#health-glow-g)">
                  <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite" />
                </circle>
                <text x="38" y="48" fill="var(--sf-text-secondary)" font-size="7" font-family="var(--sf-font-mono)">AGENTS.md</text>
                <rect x="120" y="38" width="50" height="14" rx="7" fill="rgba(34,197,94,0.15)" />
                <text x="145" y="48" style="fill: var(--sf-color-success)" font-size="6" font-family="var(--sf-font-mono)" text-anchor="middle">Healthy</text>

                <!-- Row 2: Outdated → Healthy on update -->
                <circle cx="28" cy="70" r="4" :style="{ fill: healthFixed ? 'var(--sf-color-success)' : 'var(--sf-color-warning)' }" :filter="healthFixed ? 'url(#health-glow-g)' : 'url(#health-glow-w)'">
                  <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite" />
                </circle>
                <text x="38" y="73" fill="var(--sf-text-secondary)" font-size="7" font-family="var(--sf-font-mono)">SessionStart hook</text>
                <rect x="120" y="63" width="50" height="14" rx="7" :fill="healthFixed ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)'" />
                <text x="145" y="73" :style="{ fill: healthFixed ? 'var(--sf-color-success)' : 'var(--sf-color-warning)' }" font-size="6" font-family="var(--sf-font-mono)" text-anchor="middle">{{ healthFixed ? 'Healthy' : 'Outdated' }}</text>

                <!-- Row 3: Healthy -->
                <circle cx="28" cy="95" r="4" style="fill: var(--sf-color-success)" filter="url(#health-glow-g)">
                  <animate attributeName="r" values="4;5;4" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.7;1" dur="2s" repeatCount="indefinite" />
                </circle>
                <text x="38" y="98" fill="var(--sf-text-secondary)" font-size="7" font-family="var(--sf-font-mono)">/sub-tasks skill</text>
                <rect x="120" y="88" width="50" height="14" rx="7" fill="rgba(34,197,94,0.15)" />
                <text x="145" y="98" style="fill: var(--sf-color-success)" font-size="6" font-family="var(--sf-font-mono)" text-anchor="middle">Healthy</text>

                <!-- Update button -->
                <rect x="20" y="115" width="70" height="20" rx="6" fill="var(--sf-accent-subtle)" stroke="var(--sf-accent)" stroke-width="0.5" class="showcase-btn" @click="updateHealth" @keydown.enter="updateHealth" @keydown.space.prevent="updateHealth" tabindex="0" role="button" aria-label="Update all components" style="cursor:pointer" />
                <text x="55" y="128" fill="var(--sf-accent)" font-size="7" font-family="var(--sf-font-mono)" text-anchor="middle" style="pointer-events:none">{{ healthUpdating ? 'Updating...' : healthFixed ? 'All Good' : 'Update All' }}</text>
              </svg>
            </div>
            <div class="showcase-content">
              <h3 class="showcase-title">Health Dashboard</h3>
              <p class="showcase-description">
                Monitor every SubFrame component — core files, hooks, skills, and git integration.
                Pulsing status indicators and one-click updates keep everything current.
              </p>
            </div>
          </div>

          <div class="showcase-card fade-in">
            <div class="showcase-image">
              <svg viewBox="0 0 200 140" fill="none">
                <defs>
                  <filter id="agent-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feComposite in="SourceGraphic" in2="b" operator="over" />
                  </filter>
                  <linearGradient id="timeline-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--sf-logo-purple)" />
                    <stop offset="50%" stop-color="var(--sf-logo-pink)" />
                    <stop offset="100%" stop-color="var(--sf-logo-cyan)" />
                  </linearGradient>
                </defs>

                <!-- Header -->
                <text x="20" y="18" fill="var(--sf-text-primary)" font-size="9" font-weight="600" font-family="var(--sf-font-mono)">Agent Activity</text>
                <!-- Active badge with pulse -->
                <circle cx="134" cy="15" r="3" style="fill: var(--sf-color-success)" filter="url(#agent-glow)">
                  <animate attributeName="r" values="3;4;3" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.6;1" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <text x="142" y="18" style="fill: var(--sf-color-success)" font-size="7" font-family="var(--sf-font-mono)">active</text>

                <!-- Timeline line with gradient -->
                <line x1="32" y1="35" x2="32" y2="128" stroke="url(#timeline-grad)" stroke-width="1.5" opacity="0.4" />

                <!-- Step 1: Read -->
                <circle cx="32" cy="42" r="5" fill="var(--sf-logo-cyan)" filter="url(#agent-glow)">
                  <animate attributeName="r" values="5;6;5" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <text x="44" y="39" fill="var(--sf-logo-cyan)" font-size="6" font-weight="600" font-family="var(--sf-font-mono)">Read</text>
                <text x="44" y="48" fill="var(--sf-text-secondary)" font-size="7" font-family="var(--sf-font-mono)">src/main/index.ts</text>
                <text x="168" y="44" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)">2s ago</text>

                <!-- Step 2: Edit -->
                <circle cx="32" cy="72" r="5" fill="var(--sf-logo-purple)" filter="url(#agent-glow)">
                  <animate attributeName="r" values="5;6;5" dur="2.8s" repeatCount="indefinite" />
                </circle>
                <text x="44" y="69" fill="var(--sf-logo-purple)" font-size="6" font-weight="600" font-family="var(--sf-font-mono)">Edit</text>
                <text x="44" y="78" fill="var(--sf-text-secondary)" font-size="7" font-family="var(--sf-font-mono)">src/main/pty.ts</text>
                <text x="168" y="74" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)">5s ago</text>

                <!-- Step 3: Bash -->
                <circle cx="32" cy="102" r="5" fill="var(--sf-logo-pink)" filter="url(#agent-glow)">
                  <animate attributeName="r" values="5;6;5" dur="3s" repeatCount="indefinite" />
                </circle>
                <text x="44" y="99" fill="var(--sf-logo-pink)" font-size="6" font-weight="600" font-family="var(--sf-font-mono)">Bash</text>
                <text x="44" y="108" fill="var(--sf-text-secondary)" font-size="7" font-family="var(--sf-font-mono)">npm test</text>
                <text x="168" y="104" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)">8s ago</text>

                <!-- Current action indicator -->
                <circle cx="32" cy="125" r="3" fill="var(--sf-accent)" opacity="0.6">
                  <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
                </circle>
                <text x="44" y="128" fill="var(--sf-text-tertiary)" font-size="6" font-family="var(--sf-font-mono)" font-style="italic">thinking...</text>
              </svg>
            </div>
            <div class="showcase-content">
              <h3 class="showcase-title">Agent Activity Monitor</h3>
              <p class="showcase-description">
                Watch your AI agent work in real-time. Every tool call appears as a color-coded
                timeline entry. Review past sessions to understand what changed.
              </p>
            </div>
          </div>

          <div class="showcase-card fade-in">
            <div class="showcase-image structure-map-image">
              <!-- Task view tabs -->
              <div class="structure-tabs" role="tablist">
                <button role="tab" :aria-selected="taskView === 'kanban'" :class="{ active: taskView === 'kanban' }" @click="taskView = 'kanban'">Kanban</button>
                <button role="tab" :aria-selected="taskView === 'timeline'" :class="{ active: taskView === 'timeline' }" @click="taskView = 'timeline'">Timeline</button>
                <button role="tab" :aria-selected="taskView === 'graph'" :class="{ active: taskView === 'graph' }" @click="taskView = 'graph'">Graph</button>
              </div>

              <!-- Kanban view -->
              <div v-show="taskView === 'kanban'" class="kanban-preview">
                <svg viewBox="0 0 200 130" fill="none" class="structure-svg">
                  <!-- Column headers -->
                  <rect x="8" y="6" width="56" height="14" rx="3" fill="rgba(113,113,122,0.15)" />
                  <text x="36" y="16" fill="var(--sf-text-tertiary)" font-size="6" font-family="var(--sf-font-mono)" text-anchor="middle">Pending</text>
                  <rect x="72" y="6" width="56" height="14" rx="3" fill="rgba(245,158,11,0.15)" />
                  <text x="100" y="16" fill="var(--sf-accent)" font-size="6" font-family="var(--sf-font-mono)" text-anchor="middle">In Progress</text>
                  <rect x="136" y="6" width="56" height="14" rx="3" fill="rgba(34,197,94,0.15)" />
                  <text x="164" y="16" style="fill: var(--sf-color-success)" font-size="6" font-family="var(--sf-font-mono)" text-anchor="middle">Done</text>
                  <!-- Dividers -->
                  <line x1="67" y1="4" x2="67" y2="125" stroke="var(--sf-border)" stroke-width="0.5" />
                  <line x1="131" y1="4" x2="131" y2="125" stroke="var(--sf-border)" stroke-width="0.5" />
                  <!-- Pending cards -->
                  <rect x="12" y="26" width="48" height="22" rx="4" fill="var(--sf-bg-card)" stroke="var(--sf-border)" stroke-width="0.5" />
                  <text x="16" y="35" fill="var(--sf-text-secondary)" font-size="5" font-family="var(--sf-font-mono)">Git status</text>
                  <text x="16" y="43" fill="var(--sf-text-tertiary)" font-size="4" font-family="var(--sf-font-mono)">medium</text>
                  <rect x="12" y="52" width="48" height="22" rx="4" fill="var(--sf-bg-card)" stroke="var(--sf-border)" stroke-width="0.5" />
                  <text x="16" y="61" fill="var(--sf-text-secondary)" font-size="5" font-family="var(--sf-font-mono)">Cmd palette</text>
                  <text x="16" y="69" fill="var(--sf-text-tertiary)" font-size="4" font-family="var(--sf-font-mono)">low</text>
                  <!-- In Progress cards -->
                  <rect x="76" y="26" width="48" height="22" rx="4" fill="var(--sf-bg-card)" stroke="var(--sf-accent)" stroke-width="0.8" />
                  <text x="80" y="35" fill="var(--sf-accent)" font-size="5" font-family="var(--sf-font-mono)">Task UX</text>
                  <text x="80" y="43" fill="var(--sf-text-tertiary)" font-size="4" font-family="var(--sf-font-mono)">high</text>
                  <!-- Done cards -->
                  <rect x="140" y="26" width="48" height="22" rx="4" fill="var(--sf-bg-card)" stroke="rgba(34,197,94,0.3)" stroke-width="0.5" />
                  <text x="144" y="35" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)" text-decoration="line-through">Init flow</text>
                  <text x="144" y="43" fill="var(--sf-text-tertiary)" font-size="4" font-family="var(--sf-font-mono)">completed</text>
                  <rect x="140" y="52" width="48" height="22" rx="4" fill="var(--sf-bg-card)" stroke="rgba(34,197,94,0.3)" stroke-width="0.5" />
                  <text x="144" y="61" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)" text-decoration="line-through">Health panel</text>
                  <text x="144" y="69" fill="var(--sf-text-tertiary)" font-size="4" font-family="var(--sf-font-mono)">completed</text>
                </svg>
              </div>

              <!-- Timeline view -->
              <div v-show="taskView === 'timeline'" class="timeline-preview">
                <svg viewBox="0 0 200 130" fill="none" class="structure-svg">
                  <!-- Timeline axis -->
                  <line x1="20" y1="110" x2="185" y2="110" stroke="var(--sf-border-hover)" stroke-width="1" />
                  <!-- Date labels -->
                  <text x="30" y="122" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)">Feb 24</text>
                  <text x="80" y="122" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)">Feb 26</text>
                  <text x="130" y="122" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)">Feb 28</text>
                  <text x="170" y="122" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)">Mar 1</text>
                  <!-- Completed task bar -->
                  <rect x="25" y="20" width="70" height="14" rx="4" fill="rgba(34,197,94,0.2)" style="stroke: var(--sf-color-success)" stroke-width="0.5" />
                  <text x="30" y="30" style="fill: var(--sf-color-success)" font-size="5" font-family="var(--sf-font-mono)">Init flow</text>
                  <!-- Completed task bar 2 -->
                  <rect x="50" y="40" width="55" height="14" rx="4" fill="rgba(34,197,94,0.2)" style="stroke: var(--sf-color-success)" stroke-width="0.5" />
                  <text x="55" y="50" style="fill: var(--sf-color-success)" font-size="5" font-family="var(--sf-font-mono)">Health panel</text>
                  <!-- In progress bar -->
                  <rect x="90" y="60" width="60" height="14" rx="4" fill="rgba(245,158,11,0.2)" stroke="var(--sf-accent)" stroke-width="0.8">
                    <animate attributeName="width" values="60;65;60" dur="3s" repeatCount="indefinite" />
                  </rect>
                  <text x="95" y="70" fill="var(--sf-accent)" font-size="5" font-family="var(--sf-font-mono)">Task UX</text>
                  <!-- Pending bars -->
                  <rect x="140" y="80" width="40" height="14" rx="4" fill="rgba(113,113,122,0.1)" stroke="var(--sf-border)" stroke-width="0.5" stroke-dasharray="3 2" />
                  <text x="145" y="90" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)">Git status</text>
                </svg>
              </div>

              <!-- Graph (dependency) view -->
              <div v-show="taskView === 'graph'" class="graph-preview">
                <svg viewBox="0 0 200 130" fill="none" class="structure-svg">
                  <!-- Dependency arrows -->
                  <defs>
                    <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                      <path d="M0,0 L6,3 L0,6 z" fill="var(--sf-text-tertiary)" />
                    </marker>
                  </defs>
                  <!-- Init flow → Task UX -->
                  <line x1="78" y1="35" x2="100" y2="65" stroke="var(--sf-text-tertiary)" stroke-width="0.8" marker-end="url(#arrow)" opacity="0.5" />
                  <!-- Init flow → Health panel -->
                  <line x1="55" y1="42" x2="55" y2="85" stroke="var(--sf-text-tertiary)" stroke-width="0.8" marker-end="url(#arrow)" opacity="0.5" />
                  <!-- Task UX → Git status -->
                  <line x1="140" y1="72" x2="155" y2="30" stroke="var(--sf-text-tertiary)" stroke-width="0.8" marker-end="url(#arrow)" opacity="0.5" stroke-dasharray="3 2" />
                  <!-- Init flow node (completed) -->
                  <rect x="25" y="18" width="60" height="22" rx="6" fill="rgba(34,197,94,0.12)" style="stroke: var(--sf-color-success)" stroke-width="1" />
                  <text x="55" y="32" style="fill: var(--sf-color-success)" font-size="6" font-family="var(--sf-font-mono)" text-anchor="middle">Init flow</text>
                  <!-- Task UX node (in progress) -->
                  <rect x="90" y="58" width="60" height="22" rx="6" fill="rgba(245,158,11,0.12)" stroke="var(--sf-accent)" stroke-width="1">
                    <animate attributeName="stroke-opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
                  </rect>
                  <text x="120" y="72" fill="var(--sf-accent)" font-size="6" font-family="var(--sf-font-mono)" text-anchor="middle">Task UX</text>
                  <!-- Health panel node (completed) -->
                  <rect x="25" y="88" width="60" height="22" rx="6" fill="rgba(34,197,94,0.12)" style="stroke: var(--sf-color-success)" stroke-width="1" />
                  <text x="55" y="102" style="fill: var(--sf-color-success)" font-size="6" font-family="var(--sf-font-mono)" text-anchor="middle">Health panel</text>
                  <!-- Git status node (pending, depends on Task UX) -->
                  <rect x="130" y="18" width="55" height="22" rx="6" fill="rgba(113,113,122,0.08)" stroke="var(--sf-border)" stroke-width="0.8" stroke-dasharray="3 2" />
                  <text x="157" y="32" fill="var(--sf-text-tertiary)" font-size="6" font-family="var(--sf-font-mono)" text-anchor="middle">Git status</text>
                </svg>
              </div>
            </div>
            <div class="showcase-content">
              <h3 class="showcase-title">Sub-Task Management</h3>
              <p class="showcase-description">
                Track work across kanban boards, Gantt timelines, and dependency graphs. Tasks
                persist as markdown files — your AI reads them at every session start.
              </p>
            </div>
          </div>

          <div class="showcase-card fade-in">
            <div class="showcase-image">
              <svg viewBox="0 0 200 140" fill="none">
                <!-- Header -->
                <text x="20" y="18" fill="var(--sf-text-primary)" font-size="9" font-weight="600" font-family="var(--sf-font-mono)">Project Overview</text>

                <!-- Stats row -->
                <rect x="20" y="28" width="38" height="26" rx="5" fill="var(--sf-bg-primary)" stroke="var(--sf-border)" stroke-width="0.5" />
                <text x="39" y="38" fill="var(--sf-accent)" font-size="10" font-weight="700" font-family="var(--sf-font-mono)" text-anchor="middle">36</text>
                <text x="39" y="48" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)" text-anchor="middle">modules</text>

                <rect x="64" y="28" width="38" height="26" rx="5" fill="var(--sf-bg-primary)" stroke="var(--sf-border)" stroke-width="0.5" />
                <text x="83" y="38" fill="var(--sf-logo-purple)" font-size="10" font-weight="700" font-family="var(--sf-font-mono)" text-anchor="middle">15</text>
                <text x="83" y="48" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)" text-anchor="middle">IPC</text>

                <rect x="108" y="28" width="38" height="26" rx="5" fill="var(--sf-bg-primary)" stroke="var(--sf-border)" stroke-width="0.5" />
                <text x="127" y="38" fill="var(--sf-logo-cyan)" font-size="10" font-weight="700" font-family="var(--sf-font-mono)" text-anchor="middle">5</text>
                <text x="127" y="48" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)" text-anchor="middle">hooks</text>

                <rect x="152" y="28" width="38" height="26" rx="5" fill="var(--sf-bg-primary)" stroke="var(--sf-border)" stroke-width="0.5" />
                <text x="171" y="38" fill="var(--sf-logo-pink)" font-size="10" font-weight="700" font-family="var(--sf-font-mono)" text-anchor="middle">4</text>
                <text x="171" y="48" fill="var(--sf-text-tertiary)" font-size="5" font-family="var(--sf-font-mono)" text-anchor="middle">skills</text>

                <!-- Decisions section -->
                <text x="20" y="70" fill="var(--sf-text-secondary)" font-size="7" font-weight="600" font-family="var(--sf-font-mono)">Recent Decisions</text>
                <line x1="20" y1="74" x2="180" y2="74" stroke="var(--sf-border)" stroke-width="0.5" />

                <circle cx="28" cy="86" r="2" fill="var(--sf-accent)" />
                <text x="36" y="89" fill="var(--sf-text-secondary)" font-size="6" font-family="var(--sf-font-mono)">Migrated renderer to React 19 + Zustand</text>

                <circle cx="28" cy="100" r="2" fill="var(--sf-logo-purple)" />
                <text x="36" y="103" fill="var(--sf-text-secondary)" font-size="6" font-family="var(--sf-font-mono)">Adopted Tailwind CSS v4 design system</text>

                <circle cx="28" cy="114" r="2" fill="var(--sf-logo-cyan)" />
                <text x="36" y="117" fill="var(--sf-text-secondary)" font-size="6" font-family="var(--sf-font-mono)">Tasks stored as markdown + YAML frontmatter</text>

                <!-- Context badge -->
                <rect x="130" y="124" width="55" height="12" rx="6" fill="var(--sf-accent-subtle)" stroke="var(--sf-accent)" stroke-width="0.4" />
                <text x="157" y="133" fill="var(--sf-accent)" font-size="5" font-family="var(--sf-font-mono)" text-anchor="middle">context preserved</text>
              </svg>
            </div>
            <div class="showcase-content">
              <h3 class="showcase-title">Project Overview</h3>
              <p class="showcase-description">
                See your project at a glance — module count, IPC channels, hooks, skills, and recent
                architecture decisions. Context that persists across every AI session.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section class="stats">
      <div class="container">
        <div class="stats-grid">
          <div class="stat-item fade-in">
            <div class="stat-value">36+</div>
            <div class="stat-label">Modules</div>
          </div>
          <div class="stat-item fade-in">
            <div class="stat-value">15+</div>
            <div class="stat-label">IPC Channels</div>
          </div>
          <div class="stat-item fade-in">
            <div class="stat-value">&infin;</div>
            <div class="stat-label">Possibilities</div>
          </div>
          <div class="stat-item fade-in">
            <div class="stat-value">3</div>
            <div class="stat-label">AI Tools</div>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="faq" id="faq">
      <div class="container">
        <div class="section-label fade-in">FAQ</div>
        <h2 class="section-title fade-in">Frequently asked<br />questions</h2>
        <FaqAccordion :items="faqItems" />
      </div>
    </section>

    <!-- Community -->
    <section class="community" id="community">
      <div class="container">
        <div class="section-label fade-in">Community</div>
        <h2 class="section-title fade-in">Built in the open,<br />shaped by you</h2>
        <p class="section-subtitle fade-in">
          SubFrame is under active development. We need testers, feedback, and contributors to make it great.
        </p>

        <div class="community-grid">
          <div class="community-card fade-in">
            <div class="community-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </div>
            <h3 class="community-title">Try It Out</h3>
            <p class="community-description">
              Download, install, and put SubFrame through its paces with your real projects. Every rough edge you find helps us improve.
            </p>
          </div>

          <div class="community-card fade-in">
            <div class="community-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <h3 class="community-title">Report &amp; Request</h3>
            <p class="community-description">
              Found a bug? Have an idea? <a href="https://github.com/Codename-11/SubFrame/issues/new" target="_blank" rel="noopener noreferrer">Open an issue</a> — every report and feature request helps shape the roadmap.
            </p>
          </div>

          <div class="community-card fade-in">
            <div class="community-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            </div>
            <h3 class="community-title">Contribute</h3>
            <p class="community-description">
              Bug fixes, features, docs improvements — all welcome. Fork, branch, and <a href="https://github.com/Codename-11/SubFrame" target="_blank" rel="noopener noreferrer">open a PR</a>. We review everything promptly.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="cta" id="download">
      <div class="container">
        <div class="cta-content">
          <h2 class="cta-title fade-in">
            Ready to code<br /><em>smarter?</em>
          </h2>
          <p class="cta-subtitle fade-in">
            SubFrame is free and open source. Download for macOS or Windows, or build from source.
          </p>
          <div class="cta-actions fade-in">
            <a href="https://github.com/Codename-11/SubFrame/releases" class="btn btn-accent btn-large">
              Download SubFrame
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
            <a href="https://github.com/Codename-11/SubFrame" class="btn btn-outline btn-large">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              View Source
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <Footer />
  </div>
</template>
