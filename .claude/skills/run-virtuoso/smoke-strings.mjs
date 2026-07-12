#!/usr/bin/env node
// Assertive guard: generated charts must adjust for STRING COUNT and TUNING.
// Born from three real bugs (2026-06-01): (1) the string-count chip didn't
// regenerate, (2) the customOpenMidis hidden field sat OUTSIDE the controls
// form so readConfig never saw it, (3) readConfig resolved CAGED/3NPS shapes
// against the standard tuning instead of the effective one.
//
// IMPORTANT: this drives the REAL form -> readConfig path (set form fields /
// the hidden tuning input, then readConfig() + generateExercise). Hand-built
// configs lie here — stringCount, the effective tuning, and the pre-resolved
// CAGED shapeNotes are all co-derived inside readConfig, so a faithful test
// must go through it. PASS/FAIL per check; non-zero exit on any failure.
import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (cond, label, detail) => { console.log(`  [${cond ? "PASS" : "FAIL"}] ${label}${detail ? "  " + detail : ""}`); if (!cond) fails++; };

async function ensureHost() {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);
}

const browser = await chromium.launch({ headless: true });
try {
  await ensureHost();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  // Seed the L1 instrument store BEFORE page scripts run: the host-settings
  // sync (v0.1.11) treats an empty localStorage as a fresh install and ADOPTS
  // host config — which persists whatever instrument the PREVIOUS suite's panel
  // drives wrote through (cross-suite contamination; the panel flipped to bass
  // mid-suite). With the store seeded, the local-wins boot path holds the
  // deterministic 6-string default AND heals the host config for later suites.
  await page.addInitScript(() => { try { localStorage.setItem("virtuoso.instrument", JSON.stringify({ stringSetup: "guitar_6_standard", customOpenMidis: "" })); } catch (_) {} });
  const pageErrs = [];
  page.on("pageerror", e => pageErrs.push(e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached" });
  await page.waitForSelector("#virtuoso-view-select");
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.generateExercise === "function", { timeout: 10000 });

  // Install in-page helpers that drive the real form + readConfig.
  await page.evaluate(() => {
    window.__t = {
      setForm(o) { for (const [k, v] of Object.entries(o)) { const el = document.querySelector(`#virtuoso-controls [name="${k}"]`); if (el) el.value = String(v); } },
      // advancedMode is a checkbox; readConfig FORCES fretboardSystem to 'caged'
      // unless it's 'on', so any test of a non-caged system (e.g. full_neck) must
      // enable it or it silently tests CAGED instead.
      setAdvanced(on) { const c = document.querySelector('[name="advancedMode"]'); if (c) { c.checked = !!on; c.dispatchEvent(new Event("change", { bubbles: true })); } },
      setTuning(midis) { const h = document.querySelector("#virtuoso-custom-open-midis"); if (h) h.value = midis ? midis.join(",") : ""; },
      gen() {
        const ex = window.Virtuoso.generateExercise(window.Virtuoso.readConfig());
        const ss = ex.chart.notes.map(n => n.s);
        const seen = new Set(), pos = [];
        for (const n of ex.chart.notes) { const k = `${n.s}:${n.f}`; if (!seen.has(k)) { seen.add(k); pos.push({ s: n.s, f: n.f }); } }
        pos.sort((a, b) => a.s - b.s || a.f - b.f);
        return { sig: [...seen].sort().join("|"), n: ex.chart.notes.length, min: Math.min(...ss), max: Math.max(...ss), pos, strings: [...new Set(ss)].sort((a, b) => a - b) };
      },
    };
  });

  console.log("-- (1) GENERATOR adapts to string count (full_neck uses every string) --");
  for (const [setup, count] of [["guitar_6_standard", 6], ["guitar_7_standard", 7], ["guitar_8_standard", 8], ["bass_4_standard", 4], ["bass_5_standard", 5], ["bass_6_standard", 6]]) {
    const r = await page.evaluate((su) => { window.__t.setAdvanced(true); window.__t.setTuning(null); window.__t.setForm({ stringSetup: su, practiceType: "scale", scale: "major", key: "C", fretboardSystem: "full_neck" }); return window.__t.gen(); }, setup);
    ok(r.n > 0 && r.min === 0 && r.max === count - 1, setup, `notes=${r.n} strings=${r.min}..${r.max} (expect max ${count - 1})`);
  }

  console.log("-- (2) GENERATOR adapts to tuning (CAGED shape shifts; guards the orphaned field + shape-resolution fixes) --");
  const t = await page.evaluate(() => {
    window.__t.setForm({ stringSetup: "guitar_6_standard", practiceType: "scale", scale: "major", key: "C", fretboardSystem: "caged", shape: "E" });
    window.__t.setTuning(null); const std = window.__t.gen().sig;
    window.__t.setTuning([38, 45, 50, 55, 59, 64]); const dropD = window.__t.gen().sig;   // low E -> D, via the hidden field readConfig must read
    window.__t.setTuning(null);
    return { std, dropD };
  });
  ok(t.std !== t.dropD, "Drop-D shifts the CAGED note positions vs standard", t.std === t.dropD ? "(IDENTICAL — tuning ignored!)" : "(differ)");

  console.log("-- (3) UI: tuning dropdown changes the generated chart --");
  await page.evaluate(() => { document.querySelector("#virtuoso-mode-custom")?.click(); document.querySelector("#virtuoso-setup-btn")?.click(); });
  await page.waitForTimeout(150);
  const ui = await page.evaluate(() => {
    window.__t.setForm({ stringSetup: "guitar_6_standard", practiceType: "scale", scale: "major", key: "C", fretboardSystem: "caged", shape: "E" });
    window.__t.setTuning(null);
    const before = window.__t.gen().sig;
    const sel = document.querySelector("#virtuoso-tuning-select");
    let picked = null;
    for (const o of sel.options) { if (o.value !== sel.value && !o.disabled && o.value !== "custom" && o.value !== "standard") { sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true })); picked = o.textContent; break; } }
    return { picked, before, after: window.__t.gen().sig };
  });
  ok(ui.picked && ui.before !== ui.after, "a non-standard tuning preset changes the generated notes", `picked=${ui.picked}`);

  console.log("-- (4) UI: string-count chip updates readConfig().stringSetup --");
  const uiCount = await page.evaluate(() => {
    const before = window.Virtuoso.readConfig().stringSetup;
    document.querySelector('#virtuoso-string-count-row .virtuoso-string-count-btn[data-count="7"]')?.click();
    return { before, after: window.Virtuoso.readConfig().stringSetup };
  });
  ok(uiCount.after === "guitar_7_standard" && uiCount.after !== uiCount.before, "7-chip sets stringSetup", `${uiCount.before} -> ${uiCount.after}`);

  console.log("-- (5) CAGED is a 6-string system: on 7/8-string it anchors on the TOP SIX (EADGBE), not the low B/F# --");
  // CAGED shapes encode the EADGBE interval pattern. On a standard 7/8-string the
  // top-6 strings ARE EADGBE, so the resolved box must equal the 6-string box
  // shifted up by `off = count-6` strings with IDENTICAL frets — never rooting the
  // E-shape on the low B (the over-reach fixed 2026-06-01, guitar-pedagogy review).
  const cagedBox = (su) => page.evaluate((s) => { window.__t.setAdvanced(true); window.__t.setTuning(null); window.__t.setForm({ stringSetup: s, practiceType: "scale", scale: "major", key: "C", fretboardSystem: "caged", shape: "E" }); return window.__t.gen(); }, su);
  const c6 = await cagedBox("guitar_6_standard");
  const c7 = await cagedBox("guitar_7_standard");
  const c8 = await cagedBox("guitar_8_standard");
  const shiftEq = (base, ext, off) => base.pos.length === ext.pos.length && base.pos.every((p, i) => ext.pos[i].s === p.s + off && ext.pos[i].f === p.f);
  ok(c6.strings[0] === 0, "6-string CAGED box spans the standard 6 (baseline unchanged)", `[${c6.strings.join(",")}]`);
  ok(!c7.strings.includes(0) && c7.strings[0] === 1, "7-string: low B (s=0) NOT in the box; anchors on s=1", `[${c7.strings.join(",")}]`);
  ok(!c8.strings.includes(0) && !c8.strings.includes(1) && c8.strings[0] === 2, "8-string: low F#/B (s=0,1) NOT in the box; anchors on s=2", `[${c8.strings.join(",")}]`);
  ok(shiftEq(c6, c7, 1), "7-string box === 6-string box shifted +1 string, identical frets");
  ok(shiftEq(c6, c8, 2), "8-string box === 6-string box shifted +2 strings, identical frets");
  // Open position is the worse over-reach (lower-string-wins dedupe can EVICT a
  // pitch from the canonical standard string), so it gets the same EADGBE anchor.
  const openBox = (su) => page.evaluate((s) => { window.__t.setAdvanced(true); window.__t.setTuning(null); window.__t.setForm({ stringSetup: s, practiceType: "scale", scale: "major", key: "C", fretboardSystem: "open" }); return window.__t.gen(); }, su);
  const o7 = await openBox("guitar_7_standard");
  const o8 = await openBox("guitar_8_standard");
  ok(o7.n > 0 && !o7.strings.includes(0), "Open 7-string: low B (s=0) NOT used (anchors on top-6)", `[${o7.strings.join(",")}]`);
  ok(o8.n > 0 && !o8.strings.includes(0) && !o8.strings.includes(1), "Open 8-string: low F#/B (s=0,1) NOT used", `[${o8.strings.join(",")}]`);

  console.log("-- (6) Sweep arpeggios contain to the top-six on 7/8 (CAGED sweep template anchored, not an all-string low-B rake) --");
  const sweep = (su) => page.evaluate((s) => { window.__t.setAdvanced(true); window.__t.setTuning(null); window.__t.setForm({ stringSetup: s, practiceType: "sweep_arpeggios", scale: "natural_minor", key: "A", shape: "E", fretboardSystem: "caged", chordDepth: "triad", progression: "i-VI-III-VII", bars: "4" }); return window.__t.gen(); }, su);
  const sw6 = await sweep("guitar_6_standard");
  const sw7 = await sweep("guitar_7_standard");
  const sw8 = await sweep("guitar_8_standard");
  ok(sw6.n > 0 && sw6.strings[0] === 0, "6-string sweep uses the standard 6 (baseline unchanged)", `[${sw6.strings.join(",")}]`);
  ok(sw7.n > 0 && !sw7.strings.includes(0), "7-string sweep: low B (s=0) NOT used (top-six grip, not a low-B rake)", `[${sw7.strings.join(",")}]`);
  ok(sw8.n > 0 && !sw8.strings.includes(0) && !sw8.strings.includes(1), "8-string sweep: low F#/B (s=0,1) NOT used", `[${sw8.strings.join(",")}]`);

  console.log("-- (7) Pathway tuning plumbing: instAgnostic adapt + customOpenMidis vary + anti-leak (djent ladder, 2026-06-05) --");
  // Folded from probe-djent-ladder per the per-system rule (this suite owns the
  // tuning/config plumbing): an instAgnostic pure-time rung must ADAPT to the
  // player's instrument; a drop-tuning vary must land through the form=""-
  // associated hidden field (the stepper path); and the custom tuning must
  // NEVER leak into the next pathway selected.
  await page.evaluate(() => { document.querySelector("#virtuoso-mode-guided")?.click(); });
  await page.waitForTimeout(150);
  const pw = await page.evaluate(() => {
    const S = window.Virtuoso;
    const selPathway = (id) => { const sel = document.querySelector("#virtuoso-pathway"); sel.value = id; sel.dispatchEvent(new Event("change", { bubbles: true })); return S.readConfig(); };
    const setupEl = document.querySelector('#virtuoso-controls [name="stringSetup"]');
    setupEl.value = "bass_4_standard"; setupEl.dispatchEvent(new Event("change", { bubbles: true }));
    const adapt = selPathway("djent_chug_lock");          // instAgnostic → keeps the bass
    const coded = selPathway("djent_moving_chug");        // pedal_riff → guitar-coded
    const next = document.querySelector("#virtuoso-shape-next");
    next.click(); next.click(); next.click();             // vary[3] = the drop-A override
    const drop = S.readConfig();
    const leak = selPathway("djent_chug_lock");           // next pathway must clear it
    setupEl.value = "guitar_6_standard"; setupEl.dispatchEvent(new Event("change", { bubbles: true }));
    return { adaptSetup: adapt.stringSetup, codedSetup: coded.stringSetup, dropMidis: drop.customOpenMidis, dropKey: drop.key, leakMidis: leak.customOpenMidis || null };
  });
  ok(pw.adaptSetup === "bass_4_standard", "instAgnostic rung adapts to the player's bass setup", pw.adaptSetup);
  ok(pw.codedSetup === "guitar_7_standard", "pedal_riff rung stays guitar-coded", pw.codedSetup);
  ok(Array.isArray(pw.dropMidis) && pw.dropMidis[0] === 33 && pw.dropKey === "A", "drop-A vary lands customOpenMidis via the form-associated hidden field", JSON.stringify(pw.dropMidis));
  ok(pw.leakMidis === null, "custom tuning does NOT leak into the next pathway selected", JSON.stringify(pw.leakMidis));

  console.log("-- (8) L1 tuning adapt (KEYED rung): a D-standard player = SAME FRETS, concert −2 (pin-row, tuning panel 2026-06-05) --");
  // The harmony spec's single assert that pins all three rulings at once, on a
  // genuinely KEYED (Class C) rung — pent_foundation, coded key A: (a) fret-
  // identical chart, (b) concert key G with nominal A + offset −2 riding along,
  // (c) the chart opens = the player's physical midis.
  const adapt = await page.evaluate(() => {
    const S = window.Virtuoso;
    const selPathway = (id) => { const sel = document.querySelector("#virtuoso-pathway"); sel.value = id; sel.dispatchEvent(new Event("change", { bubbles: true })); };
    // Baseline: no saved instrument → the rung charts as coded (A in E standard).
    localStorage.removeItem("virtuoso.instrument");
    selPathway("pent_foundation");
    const baseCfg = S.readConfig();
    const base = S.generateExercise(baseCfg);
    // Declare D Standard via the real Setup path (tuning select → saves L1).
    const sel = document.querySelector("#virtuoso-tuning-select");
    sel.value = "d_standard"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    selPathway("pent_foundation");   // re-apply the rung → applyTuningAdaptL1 composes
    const cfg = S.readConfig();
    const ex = S.generateExercise(cfg);
    // Self-clean: back to standard + drop the L1 store for later rows/suites.
    sel.value = "standard"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    localStorage.removeItem("virtuoso.instrument");
    selPathway("pent_foundation");
    const frets = (e) => e.chart.notes.map((n) => `${n.s}:${n.f}`).join("|");
    const t0 = (e) => (e.chart.timeline || [])[0] || null;
    return {
      baseKey: baseCfg.key, key: cfg.key, keyNominal: cfg.keyNominal, off: cfg.tuningOffset,
      fretsEqual: frets(base) === frets(ex), noteCount: ex.chart.notes.length,
      midis: (cfg.customOpenMidis || []).join(","),
      baseRootPc: t0(base) ? t0(base).rootPc : null,
      adaptRootPc: t0(ex) ? t0(ex).rootPc : null,
    };
  });
  ok(adapt.baseKey === "A" && adapt.key === "G" && adapt.keyNominal === "A" && adapt.off === -2,
     "(8a) A-coded rung rewrites to concert G (nominal A, offset −2)", `base=${adapt.baseKey} key=${adapt.key} nom=${adapt.keyNominal} off=${adapt.off}`);
  ok(adapt.noteCount > 0 && adapt.fretsEqual, "(8b) charts are FRET-IDENTICAL (fingering pedagogy preserved)", `notes=${adapt.noteCount}`);
  ok(adapt.midis === "38,43,48,53,57,62", "(8c) chart opens = the player's D-standard midis (detector + audio concert-faithful)", adapt.midis);
  ok(adapt.baseRootPc != null && adapt.adaptRootPc === ((adapt.baseRootPc + 10) % 12), "(8d) chart.timeline (the backing's chord source) roots shift −2 with the player", `rootPc ${adapt.baseRootPc} -> ${adapt.adaptRootPc}`);

  console.log("-- (8-struct) STRUCTURAL tunings on a KEYED rung chart on the player's REAL opens, not standard (the 'B-standard scored 24%' grading bug, 2026-07-09) --");
  // Row 8 covers UNIFORM tagged detunes (Eb/D → transpose). A STRUCTURAL
  // re-stringing (drop-*, B-standard, BEAD, DADGAD, open) on a keyed rung must
  // NOT fall back to the rung's STANDARD opens — the contained-verifier targets
  // have to land on the strings the player actually has, or every note mis-scores.
  // applyTuningAdaptL1's structural branch charts on the player's opens at concert
  // pitch. This guards a real-detector-path bug the mock-based scoring suites
  // (smoke-contained-verifier / smoke-scoring-e2e) structurally cannot catch.
  const struct = await page.evaluate(() => {
    const S = window.Virtuoso;
    const selPathway = (id) => { const sel = document.querySelector("#virtuoso-pathway"); sel.value = id; sel.dispatchEvent(new Event("change", { bubbles: true })); };
    const tsel = document.querySelector("#virtuoso-tuning-select");
    const run = (val) => {
      localStorage.removeItem("virtuoso.instrument");
      tsel.value = val; tsel.dispatchEvent(new Event("change", { bubbles: true }));
      selPathway("pent_foundation");   // re-apply the keyed rung → applyTuningAdaptL1 composes
      const cfg = S.readConfig();
      const ex = S.generateExercise(cfg);
      const strings = [...new Set(ex.chart.notes.map((n) => n.s))].sort((a, b) => a - b);
      return { midis: (cfg.customOpenMidis || []).toString(), n: ex.chart.notes.length, strings };
    };
    const out = { dropD: run("drop_d"), dropC: run("drop_c") };
    // self-clean for later rows / suites
    tsel.value = "standard"; tsel.dispatchEvent(new Event("change", { bubbles: true }));
    localStorage.removeItem("virtuoso.instrument");
    selPathway("pent_foundation");
    return out;
  });
  ok(struct.dropD.midis === "38,45,50,55,59,64" && struct.dropD.n > 0 && struct.dropD.strings.every((s) => s >= 0 && s < 6),
     "(8-struct-a) drop-D player: keyed rung charts on the drop-D opens (not standard E)", `opens=${struct.dropD.midis} notes=${struct.dropD.n} strings=[${struct.dropD.strings}]`);
  ok(struct.dropC.midis === "36,43,48,53,57,62" && struct.dropC.n > 0,
     "(8-struct-b) drop-C player: keyed rung charts on the drop-C opens (every string shifted, was 24%)", `opens=${struct.dropC.midis} notes=${struct.dropC.n}`);

  console.log("-- (9) ANCHOR rungs (keyless-anchor model 2026-06-06): the key is DERIVED from the player's lowest string --");
  // Anchor rungs (pulse_muting, the djent ladder, metalcore_chug…) code NO key:
  // anchor:'open_lowest' + anchorFret derive it, so the pedal lands at the
  // authored fret on ANY tuning (the round-trip theorem — the fret-2/fret-10
  // misfire bug class is unrepresentable).
  const anchor = await page.evaluate(() => {
    const S = window.Virtuoso;
    const selPathway = (id) => { const sel = document.querySelector("#virtuoso-pathway"); sel.value = id; sel.dispatchEvent(new Event("change", { bubbles: true })); };
    const out = {};
    const s0fret = (e) => { const ns = e.chart.notes.filter((n) => n.s === 0); return ns.length ? ns[0].f : -1; };
    // (a) No L1: pulse_muting derives E from the coded standard setup; pedal OPEN.
    localStorage.removeItem("virtuoso.instrument");
    selPathway("pulse_muting");
    let cfg = S.readConfig();
    out.aKey = cfg.key; out.aStation = cfg.anchorStation; out.aFret = s0fret(S.generateExercise(cfg));
    // (b) D-standard L1: same rung derives D — the chug stays on the OPEN string.
    const sel = document.querySelector("#virtuoso-tuning-select");
    sel.value = "d_standard"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    selPathway("pulse_muting");
    cfg = S.readConfig();
    out.bKey = cfg.key; out.bStation = cfg.anchorStation; out.bFret = s0fret(S.generateExercise(cfg));
    // (c) metalcore_chug (coded drop-D) for a STANDARD-tuning player: the player's
    // instrument wins — open-E pedal, no silent drop-D assumption (the old
    // mirror bug: E-standard players got the "open" pedal at fret 2).
    sel.value = "standard"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    selPathway("metalcore_chug");
    cfg = S.readConfig();
    out.cKey = cfg.key; out.cFret = s0fret(S.generateExercise(cfg)); out.cSetup = cfg.stringSetup;
    // (d) pulse_muting's anchorFret:5 variation → station 'fret 5', key A (standard).
    // Vary order changed 2026-06-12 (beginner-entry panel): the sixteenth step
    // moved LAST, so anchorFret:5 is now vary[1] — ONE Next-Variation click.
    localStorage.removeItem("virtuoso.instrument");
    selPathway("pulse_muting");
    const next = document.querySelector("#virtuoso-shape-next");
    next.click();
    cfg = S.readConfig();
    out.dKey = cfg.key; out.dStation = cfg.anchorStation; out.dFret = s0fret(S.generateExercise(cfg));
    // Self-clean.
    localStorage.removeItem("virtuoso.instrument");
    selPathway("pulse_muting");
    return out;
  });
  ok(anchor.aKey === "E" && anchor.aStation === "open" && anchor.aFret === 0, "(9a) no L1: derives E, open pedal", JSON.stringify({ k: anchor.aKey, st: anchor.aStation, f: anchor.aFret }));
  ok(anchor.bKey === "D" && anchor.bStation === "open" && anchor.bFret === 0, "(9b) D-standard L1: derives D — the chug STAYS on the open string", JSON.stringify({ k: anchor.bKey, st: anchor.bStation, f: anchor.bFret }));
  ok(anchor.cKey === "E" && anchor.cFret === 0 && anchor.cSetup === "guitar_6_standard", "(9c) drop-D-coded rung adapts to the standard player: open-E pedal (mirror-bug fixed)", JSON.stringify({ k: anchor.cKey, f: anchor.cFret, su: anchor.cSetup }));
  ok(anchor.dKey === "A" && anchor.dStation === "fret 5" && anchor.dFret === 5, "(9d) anchorFret:5 variation: pedal at fret 5, key derives A, station credited", JSON.stringify({ k: anchor.dKey, st: anchor.dStation, f: anchor.dFret }));

  console.log("-- (10) INSTRUMENT PERSISTS across a drill switch (GitHub issue #5: Bass reverted to 6-string guitar) --");
  // The player picks Bass, then switches the practice type (a "drill") — the
  // instrument must STAY 4-string bass, not revert to 6-string guitar. Drives the
  // real Custom-mode form: set stringSetup=bass, dispatch practiceType changes.
  await page.evaluate(() => { document.querySelector("#virtuoso-mode-custom")?.click(); localStorage.removeItem("virtuoso.instrument"); });
  await page.waitForTimeout(100);
  const persist = await page.evaluate(() => {
    const setup = document.querySelector('#virtuoso-controls [name="stringSetup"]');
    setup.value = "bass_4_standard"; setup.dispatchEvent(new Event("change", { bubbles: true }));
    const after = [];
    for (const pt of ["arpeggio", "chords", "rhythm_pulse", "walking_bass", "scale"]) {
      const el = document.querySelector('[name="practiceType"]'); el.value = pt; el.dispatchEvent(new Event("change", { bubbles: true }));
      after.push(document.querySelector('#virtuoso-controls [name="stringSetup"]').value);
    }
    const genStrings = (() => { try { const ex = window.Virtuoso.generateExercise(window.Virtuoso.readConfig()); return [...new Set(ex.chart.notes.map(n => n.s))].sort((a, b) => a - b); } catch (e) { return ["err"]; } })();
    setup.value = "guitar_6_standard"; setup.dispatchEvent(new Event("change", { bubbles: true }));   // self-clean
    return { after, genStrings };
  });
  ok(persist.after.every(s => s === "bass_4_standard"), "(10) switching drills KEEPS 4-string bass (issue #5)", persist.after.join(" · "));
  ok(persist.genStrings.length === 4 && Math.max(...persist.genStrings) === 3, "(10b) the generated chart stays on the 4 bass strings", `[${persist.genStrings.join(",")}]`);

  console.log("-- (11) bass LEGATO carries the fretting FINGER (fg) — the pinky drill (Discord bass ask) --");
  // The bass pinky/legato rung (bass_finger_legato) needs the box's finger number to
  // reach the chart so the PINKY (fg 4) displays. buildLegatoExercise must carry n.fg
  // AND SEQ_NOTE_FIELDS must list 'fg' (both were missing — the pinky never showed).
  const fg = await page.evaluate(() => {
    window.__t.setAdvanced(true); window.__t.setTuning(null);
    window.__t.setForm({ stringSetup: "bass_4_standard", practiceType: "legato", scale: "minor_pentatonic", key: "A", fretboardSystem: "position", fretMin: 5, fretMax: 8 });
    const ex = window.Virtuoso.generateExercise(window.Virtuoso.readConfig());
    const fgs = [...new Set(ex.chart.notes.map(n => n.fg).filter(v => v != null))].sort();
    return { n: ex.chart.notes.length, fgs, ho: ex.chart.notes.some(n => n.ho), po: ex.chart.notes.some(n => n.po) };
  });
  ok(fg.n > 0 && fg.ho && fg.po, "bass legato generates slurs (hammer-ons + pull-offs)", `n=${fg.n} ho=${fg.ho} po=${fg.po}`);
  ok(fg.fgs.includes(4), "legato carries fg incl. the PINKY (fg 4) — the bass pinky drill works", `fgs=[${fg.fgs.join(",")}]`);

  console.log("-- (12) DEFAULT fretboard-system routing is instrument/count-aware (string-count fix, 2026-07-10) --");
  // Beginner mode used to force 'caged' for EVERYTHING — on 7/8-string the box
  // anchors top-six (rows 5/6, correct for CAGED itself) so the extra strings
  // never sounded (the "switched to 8-string and nothing changed" report), and
  // bass got guitar-shape geometry (bass-pedagogy: bass never uses CAGED).
  // defaultFretboardSystem: bass → position, guitar N>6 → 3nps, guitar 6 → caged;
  // an explicit advanced-mode pick still wins.
  const d8 = await page.evaluate(() => {
    window.__t.setAdvanced(false); window.__t.setTuning(null);
    window.__t.setForm({ stringSetup: "guitar_8_standard", practiceType: "scale", scale: "major", key: "C" });
    const cfg = window.Virtuoso.readConfig();
    const ex = window.Virtuoso.generateExercise(cfg);
    const opens = [30, 35, 40, 45, 50, 55, 59, 64];   // guitar_8_standard
    const strings = [...new Set(ex.chart.notes.map(n => n.s))].sort((a, b) => a - b);
    const midis = [...new Set(ex.chart.notes.map(n => `${n.s}:${n.f}`))].map(k => { const [s, f] = k.split(":").map(Number); return opens[s] + f; });
    return { sys: cfg.fretboardSystem, n: ex.chart.notes.length, strings, unison: midis.length !== new Set(midis).size };
  });
  ok(d8.sys === "3nps", "(12a) 8-string beginner default = 3nps (the extended-range scale system)", d8.sys);
  ok(d8.n > 0 && d8.strings.includes(0) && d8.strings.includes(1), "(12b) default 8-string scale run REACHES the low F#/B (s=0,1)", `[${d8.strings.join(",")}]`);
  ok(!d8.unison, "(12c) the extended default path holds the no-unison rule (unique position = unique pitch)");
  const d6 = await page.evaluate(() => {
    window.__t.setForm({ stringSetup: "guitar_6_standard", practiceType: "scale", scale: "major", key: "C" });
    return window.Virtuoso.readConfig().fretboardSystem;
  });
  ok(d6 === "caged", "(12d) 6-string guitar beginner default stays caged (unchanged)", d6);
  const dExplicit = await page.evaluate(() => {
    window.__t.setAdvanced(true);
    window.__t.setForm({ stringSetup: "guitar_8_standard", practiceType: "scale", scale: "major", key: "C", fretboardSystem: "caged", shape: "E" });
    const cfg = window.Virtuoso.readConfig();
    window.__t.setAdvanced(false);
    return cfg.fretboardSystem;
  });
  ok(dExplicit === "caged", "(12e) an EXPLICIT advanced-mode caged pick on 8-string is preserved (default only fills the unset case)", dExplicit);
  console.log("-- (13) BASS never routes through a guitar shape system (6-string bass passed the old count-only guards) --");
  // Face 1: beginner Custom bass got CAGED-derived geometry (pathways already
  // coded 'position'). Face 2 (latent, pitch-wrong): a 6-STRING bass satisfies
  // stringCount>=6, but the CAGED templates bake EADGBE's G→B major 3rd — on an
  // all-4ths bass the top two strings land a semitone flat (a real wrong pitch).
  // Guards are now instrument-first at every layer (resolveCurrentShape,
  // cagedShapeNotesForChord, templateFromShape, sweep wantShape).
  for (const su of ["bass_4_standard", "bass_5_standard", "bass_6_standard"]) {
    const r = await page.evaluate((s) => {
      window.__t.setAdvanced(false); window.__t.setTuning(null);
      window.__t.setForm({ stringSetup: s, practiceType: "scale", scale: "major", key: "C" });
      const cfg = window.Virtuoso.readConfig();
      return { sys: cfg.fretboardSystem, hasShape: !!(cfg.shapeNotes && cfg.shapeNotes.length) };
    }, su);
    ok(r.sys === "position" && !r.hasShape, `(13) ${su} beginner default = position, no resolved shape`, `sys=${r.sys} shape=${r.hasShape}`);
  }
  const b6 = await page.evaluate(() => {
    // Force the hostile config: a 6-string bass shoved INTO caged sweep territory.
    // wantShape must refuse (instrument guard) and fall to the interval-derived
    // path, so every emitted pitch stays a chord/scale tone of C major.
    window.__t.setAdvanced(true); window.__t.setTuning(null);
    window.__t.setForm({ stringSetup: "bass_6_standard", practiceType: "sweep_arpeggios", scale: "major", key: "C", fretboardSystem: "caged", shape: "E" });
    const ex = window.Virtuoso.generateExercise(window.Virtuoso.readConfig());
    const opens = [23, 28, 33, 38, 43, 48];   // bass_6_standard (all 4ths — no G→B 3rd)
    const pcs = [...new Set(ex.chart.notes.map(n => ((opens[n.s] + n.f) % 12 + 12) % 12))].sort((a, b) => a - b);
    const cMajor = new Set([0, 2, 4, 5, 7, 9, 11]);
    window.__t.setAdvanced(false);
    return { n: ex.chart.notes.length, offKey: pcs.filter(pc => !cMajor.has(pc)) };
  });
  ok(b6.n > 0 && b6.offKey.length === 0, "(13b) 6-string bass forced at caged sweeps: every pitch stays diatonic (no semitone-flat template leak)", `n=${b6.n} offKey=[${b6.offKey.join(",")}]`);
  const lowB = await page.evaluate(() => {
    window.__t.setAdvanced(false); window.__t.setTuning(null);
    window.__t.setForm({ stringSetup: "bass_5_standard", practiceType: "scale", scale: "major", key: "E" });
    const ex = window.Virtuoso.generateExercise(window.Virtuoso.readConfig());
    const strings = [...new Set(ex.chart.notes.map(n => n.s))].sort((a, b) => a - b);
    window.__t.setForm({ stringSetup: "guitar_6_standard" });   // self-clean
    return { n: ex.chart.notes.length, strings };
  });
  // The B string (s=0) must be PLAYED — a root-anchored run legitimately starts
  // AT the root (E sits on the B string, fret 5), so assert string usage, not
  // sub-E pitch. Reaching BELOW the root (the low-fifth idiom) is the deferred
  // bassRootGrip downward-reach feature (ROADMAP open thread), not this fix.
  ok(lowB.n > 0 && lowB.strings.includes(0), "(13c) 5-string bass scale actually plays ON the low B string (s=0)", `strings=[${lowB.strings.join(",")}]`);

  console.log("-- (14) power-chord grip is INTERVAL-aware: drop tuning collapses to the same-fret barre --");
  // powerChordGrip hardcoded +2 on s1/s2 (standard-4ths assumption) — in every
  // drop-X/DADGAD/Open-D tuning (s0→s1 = a FIFTH) that sounded root + MAJOR 6TH
  // instead of root+5th (guitar-pedagogy 2026-07-12). Fixed by-pitch: drop-D
  // 5oct = the iconic one-finger barre {s0:F, s1:F, s2:F} = root·5th·octave;
  // standard keeps {F, F+2, F+2}. Drives strum_comp with chordOverride=5oct.
  const pchord = await page.evaluate(() => {
    const run = (su) => {
      window.__t.setAdvanced(true); window.__t.setTuning(null);
      window.__t.setForm({ stringSetup: su, practiceType: "strum_comp", key: "D", chordOverride: "5oct" });
      const cfg = window.Virtuoso.readConfig();
      const ex = window.Virtuoso.generateExercise(cfg);
      const t0 = Math.min(...ex.chart.notes.map(n => n.t));
      // Strum notes are ROLL-staggered a few ms per string — collect the first
      // chord within a strum window, one note per string.
      const first = [];
      for (const n of ex.chart.notes.filter(n => n.t < t0 + 0.09 && n.s <= 2).sort((a, b) => a.s - b.s)) {
        if (!first.some(p => p.s === n.s)) first.push({ s: n.s, f: n.f });
      }
      const opens = su === "guitar_6_drop_d" ? [38, 45, 50, 55, 59, 64] : [40, 45, 50, 55, 59, 64];
      const midis = first.map(p => opens[p.s] + p.f);
      return { first, ivs: midis.slice(1).map(m => m - midis[0]) };
    };
    const out = { drop: run("guitar_6_drop_d"), std: run("guitar_6_standard") };
    window.__t.setAdvanced(false); window.__t.setForm({ stringSetup: "guitar_6_standard" });  // self-clean
    return out;
  });
  ok(pchord.drop.first.length === 3 && pchord.drop.first.every(p => p.f === pchord.drop.first[0].f),
     "(14a) drop-D 5oct power chord = SAME-FRET barre across s0/s1/s2", JSON.stringify(pchord.drop.first));
  ok(pchord.drop.ivs.join(",") === "7,12", "(14b) drop-D barre sounds root·5th·octave (was root·MAJOR-6TH·octave)", `ivs=[${pchord.drop.ivs}]`);
  ok(pchord.std.ivs.join(",") === "7,12", "(14c) standard-tuning grip still sounds root·5th·octave (F/F+2/F+2 unchanged)", `ivs=[${pchord.std.ivs}] frets=${JSON.stringify(pchord.std.first)}`);

  console.log("-- (15) bass low-fifth reach (rfoPattern='low5', bass-pedagogy 2026-07-12) --");
  // R–low5–5–8: the fifth BELOW the root on the string below (the reach the low
  // string exists for). Default R-5-8-5 must be BYTE-IDENTICAL with the field
  // absent (the canonical pre-scales box never changes under a beginner);
  // unreachable low fifth (root on the lowest string) degrades to the upper 5th.
  const rfo = await page.evaluate(() => {
    const run = (su, pattern, key, fretMax) => {
      window.__t.setAdvanced(true); window.__t.setTuning(null);
      // Bass-native practice types only enter the select once the FAMILY is
      // bass — dispatch a real setup change first (mirrors row 10), else the
      // silent practiceType set falls back to a scale exercise.
      const setup = document.querySelector('#virtuoso-controls [name="stringSetup"]');
      setup.value = su; setup.dispatchEvent(new Event("change", { bubbles: true }));
      const pt = document.querySelector('[name="practiceType"]');
      pt.value = "root_fifth_octave"; pt.dispatchEvent(new Event("change", { bubbles: true }));
      const rp = document.querySelector('[name="rfoPattern"]'); if (rp) rp.value = pattern || "";
      window.__t.setForm({ key, progression: "I-IV-V", fretMin: 0, fretMax: fretMax || 7 });
      const cfg = window.Virtuoso.readConfig();
      if (cfg.mode !== "root_fifth_octave") return `WRONG-MODE:${cfg.mode}`;
      const ex = window.Virtuoso.generateExercise(cfg);
      return ex.chart.notes.map(n => `${n.t.toFixed(3)}:${n.s}:${n.f}`).join("|");
    };
    const opens5 = [23, 28, 33, 38, 43];
    const firstBar = (sig) => sig.split("|").slice(0, 4).map(k => { const [, s, f] = k.split(":").map(Number); return { s, f }; });
    // (a) geometry on 5-string, key C (root lands fretted above the low B).
    const low5 = firstBar(run("bass_5_standard", "low5", "C"));
    const midis = low5.map(p => opens5[p.s] + p.f);
    // (b) default parity: no pattern field vs explicit 'r5o' — identical charts.
    const def = run("bass_5_standard", "", "C");
    const r5o = run("bass_5_standard", "r5o", "C");
    // (c) null-degrade: 4-string key E root sits on the lowest string (s0) →
    //     low fifth unreachable → the low5 chart equals swapping in the UPPER 5th.
    const deg = firstBar(run("bass_4_standard", "low5", "E", 5));
    const opens4 = [28, 33, 38, 43];
    const degMidis = deg.map(p => opens4[p.s] + p.f);
    const rp = document.querySelector('[name="rfoPattern"]'); if (rp) rp.value = "";   // self-clean
    window.__t.setAdvanced(false); window.__t.setForm({ stringSetup: "guitar_6_standard" });
    return { midis, defEqualsR5o: def === r5o, defSig: def.split("|").length, degMidis };
  });
  ok(rfo.midis.length === 4 && rfo.midis[1] === rfo.midis[0] - 7 && rfo.midis[2] === rfo.midis[0] + 7 && rfo.midis[3] === rfo.midis[0] + 12,
     "(15a) low5 bar = R, low-5th (root−7, the string below), 5th, octave", `midis=[${rfo.midis}]`);
  ok(rfo.defEqualsR5o && rfo.defSig > 0, "(15b) default R-5-8-5 chart is BYTE-IDENTICAL with the field absent vs 'r5o' (no leak into the canonical box)");
  ok(rfo.degMidis.length === 4 && rfo.degMidis[1] === rfo.degMidis[0] + 7,
     "(15c) unreachable low fifth (4-string, root on the lowest string) degrades to the UPPER 5th", `midis=[${rfo.degMidis}]`);

  ok(pageErrs.length === 0, "no uncaught page errors", pageErrs.join(" | "));
  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  strings/tuning: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
