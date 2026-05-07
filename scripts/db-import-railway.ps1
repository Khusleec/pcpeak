# Railway MySQL руу SQL оруулах (Docker дээрх mysql client, stdin pipe)
# Шаардлага: Docker суусан байх
#
# Жишээ:
#   .\scripts\db-import-railway.ps1 -MySqlHost "xxx.proxy.rlwy.net" -Port 57778 -User "root" -Password "..." -Database "railway" -SqlFile ".\local-mysql-dump.sql"
#
# Нууц үг түр хадгалахгүйгээр:
#   $p = Read-Host -AsSecureString
#   $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p)
#   $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
#   .\scripts\db-import-railway.ps1 ... -Password $plain

param(
  [Parameter(Mandatory = $true)][string]$MySqlHost,
  [Parameter(Mandatory = $true)][int]$Port,
  [Parameter(Mandatory = $true)][string]$User,
  [Parameter(Mandatory = $true)][string]$Password,
  [Parameter(Mandatory = $true)][string]$Database,
  [Parameter(Mandatory = $true)][string]$SqlFile
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$sqlPath = if ([System.IO.Path]::IsPathRooted($SqlFile)) { $SqlFile } else { Join-Path $root $SqlFile }

if (-not (Test-Path $sqlPath)) {
  Write-Error "Файл олдсонгүй: $sqlPath"
}

Write-Warning "mysqldump ихэвчлэн DROP TABLE IF EXISTS агуулдаг — Railway дээрх ижил хүснэгүүдийн өгөгдөл дахин бичигдэнэ. Шаардлагатай бол өмнө нь backup авна уу."
Write-Host "Import -> tcp://${MySqlHost}:${Port} / $Database" -ForegroundColor Cyan

$sqlText = [System.IO.File]::ReadAllText($sqlPath, [System.Text.Encoding]::UTF8)

# MYSQL_PWD: mysql client (8.0) дэмжинэ; Docker -e-ээр контейнерт дамжуулна
$pInfo = New-Object System.Diagnostics.ProcessStartInfo
$pInfo.FileName = "docker"
$pInfo.Arguments = @(
  "run", "--rm", "-i",
  "-e", "MYSQL_PWD=$Password",
  "mysql:8.0",
  "mysql", "--protocol=TCP",
  "-h", $MySqlHost,
  "-P", "$Port",
  "-u", $User,
  $Database
)
$pInfo.UseShellExecute = $false
$pInfo.RedirectStandardInput = $true
$pInfo.RedirectStandardOutput = $true
$pInfo.RedirectStandardError = $true

$proc = New-Object System.Diagnostics.Process
$proc.StartInfo = $pInfo
[void]$proc.Start()
$proc.StandardInput.Write($sqlText)
$proc.StandardInput.Close()
$stderr = $proc.StandardError.ReadToEnd()
$stdout = $proc.StandardOutput.ReadToEnd()
$proc.WaitForExit()

if ($stdout.Trim()) { Write-Host $stdout }
if ($stderr.Trim()) { Write-Host $stderr -ForegroundColor Yellow }

if ($proc.ExitCode -ne 0) {
  Write-Error "Import амжилтгүй (exit $($proc.ExitCode)). Railway host/port/user/database шалгана уу."
}

Write-Host "Import дууссан." -ForegroundColor Green
