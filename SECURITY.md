# Security Policy

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Please report security issues through [GitHub's private security advisory](https://github.com/Codename-11/SubFrame/security/advisories/new). This lets us discuss and fix the issue before it's publicly disclosed.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Impact assessment (what an attacker could do)
- Any suggested fix (optional but appreciated)

### What to expect

- Acknowledgment within 48 hours
- Status update within 1 week
- Fix and disclosure coordinated with you

## Scope

SubFrame is an Electron desktop app. Security-relevant areas include:

- **Electron main process** — Node.js with full system access (PTY, file I/O, child processes)
- **IPC boundary** — Messages between main and renderer processes
- **Shell command execution** — Pipeline stages, AI tool spawning, hook scripts
- **External integrations** — GitHub API, Claude API key handling
- **Auto-updater** — Electron-builder update mechanism

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest beta | Yes |
| Older betas | Best effort |
