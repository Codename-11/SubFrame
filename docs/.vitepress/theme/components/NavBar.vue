<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <nav class="docs-nav">
    <div class="docs-nav-inner">
      <a href="https://sub-frame.dev" class="nav-logo">
        <!-- SubFrame atom logo (static, simplified) -->
        <svg class="nav-logo-icon" width="32" height="32" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
          <circle cx="90" cy="90" r="40" fill="rgba(255,110,180,0.08)" />
          <g transform="rotate(0,90,90)">
            <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(180,128,255,0.3)" stroke-width="1.5" />
            <circle cx="148" cy="90" r="3" fill="#b480ff" />
          </g>
          <g transform="rotate(60,90,90)">
            <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(255,110,180,0.25)" stroke-width="1.5" stroke-dasharray="5 3.5" />
            <circle cx="32" cy="90" r="3" fill="#ff6eb4" />
          </g>
          <g transform="rotate(120,90,90)">
            <ellipse cx="90" cy="90" rx="58" ry="22" fill="none" stroke="rgba(100,216,255,0.22)" stroke-width="1.5" />
            <circle cx="90" cy="68" r="3" fill="#64d8ff" />
          </g>
          <circle cx="90" cy="90" r="5.5" fill="#ff6eb4" />
        </svg>
        <span class="nav-logo-text">SubFrame</span>
        <span class="nav-logo-tag">Docs</span>
      </a>
      <div class="nav-links">
        <a :href="withBase('/getting-started')">Docs</a>
        <a :href="withBase('/blog/')">Blog</a>
        <a href="https://sub-frame.dev" target="_blank" rel="noopener noreferrer">Home</a>
        <a href="https://github.com/Codename-11/SubFrame" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.docs-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(14, 14, 18, 0.85);
  backdrop-filter: blur(12px);
}
.docs-nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
}
.nav-logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-decoration: none;
}
.nav-logo-icon {
  flex-shrink: 0;
}
.nav-logo-text {
  font-size: 1rem;
  font-weight: 700;
  color: var(--sf-text-primary, #eeeef0);
}
.nav-logo-tag {
  font-size: 0.65rem;
  font-family: monospace;
  color: var(--sf-text-tertiary, #6b6b80);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 999px;
  padding: 0.15rem 0.5rem;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}
.nav-links a {
  font-size: 0.875rem;
  color: var(--sf-text-secondary, #9d9db0);
  text-decoration: none;
  transition: color 0.15s;
}
.nav-links a:hover {
  color: var(--sf-text-primary, #eeeef0);
}
</style>
