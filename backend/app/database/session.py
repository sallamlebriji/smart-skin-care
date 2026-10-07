from collections.abc import Generator
from pathlib import Path
from threading import Lock

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

if settings.database_url.startswith("sqlite:///"):
    Path(settings.database_url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(settings.database_url, pool_pre_ping=True,
                       connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


_initialized = False
_init_lock = Lock()


def initialize_database() -> None:
    global _initialized
    with _init_lock:
        if not _initialized:
            from app.database import models  # noqa: F401
            from alembic import command
            from alembic.config import Config
            backend_root = Path(__file__).resolve().parents[2]
            config = Config(str(backend_root / "alembic.ini"))
            config.attributes["skip_logging"] = True
            config.set_main_option("script_location", str(backend_root / "alembic"))
            inspector = inspect(engine)
            # Adopt the complete v1 schema created by the earlier bootstrap.
            # Incomplete legacy databases need an explicit migration, not a stamp.
            if inspector.has_table("users") and not inspector.has_table("alembic_version"):
                matches = all(inspector.has_table(table.name) and
                    {column["name"] for column in inspector.get_columns(table.name)} == set(table.columns.keys())
                    for table in Base.metadata.sorted_tables)
                if not matches:
                    raise RuntimeError("Legacy database schema is incomplete; back it up and migrate explicitly")
                command.stamp(config, "87e85af93ccf")
            command.upgrade(config, "head")
            _initialized = True


def get_db() -> Generator[Session, None, None]:
    initialize_database()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
