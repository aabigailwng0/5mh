@echo off
REM Skinalizer launcher for Windows. Delegates to the cross-platform run.py.
REM Usage: run.bat [setup^|backend^|frontend]
cd /d "%~dp0"
where py >nul 2>nul && (py run.py %*) || (python run.py %*)
