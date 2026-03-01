#Requires -Version 5.1
<#
.SYNOPSIS
    Frame Development Environment Setup for Windows.
.DESCRIPTION
    Checks and installs all prerequisites for building Frame on Windows:
      1. Node.js (v18+)
      2. Python (for node-gyp)
      3. Visual Studio Build Tools with C++ Desktop Development workload
      4. npm dependencies (npm install)
      5. Renderer bundle (npm run build)
    Installs missing tools via winget when available, with manual fallback URLs.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

# ─── Helpers ──────────────────────────────────────────────────────

function Write-Step  { param([string]$msg) Write-Host "`n[$script:step] $msg" -ForegroundColor Cyan; $script:step++ }
function Write-OK    { param([string]$msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn  { param([string]$msg) Write-Host "  [!!] $msg" -ForegroundColor Yellow }
function Write-Fail  { param([string]$msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red }
function Write-Info  { param([string]$msg) Write-Host "  $msg" -ForegroundColor Gray }

$script:step = 1
$script:needsRestart = $false

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-Command {
    param([string]$cmd)
    $null = Get-Command $cmd -ErrorAction SilentlyContinue
    return $?
}

function Get-WingetAvailable {
    return (Test-Command "winget")
}

function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

# ─── Banner ───────────────────────────────────────────────────────

Write-Host ""
Write-Host "  =====================================" -ForegroundColor Magenta
Write-Host "   Frame - Dev Environment Setup" -ForegroundColor Magenta
Write-Host "   Windows Prerequisites Installer" -ForegroundColor Magenta
Write-Host "  =====================================" -ForegroundColor Magenta
Write-Host ""

$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Write-Info "Project root: $projectRoot"
Write-Info "Running as admin: $(Test-Admin)"
Write-Host ""

# ─── 1. Node.js ───────────────────────────────────────────────────

Write-Step "Checking Node.js..."

if (Test-Command "node") {
    $nodeVersion = (node --version) -replace '^v', ''
    $nodeMajor = [int]($nodeVersion.Split('.')[0])

    if ($nodeMajor -ge 18) {
        Write-OK "Node.js v$nodeVersion (meets v18+ requirement)"
    } else {
        Write-Warn "Node.js v$nodeVersion found but v18+ is required"
        Write-Info "Please upgrade Node.js: https://nodejs.org/"
        Write-Info "Or via winget: winget install OpenJS.NodeJS.LTS"
        $script:needsRestart = $true
    }
} else {
    Write-Fail "Node.js not found"

    if (Get-WingetAvailable) {
        Write-Info "Installing Node.js LTS via winget..."
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        Refresh-Path
        if (Test-Command "node") {
            Write-OK "Node.js installed: $(node --version)"
        } else {
            Write-Warn "Node.js installed but not in PATH yet. Restart your terminal after setup."
            $script:needsRestart = $true
        }
    } else {
        Write-Warn "Install Node.js manually: https://nodejs.org/"
        $script:needsRestart = $true
    }
}

# ─── 2. Python ────────────────────────────────────────────────────

Write-Step "Checking Python (required by node-gyp)..."

$pythonCmd = $null
if (Test-Command "python3") { $pythonCmd = "python3" }
elseif (Test-Command "python") {
    # Make sure it's real Python, not the Windows Store stub
    $pyOut = python --version 2>&1
    if ($pyOut -match "Python \d") { $pythonCmd = "python" }
}

if ($pythonCmd) {
    $pyVersion = & $pythonCmd --version 2>&1
    Write-OK "$pyVersion"
} else {
    Write-Fail "Python not found"

    if (Get-WingetAvailable) {
        Write-Info "Installing Python via winget..."
        winget install Python.Python.3.12 --accept-source-agreements --accept-package-agreements
        Refresh-Path
        if (Test-Command "python") {
            Write-OK "Python installed: $(python --version 2>&1)"
        } else {
            Write-Warn "Python installed but not in PATH yet. Restart your terminal after setup."
            $script:needsRestart = $true
        }
    } else {
        Write-Warn "Install Python manually: https://www.python.org/downloads/"
        Write-Info "Make sure to check 'Add Python to PATH' during install."
        $script:needsRestart = $true
    }
}

# ─── 3. Visual Studio Build Tools + C++ ──────────────────────────

Write-Step "Checking Visual Studio C++ Build Tools..."

# node-gyp (used by @electron/rebuild) only recognizes VS 2017-2022.
# VS 2025 (version 18.x) has C++ tools but node-gyp reports "unsupported version".
# We need VS 2022 (version 17.x) specifically for native module compilation.

$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasCpp = $false
$hasCompatibleVS = $false
$hasNewerVSOnly = $false

if (Test-Path $vsWhere) {
    # Check for any VS with C++ tools
    $allInstalls = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json 2>$null | ConvertFrom-Json

    if ($allInstalls) {
        $hasCpp = $true

        foreach ($install in $allInstalls) {
            $majorVersion = [int]($install.installationVersion.Split('.')[0])
            $installPath = $install.installationPath

            if ($majorVersion -le 17) {
                $hasCompatibleVS = $true
                Write-OK "C++ Build Tools (VS $majorVersion) found at: $installPath"
            } else {
                Write-Warn "C++ Build Tools (VS $majorVersion) found at: $installPath"
                Write-Info "  node-gyp does not yet support Visual Studio $majorVersion (2025+)"
                $hasNewerVSOnly = $true
            }
        }
    }
}

# If we only have VS 2025+ (version 18+), we need to install VS 2022 alongside
if ($hasCpp -and $hasNewerVSOnly -and -not $hasCompatibleVS) {
    Write-Host ""
    Write-Warn "You have VS Build Tools but only version 18+ (2025)."
    Write-Info "node-gyp (used by Electron to compile node-pty) only supports VS 2017-2022."
    Write-Info "VS 2022 Build Tools need to be installed alongside your existing version."
    Write-Host ""

    if (Get-WingetAvailable) {
        Write-Info "Installing Visual Studio 2022 Build Tools with C++ workload via winget..."
        Write-Info "This will install alongside your existing VS 2025. This may take several minutes..."
        Write-Host ""

        winget install Microsoft.VisualStudio.2022.BuildTools `
            --accept-source-agreements --accept-package-agreements `
            --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

        # Re-check
        Refresh-Path
        $recheck = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -version "[15.0,18.0)" -property installationPath 2>$null
        if ($recheck) {
            Write-OK "VS 2022 Build Tools installed successfully"
            $hasCompatibleVS = $true
        } else {
            Write-Warn "VS 2022 installation may need a restart to complete."
            Write-Info "Alternatively, open Visual Studio Installer and ensure 2022 Build Tools"
            Write-Info "have the 'Desktop development with C++' workload selected."
            $script:needsRestart = $true
        }
    } else {
        Write-Warn "Install VS 2022 Build Tools manually:"
        Write-Info "1. Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
        Write-Info "2. In the installer, add 'Visual Studio Build Tools 2022'"
        Write-Info "3. Select 'Desktop development with C++' workload"
        Write-Info "4. Click Install (it coexists with VS 2025)"
        $script:needsRestart = $true
    }
} elseif (-not $hasCpp) {
    Write-Fail "Visual Studio C++ Build Tools not found"
    Write-Info "This is required to compile node-pty (native Node.js addon)."
    Write-Host ""

    if (Get-WingetAvailable) {
        Write-Info "Installing Visual Studio 2022 Build Tools with C++ workload via winget..."
        Write-Info "This may take several minutes..."
        Write-Host ""

        winget install Microsoft.VisualStudio.2022.BuildTools `
            --accept-source-agreements --accept-package-agreements `
            --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

        # Re-check
        Refresh-Path
        if (Test-Path $vsWhere) {
            $vsInstalls = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
            if ($vsInstalls) {
                Write-OK "C++ Build Tools installed successfully"
                $hasCompatibleVS = $true
            }
        }

        if (-not $hasCompatibleVS) {
            Write-Warn "Build Tools installed but C++ workload may need manual selection."
            Write-Info "Open Visual Studio Installer and add 'Desktop development with C++' workload."
            $script:needsRestart = $true
        }
    } else {
        Write-Warn "Install manually:"
        Write-Info "1. Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
        Write-Info "2. Run the installer"
        Write-Info "3. Select 'Desktop development with C++' workload"
        Write-Info "4. Click Install and wait for completion"
        $script:needsRestart = $true
    }
}

# ─── 4. Configure npm for native builds ──────────────────────────

Write-Step "Configuring npm for native module builds..."

if (Test-Command "npm") {
    # Set Python path for node-gyp if Python is available
    if ($pythonCmd) {
        $pyPath = (Get-Command $pythonCmd).Source
        npm config set python "$pyPath" 2>$null
        Write-OK "npm python set to: $pyPath"
    }

    # Set Visual Studio version — must be 2022 (node-gyp doesn't support 2025+ yet)
    if ($hasCompatibleVS) {
        npm config set msvs_version 2022 2>$null
        Write-OK "npm msvs_version set to 2022"
    } elseif ($hasCpp) {
        # Has C++ tools but only unsupported version
        npm config set msvs_version 2022 2>$null
        Write-Warn "npm msvs_version set to 2022 but VS 2022 may not be installed yet"
    }
} else {
    Write-Warn "npm not available, skipping configuration"
}

# ─── 5. npm install ───────────────────────────────────────────────

Write-Step "Installing npm dependencies..."

if ($script:needsRestart) {
    Write-Warn "Skipping npm install - prerequisites were just installed."
    Write-Info "Please restart your terminal, then run:"
    Write-Info "  cd $projectRoot"
    Write-Info "  npm install"
    Write-Info "  npm run dev"
} else {
    if (Test-Command "npm") {
        Push-Location $projectRoot
        Write-Info "Running npm install (this may take a minute)..."
        npm install 2>&1 | ForEach-Object { Write-Info $_ }

        if ($LASTEXITCODE -eq 0) {
            Write-OK "npm install completed successfully"

            # Build renderer bundle
            Write-Step "Building renderer bundle..."
            npm run build 2>&1 | ForEach-Object { Write-Info $_ }

            if ($LASTEXITCODE -eq 0) {
                Write-OK "Build completed successfully"
            } else {
                Write-Warn "Build had issues - check output above"
            }
        } else {
            Write-Fail "npm install failed - check errors above"
            Write-Info "Common fix: close and reopen terminal, then run 'npm install' again"
        }
        Pop-Location
    } else {
        Write-Fail "npm not found - install Node.js first"
    }
}

# ─── Summary ──────────────────────────────────────────────────────

Write-Host ""
Write-Host "  =====================================" -ForegroundColor Magenta
Write-Host "   Setup Summary" -ForegroundColor Magenta
Write-Host "  =====================================" -ForegroundColor Magenta
Write-Host ""

if ($script:needsRestart) {
    Write-Warn "Some tools were installed and require a terminal restart."
    Write-Host ""
    Write-Info "After restarting your terminal:"
    Write-Info "  1. cd $projectRoot"
    Write-Info "  2. npm install"
    Write-Info "  3. npm run dev        (development with auto-rebuild)"
    Write-Info "     npm start          (build + launch)"
} else {
    Write-OK "All prerequisites are installed!"
    Write-Host ""
    Write-Info "To start developing:"
    Write-Info "  cd $projectRoot"
    Write-Info "  npm run dev           (development with auto-rebuild)"
    Write-Info "  npm start             (build + launch)"
    Write-Host ""
    Write-Info "Useful commands:"
    Write-Info "  npm run build         (build renderer only)"
    Write-Info "  npm run watch         (watch mode for renderer)"
    Write-Info "  npx electron-builder --win --dir   (package for Windows)"
}

Write-Host ""
