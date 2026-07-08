from __future__ import annotations

import argparse
from datetime import date, timedelta

from sqlalchemy.orm import Session

from .database import SessionLocal, create_db_and_tables
from .models import Application, ApplicationActivity, ResumeVersion, utc_now


class DemoDataError(RuntimeError):
    pass


def has_existing_demo_tables_data(db: Session) -> bool:
    return any(
        (
            db.query(Application).first(),
            db.query(ApplicationActivity).first(),
            db.query(ResumeVersion).first(),
        )
    )


def reset_demo_tables(db: Session) -> None:
    db.query(ApplicationActivity).delete()
    db.query(Application).delete()
    db.query(ResumeVersion).delete()
    db.commit()


def seed_demo_data(db: Session, *, reset: bool = False, today: date | None = None) -> dict[str, int]:
    if has_existing_demo_tables_data(db):
        if not reset:
            raise DemoDataError(
                "Demo seed refused because local data already exists. "
                "Run with --reset to clear local app demo tables first."
            )
        reset_demo_tables(db)

    seed_today = today or date.today()
    old_update_time = utc_now() - timedelta(days=24)

    resume_versions = [
        ResumeVersion(
            name="Software Engineer Resume",
            target_role="Full-stack engineer",
            description="Fictional resume variant focused on React, Python, APIs, and product delivery.",
        ),
        ResumeVersion(
            name="Data Analyst Resume",
            target_role="Data analyst",
            description="Fictional resume variant focused on SQL, dashboards, and business analysis.",
        ),
        ResumeVersion(
            name="IT Support Resume",
            target_role="IT support specialist",
            description="Fictional resume variant focused on troubleshooting and user support.",
        ),
        ResumeVersion(
            name="Early Career Resume",
            target_role="Entry-level roles",
            description="Fictional general resume variant for early-career applications.",
        ),
    ]
    db.add_all(resume_versions)
    db.flush()

    applications = [
        Application(
            company_name="Northstar Labs",
            role_title="Junior Software Developer",
            job_link="https://example.com/jobs/northstar-junior-software-developer",
            source="LinkedIn",
            status="Applied",
            location="Remote",
            compensation="$68,000 - $78,000 a year",
            employment_type="Full-time",
            date_saved=seed_today - timedelta(days=8),
            date_applied=seed_today - timedelta(days=7),
            follow_up_date=seed_today + timedelta(days=2),
            next_action="Follow up if there is no recruiter response by the preset date.",
            contact_name="Alex Rivera",
            contact_info="alex.rivera@example.com",
            prep_notes="Review the API project story and be ready to discuss React form tradeoffs.",
            resume_version_id=resume_versions[0].id,
            notes="Fictional LinkedIn posting for a product-minded junior developer role.",
        ),
        Application(
            company_name="Blue Harbor Analytics",
            role_title="Data Analyst I",
            job_link="https://example.com/jobs/blue-harbor-data-analyst",
            source="Indeed",
            status="Assessment",
            location="Norfolk, VA",
            compensation="$58,000 - $66,000 a year",
            employment_type="Full-time",
            date_saved=seed_today - timedelta(days=12),
            date_applied=seed_today - timedelta(days=11),
            follow_up_date=seed_today,
            next_action="Complete the take-home SQL assessment.",
            resume_version_id=resume_versions[1].id,
            notes="Assessment invite received for a fictional analytics role.",
        ),
        Application(
            company_name="Summit Support Co",
            role_title="IT Support Specialist",
            job_link="https://example.com/jobs/summit-it-support",
            source="Company Website",
            status="Recruiter Screen",
            location="Virginia Beach, VA",
            employment_type="Full-time",
            date_saved=seed_today - timedelta(days=15),
            date_applied=seed_today - timedelta(days=14),
            follow_up_date=seed_today - timedelta(days=1),
            next_action="Send a concise thank-you note and confirm availability.",
            contact_name="Jordan Lee",
            contact_info="jordan.lee@example.com",
            prep_notes="Prepare examples about troubleshooting under pressure and customer communication.",
            resume_version_id=resume_versions[2].id,
            notes="Recruiter screen completed; follow-up is overdue for demo purposes.",
        ),
        Application(
            company_name="Cedar Metrics",
            role_title="Business Intelligence Analyst",
            job_link="https://example.com/jobs/cedar-bi-analyst",
            source="Referral",
            status="Interview",
            location="Hybrid - Richmond, VA",
            compensation="$72,000 - $84,000 a year",
            employment_type="Full-time",
            date_saved=seed_today - timedelta(days=21),
            date_applied=seed_today - timedelta(days=20),
            follow_up_date=seed_today + timedelta(days=7),
            next_action="Prepare dashboard portfolio walkthrough.",
            contact_name="Morgan Patel",
            contact_info="morgan.patel@example.com",
            prep_notes="Emphasize stakeholder communication and metric definitions.",
            resume_version_id=resume_versions[1].id,
            notes="Panel interview scheduled for a fictional BI opportunity.",
        ),
        Application(
            company_name="Riverbend Systems",
            role_title="Associate Software Engineer",
            job_link="https://example.com/jobs/riverbend-associate-engineer",
            source="ZipRecruiter",
            status="Saved",
            location="Remote",
            employment_type="Full-time",
            date_saved=seed_today - timedelta(days=3),
            next_action="Review posting and decide whether to apply.",
            resume_version_id=resume_versions[0].id,
            notes="Saved for review after tailoring the software resume.",
        ),
        Application(
            company_name="Pinecrest Robotics",
            role_title="Software QA Engineer",
            job_link="https://example.com/jobs/pinecrest-qa-engineer",
            source="Handshake",
            status="Offer",
            location="Raleigh, NC",
            compensation="$74,000 a year",
            employment_type="Full-time",
            date_saved=seed_today - timedelta(days=32),
            date_applied=seed_today - timedelta(days=31),
            follow_up_date=seed_today + timedelta(days=1),
            next_action="Review offer details and prepare questions.",
            resume_version_id=resume_versions[3].id,
            notes="Fictional offer-stage application for dashboard and pipeline demo.",
        ),
        Application(
            company_name="BrightPath Digital",
            role_title="Frontend Developer",
            job_link="https://example.com/jobs/brightpath-frontend",
            source="LinkedIn",
            status="Rejected",
            location="Remote",
            employment_type="Full-time",
            date_saved=seed_today - timedelta(days=40),
            date_applied=seed_today - timedelta(days=39),
            resume_version_id=resume_versions[0].id,
            notes="Closed outcome retained for history and effectiveness metrics.",
        ),
        Application(
            company_name="Harborview Health Tech",
            role_title="Junior Data Coordinator",
            job_link="https://example.com/jobs/harborview-data-coordinator",
            source="Indeed",
            status="Withdrawn",
            location="Norfolk, VA",
            compensation="$19 - $23 an hour",
            employment_type="Part-time",
            date_saved=seed_today - timedelta(days=18),
            date_applied=seed_today - timedelta(days=17),
            resume_version_id=resume_versions[1].id,
            notes="Withdrawn after schedule mismatch; useful for Closed view demo.",
        ),
        Application(
            company_name="Acorn Cloud Services",
            role_title="Cloud Support Associate",
            job_link="https://example.com/jobs/acorn-cloud-support",
            source="Recruiter",
            status="Applied",
            location="Remote",
            employment_type="Contract",
            date_saved=seed_today - timedelta(days=25),
            date_applied=seed_today - timedelta(days=24),
            next_action="Decide whether the contract terms fit current goals.",
            resume_version_id=resume_versions[2].id,
            notes="Older active application with no follow-up; seeded as stale.",
            updated_at=old_update_time,
        ),
        Application(
            company_name="Silverline Careers Group",
            role_title="Entry Level Product Analyst",
            job_link="https://example.com/jobs/silverline-product-analyst",
            source="Other",
            status="Saved",
            location="Remote",
            compensation="$95,000 - $140,000 a year",
            employment_type="Full-time",
            date_saved=seed_today - timedelta(days=6),
            next_action="Research company legitimacy before applying.",
            resume_version_id=resume_versions[3].id,
            notes="Fictional questionable posting for red-flag demo.",
            vague_job_description=True,
            unrealistic_salary=True,
            suspicious_contact=True,
            red_flags_notes="High salary for entry-level title and vague company details.",
        ),
        Application(
            company_name="Maple Forge Studio",
            role_title="Junior Web Developer",
            job_link="https://example.com/jobs/maple-forge-web-developer",
            source="Company Website",
            status="Applied",
            location="Remote",
            compensation="$64,000 - $72,000 a year",
            employment_type="Full-time",
            date_saved=seed_today - timedelta(days=10),
            date_applied=seed_today - timedelta(days=9),
            follow_up_date=seed_today + timedelta(days=3),
            next_action="Check portal for status update.",
            resume_version_id=resume_versions[0].id,
            notes="Upcoming follow-up at the edge of the Command Center window.",
        ),
        Application(
            company_name="Greenfield Civic Apps",
            role_title="Implementation Analyst",
            job_link="https://example.com/jobs/greenfield-implementation-analyst",
            source="Referral",
            status="Saved",
            location="Hybrid - Chesapeake, VA",
            employment_type="Full-time",
            date_saved=seed_today - timedelta(days=17),
            next_action="Ask referrer whether the team is still hiring.",
            resume_version_id=resume_versions[3].id,
            notes="Saved referral lead with no follow-up and an old update for stale demo.",
            updated_at=old_update_time,
        ),
    ]
    db.add_all(applications)
    db.flush()

    activities = [
        ApplicationActivity(
            application_id=applications[0].id,
            activity_date=seed_today - timedelta(days=7),
            activity_type="Applied",
            note="Submitted application with the software engineer resume.",
        ),
        ApplicationActivity(
            application_id=applications[1].id,
            activity_date=seed_today - timedelta(days=2),
            activity_type="Assessment",
            note="Received SQL assessment instructions.",
        ),
        ApplicationActivity(
            application_id=applications[2].id,
            activity_date=seed_today - timedelta(days=3),
            activity_type="Recruiter contact",
            note="Completed recruiter screen and discussed support queue expectations.",
        ),
        ApplicationActivity(
            application_id=applications[3].id,
            activity_date=seed_today - timedelta(days=1),
            activity_type="Interview",
            note="Scheduled panel interview and started prep notes.",
        ),
        ApplicationActivity(
            application_id=applications[5].id,
            activity_date=seed_today - timedelta(days=1),
            activity_type="Offer",
            note="Received written offer and benefits summary.",
        ),
        ApplicationActivity(
            application_id=applications[9].id,
            activity_date=seed_today - timedelta(days=5),
            activity_type="Note",
            note="Marked red flags after reviewing the posting details.",
        ),
    ]
    db.add_all(activities)
    db.commit()

    return {
        "resume_versions": len(resume_versions),
        "applications": len(applications),
        "activities": len(activities),
    }


def run_seed(*, reset: bool = False) -> dict[str, int]:
    create_db_and_tables()
    db = SessionLocal()
    try:
        return seed_demo_data(db, reset=reset)
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed fictional local Career Pipeline demo data.")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Clear local application, activity, and resume-version tables before seeding.",
    )
    args = parser.parse_args()

    try:
        counts = run_seed(reset=args.reset)
    except DemoDataError as error:
        print(error)
        raise SystemExit(1) from error

    print(
        "Seeded fictional Career Pipeline demo data: "
        f"{counts['resume_versions']} resume versions, "
        f"{counts['applications']} applications, "
        f"{counts['activities']} activity entries."
    )
    if args.reset:
        print("Reset was used: local app demo tables were cleared before seeding.")


if __name__ == "__main__":
    main()
