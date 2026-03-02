<script setup lang="ts">
import LogoSvg from './LogoSvg.vue'
</script>

<template>
  <footer class="sf-footer">
    <div class="container">
      <div class="footer-content">
        <a href="/" class="logo">
          <div class="logo-icon">
            <LogoSvg :size="28" id="ft" />
          </div>
          <span class="logo-text">SubFrame</span>
        </a>

        <div class="footer-links">
          <a href="https://github.com/Codename-11/SubFrame" target="_blank">GitHub</a>
          <a href="/blog/">Blog</a>
          <a href="https://github.com/anthropics/claude-code" target="_blank">Claude Code</a>
          <a href="https://github.com/openai/codex" target="_blank">Codex CLI</a>
          <a href="https://github.com/google-gemini/gemini-cli" target="_blank">Gemini CLI</a>
        </div>

        <div class="footer-copy">
          Built for AI-native development &middot; Open Source
        </div>
      </div>
    </div>
  </footer>
</template>
