"""Central place to register all Skills at application startup."""
import logging

logger = logging.getLogger(__name__)


def register_all_skills():
    """Register all available Skills into the global SkillRegistry."""
    from app.skills.text import register_text_skills
    from app.skills.extract import register_extract_skills
    from app.skills.canvas_ops import register_canvas_ops_skills
    from app.skills.asset import register_asset_skills
    from app.skills.visual import register_visual_skills

    register_text_skills()
    register_extract_skills()
    register_canvas_ops_skills()
    register_asset_skills()
    register_visual_skills()

    from app.skills.registry import skill_registry
    logger.info("All Skills registered: %d total (%s)", skill_registry.skill_count, ", ".join(skill_registry.list_names()))
