---
id: task-mm9tf4gn-i6w1
title: Implement Windows code signing for installer and executable
status: pending
priority: high
category: infra
blockedBy: []
blocks: []
createdAt: '2026-03-02T23:33:51.574Z'
updatedAt: '2026-03-15T02:56:51.830Z'
completedAt: null
context: Session 2026-03-02
---
Obtain and integrate a Windows code signing certificate (EV or standard) into the build/release pipeline to eliminate SmartScreen warnings when users download and install SubFrame. This is critical for public launch credibility and user trust.

## Steps
- [ ] Research and select a code signing certificate provider (DigiCert, Sectigo, SSL.com EV vs OV)
- [ ] Purchase certificate and complete identity verification process
- [ ] Configure electron-builder signing options (win.sign / certificateFile / certificatePassword)
- [ ] Integrate signing into GitHub Actions release workflow with secure credential storage (secrets)
- [ ] Test signed installer on clean Windows machine and verify SmartScreen acceptance
- [ ] Document certificate renewal timeline, credential rotation, and signing configuration

## Acceptance Criteria
- A valid Windows code signing certificate is obtained from a trusted CA
- The Electron installer (.exe/.msi) and main executable are signed during the build process
- SmartScreen no longer shows 'unknown publisher' warnings on fresh installs
- Code signing is integrated into the GitHub Actions release workflow (automated)
- Signature can be verified via right-click → Properties → Digital Signatures on Windows
- Certificate renewal process and credentials storage are documented

## Notes
[2026-03-14] Blocker for public release — unsigned apps trigger Windows SmartScreen warnings
