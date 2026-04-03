"""Central place to register all Skills at application startup."""
import logging

logger = logging.getLogger(__name__)


def register_all_skills():
    """Register available Skills into the global SkillRegistry.

    Post-Phase 13: All 4 remaining SkillRegistry handlers deprecated.
    SkillRegistry infrastructure retained for Phase 14 ArtifactStore
    and Phase 16 Admin Skill Management.
    """
    from app.skills.registry import skill_registry

    names = skill_registry.list_names()
    if len(names) != len(set(names)):
        duplicates = [n for n in names if names.count(n) > 1]
        logger.error("REGISTRY INTEGRITY: Duplicate skill names detected: %s", duplicates)
        raise RuntimeError(f"Duplicate skill names: {duplicates}")

    logger.info("Skills registered: %d total (%s)", skill_registry.skill_count, ", ".join(names) if names else "none")
