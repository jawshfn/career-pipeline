from datetime import date, datetime, timezone

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

from app import database
from app.models import Application


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
