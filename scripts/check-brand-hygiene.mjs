#!/usr/bin/env node
// Brand / IP hygiene guard — fails if a known competitor product/company name
// appears in any git-TRACKED file. Named competitors belong ONLY in local-only
// (gitignored) `.claude/` market-analyst files, never in the published repo
// (the "market lane" rule — only the market-analyst agent names real comps, and
// only in `.claude/`). This is the guardrail that would have caught commit
// `9ddf62a` (Rocksmith / Yousician in docs/host-achievements-review.md).
//
// Wiring: the `.githooks/pre-commit` hook runs it on every commit (enable once
// per clone: `git config core.hooksPath .githooks`); it's also in the CLAUDE.md
// session-end checklist. Zero deps; ~instant.
//
// Escape hatch: put the token `brand-ok` on the SAME line to sanction a genuine
// external SOURCE citation (a pedagogy reference link), which is not the same as
// competitive positioning. Use sparingly and visibly.
//
// Denylist curation: extend as new competitors get referenced. AVOID tokens that
// collide with our own code/words — e.g. NOT `jamplay` (clashes with our own
// jamPlay() function), NOT bare `fender` (legit instrument brand) or `melodic`.
// Matched word-boundaried + case-insensitive.
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const DENY = [
  "rocksmith", "ubisoft", "yousician", "melodics", "justinguitar",
  "justin guitar", "songsterr", "chordify", "ireal pro", "ireal",
  "band-in-a-box", "band in a box", "strum machine", "fender play",
  "simply guitar", "simply piano", "flowkey", "guitar tricks",
  "ultimate guitar", "truefire", "playground sessions", "moises",
  "soundraw", "backingtrack.app", "soundslice", "chordbot",
];

const SELF = "scripts/check-brand-hygiene.mjs";
const SKIP_EXT = /\.(png|jpe?g|gif|svg|ico|wav|mp3|ogg|flac|woff2?|ttf|otf|eot|pdf|zip|gz|nam|bin|dat)$/i;
const SKIP_PATH = /^static\/wafonts\//; // committed base64 sampler blobs — text but not prose

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const re = new RegExp("\\b(" + DENY.map(esc).join("|") + ")\\b", "i");

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
const hits = [];
for (const f of files) {
  if (f === SELF || SKIP_EXT.test(f) || SKIP_PATH.test(f)) continue;
  let txt;
  try {
    if (statSync(f).size > 2_000_000) continue;
    txt = readFileSync(f, "utf8");
  } catch { continue; }
  txt.split("\n").forEach((line, i) => {
    if (line.includes("brand-ok")) return; // sanctioned external-source citation
    const m = line.match(re);
    if (m) hits.push(`${f}:${i + 1}: "${m[1]}"  →  ${line.trim().slice(0, 100)}`);
  });
}

if (hits.length) {
  console.error("✗ brand-hygiene: competitor name(s) in tracked file(s).");
  console.error("  Named competitors live only in local-only .claude/ market-analyst files, never the published repo.\n");
  for (const h of hits) console.error("  " + h);
  console.error(`\n${hits.length} hit(s). Fix: generalize (describe the lane, don't name the product),`);
  console.error("or add `brand-ok` on the line for a genuine external SOURCE citation (a lesson reference).");
  process.exit(1);
}
console.log(`✓ brand-hygiene: clean — ${DENY.length} denied terms, ${files.length} tracked files scanned.`);
