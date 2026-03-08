# v0.2.2-beta

## Highlights

**Onboarding flow fully wired** — Initializing a project now opens the AI analysis wizard automatically. Terminal ID is delivered immediately so "View Terminal" works during analysis. Closing the dialog mid-analysis properly cancels and cleans up.

**Terminal stability** — Fixed copy/paste double-fire, throttled render-heavy output/scroll tracking, and wired up session/skill/plugin commands that were silently failing.

**Uninstall parity** — De-init now removes all artifacts that init creates, including `pre-push` hook and `onboard` skill.

## What's New

- **AI Analysis re-run**: SubFrame Health panel has an "AI Analysis" button to re-run onboarding analysis on already-initialized projects

## Bug Fixes

- Onboarding not triggered after project init
- "View Terminal" unavailable during AI analysis (terminal ID delivered too late)
- Orphaned analysis terminals when closing dialog mid-analysis
- OnboardingDialog not closing after applying results
- Uninstall missing `pre-push` git hook and `onboard` Claude skill
- Terminal copy/paste double-fire and xterm decoration API
- Terminal render storm during rapid PTY output
- Session/Skills/Plugins panel commands not executing (`window.terminalSendCommand` was never defined)
