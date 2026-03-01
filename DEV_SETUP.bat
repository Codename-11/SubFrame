@echo off
:: DEV_SETUP.bat - Frame Development Environment Setup (Windows)
:: Launches the PowerShell setup script with admin privileges if needed.

echo.
echo  ==============================
echo   Frame - Dev Environment Setup
echo  ==============================
echo.

:: Check if PowerShell is available
where pwsh >nul 2>&1 && (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev_setup.ps1" %*
    goto :end
)

where powershell >nul 2>&1 && (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev_setup.ps1" %*
    goto :end
)

echo [ERROR] PowerShell not found. Please install PowerShell.
pause
exit /b 1

:end
echo.
pause
