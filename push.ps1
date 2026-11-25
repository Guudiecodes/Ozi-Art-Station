# Usage: .\push.ps1 https://github.com/YOU/modelhub.git
param([Parameter(Mandatory=$true)][string]$Remote)
git init -b main; git add .; git commit -m "ModelHub: hero, library, viewer"
git remote add origin $Remote; git push -u origin main
