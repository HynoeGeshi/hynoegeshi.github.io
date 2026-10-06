$ErrorActionPreference = 'Stop'
Write-Host 'Hynoe YouTube Agent - RTX Worker Installer' -ForegroundColor Yellow
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw 'Python 3.11+ is required.' }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { Write-Host 'FFmpeg was not found in PATH. Install FFmpeg with NVENC support, then rerun.' -ForegroundColor Red; exit 1 }
python -m venv .venv
if ($LASTEXITCODE -ne 0) { throw 'Failed to create Python virtual environment.' }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'Failed to upgrade pip.' }
& .\.venv\Scripts\pip.exe install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed. Worker was NOT installed.' }
if (-not (Test-Path .env)) { Copy-Item .env.example .env; Write-Host 'Created .env. Add your Hynoe Agent login before first run.' -ForegroundColor Cyan }
& .\.venv\Scripts\python.exe -c "import supabase, dotenv, faster_whisper, yt_dlp; print('Python dependencies verified.')"
if ($LASTEXITCODE -ne 0) { throw 'Dependency verification failed.' }
Write-Host 'Worker installed successfully. Run: .\.venv\Scripts\python.exe worker.py --once' -ForegroundColor Green
