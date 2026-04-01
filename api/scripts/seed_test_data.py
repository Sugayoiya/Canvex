"""
Seed test data for admin UI testing (Users, Teams, Monitoring, Alerts).

Usage:
    cd api && uv run python scripts/seed_test_data.py          # create seed data
    cd api && uv run python scripts/seed_test_data.py --clean   # delete seed data first, then recreate

Creates:
    - 25 users (mix of active/banned, admin/non-admin, varied login times)
    - 6 teams with varied membership (1–8 members each)
    - Team memberships with team_admin / member roles
    - 60 skill execution logs (Tasks tab + failed_tasks_24h alert)
    - 120 AI call logs (AI Calls tab + usage charts)
    - 8 user quotas (3 near limit → quota_warning_users alert)
    - 1 disabled system provider (→ error_providers alert)

All seeded users share password: test123456
"""

import asyncio
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, func, delete

sys.path.insert(0, ".")

from app.core.database import AsyncSessionLocal, init_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.team import Team, TeamMember  # noqa: E402
from app.models.skill_execution_log import SkillExecutionLog  # noqa: E402
from app.models.ai_call_log import AICallLog  # noqa: E402
from app.models.quota import UserQuota  # noqa: E402
from app.models.ai_provider_config import AIProviderConfig  # noqa: E402

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


SEED_DISABLED_PROVIDER = "[seed] Disabled Provider"

SKILLS = [
    ("generate_script",      "generation"),
    ("generate_character",   "generation"),
    ("generate_scene",       "generation"),
    ("generate_storyboard",  "generation"),
    ("extract_style",        "extraction"),
    ("analyze_video",        "analysis"),
    ("refine_prompt",        "generation"),
    ("translate_subtitle",   "translation"),
]

TRIGGER_SOURCES = ["user_ui", "canvas", "agent", "api"]

AI_MODELS = [
    ("gemini",   "gemini-2.0-flash",       "llm"),
    ("gemini",   "gemini-2.5-pro",         "llm"),
    ("gemini",   "gemini-2.0-flash",       "image"),
    ("openai",   "gpt-4o",                 "llm"),
    ("openai",   "dall-e-3",               "image"),
    ("deepseek", "deepseek-chat",          "llm"),
    ("deepseek", "deepseek-reasoner",      "llm"),
]


def _rand_ts(hours_ago_max: int = 168) -> datetime:
    """Random timestamp within the last `hours_ago_max` hours."""
    return _now - timedelta(hours=random.uniform(0.1, hours_ago_max))


def _build_skill_logs(user_ids: list[str], team_ids: list[str]) -> list[SkillExecutionLog]:
    """Generate 60 skill execution logs with realistic distribution."""
    logs: list[SkillExecutionLog] = []
    statuses_weights = [("completed", 55), ("running", 8), ("failed", 18), ("timeout", 12), ("queued", 7)]
    statuses = [s for s, w in statuses_weights for _ in range(w)]

    for i in range(60):
        skill_name, skill_category = random.choice(SKILLS)
        status = random.choice(statuses)
        is_recent = i < 20
        queued = _rand_ts(hours_ago_max=22) if is_recent else _rand_ts(hours_ago_max=168)
        duration = random.randint(800, 45000) if status in ("completed", "failed", "timeout") else None
        started = queued + timedelta(seconds=random.uniform(0.5, 3)) if status != "queued" else None
        completed = (started + timedelta(milliseconds=duration)) if started and duration and status != "running" else None

        log = SkillExecutionLog(
            id=str(uuid.uuid4()),
            trace_id=str(uuid.uuid4()),
            skill_name=skill_name,
            skill_category=skill_category,
            user_id=random.choice(user_ids),
            team_id=random.choice(team_ids + [None]),
            trigger_source=random.choice(TRIGGER_SOURCES),
            status=status,
            queued_at=queued,
            started_at=started,
            completed_at=completed,
            duration_ms=duration,
            ai_call_count=random.randint(1, 6) if status == "completed" else 0,
            total_input_tokens=random.randint(500, 8000) if status != "queued" else 0,
            total_output_tokens=random.randint(200, 4000) if status == "completed" else 0,
            total_cost=Decimal(str(round(random.uniform(0.001, 0.15), 6))) if status == "completed" else None,
            error_message="Rate limit exceeded" if status == "failed" and random.random() > 0.5
                else ("Model timeout after 30s" if status == "timeout" else
                      ("API key invalid" if status == "failed" else None)),
        )
        logs.append(log)
    return logs


def _build_ai_call_logs(user_ids: list[str], team_ids: list[str], skill_log_ids: list[str]) -> list[AICallLog]:
    """Generate 120 AI call logs with varied providers and costs."""
    logs: list[AICallLog] = []

    for i in range(120):
        provider, model, model_type = random.choice(AI_MODELS)
        is_image = model_type == "image"
        input_tokens = random.randint(100, 12000) if not is_image else random.randint(50, 500)
        output_tokens = random.randint(50, 6000) if not is_image else 0
        status = random.choices(["success", "failed", "error"], weights=[85, 10, 5])[0]

        if provider == "gemini":
            cost = Decimal(str(round(random.uniform(0.0001, 0.05), 6)))
        elif provider == "openai":
            cost = Decimal(str(round(random.uniform(0.001, 0.12), 6)))
        else:
            cost = Decimal(str(round(random.uniform(0.0001, 0.02), 6)))

        created = _rand_ts(hours_ago_max=720)
        log = AICallLog(
            id=str(uuid.uuid4()),
            trace_id=str(uuid.uuid4()),
            skill_execution_id=random.choice(skill_log_ids) if skill_log_ids and random.random() > 0.3 else None,
            user_id=random.choice(user_ids),
            team_id=random.choice(team_ids + [None]),
            provider=provider,
            model=model,
            model_type=model_type,
            input_type="text" if not is_image else "image",
            input_tokens=input_tokens,
            output_type="text" if not is_image else "image",
            output_tokens=output_tokens,
            status=status,
            duration_ms=random.randint(200, 15000),
            cost=cost if status == "success" else Decimal("0"),
            error_message="Rate limit exceeded" if status == "failed" else (
                "Internal server error" if status == "error" else None
            ),
            created_at=created,
        )
        logs.append(log)
    return logs


def _build_user_quotas(user_ids: list[str]) -> list[UserQuota]:
    """Create quotas for 8 users: 3 near/at limit (trigger alert), 3 healthy, 2 unlimited."""
    quotas: list[UserQuota] = []
    configs = [
        (Decimal("10.0000"), Decimal("9.2000")),    # 92% — triggers alert
        (Decimal("5.0000"),  Decimal("4.5000")),     # 90% — triggers alert
        (Decimal("20.0000"), Decimal("17.0000")),    # 85% — triggers alert
        (Decimal("50.0000"), Decimal("15.0000")),    # 30% — healthy
        (Decimal("100.0000"), Decimal("25.0000")),   # 25% — healthy
        (Decimal("10.0000"), Decimal("2.0000")),     # 20% — healthy
        (None,               Decimal("45.0000")),    # unlimited
        (None,               Decimal("8.0000")),     # unlimited
    ]
    for i, (limit, usage) in enumerate(configs):
        if i >= len(user_ids):
            break
        quotas.append(UserQuota(
            id=str(uuid.uuid4()),
            user_id=user_ids[i],
            monthly_credit_limit=limit,
            current_month_usage=usage,
            daily_call_limit=100 if limit else None,
            current_day_calls=random.randint(5, 60),
        ))
    return quotas


async def clean_seed_data():
    """Remove all seeded users, teams, memberships, and monitoring data."""
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
                delete(SkillExecutionLog).where(SkillExecutionLog.user_id.in_(existing))
            )
            await session.execute(
                delete(AICallLog).where(AICallLog.user_id.in_(existing))
            )
            await session.execute(
                delete(UserQuota).where(UserQuota.user_id.in_(existing))
            )

        await session.execute(
            delete(AIProviderConfig).where(AIProviderConfig.display_name == SEED_DISABLED_PROVIDER)
        )
        await session.execute(
            delete(Team).where(Team.name.in_(seed_team_names))
        )
        await session.execute(
            delete(User).where(User.email.in_(seed_emails))
        )
        await session.commit()
        print(f"{SEED_TAG} Cleaned {len(existing)} users, teams, and monitoring data")


async def seed():
    """Create test users, teams, memberships, and monitoring data."""
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

        await session.flush()
        print(f"{SEED_TAG} Created {member_count} team memberships")

        # --- Monitoring data ---
        user_ids = [u.id for u in email_to_user.values()]
        team_ids = [t.id for t in team_objects]

        skill_logs = _build_skill_logs(user_ids, team_ids)
        for log in skill_logs:
            session.add(log)
        await session.flush()
        print(f"{SEED_TAG} Created {len(skill_logs)} skill execution logs")

        skill_log_ids = [sl.id for sl in skill_logs if sl.status == "completed"]
        ai_call_logs = _build_ai_call_logs(user_ids, team_ids, skill_log_ids)
        for log in ai_call_logs:
            session.add(log)
        await session.flush()
        print(f"{SEED_TAG} Created {len(ai_call_logs)} AI call logs")

        quotas = _build_user_quotas(user_ids)
        for q in quotas:
            session.add(q)
        await session.flush()
        near_limit = sum(1 for q in quotas
                         if q.monthly_credit_limit and q.monthly_credit_limit > 0
                         and q.current_month_usage >= q.monthly_credit_limit * Decimal("0.8"))
        print(f"{SEED_TAG} Created {len(quotas)} user quotas ({near_limit} near limit → alert)")

        disabled_provider = AIProviderConfig(
            id=str(uuid.uuid4()),
            provider_name="comfyui",
            display_name=SEED_DISABLED_PROVIDER,
            is_enabled=False,
            owner_type="system",
            priority=99,
        )
        session.add(disabled_provider)
        await session.flush()
        print(f"{SEED_TAG} Created 1 disabled system provider → error_providers alert")

        await session.commit()

    _print_summary(email_to_user, team_objects, skill_logs, ai_call_logs, quotas)


def _print_summary(users: dict, teams: list,
                    skill_logs: list | None = None,
                    ai_call_logs: list | None = None,
                    quotas: list | None = None):
    print(f"\n{'='*60}")
    print(f"  Test Data Summary")
    print(f"{'='*60}")
    print(f"  Password for all seed users: test123456")
    print(f"  Admin users: {', '.join(e for e, n, s, a, *_ in USERS if a)}")
    print(f"  Banned users: {', '.join(e for e, n, s, *_ in USERS if s == 'banned')}")
    print(f"  Teams: {', '.join(t[0] for t in TEAMS)}")
    if skill_logs:
        by_status: dict[str, int] = {}
        for sl in skill_logs:
            by_status[sl.status] = by_status.get(sl.status, 0) + 1
        print(f"  Skill logs: {len(skill_logs)} total — {by_status}")
        recent_failed = sum(1 for sl in skill_logs
                            if sl.status == "failed" and (_now - sl.queued_at).total_seconds() < 86400)
        print(f"  Failed in last 24h: {recent_failed} (→ dashboard alert badge)")
    if ai_call_logs:
        by_provider: dict[str, int] = {}
        for al in ai_call_logs:
            by_provider[al.provider] = by_provider.get(al.provider, 0) + 1
        print(f"  AI call logs: {len(ai_call_logs)} total — {by_provider}")
    if quotas:
        near = sum(1 for q in quotas
                   if q.monthly_credit_limit and q.monthly_credit_limit > 0
                   and q.current_month_usage >= q.monthly_credit_limit * Decimal("0.8"))
        print(f"  User quotas: {len(quotas)} total, {near} at ≥80% limit (→ dashboard alert badge)")
    print(f"  Disabled providers: 1 (→ dashboard alert badge)")
    print(f"{'='*60}\n")


async def main():
    await init_db()

    if "--clean" in sys.argv:
        await clean_seed_data()

    await seed()


if __name__ == "__main__":
    asyncio.run(main())
