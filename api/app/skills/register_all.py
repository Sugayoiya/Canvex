"""Central place to register all Skills at application startup."""
import logging

logger = logging.getLogger(__name__)


def register_all_skills():
    """Register all available Skills into the global SkillRegistry."""
    from app.skills.text import register_text_skills
    from app.skills.extract import register_extract_skills
    from app.skills.script import register_script_skills
    from app.skills.storyboard import register_storyboard_skills
    from app.skills.canvas_ops import register_canvas_ops_skills
    from app.skills.asset import register_asset_skills
    from app.skills.visual import register_visual_skills

    register_text_skills()
    register_extract_skills()
    register_script_skills()
    register_storyboard_skills()
    register_canvas_ops_skills()
    register_asset_skills()
    register_visual_skills()

    from app.skills.registry import skill_registry

    names = skill_registry.list_names()
    if len(names) != len(set(names)):
        duplicates = [n for n in names if names.count(n) > 1]
        logger.error("REGISTRY INTEGRITY: Duplicate skill names detected: %s", duplicates)
        raise RuntimeError(f"Duplicate skill names: {duplicates}")

    logger.info("All Skills registered: %d total (%s)", skill_registry.skill_count, ", ".join(names))
