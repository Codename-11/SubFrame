Fix release — CLI install now auto-adds to PATH on Windows, plus uninstall support.

## What's Changed

### Bug Fixes
- **CLI Install Auto-PATH** - Windows CLI installer now automatically adds `SubFrame\bin` to the user PATH via PowerShell registry API. No more manual PATH editing.
- **CLI Uninstall** - New "Uninstall" button in Settings > General > CLI removes the `subframe` command and cleans the PATH entry
