@echo off
rem Price editor - double-click to open it in your browser.
setlocal
cd /d "%~dp0"
set "PY=C:\ProgramData\anaconda3\python.exe"
if not exist "%PY%" set "PY=python"
"%PY%" -m streamlit run price_editor.py --server.address localhost --server.port 8602 --server.headless false --browser.gatherUsageStats false
if errorlevel 1 pause
