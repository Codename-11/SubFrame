---
id: task-mm8ej4y1-9vps
title: SVG and image preview
status: completed
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-01T23:49:18.408Z'
updatedAt: '2026-03-02T00:08:11.428Z'
completedAt: '2026-03-02T00:08:11.428Z'
context: Session 2026-03-01
---
Add preview/display for SVG and image files (.svg, .png, .jpg, .gif, .webp, .bmp, .ico). SVGs: render inline with proper scaling, show source code toggle. Images: display with fit-to-container scaling, zoom/pan capability. For binary images, modify fileEditor.ts to return a base64 data URI or file:// path instead of text content. For SVGs (which are text), support both rendered view and source code editing.
