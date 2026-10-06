$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$branchBase = 'https://raw.githubusercontent.com/HynoeGeshi/hynoegeshi.github.io/refs/heads/docs/hynoe-youtube-agent-spec/youtube-agent/worker'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $PSScriptRoot ("backup-" + $stamp)
$tempDir = Join-Path $PSScriptRoot ("update-temp-" + $stamp)

if (-not (Test-Path '.\.venv\Scripts\python.exe')) {
    throw 'Worker virtual environment is missing. Run install.ps1 first.'
}

New-Item -ItemType Directory -Path $backupDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tempDir 'tests') -Force | Out-Null

$files = @(
    @{ Remote = 'worker.py'; Local = 'worker.py' },
    @{ Remote = 'clip_quality.py'; Local = 'clip_quality.py' },
    @{ Remote = 'tests/test_clip_quality.py'; Local = 'tests\test_clip_quality.py' }
)

try {
    foreach ($file in $files) {
        $current = Join-Path $PSScriptRoot $file.Local
        if (Test-Path $current) {
            $backupTarget = Join-Path $backupDir $file.Local
            New-Item -ItemType Directory -Path (Split-Path $backupTarget) -Force | Out-Null
            Copy-Item $current $backupTarget -Force
        }

        $downloadTarget = Join-Path $tempDir $file.Local
        New-Item -ItemType Directory -Path (Split-Path $downloadTarget) -Force | Out-Null
        Invoke-WebRequest -UseBasicParsing -Uri ("$branchBase/" + $file.Remote) -OutFile $downloadTarget
        if ((Get-Item $downloadTarget).Length -lt 20) { throw "Downloaded file is unexpectedly small: $($file.Remote)" }
    }

    foreach ($file in $files) {
        $source = Join-Path $tempDir $file.Local
        $destination = Join-Path $PSScriptRoot $file.Local
        New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
        Copy-Item $source $destination -Force
    }

    Write-Host ''
    Write-Host 'Running Hynoe Shorts quality tests...' -ForegroundColor Cyan
    & '.\.venv\Scripts\python.exe' -m unittest discover -s tests -v
    if ($LASTEXITCODE -ne 0) { throw 'Tests failed after update.' }

    Write-Host ''
    Write-Host 'Hynoe YouTube worker updated successfully.' -ForegroundColor Green
    Write-Host 'Restart agent_runner.bat so the running worker loads the new code.' -ForegroundColor Yellow
    Write-Host "Backup saved at: $backupDir"
}
catch {
    Write-Host ''
    Write-Host "Update failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Restoring previous worker files...' -ForegroundColor Yellow
    foreach ($file in $files) {
        $backupSource = Join-Path $backupDir $file.Local
        if (Test-Path $backupSource) {
            $destination = Join-Path $PSScriptRoot $file.Local
            Copy-Item $backupSource $destination -Force
        }
    }
    throw
}
finally {
    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
}
