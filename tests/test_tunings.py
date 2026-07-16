"""Saved-tuning CRUD."""

TUNINGS = "/api/plugins/virtuoso/tunings"

STANDARD = {"name": "Standard", "family": "guitar", "string_count": 6,
            "midis": [40, 45, 50, 55, 59, 64]}


def test_list_empty(client):
    assert client.get(TUNINGS).json() == {"version": 1, "tunings": []}


def test_save_and_list(client):
    r = client.post(TUNINGS, json=STANDARD)
    assert r.status_code == 200
    assert r.json()["updated"] is False

    tunings = client.get(TUNINGS).json()["tunings"]
    assert len(tunings) == 1
    assert tunings[0]["name"] == "Standard"
    assert tunings[0]["midis"] == [40, 45, 50, 55, 59, 64]


def test_save_rejects_bad_family(client):
    bad = dict(STANDARD, family="banjo")
    assert client.post(TUNINGS, json=bad).status_code == 400


def test_save_rejects_length_mismatch(client):
    bad = dict(STANDARD, string_count=4)
    assert client.post(TUNINGS, json=bad).status_code == 400


def test_save_rejects_out_of_range_midi(client):
    bad = dict(STANDARD, midis=[40, 45, 50, 55, 59, 200])
    assert client.post(TUNINGS, json=bad).status_code == 400
    bad2 = dict(STANDARD, midis=[40, 45, 50, 55, 59, -1])
    assert client.post(TUNINGS, json=bad2).status_code == 400


def test_save_upserts_by_name(client):
    client.post(TUNINGS, json=STANDARD)
    updated = dict(STANDARD, midis=[38, 43, 48, 53, 57, 62])
    r = client.post(TUNINGS, json=updated)
    assert r.json()["updated"] is True
    tunings = client.get(TUNINGS).json()["tunings"]
    assert len(tunings) == 1
    assert tunings[0]["midis"] == [38, 43, 48, 53, 57, 62]


def test_delete_tuning(client):
    saved = client.post(TUNINGS, json=STANDARD).json()
    r = client.delete(f"{TUNINGS}/{saved['id']}")
    assert r.json() == {"ok": True, "deleted": saved["id"]}
    assert client.get(TUNINGS).json()["tunings"] == []


def test_delete_missing_tuning_404(client):
    assert client.delete(f"{TUNINGS}/9999").status_code == 404


def test_tunings_ordered_by_family_then_strings_then_name(client):
    client.post(TUNINGS, json=dict(STANDARD, name="Z Guitar"))
    client.post(TUNINGS, json={"name": "Bass Std", "family": "bass",
                                "string_count": 4, "midis": [28, 33, 38, 43]})
    client.post(TUNINGS, json=dict(STANDARD, name="A Guitar"))
    names = [t["name"] for t in client.get(TUNINGS).json()["tunings"]]
    assert names == ["Bass Std", "A Guitar", "Z Guitar"]


def test_tunings_require_db(client_no_db):
    assert client_no_db.get(TUNINGS).status_code == 503
    assert client_no_db.post(TUNINGS, json=STANDARD).status_code == 503
    assert client_no_db.delete(f"{TUNINGS}/1").status_code == 503
