"""Central place to register all Skills at application startup."""
import logging

logger = logging.getLogger(__name__)


def register_all_skills():
    """Register available Skills into the global SkillRegistry.

    Post-Phase 12.1: Only canvas_ops, asset, visual (generate_image),
    and video (generate_video) skills remain in SkillRegistry.
    Reasoning skills migrated to SKILL.md (loaded by SkillLoader).
    """
    from app.skills.canvas_ops import register_canvas_ops_skills
    from app.skills.asset import register_asset_skills
    from app.skills.visual import register_visual_skills
    from app.skills.video import register_video_skills

    register_canvas_ops_skills()
    register_asset_skills()
    register_visual_skills()
    register_video_skills()

    from app.skills.registry import skill_registry

    names = skill_registry.list_names()
    if len(names) != len(set(names)):
        duplicates = [n for n in names if names.count(n) > 1]
        logger.error("REGISTRY INTEGRITY: Duplicate skill names detected: %s", duplicates)
        raise RuntimeError(f"Duplicate skill names: {duplicates}")

    logger.info("Skills registered: %d total (%s)", skill_registry.skill_count, ", ".join(names))
