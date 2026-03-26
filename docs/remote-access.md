---
title: Remote Access
description: Use SubFrame Server to control your desktop session from another desktop, tablet, or phone over SSH or trusted LAN, with QR codes, pairing codes, and session tokens.
---

# Remote Access

SubFrame Server lets you open the same SubFrame session in a browser on another device. That means you can keep the desktop app running on your main machine and connect from a laptop, tablet, or phone when you need to check status, drive terminals, or keep working away from the keyboard.

This is a live remote-control feature, not a separate cloud workspace. The browser mirrors the current SubFrame host session, including its active workspace, current project context, terminal layout, and panel state.

## What It Supports

- **Desktop and laptop browsers** for remote control from another machine
- **Tablet and phone access** for quick control, monitoring, and lightweight terminal use
- **Two access modes**: SSH tunnel or trusted-LAN mode
- **Four connection methods**: direct URL, QR code, pairing code, and pasted token
- **Single remote session with takeover** so one active browser session controls the host at a time
- **Optional remote cursor tracking** so the host can visualize mobile or remote pointer activity

## Quick Start

1. Open **Settings > Integrations > SubFrame Server**
2. Turn on **Run SubFrame Server**
3. Choose your access path:
   - **SSH tunnel** for the safest default
   - **Allow LAN access** only on trusted home or office networks
4. Share the session using one of these methods:
   - Copy the **Connection URL**
   - Show the **QR Code**
   - Click **Generate + Copy Code**
   - Open the **Base URL** and pair in the browser
5. On the remote device, connect and continue in the mirrored SubFrame UI

## Access Modes

### SSH Tunnel

SSH is the recommended default. In this mode, SubFrame Server stays bound to `127.0.0.1`, which keeps it off the local network and makes the browser session available only through the tunnel you create.

SubFrame's SSH setup forwards the host server port to `localhost:8080` on the remote machine. After the tunnel is running, open `http://localhost:8080` there, or use the tokenized connection URL built from that same remote-side address.

Use SSH when:

- You are accessing SubFrame from another desktop or laptop
- You are connecting over the internet
- You want the safest default path
- You do not want SubFrame exposed to the rest of your Wi-Fi network

SubFrame provides a copy-ready SSH command in the setup guide. Use the setup UI as the source of truth for the exact forwarding command and browser URL for your current session.

### Local Network

When **Allow LAN access** is enabled, SubFrame Server binds to `0.0.0.0` so other devices on the same network can connect directly.

Use LAN mode when:

- You want quick access from a phone or tablet
- You are on your home or office Wi-Fi
- Running an SSH app on the remote device is inconvenient

Do not use LAN mode on public or shared networks. Even though the session still requires a token or pairing code, the server becomes network-reachable.

## Connection Methods

### Connection URL

SubFrame exposes a full tokenized **Connection URL** in Settings. Opening that exact URL on the remote device is the fastest path because it already includes the current auth token.

Best for:

- Sending a link to another desktop browser
- Reusing bookmarks or home-screen shortcuts
- Returning to the same host quickly

### Base URL + Pairing Code

You can also open the plain **Base URL** first and authenticate in the browser with a pairing code.

Pairing is useful when:

- You do not want to expose the full token in the copied URL
- You are typing the address manually
- You want a short-lived login flow for mobile devices

Pairing codes are short, expire after 5 minutes, and are generated from the desktop app.

### Base URL + Session Token

Instead of pairing, the browser access screen can accept a pasted session token.

Best for:

- Copying the token manually from the host
- Reconnecting from a browser that already knows the base URL
- Advanced workflows where you want token control without using the full connection URL

### QR Code

SubFrame can generate a QR code for the current connection URL. In LAN mode this is the fastest mobile path: scan it with a phone camera and open the live session immediately.

Best for:

- Android phones and tablets
- iPhone and iPad on the same Wi-Fi
- Fast setup without typing anything

## Mobile and Tablet Experience

SubFrame Server is designed to work as a real remote interface, not just a read-only mirror.

- **Phone web** includes terminal access plus a dedicated **Panels** surface for project, GitHub, agent, automation, and task-related views
- **Terminal parity** is much closer to desktop because remote/mobile uses the same terminal area model instead of a stripped-down single-terminal shell
- **Live hydration** starts from the host session, so the browser opens closer to the current desktop workspace, project, terminal, and panel context
- **Ongoing session sync** keeps terminal names, layout, and UI state aligned as the host session continues restoring or changing
- **PWA install support** lets mobile browsers add SubFrame to the home screen for a more app-like experience

## Settings

SubFrame Server is configured in **Settings > Integrations > SubFrame Server**.

| Setting | What it does |
|---|---|
| **Run SubFrame Server** | Starts or stops the remote web UI for the current SubFrame session |
| **Start Server on Launch** | Automatically starts SubFrame Server whenever SubFrame opens |
| **Preferred Port** | Uses a fixed port for bookmarks and integrations, or `0` / blank for auto reuse |
| **Remote Cursor Tracking** | Shows remote mouse or touch movement on the host desktop |
| **Allow LAN access** | Rebinds the server to your local network for direct phone and tablet access |

When **Preferred Port** is left in auto mode, SubFrame tries to reuse the last successful port when possible. That makes bookmarks and repeat mobile access more stable without forcing a permanently fixed port.

## Session Behavior

- The browser mirrors the current SubFrame host, including the active workspace and project context
- A single browser session controls the host at a time
- If another remote browser tries to connect, SubFrame offers takeover rather than allowing two competing control sessions
- Regenerating the token invalidates the previous browser session
- The browser can connect through the direct tokenized URL or through the base URL and access screen

## Security Notes

- Prefer **SSH tunnel mode** whenever possible
- Use **LAN mode** only on trusted networks
- Regenerate the token if you think the URL or token was shared too broadly
- Pairing codes are safer for quick one-off mobile access because they expire
- Disable SubFrame Server when you are done with remote access

## Related Docs

- [Features](/features#remote-access-subframe-server)
- [Configuration](/configuration#subframe-server-settings)
- [Integrations](/integrations)
- [SubFrame Server blog post](/blog/subframe-server)
