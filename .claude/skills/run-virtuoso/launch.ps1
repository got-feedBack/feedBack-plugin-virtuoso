# Launch a FeedBack host with this plugin junctioned in, ready to drive.
#
# Idempotent: kills any prior server on the chosen port, ensures a junction
# from the host's plugin dir to this repo, then starts the bundled Python
# interpreter against the user-clone of FeedBack source. After return, the
# server is up at http://127.0.0.1:<port>/ and driver.mjs can connect.
#
# Defaults assume the layout on this machine:
#   - checkout mode (DEFAULT): the FeedBack host source at
#     "C:\dev\feedback\repos\feedback" (holds main.py), run via the venv python
#     below. This is our CURRENT-FeedBack test target (the host the game ships).
#   - bundled mode: the frozen LEGACY Slopsmith Desktop at
#     "C:\Program Files\Slopsmith\" (bundled Python + slopsmith source on its
#     sys.path). Pre-release legacy check only; see the SLOPSMITH_SOURCE note.
#   - The plugin source lives next to this script (../../..)
#
# Override via env vars: VIRTUOSO_PORT, SLOPSMITH_CHECKOUT, DLC_DIR,
# CONFIG_DIR.

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginRoot = (Resolve-Path (Join-Path $ScriptDir '..\..\..')).Path
$Port = if ($env:VIRTUOSO_PORT) { $env:VIRTUOSO_PORT } else { '8765' }
# DEFAULT host source = the FeedBack mainline checkout (current FeedBack, the host
# the game ships). Was the legacy Slopsmith clone; migrated 2026-06-23. Override
# with $env:SLOPSMITH_CHECKOUT (e.g. point back at an old slopsmith clone).
$Checkout = if ($env:SLOPSMITH_CHECKOUT) { $env:SLOPSMITH_CHECKOUT } else { 'C:\dev\feedback\repos\feedback' }
# Which FeedBack RUNTIME to boot:
#   checkout (DEFAULT) — your git checkout ($Checkout), AUTO-PULLED current on every
#            launch (see the auto-update block below), run via a normal venv python
#            (no ._pth isolation → the checkout's own code loads). This is our primary
#            test target: CURRENT FeedBack, which ships the Minigames scoring SDK and
#            the latest capabilities. Needs a venv at $VenvDir with requirements.txt
#            installed (see SKILL.md "Testing against current FeedBack").
#   bundled  — the frozen Desktop install (resources\slopsmith, older). Its
#            python312._pth pins imports to the bundled code, so this tests against
#            what users on the current Desktop release actually run (e.g. NO scoring
#            SDK). Use `$env:SLOPSMITH_SOURCE='bundled'` before a release to verify
#            the version users currently have.
$Source = if ($env:SLOPSMITH_SOURCE) { $env:SLOPSMITH_SOURCE } else { 'checkout' }
# The venv python that runs the checkout. Named slopsmith-venv for historical
# reasons but it now serves the FeedBack checkout (its deps satisfy FeedBack's
# requirements.txt). Rebuild against $Checkout\requirements.txt if the host ever
# fails to start; override with $env:SLOPSMITH_VENV.
$VenvDir = if ($env:SLOPSMITH_VENV) { $env:SLOPSMITH_VENV } else { 'C:\Users\chris\slopsmith-venv' }
if ($Source -eq 'checkout') {
  $PythonExe = Join-Path $VenvDir 'Scripts\python.exe'
} else {
  # Velopack installs the active version under `current\` (the v0.2.9+ layout);
  # the legacy flat `resources\` path is a stale older install. Prefer current\
  # so `bundled` mode actually tests the version users run (devops audit 2026-06-08).
  $curPy = 'C:\Program Files\Slopsmith\current\resources\python\python.exe'
  $PythonExe = if (Test-Path $curPy) { $curPy } else { 'C:\Program Files\Slopsmith\resources\python\python.exe' }
}
$DlcDir = if ($env:DLC_DIR) { $env:DLC_DIR } else { 'C:\Users\chris\slopsmith-dlc' }
$ConfigDir = if ($env:CONFIG_DIR) { $env:CONFIG_DIR } else { 'C:\Users\chris\slopsmith-config' }
# Dedicated DEV plugins dir so the test host NEVER touches the user's real Desktop
# install at ...\Slopsmith\plugins\virtuoso (now a GitHub clone of virtuoso-dev,
# decoupled from this workspace on purpose). Override with $env:SLOPSMITH_PLUGINS_BASE.
$PluginsBase = if ($env:SLOPSMITH_PLUGINS_BASE) { $env:SLOPSMITH_PLUGINS_BASE } else { Join-Path $env:LOCALAPPDATA 'Slopsmith\plugins-dev' }
$JunctionPath = Join-Path $PluginsBase 'virtuoso'
# note_detect (the pinned chord-verifier clone) lives in the user's REAL plugins dir;
# mirror it into the dev dir so scoring-e2e keeps the same detector (not the bundled one).
$NoteDetectSrc  = Join-Path $env:LOCALAPPDATA 'Slopsmith\plugins\note_detect'
$NoteDetectLink = Join-Path $PluginsBase 'note_detect'
$LogDir = Join-Path $env:TEMP 'virtuoso'
$LogFile = Join-Path $LogDir 'server.log'

if (-not (Test-Path $PythonExe)) {
  if ($Source -eq 'checkout') {
    throw "Checkout venv python not found at $PythonExe. Create it once: py -3 -m venv $VenvDir; & '$VenvDir\Scripts\python.exe' -m pip install -r '$Checkout\requirements.txt'  (see SKILL.md)."
  }
  throw "Bundled Python not found at $PythonExe. Install FeedBack Desktop first."
}
if (-not (Test-Path (Join-Path $Checkout 'main.py'))) {
  throw "FeedBack source not found at $Checkout (expected main.py). Set `$env:SLOPSMITH_CHECKOUT, or clone the FeedBack host repo to C:\dev\feedback\repos\feedback."
}

# Keep the checkout CURRENT before each launch, so our primary test target tracks
# upstream FeedBack (the version that ships the Minigames scoring SDK + the latest
# capabilities). Non-fatal by design: skipped on a dirty tree, offline, or any error,
# so a launch never blocks on the network or clobbers a local edit. Refreshes the venv
# only when requirements.txt actually changed in the pull.
if ($Source -eq 'checkout') {
  $prevEAP = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try {
    # The host REGENERATES static/tailwind.min.css at startup (it scans the junctioned
    # plugins), dirtying this tracked file every run — which would block the auto-pull's
    # dirty-tree guard forever and silently stale the checkout. It's a runtime artifact we
    # never hand-edit, so discard it before the dirty check + pull.
    & git -C $Checkout checkout -- static/tailwind.min.css 2>$null
    $porcelain = & git -C $Checkout status --porcelain
    if ($porcelain) {
      Write-Host "[launch] checkout has local changes -- skipping auto-pull (pull it manually when ready)"
    } else {
      $before = (& git -C $Checkout rev-parse HEAD).Trim()
      & git -C $Checkout fetch --quiet 2>$null
      & git -C $Checkout pull --ff-only --quiet 2>$null
      if ($LASTEXITCODE -ne 0) { Write-Host "[launch] auto-pull: 'git pull' returned $LASTEXITCODE -- non-fatal, using the current checkout" }
      $after = (& git -C $Checkout rev-parse HEAD).Trim()
      if ($before -ne $after) {
        Write-Host "[launch] checkout updated $($before.Substring(0,7)) -> $($after.Substring(0,7))"
        if (& git -C $Checkout diff --name-only $before $after | Select-String 'requirements' -Quiet) {
          Write-Host "[launch] requirements changed -- refreshing venv (pip install)..."
          & $PythonExe -m pip install -q -r (Join-Path $Checkout 'requirements.txt') 2>$null
          if ($LASTEXITCODE -ne 0) { Write-Host "[launch] WARNING: pip install exited $LASTEXITCODE -- venv may be stale; rerun 'pip install -r requirements.txt' manually if the host fails to start" }
        }
      } else {
        Write-Host "[launch] checkout already current ($($after.Substring(0,7)))"
      }
    }
  } catch { Write-Host "[launch] auto-pull skipped: $($_.Exception.Message)" }
  $ErrorActionPreference = $prevEAP
}

Write-Host "[launch] killing any prior server on port $Port..."
$conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($conns) {
  $conns | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
    try { Stop-Process -Id $_ -Force -ErrorAction Stop } catch {}
  }
  Start-Sleep -Seconds 1
}

foreach ($d in @($PluginsBase, $DlcDir, $ConfigDir, $LogDir)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}

# Junction the host's plugin dir to this repo so the running server picks up
# live edits. If something non-junction lives there, back it up first.
if (Test-Path $JunctionPath) {
  $attrs = (Get-Item $JunctionPath -Force).Attributes
  $isReparse = ($attrs.value__ -band 1024) -ne 0   # FILE_ATTRIBUTE_REPARSE_POINT = 0x400
  if ($isReparse) {
    Write-Host "[launch] junction already at $JunctionPath -- leaving as-is"
  } else {
    $stamp = Get-Date -Format 'yyyyMMddHHmmss'
    Write-Host "[launch] backing up existing $JunctionPath -> .bak.$stamp"
    Move-Item $JunctionPath "$JunctionPath.bak.$stamp"
    cmd /c mklink /J "$JunctionPath" "$PluginRoot" | Out-Null
  }
} else {
  Write-Host "[launch] creating junction $JunctionPath -> $PluginRoot"
  cmd /c mklink /J "$JunctionPath" "$PluginRoot" | Out-Null
}

# Mirror note_detect into the dev plugins dir (junction -> the user's pinned clone)
# so the dev host has the chord verifier without depending on the bundled version.
if ((Test-Path $NoteDetectSrc) -and -not (Test-Path $NoteDetectLink)) {
  Write-Host "[launch] linking note_detect -> $NoteDetectSrc"
  cmd /c mklink /J "$NoteDetectLink" "$NoteDetectSrc" | Out-Null
}

# ── Prune foreign / shadow plugins from the dev plugins dir ──────────────────
# This script only ever ADDS links; with no prune step an orphan silently rides
# along. A retired 'slopscale' link that ALSO declared id:virtuoso once shadowed
# the real repo here -- the host caches by id+version, so a same-version shadow
# can win the scan and serve STALE code (the "my edit didn't take" ghost). Keep
# EXACTLY the dev set; remove anything else. Links only -- never the targets.
$AllowedDevPlugins = @('virtuoso', 'note_detect')
Get-ChildItem -LiteralPath $PluginsBase -Force -ErrorAction SilentlyContinue | ForEach-Object {
  if ($AllowedDevPlugins -contains $_.Name) { return }
  $isReparse = ($_.Attributes.value__ -band 1024) -ne 0   # FILE_ATTRIBUTE_REPARSE_POINT
  if ($isReparse) {
    Write-Host "[launch] pruning foreign dev plugin '$($_.Name)' (removing link only, not its target)"
    cmd /c rmdir "$($_.FullName)" | Out-Null   # rmdir on a junction/symlink drops the LINK, never the target
  } else {
    Write-Host "[launch] WARNING: unexpected real dir '$($_.Name)' in $PluginsBase -- NOT auto-deleting; remove by hand if it's cruft"
  }
}

Write-Host "[launch] starting server [$Source] via $PythonExe on http://127.0.0.1:$Port/ (log: $LogFile)"
$env:HOST = '127.0.0.1'
$env:PORT = $Port
$env:DLC_DIR = $DlcDir
$env:CONFIG_DIR = $ConfigDir
# Point user-plugin discovery (SLOPSMITH_PLUGINS_DIR, read by server.py/plugins) at
# the DEV plugins dir for BOTH modes — so the test host reads plugins-dev (this
# workspace), never the user's real Desktop install. (Bundled honours the env too;
# if a bundled build ever ignored it, it would fall back to the default dir, which
# now holds the clean virtuoso-dev clone — still a valid plugin, just not live edits.)
$env:SLOPSMITH_PLUGINS_DIR = $PluginsBase
if ($Source -eq 'checkout') {
  # main.py imports top-level modules from BOTH the checkout root and lib/ (the
  # bundled python's ._pth listed ../slopsmith + ../slopsmith/lib). The venv
  # python isn't ._pth-isolated, so it honours PYTHONPATH — mirror those here.
  $env:PYTHONPATH = "$Checkout;$(Join-Path $Checkout 'lib')"
}

$proc = Start-Process -FilePath $PythonExe -ArgumentList 'main.py' `
  -WorkingDirectory $Checkout `
  -RedirectStandardOutput $LogFile `
  -RedirectStandardError "$LogFile.err" `
  -WindowStyle Hidden -PassThru

# Wait until /api/plugins/virtuoso/status returns ok, or fail.
$deadline = (Get-Date).AddSeconds(20)
$ready = $false
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/plugins/virtuoso/status" -TimeoutSec 2 -UseBasicParsing
    if ($r.StatusCode -eq 200 -and $r.Content -match '"ok":true') {
      Write-Host "[launch] up (pid $($proc.Id)) -- $($r.Content)"
      Write-Host "[launch] driver: node .claude/skills/run-virtuoso/driver.mjs smoke"
      $ready = $true
      break
    }
  } catch {}
}

if (-not $ready) {
  Write-Error "[launch] server did not become ready within 20s. Tail of log:"
  if (Test-Path $LogFile) { Get-Content $LogFile -Tail 30 }
  if (Test-Path "$LogFile.err") { Get-Content "$LogFile.err" -Tail 30 }
  exit 1
}

# ── Complete first-run onboarding so the modal never blocks driving ──────────
# FeedBack (v0.3.0+) shows a full-screen #v3-onboarding modal whenever the
# server-side profile has onboarded=0 (server.py: POST /api/profile sets
# onboarded=1). That modal intercepts pointer events and breaks driver.mjs +
# every smoke suite's first click. Completing onboarding once via the API marks
# the (config-dir) profile onboarded — it then never renders for ANY browser
# context, so the whole headless harness works untouched. Idempotent (only POSTs
# when not already onboarded) and version-aware (legacy Slopsmith host has no
# /api/profile -> 404 -> caught -> skipped). Non-fatal by design.
$prevEAP2 = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
try {
  $prof = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/profile" -TimeoutSec 3
  if ($prof -and $prof.onboarded) {
    Write-Host "[launch] onboarding already complete (profile.onboarded=1)"
  } else {
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/profile" -Method Post `
      -ContentType 'application/json' -Body '{"display_name":"Dev Tester"}' -TimeoutSec 5 | Out-Null
    Write-Host "[launch] completed first-run onboarding (profile.onboarded=1) -- #v3-onboarding modal suppressed"
  }
} catch {
  Write-Host "[launch] onboarding auto-complete skipped (no /api/profile or error): $($_.Exception.Message)"
}
$ErrorActionPreference = $prevEAP2

# ── Environment preflight: assert the dev host matches the mainline reference ─
# Turns "detection behaves differently from the game / green notes don't fire"
# from a multi-hour ghost hunt into a named, immediate failure. Reference =
# env-reference.json (the versions the shipped FeedBack game runs). CRITICAL
# mismatches abort (exit 2); non-critical drift only WARNs (so npm test still
# runs). Re-capture the reference on each host-release overlap sweep.
$RefPath = Join-Path $ScriptDir 'env-reference.json'
$ref = $null
if (Test-Path $RefPath) {
  try { $ref = Get-Content $RefPath -Raw | ConvertFrom-Json }
  catch { Write-Host "[preflight] WARNING: could not parse env-reference.json: $($_.Exception.Message)" }
}
if ($ref) {
  # Where the running host loads each plugin from: note_detect = the pinned dev
  # link; the core borrows = the active host's own plugins dir (mode-dependent).
  if ($Source -eq 'checkout') {
    $HostPluginsDir = Join-Path $Checkout 'plugins'
  } else {
    $HostPluginsDir = Join-Path (Split-Path (Split-Path $PythonExe -Parent) -Parent) 'slopsmith\plugins'
  }
  function Get-PluginVersion($dir) {
    $pj = Join-Path $dir 'plugin.json'
    if (-not (Test-Path $pj)) { return $null }
    try { return (Get-Content $pj -Raw | ConvertFrom-Json).version } catch { return $null }
  }
  $crit = @(); $warn = @()
  Write-Host "[preflight] host mode: $Source  |  reference captured $($ref.capturedDate)"
  foreach ($name in $ref.plugins.PSObject.Properties.Name) {
    $spec = $ref.plugins.$name
    $dir  = if ($name -eq 'note_detect') { $NoteDetectLink } else { Join-Path $HostPluginsDir $name }
    $got  = Get-PluginVersion $dir
    $tag  = if ($spec.critical) { 'CRITICAL' } else { 'borrow' }
    if (-not $got) {
      if ($spec.critical) { $crit += "$name MISSING (expected $($spec.version))" } else { $warn += "$name missing (expected $($spec.version))" }
      Write-Host "[preflight]   $name : <missing>   (ref $($spec.version), $tag)"
    } elseif ($got -ne $spec.version) {
      if ($spec.critical) { $crit += "$name $got != reference $($spec.version)" } else { $warn += "$name $got != reference $($spec.version)" }
      Write-Host "[preflight]   $name : $got   != ref $($spec.version)  [$tag DRIFT]"
    } else {
      Write-Host "[preflight]   $name : $got   == ref  [$tag ok]"
    }
    if ($name -eq 'note_detect' -and $got -and $spec.requiresApi) {
      $sj = Join-Path $dir 'screen.js'
      if (Test-Path $sj) {
        $src = Get-Content $sj -Raw
        $absent = @($spec.requiresApi | Where-Object { $src -notmatch [regex]::Escape($_) })
        if ($absent.Count) { $crit += "note_detect missing contained-verifier API: $($absent -join ', ')" }
        else { Write-Host "[preflight]   note_detect contained-verifier API: present" }
      }
    }
  }
  # Uniqueness: exactly one plugin claiming id:virtuoso under the dev dir.
  $vIds = @(Get-ChildItem -LiteralPath $PluginsBase -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $pj = Join-Path $_.FullName 'plugin.json'
    if (Test-Path $pj) { try { if ((Get-Content $pj -Raw | ConvertFrom-Json).id -eq 'virtuoso') { $_.Name } } catch {} }
  })
  if ($vIds.Count -ne 1) { $crit += "expected exactly one id:virtuoso plugin, found $($vIds.Count): $($vIds -join ', ')" }
  else { Write-Host "[preflight]   id:virtuoso sources: 1 ($($vIds[0])) ok" }

  foreach ($w in $warn) { Write-Host "[preflight] WARN  $w" }
  if ($crit.Count) {
    Write-Host "[preflight] ENVIRONMENT DRIFT -- aborting (these make grading behave unlike the game):"
    foreach ($c in $crit) { Write-Host "  - $c" }
    Write-Error "[preflight] env drift: $($crit.Count) critical mismatch(es). Fix the env, or update env-reference.json if the reference itself moved (host-release sweep)."
    exit 2
  }
  Write-Host "[preflight] OK -- dev host matches the mainline reference."
}
