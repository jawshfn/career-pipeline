from collections.abc import Generator
import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_URL = f"sqlite:///{BACKEND_DIR / 'career_pipeline.db'}"
DATABASE_URL = os.getenv("CAREER_PIPELINE_DATABASE_URL", DEFAULT_DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_db_and_tables() -> None:
    Base.metadata.create_all(bind=engine)
    add_application_additive_columns()


def add_application_additive_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("applications"):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("applications")}
    column_definitions = {
        "next_action": "TEXT",
        "contact_name": "VARCHAR(160)",
        "contact_info": "TEXT",
        "prep_notes": "TEXT",
        "compensation": "VARCHAR(160)",
        "vague_job_description": "BOOLEAN NOT NULL DEFAULT 0",
        "unrealistic_salary": "BOOLEAN NOT NULL DEFAULT 0",
        "asks_for_payment": "BOOLEAN NOT NULL DEFAULT 0",
        "suspicious_contact": "BOOLEAN NOT NULL DEFAULT 0",
        "company_mismatch": "BOOLEAN NOT NULL DEFAULT 0",
        "too_good_to_be_true": "BOOLEAN NOT NULL DEFAULT 0",
        "red_flags_notes": "TEXT",
    }

    missing_columns = [
        (column_name, definition)
        for column_name, definition in column_definitions.items()
        if column_name not in existing_columns
    ]
    if not missing_columns:
        return

    with engine.begin() as connection:
        for column_name, definition in missing_columns:
            connection.execute(text(f"ALTER TABLE applications ADD COLUMN {column_name} {definition}"))
