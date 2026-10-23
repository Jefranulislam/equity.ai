# ==============================================================================
# pack-zip.ps1 - builds the marketplace submission ZIP for Equity.AI
#
# Layout produced (staging folder -> one ZIP):
#   README.md  HowToSetup.md  CLAUDE.md  CHANGELOG.md  LICENSE-NOTE.md
#   .env.example  docker-compose.yml
#   database/schema.sql + database/seed.sql
#   docs/*                       (optional documentation)
#   Project/*                    (full application source, no build artifacts)
#
# Secrets are NEVER included: .env and .dev.vars are excluded and the script
# fails if any real-credentials file named .env sneaks into the staging tree.
# ==============================================================================

param(
  [string]$OutZip = ".\Equity.AI.Submission.zip"
)

$ErrorActionPreference = 'Stop'
$root    = $PSScriptRoot
$staging = Join-Path $root '.package-staging'

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
if (Test-Path $OutZip)  { Remove-Item $OutZip  -Force }
New-Item -ItemType Directory -Path $staging | Out-Null

function Copy-Top([string]$Name) {
  $src = Join-Path $root $Name
  if (Test-Path $src) { Copy-Item $src (Join-Path $staging $Name) -Force }
}

# --- top-level documents ------------------------------------------------------
foreach ($f in @('README.md','HowToSetup.md','CLAUDE.md','CHANGELOG.md','LICENSE-NOTE.md','.env.example','docker-compose.yml')) {
  Copy-Top $f
}

# --- database install + seed --------------------------------------------------
New-Item -ItemType Directory -Path (Join-Path $staging 'database') | Out-Null
foreach ($f in @('schema.sql','seed.sql')) {
  $src = Join-Path $root "database\$f"
  if (-not (Test-Path $src)) { throw "Missing database\$f - cannot package" }
  Copy-Item $src (Join-Path $staging "database\$f") -Force
}

# --- docs ---------------------------------------------------------------------
if (Test-Path (Join-Path $root 'docs')) {
  robocopy (Join-Path $root 'docs') (Join-Path $staging 'docs') /E /NFL /NDL /NJH /NJS
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed on docs (exit $LASTEXITCODE)" }
}

# --- application source (Project/) -------------------------------------------
$project = Join-Path $staging 'Project'
New-Item -ItemType Directory -Path $project | Out-Null

# robocopy /XD dirs: never ship build artifacts, deps, VCS or secrets
robocopy $root $project /E `
  /XD node_modules dist .tanstack .wrangler .git .github .idea .vscode .package-staging database docs `
  /XF .env .env.local .dev.vars *.log pack-zip.ps1 Equity.AI.Submission.zip `
  /NFL /NDL /NJH /NJS
if ($LASTEXITCODE -ge 8) { throw "robocopy failed on Project (exit $LASTEXITCODE)" }

# keep an .env.example inside Project/ too (Targets A/B run from here)
Copy-Item (Join-Path $root '.env.example') (Join-Path $project '.env.example') -Force

# --- safety checks ------------------------------------------------------------
$must = @(
  'README.md','HowToSetup.md','CLAUDE.md','CHANGELOG.md','LICENSE-NOTE.md','.env.example',
  'docker-compose.yml','database\schema.sql','database\seed.sql',
  'Project\package.json','Project\bun.lock','Project\package-lock.json',
  'Project\src','Project\wrangler.jsonc','Project\vite.config.ts'
)
foreach ($m in $must) {
  if (-not (Test-Path (Join-Path $staging $m))) { throw "Staging is missing required path: $m" }
}

# no secrets anywhere in the staging tree
$envFiles = Get-ChildItem $staging -Recurse -Force -File |
  Where-Object { $_.Name -eq '.env' -or $_.Name -eq '.env.local' -or $_.Name -eq '.dev.vars' }
if ($envFiles) { throw ($envFiles.FullName | ForEach-Object { "SECRET FILE PRESENT: $_" } | Out-String) }

# report the un-compressed staging size
$totalBytes = (Get-ChildItem $staging -Recurse -Force -File | Measure-Object Length -Sum).Sum
Write-Host ("Staging size: {0:N1} MB" -f ($totalBytes / 1MB))

$zipPath = Join-Path $root $OutZip
# Use bsdtar (ships with Windows 10+) instead of Compress-Archive:
# Compress-Archive (PS 5.1) writes backslash entry separators, which violates
# the ZIP spec and breaks extraction on Linux/macOS unzip tools.
tar -a -cf $zipPath -C $staging .
Write-Host ("Created {0} ({1:N1} MB)" -f $zipPath, ((Get-Item $zipPath).Length / 1MB))

# keep the staging tree for inspection; remove if you prefer:
# Remove-Item $staging -Recurse -Force
