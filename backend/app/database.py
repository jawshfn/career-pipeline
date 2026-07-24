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
        "job_description": "TEXT",
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
    with engine.begin() as connection:
        for column_name, definition in missing_columns:
            connection.execute(text(f"ALTER TABLE applications ADD COLUMN {column_name} {definition}"))
        if "furthest_stage" not in existing_columns:
            connection.execute(text("ALTER TABLE applications ADD COLUMN furthest_stage VARCHAR(40) NOT NULL DEFAULT 'Saved'"))
    # Reconcile old records once the column exists. Activity notes are deliberately
    # only migration evidence; live reporting reads this stored value.
    from .domain import furthest_stage_for, PROGRESSION_STAGES
    import re
    application_columns = {column["name"] for column in inspector.get_columns("applications")}
    if not {"id", "status", "date_applied", "furthest_stage"}.issubset(application_columns):
        return

    history: dict[int, list[str]] = {}
    if inspector.has_table("application_activities"):
        activity_columns = {
            column["name"] for column in inspector.get_columns("application_activities")
        }
        if {"application_id", "activity_type", "note"}.issubset(activity_columns):
            with engine.connect() as connection:
                activities = connection.execute(
                    text(
                        "SELECT application_id, note FROM application_activities "
                        "WHERE activity_type = 'Status Change'"
                    )
                ).mappings()
                pattern = re.compile(
                    r"^Status changed from (Saved|Applied|Assessment|Recruiter Screen|Interview|Offer|Rejected|Withdrawn|Archived) to (Saved|Applied|Assessment|Recruiter Screen|Interview|Offer|Rejected|Withdrawn|Archived)\\.$"
                )
                for activity in activities:
                    match = pattern.fullmatch(activity["note"] or "")
                    if match:
                        history.setdefault(activity["application_id"], []).extend(match.groups())

    with engine.begin() as connection:
        applications = connection.execute(
            text("SELECT id, status, date_applied, furthest_stage FROM applications")
        ).mappings()
        for app in applications:
            existing = app["furthest_stage"] if app["furthest_stage"] in PROGRESSION_STAGES else None
            stage = furthest_stage_for(app["status"], app["date_applied"], existing)
            for status_value in history.get(app["id"], []):
                stage = furthest_stage_for(status_value, None, stage)
            if app["furthest_stage"] != stage:
                connection.execute(
                    text("UPDATE applications SET furthest_stage = :stage WHERE id = :id"),
                    {"stage": stage, "id": app["id"]},
                )
