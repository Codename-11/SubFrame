---
id: task-mm8eisz3-b2vh
title: HTML/CSS live preview mode
status: completed
priority: medium
category: feature
blockedBy: []
blocks: []
createdAt: '2026-03-01T23:49:02.895Z'
updatedAt: '2026-03-02T00:08:11.358Z'
completedAt: '2026-03-02T00:08:11.358Z'
context: Session 2026-03-01
---
Add preview mode for .html/.htm/.css files in the editor dialog. Render HTML in a sandboxed iframe (srcDoc approach) with live updates as the user edits. For CSS files, show a preview pane with sample HTML that applies the stylesheet. Security: sandbox attribute on iframe to prevent script execution unless user opts in. Match SubFrame's dark background around the preview frame.
