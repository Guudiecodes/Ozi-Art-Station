# Downloads the hero characters that are not bundled in the zip (they are binary files).
param([string]$Project = (Get-Location).Path)
$dir = Join-Path $Project "public\models"; New-Item -ItemType Directory -Force -Path $dir | Out-Null
$base = "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf"
foreach ($f in "Michelle.glb", "Soldier.glb") {
  $out = Join-Path $dir $f
  if (Test-Path $out) { Write-Host "have $f"; continue }
  try { Invoke-WebRequest -UseBasicParsing "$base/$f" -OutFile $out; Write-Host "downloaded $f" }
  catch { Write-Host "COULD NOT download $f. Download it from $base/$f and save it to $dir" -ForegroundColor Yellow }
}
