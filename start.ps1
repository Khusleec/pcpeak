# Rigup — one-command launcher (Windows / PowerShell)
# Usage:  ./start.ps1            (base stack)
#         ./start.ps1 -Full      (with observability)
param(
    [switch]$Full
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is required. Install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

$extra = @()
if ($Full) { $extra += '--full' }
node "$root/infra/scripts/start.js" @extra
