$ErrorActionPreference = 'Stop'
Write-Host 'Hynoe YouTube Agent - RTX Worker Installer' -ForegroundColor Yellow
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python 3.11+ is required.' }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Write-Host 'FFmpeg was not found in PATH. Install FFmpeg with NVENC support, then rerun.' -ForegroundColor Red; exit 1 }
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\pip.exe install -r requirements.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env; Write-Host 'Created .env. Add your Hynoe Agent login before first run.' -ForegroundColor Cyan }
Write-Host 'Worker installed. Run: .\.venv\Scripts\python.exe worker.py --once' -ForegroundColor Green
