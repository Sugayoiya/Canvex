"""
Seed test data for admin Users & Teams pages.

Usage:
    cd api && uv run python scripts/seed_test_data.py          # create seed data
    cd api && uv run python scripts/seed_test_data.py --clean   # delete seed data first, then recreate

Creates:
    - 25 users (mix of active/banned, admin/non-admin, varied login times)
    - 6 teams with varied membership (1–8 members each)
    - Team memberships with team_admin / member roles

All seeded users share password: test123456
"""

import asyncio
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, delete

sys.path.insert(0, ".")

from app.core.database import AsyncSessionLocal, init_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.team import Team, TeamMember  # noqa: E402

SEED_TAG = "[seed]"
SEED_PASSWORD = hash_password("test123456")

_now = datetime.now(timezone.utc)


def _ago(**kwargs) -> datetime:
    return _now - timedelta(**kwargs)


USERS = [
    # (email, nickname, status, is_admin, last_login_at_delta, created_at_delta)
    ("alice@example.com",    "Alice Chen",      "active",  True,  dict(hours=1),    dict(days=180)),
    ("bob@example.com",      "Bob Zhang",       "active",  True,  dict(hours=3),    dict(days=160)),
    ("carol@example.com",    "Carol Wang",      "active",  False, dict(hours=6),    dict(days=150)),
    ("david@example.com",    "David Li",        "active",  False, dict(days=1),     dict(days=140)),
    ("eve@example.com",      "Eve Liu",         "banned",  False, dict(days=5),     dict(days=130)),
    ("frank@example.com",    "Frank Zhao",      "active",  False, dict(days=2),     dict(days=120)),
    ("grace@example.com",    "Grace Sun",       "active",  False, dict(hours=12),   dict(days=110)),
    ("henry@example.com",    "Henry Wu",        "active",  False, dict(days=3),     dict(days=100)),
    ("iris@example.com",     "Iris Xu",         "banned",  False, dict(days=10),    dict(days=95)),
    ("jack@example.com",     "Jack Yang",       "active",  True,  dict(minutes=30), dict(days=90)),
    ("kate@example.com",     "Kate Huang",      "active",  False, dict(days=7),     dict(days=85)),
    ("leo@example.com",      "Leo Chen",        "active",  False, dict(days=4),     dict(days=80)),
    ("mia@example.com",      "Mia Zhou",        "active",  False, None,             dict(days=75)),
    ("nathan@example.com",   "Nathan Zhu",      "active",  False, dict(days=14),    dict(days=70)),
    ("olivia@example.com",   "Olivia Ma",       "banned",  False, dict(days=20),    dict(days=65)),
    ("peter@example.com",    "Peter Gao",       "active",  False, dict(days=1),     dict(days=60)),
    ("quinn@example.com",    "Quinn Jiang",     "active",  False, dict(hours=2),    dict(days=55)),
    ("rachel@example.com",   "Rachel Lin",      "active",  False, dict(days=6),     dict(days=50)),
    ("sam@example.com",      "Sam He",          "active",  False, dict(days=9),     dict(days=45)),
    ("tina@example.com",     "Tina Xie",        "active",  False, dict(hours=5),    dict(days=40)),
    ("uma@example.com",      "Uma Feng",        "banned",  False, dict(days=30),    dict(days=35)),
    ("victor@example.com",   "Victor Tang",     "active",  False, dict(days=2),     dict(days=30)),
    ("wendy@example.com",    "Wendy Luo",       "active",  False, dict(hours=8),    dict(days=25)),
    ("xavier@example.com",   "Xavier Deng",     "active",  False, dict(days=11),    dict(days=20)),
    ("yuki@example.com",     "Yuki Song",       "active",  False, dict(days=3),     dict(days=15)),
]

TEAMS = [
    # (name, description, created_days_ago)
    ("Studio Alpha",        "Main production team for short films",              150),
    ("Creative Lab",        "Experimental storytelling and visual effects",      120),
    ("Marketing Crew",      "Brand, social media, and promotional content",       90),
    ("Backend Engineers",   "API and infrastructure development",                 60),
    ("Design Guild",        "UI/UX design and visual style management",           45),
    ("QA & Testing",        None,                                                 30),
]

# team_index -> [(user_email, role)]
MEMBERSHIPS = {
    0: [  # Studio Alpha — 8 members, alice is admin
        ("alice@example.com",  "team_admin"),
        ("carol@example.com",  "member"),
        ("david@example.com",  "member"),
        ("frank@example.com",  "member"),
        ("grace@example.com",  "member"),
        ("henry@example.com",  "member"),
        ("kate@example.com",   "member"),
        ("leo@example.com",    "member"),
    ],
    1: [  # Creative Lab — 5 members, bob is admin
        ("bob@example.com",    "team_admin"),
        ("carol@example.com",  "member"),
        ("mia@example.com",    "member"),
        ("quinn@example.com",  "member"),
        ("tina@example.com",   "member"),
    ],
    2: [  # Marketing Crew — 4 members, jack is admin
        ("jack@example.com",   "team_admin"),
        ("rachel@example.com", "member"),
        ("wendy@example.com",  "member"),
        ("victor@example.com", "member"),
    ],
    3: [  # Backend Engineers — 3 members, alice is admin
        ("alice@example.com",  "team_admin"),
        ("peter@example.com",  "member"),
        ("xavier@example.com", "member"),
    ],
    4: [  # Design Guild — 3 members, grace is admin
        ("grace@example.com",  "team_admin"),
        ("yuki@example.com",   "member"),
        ("sam@example.com",    "member"),
    ],
    5: [  # QA & Testing — 2 members, nathan is admin
        ("nathan@example.com", "team_admin"),
        ("olivia@example.com", "member"),
    ],
}


async def clean_seed_data():
    """Remove all seeded users, teams, and memberships."""
    seed_emails = [u[0] for u in USERS]
    seed_team_names = [t[0] for t in TEAMS]

    async with AsyncSessionLocal() as session:
        existing = (await session.execute(
            select(User.id).where(User.email.in_(seed_emails))
        )).scalars().all()

        if existing:
            await session.execute(
                delete(TeamMember).where(TeamMember.user_id.in_(existing))
            )

        await session.execute(
            delete(Team).where(Team.name.in_(seed_team_names))
        )
        await session.execute(
            delete(User).where(User.email.in_(seed_emails))
        )
        await session.commit()
        print(f"{SEED_TAG} Cleaned {len(existing)} users and {len(seed_team_names)} teams")


async def seed():
    """Create test users, teams, and memberships."""
    async with AsyncSessionLocal() as session:
        existing_count = (await session.execute(
            select(func.count()).select_from(User).where(
                User.email.in_([u[0] for u in USERS])
            )
        )).scalar() or 0

        if existing_count > 0:
            print(f"{SEED_TAG} Found {existing_count} existing seed users — skipping (use --clean to recreate)")
            return

        email_to_user: dict[str, User] = {}
        for email, nickname, status, is_admin, login_delta, created_delta in USERS:
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                password_hash=SEED_PASSWORD,
                nickname=nickname,
                status=status,
                is_admin=is_admin,
                last_login_at=_ago(**login_delta) if login_delta else None,
                created_at=_ago(**created_delta),
            )
            session.add(user)
            email_to_user[email] = user

        await session.flush()
        print(f"{SEED_TAG} Created {len(email_to_user)} users")

        team_objects: list[Team] = []
        for name, description, days_ago in TEAMS:
            team = Team(
                id=str(uuid.uuid4()),
                name=name,
                description=description,
                created_at=_ago(days=days_ago),
            )
            session.add(team)
            team_objects.append(team)

        await session.flush()
        print(f"{SEED_TAG} Created {len(team_objects)} teams")

        member_count = 0
        for team_idx, members in MEMBERSHIPS.items():
            team = team_objects[team_idx]
            for email, role in members:
                user = email_to_user[email]
                tm = TeamMember(
                    id=str(uuid.uuid4()),
                    team_id=team.id,
                    user_id=user.id,
                    role=role,
                    joined_at=team.created_at + timedelta(days=1),
                )
                session.add(tm)
                member_count += 1

        await session.commit()
        print(f"{SEED_TAG} Created {member_count} team memberships")

    _print_summary(email_to_user, team_objects)


def _print_summary(users: dict, teams: list):
    print(f"\n{'='*60}")
    print(f"  Test Data Summary")
    print(f"{'='*60}")
    print(f"  Password for all seed users: test123456")
    print(f"  Admin users: {', '.join(e for e, n, s, a, *_ in USERS if a)}")
    print(f"  Banned users: {', '.join(e for e, n, s, *_ in USERS if s == 'banned')}")
    print(f"  Teams: {', '.join(t[0] for t in TEAMS)}")
    print(f"{'='*60}\n")


async def main():
    await init_db()

    if "--clean" in sys.argv:
        await clean_seed_data()

    await seed()


if __name__ == "__main__":
    asyncio.run(main())
