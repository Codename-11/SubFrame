<template>
  <div class="hero-preview">
    <div class="terminal-window">
      <div class="terminal-header">
        <div class="terminal-dot red"></div>
        <div class="terminal-dot yellow"></div>
        <div class="terminal-dot green"></div>
        <div class="terminal-title">subframe — zsh — 80×24</div>
      </div>
      <div class="terminal-body">
        <div class="terminal-line">
          <span class="terminal-prompt">&#10095;</span>
          <span class="terminal-command">subframe init my-project</span>
        </div>
        <div class="terminal-line terminal-output">
          &#10003; Created project structure<br />
          &#10003; Initialized STRUCTURE.json<br />
          &#10003; Ready to code with Claude
        </div>
        <div class="terminal-line">
          <span class="terminal-prompt">&#10095;</span>
          <span class="terminal-command">subframe</span>
        </div>
        <div class="terminal-line terminal-output">
          Starting SubFrame...<br />
          <span style="color: var(--sf-accent)">&#9679;</span> Claude connected<br />
          <span style="color: #22c55e">&#9679;</span> Project loaded: my-project
        </div>
        <div class="terminal-line">
          <span class="terminal-prompt">&#10095;</span>
          <span class="terminal-cursor"></span>
        </div>
      </div>
    </div>
  </div>
</template>
