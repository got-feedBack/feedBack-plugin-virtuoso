"""Preset CRUD, backed by the shared sqlite meta_db + JSON export mirror."""

import json

PRESETS = "/api/plugins/virtuoso/presets"


def test_list_empty(client):
    r = client.get(PRESETS)
    assert r.status_code == 200
    assert r.json() == {"version": 1, "presets": []}


def test_save_and_list(client):
    body = {"id": "p1", "name": "Warmup", "kind": "exercise", "config": {"bpm": 90}}
    r = client.post(PRESETS, json=body)
    assert r.status_code == 200
    assert r.json()["updated"] is False

    presets = client.get(PRESETS).json()["presets"]
    assert len(presets) == 1
    assert presets[0]["id"] == "p1"
    assert presets[0]["name"] == "Warmup"
    assert presets[0]["config"] == {"bpm": 90}


def test_save_defaults_kind_and_config(client):
    r = client.post(PRESETS, json={"id": "p1", "name": "Bare"})
    assert r.status_code == 200
    preset = client.get(PRESETS).json()["presets"][0]
    assert preset["kind"] == "exercise"
    assert preset["config"] == {}


def test_save_upserts_by_id(client):
    client.post(PRESETS, json={"id": "p1", "name": "First"})
    r = client.post(PRESETS, json={"id": "p1", "name": "Second"})
    assert r.json()["updated"] is True
    presets = client.get(PRESETS).json()["presets"]
    assert len(presets) == 1
    assert presets[0]["name"] == "Second"


def test_save_validation_errors(client):
    assert client.post(PRESETS, json={"id": "", "name": "x"}).status_code == 422
    assert client.post(PRESETS, json={"id": "p1"}).status_code == 422


def test_delete_preset(client):
    client.post(PRESETS, json={"id": "p1", "name": "X"})
    r = client.delete(f"{PRESETS}/p1")
    assert r.json() == {"ok": True, "deleted": "p1"}
    assert client.get(PRESETS).json()["presets"] == []


def test_delete_missing_preset_404(client):
    assert client.delete(f"{PRESETS}/nope").status_code == 404


def test_presets_ordered_newest_first(client):
    client.post(PRESETS, json={"id": "a", "name": "A"})
    client.post(PRESETS, json={"id": "b", "name": "B"})
    presets = client.get(PRESETS).json()["presets"]
    assert [p["id"] for p in presets] == ["b", "a"]


def test_save_snapshots_to_json_mirror(client, config_dir):
    client.post(PRESETS, json={"id": "p1", "name": "Mirror Test"})
    mirror = config_dir / "plugin_data" / "virtuoso" / "presets.json"
    assert mirror.exists()
    data = json.loads(mirror.read_text(encoding="utf-8"))
    assert data["presets"][0]["id"] == "p1"


def test_migrates_legacy_json_on_first_load(config_dir, meta_db):
    import routes
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    legacy_dir = config_dir / "plugin_data" / "virtuoso"
    legacy_dir.mkdir(parents=True, exist_ok=True)
    (legacy_dir / "presets.json").write_text(json.dumps({
        "version": 1,
        "presets": [{"id": "legacy1", "name": "Legacy", "kind": "exercise", "config": {}}],
    }), encoding="utf-8")

    app = FastAPI()
    routes.setup(app, {"config_dir": str(config_dir), "meta_db": meta_db})
    with TestClient(app) as c:
        presets = c.get(PRESETS).json()["presets"]
    assert [p["id"] for p in presets] == ["legacy1"]


def test_presets_require_db(client_no_db):
    assert client_no_db.get(PRESETS).status_code == 503
    assert client_no_db.post(PRESETS, json={"id": "p1", "name": "X"}).status_code == 503
    assert client_no_db.delete(f"{PRESETS}/p1").status_code == 503
