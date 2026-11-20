@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo   flovex - Windows .EXE Builder
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Download Node.js LTS from https://nodejs.org/ and try again.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm is not installed or not in PATH.
    pause
    exit /b 1
)

echo [1/4] Installing project dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo.
echo [2/4] Building flovex web bundle...
call npm run build
if errorlevel 1 (
    echo [ERROR] Vite build failed.
    pause
    exit /b 1
)

echo.
echo [3/4] Ensuring Electron and electron-builder are installed...
if not exist "node_modules\electron" (
    call npm install --no-save electron electron-builder
    if errorlevel 1 (
        echo [ERROR] Failed to install electron and electron-builder.
        pause
        exit /b 1
    )
) else if not exist "node_modules\electron-builder" (
    call npm install --no-save electron-builder
    if errorlevel 1 (
        echo [ERROR] Failed to install electron-builder.
        pause
        exit /b 1
    )
)

echo.
echo [4/4] Packaging Windows .exe files...
call npx electron-builder --config electron-builder.json --win
if errorlevel 1 (
    echo [ERROR] Windows .exe build failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Build complete! Your .exe files are in:
echo   %cd%\dist-electron
echo ============================================
if exist "dist-electron" start "" "dist-electron"
pause
