# launch-desktop.ps1 — Standardized DESKTOP dogfood launch (the real game, live repo).
#
# The FeedBack desktop (feedback.exe) loads plugins from its Electron userData dir
# (%APPDATA%\slopsmith-desktop\plugins\), where each dev plugin is a symlink to its
# working copy; that user copy WINS over the bundled snapshot (verified 2026-06-23).
# feedback.exe bundles the correct mainline sibling set (note_detect 1.15.3 +
# highway_3d 3.26.0 + minigames), so this is the highest-fidelity dogfood target:
# the shipped game with YOUR working copy of Virtuoso swapped in live.
#
# Why this script exists: that virtuoso symlink silently went stale when the repo
# was relocated (it still pointed at the old C:\Dev\feedback\repos\... clone, so the
# desktop loaded committed-HEAD code and NEVER your uncommitted edits — the exact
# "my changes don't show / it behaves like the game differently" ghost). This script
# SELF-HEALS the link to THIS repo every launch, then restarts the app on a clean
# slate (kills the zombie server that otherwise bumps the port 18000 -> 18001).
#
#   - Double-click feedback.exe = whatever the userData links currently point at.
#   - THIS script = forces virtuoso -> this repo, every time.
#   - Distinct from launch.ps1 (the HEADLESS host on :8765 for automated smoke).
#
# NOTE: feedback.exe uses its userData plugins dir, NOT $env:SLOPSMITH_PLUGINS_DIR
# (that env is the HEADLESS host's lever, and the desktop ignores it).
#
# Override via env: FEEDBACK_DESKTOP_EXE, FEEDBACK_USER_PLUGINS.

$ErrorActionPreference = 'Stop'
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginRoot = (Resolve-Path (Join-Path $ScriptDir '..\..\..')).Path
$AppExe      = if ($env:FEEDBACK_DESKTOP_EXE)  { $env:FEEDBACK_DESKTOP_EXE }  else { 'C:\Dev\feedback\desktop-app\feedback.exe' }
$UserPlugins = if ($env:FEEDBACK_USER_PLUGINS) { $env:FEEDBACK_USER_PLUGINS } else { Join-Path $env:APPDATA 'slopsmith-desktop\plugins' }
$Link        = Join-Path $UserPlugins 'virtuoso'

if (-not (Test-Path $AppExe))      { throw "FeedBack desktop not found at $AppExe. Set `$env:FEEDBACK_DESKTOP_EXE or build it first." }
if (-not (Test-Path $UserPlugins)) { throw "Desktop userData plugins dir not found at $UserPlugins. Launch the desktop once so it's created, or set `$env:FEEDBACK_USER_PLUGINS." }

# 1) Self-heal: the virtuoso link must point at THIS repo (fixes the stale-clone bug).
$needLink = $true
if (Test-Path $Link) {
  $item = Get-Item $Link -Force
  $isReparse = ($item.Attributes.value__ -band 1024) -ne 0
  if (-not $isReparse) { throw "$Link is a real directory, not a link. Move it aside, then re-run." }
  $cur = (Resolve-Path $item.Target -ErrorAction SilentlyContinue).Path
  if ($cur -eq $PluginRoot) { $needLink = $false; Write-Host "[desktop] virtuoso link OK -> $PluginRoot" }
  else { Write-Host "[desktop] re-pointing stale virtuoso link ($($item.Target) -> $PluginRoot)"; [System.IO.Directory]::Delete($Link, $false) }
}
if ($needLink) { New-Item -ItemType Junction -Path $Link -Target $PluginRoot | Out-Null; Write-Host "[desktop] linked virtuoso -> $PluginRoot" }

# 2) Clean slate: stop prior host instances (one app, no zombie squatting the port).
#    Targets ONLY the two known host installs -- never other python services (Bazarr, etc.).
$killNames = @('feedback.exe', 'Slopsmith.exe')
$stale = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
  ($killNames -contains $_.Name) -or
  ($_.Name -eq 'python.exe' -and $_.ExecutablePath -and
    ($_.ExecutablePath -like 'C:\Program Files\Slopsmith\*' -or $_.ExecutablePath -like 'C:\Dev\feedback\desktop-app\*'))
}
if ($stale) {
  Write-Host "[desktop] stopping $($stale.Count) prior host process(es) for a clean start..."
  $stale | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {} }
  Start-Sleep -Seconds 2
}

# 3) Launch.
Write-Host "[desktop] launching $AppExe"
$app = Start-Process -FilePath $AppExe -PassThru

# 4) Discover the (dynamic) server port and confirm virtuoso loaded from the repo.
$deadline = (Get-Date).AddSeconds(45); $port = $null; $ready = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 700
  if (-not $port) {
    $py = Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
          Where-Object { $_.ExecutablePath -like 'C:\Dev\feedback\desktop-app\*' -and $_.CommandLine -match 'uvicorn' } |
          Select-Object -First 1
    if ($py) { $m = [regex]::Match($py.CommandLine, '--port\s+(\d+)'); if ($m.Success) { $port = $m.Groups[1].Value } }
  }
  if ($port) {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/plugins/virtuoso/status" -TimeoutSec 2 -UseBasicParsing
      if ($r.StatusCode -eq 200 -and $r.Content -match '"ok":true') { $ready = $true; break }
    } catch {}
  }
}
if ($ready) {
  Write-Host "[desktop] UP -- virtuoso live on http://127.0.0.1:$port/  (from $PluginRoot)"
  Write-Host "[desktop] Edit screen.js/html -> reload the Virtuoso screen in the app (no rebuild). routes.py changes need a relaunch."
} else {
  Write-Warning "[desktop] launched (pid $($app.Id)) but virtuoso status not confirmed in 45s$(if($port){" on :$port"}else{' (no server port found)'}). Open the app window and check."
  exit 1
}
