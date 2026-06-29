"""Virtuoso plugin routes.

Routes provide preset persistence and temporary sloppak generation. The temp
sloppak path is intentionally not inserted into the library index; the frontend
passes the returned DLC-relative filename straight to FeedBack's player.
"""

from __future__ import annotations

import importlib
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid
import wave
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

PLUGIN_ID = "virtuoso"
SCHEMA_VERSION = 1
TEMP_ROOT_NAME = ".virtuoso-temp"
SAMPLE_RATE = 44100


class PresetPayload(BaseModel):
    id: str = Field(min_length=1, max_length=96)
    name: str = Field(min_length=1, max_length=160)
    kind: str = Field(default="exercise", max_length=64)
    config: dict[str, Any] = Field(default_factory=dict)


class TuningPayload(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    family: str = Field(min_length=1, max_length=32)   # 'guitar' | 'bass'
    string_count: int = Field(ge=1, le=12)
    midis: list[int] = Field(min_length=1, max_length=12)


class TempSloppakPayload(BaseModel):
    exercise: dict[str, Any] = Field(default_factory=dict)


def _data_dir(context: dict) -> Path:
    root = Path(context["config_dir"]) / "plugin_data" / PLUGIN_ID
    root.mkdir(parents=True, exist_ok=True)
    return root


def _presets_path(context: dict) -> Path:
    return _data_dir(context) / "presets.json"


def _tunings_path(context: dict) -> Path:
    return _data_dir(context) / "tunings.json"


# ── DB-backed storage (presets + tunings) ────────────────────────────────────
#
# Plugins get a shared MetaDB instance via `context["meta_db"]`, which exposes
# a `conn` (sqlite3.Connection with check_same_thread=False) and `_lock`
# (threading.Lock) — same pattern FeedBack uses for its own loops table.
#
# We keep our state in two dedicated tables prefixed `virtuoso_` so they
# don't get confused with the songs library. Schemas are conservative — IDs
# are TEXT for presets (so the existing slug-style IDs from the JSON file
# survive migration) and INTEGER AUTOINCREMENT for tunings (since the
# frontend creates them by name and doesn't care about the id beyond delete).

def _ensure_tables(meta_db) -> None:
    with meta_db._lock:
        meta_db.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS virtuoso_presets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                kind TEXT NOT NULL DEFAULT 'exercise',
                config_json TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        meta_db.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS virtuoso_tunings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                family TEXT NOT NULL,
                string_count INTEGER NOT NULL,
                midis_csv TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        meta_db.conn.commit()


def _migrate_presets_from_json(meta_db, presets_path: Path) -> None:
    """Seed-when-empty: if the DB has no presets but the JSON file does, copy
    them in. Idempotent — subsequent calls are no-ops because the DB is no
    longer empty. The file is both the legacy (pre-DB) store and the live
    export mirror written by _snapshot_presets; this read-back is how a host
    settings-bundle import restores Virtuoso state on a fresh install (the
    bundle restores the file, we seed the DB from it at next load)."""
    if not presets_path.exists():
        return
    try:
        existing = meta_db.conn.execute(
            "SELECT COUNT(*) FROM virtuoso_presets"
        ).fetchone()[0]
    except Exception:
        return
    if existing:
        return
    try:
        data = json.loads(presets_path.read_text(encoding="utf-8"))
    except Exception:
        return
    presets = data.get("presets", []) if isinstance(data, dict) else []
    if not isinstance(presets, list) or not presets:
        return
    now = time.time()
    with meta_db._lock:
        for p in presets:
            if not isinstance(p, dict) or "id" not in p or "name" not in p:
                continue
            # Mirror snapshots carry created_at; preserve it so list order
            # (created_at DESC) survives an export/import round-trip. The
            # pre-DB legacy file lacks it — fall back to "now".
            try:
                created = float(p.get("created_at") or now)
            except (TypeError, ValueError):
                created = now
            meta_db.conn.execute(
                "INSERT OR REPLACE INTO virtuoso_presets "
                "(id, name, kind, config_json, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    str(p.get("id"))[:96],
                    str(p.get("name"))[:160],
                    str(p.get("kind") or "exercise")[:64],
                    json.dumps(p.get("config") or {}, ensure_ascii=False),
                    created,
                ),
            )
        meta_db.conn.commit()


def _migrate_tunings_from_json(meta_db, tunings_path: Path) -> None:
    """Tunings counterpart of _migrate_presets_from_json: seed-when-empty
    from the export mirror written by _snapshot_tunings. Rows are validated
    like save_tuning (family, midis/string_count agreement, MIDI range) but
    bad rows are skipped silently — migration must never raise."""
    if not tunings_path.exists():
        return
    try:
        existing = meta_db.conn.execute(
            "SELECT COUNT(*) FROM virtuoso_tunings"
        ).fetchone()[0]
    except Exception:
        return
    if existing:
        return
    try:
        data = json.loads(tunings_path.read_text(encoding="utf-8"))
    except Exception:
        return
    tunings = data.get("tunings", []) if isinstance(data, dict) else []
    if not isinstance(tunings, list) or not tunings:
        return
    now = time.time()
    with meta_db._lock:
        for t in tunings:
            if not isinstance(t, dict) or not t.get("name"):
                continue
            if t.get("family") not in ("guitar", "bass"):
                continue
            midis = t.get("midis")
            count = t.get("string_count")
            if not isinstance(midis, list) or not isinstance(count, int):
                continue
            if len(midis) != count or any(
                not isinstance(m, int) or m < 0 or m > 127 for m in midis
            ):
                continue
            try:
                created = float(t.get("created_at") or now)
            except (TypeError, ValueError):
                created = now
            meta_db.conn.execute(
                "INSERT OR IGNORE INTO virtuoso_tunings "
                "(name, family, string_count, midis_csv, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (
                    str(t["name"])[:160],
                    t["family"],
                    count,
                    ",".join(str(int(m)) for m in midis),
                    created,
                ),
            )
        meta_db.conn.commit()


def _read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"Invalid Virtuoso preset file: {exc}") from exc


def _atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    tmp_path = Path(tmp)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=True)
            f.write("\n")
        os.replace(tmp_path, path)
    finally:
        try:
            tmp_path.unlink()
        except OSError:
            pass


# ── Settings-export mirrors ──────────────────────────────────────────────────
#
# The DB is the source of truth, but the shared meta-DB (web_library.db) is a
# rebuildable cache the host's settings export deliberately never includes —
# so DB-only state would silently vanish from user backups. After every
# mutation we mirror the table to the JSON file declared in plugin.json's
# `settings.server_files`; the host bundles it on export, restores it on
# import, and the seed-when-empty _migrate_* readers above pull it back into
# the DB at next load. Best-effort: a disk error never fails the API request.

def _snapshot_presets(meta_db, path: Path) -> None:
    try:
        rows = meta_db.conn.execute(
            "SELECT id, name, kind, config_json, created_at "
            "FROM virtuoso_presets ORDER BY created_at DESC"
        ).fetchall()
        presets = []
        for r in rows:
            try:
                cfg = json.loads(r[3]) if r[3] else {}
            except Exception:
                cfg = {}
            presets.append({"id": r[0], "name": r[1], "kind": r[2],
                            "config": cfg, "created_at": r[4]})
        _atomic_write_json(path, {"version": SCHEMA_VERSION, "presets": presets})
    except Exception:
        pass


def _snapshot_tunings(meta_db, path: Path) -> None:
    try:
        rows = meta_db.conn.execute(
            "SELECT id, name, family, string_count, midis_csv, created_at "
            "FROM virtuoso_tunings ORDER BY family, string_count, name"
        ).fetchall()
        tunings = []
        for r in rows:
            try:
                midis = [int(x) for x in (r[4] or "").split(",") if x.strip()]
            except Exception:
                midis = []
            tunings.append({"id": r[0], "name": r[1], "family": r[2],
                            "string_count": r[3], "midis": midis,
                            "created_at": r[5]})
        _atomic_write_json(path, {"version": SCHEMA_VERSION, "tunings": tunings})
    except Exception:
        pass


def _model_dump(model: Any) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _get_dlc_dir_from_server(context: dict) -> Path | None:
    try:
        server = importlib.import_module("server")
        getter = getattr(server, "_get_dlc_dir", None)
        if callable(getter):
            value = getter()
            if value:
                return Path(value)
    except Exception:
        pass

    cfg_path = Path(context["config_dir"]) / "config.json"
    cfg = _read_json(cfg_path, {}) if cfg_path.exists() else {}
    for key in ("dlc_dir", "dlc_path", "dlc", "library_dir", "library_path"):
        value = cfg.get(key)
        if isinstance(value, str) and value.strip():
            return Path(value)
    return None


def _normalise_note(note: Any, *, include_time: bool = True) -> dict[str, Any]:
    if not isinstance(note, dict):
        return {}
    out = {
        "s": int(note.get("s", 0) or 0),
        "f": int(note.get("f", 0) or 0),
        "sus": float(note.get("sus", 0) or 0),
        "sl": int(note.get("sl", -1) if note.get("sl", -1) is not None else -1),
        "slu": int(note.get("slu", -1) if note.get("slu", -1) is not None else -1),
        "bn": float(note.get("bn", 0) or 0),
        "ho": bool(note.get("ho", False)),
        "po": bool(note.get("po", False)),
        "hm": bool(note.get("hm", False)),
        "hp": bool(note.get("hp", False)),
        "pm": bool(note.get("pm", False)),
        "mt": bool(note.get("mt", False)),
        "vb": bool(note.get("vb", False)),
        "tr": bool(note.get("tr", False)),
        "ac": bool(note.get("ac", False)),
        "tp": bool(note.get("tp", False)),
    }
    if include_time:
        out["t"] = float(note.get("t", 0) or 0)
    return out


def _normalise_chart(exercise: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    if not isinstance(exercise, dict):
        raise HTTPException(400, "exercise must be an object")
    session = exercise.get("session") if isinstance(exercise.get("session"), dict) else {}
    chart = exercise.get("chart") if isinstance(exercise.get("chart"), dict) else {}

    notes = [_normalise_note(n, include_time=True) for n in chart.get("notes", []) if isinstance(n, dict)]
    notes = [n for n in notes if n]
    notes.sort(key=lambda n: float(n.get("t", 0)))

    templates = []
    for t in chart.get("chordTemplates", chart.get("templates", [])) or []:
        if not isinstance(t, dict):
            continue
        frets = list(t.get("frets", []))[:8]
        fingers = list(t.get("fingers", []))[:8]
        templates.append({
            "name": str(t.get("name") or t.get("displayName") or "Chord"),
            "displayName": str(t.get("displayName") or t.get("name") or "Chord"),
            "arp": bool(t.get("arp", False)),
            "frets": [int(x) if isinstance(x, (int, float)) else -1 for x in frets],
            "fingers": [int(x) if isinstance(x, (int, float)) else -1 for x in fingers],
        })

    chords = []
    for ch in chart.get("chords", []) or []:
        if not isinstance(ch, dict):
            continue
        chord_notes = [_normalise_note(n, include_time=False) for n in ch.get("notes", []) if isinstance(n, dict)]
        chords.append({
            "t": float(ch.get("t", 0) or 0),
            "id": int(ch.get("id", 0) or 0),
            "hd": bool(ch.get("hd", False)),
            "notes": chord_notes,
        })
    chords.sort(key=lambda c: float(c.get("t", 0)))

    handshapes = []
    for hs in chart.get("handShapes", chart.get("handshapes", [])) or []:
        if not isinstance(hs, dict):
            continue
        handshapes.append({
            "chord_id": int(hs.get("chord_id", 0) or 0),
            "start_time": float(hs.get("start_time", 0) or 0),
            "end_time": float(hs.get("end_time", 0) or 0),
            "arp": bool(hs.get("arp", False)),
        })

    anchors = []
    for a in chart.get("anchors", []) or []:
        if isinstance(a, dict):
            anchors.append({"time": float(a.get("time", 0) or 0), "fret": int(a.get("fret", 1) or 1), "width": int(a.get("width", 4) or 4)})
    if not anchors:
        anchors = [{"time": 0.0, "fret": int(session.get("fretMin", 0) or 0), "width": 4}]

    beats = []
    for b in chart.get("beats", []) or []:
        if isinstance(b, dict):
            beats.append({"time": float(b.get("time", 0) or 0), "measure": int(b.get("measure", -1) or -1)})
    if not beats:
        beats = [{"time": 0.0, "measure": 1}]

    sections = []
    for i, s in enumerate(chart.get("sections", []) or []):
        if isinstance(s, dict):
            sections.append({"name": str(s.get("name") or "practice"), "number": int(s.get("number", i + 1) or i + 1), "time": float(s.get("time", 0) or 0)})
    if not sections:
        sections = [{"name": "practice", "number": 1, "time": 0.0}]

    duration = float(chart.get("duration", 0) or 0)
    if duration <= 0:
        max_note = max((float(n.get("t", 0)) + float(n.get("sus", 0)) for n in notes), default=0)
        max_chord = max((float(c.get("t", 0)) for c in chords), default=0)
        duration = max(8.0, max_note, max_chord) + 2.0
    duration = max(1.0, min(duration, 900.0))

    string_count = int(session.get("stringCount", 6) or 6)
    # DORMANT PATH (contained playback owns the live transport; nothing calls
    # temp-sloppak — see CLAUDE.md "Contained playback"). LATENT BUG, deferred:
    # if this writer is ever revived (e.g. an "export drill to the host library"
    # affordance), the tuning array below MUST be emitted at FULL string-count
    # length. The host derives string count as max(notes, name, tuning) but treats
    # len(tuning)==6 as "no signal" (feedback lib/song.py:439-440), so a 5/7/8-
    # string drill padded to 6 here is silently miscounted as 6. Emit
    # session["customOpenMidis"]-derived offsets at the real string count, never
    # padded to 6 / trimmed to voiced strings; the manifest tuning (build_manifest)
    # must match — it OVERRIDES this one at load (lib/sloppak.py:226-231). Verified
    # against host v0.2.9-alpha.7; rationale in memory project_python_generator_reconciliation.
    arranged = {
        "name": "Lead" if string_count != 4 else "Bass",
        "tuning": list(session.get("tuning") or ([0, 0, 0, 0] if string_count == 4 else [0, 0, 0, 0, 0, 0])),
        "capo": 0,
        "notes": notes,
        "chords": chords,
        "anchors": anchors,
        "handshapes": handshapes,
        "templates": templates,
        "beats": beats,
        "sections": sections,
    }
    return session, {"arrangement": arranged, "duration": duration}


def _write_silence_wav(path: Path, duration: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frames_total = int(max(1.0, duration) * SAMPLE_RATE)
    chunk_frames = SAMPLE_RATE
    silence = b"\x00\x00" * chunk_frames
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        remaining = frames_total
        while remaining > 0:
            n = min(chunk_frames, remaining)
            wf.writeframes(silence[: n * 2])
            remaining -= n


def _midi_to_freq(midi: int) -> float:
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def _open_midis(session: dict[str, Any]) -> list[int]:
    # DORMANT PATH (see _normalise_chart). LATENT BUG, deferred: this hardcodes a
    # 6-string E-standard for anything non-4-string, so 5/7/8-string AND any custom
    # tuning (session["customOpenMidis"]) produce wrong-pitched stem audio. If this
    # writer is revived, derive open MIDIs from the config's EFFECTIVE tuning
    # (customOpenMidis, then a STRING_SETUPS lookup), mirroring screen.js
    # openMidisForConfig — do not assume standard. Deferred only because the path has
    # no live caller. Rationale: memory project_python_generator_reconciliation.
    string_count = int(session.get("stringCount", 6) or 6)
    tuning_id = str(session.get("tuningId") or "standard")
    if string_count == 4 or tuning_id == "bass_standard":
        return [28, 33, 38, 43]
    if tuning_id == "drop_d":
        return [38, 45, 50, 55, 59, 64]
    return [40, 45, 50, 55, 59, 64]


def _add_decayed_sine(buffer: list[float], start_time: float, duration: float, freq: float, amp: float, decay: float = 5.0) -> None:
    start = max(0, int(start_time * SAMPLE_RATE))
    frames = max(1, int(duration * SAMPLE_RATE))
    end = min(len(buffer), start + frames)
    if start >= len(buffer):
        return
    attack_frames = max(1, int(0.006 * SAMPLE_RATE))
    release_frames = max(1, int(0.035 * SAMPLE_RATE))
    two_pi = 2.0 * math.pi
    for i in range(start, end):
        local = i - start
        t = local / SAMPLE_RATE
        attack = min(1.0, local / attack_frames)
        release = min(1.0, max(0, end - i) / release_frames)
        env = attack * release * math.exp(-decay * t)
        value = math.sin(two_pi * freq * t) + 0.35 * math.sin(two_pi * freq * 2.0 * t)
        buffer[i] += amp * env * value


def _add_click(buffer: list[float], start_time: float, accent: bool) -> None:
    freq = 1760.0 if accent else 1120.0
    amp = 0.42 if accent else 0.28
    _add_decayed_sine(buffer, start_time, 0.055 if accent else 0.04, freq, amp, decay=42.0)


def _write_practice_audio_wav(path: Path, session: dict[str, Any], arranged: dict[str, Any], duration: float) -> None:
    audio = session.get("audio") if isinstance(session.get("audio"), dict) else {}
    include_notes = bool(audio.get("notes", session.get("audioNotes", False)))
    include_metronome = bool(audio.get("metronome", session.get("audioMetronome", False)))
    if not include_notes and not include_metronome:
        _write_silence_wav(path, duration)
        return

    frame_count = int((duration + 0.75) * SAMPLE_RATE)
    buffer = [0.0] * max(SAMPLE_RATE, frame_count)

    if include_notes:
        opens = _open_midis(session)
        string_count = len(opens)
        for note in arranged.get("notes", []):
            try:
                s = int(note.get("s", 0))
                f = int(note.get("f", 0))
                start = float(note.get("t", 0.0))
                sus = float(note.get("sus", 0.0) or 0.0)
            except Exception:
                continue
            if s < 0 or s >= string_count or f < 0:
                continue
            midi = opens[s] + f
            note_len = max(0.12, min(0.85, sus if sus > 0 else 0.22))
            amp = 0.16 if string_count == 6 else 0.18
            _add_decayed_sine(buffer, start, note_len, _midi_to_freq(midi), amp, decay=4.8)

    if include_metronome:
        for beat in arranged.get("beats", []):
            try:
                start = float(beat.get("time", 0.0))
                accent = int(beat.get("measure", -1)) >= 0
            except Exception:
                continue
            _add_click(buffer, start, accent)

    peak = max((abs(x) for x in buffer), default=0.0)
    gain = 0.92 / peak if peak > 0.98 else 1.0

    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        chunk = bytearray()
        for value in buffer:
            sample = int(max(-1.0, min(1.0, value * gain)) * 32767)
            chunk += sample.to_bytes(2, byteorder="little", signed=True)
            if len(chunk) >= 65536:
                wf.writeframes(bytes(chunk))
                chunk.clear()
        if chunk:
            wf.writeframes(bytes(chunk))


def _try_encode_ogg(wav_path: Path, ogg_path: Path) -> bool:
    """Encode a generated WAV to OGG/Vorbis when ffmpeg is available.

    FeedBack's sloppak documentation and examples use OGG stems. Directory-form
    sloppaks can technically point at any manifest-indexed file, but using OGG
    keeps generated practice charts aligned with normal FeedBack packages.
    """
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    commands = [
        [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav_path), "-c:a", "libvorbis", "-q:a", "4", str(ogg_path)],
        [ffmpeg, "-y", "-hide_banner", "-loglevel", "error", "-i", str(wav_path), "-c:a", "vorbis", "-q:a", "4", str(ogg_path)],
    ]
    for cmd in commands:
        try:
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=90)
            return ogg_path.exists() and ogg_path.stat().st_size > 0
        except Exception:
            try:
                ogg_path.unlink(missing_ok=True)
            except OSError:
                pass
    return False


def _write_practice_audio_stem(stems_dir: Path, session: dict[str, Any], arranged: dict[str, Any], duration: float) -> str:
    stems_dir.mkdir(parents=True, exist_ok=True)
    wav_path = stems_dir / "practice.wav"
    ogg_path = stems_dir / "practice.ogg"
    _write_practice_audio_wav(wav_path, session, arranged, duration)
    if _try_encode_ogg(wav_path, ogg_path):
        try:
            wav_path.unlink(missing_ok=True)
        except OSError:
            pass
        return "stems/practice.ogg"
    return "stems/practice.wav"


def _dump_yaml(data: dict[str, Any]) -> str:
    try:
        import yaml  # type: ignore
        return yaml.safe_dump(data, sort_keys=False, allow_unicode=True)
    except Exception:
        lines = []
        for key in ("title", "artist", "album", "year", "duration"):
            lines.append(f"{key}: {json.dumps(data.get(key))}")
        lines.append("arrangements:")
        for a in data.get("arrangements", []):
            lines.append(f"  - id: {json.dumps(a['id'])}")
            lines.append(f"    name: {json.dumps(a['name'])}")
            lines.append(f"    file: {json.dumps(a['file'])}")
            lines.append(f"    tuning: {json.dumps(a['tuning'])}")
            lines.append(f"    capo: {int(a.get('capo', 0))}")
        lines.append("stems:")
        for s in data.get("stems", []):
            lines.append(f"  - id: {json.dumps(s['id'])}")
            lines.append(f"    file: {json.dumps(s['file'])}")
            lines.append(f"    default: {'true' if s.get('default', True) else 'false'}")
        return "\n".join(lines) + "\n"


def _cleanup_temp_root(temp_root: Path) -> None:
    try:
        temp_root.mkdir(parents=True, exist_ok=True)
        entries = [p for p in temp_root.iterdir() if p.name.endswith(".sloppak")]
        now = time.time()
        for p in entries:
            try:
                if now - p.stat().st_mtime > 24 * 3600:
                    shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink(missing_ok=True)
            except OSError:
                pass
        entries = [p for p in temp_root.iterdir() if p.name.endswith(".sloppak")]
        entries.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        for p in entries[20:]:
            shutil.rmtree(p, ignore_errors=True) if p.is_dir() else p.unlink(missing_ok=True)
    except Exception:
        pass


# ── Results / copy card saving (mirrors note_detect's save-card; the save FOLDER
#    is SHARED via the `slopsmith_notedetect_save_dir` setting so both plugins write
#    their cards to the same place) ──────────────────────────────────────────────
_CARD_MAX_BYTES = 8 * 1024 * 1024  # generous cap for a 1200×630 results-card PNG
_CARD_NAME_RE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def _default_pictures_dir() -> Path:
    """The user's Pictures folder — the Save button's default destination."""
    return Path.home() / "Pictures"


def _resolve_card_dir(raw: str, auto: bool = False) -> Path:
    """Target dir for a saved card: the user-configured folder (shared with
    note_detect via `slopsmith_notedetect_save_dir`) when given, else the default
    Pictures folder. Auto-save with no folder goes to a 'feedBack Cards' subfolder
    so the per-run stream doesn't clutter Pictures. A supplied path must be
    absolute — a relative path would resolve against the server CWD."""
    raw = (raw or "").strip()
    if not raw:
        base = _default_pictures_dir()
        return base / "feedBack Cards" if auto else base
    p = Path(raw).expanduser()
    if not p.is_absolute():
        raise HTTPException(400, "save folder must be an absolute path")
    return p


def _sanitize_card_filename(name: str) -> str:
    """Bare, filesystem-safe .png basename — never a path, so the client can't
    write outside the resolved directory via the name."""
    base = Path(str(name or "")).name
    base = _CARD_NAME_RE.sub("-", base)
    base = re.sub(r"\s+", " ", base).strip(" -_.") or "virtuoso-card"
    if not base.lower().endswith(".png"):
        base = re.sub(r"\.[^.]*$", "", base) + ".png"
    return base[:120]


def setup(app: FastAPI, context: dict) -> None:
    data_dir = _data_dir(context)
    presets_path = _presets_path(context)
    tunings_path = _tunings_path(context)
    meta_db = context.get("meta_db")
    if meta_db is not None:
        _ensure_tables(meta_db)
        _migrate_presets_from_json(meta_db, presets_path)
        _migrate_tunings_from_json(meta_db, tunings_path)
        # Refresh the export mirrors at startup so state saved before the
        # mirror existed (or while it was broken) is exportable immediately,
        # not only after the next save.
        _snapshot_presets(meta_db, presets_path)
        _snapshot_tunings(meta_db, tunings_path)

    @app.post(f"/api/plugins/{PLUGIN_ID}/save-card")
    async def save_card(request: Request):
        # Body: raw PNG bytes (the results/copy card rendered on a canvas). Query:
        # ?dir=<absolute folder>&name=<filename>&auto=0|1. Writes the PNG to the
        # configured folder (shared with note_detect's save setting; default: the
        # user's Pictures folder) and returns the path. Works in the web testbed and
        # the desktop bundle — both run this local server as the user.
        body = await request.body()
        if len(body) > _CARD_MAX_BYTES:
            raise HTTPException(413, "card image too large")
        if not body or body[:8] != b"\x89PNG\r\n\x1a\n":
            raise HTTPException(400, "body is not a PNG image")
        auto = request.query_params.get("auto", "") in ("1", "true", "yes")
        target = _resolve_card_dir(request.query_params.get("dir", ""), auto=auto)
        name = _sanitize_card_filename(request.query_params.get("name", "virtuoso-card.png"))
        try:
            target.mkdir(parents=True, exist_ok=True)
            path = target / name
            # Auto-save preserves every take: never overwrite — append " (2)", " (3)" …
            if auto and path.exists():
                stem, suffix = path.stem, path.suffix
                i = 2
                while (target / f"{stem} ({i}){suffix}").exists():
                    i += 1
                path = target / f"{stem} ({i}){suffix}"
            tmp = path.with_suffix(path.suffix + ".tmp")
            tmp.write_bytes(body)
            tmp.replace(path)
        except OSError as e:
            raise HTTPException(500, f"could not save card to {target}: {e}")
        return {"ok": True, "path": str(path), "dir": str(target), "filename": path.name, "bytes": len(body)}

    @app.get(f"/api/plugins/{PLUGIN_ID}/status")
    def status():
        dlc_dir = _get_dlc_dir_from_server(context)
        return {
            "ok": True,
            "plugin": PLUGIN_ID,
            "schema_version": SCHEMA_VERSION,
            "data_dir": str(data_dir),
            "preset_file_exists": presets_path.exists(),
            "dlc_dir_available": bool(dlc_dir),
            "db_backed": meta_db is not None,
        }

    # Self-hosted WebAudioFont player + GM presets (the engine:'sample' backing
    # path) — bundled under static/wafonts/ and served here, so there's no
    # runtime CDN dependency and playback is offline-safe. Only the bundled .js
    # files are served; reject path traversal.
    _wafont_dir = Path(__file__).resolve().parent / "static" / "wafonts"

    @app.get(f"/api/plugins/{PLUGIN_ID}/wafont/{{name}}")
    def wafont(name: str):
        if not name.endswith(".js") or "/" in name or "\\" in name or ".." in name:
            raise HTTPException(404, "Not found.")
        path = _wafont_dir / name
        if not path.is_file():
            raise HTTPException(404, "Not found.")
        return FileResponse(str(path), media_type="application/javascript")

    # Distorted-track DSP assets: cab impulse responses (.wav) under static/irs/
    # and NAM amp captures (.nam, which are JSON) under static/nam/. Served locally
    # so the amp/cab chain is offline-safe. The NAM *engine* (worklet + wasm) is
    # borrowed from the host's nam_tone plugin at runtime — not bundled here.
    # static/nam/ is gitignored; static/irs/ ships ONLY the GPL-3 metal V30
    # (v30_4x12.wav) and gitignores the commercial clean/overdrive cabs (see
    # static/irs/README.md). Only the declared extension is served + traversal rejected.
    _irs_dir = Path(__file__).resolve().parent / "static" / "irs"
    _nam_dir = Path(__file__).resolve().parent / "static" / "nam"

    @app.get(f"/api/plugins/{PLUGIN_ID}/ir/{{name}}")
    def cab_ir(name: str):
        if not name.endswith(".wav") or "/" in name or "\\" in name or ".." in name:
            raise HTTPException(404, "Not found.")
        path = _irs_dir / name
        if not path.is_file():
            raise HTTPException(404, "Not found.")
        return FileResponse(str(path), media_type="audio/wav")

    @app.get(f"/api/plugins/{PLUGIN_ID}/nam/{{name}}")
    def nam_model(name: str):
        if not name.endswith(".nam") or "/" in name or "\\" in name or ".." in name:
            raise HTTPException(404, "Not found.")
        path = _nam_dir / name
        if not path.is_file():
            raise HTTPException(404, "Not found.")
        return FileResponse(str(path), media_type="application/json")

    # License-cleared committed sample subsets (e.g. the CC0 Shinyguitar electric-DI
    # guitar voice) under static/samples/ — see static/samples/README.md for
    # provenance. Unlike irs/ and nam/, these ship in git.
    _samples_dir = Path(__file__).resolve().parent / "static" / "samples"

    @app.get(f"/api/plugins/{PLUGIN_ID}/sample/{{name}}")
    def sample_asset(name: str):
        if not name.endswith(".ogg") or "/" in name or "\\" in name or ".." in name:
            raise HTTPException(404, "Not found.")
        path = _samples_dir / name
        if not path.is_file():
            raise HTTPException(404, "Not found.")
        return FileResponse(str(path), media_type="audio/ogg")

    @app.get(f"/api/plugins/{PLUGIN_ID}/presets")
    def list_presets():
        if meta_db is None:
            raise HTTPException(503, "Plugin DB context unavailable.")
        rows = meta_db.conn.execute(
            "SELECT id, name, kind, config_json, created_at "
            "FROM virtuoso_presets ORDER BY created_at DESC"
        ).fetchall()
        out = []
        for r in rows:
            try:
                cfg = json.loads(r[3]) if r[3] else {}
            except Exception:
                cfg = {}
            out.append({"id": r[0], "name": r[1], "kind": r[2], "config": cfg, "created_at": r[4]})
        return {"version": SCHEMA_VERSION, "presets": out}

    @app.post(f"/api/plugins/{PLUGIN_ID}/presets")
    def save_preset(payload: PresetPayload):
        if meta_db is None:
            raise HTTPException(503, "Plugin DB context unavailable.")
        existing = meta_db.conn.execute(
            "SELECT 1 FROM virtuoso_presets WHERE id = ?", (payload.id,)
        ).fetchone()
        with meta_db._lock:
            meta_db.conn.execute(
                "INSERT OR REPLACE INTO virtuoso_presets "
                "(id, name, kind, config_json, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (payload.id, payload.name, payload.kind,
                 json.dumps(payload.config, ensure_ascii=False), time.time()),
            )
            meta_db.conn.commit()
        _snapshot_presets(meta_db, presets_path)
        return {"ok": True, "preset": _model_dump(payload), "updated": bool(existing)}

    @app.delete(f"/api/plugins/{PLUGIN_ID}/presets/{{preset_id}}")
    def delete_preset(preset_id: str):
        if meta_db is None:
            raise HTTPException(503, "Plugin DB context unavailable.")
        with meta_db._lock:
            cur = meta_db.conn.execute(
                "DELETE FROM virtuoso_presets WHERE id = ?", (preset_id,)
            )
            meta_db.conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Preset not found.")
        _snapshot_presets(meta_db, presets_path)
        return {"ok": True, "deleted": preset_id}

    # ── Saved tunings ────────────────────────────────────────────────────
    # User-defined custom tunings. The frontend offers these alongside the
    # built-in TUNING_PRESETS in the tuning dropdown. We persist by name
    # (UNIQUE) so re-saving with the same name overwrites — the JS clears
    # the previous record by DELETE-then-POST when the user re-saves.
    @app.get(f"/api/plugins/{PLUGIN_ID}/tunings")
    def list_tunings():
        if meta_db is None:
            raise HTTPException(503, "Plugin DB context unavailable.")
        rows = meta_db.conn.execute(
            "SELECT id, name, family, string_count, midis_csv, created_at "
            "FROM virtuoso_tunings ORDER BY family, string_count, name"
        ).fetchall()
        out = []
        for r in rows:
            try:
                midis = [int(x) for x in (r[4] or "").split(",") if x.strip()]
            except Exception:
                midis = []
            out.append({"id": r[0], "name": r[1], "family": r[2],
                        "string_count": r[3], "midis": midis, "created_at": r[5]})
        return {"version": SCHEMA_VERSION, "tunings": out}

    @app.post(f"/api/plugins/{PLUGIN_ID}/tunings")
    def save_tuning(payload: TuningPayload):
        if meta_db is None:
            raise HTTPException(503, "Plugin DB context unavailable.")
        if payload.family not in {"guitar", "bass"}:
            raise HTTPException(400, "family must be 'guitar' or 'bass'.")
        if len(payload.midis) != payload.string_count:
            raise HTTPException(400, "midis length must match string_count.")
        for m in payload.midis:
            if m < 0 or m > 127:
                raise HTTPException(400, f"midi out of range: {m}")
        csv = ",".join(str(int(m)) for m in payload.midis)
        existing = meta_db.conn.execute(
            "SELECT id FROM virtuoso_tunings WHERE name = ?", (payload.name,)
        ).fetchone()
        with meta_db._lock:
            if existing:
                meta_db.conn.execute(
                    "UPDATE virtuoso_tunings SET family=?, string_count=?, midis_csv=? "
                    "WHERE id=?",
                    (payload.family, payload.string_count, csv, existing[0]),
                )
                tuning_id = existing[0]
            else:
                cur = meta_db.conn.execute(
                    "INSERT INTO virtuoso_tunings "
                    "(name, family, string_count, midis_csv, created_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (payload.name, payload.family, payload.string_count, csv, time.time()),
                )
                tuning_id = cur.lastrowid
            meta_db.conn.commit()
        _snapshot_tunings(meta_db, tunings_path)
        return {"ok": True, "id": tuning_id, "updated": bool(existing)}

    @app.delete(f"/api/plugins/{PLUGIN_ID}/tunings/{{tuning_id}}")
    def delete_tuning(tuning_id: int):
        if meta_db is None:
            raise HTTPException(503, "Plugin DB context unavailable.")
        with meta_db._lock:
            cur = meta_db.conn.execute(
                "DELETE FROM virtuoso_tunings WHERE id = ?", (tuning_id,)
            )
            meta_db.conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(404, "Tuning not found.")
        _snapshot_tunings(meta_db, tunings_path)
        return {"ok": True, "deleted": tuning_id}

    @app.post(f"/api/plugins/{PLUGIN_ID}/temp-sloppak")
    def build_temp_sloppak(payload: TempSloppakPayload):
        dlc_dir = _get_dlc_dir_from_server(context)
        if not dlc_dir:
            raise HTTPException(409, "DLC folder is not configured, so Virtuoso cannot launch a temporary player chart.")
        dlc_dir = dlc_dir.resolve()
        if not dlc_dir.exists() or not dlc_dir.is_dir():
            raise HTTPException(409, f"Configured DLC folder does not exist: {dlc_dir}")

        exercise = payload.exercise
        session, chart = _normalise_chart(exercise)
        arranged = chart["arrangement"]
        duration = chart["duration"]

        temp_root = dlc_dir / TEMP_ROOT_NAME
        _cleanup_temp_root(temp_root)

        key = str(session.get("key", "C"))
        scale = str(session.get("scale", "major")).replace("_", " ")
        mode = str(session.get("mode", "practice")).replace("_", " ")
        title = f"Virtuoso - {key} {scale} {mode}"
        slug = "virtuoso-" + uuid.uuid4().hex[:12]
        sloppak_dir = temp_root / f"{slug}.sloppak"
        work_dir = Path(tempfile.mkdtemp(prefix="virtuoso-work-", dir=str(data_dir)))
        try:
            (work_dir / "arrangements").mkdir(parents=True, exist_ok=True)
            stems_dir = work_dir / "stems"
            stems_dir.mkdir(parents=True, exist_ok=True)
            (work_dir / "arrangements" / "lead.json").write_text(
                json.dumps(arranged, indent=2, sort_keys=False) + "\n",
                encoding="utf-8",
            )
            stem_file = _write_practice_audio_stem(stems_dir, session, arranged, duration)

            manifest = {
                "title": title,
                "artist": "Virtuoso",
                "album": "Practice Tools",
                "year": 2026,
                "duration": duration,
                "arrangements": [{
                    "id": "lead",
                    "name": arranged.get("name", "Lead"),
                    "file": "arrangements/lead.json",
                    "tuning": arranged.get("tuning", [0, 0, 0, 0, 0, 0]),
                    "capo": 0,
                }],
                "stems": [{"id": "full", "file": stem_file, "default": True}],
                "virtuoso": {"version": SCHEMA_VERSION, "generated": True, "session": session},
            }
            (work_dir / "manifest.yaml").write_text(_dump_yaml(manifest), encoding="utf-8")

            if sloppak_dir.exists():
                shutil.rmtree(sloppak_dir, ignore_errors=True)
            shutil.move(str(work_dir), str(sloppak_dir))
            rel = sloppak_dir.relative_to(dlc_dir).as_posix()
            audio = session.get("audio") if isinstance(session.get("audio"), dict) else {}
            return {
                "ok": True,
                "filename": rel,
                "title": title,
                "duration": duration,
                "stem_file": stem_file,
                "audio": {
                    "notes": bool(audio.get("notes", session.get("audioNotes", False))),
                    "metronome": bool(audio.get("metronome", session.get("audioMetronome", False))),
                },
            }
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(500, f"Failed to build temporary Virtuoso sloppak: {exc}") from exc
        finally:
            if work_dir.exists():
                shutil.rmtree(work_dir, ignore_errors=True)
