---
layout: blog-post
title: "SubFrame Server — Running Your IDE in the Browser"
description: "What if you could access SubFrame from any browser? Since SubFrame is built with Electron and web technologies, converting to a web app like code-server is technically feasible."
date: "2026-01-30"
tag: "Roadmap"
head:
  - - meta
    - property: og:type
      content: article
  - - meta
    - property: og:title
      content: "SubFrame Server — Running Your IDE in the Browser"
  - - meta
    - property: og:description
      content: "What if you could access SubFrame from any browser? The path from Electron to a web app is shorter than you think."
  - - meta
    - name: twitter:card
      content: summary_large_image
---

## The Request

A community member raised an interesting idea:

> "I have a Windows PC for display and a headless Debian machine for development. Exposing SubFrame as a web app — like code-server — would be useful. I could install it on my headless Linux dev box and open it on any browser anywhere."

This resonated with us. Not everyone has their development environment on the machine they're sitting at. Remote development is increasingly common, especially with AI coding tools that benefit from powerful hardware.

## Why It's Feasible

SubFrame is built entirely with web technologies:

- **xterm.js** — the terminal emulator — is a web component. It already runs in browsers.
- **The UI** is HTML, CSS, and JavaScript. No native widgets.
- **node-pty** — the PTY backend — runs on Node.js, which works on any server.

The only Electron-specific piece is the *communication layer*: IPC (Inter-Process Communication) between the main process and the renderer. In a web app, this becomes WebSocket.

## The Architecture

```
Electron App                    SubFrame Server (Web App)
─────────────                   ─────────────────────────
ipcMain / ipcRenderer    →      Express + WebSocket
Electron BrowserWindow   →      Static HTML server
node-pty (same)                 node-pty (same)
xterm.js (same)                 xterm.js (same)
File system (same)              File system (same)
```

The core logic stays the same. Terminal management, file tree, task tracking, plugin system — all of it works identically. Only the transport layer changes.

### What Changes

- **IPC -> WebSocket**: Replace `ipcMain.handle()` with WebSocket message handlers
- **Electron window -> Express server**: Serve the HTML/CSS/JS as static files
- **Authentication**: Add a login system (the desktop app doesn't need one)
- **HTTPS**: Required for secure remote access

### What Stays the Same

- All terminal management (node-pty)
- All UI components (xterm.js, file tree, panels)
- Context preservation system (AGENTS.md, STRUCTURE.json, etc.)
- Task management
- Multi-AI tool support

## Precedent: code-server

This pattern is proven. [code-server](https://github.com/coder/code-server) does exactly this for VS Code — takes an Electron app and serves it as a web application. The result is VS Code in the browser, accessible from any device.

SubFrame's architecture is simpler than VS Code's, which makes the conversion even more straightforward.

## Current Status

SubFrame Server is on the roadmap but not yet in development. We're focusing on stabilizing the desktop experience first — multi-AI support, plugin system, and context preservation.

If you're interested in SubFrame Server, [let us know on GitHub](https://github.com/Codename-11/SubFrame/issues). Community interest will help prioritize this feature.
