# IPC Channel Reference

**Source of truth:** `src/shared/ipcChannels.ts`

All channels are typed. Three communication patterns are used:

| Pattern | Direction | Usage |
|---------|-----------|-------|
| `ipcMain.handle` / `ipcRenderer.invoke` | Renderer → Main (request/response) | Data fetching, mutations |
| `ipcRenderer.send` / `ipcMain.on` | Renderer → Main (fire-and-forget) | Commands, notifications |
| `webContents.send` / `ipcRenderer.on` | Main → Renderer (push events) | Data updates, state changes |

Channels marked ⚠ are defined in the `IPC` constant but not yet in `IPCHandleMap`, `IPCSendMap`, or `IPCEventMap` type maps.

---

## Channels by Domain

### Terminal (5 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `START_TERMINAL` | send | Start legacy single terminal |
| `RESTART_TERMINAL` | send | Restart terminal for project |
| `TERMINAL_INPUT` | send | Legacy terminal input |
| `TERMINAL_OUTPUT` | event | Legacy terminal output |
| `TERMINAL_RESIZE` | send | Legacy terminal resize |

### Multi-Terminal (10 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `TERMINAL_CREATE` | send | Create new terminal instance |
| `TERMINAL_CREATED` | event | Terminal creation result |
| `TERMINAL_DESTROY` | send | Destroy terminal by ID |
| `TERMINAL_DESTROYED` | event | Terminal destruction confirmation |
| `TERMINAL_INPUT_ID` | send | Input to specific terminal |
| `TERMINAL_OUTPUT_ID` | event | Output from specific terminal |
| `TERMINAL_RESIZE_ID` | send | Resize specific terminal |
| `TERMINAL_FOCUS` | ⚠ send | Focus a specific terminal |
| `GET_AVAILABLE_SHELLS` | send | List available shell programs |
| `AVAILABLE_SHELLS_DATA` | event | Available shells response |

### Project (3 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `SELECT_PROJECT_FOLDER` | send | Open folder picker dialog |
| `CREATE_NEW_PROJECT` | send | Create new project dialog |
| `PROJECT_SELECTED` | event | Project folder selected |

### Default Project Directory (2 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `SCAN_PROJECT_DIR` | handle | Scan directory for projects |
| `SELECT_DEFAULT_PROJECT_DIR` | handle | Pick default project directory |

### Workspace (12 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_WORKSPACE` | send | Load current workspace |
| `WORKSPACE_DATA` | event | Workspace data response |
| `WORKSPACE_UPDATED` | event | Workspace projects changed |
| `ADD_PROJECT_TO_WORKSPACE` | send | Add project to workspace |
| `REMOVE_PROJECT_FROM_WORKSPACE` | send | Remove project |
| `RENAME_PROJECT` | send | Rename project in workspace |
| `WORKSPACE_LIST` | handle | List all workspaces |
| `WORKSPACE_LIST_DATA` | ⚠ | Legacy data channel (unused) |
| `WORKSPACE_SWITCH` | handle | Switch active workspace |
| `WORKSPACE_CREATE` | handle | Create new workspace |
| `WORKSPACE_RENAME` | handle | Rename workspace |
| `WORKSPACE_DELETE` | handle | Delete workspace |

### SubFrame Project (6 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `INITIALIZE_FRAME_PROJECT` | send | Initialize SubFrame in project |
| `FRAME_PROJECT_INITIALIZED` | event | Init result |
| `CHECK_IS_FRAME_PROJECT` | send | Check if project has SubFrame |
| `IS_FRAME_PROJECT_RESULT` | event | Check result |
| `GET_FRAME_CONFIG` | send | Load SubFrame config |
| `FRAME_CONFIG_DATA` | event | Config data response |

### File Tree (2 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_FILE_TREE` | send | Load directory tree |
| `FILE_TREE_DATA` | event | Tree data response |

### File Editor (6 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `READ_FILE` | send | Read file content |
| `FILE_CONTENT` | event | File content response |
| `WRITE_FILE` | send | Save file content |
| `FILE_SAVED` | event | Save result |
| `READ_FILE_IMAGE` | send | Read binary image as base64 |
| `IMAGE_CONTENT` | event | Image data URI response |

### History (3 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_PROMPT_HISTORY` | send | Load prompt history |
| `PROMPT_HISTORY_DATA` | event | History data response |
| `TOGGLE_HISTORY_PANEL` | event | Toggle history panel visibility |

### Commands (1 channel)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `RUN_COMMAND` | event | Push command to renderer terminal |

### Tasks (9 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_TASKS` | send | Load project tasks |
| `TASKS_DATA` | event | Tasks data response |
| `ADD_TASK` | send | Create new task |
| `UPDATE_TASK` | send | Update task |
| `DELETE_TASK` | send | Delete task |
| `TASK_UPDATED` | event | Task mutation result |
| `TOGGLE_TASKS_PANEL` | ⚠ event | Toggle tasks panel visibility |
| `WATCH_TASKS` | send | Start file watcher for tasks |
| `UNWATCH_TASKS` | send | Stop file watcher |

### Plugins (6 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_PLUGINS` | handle | Load plugin list |
| `PLUGINS_DATA` | event | Plugin data push |
| `TOGGLE_PLUGIN` | handle | Enable/disable plugin |
| `PLUGIN_TOGGLED` | event | Plugin toggle result |
| `TOGGLE_PLUGINS_PANEL` | ⚠ event | Toggle plugins panel visibility |
| `REFRESH_PLUGINS` | handle | Refresh plugin list |

### Claude Sessions (6 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_CLAUDE_SESSIONS` | handle | Load past sessions |
| `REFRESH_CLAUDE_SESSIONS` | handle | Force refresh sessions |
| `CHECK_ACTIVE_CLAUDE_SESSION` | handle | Check for active session |
| `RENAME_CLAUDE_SESSION` | handle | Rename a session |
| `DELETE_CLAUDE_SESSION` | handle | Delete a session |
| `DELETE_ALL_CLAUDE_SESSIONS` | handle | Delete all sessions for project |

### Claude Usage (3 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_CLAUDE_USAGE` | send | Load usage data |
| `CLAUDE_USAGE_DATA` | event | Usage data response |
| `REFRESH_CLAUDE_USAGE` | send | Force refresh usage |

### GitHub (4 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_GITHUB_ISSUES` | handle | Load repo issues |
| `GITHUB_ISSUES_DATA` | ⚠ event | Issues data push (legacy) |
| `TOGGLE_GITHUB_PANEL` | ⚠ event | Toggle GitHub panel visibility |
| `OPEN_GITHUB_ISSUE` | send | Open issue in browser |

### Git Branches (8 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_GIT_BRANCHES` | handle | Load branches |
| `SWITCH_GIT_BRANCH` | handle | Checkout branch |
| `CREATE_GIT_BRANCH` | handle | Create new branch |
| `DELETE_GIT_BRANCH` | handle | Delete branch |
| `LOAD_GIT_WORKTREES` | handle | List worktrees |
| `ADD_GIT_WORKTREE` | handle | Create worktree |
| `REMOVE_GIT_WORKTREE` | handle | Remove worktree |
| `TOGGLE_GIT_BRANCHES_PANEL` | send + event | Toggle git panel (bidirectional) |

### Overview (3 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_OVERVIEW` | handle | Load project overview |
| `OVERVIEW_DATA` | event | Overview data push |
| `GET_FILE_GIT_HISTORY` | handle | File git history |

### AI Tool (6 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `GET_AI_TOOL_CONFIG` | handle | Load AI tool config |
| `AI_TOOL_CONFIG_DATA` | ⚠ event | Config data push (legacy) |
| `SET_AI_TOOL` | handle | Set active AI tool |
| `ADD_CUSTOM_AI_TOOL` | handle | Add custom tool |
| `REMOVE_CUSTOM_AI_TOOL` | handle | Remove custom tool |
| `AI_TOOL_CHANGED` | event | Active tool changed notification |

### Settings (4 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_SETTINGS` | handle | Load all settings |
| `SETTINGS_DATA` | ⚠ event | Settings data push (legacy) |
| `UPDATE_SETTING` | handle | Update a single setting |
| `SETTINGS_UPDATED` | event | Settings changed notification |

### AI Files (9 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `GET_AI_FILES_STATUS` | send | Check AI file status |
| `AI_FILES_STATUS_DATA` | event | Status response |
| `INJECT_BACKLINK` | send | Add backlink to file |
| `REMOVE_BACKLINK` | send | Remove backlink |
| `CREATE_NATIVE_FILE` | send | Create CLAUDE.md/GEMINI.md |
| `MIGRATE_SYMLINK` | send | Convert symlink to native file |
| `AI_FILE_UPDATED` | event | File update notification |
| `VERIFY_BACKLINKS` | send | Verify all backlinks |
| `BACKLINK_VERIFICATION_RESULT` | event | Verification result |

### Backlink Customization (6 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `GET_BACKLINK_CONFIG` | send | Load backlink config |
| `BACKLINK_CONFIG_DATA` | event | Config data response |
| `SAVE_BACKLINK_CONFIG` | send | Save backlink config |
| `BACKLINK_CONFIG_SAVED` | event | Save confirmation |
| `UPDATE_ALL_BACKLINKS` | send | Update all project backlinks |
| `ALL_BACKLINKS_UPDATED` | event | Bulk update result |

### SubFrame Health (6 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `GET_SUBFRAME_HEALTH` | send | Check component health status |
| `SUBFRAME_HEALTH_DATA` | event | Health status response |
| `UPDATE_SUBFRAME_COMPONENTS` | send | Update outdated components |
| `SUBFRAME_COMPONENTS_UPDATED` | event | Component update result |
| `UNINSTALL_SUBFRAME` | send | Uninstall SubFrame from project |
| `SUBFRAME_UNINSTALLED` | event | Uninstall result |

### Agent State (4 channels)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_AGENT_STATE` | send | Load current agent state |
| `AGENT_STATE_DATA` | event | Agent state data response |
| `WATCH_AGENT_STATE` | send | Start watching agent-state.json |
| `UNWATCH_AGENT_STATE` | send | Stop watching agent state |

### Skills (1 channel)
| Channel | Pattern | Purpose |
|---------|---------|---------|
| `LOAD_SKILLS` | handle | Load available Claude Code skills from .claude/skills/ |

---

**Total: 123 channels** (33 handle, 48 send, 35 event, 7 untyped/legacy)

*Regenerated from `ipcChannels.ts` — keep this reference in sync when adding/removing channels.*
