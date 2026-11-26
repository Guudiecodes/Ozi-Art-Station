# Installs this version over an existing ModelHub project. Your data folder (accounts, uploads, orders) is never touched.
param([Parameter(Mandatory = $true)][string]$Project)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Project "package.json"))) { throw "No package.json in $Project. Check the project path." }
Write-Host "Make sure 'npm run dev' is stopped (Ctrl+C) before continuing." -ForegroundColor Yellow

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path (Split-Path -Parent $Project) "src-backup-$stamp"
if (Test-Path (Join-Path $Project "src")) { Move-Item (Join-Path $Project "src") $backup; Write-Host "Old code saved to $backup" }
Remove-Item (Join-Path $Project ".next") -Recurse -Force -ErrorAction SilentlyContinue

Copy-Item (Join-Path $here "src") (Join-Path $Project "src") -Recurse -Force
Copy-Item (Join-Path $here "scripts") (Join-Path $Project "scripts") -Recurse -Force
Copy-Item (Join-Path $here "package.json") (Join-Path $Project "package.json") -Force
Copy-Item (Join-Path $here ".env.example") (Join-Path $Project ".env.example") -Force
if (-not (Test-Path (Join-Path $Project ".env.local"))) { Copy-Item (Join-Path $here ".env.example") (Join-Path $Project ".env.local") }

$gi = Join-Path $Project ".gitignore"
foreach ($line in "node_modules", ".next", "data", ".env.local", "*.tsbuildinfo") {
  if (-not ((Test-Path $gi) -and (Select-String -Path $gi -SimpleMatch -Pattern $line -Quiet))) { Add-Content $gi $line }
}

Push-Location $Project
try {
  npm uninstall gsap 2>$null | Out-Null
  npm install
  & (Join-Path $Project "scripts\get-assets.ps1") -Project $Project
} finally { Pop-Location }
Write-Host "Done. Start the site with: cd $Project; npm run dev" -ForegroundColor Green
