---
id: task-mm8ehwc0-mesw
title: File preview system — VS Code-style renderer
status: completed
priority: high
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-01T23:48:20.592Z'
updatedAt: '2026-03-02T00:08:11.211Z'
completedAt: '2026-03-02T00:08:11.211Z'
context: Session 2026-03-01
---
Add a preview/render mode to the editor for non-code files. Support: Markdown (rendered HTML), HTML/CSS (live preview), SVG (inline render), images (display with zoom/pan). Toggle between edit mode (CodeMirror) and preview mode. Architecture: preview renderer component that switches based on file type. Research needed: best markdown renderer (react-markdown vs marked vs mdx), HTML sandboxing (iframe vs shadow DOM), SVG inline rendering approach.
