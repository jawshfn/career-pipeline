from sqlalchemy import create_engine, inspect, text

from app import database


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
