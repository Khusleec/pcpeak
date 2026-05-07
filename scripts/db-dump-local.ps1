# Локал Docker MySQL (docker-compose) -> SQL файл
# Ажиллуулах (репо root): .\scripts\db-dump-local.ps1
# Урьдчилан: docker compose up -d mysql

param(
  [string]$OutFile = "local-mysql-dump.sql"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path "docker-compose.yml")) {
  Write-Error "docker-compose.yml олдсонгүй. Скрифтийг Rigup репо root-оос ажиллуулна уу."
}

$outPath = if ([System.IO.Path]::IsPathRooted($OutFile)) { $OutFile } else { Join-Path $root $OutFile }

Write-Host "Dump: rigup-mysql -> $outPath" -ForegroundColor Cyan

$dump = docker compose exec -T mysql bash -lc 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" --single-transaction --routines --triggers --set-gtid-purged=OFF --no-tablespaces 2>/dev/null'
if ($LASTEXITCODE -ne 0) {
  Write-Error "mysqldump амжилтгүй. Шалгах: docker compose ps | mysql health"
}

[System.IO.File]::WriteAllText($outPath, $dump, [System.Text.UTF8Encoding]::new($false))
Write-Host "OK — $($dump.Length) bytes" -ForegroundColor Green
Write-Host "Дараагийн алхам: Railway руу оруулах — scripts\db-import-railway.ps1 -?" -ForegroundColor DarkGray
