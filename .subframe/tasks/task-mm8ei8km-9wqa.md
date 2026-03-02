---
id: task-mm8ei8km-9wqa
title: Research file preview/renderer libraries
status: completed
priority: high
category: research
blockedBy: []
blocks: []
createdAt: '2026-03-01T23:48:36.454Z'
updatedAt: '2026-03-01T23:56:55.667Z'
completedAt: '2026-03-01T23:56:55.667Z'
context: Session 2026-03-01
---
Evaluate libraries for rendering file previews in SubFrame's editor dialog. Must work with React 19 + TypeScript + esbuild + Electron. Research: (1) Markdown: react-markdown, marked, remark/rehype, mdx — need GFM support, code block syntax highlighting (can reuse CM6/Shiki), math rendering; (2) HTML/CSS: iframe sandbox vs shadow DOM vs srcDoc approach — security considerations in Electron; (3) SVG: inline rendering via dangerouslySetInnerHTML vs react-svg vs object tag; (4) Images: native img tag with zoom/pan (react-zoom-pan-pinch or similar). Compare bundle size, React 19 compat, maintenance status. Recommend the best option for each file type.
