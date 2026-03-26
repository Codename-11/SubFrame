---
layout: blog-post
title: "SubFrame Server — Remote Access for Desktop and Mobile"
description: "SubFrame Server now lets you mirror and control the live desktop session from another desktop browser, tablet, or phone with SSH, LAN, QR, pairing code, and token-based access."
date: "2026-03-25"
tag: "Feature"
head:
  - - meta
    - property: og:type
      content: article
  - - meta
    - property: og:title
      content: "SubFrame Server — Remote Access for Desktop and Mobile"
  - - meta
    - property: og:description
      content: "SubFrame Server now brings live remote access to the same SubFrame host session from desktop and mobile browsers."
  - - meta
    - name: twitter:card
      content: summary_large_image
---

SubFrame Server started as an idea for browser-based access to a terminal-first AI workspace. It is now a shipped feature.

You can keep the desktop app running on your main machine and connect from another desktop browser, a tablet, or a phone to control the same live session.

## What It Does

SubFrame Server serves the SubFrame UI over HTTP and WebSocket so the browser can mirror the current host session. That includes terminal access, workspace and project context, and the broader app surfaces needed to keep working remotely.

- **Desktop remote control** from another browser
- **Tablet and phone access** for live control away from the keyboard
- **SSH tunnel mode** for the safest default path
- **Trusted-LAN mode** for direct mobile access on home or office Wi-Fi
- **QR code, pairing code, and token flows** so connecting from a phone is fast
- **Live host hydration and sync** so the remote client opens closer to the current desktop session

## Access Paths

### SSH Tunnel

SSH tunnel mode keeps SubFrame bound to `127.0.0.1` and is the recommended default. This is the safest path when connecting from another machine or from outside a trusted local network.

### Local Network

LAN mode is an explicit opt-in for trusted home or office networks. It binds the server to `0.0.0.0` so phones and tablets on the same Wi-Fi can connect directly.

This mode exists mainly because direct mobile access is much more practical on Android and tablets than assuming every device will run an SSH app.

## Mobile Workflow

Mobile access is not just a passive mirror.

- The browser can connect through a **QR code**
- The base URL can authenticate with a **pairing code**
- The access screen also accepts a pasted **session token**
- Phone web includes a dedicated **Panels** surface for the same broader app views that matter on desktop
- The remote session can be installed as a **PWA** for a more app-like experience

## The Architecture

SubFrame was already well-positioned for this because the renderer is a web UI and the terminal stack already lives in the host process.

SubFrame is built entirely with web technologies:

- **xterm.js** — the terminal emulator — is a web component. It already runs in browsers.
- **The UI** is HTML, CSS, and JavaScript. No native widgets.
- **node-pty** — the PTY backend — runs on Node.js, which works on any server.

The key work was replacing the desktop-only transport assumptions with a routed bridge that can serve both Electron and the browser client.

```
Electron App                    SubFrame Server (Web App)
─────────────                   ─────────────────────────
ipcMain / ipcRenderer    →      Express + WebSocket
Electron BrowserWindow   →      Static HTML server
node-pty (same)                 node-pty (same)
xterm.js (same)                 xterm.js (same)
File system (same)              File system (same)
```

The core logic stays the same. Terminal management, file tree, tasks, sessions, and the rest of the React app are shared. The main change is the transport and session-access layer.

## Why It Matters

SubFrame is terminal-first, which makes remote control especially useful:

- You can leave the main machine running long-lived AI sessions
- You can check or drive the same environment from another room or another device
- You can use a phone or tablet as a lightweight control surface
- You do not need a second editor-centric workflow just to stay attached to your live terminal session

## Current Status

SubFrame Server is available now from **Settings > Integrations > SubFrame Server** in the desktop app.

If you want the implementation details and exact setup flow, start here:

- [Remote Access guide](/remote-access)
- [Configuration reference](/configuration#subframe-server-settings)
- [Features overview](/features#remote-access-subframe-server)
