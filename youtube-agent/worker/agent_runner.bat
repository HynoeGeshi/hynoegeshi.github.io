@echo off
cd /d %~dp0
if not exist .venv\Scripts\python.exe (
  echo Worker is not installed. Run install.ps1 first.
  pause
  exit /b 1
)
.venv\Scripts\python.exe worker.py
