---
id: task-mo3m5419-ani5
title: 'Unify terminal/editor/panel tab UI — delete duplicate bars, enhance leaf group'
status: in_progress
priority: high
category: refactor
blockedBy: []
blocks: []
createdAt: '2026-04-18T00:42:54.764Z'
updatedAt: '2026-04-18T01:08:14.711Z'
completedAt: null
context: Session 2026-04-18
---
Eliminate the visual conflict between (1) TerminalTabBar, (2) ViewTabBar's openTabs row, and (3) LeafGroupView's per-leaf tab bar by making LeafGroupView the single source of truth for tabs (VS Code editor-group pattern). Distribute removed features: per-tab actions (pin/freeze/restart/popout/rename) move to leaf-tab right-click context menu; shell selector moves to LeafGroupView '+' menu submenu; workspace-combine toggle moves to ViewTabBar right side; grid layout selector + viewMode tabs/grid toggle are deleted (splits supersede).

## Steps
- [ ] Architect: produce implementation blueprint for all three phases
- [ ] Phase A: enhance LeafGroupView (drag-reorder, tab context menu, shell selector submenu)
- [ ] Phase B: delete TerminalTabBar; move workspace-combine pill to ViewTabBar; remove TerminalTabBar imports/usage from TerminalArea
- [ ] Phase C: strip openTabs row from ViewTabBar; remove related state plumbing
- [ ] Run npm run check + manual smoke test (open terminal, open file, open panel, split, close)

## User Request
> From a UI/UX perspective what's the proper approach with our new features/window view system? ... Proceed with all now use agent team

## Acceptance Criteria
TerminalTabBar.tsx deleted; ViewTabBar no longer renders openTabs row; LeafGroupView has per-tab context menu (pin/freeze/restart/popout/rename) + shell selector submenu in + menu + drag-to-reorder; workspace-combine pill rendered on right side of ViewTabBar; npm run check green; opening a terminal shows exactly one tab strip (the leaf bar).

## Notes
[2026-04-18] handleOpenFile in LeafGroupView: IPC.SHOW_OPEN_DIALOG channel does not exist in ipcChannels.ts; downgraded the menu item to toast.info('Use the file tree to open files') per blueprint fallback. Adding a new IPC channel was out of scope.
