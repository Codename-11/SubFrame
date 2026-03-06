<script setup lang="ts">
import { withBase } from 'vitepress'
import LogoSvg from './LogoSvg.vue'
</script>

<template>
  <footer class="sf-footer">
    <div class="container">
      <div class="footer-content">
        <a :href="withBase('/')" class="logo">
          <div class="logo-icon">
            <LogoSvg :size="28" id="ft" />
          </div>
          <span class="logo-text">SubFrame</span>
        </a>

        <div class="footer-links">
          <a :href="withBase('/guide/')">Docs</a>
          <a :href="withBase('/blog/')">Blog</a>
          <a href="https://github.com/Codename-11/SubFrame" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://github.com/Codename-11/SubFrame/issues" target="_blank" rel="noopener noreferrer">Issues</a>
          <a href="https://github.com/anthropics/claude-code" target="_blank" rel="noopener noreferrer">Claude Code</a>
          <a href="https://github.com/openai/codex" target="_blank" rel="noopener noreferrer">Codex CLI</a>
          <a href="https://github.com/google-gemini/gemini-cli" target="_blank" rel="noopener noreferrer">Gemini CLI</a>
        </div>

        <div class="footer-copy">
          Built for AI-native development &middot; Open Source
        </div>
      </div>
    </div>
  </footer>
</template>
