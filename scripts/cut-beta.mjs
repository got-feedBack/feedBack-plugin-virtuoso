#!/usr/bin/env node
/*
 * cut-beta.mjs — publish the "Virtuoso (Beta)" build.
 *
 * WHAT IT DOES
 *   Builds a RENAMED mirror of `virtuoso-dev` (plugin id `virtuoso_beta`,
 *   name/label "Virtuoso (Beta)", version `X.Y.Z-beta.N`) and commits it to the
 *   `virtuoso-beta` branch. Because the id differs, the beta INSTALLS ALONGSIDE
 *   the stable Virtuoso in FeedBack — two nav entries, fully independent
 *   (own routes, own presets/tunings tables, own DOM ids). That side-by-side is
 *   only possible with a distinct id: the host keys plugins by `id` and inlines
 *   every plugin screen into one shared page, so two `virtuoso` installs would
 *   collide (registration + duplicate DOM ids). See docs/beta-testing.md.
 *
 * WHY A SCRIPT (not a hand-maintained fork)
 *   screen.html/screen.js carry ~1600 literal `virtuoso` references (element
 *   ids, /api/plugins/virtuoso/ URLs, localStorage keys). Renaming by hand on
 *   every dev change is unmaintainable; this regenerates it mechanically.
 *
 * SOURCE = the latest COMMIT on the source ref (default virtuoso-dev), NOT your
 *   working tree. Commit your dev work first.
 *
 * USAGE
 *   node scripts/cut-beta.mjs                 build + commit to local virtuoso-beta (no push)
 *   node scripts/cut-beta.mjs --push          also push origin/virtuoso-beta
 *   node scripts/cut-beta.mjs --dry-run [dir] write the renamed tree to a temp dir only (inspect; no git)
 *   node scripts/cut-beta.mjs --version 0.7.6-beta.3   force the version
 *   node scripts/cut-beta.mjs --source <ref>  build from a different ref
 */

import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

// Repo root = the dir above scripts/ — robust no matter where the script is run from.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_TOKEN = 'virtuoso';        // lowercase id/namespace token
const BETA_TOKEN = 'virtuoso_beta';  // underscore → valid SQL table names + valid DOM ids
const BETA_BRANCH = 'virtuoso-beta';

// Files whose CONTENT carries the plugin id/namespace → blanket-rename the token.
const TRANSFORM = ['screen.html', 'screen.js', 'routes.py', 'settings.html'];
// Runtime files copied verbatim (no token inside, or must stay byte-identical).
const COPY_VERBATIM = ['LICENSE', 'README.md'];
// static/** is enumerated from the tree and copied verbatim (sound-font data).

// ── args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const optVal = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const DRY = has('--dry-run');
const PUSH = has('--push');
const SOURCE = optVal('--source', 'virtuoso-dev');
const FORCE_VERSION = optVal('--version', null);

// ── git helpers (execFile = no shell, so quoting/newlines are safe) ─────────
function git(a, o = {}) {
  // stderr piped (captured, not echoed) so the branch-existence probes in
  // gitQuiet() don't spray "fatal: invalid object name" to the console.
  return execFileSync('git', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'], ...o }).toString().replace(/\s+$/, '');
}
function gitQuiet(a) { try { return git(a); } catch { return null; } }
function show(ref, p, enc) {
  return execFileSync('git', ['show', `${ref}:${p}`], { cwd: REPO, maxBuffer: 1 << 30, ...(enc === 'buffer' ? {} : { encoding: 'utf8' }) });
}
function listTracked(ref, sub) {
  return git(['ls-tree', '-r', '--name-only', ref, ...(sub ? ['--', sub] : [])]).split('\n').filter(Boolean);
}

// ── resolve source + version ───────────────────────────────────────────────
const srcSha = gitQuiet(['rev-parse', '--short', SOURCE]);
if (!srcSha) { console.error(`[cut-beta] source ref '${SOURCE}' not found.`); process.exit(1); }
if (gitQuiet(['status', '--porcelain'])) {
  console.warn('[cut-beta] NOTE: working tree has uncommitted changes — the beta is built from the last COMMIT on ' + SOURCE + ', not your working tree.');
}

const devManifest = JSON.parse(show(SOURCE, 'plugin.json'));
const base = String(devManifest.version).replace(/[-+].*$/, '');   // "0.7.6-dev" → "0.7.6"
let betaVersion;
if (FORCE_VERSION) {
  betaVersion = FORCE_VERSION;
} else {
  const prevBeta = gitQuiet(['show', `${BETA_BRANCH}:plugin.json`]) || gitQuiet(['show', `origin/${BETA_BRANCH}:plugin.json`]);
  let n = 1;
  if (prevBeta) {
    const m = String(JSON.parse(prevBeta).version || '').match(new RegExp('^' + base.replace(/\./g, '\\.') + '-beta\\.(\\d+)$'));
    if (m) n = parseInt(m[1], 10) + 1;
  }
  betaVersion = `${base}-beta.${n}`;
}

// ── tree writer ────────────────────────────────────────────────────────────
function out(root, rel, data) {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, data);
}
function renameToken(s) { return s.split(SRC_TOKEN).join(BETA_TOKEN); }

function writeTree(root) {
  // plugin.json — structured edits (id/screen/server_files renamed; name/label/version explicit)
  const pj = JSON.parse(show(SOURCE, 'plugin.json'));
  pj.id = renameToken(pj.id);
  pj.name = 'Virtuoso (Beta)';
  pj.version = betaVersion;
  if (pj.nav) {
    if (pj.nav.label) pj.nav.label = pj.nav.label.replace('Virtuoso', 'Virtuoso (Beta)');
    if (pj.nav.screen) pj.nav.screen = renameToken(pj.nav.screen);
  }
  if (pj.settings && Array.isArray(pj.settings.server_files)) {
    pj.settings.server_files = pj.settings.server_files.map(renameToken);
  }
  out(root, 'plugin.json', JSON.stringify(pj, null, 2) + '\n');

  // 4 source files — blanket token rename (+ version badge in screen.js)
  for (const p of TRANSFORM) {
    let s = renameToken(show(SOURCE, p, 'utf8'));
    if (p === 'screen.js') {
      s = s.replace(/(const\s+VIRTUOSO_VERSION\s*=\s*)(['"]).*?\2/, `$1'${betaVersion}'`);
    }
    out(root, p, s);
  }

  // static/** verbatim
  for (const p of listTracked(SOURCE, 'static')) out(root, p, show(SOURCE, p, 'buffer'));

  // assets/** verbatim — the nav icon (plugin.json `icon`) + the self-hosted
  // card-skin fonts under assets/fonts/, served by routes.py's /font route.
  // Omitting them (prior cuts only copied static/) 404'd every skin font and
  // dropped the beta's nav icon.
  for (const p of listTracked(SOURCE, 'assets')) out(root, p, show(SOURCE, p, 'buffer'));

  // license/readme verbatim (if tracked)
  const tracked = new Set(listTracked(SOURCE));
  for (const p of COPY_VERBATIM) if (tracked.has(p)) out(root, p, show(SOURCE, p, 'buffer'));

  // minimal .gitignore for the generated branch
  out(root, '.gitignore', `# Generated Virtuoso (Beta) build — see scripts/cut-beta.mjs\n.${BETA_TOKEN}-temp/\n`);
}

// ── DRY RUN: just write the tree, no git ───────────────────────────────────
if (DRY) {
  const dest = optVal('--dry-run', null) || join(tmpdir(), `${BETA_BRANCH}-dryrun`);
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  writeTree(dest);
  console.log(`[cut-beta] DRY RUN`);
  console.log(`  source : ${SOURCE} @ ${srcSha}`);
  console.log(`  version: ${betaVersion}  (id: ${BETA_TOKEN})`);
  console.log(`  wrote  : ${dest}`);
  process.exit(0);
}

// ── REAL: build the virtuoso-beta branch in a throwaway worktree ──────────
const WT = join(tmpdir(), `${BETA_BRANCH}-wt`);
gitQuiet(['worktree', 'prune']);
if (existsSync(WT)) gitQuiet(['worktree', 'remove', '--force', WT]);

const localBeta = gitQuiet(['rev-parse', '--verify', '--quiet', `refs/heads/${BETA_BRANCH}`]);
const remoteBeta = gitQuiet(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${BETA_BRANCH}`]);
if (localBeta) git(['worktree', 'add', WT, BETA_BRANCH]);
else if (remoteBeta) git(['worktree', 'add', '-b', BETA_BRANCH, WT, `origin/${BETA_BRANCH}`]);
else git(['worktree', 'add', '-b', BETA_BRANCH, WT, SOURCE]);   // first ever cut

try {
  // wipe everything except .git, then regenerate
  for (const e of readdirSync(WT)) if (e !== '.git') rmSync(join(WT, e), { recursive: true, force: true });
  writeTree(WT);

  git(['-C', WT, 'add', '-A']);
  const changed = gitQuiet(['-C', WT, 'status', '--porcelain']);
  if (!changed) {
    console.log(`[cut-beta] virtuoso-beta already matches ${SOURCE} @ ${srcSha} — nothing to do.`);
  } else {
    const msg =
      `beta: sync virtuoso-dev @ ${srcSha} (v${betaVersion})\n\n` +
      `Auto-generated Virtuoso (Beta) build — a renamed (id: ${BETA_TOKEN}) mirror of\n` +
      `${SOURCE} so it installs ALONGSIDE the stable Virtuoso. Do not edit by hand;\n` +
      `regenerate with scripts/cut-beta.mjs.`;
    git(['-C', WT, 'commit', '-m', msg]);
    console.log(`[cut-beta] committed ${BETA_BRANCH} → v${betaVersion} (from ${SOURCE} @ ${srcSha})`);
    if (PUSH) {
      git(['-C', WT, 'push', 'origin', BETA_BRANCH]);
      console.log(`[cut-beta] pushed origin/${BETA_BRANCH}`);
    } else {
      console.log(`[cut-beta] NOT pushed (re-run with --push to publish).`);
    }
  }
} finally {
  gitQuiet(['worktree', 'remove', '--force', WT]);
}

// ── tester crib ─────────────────────────────────────────────────────────────
const url = gitQuiet(['remote', 'get-url', 'origin']) || '<your-repo-url>';
console.log(`\nTesters install ALONGSIDE stable (into the FeedBack plugins dir):`);
console.log(`  git clone -b ${BETA_BRANCH} ${url} ${BETA_TOKEN}`);
console.log(`Update:  git -C ${BETA_TOKEN} pull   (then restart FeedBack)`);
console.log(`Repair:  git -C ${BETA_TOKEN} reset --hard origin/${BETA_BRANCH}`);
