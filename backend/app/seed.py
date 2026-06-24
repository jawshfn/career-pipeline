from datetime import date, timedelta

from .database import SessionLocal, create_db_and_tables
from .models import Application, ResumeVersion


def seed_demo_data() -> None:
    create_db_and_tables()
    db = SessionLocal()
    try:
        if db.query(ResumeVersion).first() or db.query(Application).first():
            print("Seed data already exists. No demo records were added.")
            return

        resume_versions = [
            ResumeVersion(name="SWE Resume", target_role="Software Engineering", description="Fictional software engineering resume variant."),
            ResumeVersion(name="QA Resume", target_role="Quality Assurance", description="Fictional quality assurance resume variant."),
            ResumeVersion(name="IT Support Resume", target_role="IT Support", description="Fictional support-focused resume variant."),
            ResumeVersion(name="Data Analyst Resume", target_role="Data Analytics", description="Fictional analytics resume variant."),
        ]
        db.add_all(resume_versions)
        db.flush()

        today = date.today()
        applications = [
            Application(
                company_name="Northstar Labs",
                role_title="Junior Software Developer",
                job_link="https://example.com/northstar-junior-developer",
                source="LinkedIn",
                status="Applied",
                location="Remote",
                employment_type="Full-time",
                date_saved=today - timedelta(days=8),
                date_applied=today - timedelta(days=7),
                follow_up_date=today + timedelta(days=2),
                resume_version_id=resume_versions[0].id,
                notes="Fictional demo application.",
            ),
            Application(
                company_name="Blue Harbor QA",
                role_title="QA Analyst",
                source="Indeed",
                status="Assessment",
                location="Chicago, IL",
                employment_type="Full-time",
                date_saved=today - timedelta(days=6),
                date_applied=today - timedelta(days=5),
                follow_up_date=today,
                resume_version_id=resume_versions[1].id,
            ),
            Application(
                company_name="Summit Helpdesk",
                role_title="IT Support Specialist",
                source="Company Site",
                status="Recruiter Screen",
                location="Denver, CO",
                employment_type="Full-time",
                date_saved=today - timedelta(days=12),
                date_applied=today - timedelta(days=11),
                follow_up_date=today - timedelta(days=1),
                resume_version_id=resume_versions[2].id,
            ),
            Application(
                company_name="Cedar Metrics",
                role_title="Data Analyst",
                source="Referral",
                status="Interview",
                location="Hybrid",
                employment_type="Full-time",
                date_saved=today - timedelta(days=15),
                date_applied=today - timedelta(days=14),
                resume_version_id=resume_versions[3].id,
            ),
            Application(
                company_name="Riverbend Systems",
                role_title="Associate Software Engineer",
                source="ZipRecruiter",
                status="Saved",
                location="Remote",
                employment_type="Full-time",
                date_saved=today,
                resume_version_id=resume_versions[0].id,
            ),
        ]
        db.add_all(applications)
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
    print("Seeded fictional Career Pipeline demo data.")
