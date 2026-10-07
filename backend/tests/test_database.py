import pytest
from sqlalchemy import create_engine, inspect
from app.config import settings
from app.database import session


@pytest.fixture()
def database(tmp_path, monkeypatch):
    url = "sqlite:///" + (tmp_path / "migration.db").as_posix()
    engine = create_engine(url)
    monkeypatch.setattr(settings, "database_url", url)
    monkeypatch.setattr(session, "engine", engine)
    monkeypatch.setattr(session, "_initialized", False)
    yield engine
    engine.dispose()


def test_first_account_database_initialization_tracks_migrations(database):
    session.initialize_database()
    inspector = inspect(database)
    assert inspector.has_table("alembic_version")
    assert inspector.has_table("auth_sessions")
    assert "result" in {column["name"] for column in inspector.get_columns("skin_scans")}
    session.initialize_database()  # idempotent


def test_complete_bootstrap_schema_can_be_adopted(database):
    session.Base.metadata.create_all(database)
    session.initialize_database()
    assert inspect(database).has_table("alembic_version")


def test_incomplete_legacy_database_is_not_silently_stamped(database):
    session.Base.metadata.tables["users"].create(database)
    with pytest.raises(RuntimeError, match="Legacy database"):
        session.initialize_database()
    assert not inspect(database).has_table("alembic_version")
