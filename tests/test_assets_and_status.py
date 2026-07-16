"""Static asset serving (traversal guards), status, and save-card."""

STATUS = "/api/plugins/virtuoso/status"
SAVE_CARD = "/api/plugins/virtuoso/save-card"

PNG_MAGIC = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16


def test_status_reports_db_backed(client):
    body = client.get(STATUS).json()
    assert body["ok"] is True
    assert body["plugin"] == "virtuoso"
    assert body["db_backed"] is True


def test_status_without_db(client_no_db):
    assert client_no_db.get(STATUS).json()["db_backed"] is False


def test_wafont_serves_bundled_file(client):
    r = client.get("/api/plugins/virtuoso/wafont/0000_FluidR3_GM_sf2_file.js")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/javascript")


def test_wafont_rejects_traversal_and_wrong_ext(client):
    for name in ("..%2F..%2Frequirements.txt", "evil.py", "..%5C..%5Cetc"):
        assert client.get(f"/api/plugins/virtuoso/wafont/{name}").status_code == 404


def test_ir_serves_bundled_cab(client):
    r = client.get("/api/plugins/virtuoso/ir/v30_4x12.wav")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("audio/wav")


def test_ir_missing_404(client):
    assert client.get("/api/plugins/virtuoso/ir/nope.wav").status_code == 404


def test_nam_rejects_wrong_extension(client):
    assert client.get("/api/plugins/virtuoso/nam/model.txt").status_code == 404


def test_sample_rejects_wrong_extension(client):
    assert client.get("/api/plugins/virtuoso/sample/voice.mp3").status_code == 404


def test_font_rejects_wrong_extension(client):
    assert client.get("/api/plugins/virtuoso/font/Orbitron.ttf").status_code == 404


def test_save_card_requires_png_magic(client):
    r = client.post(SAVE_CARD, content=b"not a png")
    assert r.status_code == 400


def test_save_card_rejects_oversized_body(client, monkeypatch):
    import routes
    monkeypatch.setattr(routes, "_CARD_MAX_BYTES", 8)
    r = client.post(SAVE_CARD, content=PNG_MAGIC)
    assert r.status_code == 413


def test_save_card_writes_file(client, tmp_path):
    target = tmp_path / "cards"
    r = client.post(f"{SAVE_CARD}?dir={target}&name=result.png", content=PNG_MAGIC)
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert (target / "result.png").exists()
    assert (target / "result.png").read_bytes() == PNG_MAGIC


def test_save_card_auto_mode_never_overwrites(client, tmp_path):
    target = tmp_path / "cards"
    url = f"{SAVE_CARD}?dir={target}&name=take.png&auto=1"
    first = client.post(url, content=PNG_MAGIC).json()
    second = client.post(url, content=PNG_MAGIC).json()
    assert first["filename"] == "take.png"
    assert second["filename"] == "take (2).png"


def test_save_card_rejects_relative_dir(client):
    r = client.post(f"{SAVE_CARD}?dir=relative/path", content=PNG_MAGIC)
    assert r.status_code == 400
