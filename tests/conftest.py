import sqlite3
import sys
import threading
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# The plugin is a flat module directory; make routes importable from tests.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import routes  # noqa: E402


class FakeMetaDb:
    """Minimal stand-in for the host's shared MetaDB: a sqlite conn + lock."""

    def __init__(self):
        self.conn = sqlite3.connect(":memory:", check_same_thread=False)
        self._lock = threading.Lock()


@pytest.fixture
def meta_db():
    return FakeMetaDb()


@pytest.fixture
def config_dir(tmp_path):
    return tmp_path / "config"


@pytest.fixture
def client(config_dir, meta_db):
    app = FastAPI()
    context = {"config_dir": str(config_dir), "meta_db": meta_db}
    routes.setup(app, context)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def client_no_db(config_dir):
    app = FastAPI()
    context = {"config_dir": str(config_dir), "meta_db": None}
    routes.setup(app, context)
    with TestClient(app) as c:
        yield c
