@echo off
REM ==========================================================================
REM run.bat — Windows launcher for the Sir Vishveshwaraiah Conference Hall
REM Booking System.
REM
REM Why this exists: the app uses JavaScript ES modules (import/export),
REM which browsers block from loading over a plain double-clicked file://
REM path (CORS). It has to be served over http://localhost instead. This
REM script starts the simplest possible local server and opens the app.
REM
REM Prerequisite: Python 3 must be installed and on PATH
REM (https://www.python.org/downloads/ — tick "Add Python to PATH" during
REM install). Most college lab machines already have it.
REM ==========================================================================

cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
    set PYCMD=python
) else (
    where py >nul 2>nul
    if %errorlevel%==0 (
        set PYCMD=py
    ) else (
        echo Python was not found on PATH.
        echo Install it from https://www.python.org/downloads/ and tick "Add Python to PATH", then run this file again.
        pause
        exit /b 1
    )
)

echo Starting local server at http://localhost:8000 ...
start "" http://localhost:8000/index.html
%PYCMD% -m http.server 8000
