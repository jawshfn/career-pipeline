from datetime import date, datetime, timezone

import pytest
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.orm import Session

from app import database
from app.models import Application, ApplicationActivity


def test_additive_application_columns_preserve_existing_notes_and_rows(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE applications ("
                "id INTEGER PRIMARY KEY, company_name VARCHAR(160), role_title VARCHAR(160), notes TEXT)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO applications (id, company_name, role_title, notes) "
                "VALUES (1, 'Fictional Labs', 'Analyst', 'Existing personal note')"
            )
        )

    monkeypatch.setattr(database, "engine", engine)
    database.add_application_additive_columns()

    columns = {column["name"] for column in inspect(engine).get_columns("applications")}
    assert "job_description" in columns

    with engine.connect() as connection:
        row = connection.execute(text("SELECT notes, job_description FROM applications WHERE id = 1")).one()

    assert row.notes == "Existing personal note"
    assert row.job_description is None
    engine.dispose()


def test_legacy_salary_columns_remain_compatible_with_current_application_model(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy-salary.db'}")
    database.Base.metadata.create_all(bind=engine)
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE applications ADD COLUMN salary_min FLOAT"))
        connection.execute(text("ALTER TABLE applications ADD COLUMN salary_max FLOAT"))
        connection.execute(
            text(
                "INSERT INTO applications (company_name, role_title, source, status, compensation, date_saved, "
                "is_archived, created_at, updated_at, salary_min, salary_max, vague_job_description, "
                "unrealistic_salary, asks_for_payment, suspicious_contact, company_mismatch, too_good_to_be_true) VALUES "
                "(:company, :role, :source, :status, :compensation, :date_saved, :archived, :created, :updated, :min, :max, "
                ":vague, :unrealistic, :payment, :suspicious, :mismatch, :too_good)"
            ),
            {
                "company": "Fictional Labs",
                "role": "Analyst",
                "source": "Other",
                "status": "Saved",
                "compensation": "$25 - $35/hr",
                "date_saved": date.today(),
                "archived": False,
                "created": datetime.now(timezone.utc),
                "updated": datetime.now(timezone.utc),
                "min": 25,
                "max": 35,
                "vague": False,
                "unrealistic": False,
                "payment": False,
                "suspicious": False,
                "mismatch": False,
                "too_good": False,
            },
        )

    with Session(engine) as session:
        application = session.query(Application).one()
        assert application.compensation == "$25 - $35/hr"
        application.compensation = "Competitive salary"
        session.commit()

    with engine.connect() as connection:
        compensation = connection.execute(text("SELECT compensation FROM applications")).scalar_one()

    assert compensation == "Competitive salary"
    engine.dispose()


def test_status_change_note_parser_accepts_only_exact_generated_notes():
    assert database.parse_status_change_note("Status changed from Applied to Interview.") == ("Applied", "Interview")
    assert database.parse_status_change_note("Status changed from Interview to Offer.") == ("Interview", "Offer")
    for note in (
        "Status changed from Applied to Interview",
        "status changed from Applied to Interview.",
        "Status changed from Applied to Interview. Added context",
        "Status changed from Made Up to Interview.",
        "I changed from Applied to Interview.",
    ):
        assert database.parse_status_change_note(note) is None


def test_history_backfill_is_marked_once_and_second_startup_skips_full_scans(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'backfill.db'}")
    database.Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        application = Application(company_name="Fictional Labs", role_title="Analyst", status="Rejected")
        session.add(application)
        session.flush()
        session.add(ApplicationActivity(application_id=application.id, activity_date=date.today(), activity_type="Status Change", note="Status changed from Applied to Interview."))
        session.commit()
    with engine.begin() as connection:
        connection.execute(text("UPDATE applications SET furthest_stage = 'Saved'"))

    monkeypatch.setattr(database, "engine", engine)
    database.add_application_additive_columns()
    with engine.connect() as connection:
        assert connection.execute(text("SELECT furthest_stage FROM applications")).scalar_one() == "Interview"
        assert connection.execute(text("SELECT migration_key FROM internal_schema_migrations")).scalar_one() == database.FURTHEST_STAGE_HISTORY_BACKFILL_KEY

    statements = []
    def capture_sql(_connection, _cursor, statement, _parameters, _context, _executemany):
        statements.append(statement.lower())
    event.listen(engine, "before_cursor_execute", capture_sql)
    database.add_application_additive_columns()
    event.remove(engine, "before_cursor_execute", capture_sql)
    assert not any("from application_activities" in statement for statement in statements)
    assert not any("select id, status, date_applied, furthest_stage from applications" in statement for statement in statements)
    engine.dispose()


def test_existing_furthest_stage_column_without_marker_is_repaired(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'already-upgraded.db'}")
    database.Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        application = Application(company_name="Fictional Labs", role_title="Analyst", status="Withdrawn")
        session.add(application)
        session.flush()
        session.add(ApplicationActivity(application_id=application.id, activity_date=date.today(), activity_type="Status Change", note="Status changed from Interview to Offer."))
        session.commit()
    with engine.begin() as connection:
        connection.execute(text("UPDATE applications SET furthest_stage = 'Saved'"))
    monkeypatch.setattr(database, "engine", engine)
    database.add_application_additive_columns()
    with engine.connect() as connection:
        assert connection.execute(text("SELECT furthest_stage FROM applications")).scalar_one() == "Offer"
    engine.dispose()


def test_legacy_database_without_furthest_stage_is_backfilled(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'missing-stage.db'}")
    database.Base.metadata.create_all(bind=engine)
    with Session(engine) as session:
        application = Application(company_name="Fictional Labs", role_title="Analyst", status="Rejected")
        session.add(application)
        session.flush()
        session.add(ApplicationActivity(application_id=application.id, activity_date=date.today(), activity_type="Status Change", note="Status changed from Applied to Interview."))
        session.commit()
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE applications DROP COLUMN furthest_stage"))
    monkeypatch.setattr(database, "engine", engine)
    database.add_application_additive_columns()
    with engine.connect() as connection:
        assert connection.execute(text("SELECT furthest_stage FROM applications")).scalar_one() == "Interview"
    engine.dispose()


def test_failed_backfill_does_not_write_success_marker(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{tmp_path / 'failed-backfill.db'}")
    database.Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(database, "engine", engine)

    def fail_reconciliation(_connection, _cursor, statement, _parameters, _context, _executemany):
        if statement.startswith("SELECT id, status, date_applied, furthest_stage FROM applications"):
            raise RuntimeError("simulated reconciliation failure")

    event.listen(engine, "before_cursor_execute", fail_reconciliation)
    with pytest.raises(RuntimeError, match="simulated reconciliation failure"):
        database.add_application_additive_columns()
    event.remove(engine, "before_cursor_execute", fail_reconciliation)
    with engine.connect() as connection:
        marker = connection.execute(text("SELECT migration_key FROM internal_schema_migrations")).scalar_one_or_none()
    assert marker is None
    engine.dispose()
